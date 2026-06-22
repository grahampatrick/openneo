/**
 * @neoark/review types.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import type { Proposal, Review, QuorumConfig } from '@neoark/translation-protocol'

export type { Proposal, Review, QuorumConfig }

/** A proposal plus its current review state — what a reviewer sees in the queue. */
export interface ReviewableProposal {
  proposal: Proposal
  reviews: Review[]
  /** Approvals counted toward quorum (maintainers only, when a council is set). */
  approvals: number
  rejections: number
  reviewers: number
  /** Reviewers still needed to reach quorum. */
  needed: number
  /** Quorum reached and not yet merged. */
  mergeReady: boolean
  merged: boolean
  /** Non-maintainer approvals — public community signal that does NOT merge. */
  communityApprovals: number
  /** Whether a maintainer council gated this proposal. */
  governed: boolean
}

/** Optional council scoping for review/merge (anti-Sybil). */
export interface GovernanceContext {
  /** Maintainer pubkeys (hex). When set, only their votes count toward quorum. */
  maintainers?: readonly string[]
}

/** Signer abstraction (NIP-07 in browser, key-backed in tests/CLI). */
export interface Signer {
  getPublicKey(): string | Promise<string>
  signEvent(event: { kind: number; created_at: number; tags: string[][]; content: string }): import('@neoark/manifest').NostrEvent | Promise<import('@neoark/manifest').NostrEvent>
}
