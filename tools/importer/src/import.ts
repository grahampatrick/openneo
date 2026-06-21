/**
 * NeoOS corpus importer — entrypoint.
 *
 *   pnpm --filter @neoark/importer run import
 *
 * Loads all source texts, applies the naming map, content-addresses every
 * verse with BLAKE3, signs each verse as a kind:30700 ARK event, and writes:
 *   data/neoos/verses.jsonl              — one signed verse event per line
 *   data/neoos/translation-manifest.json — signed kind:30701 manifest
 *   data/neoos/accuracy-corrections.json — naming-map audit trail
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { writeFileSync } from 'node:fs'
import {
  ACCURACY_PATH,
  BSB_ATTRIBUTION,
  CREATED_AT,
  MANIFEST_OUT,
  TEXT_LICENSE,
  TRANSLATION_ID,
  TRANSLATION_NAME,
  VERSES_OUT,
} from './config'
import { buildCorpus } from './corpus'
import { hashCorpus } from './hash'
import { loadNeoosKey } from './keys'
import { buildManifestEvent, buildVerseEvent } from './events'
import { buildValueManifest } from './value-manifest'
import { writeAccuracyAudit } from './accuracy'

function main(): void {
  const t0 = Date.now()
  console.log('NeoOS importer — building corpus…')

  const { verses, changed, bySource } = buildCorpus()
  console.log(`  parsed ${String(verses.length)} verses from ${String(Object.keys(bySource).length)} source(s)`)
  for (const [src, n] of Object.entries(bySource)) console.log(`    ${src}: ${String(n)}`)
  console.log(`  naming map changed ${String(changed)} verses`)

  const hashes = hashCorpus(verses)
  console.log(`  BLAKE3 root: b3:${hashes.root}`)

  const key = loadNeoosKey()
  if (key.isDev) {
    console.log(`  signing with DEV key ${key.pubkey.slice(0, 16)}… (set NEOOS_SECKEY for release)`)
  } else {
    console.log(`  signing with key ${key.pubkey.slice(0, 16)}…`)
  }

  // Verse events → verses.jsonl
  const lines: string[] = []
  for (const v of verses) {
    const h = hashes.verseHashes.get(`${v.bookId} ${String(v.chapter)}:${String(v.verse)}`)!
    lines.push(JSON.stringify(buildVerseEvent(v, h, key)))
  }
  writeFileSync(VERSES_OUT, lines.join('\n') + '\n')
  console.log(`  wrote ${String(lines.length)} events → ${VERSES_OUT}`)

  // Translation manifest (kind:30701) with embedded value manifest.
  const valueManifest = buildValueManifest(hashes.root, key)
  const manifestContent = {
    id: TRANSLATION_ID,
    name: TRANSLATION_NAME,
    license: TEXT_LICENSE,
    attribution: BSB_ATTRIBUTION,
    lang: 'eng',
    created_at: CREATED_AT,
    algo: 'blake3',
    root: `b3:${hashes.root}`,
    book_count: hashes.books.length,
    verse_count: hashes.verseCount,
    naming_map_version: 'neoos-naming-1',
    canon: hashes.books.map((b) => ({
      index: b.index,
      id: b.id,
      english: b.english,
      hebrew: b.hebrew,
      source: b.source,
      chapters: b.chapters,
      verses: b.verses,
      hash: `b3:${b.hash}`,
    })),
    value_manifest: valueManifest,
  }
  const manifestEvent = buildManifestEvent(key, hashes.root, JSON.stringify(manifestContent))
  writeFileSync(MANIFEST_OUT, JSON.stringify(manifestEvent, null, 2) + '\n')
  console.log(`  wrote manifest → ${MANIFEST_OUT}`)

  // Accuracy / naming audit trail.
  const audit = writeAccuracyAudit(verses, ACCURACY_PATH)
  console.log(`  wrote accuracy audit (${String(audit.applied_rules)} rules) → ${ACCURACY_PATH}`)

  console.log(`Done in ${((Date.now() - t0) / 1000).toFixed(1)}s.`)
}

main()
