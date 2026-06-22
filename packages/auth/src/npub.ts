/**
 * NIP-19 npub encoding/decoding (bech32 over a 32-byte x-only key).
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { bech32 } from '@scure/base'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'

const HEX32 = /^[0-9a-fA-F]{64}$/

/** 32-byte x-only public key (hex) → `npub1…`. */
export function hexToNpub(xonlyHex: string): string {
  if (!HEX32.test(xonlyHex)) throw new Error('npub: expected 32-byte hex x-only pubkey')
  return bech32.encode('npub', bech32.toWords(hexToBytes(xonlyHex.toLowerCase())), 1023)
}

/** `npub1…` → 32-byte x-only public key (hex). */
export function npubToHex(npub: string): string {
  const decoded = bech32.decode(npub as `${string}1${string}`, 1023)
  if (decoded.prefix !== 'npub') throw new Error(`npub: expected npub prefix, got ${decoded.prefix}`)
  const bytes = bech32.fromWords(decoded.words)
  if (bytes.length !== 32) throw new Error(`npub: decoded ${String(bytes.length)} bytes, expected 32`)
  return bytesToHex(Uint8Array.from(bytes))
}

/**
 * Reduce a compressed secp256k1 pubkey (33 bytes, 02/03 prefix — what an
 * LNURL-auth wallet returns) to its 32-byte x-only form, so a Lightning login
 * and a Nostr login produce the same npub for the same key.
 */
export function compressedToXonly(compressedHex: string): string {
  const h = compressedHex.toLowerCase()
  if (/^0[23][0-9a-f]{64}$/.test(h)) return h.slice(2)
  if (HEX32.test(h)) return h // already x-only
  throw new Error('npub: expected a compressed (33-byte) or x-only (32-byte) pubkey')
}
