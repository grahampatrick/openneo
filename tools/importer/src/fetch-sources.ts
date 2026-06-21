/**
 * Fetch + cache source texts into sources/raw/ for reproducible imports.
 *
 *   pnpm --filter @neoark/importer run fetch
 *
 * Only first-party / canonical public-domain sources are used — no third-party
 * Bible APIs. The BSB is pulled directly from bereanbible.com. Apocrypha and
 * pseudepigrapha (Enoch, Jubilees) are dropped into sources/raw/extra/ as USFM
 * by hand or by extending SOURCES below, so their provenance stays explicit.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { RAW_DIR } from './config'

interface Source {
  url: string
  /** Destination filename under sources/raw/. */
  file: string
  minBytes: number
}

const SOURCES: Source[] = [
  {
    url: 'https://bereanbible.com/bsb.txt',
    file: 'bsb.txt',
    minBytes: 4_000_000,
  },
]

async function fetchOne(s: Source): Promise<void> {
  const dest = resolve(RAW_DIR, s.file)
  if (existsSync(dest)) {
    console.log(`  ${s.file}: already cached`)
    return
  }
  console.log(`  fetching ${s.url}`)
  const res = await fetch(s.url)
  if (!res.ok) throw new Error(`${s.url} → HTTP ${String(res.status)}`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.byteLength < s.minBytes) {
    throw new Error(`${s.file} too small (${String(buf.byteLength)} bytes)`)
  }
  writeFileSync(dest, buf)
  console.log(`  wrote ${s.file} (${String(buf.byteLength)} bytes)`)
}

async function main(): Promise<void> {
  mkdirSync(RAW_DIR, { recursive: true })
  mkdirSync(resolve(RAW_DIR, 'extra'), { recursive: true })
  for (const s of SOURCES) await fetchOne(s)
  console.log('Done. Place apocrypha / Enoch / Jubilees USFM in sources/raw/extra/<BOOKID>.usfm')
}

await main()
