/**
 * Nostr NIP-01 event id + BIP-340 signing/verification.
 *
 * The event id is sha256 over the canonical array
 * [0, pubkey, created_at, kind, tags, content]. The signature is BIP-340
 * Schnorr over that id, deterministic (zero aux randomness) for reproducibility.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { schnorr } from '@noble/curves/secp256k1'
import { sha256 } from '@noble/hashes/sha2'
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils'
import { getPublicKey, normalizeSeckey } from './keys'
import type { NostrEvent } from './types'

const ZERO_AUX = new Uint8Array(32)

export type UnsignedEvent = Omit<NostrEvent, 'id' | 'sig'>

export function computeEventId(e: UnsignedEvent): string {
  const serialized = JSON.stringify([0, e.pubkey, e.created_at, e.kind, e.tags, e.content])
  return bytesToHex(sha256(utf8ToBytes(serialized)))
}

/** Sign an event body, filling pubkey/id/sig. */
export function signEvent(
  body: Omit<UnsignedEvent, 'pubkey'> & { pubkey?: string },
  privKey: string,
): NostrEvent {
  const seckeyHex = normalizeSeckey(privKey)
  const unsigned: UnsignedEvent = { ...body, pubkey: getPublicKey(seckeyHex) }
  const id = computeEventId(unsigned)
  const sig = bytesToHex(schnorr.sign(hexToBytes(id), hexToBytes(seckeyHex), ZERO_AUX))
  return { id, ...unsigned, sig }
}

/** Verify an event's id integrity and Schnorr signature. */
export function verifyEventSignature(e: NostrEvent): boolean {
  const { id, sig, ...unsigned } = e
  if (computeEventId(unsigned) !== id) return false
  try {
    return schnorr.verify(hexToBytes(sig), hexToBytes(id), hexToBytes(e.pubkey))
  } catch {
    return false
  }
}
