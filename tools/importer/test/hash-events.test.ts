import { describe, it, expect } from 'vitest'
import { b3hex, verseHash, aggregate, hashCorpus, versePreimage } from '../src/hash'
import { buildVerseEvent, buildManifestEvent, eventId, verifyEvent } from '../src/events'
import { loadNeoosKey } from '../src/keys'
import { buildValueManifest, verifyValueManifest } from '../src/value-manifest'
import type { Verse } from '../src/types'

function v(bookId: string, index: number, chapter: number, verse: number, text: string): Verse {
  return { bookId, bookIndex: index, chapter, verse, text, original: text, source: 'BSB' }
}

const corpus: Verse[] = [
  v('GEN', 1, 1, 1, 'In the beginning Elohiym created the heavens and the earth.'),
  v('GEN', 1, 1, 2, 'Now the earth was formless and void.'),
  v('GEN', 1, 2, 1, 'Thus the heavens and the earth were completed.'),
  v('JHN', 63, 3, 16, 'For Elohiym so loved the world.'),
]

describe('hashing', () => {
  it('blake3 hex is 64 chars and deterministic', () => {
    expect(b3hex('abc')).toHaveLength(64)
    expect(b3hex('abc')).toBe(b3hex('abc'))
    expect(b3hex('abc')).not.toBe(b3hex('abd'))
  })

  it('verse preimage binds ref + text', () => {
    expect(versePreimage(corpus[0]!)).toBe(
      'GEN 1:1\nIn the beginning Elohiym created the heavens and the earth.',
    )
    expect(verseHash(corpus[0]!)).not.toBe(verseHash(corpus[1]!))
  })

  it('aggregate is order-sensitive', () => {
    expect(aggregate(['a', 'b'])).not.toBe(aggregate(['b', 'a']))
  })

  it('hashCorpus builds a stable root + per-book summaries', () => {
    const a = hashCorpus(corpus)
    const b = hashCorpus([...corpus].reverse())
    expect(a.root).toBe(b.root) // canonical ordering inside
    expect(a.verseCount).toBe(4)
    expect(a.books.map((x) => x.id)).toEqual(['GEN', 'JHN'])
    const gen = a.books.find((x) => x.id === 'GEN')!
    expect(gen.chapters).toBe(2)
    expect(gen.verses).toBe(3)
    expect(a.verseHashes.get('GEN 1:1')).toBe(verseHash(corpus[0]!))
  })

  it('changing one verse changes the root', () => {
    const mutated = corpus.map((x, i) => (i === 0 ? { ...x, text: x.text + '!' } : x))
    expect(hashCorpus(mutated).root).not.toBe(hashCorpus(corpus).root)
  })
})

describe('events', () => {
  const key = loadNeoosKey({})

  it('builds a signed, verifiable verse event with expected tags', () => {
    const h = verseHash(corpus[0]!)
    const e = buildVerseEvent(corpus[0]!, h, key)
    expect(e.kind).toBe(30700)
    expect(e.content).toBe(corpus[0]!.text)
    expect(e.tags).toContainEqual(['ref', 'GEN', '1', '1'])
    expect(e.tags).toContainEqual(['h', h])
    expect(eventId(e)).toBe(e.id)
    expect(verifyEvent(e)).toBe(true)
  })

  it('signatures are deterministic across builds', () => {
    const h = verseHash(corpus[0]!)
    expect(buildVerseEvent(corpus[0]!, h, key).sig).toBe(buildVerseEvent(corpus[0]!, h, key).sig)
  })

  it('detects tampering', () => {
    const e = buildVerseEvent(corpus[0]!, verseHash(corpus[0]!), key)
    expect(verifyEvent({ ...e, content: 'tampered' })).toBe(false)
  })

  it('builds a verifiable manifest event', () => {
    const e = buildManifestEvent(key, 'a'.repeat(64), JSON.stringify({ hello: 'world' }))
    expect(e.kind).toBe(30701)
    expect(e.tags).toContainEqual(['root', `b3:${'a'.repeat(64)}`])
    expect(verifyEvent(e)).toBe(true)
  })
})

describe('value manifest', () => {
  const key = loadNeoosKey({})
  it('builds and self-verifies an AVM-1 manifest', () => {
    const vm = buildValueManifest('f'.repeat(64), key)
    expect(vm.version).toBe('avm-1')
    expect(vm.translation_blake3).toBe(`b3:${'f'.repeat(64)}`)
    expect(vm.splits.reduce((s, x) => s + x.weight, 0)).toBe(100)
    expect(verifyValueManifest(vm)).toBe(true)
  })
  it('fails verification when tampered', () => {
    const vm = buildValueManifest('f'.repeat(64), key)
    expect(verifyValueManifest({ ...vm, translation_id: 'evil-xx-9999' })).toBe(false)
  })
})
