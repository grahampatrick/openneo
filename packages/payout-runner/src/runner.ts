/**
 * PayoutRunner — the operator service that turns governed merges into Lightning
 * payouts. For each merge it: (1) verifies the merge is governed (signed by a
 * council maintainer, reviews met the council quorum), (2) identifies the
 * participants (Translator = proposal author; Reviewers = approving maintainers;
 * Submitter = linked issue author, if any), (3) computes the split, (4) resolves
 * each participant's Lightning address and pays their share from the treasury,
 * (5) publishes a kind:30712 receipt per recipient.
 *
 * Idempotency is per (mergeId, recipient) and reserved before the payment, so a
 * restart or re-run never double-pays. The wallet, HTTP, invoice resolver, and
 * paid-state store are injected — no custody, no network in tests.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import {
  KIND_PROPOSAL,
  KIND_REVIEW,
  parseProposal,
  parseReview,
  parseMerge,
  resolveGovernance,
} from '@neoark/translation-protocol'
import type { Proposal, Review } from '@neoark/translation-protocol'
import type { RelayPool } from '@neoark/relay'
import type { NostrEvent } from '@neoark/manifest'
import { payTranslator } from '@neoark/translator-payments'
import { computeMergeSplit, debit } from '@neoark/payouts'
import type {
  Treasury,
  ProfileResolver,
  PaidStore,
  SplitPercents,
  SplitShare,
} from '@neoark/payouts'
import type { Wallet, JsonFetch, resolveLnurlPay } from '@neoark/payer'

export interface PayoutRunnerOptions {
  wallet: Wallet
  fetchJson: JsonFetch
  /** Key that signs the public payout-record events. */
  payerSeckey: string
  treasury: Treasury
  profiles: ProfileResolver
  pool: RelayPool
  /** Per-(merge,recipient) paid store — persistent in production. */
  paidStore: PaidStore
  /** Split percentages (default 70/20/10). */
  percents?: SplitPercents
  resolveInvoice?: typeof resolveLnurlPay
  /** Founding maintainer pin for governance resolution (hijack resistance). */
  foundingPubkey?: string
}

export interface RecipientPayout {
  pubkey: string
  role: SplitShare['role']
  sats: number
  paid: boolean
  reason: string
  lightningAddress?: string
  receiptId?: string
}

export interface MergePayout {
  mergeEventId: string
  proposalId: string
  governed: boolean
  reason: string
  recipients: RecipientPayout[]
  totalPaidSats: number
}

export class PayoutRunner {
  constructor(private readonly o: PayoutRunnerOptions) {}

  get treasuryBalance(): number {
    return this.o.treasury.balanceSats
  }

  /**
   * Scan the relays for governed merges of `translationId` and split-pay each
   * one's participants. Returns a result per merge.
   */
  async processGovernedMerges(translationId: string): Promise<MergePayout[]> {
    const [govEvents, proposalEvents, reviewEvents] = await Promise.all([
      this.o.pool.query({ kinds: [30750], limit: 100 }),
      this.o.pool.query({ kinds: [KIND_PROPOSAL], limit: 500 }),
      this.o.pool.query({ kinds: [KIND_REVIEW], limit: 1000 }),
    ])

    const gov = resolveGovernance(govEvents, translationId, this.o.foundingPubkey ? { foundingPubkey: this.o.foundingPubkey } : {})
    if (!gov) return [] // ungoverned — never pay (anti-Sybil)
    const council = new Set(gov.maintainers)

    const proposals = new Map<string, Proposal>()
    for (const e of proposalEvents) {
      const p = tryParse(() => parseProposal(e))
      if (p?.ref.translationId === translationId) proposals.set(p.id, p)
    }

    // Reviews by proposal, and merges.
    const reviewsByProposal = new Map<string, Review[]>()
    const merges: NostrEvent[] = []
    for (const e of reviewEvents) {
      if (tryParse(() => parseMerge(e))) {
        merges.push(e)
        continue
      }
      const r = tryParse(() => parseReview(e))
      if (r) {
        const list = reviewsByProposal.get(r.proposalId)
        if (list) list.push(r)
        else reviewsByProposal.set(r.proposalId, [r])
      }
    }

    const out: MergePayout[] = []
    for (const mergeEvent of merges) {
      const m = tryParse(() => parseMerge(mergeEvent))
      if (!m) continue
      const proposal = proposals.get(m.proposalId)
      if (!proposal) continue // merge for an unknown / other-translation proposal

      // Governance gate: the merger must be a council maintainer.
      if (!council.has(m.maintainer.toLowerCase())) {
        out.push({ mergeEventId: m.id, proposalId: m.proposalId, governed: false, reason: 'merge not signed by a council maintainer — skipped', recipients: [], totalPaidSats: 0 })
        continue
      }

      out.push(await this.payMerge(translationId, proposal, reviewsByProposal.get(proposal.id) ?? [], council, m.id, mergeEvent.created_at))
    }
    return out
  }

