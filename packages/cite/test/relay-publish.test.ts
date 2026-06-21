import { describe, it, expect } from 'vitest'
import { publishToRelay, publishToRelays } from '../src/relay-publish'
import type { SignedEvent, SocketLike } from '../src/types'

const event: SignedEvent = { id: 'x', pubkey: 'p', created_at: 1, kind: 30710, tags: [], content: '', sig: 's' }

function okFactory(sent: string[]) {
  return (_url: string): SocketLike => {
    const sock: SocketLike = { send: (d) => sent.push(d), close: () => undefined, onopen: null, onmessage: null, onerror: null }
    queueMicrotask(() => sock.onopen?.(undefined))
    return sock
  }
}

describe('publishToRelay(s)', () => {
  it('sends an EVENT frame and resolves true', async () => {
    const sent: string[] = []
    expect(await publishToRelay(event, 'wss://a', okFactory(sent))).toBe(true)
    expect(JSON.parse(sent[0]!)).toEqual(['EVENT', event])
  })

  it('resolves false when the socket factory throws', async () => {
    expect(
      await publishToRelay(event, 'wss://a', () => {
        throw new Error('no socket')
      }),
    ).toBe(false)
  })

  it('resolves false on socket error', async () => {
    const factory = (_url: string): SocketLike => {
      const sock: SocketLike = { send: () => undefined, close: () => undefined, onopen: null, onmessage: null, onerror: null }
      queueMicrotask(() => sock.onerror?.(new Error('boom')))
      return sock
    }
    expect(await publishToRelay(event, 'wss://a', factory)).toBe(false)
  })

  it('counts how many relays accepted the send', async () => {
    const sent: string[] = []
    expect(await publishToRelays(event, ['wss://a', 'wss://b', 'wss://c'], okFactory(sent))).toBe(3)
  })
})
