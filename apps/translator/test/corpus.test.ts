import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchBookList, fetchBook, chaptersOf, versesOf, verseText, type BookData } from '../src/lib/corpus'

const BOOK_ORDER = {
  books: [
    { index: 1, id: 'GEN', english: 'Genesis', hebrew: "Bere'shiyth" },
    { index: 6, id: 'JHN', english: 'John', hebrew: 'Yahuchanon' },
    { index: 99, id: 'XXX', english: 'NotLoaded', hebrew: '—' },
  ],
}
const GEN: Record<string, Record<string, string>> = {
  '1': { '1': 'In the beginning…', '6': 'Let there be a firmament.' },
  '2': { '1': 'Thus the heavens…' },
}

function mockFetch(map: Record<string, unknown>) {
  return vi.fn((url: string) => {
    const key = Object.keys(map).find((k) => url.endsWith(k))
    if (!key) return Promise.resolve({ ok: false, status: 404 } as Response)
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(map[key]) } as Response)
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchBookList', () => {
  it('returns only available books, with names', async () => {
    vi.stubGlobal('fetch', mockFetch({ 'book-order.json': BOOK_ORDER, 'available-books.json': ['GEN', 'JHN'] }))
    const books = await fetchBookList()
    expect(books.map((b) => b.id)).toEqual(['GEN', 'JHN']) // XXX filtered out
    expect(books[0]).toMatchObject({ id: 'GEN', english: 'Genesis' })
  })

  it('falls back to all books if available-books.json is missing', async () => {
    vi.stubGlobal('fetch', mockFetch({ 'book-order.json': BOOK_ORDER }))
    expect((await fetchBookList()).map((b) => b.id)).toEqual(['GEN', 'JHN', 'XXX'])
  })

  it('throws if book-order is unreachable', async () => {
    vi.stubGlobal('fetch', mockFetch({}))
    await expect(fetchBookList()).rejects.toThrow(/book-order/)
  })
})

describe('fetchBook + navigation', () => {
  it('fetches a single book and navigates chapter → verse → text', async () => {
    vi.stubGlobal('fetch', mockFetch({ 'books/GEN.json': GEN }))
    const book: BookData = await fetchBook('GEN')
    expect(chaptersOf(book)).toEqual([1, 2])
    expect(versesOf(book, 1)).toEqual([1, 6])
    expect(verseText(book, 1, 6)).toBe('Let there be a firmament.')
    expect(verseText(book, 1, 99)).toBe('') // unknown verse
  })

  it('throws on a missing book file', async () => {
    vi.stubGlobal('fetch', mockFetch({}))
    await expect(fetchBook('ZZZ')).rejects.toThrow(/ZZZ/)
  })
})
