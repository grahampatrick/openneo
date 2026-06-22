import { describe, it, expect } from 'vitest'
import { Corpus, parseVersesJsonl, type Verse, type BookMeta } from '../src/lib/corpus'

const BOOKS: BookMeta[] = [
  { index: 1, id: 'GEN', english: 'Genesis', hebrew: "Bere'shiyth" },
  { index: 6, id: 'JHN', english: 'John', hebrew: 'Yahuchanon' },
]
const VERSES: Verse[] = [
  { bookId: 'GEN', chapter: 1, verse: 1, text: 'In the beginning…' },
  { bookId: 'GEN', chapter: 1, verse: 6, text: 'Let there be a firmament.' },
  { bookId: 'GEN', chapter: 2, verse: 1, text: 'Thus the heavens…' },
  { bookId: 'JHN', chapter: 3, verse: 16, text: 'For Elohiym so loved…' },
]

describe('Corpus (verse picker)', () => {
  const c = new Corpus(VERSES, BOOKS)

  it('lists loaded books in canon order', () => {
    expect(c.loadedBooks().map((b) => b.id)).toEqual(['GEN', 'JHN'])
  })

  it('navigates book → chapter → verse', () => {
    expect(c.chapters('GEN')).toEqual([1, 2])
    expect(c.verses('GEN', 1).map((v) => v.verse)).toEqual([1, 6])
    expect(c.verseText('GEN', 1, 6)).toBe('Let there be a firmament.')
    expect(c.verseText('JHN', 3, 16)).toBe('For Elohiym so loved…')
  })

  it('returns empties for unknown refs', () => {
    expect(c.chapters('ZZZ')).toEqual([])
    expect(c.verses('GEN', 99)).toEqual([])
    expect(c.verseText('GEN', 1, 99)).toBe('')
  })
})

describe('parseVersesJsonl', () => {
  it('parses kind:30700 events, skipping malformed lines', () => {
    const jsonl = [
      JSON.stringify({ content: 'hi', tags: [['ref', 'GEN', '1', '6']] }),
      '',
      JSON.stringify({ content: 'x', tags: [['d', 'no-ref']] }),
    ].join('\n')
    expect(parseVersesJsonl(jsonl)).toEqual([{ bookId: 'GEN', chapter: 1, verse: 6, text: 'hi' }])
  })
})
