/**
 * Load the NeoOS corpus (verses.jsonl + book-order.json) into an in-memory,
 * indexed structure for reading and reference resolution.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { dataDir } from './config'
import type { BookMeta, Verse } from './types'

interface BookOrderFile {
  books: BookMeta[]
}

export class Corpus {
  /** bookId → chapter → ordered verses. */
  private readonly byBook = new Map<string, Map<number, Verse[]>>()
  readonly books: readonly BookMeta[]
  private readonly nameToId = new Map<string, string>()

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
    for (const chapters of this.byBook.values()) {
      for (const list of chapters.values()) list.sort((a, b) => a.verse - b.verse)
    }
  }

  /** Resolve an id / English / Hebrew book name to its canonical id. */
  resolveBook(name: string): string | undefined {
    return this.nameToId.get(norm(name))
  }

  bookMeta(bookId: string): BookMeta | undefined {
    return this.books.find((b) => b.id === bookId)
  }

  /** Verses of a chapter, or [] if absent. */
  chapter(bookId: string, chapter: number): Verse[] {
    return this.byBook.get(bookId)?.get(chapter) ?? []
  }

  /** Chapter numbers present for a book, ascending. */
  chapters(bookId: string): number[] {
    return [...(this.byBook.get(bookId)?.keys() ?? [])].sort((a, b) => a - b)
  }

  get verseCount(): number {
    let n = 0
    for (const chapters of this.byBook.values()) for (const list of chapters.values()) n += list.length
    return n
  }
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Parse verses.jsonl content (kind:30700 events) into Verse[]. */
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

/** Load the corpus from disk (data dir resolved from config/env). */
export function loadCorpus(dir = dataDir()): Corpus {
  const verses = parseVersesJsonl(readFileSync(resolve(dir, 'verses.jsonl'), 'utf8'))
  const order = JSON.parse(readFileSync(resolve(dir, 'book-order.json'), 'utf8')) as BookOrderFile
  return new Corpus(verses, order.books)
}
