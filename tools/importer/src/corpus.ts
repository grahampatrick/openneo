/**
 * Assemble the full NeoOS corpus: load every available source, apply the
 * naming map, and return verses in canonical (book → chapter → verse) order.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { loadBsb } from './parse-bsb'
import { loadExtraSources } from './parse-extra'
import { defaultReplacer } from './naming'
import type { Verse } from './types'

export interface CorpusBuild {
  verses: Verse[]
  /** Number of verses whose text changed under the naming map. */
  changed: number
  /** Source tag → verse count. */
  bySource: Record<string, number>
}

export function buildCorpus(): CorpusBuild {
  const replacer = defaultReplacer()
  const verses: Verse[] = [...loadBsb(), ...loadExtraSources()]

  let changed = 0
  const bySource: Record<string, number> = {}
  for (const v of verses) {
    const out = replacer.apply(v.original)
    v.text = out
    if (out !== v.original) changed++
    bySource[v.source] = (bySource[v.source] ?? 0) + 1
  }

  verses.sort(
    (a, b) => a.bookIndex - b.bookIndex || a.chapter - b.chapter || a.verse - b.verse,
  )

  // Integrity: no duplicate references.
  const seen = new Set<string>()
  for (const v of verses) {
    const ref = `${v.bookId} ${String(v.chapter)}:${String(v.verse)}`
    if (seen.has(ref)) throw new Error(`Duplicate verse reference: ${ref}`)
    seen.add(ref)
  }

  return { verses, changed, bySource }
}
