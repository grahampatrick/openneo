#!/usr/bin/env node
// Convert an R.H. Charles pseudepigraphon (Gutenberg plain text) → USFM.
// Roman-numeral chapters, inline "N." verses, editorial marks. Verse + chapter
// boundaries are accepted only when sequential (prev+1), which makes the tokenizer
// robust against stray numerals in prose.
import { readFileSync, writeFileSync } from 'node:fs'

const [, , inFile, outFile, bookId, startRe, endRe] = process.argv
let text = readFileSync(inFile, 'utf8')

// Trim to the book body between the first chapter and the Gutenberg END marker.
const startIdx = text.search(new RegExp(startRe, 'm'))
const endIdx = text.search(new RegExp(endRe, 'm'))
text = text.slice(startIdx, endIdx === -1 ? undefined : endIdx)

const romanToInt = (r) => {
  const m = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }
  let n = 0
  for (let i = 0; i < r.length; i++) {
    const a = m[r[i]], b = m[r[i + 1]]
    n += b && a < b ? -a : a
  }
  return n
}

// Clean editorial marks: drop brackets, keep inner text; strip footnote refs.
const clean = (s) =>
  s
    .replace(/[〚〛⌜⌝]/g, '')
    .replace(/=([^=]*)=/g, '$1')
    .replace(/\[\d+\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

// Split body into chapters at line-start Roman numerals that are sequential.
const lines = text.split(/\r?\n/)
const chapters = []
let curCh = 0
let buf = null
for (const line of lines) {
  const m = /^([IVXLCDM]{1,7})\.\s+(.*)$/.exec(line)
  const val = m ? romanToInt(m[1]) : 0
  // New chapter: a line-start Roman numeral strictly greater than the current
  // one (monotonic — tolerates the edition's own numbering gaps; ignores
  // duplicate/false markers that aren't an increase).
  if (m && val > curCh && val <= curCh + 12) {
    if (buf) chapters.push(buf)
    buf = { n: val, text: m[2] }
    curCh = val
  } else if (buf) {
    buf.text += '\n' + line
  }
}
if (buf) chapters.push(buf)

// Within each chapter, split into verses at sequential "N." markers.
const out = [`\\id ${bookId}`, `\\h ${bookId}`]
let totalVerses = 0
for (const ch of chapters) {
  out.push(`\\c ${ch.n}`)
  const flat = ch.text.replace(/\n/g, ' ')
  // Verse 1's number is implicit at the start (chapter began "ROMAN. 1. ...").
  const parts = []
  let expectedV = 1
  let rest = flat
  // Find " <expectedV+1>. " boundaries iteratively.
  while (true) {
    const nextNum = expectedV === 1 ? null : expectedV
    if (nextNum === null) {
      // strip a leading "1." if present
      rest = rest.replace(/^\s*1\.\s*/, '')
      expectedV = 2
      continue
    }
    const re = new RegExp(`\\s${nextNum}\\.\\s`)
    const idx = rest.search(re)
    if (idx === -1) {
      parts.push(rest.trim())
      break
    }
    parts.push(rest.slice(0, idx).trim())
    rest = rest.slice(idx).replace(re, '')
    expectedV++
  }
  parts.forEach((p, i) => {
    const c = clean(p)
    if (c) {
      out.push(`\\v ${i + 1} ${c}`)
      totalVerses++
    }
  })
}

writeFileSync(outFile, out.join('\n') + '\n')
console.log(`${bookId}: ${chapters.length} chapters, ${totalVerses} verses → ${outFile}`)
