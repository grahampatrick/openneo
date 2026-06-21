/**
 * A real Nostr relay connection over a WebSocket. The socket is created by an
 * injected factory (browser `WebSocket`, node `ws`, or a fake in tests), so this
 * module never imports a transport and never hits the network on its own.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import type { NostrEvent, NostrFilter, PublishAck, RelayLike } from './types'

/** Minimal cross-platform WebSocket surface (browser WebSocket & `ws`). */
export interface WebSocketLike {
  send(data: string): void
  close(): void
  onopen: ((ev: unknown) => void) | null
  onmessage: ((ev: { data: unknown }) => void) | null
  onerror: ((ev: unknown) => void) | null
  onclose: ((ev: unknown) => void) | null
}

export type WebSocketFactory = (url: string) => WebSocketLike

export interface WebSocketRelayOptions {
  /** ms to wait for a publish OK or a query EOSE before giving up. Default 10s. */
  timeoutMs?: number
  /** Subscription id generator (injected for deterministic tests). */
  nextSubId?: () => string
}

interface Subscription {
  events: NostrEvent[]
  resolve: (events: NostrEvent[]) => void
}

export class WebSocketRelay implements RelayLike {
  readonly url: string
  private readonly factory: WebSocketFactory
  private readonly timeoutMs: number
  private readonly nextSubId: () => string
  private ws: WebSocketLike | null = null
  private opening: Promise<WebSocketLike> | null = null
  private subCounter = 0
  private readonly subs = new Map<string, Subscription>()
  private readonly okWaiters = new Map<string, (ack: PublishAck) => void>()

  constructor(url: string, factory: WebSocketFactory, opts: WebSocketRelayOptions = {}) {
    this.url = url
    this.factory = factory
    this.timeoutMs = opts.timeoutMs ?? 10_000
    this.nextSubId = opts.nextSubId ?? (() => `ark-${String(++this.subCounter)}`)
  }

  private connect(): Promise<WebSocketLike> {
    if (this.ws) return Promise.resolve(this.ws)
    if (this.opening) return this.opening
    this.opening = new Promise<WebSocketLike>((resolve, reject) => {
      const ws = this.factory(this.url)
      ws.onopen = () => {
        this.ws = ws
        resolve(ws)
      }
      ws.onerror = (e) => {
        reject(e instanceof Error ? e : new Error(`relay ${this.url} socket error`))
      }
      ws.onmessage = (ev) => {
        this.handleMessage(ev.data)
      }
    })
    return this.opening
  }

  private handleMessage(data: unknown): void {
    if (typeof data !== 'string') return
    let msg: unknown
    try {
      msg = JSON.parse(data)
    } catch {
      return
    }
    if (!Array.isArray(msg)) return
    const [type] = msg as [string, ...unknown[]]
    if (type === 'EVENT') {
      const sub = this.subs.get(msg[1] as string)
      if (sub) sub.events.push(msg[2] as NostrEvent)
    } else if (type === 'EOSE') {
      const subId = msg[1] as string
      const sub = this.subs.get(subId)
      if (sub) {
        this.subs.delete(subId)
        sub.resolve(sub.events)
      }
    } else if (type === 'OK') {
      const id = msg[1] as string
      const waiter = this.okWaiters.get(id)
      if (waiter) {
        this.okWaiters.delete(id)
        const message = msg[3] as string | undefined
        waiter({ relay: this.url, ok: Boolean(msg[2]), ...(message !== undefined ? { message } : {}) })
      }
    }
  }

  async publish(event: NostrEvent): Promise<PublishAck> {
    const ws = await this.connect()
    return new Promise<PublishAck>((resolve) => {
      const timer = setTimeout(() => {
        this.okWaiters.delete(event.id)
        resolve({ relay: this.url, ok: false, message: 'timeout' })
      }, this.timeoutMs)
      this.okWaiters.set(event.id, (ack) => {
        clearTimeout(timer)
        resolve(ack)
      })
      ws.send(JSON.stringify(['EVENT', event]))
    })
  }

  async query(filter: NostrFilter): Promise<NostrEvent[]> {
    const ws = await this.connect()
    const subId = this.nextSubId()
    return new Promise<NostrEvent[]>((resolve) => {
      const timer = setTimeout(() => {
        const sub = this.subs.get(subId)
        this.subs.delete(subId)
        ws.send(JSON.stringify(['CLOSE', subId]))
        resolve(sub ? sub.events : [])
      }, this.timeoutMs)
      this.subs.set(subId, {
        events: [],
        resolve: (events) => {
          clearTimeout(timer)
          ws.send(JSON.stringify(['CLOSE', subId]))
          resolve(events)
        },
      })
      ws.send(JSON.stringify(['REQ', subId, filter]))
    })
  }

  close(): void {
    this.ws?.close()
    this.ws = null
    this.opening = null
  }
}
