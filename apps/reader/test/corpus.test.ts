import { describe, it, expect } from 'vitest'
import { Corpus, parseVersesJsonl, type Verse, type BookMeta } from '../src/lib/corpus'
import { parseReference, formatReference } from '../src/lib/reference'

const BOOKS: BookMeta[] = [
  { index: 1, id: 'GEN', english: 'Genesis', hebrew: "Bere'shiyth" },
  { index: 6, id: 'JHN', english: 'John', hebrew: 'Yahuchanon' },
]
const VERSES: Verse[] = [
  { bookId: 'GEN', chapter: 1, verse: 1, text: 'In the beginning Elohiym created the heavens.' },
  { bookId: 'GEN', chapter: 1, verse: 6, text: 'Let there be a firmament between the waters.' },
  { bookId: 'GEN', chapter: 2, verse: 1, text: 'Thus the heavens were completed.' },
  { bookId: 'JHN', chapter: 3, verse: 16, text: 'For Elohiym so loved the world.' },
]

describe('Corpus', () => {
  const c = new Corpus(VERSES, BOOKS)

  it('indexes chapters and resolves names', () => {
    expect(c.chapter('GEN', 1)).toHaveLength(2)
    expect(c.chapters('GEN')).toEqual([1, 2])
    expect(c.resolveBook("bere'shiyth")).toBe('GEN')
    expect(c.loadedBooks().map((b) => b.id)).toEqual(['GEN', 'JHN'])
  })

  it('searches verse text offline', () => {
    expect(c.search('firmament').map((v) => v.verse)).toEqual([6])
    expect(c.search('elohiym')).toHaveLength(2)
    expect(c.search('')).toEqual([])
    expect(c.search('nope')).toEqual([])
  })

  it('respects the search limit', () => {
    expect(c.search('e', 1)).toHaveLength(1)
  })
})

describe('parseVersesJsonl', () => {
  it('parses kind:30700 events, skipping malformed lines', () => {
    const jsonl = [
      JSON.stringify({ content: 'hi', tags: [['ref', 'GEN', '1', '1']] }),
      '',
      JSON.stringify({ content: 'x', tags: [['d', 'no-ref']] }),
    ].join('\n')
    expect(parseVersesJsonl(jsonl)).toEqual([{ bookId: 'GEN', chapter: 1, verse: 1, text: 'hi' }])
  })
})

describe('reference', () => {
  const c = new Corpus(VERSES, BOOKS)
  it('parses and formats references', () => {
    expect(parseReference('GEN 1:6', c)).toEqual({ bookId: 'GEN', chapter: 1, verseStart: 6, verseEnd: 6 })
    expect(parseReference("Bere'shiyth 1", c)).toEqual({ bookId: 'GEN', chapter: 1 })
    expect(formatReference({ bookId: 'GEN', chapter: 1, verseStart: 6 }, c)).toBe("Bere'shiyth 1:6")
  })
  it('returns null on bad input', () => {
    expect(parseReference('junk', c)).toBeNull()
    expect(parseReference('Nope 1', c)).toBeNull()
  })
})
