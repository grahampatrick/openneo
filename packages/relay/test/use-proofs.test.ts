import { describe, it, expect } from 'vitest'
import { RelayPool } from '../src/pool'
import { MockRelay } from '../src/mock-relay'
import { publishUseProof, queryUseProofs } from '../src/use-proofs'
import { verifyUseProof, signEvent } from '@neoark/manifest'
import { manifest, reader } from './helpers'

function pool(n = 2): RelayPool {
  return new RelayPool(Array.from({ length: n }, (_, i) => new MockRelay({ url: `mock://${String(i)}` })))
}

const pub = (p: RelayPool, passage: { book: string; chapter: number; verseStart: number; verseEnd: number }, createdAt?: number, trigger?: string, amount?: number) =>
  publishUseProof(
    { manifest, passage, trigger: trigger ?? '80pct_visible_30s', preimage: 'a1'.repeat(32), amount_sat: amount ?? 10, created_at: createdAt ?? 1717545600 },
    reader.seckey,
    p,
  )

describe('publishUseProof / queryUseProofs', () => {
  it('round-trips a use-proof and it verifies against the manifest', async () => {
    const p = pool()
    const { event, acks } = await pub(p, { book: 'John', chapter: 3, verseStart: 16, verseEnd: 21 })
    expect(acks.every((a) => a.ok)).toBe(true)
    const found = await queryUseProofs({ translationId: 'osv-en-2025' }, p)
    expect(found).toHaveLength(1)
    expect(found[0]!.event.id).toBe(event.id)
    expect(verifyUseProof(found[0]!.event, manifest).valid).toBe(true)
  })

  it('de-duplicates the same event seen on multiple relays', async () => {
    const p = pool(3)
    await pub(p, { book: 'John', chapter: 3, verseStart: 16, verseEnd: 21 })
    expect(await queryUseProofs({ translationId: 'osv-en-2025' }, p)).toHaveLength(1)
  })

  it('filters by passage (book, chapter, verse overlap)', async () => {
    const p = pool(1)
    await pub(p, { book: 'John', chapter: 3, verseStart: 16, verseEnd: 21 })
    await pub(p, { book: 'Romans', chapter: 8, verseStart: 28, verseEnd: 28 })
    expect(await queryUseProofs({ translationId: 'osv-en-2025', passage: { book: 'Romans' } }, p)).toHaveLength(1)
    expect(await queryUseProofs({ translationId: 'osv-en-2025', passage: { book: 'John', chapter: 3, verseStart: 18, verseEnd: 19 } }, p)).toHaveLength(1)
    expect(await queryUseProofs({ translationId: 'osv-en-2025', passage: { book: 'John', chapter: 3, verseStart: 99, verseEnd: 100 } }, p)).toHaveLength(0)
    expect(await queryUseProofs({ translationId: 'osv-en-2025', passage: { book: 'John', chapter: 4 } }, p)).toHaveLength(0)
  })

  it('filters by translation id', async () => {
    const p = pool(1)
    await pub(p, { book: 'John', chapter: 3, verseStart: 16, verseEnd: 21 })
    expect(await queryUseProofs({ translationId: 'web-en-2020' }, p)).toHaveLength(0)
  })

  it('honors a since/until time window', async () => {
    const p = pool(1)
    await pub(p, { book: 'John', chapter: 1, verseStart: 1, verseEnd: 1 }, 100)
    await pub(p, { book: 'John', chapter: 2, verseStart: 1, verseEnd: 1 }, 300)
    expect(await queryUseProofs({ translationId: 'osv-en-2025', since: 200 }, p)).toHaveLength(1)
  })

  it('drops non-use-proof events the query happens to return', async () => {
    const relay = new MockRelay()
    // A kind:30078 event that is not a valid use-proof (missing tags).
    const junk = signEvent({ created_at: 1, kind: 30078, tags: [['d', 'x']], content: '' }, reader.seckey)
    await relay.publish(junk)
    const p = new RelayPool([relay])
    await pub(p, { book: 'John', chapter: 3, verseStart: 16, verseEnd: 21 })
    expect(await queryUseProofs({ translationId: 'osv-en-2025' }, p)).toHaveLength(1)
  })
})
