/**
 * Peer reviews (kind:30703, action=review) and quorum tallying.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { signEvent, verifyEventSignature } from '@neoark/manifest'
import type { NostrEvent } from '@neoark/manifest'
import { KIND_REVIEW } from './types'
import type { Review, Vote, QuorumConfig, Tally, TallyOptions } from './types'

export interface SubmitReviewInput {
  proposalId: string
  vote: Vote
  comment: string
  createdAt: number
}

/** Build + sign a kind:30703 review event. */
export function submitReview(input: SubmitReviewInput, privKey: string): NostrEvent {
  const { proposalId, vote, comment, createdAt } = input
  const tags: string[][] = [
    ['e', proposalId],
    ['ark_action', 'review'],
    ['ark_vote', vote],
  ]
  return signEvent({ created_at: createdAt, kind: KIND_REVIEW, tags, content: comment }, privKey)
}

function tagValue(e: NostrEvent, name: string): string | undefined {
  return e.tags.find((t) => t[0] === name)?.[1]
}

/** Parse + validate a review event. Throws if malformed or not action=review. */
export function parseReview(event: NostrEvent): Review {
  if (event.kind !== KIND_REVIEW) throw new Error(`Not a review: kind ${String(event.kind)}`)
  if (tagValue(event, 'ark_action') !== 'review') throw new Error('Event is not a review action')
  if (!verifyEventSignature(event)) throw new Error('Review signature does not verify')
  const proposalId = tagValue(event, 'e')
  const vote = tagValue(event, 'ark_vote')
  if (!proposalId || (vote !== 'approve' && vote !== 'reject')) {
    throw new Error('Review missing proposal reference or valid vote')
  }
  return { event, id: event.id, reviewer: event.pubkey, proposalId, vote, comment: event.content }
}

/**
 * Tally reviews for one proposal. Only the latest review per reviewer counts
 * (a reviewer may change their vote), and a reviewer cannot review with the
 * same key as... (self-review prevention is the caller's concern via pubkeys).
 */
export function tallyReviews(reviews: Review[], quorum: QuorumConfig, opts: TallyOptions = {}): Tally {
  const council = opts.maintainers ? new Set(opts.maintainers.map((m) => m.toLowerCase())) : null

  // Last vote per reviewer wins.
  const latest = new Map<string, Vote>()
  for (const r of reviews) latest.set(r.reviewer, r.vote)

  let approvals = 0
  let rejections = 0
  let communityApprovals = 0
  for (const [reviewer, vote] of latest) {
    // When a council is set, only its members count toward quorum; others are
    // a public community signal that never merges (anti-Sybil).
    if (council && !council.has(reviewer.toLowerCase())) {
      if (vote === 'approve') communityApprovals++
      continue
    }
    if (vote === 'approve') approvals++
    else rejections++
  }

  const reviewers = approvals + rejections
  const approvalRatio = reviewers === 0 ? 0 : approvals / reviewers
  const meetsQuorum = reviewers >= quorum.minReviewers && approvalRatio >= quorum.approvalThreshold
  return { approvals, rejections, reviewers, approvalRatio, meetsQuorum, communityApprovals, governed: council !== null }
}
