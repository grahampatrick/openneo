/**
 * Types for the Bitcoin-anchored translation protocol.
 * See docs/protocol/TRANSLATION_PROTOCOL.md.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import type { NostrEvent } from '@neoark/manifest'

export type { NostrEvent }

/** ARK event kinds for the protocol. */
export const KIND_PROPOSAL = 30702
export const KIND_REVIEW = 30703

export type Vote = 'approve' | 'reject'

/** A verse address a proposal targets. */
export interface VerseRef {
  translationId: string
  book: string
  chapter: number
  verse: number
}

/** A parsed verse-revision proposal (kind:30702). */
export interface Proposal {
  event: NostrEvent
  id: string
  author: string
  ref: VerseRef
  newText: string
  rationale: string
}

/** A parsed peer review (kind:30703, action=review). */
export interface Review {
  event: NostrEvent
  id: string
  reviewer: string
  proposalId: string
  vote: Vote
  comment: string
}

/** A parsed merge (kind:30703, action=merge). */
export interface MergeRecord {
  event: NostrEvent
  id: string
  maintainer: string
  proposalId: string
  approvals: number
  reviewers: number
}

/** Per-translation review quorum. */
export interface QuorumConfig {
  minReviewers: number
  /** Fraction of reviews that must be approvals, 0..1. */
  approvalThreshold: number
}

export const DEFAULT_QUORUM: QuorumConfig = { minReviewers: 3, approvalThreshold: 0.67 }

export interface Tally {
  approvals: number
  rejections: number
  reviewers: number
  approvalRatio: number
  meetsQuorum: boolean
}

// --- Bitcoin anchoring (OpenTimestamps-style) ---

/** A pending calendar attestation, upgraded to a Bitcoin one once confirmed. */
export type Attestation =
  | { type: 'pending'; calendar: string; submittedRoot: string }
  | { type: 'bitcoin'; blockHeight: number; blockHash: string; merkleRoot: string }

/** A batch anchor: one Merkle root over many merged event ids, timestamped once. */
export interface BatchAnchor {
  algo: 'sha256'
  merkleRoot: string
  leaves: string[]
  attestation: Attestation
}

/** One step of a Merkle inclusion path. */
export interface MerkleStep {
  hash: string
  /** Which side the sibling is on relative to the running hash. */
  side: 'left' | 'right'
}

export interface InclusionProof {
  leaf: string
  path: MerkleStep[]
  merkleRoot: string
}

/** Submits a Merkle root for timestamping and verifies attestations. Mocked in tests. */
export interface CalendarClient {
  submit(rootHex: string): Promise<Attestation>
  verify(rootHex: string, attestation: Attestation): Promise<boolean>
}
