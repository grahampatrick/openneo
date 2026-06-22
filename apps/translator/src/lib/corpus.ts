/**
 * Corpus access for the portal's verse picker. Fetches the same content the
 * reader serves (no duplication), lazily — only when the translator opens the
 * picker. Indexed by book → chapter → verse for fast navigation.
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

export class Corpus {
  private readonly byBook = new Map<string, Map<number, Verse[]>>()
  readonly books: readonly BookMeta[]

  constructor(verses: Verse[], books: BookMeta[]) {
    this.books = books
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

  /** Books that actually have verses, in canon order. */
  loadedBooks(): BookMeta[] {
    return this.books.filter((b) => this.byBook.has(b.id))
  }
  bookMeta(bookId: string): BookMeta | undefined {
    return this.books.find((b) => b.id === bookId)
  }
  chapters(bookId: string): number[] {
    return [...(this.byBook.get(bookId)?.keys() ?? [])].sort((a, b) => a - b)
  }
  verses(bookId: string, chapter: number): Verse[] {
    return this.byBook.get(bookId)?.get(chapter) ?? []
  }
  verseText(bookId: string, chapter: number, verse: number): string {
    return this.verses(bookId, chapter).find((v) => v.verse === verse)?.text ?? ''
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

/**
 * Fetch + build the corpus. Defaults to the reader's deployed path
 * (`/read/corpus`, same origin) so the portal doesn't ship its own 25 MB copy.
 */
export async function fetchCorpus(base = '/read/corpus'): Promise<Corpus> {
  const [versesText, order] = await Promise.all([
    fetch(`${base}/verses.jsonl`).then((r) => {
      if (!r.ok) throw new Error(`corpus ${String(r.status)}`)
      return r.text()
    }),
    fetch(`${base}/book-order.json`).then((r) => r.json() as Promise<{ books: BookMeta[] }>),
  ])
  return new Corpus(parseVersesJsonl(versesText), order.books)
}
