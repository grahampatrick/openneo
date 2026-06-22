/**
 * Split the monolithic verses.jsonl (28.5 MB) into small per-book JSON files so
 * the translator's verse picker fetches one book (~KBs) instead of the whole
 * corpus. Run at build time; output is gitignored.
 *
 *   node scripts/split-corpus.mjs
 *
 * Writes:
 *   apps/reader/static/corpus/books/<BOOK>.json   { "<chapter>": { "<verse>": "text" } }
 *   apps/reader/static/corpus/available-books.json ["GEN","EXO",…]
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const dir = 'apps/reader/static/corpus'
const booksDir = `${dir}/books`

const lines = readFileSync(`${dir}/verses.jsonl`, 'utf8').split('\n')
const books = {}
let verses = 0
for (const line of lines) {
  if (!line.trim()) continue
  const event = JSON.parse(line)
  const ref = event.tags.find((t) => t[0] === 'ref')
  if (!ref) continue
  const [, book, ch, v] = ref
  ;((books[book] ??= {})[ch] ??= {})[v] = event.content
  verses++
}

mkdirSync(booksDir, { recursive: true })
const ids = Object.keys(books)
for (const id of ids) writeFileSync(`${booksDir}/${id}.json`, JSON.stringify(books[id]))
writeFileSync(`${dir}/available-books.json`, JSON.stringify(ids))

console.log(`split ${String(verses)} verses → ${String(ids.length)} per-book files in ${booksDir}`)