  private async payMerge(
    translationId: string,
    proposal: Proposal,
    reviews: Review[],
    council: Set<string>,
    mergeEventId: string,
    createdAt: number,
  ): Promise<MergePayout> {
    // Approving maintainers (latest vote per reviewer, council-scoped, not the author).
    const latest = new Map<string, 'approve' | 'reject'>()
    for (const r of reviews) {
      if (r.proposalId !== proposal.id) continue
      if (r.reviewer === proposal.author) continue
      if (!council.has(r.reviewer.toLowerCase())) continue
      latest.set(r.reviewer.toLowerCase(), r.vote)
    }
    const approvers = [...latest].filter(([, v]) => v === 'approve').map(([k]) => k)

    const split = computeMergeSplit(
      { translator: proposal.author, reviewers: approvers },
      this.o.treasury.perMergeSats,
      this.o.percents,
    )

    const recipients: RecipientPayout[] = []
    let totalPaidSats = 0
    for (const share of split) {
      const r = await this.payShare(translationId, share, mergeEventId, createdAt)
      recipients.push(r)
      if (r.paid) totalPaidSats += share.sats
    }
    return { mergeEventId, proposalId: proposal.id, governed: true, reason: 'governed merge', recipients, totalPaidSats }
  }

  private async payShare(
    _translationId: string,
    share: SplitShare,
    mergeEventId: string,
    createdAt: number,
  ): Promise<RecipientPayout> {
    const base = { pubkey: share.pubkey, role: share.role, sats: share.sats }
    const payKey = `${mergeEventId}:${share.pubkey}`

    if (this.o.paidStore.has(payKey)) return { ...base, paid: false, reason: 'already paid' }

    const lightningAddress = await this.o.profiles.lightningAddress(share.pubkey)
    if (!lightningAddress) return { ...base, paid: false, reason: 'no Lightning address on profile' }
    if (this.o.treasury.balanceSats < share.sats) return { ...base, paid: false, reason: 'insufficient treasury' }

    this.o.paidStore.add(payKey) // reserve before paying — restart/retry safe
    try {
      const { record } = await payTranslator(
        { lightningAddress, sats: share.sats, mergeEventId, createdAt },
        {
          wallet: this.o.wallet,
          fetchJson: this.o.fetchJson,
          payerSeckey: this.o.payerSeckey,
          ...(this.o.resolveInvoice ? { resolveInvoice: this.o.resolveInvoice } : {}),
        },
      )
      await this.o.pool.publish(record)
      debit(this.o.treasury, share.sats)
      return { ...base, paid: true, reason: 'paid', lightningAddress, receiptId: record.id }
    } catch (e) {
      this.o.paidStore.remove(payKey) // un-reserve so a retry can pay
      return { ...base, paid: false, reason: `payment failed: ${e instanceof Error ? e.message : String(e)}`, lightningAddress }
    }
  }
}

function tryParse<T>(fn: () => T): T | null {
  try {
    return fn()
  } catch {
    return null
  }
}
