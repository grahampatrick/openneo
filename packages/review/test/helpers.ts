import { keypairFromSeed, getPublicKey, signEvent } from '@neoark/manifest'
import { submitProposal } from '@neoark/translation-protocol'
import type { Signer } from '../src/types'
import type { NostrEvent } from '@neoark/manifest'

export const author = keypairFromSeed('a1'.repeat(32))
export const reviewers = ['b1', 'b2', 'b3', 'b4'].map((s) => keypairFromSeed(s.repeat(32)))
export const maintainer = keypairFromSeed('cc'.repeat(32))

export function keySigner(secHex: string): Signer {
  return { getPublicKey: () => getPublicKey(secHex), signEvent: (e) => signEvent(e, secHex) }
}

export function proposalEvent(verse = 6, createdAt = 100): NostrEvent {
  return submitProposal(
    { ref: { translationId: 'neoos-en-2026', book: 'GEN', chapter: 1, verse }, newText: 'a firmament', rationale: 'Hebrew raqia', createdAt },
    author.seckey,
  )
}
