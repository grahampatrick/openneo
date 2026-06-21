/**
 * BLAKE3 content-addressing and Merkle aggregation for the NeoOS corpus.
 *
 * Tree: verse → chapter → book → canon root. A verse's hash is over its
 * canonical reference + final text only (never the event envelope), so the
 * root is stable regardless of signing or event metadata. Parent hashes are
 * BLAKE3 over the newline-joined child hex hashes, in canonical order.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { blake3 } from '@noble/hashes/blake3'
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils'
import type { Verse, BookHash } from './types'
import { bookMeta } from './book-order'

export function b3hex(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? utf8ToBytes(input) : input
  return bytesToHex(blake3(bytes))
}

/** Canonical content string a verse hash is computed over. */
export function versePreimage(v: Verse): string {
  return `${v.bookId} ${String(v.chapter)}:${String(v.verse)}\n${v.text}`
}

export function verseHash(v: Verse): string {
  return b3hex(versePreimage(v))
}

/** Hash an ordered list of child hex hashes into one parent hash. */
export function aggregate(childHashes: string[]): string {
  return b3hex(childHashes.join('\n'))
}

export interface CorpusHashes {
  /** blake3 root over all book hashes in canon order. */
  root: string
  books: BookHash[]
  /** verseHash keyed by `${bookId} ${chapter}:${verse}` — for event tags. */
  verseHashes: Map<string, string>
  verseCount: number
}

/**
 * Compute the full Merkle summary for a corpus. Verses must already be in
 * canonical order (book index, then chapter, then verse).
 */
export function hashCorpus(verses: Verse[]): CorpusHashes {
  const verseHashes = new Map<string, string>()

  // Canonicalize order so the root is independent of input ordering.
  const ordered = [...verses].sort(
    (a, b) => a.bookIndex - b.bookIndex || a.chapter - b.chapter || a.verse - b.verse,
  )

  // Group verses by book, then by chapter.
  const byBook = new Map<string, Verse[]>()
  for (const v of ordered) {
    let arr = byBook.get(v.bookId)
    if (!arr) {
      arr = []
      byBook.set(v.bookId, arr)
    }
    arr.push(v)
  }

  const books: BookHash[] = []
  for (const [bookId, bverses] of byBook) {
    const byChapter = new Map<number, Verse[]>()
    for (const v of bverses) {
      let arr = byChapter.get(v.chapter)
      if (!arr) {
        arr = []
        byChapter.set(v.chapter, arr)
      }
      arr.push(v)
    }

    const chapterHashes: string[] = []
    for (const ch of [...byChapter.keys()].sort((a, b) => a - b)) {
      const cverses = byChapter.get(ch)!
      const vHashes: string[] = []
      for (const v of cverses) {
        const h = verseHash(v)
        verseHashes.set(`${v.bookId} ${String(v.chapter)}:${String(v.verse)}`, h)
        vHashes.push(h)
      }
      chapterHashes.push(aggregate(vHashes))
    }

    const meta = bookMeta(bookId)
    books.push({
      index: meta.index,
      id: meta.id,
      english: meta.english,
      hebrew: meta.hebrew,
      source: meta.source,
      chapters: byChapter.size,
      verses: bverses.length,
      hash: aggregate(chapterHashes),
    })
  }

  // Canon order by book index.
  books.sort((a, b) => a.index - b.index)
  const root = aggregate(books.map((b) => b.hash))

  return { root, books, verseHashes, verseCount: verses.length }
}
