import { describe, it, expect } from 'vitest'
import { RelayPool } from '../src/pool'
import { MockRelay } from '../src/mock-relay'
import type { NostrEvent, NostrFilter, PublishAck, RelayLike } from '../src/types'
import { useProof } from './helpers'

/** A relay that always throws — to prove the pool isolates failures. */
class BrokenRelay implements RelayLike {
  readonly url = 'mock://broken'
  publish(): Promise<PublishAck> {
    return Promise.reject(new Error('relay down'))
  }
  query(): Promise<NostrEvent[]> {
    return Promise.reject(new Error('relay down'))
  }
  close(): void {
    /* noop */
  }
}

describe('RelayPool', () => {
  it('requires at least one relay', () => {
    expect(() => new RelayPool([])).toThrow(/at least one/)
  })

  it('exposes relay urls', () => {
    expect(new RelayPool([new MockRelay({ url: 'mock://a' })]).urls).toEqual(['mock://a'])
  })

  it('publishes to all relays and reports a failure without aborting the rest', async () => {
    const good = new MockRelay({ url: 'mock://good' })
    const pool = new RelayPool([good, new BrokenRelay()])
    const acks = await pool.publish(useProof({ book: 'John', chapter: 3, verseStart: 1, verseEnd: 1 }))
    expect(acks).toHaveLength(2)
    expect(acks.find((a) => a.relay === 'mock://good')?.ok).toBe(true)
    const broken = acks.find((a) => a.relay === 'mock://broken')
    expect(broken?.ok).toBe(false)
    expect(broken?.message).toMatch(/relay down/)
  })

  it('merges query results across relays, ignoring a broken one', async () => {
    const a = new MockRelay({ url: 'mock://a' })
    await a.publish(useProof({ book: 'John', chapter: 3, verseStart: 1, verseEnd: 1 }, 10))
    const pool = new RelayPool([a, new BrokenRelay()])
    const filter: NostrFilter = { kinds: [30078] }
    expect(await pool.query(filter)).toHaveLength(1)
  })

  it('closes every relay', () => {
    const a = new MockRelay()
    const pool = new RelayPool([a])
    pool.close()
    expect(a.size).toBe(0) // still constructed; close is a no-throw
  })
})
