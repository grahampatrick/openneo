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
  approvals: number
  rejections: number
  reviewers: number
  /** Reviewers still needed to reach quorum. */
  needed: number
  /** Quorum reached and not yet merged. */
  mergeReady: boolean
  merged: boolean
}

/** Signer abstraction (NIP-07 in browser, key-backed in tests/CLI). */
export interface Signer {
  getPublicKey(): string | Promise<string>
  signEvent(event: { kind: number; created_at: number; tags: string[][]; content: string }): import('@neoark/manifest').NostrEvent | Promise<import('@neoark/manifest').NostrEvent>
}
