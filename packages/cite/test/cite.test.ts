import { describe, it, expect, beforeEach } from 'vitest'
import { NeoArkCite, parseRef } from '../src/cite'
import type { Signer, SignedEvent, SocketLike, UnsignedEvent } from '../src/types'

/** A signer that fills id/pubkey/sig deterministically (no real crypto). */
function fakeSigner(pubkey = 'f'.repeat(64)): Signer {
  return {
    getPublicKey: () => pubkey,
    signEvent: (e: UnsignedEvent): SignedEvent => ({ ...e, pubkey, id: 'id-' + String(e.tags.length), sig: 'sig' }),
  }
}

/** A socket factory recording every published frame. */
function recordingFactory(sent: unknown[][]) {
  return (_url: string): SocketLike => {
    const sock: SocketLike = {
      send: (data: string) => sent.push(JSON.parse(data) as unknown[]),
      close: () => undefined,
      onopen: null,
      onmessage: null,
      onerror: null,
    }
    queueMicrotask(() => sock.onopen?.(undefined))
    return sock
  }
}

describe('parseRef', () => {
  it('parses translation:book:ch:vs', () => {
    expect(parseRef('neoos-en-2026:JHN:3:16')).toEqual({ raw: 'neoos-en-2026:JHN:3:16', translationId: 'neoos-en-2026' })
  })
  it('rejects junk', () => {
    expect(parseRef('justtext')).toBeNull()
    expect(parseRef('   ')).toBeNull()
  })
})

describe('NeoArkCite.init', () => {
  it('requires a relay', () => {
    expect(() => NeoArkCite.init({ relays: [], signer: fakeSigner() })).toThrow(/at least one relay/)
  })
  it('throws when no signer and no window.nostr', () => {
    // jsdom has no window.nostr by default.
    expect(() => NeoArkCite.init({ relays: ['wss://x'] })).toThrow(/no signer/)
  })
})

describe('scan', () => {
  let sent: unknown[][]
  beforeEach(() => {
    sent = []
    document.body.innerHTML = `
      <p data-neoos-ref="neoos-en-2026:JHN:3:16">For Elohiym so loved…</p>
      <p data-neoos-ref="neoos-en-2026:GEN:1:1">In the beginning…</p>
      <p data-neoos-ref="neoos-en-2026:JHN:3:16">duplicate</p>
      <p>no ref here</p>`
  })

  it('publishes one use-proof per unique ref', async () => {
    const cite = NeoArkCite.init({ relays: ['wss://a', 'wss://b'], signer: fakeSigner(), socketFactory: recordingFactory(sent), now: () => 1_717_545_600 })
    const events = await cite.scan()
    expect(events).toHaveLength(2) // deduped
    expect(events[0]!.kind).toBe(30710)
    expect(events[0]!.tags).toContainEqual(['translation', 'neoos-en-2026'])
    expect(events[0]!.tags.some((t) => t[0] === 'verse')).toBe(true)
    // 2 events × 2 relays = 4 EVENT frames
    expect(sent.filter((m) => m[0] === 'EVENT')).toHaveLength(4)
  })

  it('does not re-publish a ref already seen', async () => {
    const cite = NeoArkCite.init({ relays: ['wss://a'], signer: fakeSigner(), socketFactory: recordingFactory(sent), now: () => 1 })
    expect(await cite.scan()).toHaveLength(2)
    expect(await cite.scan()).toHaveLength(0)
  })

  it('rollup mode emits a single aggregated event', async () => {
    const cite = NeoArkCite.init({ relays: ['wss://a'], signer: fakeSigner(), socketFactory: recordingFactory(sent), rollup: true, now: () => 1_717_545_600 })
    const events = await cite.scan()
    expect(events).toHaveLength(1)
    expect(events[0]!.tags.filter((t) => t[0] === 'verse')).toHaveLength(2)
    expect(events[0]!.tags[0]).toEqual(['d', `neoos-use-rollup:${String(Math.floor(1_717_545_600 / 86_400))}`])
  })

  it('includes a context tag and consumer pubkey', async () => {
    const cite = NeoArkCite.init({ relays: ['wss://a'], signer: fakeSigner('ab'.repeat(32)), socketFactory: recordingFactory(sent), context: 'https://sermon.example', now: () => 1 })
    const [event] = await cite.scan()
    expect(event!.tags).toContainEqual(['context', 'https://sermon.example'])
    expect(event!.tags).toContainEqual(['consumer', 'ab'.repeat(32)])
  })

  it('collectRefs returns unique refs without publishing', () => {
    const cite = NeoArkCite.init({ relays: ['wss://a'], signer: fakeSigner() })
    expect(cite.collectRefs().map((r) => r.raw)).toEqual(['neoos-en-2026:JHN:3:16', 'neoos-en-2026:GEN:1:1'])
  })

  it('returns nothing for a page with no refs', async () => {
    document.body.innerHTML = '<p>nothing</p>'
    const cite = NeoArkCite.init({ relays: ['wss://a'], signer: fakeSigner(), socketFactory: recordingFactory(sent) })
    expect(await cite.scan()).toEqual([])
  })
})
