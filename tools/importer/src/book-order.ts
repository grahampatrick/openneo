/**
 * Loads book-order.json and provides English-name → book-id resolution.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { readFileSync } from 'node:fs'
import { BOOK_ORDER_PATH } from './config'
import type { BookMeta } from './types'

interface BookOrderFile {
  version: string
  total_books: number
  books: BookMeta[]
}

const raw = JSON.parse(readFileSync(BOOK_ORDER_PATH, 'utf8')) as BookOrderFile

export const BOOKS: readonly BookMeta[] = raw.books

// Integrity guard: book ids must be unique (a duplicate id would collapse two
// books into the same content-address namespace).
{
  const seen = new Set<string>()
  for (const b of BOOKS) {
    if (seen.has(b.id)) throw new Error(`Duplicate book id in book-order.json: ${b.id}`)
    seen.add(b.id)
  }
}

export const BY_ID = new Map<string, BookMeta>(BOOKS.map((b) => [b.id, b]))

/**
 * Map of normalized English book name → book id. Covers the spellings that
 * appear in source files (e.g. BSB uses "Psalm" for the book of Psalms, and
 * "Song of Solomon"). Add aliases here rather than mutating book-order.json.
 */
const NAME_ALIASES: Record<string, string> = {
  psalm: 'PSA',
  psalms: 'PSA',
  'song of songs': 'SNG',
  'song of solomon': 'SNG',
  canticles: 'SNG',
}

function norm(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

const BY_NAME = new Map<string, string>()
for (const b of BOOKS) BY_NAME.set(norm(b.english), b.id)
for (const [alias, id] of Object.entries(NAME_ALIASES)) BY_NAME.set(alias, id)

/** Resolve an English book name to its canonical id, or undefined. */
export function bookIdForName(name: string): string | undefined {
  return BY_NAME.get(norm(name))
}

export function bookMeta(id: string): BookMeta {
  const b = BY_ID.get(id)
  if (!b) throw new Error(`Unknown book id: ${id}`)
  return b
}
