/**
 * Minimal best-effort Nostr publish over a WebSocket. No crypto, no framing
 * beyond `["EVENT", event]` — kept tiny for the embeddable bundle.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import type { SignedEvent, SocketFactory } from './types'

function defaultFactory(url: string): ReturnType<SocketFactory> {
  const WS = (globalThis as unknown as { WebSocket: new (u: string) => ReturnType<SocketFactory> }).WebSocket
  return new WS(url)
}

/** Publish an event to one relay; resolves true once sent, false on error. */
export function publishToRelay(
  event: SignedEvent,
  url: string,
  factory: SocketFactory = defaultFactory,
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let done = false
    const finish = (ok: boolean): void => {
      if (done) return
      done = true
      resolve(ok)
    }
    try {
      const ws = factory(url)
      ws.onopen = () => {
        ws.send(JSON.stringify(['EVENT', event]))
        // Give the relay a tick to read, then close.
        setTimeout(() => {
          ws.close()
          finish(true)
        }, 0)
      }
      ws.onerror = () => {
        finish(false)
      }
    } catch {
      finish(false)
    }
  })
}

/** Publish to every relay; resolves the count that accepted the send. */
export async function publishToRelays(
  event: SignedEvent,
  relays: string[],
  factory?: SocketFactory,
): Promise<number> {
  const results = await Promise.all(relays.map((u) => publishToRelay(event, u, factory)))
  return results.filter(Boolean).length
}
