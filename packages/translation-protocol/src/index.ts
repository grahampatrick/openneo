/**
 * @neoark/translation-protocol — Bitcoin-anchored translation PR system.
 * Proposals (kind:30702), peer reviews + merges (kind:30703), and
 * OpenTimestamps-style batch anchoring to Bitcoin.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
export { submitProposal, parseProposal } from './proposals'
export type { SubmitProposalInput } from './proposals'

export { submitReview, parseReview, tallyReviews } from './reviews'
export type { SubmitReviewInput } from './reviews'

export { mergeProposal, parseMerge, QuorumNotMetError, NotAMaintainerError } from './merge'
export type { MergeResult, MergeOptions } from './merge'

export { merkleRoot, inclusionProof, verifyInclusion } from './merkle'
export { anchorBatch, inclusionProofFor, verifyAnchor, MockCalendar } from './anchor'
export type { AnchorVerification } from './anchor'

export {
  KIND_GOVERNANCE,
  buildGovernanceEvent,
  parseGovernance,
  resolveGovernance,
  signGovernance,
} from './governance'
export type { Governance, BuildGovernanceInput } from './governance'

export { KIND_PROPOSAL, KIND_REVIEW, DEFAULT_QUORUM } from './types'
export type {
  NostrEvent,
  Vote,
  VerseRef,
  Proposal,
  Review,
  MergeRecord,
  QuorumConfig,
  Tally,
  TallyOptions,
  Attestation,
  BatchAnchor,
  MerkleStep,
  InclusionProof,
  CalendarClient,
} from './types'
