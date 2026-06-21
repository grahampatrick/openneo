/**
 * Parse scripture references like "Bere'shiyth 1:1-10", "GEN 1", "John 3:16".
 * Book names may be the canonical id, the English name, or the Hebrew name, and
 * may contain spaces ("1 Samuel", "Song of Solomon").
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import type { Corpus } from './corpus'
import type { Reference } from './types'

const REF_RE = /^(.+?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/

export function parseReference(input: string, corpus: Corpus): Reference {
  const m = REF_RE.exec(input.trim())
  if (!m) throw new Error(`Could not parse reference: "${input}"`)
  const name = m[1]
  if (name === undefined || m[2] === undefined) {
    throw new Error(`Could not parse reference: "${input}"`)
  }
  const bookId = corpus.resolveBook(name)
  if (!bookId) throw new Error(`Unknown book: "${name}"`)
  const chapter = Number(m[2])
  const ref: Reference = { bookId, chapter }
  if (m[3] !== undefined) {
    const start = Number(m[3])
    ref.verseStart = start
    ref.verseEnd = m[4] !== undefined ? Number(m[4]) : start
  }
  return ref
}

/** Human label, e.g. "Bere'shiyth 1:6-8 (GEN)". */
export function formatReference(ref: Reference, corpus: Corpus): string {
  const meta = corpus.bookMeta(ref.bookId)
  const name = meta?.hebrew ?? ref.bookId
  let label = `${name} ${String(ref.chapter)}`
  if (ref.verseStart !== undefined) {
    label += `:${String(ref.verseStart)}`
    if (ref.verseEnd !== undefined && ref.verseEnd !== ref.verseStart) label += `-${String(ref.verseEnd)}`
  }
  return meta ? `${label} (${ref.bookId})` : label
}
