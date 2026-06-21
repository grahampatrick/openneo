/**
 * Load extra (non-BSB) source books — KJV Apocrypha, Enoch, Jubilees, etc.
 *
 * Each extra book is a USFM file in sources/raw/extra/<BOOKID>.usfm. The map
 * below declares which book ids to look for and how to credit them. Files that
 * are not present are skipped (the importer still produces a valid corpus from
 * whatever is available), so the apocrypha can be added incrementally without
 * breaking the build or the BSB-only Definition of Done.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RAW_DIR } from './config'
import { parseUsfm } from './parse-usfm'
import type { Verse } from './types'

export interface ExtraSource {
  bookId: string
  /** Source/attribution tag stored on each verse and in SOURCES.md. */
  source: string
}

/**
 * Books expected from public-domain sources, in canon order. The `source` tag
 * matches book-order.json. Files live at sources/raw/extra/<bookId>.usfm.
 */
export const EXTRA_SOURCES: readonly ExtraSource[] = [
  { bookId: 'TOB', source: 'KJV-Apocrypha-PD' },
  { bookId: 'JDT', source: 'KJV-Apocrypha-PD' },
  { bookId: '1ES', source: 'KJV-Apocrypha-PD' },
  { bookId: '2ES', source: 'KJV-Apocrypha-PD' },
  { bookId: 'WIS', source: 'KJV-Apocrypha-PD' },
  { bookId: 'SIR', source: 'KJV-Apocrypha-PD' },
  { bookId: 'BAR', source: 'KJV-Apocrypha-PD' },
  { bookId: 'S3Y', source: 'KJV-Apocrypha-PD' },
  { bookId: 'SUS', source: 'KJV-Apocrypha-PD' },
  { bookId: 'BEL', source: 'KJV-Apocrypha-PD' },
  { bookId: '1MA', source: 'KJV-Apocrypha-PD' },
  { bookId: '2MA', source: 'KJV-Apocrypha-PD' },
  { bookId: 'MAN', source: 'KJV-Apocrypha-PD' },
  { bookId: 'ENO', source: 'R.H.Charles-PD' },
  { bookId: 'JUB', source: 'R.H.Charles-PD' },
]

export function extraDir(): string {
  return resolve(RAW_DIR, 'extra')
}

/** Load every extra source whose USFM file is present on disk. */
export function loadExtraSources(): Verse[] {
  const dir = extraDir()
  const out: Verse[] = []
  for (const { bookId, source } of EXTRA_SOURCES) {
    const path = resolve(dir, `${bookId}.usfm`)
    if (!existsSync(path)) continue
    out.push(...parseUsfm(readFileSync(path, 'utf8'), bookId, source))
  }
  return out
}
