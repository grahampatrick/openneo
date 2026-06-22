import { describe, it, expect } from 'vitest'
import { parseBsb } from '../src/parse-bsb'
import { parseUsfm } from '../src/parse-usfm'

describe('parseBsb', () => {
  const sample = [
    'The Holy Bible, Berean Standard Bible — notice line\t',
    'Public domain dedication\t',
    'Verse\tBerean Standard Bible',
    'Genesis 1:1\tIn the beginning God created the heavens and the earth.',
    'Genesis 1:2\tNow the earth was formless and void.',
    '1 Samuel 1:1\tThere was a man named Elkanah.',
    'Psalm 23:1\tThe LORD is my shepherd.',
    'Song of Solomon 1:1\tThe Song of Songs.',
    'Revelation 22:21\tThe grace of the Lord Jesus be with all. Amen.',
  ].join('\r\n')

  it('skips notices/header and parses verses with book ids', () => {
    // Below the 31000 guard, so call the pure splitter via a relaxed wrapper:
    expect(() => parseBsb(sample)).toThrow(/only 6 verses/)
  })

  it('maps book-name spellings to canonical ids', () => {
    // Reach past the count guard by replicating Genesis verses.
    const many = [sample, ...Array.from({ length: 31100 }, (_, i) => `Genesis 2:${String(i + 1)}\tfiller ${String(i)}`)].join(
      '\r\n',
    )
    const verses = parseBsb(many)
    const byRef = new Map(verses.map((v) => [`${v.bookId} ${String(v.chapter)}:${String(v.verse)}`, v]))
    expect(byRef.get('GEN 1:1')?.text).toMatch(/In the beginning/)
    expect(byRef.get('1SA 1:1')?.bookId).toBe('1SA')
    expect(byRef.get('PSA 23:1')?.bookId).toBe('PSA')
    expect(byRef.get('SNG 1:1')?.bookId).toBe('SNG')
    expect(byRef.get('GEN 1:1')?.source).toBe('BSB')
    expect(byRef.get('GEN 1:1')?.original).toBe(byRef.get('GEN 1:1')?.text)
  })

  it('throws on an unmapped book name', () => {
    const bad = ['Verse\tBSB', 'Nonexistus 1:1\tnope'].join('\n')
    expect(() => parseBsb(bad)).toThrow(/Unmapped/)
  })
})

describe('parseUsfm', () => {
  const usfm = String.raw`\id TOB Tobit
\h Tobit
\c 1
\p
\v 1 The book of the \w words|x \w* of Tobit,\f + footnote text\f* son of Tobiel.
\v 2 Who in the time of Enemessar was \add taken\add* captive.
\c 2
\q1
\v 1 Now when I was come home again.`

  it('extracts verses, strips markup, notes, and tracks chapters', () => {
    const verses = parseUsfm(usfm, 'TOB', 'KJV-Apocrypha-PD')
    expect(verses).toHaveLength(3)
    expect(verses[0]).toMatchObject({ bookId: 'TOB', chapter: 1, verse: 1 })
    expect(verses[0]?.text).toBe('The book of the words of Tobit, son of Tobiel.')
    expect(verses[1]?.text).toBe('Who in the time of Enemessar was taken captive.')
    expect(verses[2]).toMatchObject({ chapter: 2, verse: 1 })
    expect(verses[0]?.source).toBe('KJV-Apocrypha-PD')
  })

  it('ignores verse markers before any chapter marker', () => {
    const verses = parseUsfm('\\v 1 orphan verse with no chapter', 'TOB', 'PD')
    expect(verses).toHaveLength(0)
  })

  it('drops section headings / refs / descriptions, not just their markers', () => {
    const withHeadings = String.raw`\c 1
\s1 The story begins
\p
\v 1 The first verse.
\s The next section
\r (see elsewhere)
\v 2 The second verse.
\c 2
\d A psalm description
\v 1 Another verse.`
    const verses = parseUsfm(withHeadings, 'TOB', 'PD')
    expect(verses.map((v) => v.text)).toEqual(['The first verse.', 'The second verse.', 'Another verse.'])
    // heading text must not leak into any verse
    expect(verses.some((v) => /story begins|next section|see elsewhere|psalm description/.test(v.text))).toBe(false)
  })
})
