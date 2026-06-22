/**
 * Corpus access for the portal's verse picker — lazy, per-book. Instead of
 * downloading the whole 28.5 MB corpus, fetch the small book list (~KBs) up
 * front, then one book file (tens–hundreds of KB) when the translator selects
 * it. Files are the per-book split the reader serves at /read/corpus/books/.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
export interface BookMeta {
  index: number
  id: string
  english: string
  hebrew: string
}

/** One book: chapter → verse → text. */
export type BookData = Record<number, Record<number, string>>

const DEFAULT_BASE = '/read/corpus'

/** Fetch the list of available books (with names), small. */
export async function fetchBookList(base = DEFAULT_BASE): Promise<BookMeta[]> {
  const [order, available] = await Promise.all([
    fetch(`${base}/book-order.json`).then((r) => {
      if (!r.ok) throw new Error(`book-order ${String(r.status)}`)
      return r.json() as Promise<{ books: BookMeta[] }>
    }),
    fetch(`${base}/available-books.json`)
      .then((r) => (r.ok ? (r.json() as Promise<string[]>) : null))
      .catch(() => null),
  ])
  const avail = available ? new Set(available) : null
  return order.books.filter((b) => !avail || avail.has(b.id))
}

/** Fetch a single book's verses (chapter → verse → text). */
export async function fetchBook(bookId: string, base = DEFAULT_BASE): Promise<BookData> {
  const raw = await fetch(`${base}/books/${bookId}.json`).then((r) => {
    if (!r.ok) throw new Error(`book ${bookId} ${String(r.status)}`)
    return r.json() as Promise<Record<string, Record<string, string>>>
  })
  const out: BookData = {}
  for (const [ch, verses] of Object.entries(raw)) {
    const chapter: Record<number, string> = {}
    for (const [v, text] of Object.entries(verses)) chapter[Number(v)] = text
    out[Number(ch)] = chapter
  }
  return out
}

export function chaptersOf(book: BookData): number[] {
  return Object.keys(book)
    .map(Number)
    .sort((a, b) => a - b)
}
export function versesOf(book: BookData, chapter: number): number[] {
  return Object.keys(book[chapter] ?? {})
    .map(Number)
    .sort((a, b) => a - b)
}
export function verseText(book: BookData, chapter: number, verse: number): string {
  return book[chapter]?.[verse] ?? ''
}
