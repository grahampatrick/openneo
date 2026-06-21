/**
 * Render a chapter (or verse range) to plain text for the terminal, plus the
 * status bar. Kept free of I/O so it is unit-testable.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import type { Corpus } from './corpus'
import type { Reference, Verse } from './types'

export interface RenderOptions {
  /** Terminal width for wrapping; 0 disables wrapping. */
  width?: number
}

function inRange(v: Verse, ref: Reference): boolean {
  if (ref.verseStart === undefined) return true
  const end = ref.verseEnd ?? ref.verseStart
  return v.verse >= ref.verseStart && v.verse <= end
}

function wrap(text: string, width: number, indent: string): string {
  if (width <= 0) return text
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    if (line.length + w.length + 1 > width && line.length > 0) {
      lines.push(line)
      line = indent + w
    } else {
      line = line.length === 0 ? w : `${line} ${w}`
    }
  }
  if (line) lines.push(line)
  return lines.join('\n')
}

/** Render the verses of a reference. Throws if the chapter is empty/unknown. */
export function renderChapter(corpus: Corpus, ref: Reference, opts: RenderOptions = {}): string {
  const all = corpus.chapter(ref.bookId, ref.chapter)
  const verses = all.filter((v) => inRange(v, ref))
  if (verses.length === 0) {
    throw new Error(`No verses for ${ref.bookId} ${String(ref.chapter)}`)
  }
  const meta = corpus.bookMeta(ref.bookId)
  const title = meta ? `${meta.hebrew} — ${meta.english} ${String(ref.chapter)}` : `${ref.bookId} ${String(ref.chapter)}`
  const width = opts.width ?? 0
  const body = verses.map((v) => {
    const num = String(v.verse).padStart(3, ' ')
    return wrap(`${num}  ${v.text}`, width, '     ')
  })
  return [title, '─'.repeat(title.length), ...body].join('\n')
}

export interface StatusBarState {
  spentSats: number
  budgetSats: number
  lastPaidTranslator?: string
  proofsPublished: number
}

/** One-line status bar: spent/budget | last paid | proofs. */
export function statusBar(s: StatusBarState): string {
  const lastPaid = s.lastPaidTranslator ? `${s.lastPaidTranslator.slice(0, 12)}…` : '—'
  return `sats ${String(s.spentSats)}/${String(s.budgetSats)} | last paid: ${lastPaid} | use-proofs: ${String(s.proofsPublished)}`
}
