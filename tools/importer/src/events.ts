/**
 * Build and sign ARK events (Nostr NIP-01 envelope).
 *
 *  - kind:30700 — verse. content = final verse text. Carries the blake3 content
 *    hash (`h` tag), canonical ref, language, source, and a NIP-33 `d` tag.
 *  - kind:30701 — translation manifest. content = JSON metadata + value manifest.
 *
 * Event id is the NIP-01 sha256 over [0,pubkey,created_at,kind,tags,content].
 * Signatures are BIP-340 Schnorr with zero auxiliary randomness, making them
 * deterministic so the emitted files are byte-reproducible.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { computeEventId, signEvent as signEventShared, verifyEventSignature } from '@neoark/manifest'
import type { ArkEvent, Verse } from './types'
import {
  CREATED_AT,
  KIND_MANIFEST,
  KIND_VERSE,
  LANG,
  TRANSLATION_ID,
} from './config'
import type { NeoosKey } from './keys'

/** NIP-01 event id (re-exported from the shared crypto core). */
export const eventId = computeEventId

/**
 * Sign an event body with a NeoOS key (delegates to @neoark/manifest). Fields
 * are re-emitted in NIP-01 envelope order (id, pubkey, created_at, kind, tags,
 * content, sig) so the serialized corpus is byte-stable; the id/sig are
 * order-independent, so this is purely cosmetic.
 */
export function signEvent(
  body: { created_at: number; kind: number; tags: string[][]; content: string },
  key: NeoosKey,
): ArkEvent {
  const e = signEventShared(body, key.secHex)
  return {
    id: e.id,
    pubkey: e.pubkey,
    created_at: e.created_at,
    kind: e.kind,
    tags: e.tags,
    content: e.content,
    sig: e.sig,
  }
}

/** Build a signed kind:30700 verse event. */
export function buildVerseEvent(v: Verse, contentHash: string, key: NeoosKey): ArkEvent {
  const tags: string[][] = [
    ['d', `${TRANSLATION_ID}:${v.bookId}:${String(v.chapter)}:${String(v.verse)}`],
    ['ref', v.bookId, String(v.chapter), String(v.verse)],
    ['t', `translation:${TRANSLATION_ID}`],
    ['lang', LANG],
    ['h', contentHash],
    ['src', v.source],
  ]
  return signEvent({ created_at: CREATED_AT, kind: KIND_VERSE, tags, content: v.text }, key)
}

/** Build a signed kind:30701 translation-manifest event. */
export function buildManifestEvent(key: NeoosKey, root: string, content: string): ArkEvent {
  const tags: string[][] = [
    ['d', TRANSLATION_ID],
    ['name', 'NeoOS'],
    ['lang', LANG],
    ['root', `b3:${root}`],
    ['alt', `NeoOS translation manifest (${TRANSLATION_ID})`],
  ]
  return signEvent({ created_at: CREATED_AT, kind: KIND_MANIFEST, tags, content }, key)
}

/** Verify an event id + Schnorr signature (re-exported from the shared core). */
export const verifyEvent = verifyEventSignature
