/**
 * Cast a review vote (kind:30703) and, when quorum is met, emit the merge.
 *
 * Voting and merging are signed via the injected Signer (NIP-07 in the browser),
 * so reviewers/maintainers never expose a private key. The events themselves are
 * built by @neoark/translation-protocol's schema so they validate downstream.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { KIND_REVIEW, DEFAULT_QUORUM, mergeProposal, signMerge, parseReview } from '@neoark/translation-protocol'
import type { RelayPool } from '@neoark/relay'
import type { NostrEvent } from '@neoark/manifest'
import type { Proposal, QuorumConfig, Review, Signer } from './types'
import { reviewState } from './queue'

export type Vote = 'approve' | 'reject'

export interface CastVoteInput {
  proposalId: string
  vote: Vote
  comment: string
  createdAt: number
}

export interface CastVoteResult {
  event: NostrEvent
  review: Review
  relaysAccepted: number
}

/** Build, sign (via the signer), and publish a review vote. */
export async function castVote(input: CastVoteInput, signer: Signer, pool: RelayPool): Promise<CastVoteResult> {
  const tags: string[][] = [
    ['e', input.proposalId],
    ['ark_action', 'review'],
    ['ark_vote', input.vote],
  ]
  const event = await signer.signEvent({ kind: KIND_REVIEW, created_at: input.createdAt, tags, content: input.comment })
  const review = parseReview(event) // validates schema + signature
  const acks = await pool.publish(event)
  return { event, review, relaysAccepted: acks.filter((a) => a.ok).length }
}

export interface MaybeMergeResult {
  merged: boolean
  reason: string
  event?: NostrEvent
  relaysAccepted?: number
}

/**
 * If `proposal` has reached quorum (and isn't already merged), sign + publish a
 * merge event with the maintainer key and return it; otherwise report why not.
 * `maintainerKey` is a raw secret (merges are a maintainer action, typically
 * server-side / CLI, not a browser extension).
 */
export interface MaybeMergeOptions {
  /** Maintainer council (hex). When set, votes are council-scoped and the merger must be a maintainer. */
  maintainers?: readonly string[]
  /** The merger's pubkey (hex) — required when `maintainers` is set. */
  mergerPubkey?: string
}

/**
 * Merge if quorum is met. `merger` is a raw maintainer key (string) OR a Signer
 * (NIP-07 extension / key-backed) — so extension-only maintainers can merge.
 */
export async function maybeMerge(
  proposal: Proposal,
  reviews: Review[],
  merger: string | Signer,
  createdAt: number,
  pool: RelayPool,
  quorum: QuorumConfig = DEFAULT_QUORUM,
  gov: MaybeMergeOptions = {},
): Promise<MaybeMergeResult> {
  const state = reviewState(proposal, reviews, false, quorum, gov.maintainers ? { maintainers: gov.maintainers } : {})
  if (state.merged) return { merged: false, reason: 'already merged' }
  if (gov.maintainers && gov.maintainers.length > 0) {
    const council = new Set(gov.maintainers.map((m) => m.toLowerCase()))
    if (!gov.mergerPubkey || !council.has(gov.mergerPubkey.toLowerCase())) {
      return { merged: false, reason: 'only a council maintainer may merge this translation' }
    }
  }
  if (!state.mergeReady) {
    return { merged: false, reason: `quorum not met (${String(state.approvals)}/${String(state.reviewers)} maintainer approvals, need ${String(state.needed)} more)` }
  }
  const options = {
    quorum,
    ...(gov.maintainers ? { maintainers: gov.maintainers, mergerPubkey: gov.mergerPubkey } : {}),
  }
  const result =
    typeof merger === 'string'
      ? mergeProposal(proposal, state.reviews, merger, createdAt, options)
      : await signMerge(proposal, state.reviews, merger, createdAt, options)
  const acks = await pool.publish(result.event)
  return { merged: true, reason: 'quorum met', event: result.event, relaysAccepted: acks.filter((a) => a.ok).length }
}
