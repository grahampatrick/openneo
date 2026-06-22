/**
 * Build the review queue — fetch proposals + their reviews/merges from the
 * relays and compute each one's state against the quorum.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import {
  KIND_PROPOSAL,
  KIND_REVIEW,
  DEFAULT_QUORUM,
  parseProposal,
  parseReview,
  parseMerge,
  tallyReviews,
} from '@neoark/translation-protocol'
import type { RelayPool } from '@neoark/relay'
import type { NostrEvent } from '@neoark/manifest'
import type { Proposal, QuorumConfig, Review, ReviewableProposal, GovernanceContext } from './types'

/** NIP-09 deletion event kind — an author withdrawing their own proposal. */
export const KIND_DELETION = 5

/** Build the unsigned NIP-09 deletion that withdraws a proposal (sign with the author's signer). */
export function buildWithdrawal(proposalId: string, createdAt: number): { kind: number; created_at: number; tags: string[][]; content: string } {
  return { kind: KIND_DELETION, created_at: createdAt, tags: [['e', proposalId]], content: 'withdrawn by author' }
}

/** Compute the reviewable state of one proposal from its reviews + merge flag. */
export function reviewState(
  proposal: Proposal,
  reviews: Review[],
  merged: boolean,
  quorum: QuorumConfig = DEFAULT_QUORUM,
  gov: GovernanceContext = {},
): ReviewableProposal {
  // Drop the author's self-reviews (no self-approval).
  const eligible = reviews.filter((r) => r.proposalId === proposal.id && r.reviewer !== proposal.author)
  const tally = tallyReviews(eligible, quorum, gov.maintainers ? { maintainers: gov.maintainers } : {})
  const needed = Math.max(0, quorum.minReviewers - tally.reviewers)
  return {
    proposal,
    reviews: eligible,
    approvals: tally.approvals,
    rejections: tally.rejections,
    reviewers: tally.reviewers,
    needed: tally.meetsQuorum ? 0 : needed,
    mergeReady: !merged && tally.meetsQuorum,
    merged,
    communityApprovals: tally.communityApprovals,
    governed: tally.governed,
  }
}

/**
 * Fetch all proposals for a translation and assemble the review queue. Pulls
 * proposal events (kind:30702) and review/merge events (kind:30703) in two
 * queries, then groups them.
 */
export async function fetchReviewQueue(
  pool: RelayPool,
  translationId: string,
  quorum: QuorumConfig = DEFAULT_QUORUM,
  gov: GovernanceContext = {},
): Promise<ReviewableProposal[]> {
  const [proposalEvents, reviewEvents, deletionEvents] = await Promise.all([
    pool.query({ kinds: [KIND_PROPOSAL] }),
    pool.query({ kinds: [KIND_REVIEW] }),
    pool.query({ kinds: [KIND_DELETION] }),
  ])

  // NIP-09: a proposal is withdrawn if its author published a kind:5 deleting it.
  const withdrawn = new Set<string>()
  for (const e of deletionEvents) {
    for (const t of e.tags) if (t[0] === 'e' && t[1]) withdrawn.add(`${e.pubkey}:${t[1]}`)
  }

  const proposals: Proposal[] = []
  for (const e of proposalEvents) {
    try {
      const p = parseProposal(e)
      if (p.ref.translationId !== translationId) continue
      if (withdrawn.has(`${p.author}:${p.id}`)) continue // author withdrew it
      proposals.push(p)
    } catch {
      /* skip */
    }
  }

  // Index reviews + merges by proposal id.
  const reviewsById = new Map<string, Review[]>()
  const mergedIds = new Set<string>()
  for (const e of reviewEvents) {
    const merge = tryParseMerge(e)
    if (merge) {
      mergedIds.add(merge)
      continue
    }
    const review = tryParseReview(e)
    if (review) {
      const list = reviewsById.get(review.proposalId)
      if (list) list.push(review)
      else reviewsById.set(review.proposalId, [review])
    }
  }

  return proposals
    .map((p) => reviewState(p, reviewsById.get(p.id) ?? [], mergedIds.has(p.id), quorum, gov))
    .sort((a, b) => b.proposal.event.created_at - a.proposal.event.created_at)
}

/** Only the proposals still awaiting reviews (pending, not merge-ready, not merged). */
export function pendingOnly(queue: ReviewableProposal[]): ReviewableProposal[] {
  return queue.filter((q) => !q.merged && !q.mergeReady)
}

function tryParseMerge(e: NostrEvent): string | null {
  try {
    return parseMerge(e).proposalId
  } catch {
    return null
  }
}
function tryParseReview(e: NostrEvent): Review | null {
  try {
    return parseReview(e)
  } catch {
    return null
  }
}
