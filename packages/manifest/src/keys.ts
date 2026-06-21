/**
 * Key helpers for BIP-340 / Nostr secp256k1 keys.
 *
 * BIP-340 uses 32-byte x-only public keys. We accept either raw 64-char hex or
 * NIP-19 bech32 (`npub…` / `nsec…`) and normalize to hex for crypto operations.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { schnorr } from '@noble/curves/secp256k1'
import { bech32 } from '@scure/base'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'

const HEX32 = /^[0-9a-fA-F]{64}$/

/** Decode a NIP-19 bech32 key (npub/nsec) to 32-byte hex. */
export function decodeBech32Key(value: string, expectedHrp?: 'npub' | 'nsec'): string {
  const decoded = bech32.decode(value as `${string}1${string}`, 1023)
  if (expectedHrp && decoded.prefix !== expectedHrp) {
    throw new Error(`Expected ${expectedHrp} key, got ${decoded.prefix}`)
  }
  const bytes = bech32.fromWords(decoded.words)
  if (bytes.length !== 32) throw new Error(`Bech32 key is ${String(bytes.length)} bytes, expected 32`)
  return bytesToHex(Uint8Array.from(bytes))
}

/** Normalize a public key (hex or npub) to 32-byte x-only hex. */
export function normalizePubkey(pubkey: string): string {
  if (HEX32.test(pubkey)) return pubkey.toLowerCase()
  if (pubkey.startsWith('npub1')) return decodeBech32Key(pubkey, 'npub')
  throw new Error('Public key must be 64-char hex or an npub')
}

/** Normalize a secret key (hex or nsec) to 32-byte hex. */
export function normalizeSeckey(seckey: string): string {
  if (HEX32.test(seckey)) return seckey.toLowerCase()
  if (seckey.startsWith('nsec1')) return decodeBech32Key(seckey, 'nsec')
  throw new Error('Secret key must be 64-char hex or an nsec')
}

/** x-only public key (hex) for a secret key (hex or nsec). */
export function getPublicKey(seckey: string): string {
  return bytesToHex(schnorr.getPublicKey(hexToBytes(normalizeSeckey(seckey))))
}

/**
 * Deterministically derive a keypair from a 32-byte seed (hex). Useful for
 * reproducible fixtures and demos. NOT for production secrets.
 */
export function keypairFromSeed(seedHex: string): { seckey: string; pubkey: string } {
  if (!HEX32.test(seedHex)) throw new Error('Seed must be 32-byte hex')
  const seckey = seedHex.toLowerCase()
  return { seckey, pubkey: getPublicKey(seckey) }
}
