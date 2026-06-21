/**
 * @neoark/relay — Nostr distribution layer. Publish and query ARK use-proof
 * events (kind:30078) across a pool of relays.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
export { RelayPool } from './pool'
export { publishUseProof, queryUseProofs } from './use-proofs'
export type { PublishedUseProof } from './use-proofs'

export { buildUseProofFilter, matchesQuery } from './filter'

export { MockRelay, matchesFilter } from './mock-relay'
export type { MockRelayOptions } from './mock-relay'

export { WebSocketRelay } from './websocket-relay'
export type { WebSocketLike, WebSocketFactory, WebSocketRelayOptions } from './websocket-relay'

export { DEFAULT_RELAYS } from './types'
export type {
  NostrEvent,
  NostrFilter,
  PublishAck,
  RelayLike,
  PassageQuery,
  UseProofQuery,
} from './types'
