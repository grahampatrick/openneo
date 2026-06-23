/**
 * Collect the payout split for every governed merge of a translation. Shared by
 * the auto-runner (which pays each share via a wallet) and the manual tool (which
 * lists shares for a human to pay from their own wallet). Verifying a merge is
 * GOVERNED (council-maintainer-signed) happens here — the single anti-Sybil gate.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import {
  KIND_PROPOSAL,
  KIND_REVIEW,
  KIND_GOVERNANCE,
  parseProposal,
  parseReview,
  parseMerge,
  resolveGovernance,
} from '@neoark/translation-protocol'
import type { Proposal, Review } from '@neoark/translation-protocol'
import type { RelayPool } from '@neoark/relay'
import type { NostrEvent } from '@neoark/manifest'
import { computeMergeSplit } from '@neoark/payouts'
import type { SplitPercents, SplitShare } from '@neoark/payouts'

export interface GovernedMergePayout {
  mergeEventId: string
  proposalId: string
  ref: { book: string; chapter: number; verse: number }
  /** Computed per-recipient split for this merge. */
  shares: SplitShare[]
}

export interface CollectOptions {
  perMergeSats: number
  percents?: SplitPercents
  foundingPubkey?: string
}

function tryParse<T>(fn: () => T): T | null {
  try {
    return fn()
  } catch {
    return null
  }
}

/** Fetch governed merges and compute each one's payout split. Ungoverned → []. */
export async function collectGovernedPayouts(
  pool: RelayPool,
  translationId: string,
  opts: CollectOptions,
): Promise<GovernedMergePayout[]> {
  const [govEvents, proposalEvents, reviewEvents] = await Promise.all([
    pool.query({ kinds: [KIND_GOVERNANCE], limit: 100 }),
    pool.query({ kinds: [KIND_PROPOSAL], limit: 500 }),
    pool.query({ kinds: [KIND_REVIEW], limit: 1000 }),
  ])

  const gov = resolveGovernance(govEvents, translationId, opts.foundingPubkey ? { foundingPubkey: opts.foundingPubkey } : {})
  if (!gov) return [] // ungoverned — never pay (anti-Sybil)
  const council = new Set(gov.maintainers)

  const proposals = new Map<string, Proposal>()
  for (const e of proposalEvents) {
    const p = tryParse(() => parseProposal(e))
    if (p?.ref.translationId === translationId) proposals.set(p.id, p)
  }

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

  const out: GovernedMergePayout[] = []
  for (const mergeEvent of merges) {
    const m = tryParse(() => parseMerge(mergeEvent))
    if (!m) continue
    const proposal = proposals.get(m.proposalId)
    if (!proposal) continue
    if (!council.has(m.maintainer.toLowerCase())) continue // not a governed merge

    // Prefer the approvers recorded in the merge event (reliable — no re-fetch).
    // Fall back to re-deriving from review events if an older merge omitted them.
    let approvers = m.approvers.filter((a) => council.has(a) && a !== proposal.author.toLowerCase())
    if (approvers.length === 0) {
      const latest = new Map<string, 'approve' | 'reject'>()
      for (const r of reviewsByProposal.get(proposal.id) ?? []) {
        if (r.proposalId !== proposal.id || r.reviewer === proposal.author) continue
        if (!council.has(r.reviewer.toLowerCase())) continue
        latest.set(r.reviewer.toLowerCase(), r.vote)
      }
      approvers = [...latest].filter(([, v]) => v === 'approve').map(([k]) => k)
    }

    const shares = computeMergeSplit({ translator: proposal.author, reviewers: approvers }, opts.perMergeSats, opts.percents)
    out.push({ mergeEventId: m.id, proposalId: proposal.id, ref: proposal.ref, shares })
  }
  return out
}
