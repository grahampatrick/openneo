/**
 * Derive a proposal's status from the review + merge events on the relay.
 *
 * Threshold is configurable (OQ-P2-2); the default mirrors the M5 quorum
 * (3 reviewers, 67% approval). A merge event for the proposal always wins.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { parseReview, parseMerge, tallyReviews, DEFAULT_QUORUM } from '@neoark/translation-protocol'
import type { QuorumConfig } from '@neoark/translation-protocol'
import type { NostrEvent } from '@neoark/manifest'

export type ProposalState = 'pending' | 'approved' | 'merged'

export interface ProposalStatus {
  state: ProposalState
  approvals: number
  rejections: number
  reviewers: number
  /** Reviewers still needed to reach quorum (0 if met/merged). */
  needed: number
}

/**
 * Compute status for `proposalId` given relay events (a mix of reviews/merges)
 * and the proposal author's pubkey (to drop self-reviews).
 *
 * - `merged`   — a kind:30703 merge event references this proposal
 * - `approved` — reviews meet quorum (ready to merge)
 * - `pending`  — otherwise
 */
export function proposalStatus(
  proposalId: string,
  authorPubkey: string,
  events: NostrEvent[],
  quorum: QuorumConfig = DEFAULT_QUORUM,
): ProposalStatus {
  let merged = false
  const reviews = []
  for (const e of events) {
    // Merge events take precedence.
    try {
      const m = parseMerge(e)
      if (m.proposalId === proposalId) merged = true
      continue
    } catch {
      /* not a merge */
    }
    try {
      const r = parseReview(e)
      if (r.proposalId === proposalId && r.reviewer !== authorPubkey) reviews.push(r)
    } catch {
      /* not a review */
    }
  }

  const tally = tallyReviews(reviews, quorum)
  const needed = Math.max(0, quorum.minReviewers - tally.reviewers)
  if (merged) {
    return { state: 'merged', approvals: tally.approvals, rejections: tally.rejections, reviewers: tally.reviewers, needed: 0 }
  }
  return {
    state: tally.meetsQuorum ? 'approved' : 'pending',
    approvals: tally.approvals,
    rejections: tally.rejections,
    reviewers: tally.reviewers,
    needed: tally.meetsQuorum ? 0 : needed,
  }
}

/** Badge label + colour for a status (UI helper). */
export function statusBadge(s: ProposalStatus): { text: string; color: string } {
  switch (s.state) {
    case 'merged':
      return { text: 'Merged · anchored to Bitcoin', color: '#50fa7b' }
    case 'approved':
      return { text: `Approved (${s.approvals}/${s.reviewers}) · ready to merge`, color: '#6ee7ff' }
    default:
      return { text: `Pending · ${s.approvals} approval(s), ${s.needed} more needed`, color: '#f0ad4e' }
  }
}
