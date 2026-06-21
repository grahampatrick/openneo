/**
 * Parse the official Berean Standard Bible verse table (bsb.txt) into verses.
 *
 * Source: https://bereanbible.com/bsb.txt — tab-separated, one verse per line:
 *   "Genesis 1:1<TAB>In the beginning God created the heavens and the earth."
 * The first lines are a copyright notice + a "Verse<TAB>Berean Standard Bible"
 * header, which we skip.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RAW_DIR } from './config'
import { bookIdForName, bookMeta } from './book-order'
import type { Verse } from './types'

const REF_RE = /^(.*\S)\s+(\d+):(\d+)$/

/** Parse raw bsb.txt content into ordered verses (no naming map applied). */
export function parseBsb(raw: string): Verse[] {
  const text = raw.replace(/^\uFEFF/, '')
  const lines = text.split(/\r?\n/)
  const verses: Verse[] = []
  const unknownBooks = new Set<string>()

  for (const line of lines) {
    if (!line.trim()) continue
    const tab = line.indexOf('\t')
    if (tab === -1) continue // notice lines without a tab
    const ref = line.slice(0, tab).trim()
    const body = line.slice(tab + 1).trim()
    const m = REF_RE.exec(ref)
    if (!m) continue // header row ("Verse")
    const name = m[1]!
    const ch = m[2]!
    const vs = m[3]!
    const bookId = bookIdForName(name)
    if (!bookId) {
      unknownBooks.add(name)
      continue
    }
    if (!body) continue
    const meta = bookMeta(bookId)
    verses.push({
      bookId,
      bookIndex: meta.index,
      chapter: Number(ch),
      verse: Number(vs),
      text: body,
      original: body,
      source: 'BSB',
    })
  }

  if (unknownBooks.size > 0) {
    throw new Error(`Unmapped BSB book names: ${[...unknownBooks].join(', ')}`)
  }
  if (verses.length < 31000) {
    throw new Error(`BSB parse produced only ${String(verses.length)} verses (expected ~31102)`)
  }
  return verses
}

/** Read and parse the cached bsb.txt from sources/raw/. */
export function loadBsb(): Verse[] {
  const path = resolve(RAW_DIR, 'bsb.txt')
  return parseBsb(readFileSync(path, 'utf8'))
}
