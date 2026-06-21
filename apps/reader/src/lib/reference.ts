/**
 * Reference parsing/formatting (id / English / Hebrew book names, verse ranges).
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import type { Corpus } from './corpus'

export interface Reference {
  bookId: string
  chapter: number
  verseStart?: number
  verseEnd?: number
}

const REF_RE = /^(.+?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/

export function parseReference(input: string, corpus: Corpus): Reference | null {
  const m = REF_RE.exec(input.trim())
  if (!m) return null
  const name = m[1]
  const chap = m[2]
  if (name === undefined || chap === undefined) return null
  const bookId = corpus.resolveBook(name)
  if (!bookId) return null
  const ref: Reference = { bookId, chapter: Number(chap) }
  if (m[3] !== undefined) {
    ref.verseStart = Number(m[3])
    ref.verseEnd = m[4] !== undefined ? Number(m[4]) : ref.verseStart
  }
  return ref
}

export function formatReference(ref: Reference, corpus: Corpus): string {
  const meta = corpus.bookMeta(ref.bookId)
  const name = meta?.hebrew ?? ref.bookId
  let label = `${name} ${ref.chapter}`
  if (ref.verseStart !== undefined) {
    label += `:${ref.verseStart}`
    if (ref.verseEnd !== undefined && ref.verseEnd !== ref.verseStart) label += `-${ref.verseEnd}`
  }
  return label
}
