import { describe, it, expect } from 'vitest'
import { MockRelay, matchesFilter } from '../src/mock-relay'
import { USE_PROOF_KIND } from '@neoark/manifest'
import { useProof } from './helpers'

describe('MockRelay', () => {
  it('stores valid events and queries them by kind', async () => {
    const relay = new MockRelay()
    const ack = await relay.publish(useProof({ book: 'John', chapter: 3, verseStart: 16, verseEnd: 21 }))
    expect(ack.ok).toBe(true)
    expect(relay.size).toBe(1)
    expect(await relay.query({ kinds: [USE_PROOF_KIND] })).toHaveLength(1)
    expect(await relay.query({ kinds: [1] })).toHaveLength(0)
  })

  it('rejects an event with a bad signature', async () => {
    const relay = new MockRelay()
    const ev = { ...useProof({ book: 'John', chapter: 3, verseStart: 1, verseEnd: 1 }), content: 'tampered' }
    const ack = await relay.publish(ev)
    expect(ack.ok).toBe(false)
    expect(relay.size).toBe(0)
  })

  it('honors since/until/limit and returns newest first', async () => {
    const relay = new MockRelay()
    await relay.publish(useProof({ book: 'John', chapter: 1, verseStart: 1, verseEnd: 1 }, 100))
    await relay.publish(useProof({ book: 'John', chapter: 2, verseStart: 1, verseEnd: 1 }, 200))
    await relay.publish(useProof({ book: 'John', chapter: 3, verseStart: 1, verseEnd: 1 }, 300))
    expect(await relay.query({ since: 150, until: 250 })).toHaveLength(1)
    const limited = await relay.query({ limit: 2 })
    expect(limited).toHaveLength(2)
    expect(limited[0]!.created_at).toBe(300) // newest first
  })

  it('does nothing once closed', async () => {
    const relay = new MockRelay()
    relay.close()
    expect((await relay.publish(useProof({ book: 'John', chapter: 3, verseStart: 1, verseEnd: 1 }))).ok).toBe(false)
    expect(await relay.query({})).toHaveLength(0)
  })

  it('can disable signature verification', async () => {
    const relay = new MockRelay({ verify: false })
    const ev = { ...useProof({ book: 'John', chapter: 3, verseStart: 1, verseEnd: 1 }), content: 'tampered' }
    expect((await relay.publish(ev)).ok).toBe(true)
  })
})

describe('matchesFilter', () => {
  const ev = useProof({ book: 'John', chapter: 3, verseStart: 16, verseEnd: 21 }, 500)

  it('matches ids, authors, and #tag filters', () => {
    expect(matchesFilter(ev, { ids: [ev.id] })).toBe(true)
    expect(matchesFilter(ev, { ids: ['nope'] })).toBe(false)
    expect(matchesFilter(ev, { authors: [ev.pubkey] })).toBe(true)
    expect(matchesFilter(ev, { '#ark_translation': ['osv-en-2025'] })).toBe(true)
    expect(matchesFilter(ev, { '#ark_translation': ['other'] })).toBe(false)
  })
})
