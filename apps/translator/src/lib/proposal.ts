/**
 * Build, sign, and publish verse-revision proposals (kind:30702). The portal
 * builds the unsigned event and signs it via the injected Signer (NIP-07 in the
 * browser), then publishes to the relay pool. The result validates against
 * @neoark/translation-protocol's parseProposal — same schema as M5.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { KIND_PROPOSAL, parseProposal } from '@neoark/translation-protocol'
import type { Proposal } from '@neoark/translation-protocol'
import type { NostrEvent } from '@neoark/manifest'
import type { RelayPool } from '@neoark/relay'
import type { Signer, UnsignedEvent } from './signer'

export interface VerseRef {
  translationId: string
  book: string
  chapter: number
  verse: number
}

export interface ProposalInput {
  ref: VerseRef
  newText: string
  rationale: string
  createdAt: number
}

/** The unsigned kind:30702 event for a proposal (browser passes this to window.nostr). */
export function buildProposalEvent(input: ProposalInput): UnsignedEvent {
  const { ref, newText, rationale, createdAt } = input
  return {
    kind: KIND_PROPOSAL,
    created_at: createdAt,
    tags: [
      ['d', `ark-prop:${ref.translationId}:${ref.book}:${String(ref.chapter)}:${String(ref.verse)}:${String(createdAt)}`],
      ['ark_translation', ref.translationId],
      ['ark_ref', ref.book, String(ref.chapter), String(ref.verse)],
      ['ark_rationale', rationale],
    ],
    content: newText,
  }
}

export interface SubmitResult {
  event: NostrEvent
  proposal: Proposal
  relaysAccepted: number
}

/** Sign a proposal with the signer and publish it to the pool. */
export async function submitProposal(
  input: ProposalInput,
  signer: Signer,
  pool: RelayPool,
): Promise<SubmitResult> {
  if (!input.newText.trim()) throw new Error('Proposal text cannot be empty')
  if (!input.rationale.trim()) throw new Error('A rationale is required')
  const event = await signer.signEvent(buildProposalEvent(input))
  const proposal = parseProposal(event) // validates schema + signature (throws if bad)
  const acks = await pool.publish(event)
  return { event, proposal, relaysAccepted: acks.filter((a) => a.ok).length }
}

/** Fetch this author's proposals for a translation from the relays. */
export async function fetchMyProposals(
  pool: RelayPool,
  authorPubkey: string,
): Promise<Proposal[]> {
  const events = await pool.query({ kinds: [KIND_PROPOSAL], authors: [authorPubkey] })
  const out: Proposal[] = []
  for (const e of events) {
    try {
      out.push(parseProposal(e))
    } catch {
      /* skip malformed */
    }
  }
  return out.sort((a, b) => b.event.created_at - a.event.created_at)
}
