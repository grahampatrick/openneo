/**
 * A relay pool for the browser — real public Nostr relays over the browser's
 * WebSocket. Proposals and reviews are published here as signed events; the
 * status/review views query the same pool.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { RelayPool, WebSocketRelay, DEFAULT_RELAYS } from '@neoark/relay'
import type { WebSocketFactory } from '@neoark/relay'

/** Wrap the browser's WebSocket as a factory (constructors can't be called bare). */
export function browserWebSocketFactory(): WebSocketFactory {
  return ((url: string) => new WebSocket(url)) as unknown as WebSocketFactory
}

/** Create a pool over the default public relays (or a custom list). */
export function createRelayPool(urls: readonly string[] = DEFAULT_RELAYS): RelayPool {
  const factory = browserWebSocketFactory()
  return new RelayPool(urls.map((u) => new WebSocketRelay(u, factory, { timeoutMs: 8000 })))
}

export { DEFAULT_RELAYS }
