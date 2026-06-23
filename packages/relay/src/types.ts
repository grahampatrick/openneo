/**
 * Types for the Nostr distribution layer.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import type { NostrEvent } from '@neoark/manifest'

export type { NostrEvent }

/** Default public Nostr relays (used by the WebSocket pool; tests use mocks). */
export const DEFAULT_RELAYS = [
  // The decentralised public relay network is the substrate — publish to many,
  // pull from many, so a flaky or down relay never blocks (the pool takes
  // whatever resolves). `relay.openneo.org` is listed first only as an optional
  // future project relay; if absent it fails fast and is skipped.
  'wss://relay.openneo.org',
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.snort.social',
  'wss://relay.primal.net',
  'wss://nostr.wine',
] as const

/** A Nostr REQ filter (the subset we use). */
export interface NostrFilter {
  ids?: string[]
  authors?: string[]
  kinds?: number[]
  since?: number
  until?: number
  limit?: number
  /** Tag filters, e.g. `{ '#d': ['ark-up:…'] }`. */
  [tag: `#${string}`]: string[] | undefined
}

/** Result of publishing one event to one relay. */
export interface PublishAck {
  relay: string
  ok: boolean
  message?: string
}

/** A relay connection: publish an event, query a filter, close. */
export interface RelayLike {
  readonly url: string
  publish(event: NostrEvent): Promise<PublishAck>
  query(filter: NostrFilter): Promise<NostrEvent[]>
  close(): void
}

/** Passage selector for querying use-proofs (book required; rest optional). */
export interface PassageQuery {
  book: string
  chapter?: number
  verseStart?: number
  verseEnd?: number
}

/** High-level use-proof query. */
export interface UseProofQuery {
  translationId: string
  passage?: PassageQuery
  since?: number
  until?: number
  limit?: number
}
