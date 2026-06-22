/**
 * Local Nostr identity — the one-click "create a key" path. Generates a
 * secp256k1 key in the browser, persists it (so you keep the same identity), and
 * exposes it as an nsec for backup/export. No extension, no wallet needed.
 *
 * The key lives in the browser's storage; signing happens client-side via the
 * same Signer interface the NIP-07 path uses. Users who want stronger custody
 * can export the nsec into a real wallet (Alby, etc.) or use NIP-07 instead.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { getPublicKey } from '@neoark/manifest'
import { hexToNpub } from '@neoark/auth'
import { bech32 } from '@scure/base'
import { keySigner, type Signer } from './signer'
import type { KeyValueStore } from './auth-client'

const SECKEY = 'neoark.translator.seckey'
const HEX32 = /^[0-9a-f]{64}$/i

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

/** Generate a fresh, valid 32-byte secp256k1 secret key (hex). */
export function generateSeckey(): string {
  for (;;) {
    const b = new Uint8Array(32)
    crypto.getRandomValues(b)
    const hex = toHex(b)
    try {
      getPublicKey(hex) // rejects the astronomically-unlikely invalid value
      return hex
    } catch {
      /* regenerate */
    }
  }
}

/** Encode a secret key (hex) as an `nsec1…` for display/backup. */
export function nsecEncode(hex: string): string {
  return bech32.encode('nsec', bech32.toWords(fromHex(hex)), 1023)
}

/** Decode an `nsec1…` to a secret key (hex). Throws on anything else. */
export function nsecDecode(nsec: string): string {
  const trimmed = nsec.trim()
  const decoded = bech32.decode(trimmed as `nsec1${string}`, 1023)
  if (decoded.prefix !== 'nsec') throw new Error('That is not an nsec key.')
  const bytes = bech32.fromWords(decoded.words)
  if (bytes.length !== 32) throw new Error('nsec key is the wrong length.')
  const hex = toHex(Uint8Array.from(bytes))
  getPublicKey(hex) // validate it is a usable key
  return hex
}

export function loadLocalSeckey(store: KeyValueStore): string | null {
  const h = store.get(SECKEY)
  return h && HEX32.test(h) ? h.toLowerCase() : null
}
export function saveLocalSeckey(store: KeyValueStore, hex: string): void {
  store.set(SECKEY, hex)
}
export function clearLocalSeckey(store: KeyValueStore): void {
  store.remove(SECKEY)
}

/** The npub for a secret key (hex). */
export function npubFor(hex: string): string {
  return hexToNpub(getPublicKey(hex))
}

/** A signer backed by a secret key (hex) — feeds the same login flow as NIP-07. */
export function signerFor(hex: string): Signer {
  return keySigner(hex)
}
