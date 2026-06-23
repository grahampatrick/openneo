/**
 * A lightweight reader identity for signing community notes. A Nostr key is
 * generated in the browser on first use and stored locally — no account, no
 * email. (Reading needs no identity; only writing a note does.)
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { getPublicKey, signEvent } from '@neoark/manifest'
import type { NostrEvent } from '@neoark/manifest'

const STORAGE_KEY = 'neoos.reader.seckey'

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** A fresh, valid secp256k1 secret key (hex). */
export function generateSeckey(): string {
  for (;;) {
    const b = new Uint8Array(32)
    crypto.getRandomValues(b)
    const hex = toHex(b)
    try {
      getPublicKey(hex) // rejects out-of-range keys
      return hex
    } catch {
      /* retry */
    }
  }
}

export function loadSeckey(): string | null {
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem(STORAGE_KEY)
}

/** Load the stored key, or generate + persist one. */
export function ensureSeckey(): string {
  let hex = loadSeckey()
  if (!hex) {
    hex = generateSeckey()
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, hex)
  }
  return hex
}

/** The reader's public key (hex), or null if no identity yet. */
export function pubkeyHex(): string | null {
  const sk = loadSeckey()
  return sk ? getPublicKey(sk) : null
}

export function signWith(seckey: string, unsigned: { kind: number; created_at: number; tags: string[][]; content: string }): NostrEvent {
  return signEvent(unsigned, seckey)
}
