/**
 * Merges (kind:30703, action=merge). A maintainer merges a proposal once its
 * reviews meet quorum. The merge event is signed by the maintainer and carries
 * the verse update to apply to the corpus.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { signEvent, verifyEventSignature } from '@neoark/manifest'
import type { NostrEvent } from '@neoark/manifest'
import { KIND_REVIEW, DEFAULT_QUORUM } from './types'
import type { Proposal, Review, MergeRecord, QuorumConfig, VerseRef } from './types'
import { tallyReviews } from './reviews'

export class QuorumNotMetError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'QuorumNotMetError'
  }
}

export interface MergeResult {
  event: NostrEvent
  /** The verse update a corpus consumer should apply. */
  update: { ref: VerseRef; newText: string; proposalId: string }
}

/**
 * Merge a proposal. Enforces quorum: reviews must reach `minReviewers` and the
 * approval ratio threshold. A reviewer sharing the proposal author's pubkey is
 * dropped (no self-approval).
 */
export class NotAMaintainerError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotAMaintainerError'
  }
}

export interface MergeOptions {
  quorum?: QuorumConfig
  /** Maintainer council (hex pubkeys). When set, votes are council-scoped and the merger must be a maintainer. */
  maintainers?: readonly string[]
  /** The merger's own pubkey (hex) — required when `maintainers` is set, to gate the merge action. */
  mergerPubkey?: string
}

/** The unsigned merge event + the corpus update, before signing. */
export interface UnsignedMerge {
  unsigned: { created_at: number; kind: number; tags: string[][]; content: string }
  update: MergeResult['update']
}

/**
 * Validate quorum + council gating and build the unsigned merge event. Throws
 * QuorumNotMetError / NotAMaintainerError. The caller signs it — with a raw key
 * (`mergeProposal`) or a Signer / NIP-07 extension (`signMerge`).
 */
export function buildMerge(
  proposal: Proposal,
  reviews: Review[],
  createdAt: number,
  options: MergeOptions | QuorumConfig = DEFAULT_QUORUM,
): UnsignedMerge {
  const isBareQuorum = 'minReviewers' in options && 'approvalThreshold' in options
  const opts: MergeOptions = isBareQuorum ? { quorum: options } : options
  const quorum = opts.quorum ?? DEFAULT_QUORUM

  // When a council is set, the merger must be a maintainer (no rogue merges).
  if (opts.maintainers && opts.maintainers.length > 0) {
    const council = new Set(opts.maintainers.map((m) => m.toLowerCase()))
    const merger = opts.mergerPubkey?.toLowerCase()
    if (!merger || !council.has(merger)) {
      throw new NotAMaintainerError('Only a council maintainer may merge a governed translation')
    }
  }

  const eligible = reviews.filter(
    (r) => r.proposalId === proposal.id && r.reviewer !== proposal.author,
  )
  const tally = tallyReviews(eligible, quorum, opts.maintainers ? { maintainers: opts.maintainers } : {})
  if (!tally.meetsQuorum) {
    throw new QuorumNotMetError(
      `Quorum not met: ${String(tally.approvals)}/${String(tally.reviewers)} maintainer approvals ` +
        `(need ≥${String(quorum.minReviewers)} at ≥${String(quorum.approvalThreshold)})`,
    )
  }
  const tags: string[][] = [
    ['e', proposal.id],
    ['ark_action', 'merge'],
    ['ark_ref', proposal.ref.book, String(proposal.ref.chapter), String(proposal.ref.verse)],
    ['ark_translation', proposal.ref.translationId],
    ['ark_quorum', String(tally.approvals), String(tally.reviewers)],
  ]
  return {
    unsigned: { created_at: createdAt, kind: KIND_REVIEW, tags, content: '' },
    update: { ref: proposal.ref, newText: proposal.newText, proposalId: proposal.id },
  }
}

/** A NIP-07-shaped signer (also what a key-backed signer implements). */
export interface MergeSigner {
  signEvent(event: { created_at: number; kind: number; tags: string[][]; content: string }): NostrEvent | Promise<NostrEvent>
}

/** Build + sign a merge with a Signer (NIP-07 extension or key-backed). */
export async function signMerge(
  proposal: Proposal,
  reviews: Review[],
  signer: MergeSigner,
  createdAt: number,
  options: MergeOptions | QuorumConfig = DEFAULT_QUORUM,
): Promise<MergeResult> {
  const { unsigned, update } = buildMerge(proposal, reviews, createdAt, options)
  const event = await signer.signEvent(unsigned)
  return { event, update }
}

/** Build + sign a merge with a raw maintainer key (CLI / server / runner). */
export function mergeProposal(
  proposal: Proposal,
  reviews: Review[],
  maintainerPrivKey: string,
  createdAt: number,
  options: MergeOptions | QuorumConfig = DEFAULT_QUORUM,
): MergeResult {
  const { unsigned, update } = buildMerge(proposal, reviews, createdAt, options)
  return { event: signEvent(unsigned, maintainerPrivKey), update }
}

function tagValue(e: NostrEvent, name: string): string | undefined {
  return e.tags.find((t) => t[0] === name)?.[1]
}

/** Parse + validate a merge event. */
export function parseMerge(event: NostrEvent): MergeRecord {
  if (event.kind !== KIND_REVIEW) throw new Error(`Not a merge: kind ${String(event.kind)}`)
  if (tagValue(event, 'ark_action') !== 'merge') throw new Error('Event is not a merge action')
  if (!verifyEventSignature(event)) throw new Error('Merge signature does not verify')
  const proposalId = tagValue(event, 'e')
  const quorumTag = event.tags.find((t) => t[0] === 'ark_quorum')
  if (!proposalId || !quorumTag || quorumTag.length < 3) throw new Error('Merge missing tags')
  return {
    event,
    id: event.id,
    maintainer: event.pubkey,
    proposalId,
    approvals: Number(quorumTag[1]),
    reviewers: Number(quorumTag[2]),
  }
}
