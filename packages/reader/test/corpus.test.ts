import { describe, it, expect } from 'vitest'
import { parseVersesJsonl } from '../src/corpus'
import { parseReference, formatReference } from '../src/reference'
import { renderChapter, statusBar } from '../src/render'
import { testCorpus } from './helpers'

describe('Corpus', () => {
  const corpus = testCorpus()

  it('indexes verses by book and chapter', () => {
    expect(corpus.chapter('GEN', 1)).toHaveLength(3)
    expect(corpus.chapter('GEN', 2)).toHaveLength(1)
    expect(corpus.chapters('GEN')).toEqual([1, 2])
    expect(corpus.verseCount).toBe(6)
  })

  it('resolves book id, English, and Hebrew names', () => {
    expect(corpus.resolveBook('GEN')).toBe('GEN')
    expect(corpus.resolveBook('Genesis')).toBe('GEN')
    expect(corpus.resolveBook("bere'shiyth")).toBe('GEN')
    expect(corpus.resolveBook('1 Samuel')).toBe('1SA')
    expect(corpus.resolveBook('nope')).toBeUndefined()
  })
})

describe('parseVersesJsonl', () => {
  it('parses kind:30700 events into verses', () => {
    const jsonl = [
      JSON.stringify({ content: 'In the beginning…', tags: [['ref', 'GEN', '1', '1']] }),
      '',
      JSON.stringify({ content: 'no ref', tags: [['d', 'x']] }),
    ].join('\n')
    const verses = parseVersesJsonl(jsonl)
    expect(verses).toHaveLength(1)
    expect(verses[0]).toEqual({ bookId: 'GEN', chapter: 1, verse: 1, text: 'In the beginning…' })
  })
})

describe('parseReference', () => {
  const corpus = testCorpus()

  it('parses book + chapter', () => {
    expect(parseReference('GEN 1', corpus)).toEqual({ bookId: 'GEN', chapter: 1 })
    expect(parseReference("Bere'shiyth 1", corpus)).toEqual({ bookId: 'GEN', chapter: 1 })
  })

  it('parses single verse and verse ranges', () => {
    expect(parseReference('John 3:16', corpus)).toEqual({ bookId: 'JHN', chapter: 3, verseStart: 16, verseEnd: 16 })
    expect(parseReference("Bere'shiyth 1:1-2", corpus)).toEqual({ bookId: 'GEN', chapter: 1, verseStart: 1, verseEnd: 2 })
  })

  it('parses multi-word book names', () => {
    expect(parseReference('1 Samuel 1:1', corpus).bookId).toBe('1SA')
  })

  it('throws on unparseable input or unknown book', () => {
    expect(() => parseReference('garbage', corpus)).toThrow(/parse/)
    expect(() => parseReference('Nonexistus 1', corpus)).toThrow(/Unknown book/)
  })

  it('formats a reference with Hebrew name + id', () => {
    expect(formatReference(parseReference('GEN 1:6', corpus), corpus)).toBe("Bere'shiyth 1:6 (GEN)")
  })
})

describe('renderChapter / statusBar', () => {
  const corpus = testCorpus()

  it('renders a chapter with a title and verses', () => {
    const out = renderChapter(corpus, parseReference('GEN 1', corpus))
    expect(out).toContain("Bere'shiyth — Genesis 1")
    expect(out).toContain('firmament')
    expect(out.split('\n').length).toBeGreaterThan(3)
  })

  it('renders only the requested verse range', () => {
    const out = renderChapter(corpus, parseReference('GEN 1:6', corpus))
    expect(out).toContain('firmament')
    expect(out).not.toContain('formless')
  })

  it('throws for an empty chapter', () => {
    expect(() => renderChapter(corpus, { bookId: 'GEN', chapter: 99 })).toThrow(/No verses/)
  })

  it('wraps long lines at the given width', () => {
    const out = renderChapter(corpus, parseReference('GEN 1:1', corpus), { width: 30 })
    expect(out.split('\n').every((l) => l.length <= 31)).toBe(true)
  })

  it('formats the status bar', () => {
    expect(statusBar({ spentSats: 9, budgetSats: 1000, proofsPublished: 1, lastPaidTranslator: 'abcdef0123456789' })).toBe(
      'sats 9/1000 | last paid: abcdef012345… | use-proofs: 1',
    )
    expect(statusBar({ spentSats: 0, budgetSats: 1000, proofsPublished: 0 })).toContain('last paid: —')
  })
})
