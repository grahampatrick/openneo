/**
 * NeoOS corpus verifier — entrypoint.
 *
 *   pnpm --filter @neoark/importer run verify
 *
 * Reads the emitted verses.jsonl, recomputes the BLAKE3 Merkle root purely from
 * the event content + refs, prints it, and checks it matches the root recorded
 * in translation-manifest.json. Also verifies a sample of event signatures and
 * the manifest's own signature. Exits non-zero on any mismatch.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { readFileSync } from 'node:fs'
import { MANIFEST_OUT, VERSES_OUT } from './config'
import { hashCorpus } from './hash'
import { verifyEvent } from './events'
import { verifyValueManifest } from './value-manifest'
import { bookMeta } from './book-order'
import type { ArkEvent, Verse } from './types'

function tagValue(e: ArkEvent, name: string): string | undefined {
  return e.tags.find((t) => t[0] === name)?.[1]
}

/** Reconstruct verses from emitted kind:30700 events. */
function versesFromEvents(events: ArkEvent[]): Verse[] {
  return events.map((e) => {
    const ref = e.tags.find((t) => t[0] === 'ref')
    if (!ref) throw new Error(`Event ${e.id} missing ref tag`)
    const bookId = ref[1]!
    const ch = ref[2]!
    const vs = ref[3]!
    return {
      bookId,
      bookIndex: bookMeta(bookId).index,
      chapter: Number(ch),
      verse: Number(vs),
      text: e.content,
      original: e.content,
      source: tagValue(e, 'src') ?? '',
    }
  })
}

function main(): void {
  const eventLines = readFileSync(VERSES_OUT, 'utf8').split('\n').filter((l) => l.trim())
  const events = eventLines.map((l) => JSON.parse(l) as ArkEvent)
  console.log(`Loaded ${String(events.length)} verse events.`)

  const verses = versesFromEvents(events)
  const { root, verseHashes } = hashCorpus(verses)
  console.log(`Recomputed BLAKE3 root: b3:${root}`)

  // Each event's `h` tag must equal the recomputed verse hash.
  let hMismatch = 0
  for (const e of events) {
    const ref = e.tags.find((t) => t[0] === 'ref')!
    const key = `${ref[1]!} ${ref[2]!}:${ref[3]!}`
    if (tagValue(e, 'h') !== verseHashes.get(key)) hMismatch++
  }

  const manifestEvent = JSON.parse(readFileSync(MANIFEST_OUT, 'utf8')) as ArkEvent
  const manifestContent = JSON.parse(manifestEvent.content) as {
    root: string
    verse_count: number
    value_manifest: Parameters<typeof verifyValueManifest>[0]
  }
  const manifestRoot = manifestContent.root.replace(/^b3:/, '')

  // Signature checks: manifest event, value manifest, and a sample of verses.
  const manifestSigOk = verifyEvent(manifestEvent)
  const valueSigOk = verifyValueManifest(manifestContent.value_manifest)
  const sampleIdx = [0, Math.floor(events.length / 2), events.length - 1]
  const sampleSigOk = sampleIdx.every((i) => verifyEvent(events[i]!))

  const rootMatch = root === manifestRoot
  const countMatch = manifestContent.verse_count === events.length

  console.log('')
  console.log(`  root matches manifest .......... ${rootMatch ? 'OK' : 'FAIL'}`)
  console.log(`  verse count matches manifest ... ${countMatch ? 'OK' : 'FAIL'} (${String(events.length)})`)
  console.log(`  per-verse h tags ............... ${hMismatch === 0 ? 'OK' : `FAIL (${String(hMismatch)})`}`)
  console.log(`  manifest signature ............. ${manifestSigOk ? 'OK' : 'FAIL'}`)
  console.log(`  value-manifest signature ....... ${valueSigOk ? 'OK' : 'FAIL'}`)
  console.log(`  sample verse signatures ........ ${sampleSigOk ? 'OK' : 'FAIL'}`)

  const ok = rootMatch && countMatch && hMismatch === 0 && manifestSigOk && valueSigOk && sampleSigOk
  if (!ok) {
    console.error('\nVERIFY FAILED')
    process.exit(1)
  }
  console.log('\nVERIFY OK')
}

main()
