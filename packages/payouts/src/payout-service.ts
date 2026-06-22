/**
 * PayoutService — pays translators on merge.
 *
 * Flow per merge: idempotency check → resolve the translator's Lightning address
 * → check the treasury → pay via NWC/LNURL (`@neoark/translator-payments`) →
 * publish the signed payout receipt (kind:30712) to the relays → debit treasury.
 *
 * The wallet (NWC), HTTP, and invoice resolver are injected, so there is no
 * custody and no network in tests. The NWC adapter (e.g. Alby — OQ-P2-1) is the
 * caller's choice via the `wallet` interface.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { payTranslator } from '@neoark/translator-payments'
import type { Wallet, JsonFetch, resolveLnurlPay } from '@neoark/payer'
import { parseMerge, parseProposal, KIND_REVIEW, KIND_PROPOSAL } from '@neoark/translation-protocol'
import type { RelayPool } from '@neoark/relay'
import { computePayout, debit } from './treasury'
import type { ProfileResolver, PaidStore, PayoutOutcome, Treasury } from './types'

class MemoryPaidStore implements PaidStore {
  private readonly set = new Set<string>()
  has(id: string): boolean {
    return this.set.has(id)
  }
  add(id: string): void {
    this.set.add(id)
  }
  remove(id: string): void {
    this.set.delete(id)
  }
}

export interface PayoutServiceOptions {
  wallet: Wallet
  fetchJson: JsonFetch
  /** Key that signs the public payout-record events. */
  payerSeckey: string
  treasury: Treasury
  profiles: ProfileResolver
  pool: RelayPool
  paidStore?: PaidStore
  resolveInvoice?: typeof resolveLnurlPay
}

export interface MergeToPay {
  mergeEventId: string
  translatorPubkey: string
  createdAt: number
}

export class PayoutService {
  private readonly paid: PaidStore

  constructor(private readonly o: PayoutServiceOptions) {
    this.paid = o.paidStore ?? new MemoryPaidStore()
  }

  get treasuryBalance(): number {
    return this.o.treasury.balanceSats
  }

  /** Pay one merge. Idempotent: a merge id is never paid twice. */
  async payoutForMerge(merge: MergeToPay): Promise<PayoutOutcome> {
    const base = { mergeEventId: merge.mergeEventId, translatorPubkey: merge.translatorPubkey }

    if (this.paid.has(merge.mergeEventId)) {
      return { ...base, paid: false, reason: 'already paid' }
    }
    const lightningAddress = await this.o.profiles.lightningAddress(merge.translatorPubkey)
    if (!lightningAddress) {
      return { ...base, paid: false, reason: 'no Lightning address on translator profile' }
    }
    const computation = computePayout(this.o.treasury)
    if (!computation.fundable) {
      return { ...base, paid: false, reason: computation.reason }
    }

    // Mark paid BEFORE the network call so a retry can't double-pay.
    this.paid.add(merge.mergeEventId)
    try {
      const { receipt, record } = await payTranslator(
        { lightningAddress, sats: computation.amountSat, mergeEventId: merge.mergeEventId, createdAt: merge.createdAt },
        {
          wallet: this.o.wallet,
          fetchJson: this.o.fetchJson,
          payerSeckey: this.o.payerSeckey,
          ...(this.o.resolveInvoice ? { resolveInvoice: this.o.resolveInvoice } : {}),
        },
      )
      const acks = await this.o.pool.publish(record)
      debit(this.o.treasury, computation.amountSat)
      return {
        ...base,
        paid: true,
        reason: 'paid',
        amountSat: computation.amountSat,
        receipt,
        record,
        relaysAccepted: acks.filter((a) => a.ok).length,
      }
    } catch (e) {
      this.paid.remove(merge.mergeEventId) // un-reserve so a retry can pay
      return { ...base, paid: false, reason: `payment failed: ${e instanceof Error ? e.message : String(e)}` }
    }
  }

  /**
   * Scan the relays for merge events and pay every unpaid one. Joins each merge
   * to its proposal (kind:30702) to find the translator (author) to pay.
   */
  async processMerges(translationId: string): Promise<PayoutOutcome[]> {
    const [reviewEvents, proposalEvents] = await Promise.all([
      this.o.pool.query({ kinds: [KIND_REVIEW] }),
      this.o.pool.query({ kinds: [KIND_PROPOSAL] }),
    ])

    const authorByProposal = new Map<string, string>()
    for (const e of proposalEvents) {
      try {
        const p = parseProposal(e)
        if (p.ref.translationId === translationId) authorByProposal.set(p.id, p.author)
      } catch {
        /* skip */
      }
    }

    const outcomes: PayoutOutcome[] = []
    for (const e of reviewEvents) {
      let proposalId: string
      try {
        proposalId = parseMerge(e).proposalId
      } catch {
        continue // not a merge
      }
      const author = authorByProposal.get(proposalId)
      if (!author) continue // merge for another translation / unknown proposal
      outcomes.push(await this.payoutForMerge({ mergeEventId: e.id, translatorPubkey: author, createdAt: e.created_at }))
    }
    return outcomes
  }
}
