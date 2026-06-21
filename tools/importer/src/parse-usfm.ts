/**
 * Minimal USFM verse extractor.
 *
 * Handles the markers that actually carry text: \c (chapter), \v (verse), and
 * the common paragraph/poetry markers (\p \m \q \q1.. \b). Strips inline
 * character markup (\w word|strong\w*, \add..\add*, \nd..\nd*), footnotes
 * (\f .. \f*) and cross-references (\x .. \x*). This is deliberately small —
 * just enough for public-domain apocrypha/pseudepigrapha USFM.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { bookMeta } from './book-order'
import type { Verse } from './types'

/** Remove footnotes and cross-references entirely (including their content). */
function stripNotes(s: string): string {
  return s
    .replace(/\\f\b.*?\\f\*/gs, '')
    .replace(/\\x\b.*?\\x\*/gs, '')
    .replace(/\\fe\b.*?\\fe\*/gs, '')
}

/** Strip inline character markers, keeping the visible word of \w tokens. */
function stripInline(s: string): string {
  return s
    // \w surface|lemma="..." strong="..." \w*  → surface
    .replace(/\\w\s+([^|\\]+)(?:\|[^\\]*)?\\w\*/g, '$1')
    .replace(/\\\+?[a-z]+\d*\*/gi, '') // closing markers like \add* \nd* (before openers)
    .replace(/\\\+?[a-z]+\d*\s?/gi, '') // opening markers like \add \nd \q1
    .replace(/\|[^\\]*$/g, '') // dangling attribute remnants
}

function clean(s: string): string {
  return stripInline(stripNotes(s)).replace(/\s+/g, ' ').trim()
}

export function parseUsfm(content: string, bookId: string, source: string): Verse[] {
  const meta = bookMeta(bookId)
  const verses: Verse[] = []

  // Normalize: ensure each \c and \v starts on its own boundary.
  const tokens = content.replace(/\r\n?/g, '\n').split(/(?=\\[cv]\b)/)

  let chapter = 0
  for (const tok of tokens) {
    const cMatch = /^\\c\s+(\d+)/.exec(tok)
    if (cMatch) {
      chapter = Number(cMatch[1])
      continue
    }
    const vMatch = /^\\v\s+(\d+)(?:-(\d+))?\s*([\s\S]*)$/.exec(tok)
    if (!vMatch) continue
    const startV = Number(vMatch[1])
    const text = clean(vMatch[3] ?? '')
    if (!text || chapter === 0) continue
    verses.push({
      bookId,
      bookIndex: meta.index,
      chapter,
      verse: startV,
      text,
      original: text,
      source,
    })
  }
  return verses
}
