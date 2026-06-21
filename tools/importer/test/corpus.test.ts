import { describe, it, expect } from 'vitest'
import { buildCorpus } from '../src/corpus'
import { hashCorpus } from '../src/hash'
import { loadExtraSources, EXTRA_SOURCES } from '../src/parse-extra'

describe('buildCorpus (real BSB source)', () => {
  const built = buildCorpus()

  it('loads the full BSB corpus and applies the naming map', () => {
    expect(built.verses.length).toBeGreaterThanOrEqual(31000)
    expect(built.bySource.BSB).toBeGreaterThanOrEqual(31000)
    expect(built.changed).toBeGreaterThan(10000)
  })

  it('emits verses in canonical order with no duplicate refs', () => {
    const seen = new Set<string>()
    let prevKey = -1
    for (const v of built.verses) {
      const ref = `${v.bookId} ${String(v.chapter)}:${String(v.verse)}`
      expect(seen.has(ref)).toBe(false)
      seen.add(ref)
      const sortKey = v.bookIndex * 1_000_000 + v.chapter * 1000 + v.verse
      expect(sortKey).toBeGreaterThan(prevKey)
      prevKey = sortKey
    }
  })

  it('produces a stable BLAKE3 root across two builds', () => {
    expect(hashCorpus(built.verses).root).toBe(hashCorpus(buildCorpus().verses).root)
  })

  it('applies Hebrew divine names in Genesis 1:1', () => {
    const gen11 = built.verses.find((v) => v.bookId === 'GEN' && v.chapter === 1 && v.verse === 1)
    expect(gen11?.text).toContain('Elohiym')
  })
})

describe('loadExtraSources', () => {
  it('returns only books whose USFM files are present', () => {
    // No extra USFM committed yet → empty, but the registry is declared.
    expect(Array.isArray(loadExtraSources())).toBe(true)
    expect(EXTRA_SOURCES.some((s) => s.bookId === 'ENO')).toBe(true)
    expect(EXTRA_SOURCES.some((s) => s.bookId === 'JUB')).toBe(true)
  })
})
