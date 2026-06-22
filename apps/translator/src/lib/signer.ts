/**
 * Signer abstraction. In the browser this is the NIP-07 extension
 * (`window.nostr`); in tests/CLI it's a key-backed signer. Both produce signed
 * Nostr events, so the portal never holds a private key in the browser.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { signEvent as signWithKey, getPublicKey } from '@neoark/manifest'
import type { NostrEvent } from '@neoark/manifest'

export interface UnsignedEvent {
  kind: number
  created_at: number
  tags: string[][]
  content: string
}

/** NIP-07 shape (window.nostr) — also what our key-backed signer implements. */
export interface Signer {
  getPublicKey(): string | Promise<string>
  signEvent(event: UnsignedEvent): NostrEvent | Promise<NostrEvent>
}

/** A signer backed by a raw secret key (tests, CLI). */
export function keySigner(secHex: string): Signer {
  return {
    getPublicKey: () => getPublicKey(secHex),
    signEvent: (event) => signWithKey(event, secHex),
  }
}

/** The injected NIP-07 extension, if present. */
export function browserSigner(): Signer | null {
  const nostr = (globalThis as unknown as { nostr?: Signer }).nostr
  return nostr ?? null
}
