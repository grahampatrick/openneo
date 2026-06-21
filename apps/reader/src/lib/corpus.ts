/**
 * Browser corpus — fetches verses.jsonl + book-order.json and indexes them.
 * No Node APIs, so it runs in the PWA and is testable under jsdom.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
export interface Verse {
  bookId: string
  chapter: number
  verse: number
  text: string
}
export interface BookMeta {
  index: number
  id: string
  english: string
  hebrew: string
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

export class Corpus {
  private readonly byBook = new Map<string, Map<number, Verse[]>>()
  private readonly nameToId = new Map<string, string>()
  readonly books: readonly BookMeta[]

  constructor(verses: Verse[], books: BookMeta[]) {
    this.books = books
    for (const b of books) {
      this.nameToId.set(norm(b.id), b.id)
      this.nameToId.set(norm(b.english), b.id)
      this.nameToId.set(norm(b.hebrew), b.id)
    }
    for (const v of verses) {
      let chapters = this.byBook.get(v.bookId)
      if (!chapters) {
        chapters = new Map()
        this.byBook.set(v.bookId, chapters)
      }
      const list = chapters.get(v.chapter)
      if (list) list.push(v)
      else chapters.set(v.chapter, [v])
    }
    for (const chapters of this.byBook.values())
      for (const list of chapters.values()) list.sort((a, b) => a.verse - b.verse)
  }

  resolveBook(name: string): string | undefined {
    return this.nameToId.get(norm(name))
  }
  bookMeta(bookId: string): BookMeta | undefined {
    return this.books.find((b) => b.id === bookId)
  }
  chapter(bookId: string, chapter: number): Verse[] {
    return this.byBook.get(bookId)?.get(chapter) ?? []
  }
  chapters(bookId: string): number[] {
    return [...(this.byBook.get(bookId)?.keys() ?? [])].sort((a, b) => a - b)
  }
  /** Books that actually have verses loaded, in canon order. */
  loadedBooks(): BookMeta[] {
    return this.books.filter((b) => this.byBook.has(b.id))
  }
  /** Naive full-text search over loaded verses (FTS-free, works offline). */
  search(query: string, limit = 50): Verse[] {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const out: Verse[] = []
    for (const chapters of this.byBook.values()) {
      for (const list of chapters.values()) {
        for (const v of list) {
          if (v.text.toLowerCase().includes(q)) {
            out.push(v)
            if (out.length >= limit) return out
          }
        }
      }
    }
    return out
  }
}

/** Parse verses.jsonl (kind:30700 events) into Verse[]. */
export function parseVersesJsonl(jsonl: string): Verse[] {
  const out: Verse[] = []
  for (const line of jsonl.split('\n')) {
    if (!line.trim()) continue
    const event = JSON.parse(line) as { content: string; tags: string[][] }
    const ref = event.tags.find((t) => t[0] === 'ref')
    if (!ref) continue
    const bookId = ref[1]
    const ch = ref[2]
    const vs = ref[3]
    if (bookId === undefined || ch === undefined || vs === undefined) continue
    out.push({ bookId, chapter: Number(ch), verse: Number(vs), text: event.content })
  }
  return out
}

/** Fetch + build the corpus from static assets (relative to base). */
export async function fetchCorpus(base = '.'): Promise<Corpus> {
  const [versesText, orderJson] = await Promise.all([
    fetch(`${base}/corpus/verses.jsonl`).then((r) => r.text()),
    fetch(`${base}/corpus/book-order.json`).then((r) => r.json() as Promise<{ books: BookMeta[] }>),
  ])
  return new Corpus(parseVersesJsonl(versesText), orderJson.books)
}
