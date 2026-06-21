import { describe, it, expect } from 'vitest'
import { WebSocketRelay } from '../src/websocket-relay'
import { MockRelay } from '../src/mock-relay'
import type { WebSocketLike } from '../src/websocket-relay'
import { useProof } from './helpers'

/**
 * A fake WebSocket that speaks the Nostr protocol, backed by a MockRelay store.
 * Auto-opens, answers EVENT with OK, and REQ with the matching EVENTs + EOSE.
 */
class FakeSocket implements WebSocketLike {
  onopen: ((ev: unknown) => void) | null = null
  onmessage: ((ev: { data: unknown }) => void) | null = null
  onerror: ((ev: unknown) => void) | null = null
  onclose: ((ev: unknown) => void) | null = null
  constructor(
    private readonly store: MockRelay,
    private readonly opts: { silent?: boolean } = {},
  ) {
    queueMicrotask(() => this.onopen?.(undefined))
  }
  send(data: string): void {
    if (this.opts.silent) return
    const msg = JSON.parse(data) as unknown[]
    const [type] = msg as [string]
    if (type === 'EVENT') {
      void this.store.publish(msg[1] as never).then((ack) => {
        this.emit(['OK', (msg[1] as { id: string }).id, ack.ok, ack.message ?? ''])
      })
    } else if (type === 'REQ') {
      const subId = msg[1] as string
      void this.store.query(msg[2] as never).then((events) => {
        for (const ev of events) this.emit(['EVENT', subId, ev])
        this.emit(['EOSE', subId])
      })
    }
  }
  close(): void {
    /* noop */
  }
  private emit(arr: unknown[]): void {
    this.onmessage?.({ data: JSON.stringify(arr) })
  }
}

describe('WebSocketRelay', () => {
  it('publishes and receives an OK ack', async () => {
    const store = new MockRelay()
    const relay = new WebSocketRelay('wss://test', () => new FakeSocket(store))
    const ack = await relay.publish(useProof({ book: 'John', chapter: 3, verseStart: 16, verseEnd: 21 }))
    expect(ack.ok).toBe(true)
    expect(store.size).toBe(1)
  })

  it('queries via REQ → EVENT → EOSE', async () => {
    const store = new MockRelay()
    const relay = new WebSocketRelay('wss://test', () => new FakeSocket(store), {
      nextSubId: () => 'sub1',
    })
    await relay.publish(useProof({ book: 'John', chapter: 3, verseStart: 1, verseEnd: 1 }))
    await relay.publish(useProof({ book: 'Mark', chapter: 1, verseStart: 1, verseEnd: 1 }))
    const events = await relay.query({ kinds: [30078] })
    expect(events).toHaveLength(2)
  })

  it('reuses a single connection across calls', async () => {
    const store = new MockRelay()
    let created = 0
    const relay = new WebSocketRelay('wss://test', () => {
      created++
      return new FakeSocket(store)
    })
    await relay.publish(useProof({ book: 'John', chapter: 3, verseStart: 1, verseEnd: 1 }))
    await relay.query({ kinds: [30078] })
    expect(created).toBe(1)
  })

  it('resolves a publish to ok:false on timeout', async () => {
    const store = new MockRelay()
    const relay = new WebSocketRelay('wss://test', () => new FakeSocket(store, { silent: true }), {
      timeoutMs: 20,
    })
    const ack = await relay.publish(useProof({ book: 'John', chapter: 3, verseStart: 1, verseEnd: 1 }))
    expect(ack.ok).toBe(false)
    expect(ack.message).toBe('timeout')
  })

  it('returns collected events on query timeout', async () => {
    const store = new MockRelay()
    const relay = new WebSocketRelay('wss://test', () => new FakeSocket(store, { silent: true }), {
      timeoutMs: 20,
    })
    expect(await relay.query({ kinds: [30078] })).toEqual([])
  })
})
