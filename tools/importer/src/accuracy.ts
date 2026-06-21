/**
 * Generate data/neoos/accuracy-corrections.json — a machine-readable audit
 * trail of the naming-map transformation. Records every rule actually applied,
 * the rules deliberately skipped (with reason), and per-verse correction
 * samples for the marquee accuracy cases (firmament, Heylel).
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { writeFileSync } from 'node:fs'
import { defaultReplacer } from './naming'
import type { Verse } from './types'

/** Marquee verse-level corrections the project documents explicitly. */
const MARQUEE: { ref: string; rationale: string }[] = [
  { ref: 'GEN 1:6', rationale: 'Hebrew raqia = a beaten/stretched solid surface; "firmament" is accurate, "expanse" is a modern softening.' },
  { ref: 'GEN 1:7', rationale: 'Hebrew raqia — firmament.' },
  { ref: 'GEN 1:8', rationale: 'Hebrew raqia — firmament.' },
  { ref: 'GEN 1:14', rationale: 'Hebrew raqia — firmament.' },
  { ref: 'GEN 1:15', rationale: 'Hebrew raqia — firmament.' },
  { ref: 'GEN 1:17', rationale: 'Hebrew raqia — firmament.' },
  { ref: 'GEN 1:20', rationale: 'Hebrew raqia — firmament.' },
  { ref: 'ISA 14:12', rationale: 'Heylel (shining one); "Lucifer" is a Latin mistranslation.' },
]

export interface AccuracyAudit {
  version: string
  note: string
  naming_map_version: string
  applied_rules: number
  skipped_rules: { from: string; to: string; reason: string }[]
  rule_index: { from: string; to: string }[]
  corrections: {
    ref: string
    original: string
    correction: string
    rationale: string
    source_ref: string
  }[]
}

export function buildAccuracyAudit(verses: Verse[]): AccuracyAudit {
  const replacer = defaultReplacer()
  const byRef = new Map<string, Verse>()
  for (const v of verses) byRef.set(`${v.bookId} ${String(v.chapter)}:${String(v.verse)}`, v)

  const corrections: AccuracyAudit['corrections'] = []
  for (const { ref, rationale } of MARQUEE) {
    const v = byRef.get(ref)
    if (!v || v.original === v.text) continue
    corrections.push({
      ref,
      original: v.original,
      correction: v.text,
      rationale,
      source_ref: 'data/neoos/naming-map.json',
    })
  }

  return {
    version: 'neoos-accuracy-1',
    note: 'Auto-generated audit of the naming-map transformation. Every applied substitution is reproducible from naming-map.json; the original text is preserved per-verse in the corpus build.',
    naming_map_version: replacer.version,
    applied_rules: replacer.rules.length,
    skipped_rules: replacer.skipped,
    rule_index: replacer.rules,
    corrections,
  }
}

export function writeAccuracyAudit(verses: Verse[], path: string): AccuracyAudit {
  const audit = buildAccuracyAudit(verses)
  writeFileSync(path, JSON.stringify(audit, null, 2) + '\n')
  return audit
}
