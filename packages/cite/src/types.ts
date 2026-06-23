/**
 * @neoark/cite types. The core delegates signing to a NIP-07-shaped signer so
 * the embeddable bundle ships no crypto.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export interface UnsignedEvent {
  kind: number
  created_at: number
  tags: string[][]
  content: string
  pubkey?: string
}

export interface SignedEvent {
  id: string
  pubkey: string
  created_at: number
  kind: number
  tags: string[][]
  content: string
  sig: string
}

/** NIP-07-compatible signer (e.g. `window.nostr`, or `ephemeralSigner()`). */
export interface Signer {
  getPublicKey(): string | Promise<string>
  signEvent(event: UnsignedEvent): SignedEvent | Promise<SignedEvent>
}

/** Minimal WebSocket surface (browser `WebSocket` / `ws` / a fake). */
export interface SocketLike {
  send(data: string): void
  close(): void
  onopen: ((ev: unknown) => void) | null
  onmessage: ((ev: { data: unknown }) => void) | null
  onerror: ((ev: unknown) => void) | null
}
export type SocketFactory = (url: string) => SocketLike

export interface CiteOptions {
  /** Relay URLs to publish use-proofs to. */
  relays: string[]
  /** Signer; defaults to `window.nostr` if present. */
  signer?: Signer
  /** Free-form context tag, e.g. the host page URL or app name. */
  context?: string
  /** Source host shown in readers' "where is this verse used?" (e.g. the page hostname). */
  source?: string
  /** Accumulate proofs and emit one aggregated event per flush (privacy). */
  rollup?: boolean
  /** Clock injection (unix seconds). */
  now?: () => number
  /** Socket factory; defaults to global WebSocket. */
  socketFactory?: SocketFactory
  /** DOM root to scan; defaults to document. */
  doc?: Document
}

export const KIND_USE_PROOF = 30710
