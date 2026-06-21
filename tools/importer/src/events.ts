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
import { schnorr } from '@noble/curves/secp256k1'
import { sha256 } from '@noble/hashes/sha2'
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils'
import type { ArkEvent, Verse } from './types'
import {
  CREATED_AT,
  KIND_MANIFEST,
  KIND_VERSE,
  LANG,
  TRANSLATION_ID,
} from './config'
import type { NeoosKey } from './keys'

const ZERO_AUX = new Uint8Array(32)

interface UnsignedEvent {
  pubkey: string
  created_at: number
  kind: number
  tags: string[][]
  content: string
}

export function eventId(e: UnsignedEvent): string {
  const serialized = JSON.stringify([0, e.pubkey, e.created_at, e.kind, e.tags, e.content])
  return bytesToHex(sha256(utf8ToBytes(serialized)))
}

export function signEvent(unsigned: UnsignedEvent, key: NeoosKey): ArkEvent {
  const id = eventId(unsigned)
  const sig = bytesToHex(schnorr.sign(hexToBytes(id), key.sec, ZERO_AUX))
  return { id, ...unsigned, sig }
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
  return signEvent(
    { pubkey: key.pubkey, created_at: CREATED_AT, kind: KIND_VERSE, tags, content: v.text },
    key,
  )
}

/** Build a signed kind:30701 translation-manifest event. */
export function buildManifestEvent(
  key: NeoosKey,
  root: string,
  content: string,
): ArkEvent {
  const tags: string[][] = [
    ['d', TRANSLATION_ID],
    ['name', 'NeoOS'],
    ['lang', LANG],
    ['root', `b3:${root}`],
    ['alt', `NeoOS translation manifest (${TRANSLATION_ID})`],
  ]
  return signEvent(
    { pubkey: key.pubkey, created_at: CREATED_AT, kind: KIND_MANIFEST, tags, content },
    key,
  )
}

export function verifyEvent(e: ArkEvent): boolean {
  const { id, sig, ...unsigned } = e
  if (eventId(unsigned) !== id) return false
  return schnorr.verify(hexToBytes(sig), hexToBytes(id), hexToBytes(e.pubkey))
}
