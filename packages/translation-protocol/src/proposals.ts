/**
 * Verse-revision proposals (kind:30702). A translator proposes new text for a
 * verse, with a rationale. The proposal is a signed Nostr event.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { signEvent, verifyEventSignature } from '@neoark/manifest'
import type { NostrEvent } from '@neoark/manifest'
import { KIND_PROPOSAL } from './types'
import type { Proposal, VerseRef } from './types'

export interface SubmitProposalInput {
  ref: VerseRef
  newText: string
  rationale: string
  /** Unix seconds; injected for deterministic ids. */
  createdAt: number
}

/** Build + sign a kind:30702 proposal event. */
export function submitProposal(input: SubmitProposalInput, privKey: string): NostrEvent {
  const { ref, newText, rationale, createdAt } = input
  const tags: string[][] = [
    ['d', `ark-prop:${ref.translationId}:${ref.book}:${String(ref.chapter)}:${String(ref.verse)}:${String(createdAt)}`],
    ['ark_translation', ref.translationId],
    ['ark_ref', ref.book, String(ref.chapter), String(ref.verse)],
    ['ark_rationale', rationale],
  ]
  return signEvent({ created_at: createdAt, kind: KIND_PROPOSAL, tags, content: newText }, privKey)
}

function tagValue(e: NostrEvent, name: string): string | undefined {
  return e.tags.find((t) => t[0] === name)?.[1]
}

/** Parse + validate a kind:30702 proposal event. Throws if malformed. */
export function parseProposal(event: NostrEvent): Proposal {
  if (event.kind !== KIND_PROPOSAL) throw new Error(`Not a proposal: kind ${String(event.kind)}`)
  if (!verifyEventSignature(event)) throw new Error('Proposal signature does not verify')
  const translationId = tagValue(event, 'ark_translation')
  const refTag = event.tags.find((t) => t[0] === 'ark_ref')
  const rationale = tagValue(event, 'ark_rationale')
  const book = refTag?.[1]
  const chapter = refTag?.[2]
  const verse = refTag?.[3]
  if (!translationId || book === undefined || chapter === undefined || verse === undefined || rationale === undefined) {
    throw new Error('Proposal missing required tags')
  }
  return {
    event,
    id: event.id,
    author: event.pubkey,
    ref: { translationId, book, chapter: Number(chapter), verse: Number(verse) },
    newText: event.content,
    rationale,
  }
}
