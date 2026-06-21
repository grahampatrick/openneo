/**
 * NeoOS naming-map engine.
 *
 * Applies the Hebrew naming conventions in data/neoos/naming-map.json to source
 * verse text. Design rules:
 *
 *  - Longest match wins ("Jesus Christ" → "Yahusha HaMashiach" before "Jesus").
 *  - Case-sensitive ("LORD"→Yahuah, "Lord"→Adonai, lowercase "god" untouched).
 *  - Single pass over each verse — a replacement's output is never re-scanned,
 *    so "LORD God" → "Yahuah Elohiym" does not then become "Yahuah Eloheliym".
 *  - Word-boundary anchored — never rewrite a substring inside another word.
 *
 * Entries that require human/context judgement are NOT auto-applied; they are
 * recorded as `skipped` so the audit trail is explicit:
 *  - to === "CONTEXT_DEPENDENT" (e.g. "hell" → Sheol/Hades/Gehenna by context)
 *  - to contains " / " (ambiguous dual form, e.g. "immerse / immersion")
 *  - identity terms (from === to, e.g. "Sheol" → "Sheol" — a retain marker)
 *  - metadata-only terms ("Old Testament", "New Testament", …)
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { readFileSync } from 'node:fs'
import { NAMING_MAP_PATH } from './config'

interface Replacement {
  from: string[]
  to: string
  notes?: string
}
interface Category {
  note?: string
  replacements: Replacement[]
}
interface NamingMapFile {
  version: string
  [category: string]: unknown
}

/** from-phrases that are metadata/heading-only and must never touch verse text. */
const METADATA_ONLY = new Set([
  'Old Testament',
  'New Testament',
  "Lord's Supper",
  'Last Supper',
])

export interface NamingRule {
  from: string
  to: string
}
export interface SkippedRule {
  from: string
  to: string
  reason: string
}

export interface Replacer {
  apply(text: string): string
  rules: NamingRule[]
  skipped: SkippedRule[]
  version: string
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isCategory(v: unknown): v is Category {
  return typeof v === 'object' && v !== null && Array.isArray((v as Category).replacements)
}

/** Build a replacer from a parsed naming-map object. */
export function buildReplacer(map: NamingMapFile): Replacer {
  const rules: NamingRule[] = []
  const skipped: SkippedRule[] = []
  const seen = new Set<string>()

  for (const value of Object.values(map)) {
    if (!isCategory(value)) continue
    for (const entry of value.replacements) {
      for (const from of entry.from) {
        const to = entry.to
        let reason = ''
        if (to === 'CONTEXT_DEPENDENT') reason = 'context-dependent'
        else if (to.includes(' / ')) reason = 'ambiguous dual form'
        else if (from === to) reason = 'identity (retain)'
        else if (METADATA_ONLY.has(from)) reason = 'metadata-only'

        if (reason) {
          skipped.push({ from, to, reason })
          continue
        }
        // First mapping for a given `from` wins (categories are ordered most
        // authoritative first; divine names precede everything).
        if (seen.has(from)) continue
        seen.add(from)
        rules.push({ from, to })
      }
    }
  }

  // Longest source phrase first so multi-word names match before their parts.
  rules.sort((a, b) => b.from.length - a.from.length)

  // Optionally consume a preceding "a"/"an" article so we can fix agreement
  // when a substitution changes the following word's initial sound
  // (e.g. "an expanse" → "a firmament").
  const names = rules.map((r) => escapeRegExp(r.from)).join('|')
  const pattern =
    rules.length === 0 ? null : new RegExp(`(?:\\b([Aa]n?)\\s+)?\\b(?:${names})\\b`, 'g')
  const lookup = new Map(rules.map((r) => [r.from, r.to]))

  function apply(text: string): string {
    if (!pattern) return text
    return text.replace(pattern, (m: string, article: string | undefined) => {
      const name = article === undefined ? m : m.slice(article.length).trimStart()
      const to = lookup.get(name)
      if (to === undefined) return m
      if (article === undefined) return to
      const wantAn = /^[aeiou]/i.test(to)
      const fixed = wantAn ? 'an' : 'a'
      return (article.startsWith('A') ? fixed[0]!.toUpperCase() + fixed.slice(1) : fixed) + ' ' + to
    })
  }

  return { apply, rules, skipped, version: map.version }
}

let _default: Replacer | undefined
/** The replacer built from the on-disk naming-map.json (lazy, cached). */
export function defaultReplacer(): Replacer {
  if (!_default) {
    const map = JSON.parse(readFileSync(NAMING_MAP_PATH, 'utf8')) as NamingMapFile
    _default = buildReplacer(map)
  }
  return _default
}
