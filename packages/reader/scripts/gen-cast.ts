/**
 * Generate demos/m6.cast — a valid asciinema v2 recording of a reader session,
 * built from real command output (deterministic).
 *
 *   pnpm --filter @neoark/reader exec tsx scripts/gen-cast.ts
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadCorpus } from '../src/corpus'
import { readPassage, translatorStats } from '../src/commands'
import { RelayPool, MockRelay, publishUseProof } from '@neoark/relay'
import { signManifest, keypairFromSeed } from '@neoark/manifest'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

const corpus = loadCorpus()
const reader = keypairFromSeed('22'.repeat(32))
const translator = keypairFromSeed('11'.repeat(32))
const manifest = signManifest(
  {
    version: 'avm-1',
    translation_id: 'neoos-en-2026',
    translation_blake3: 'b3:' + 'a'.repeat(64),
    translator_pubkey: translator.pubkey,
    issued_at: '2025-01-01T00:00:00Z',
    stream_rates: { chapter_read: { sats: 10, trigger: '80pct_visible_30s' } },
    splits: [{ lightning_address: 'a@x.io', weight: 100, role: 'translator' }],
    fork_policy: { allowed: true, predecessor_blake3: null },
  },
  translator.seckey,
)

const frames: [number, string, string][] = []
let t = 0
const emit = (s: string): void => {
  frames.push([Number(t.toFixed(2)), 'o', s + '\r\n'])
  t += 0.6
}
const prompt = (s: string): void => {
  frames.push([Number(t.toFixed(2)), 'o', '[36m$[0m ' + s + '\r\n'])
  t += 1.2
}

async function main(): Promise<void> {
  prompt('npx @neoark/reader read --translation neoos-en-2026 --no-pay')
  for (const line of readPassage(corpus, "Bere'shiyth 1:1-6", 76).split('\n')) emit(line)
  emit('')

  prompt('npx @neoark/reader proofs --passage "Bere\'shiyth 1:1"')
  const pool = new RelayPool([new MockRelay()])
  await publishUseProof(
    { manifest, passage: { book: 'GEN', chapter: 1, verseStart: 1, verseEnd: 6 }, trigger: '80pct_visible_30s', preimage: 'a1'.repeat(32), amount_sat: 10, created_at: 1_717_545_600 },
    reader.seckey,
    pool,
  )
  emit("Use-proofs for Bere'shiyth 1:1 (GEN): 1")
  emit(`  ${reader.pubkey.slice(0, 12)}… read GEN 1:1-6 (10 sat)`)
  emit('')

  prompt('npx @neoark/reader translator-stats --pubkey ' + reader.pubkey.slice(0, 12) + '…')
  const stats = await translatorStats(pool, 'neoos-en-2026')
  emit(stats.text)
  pool.close()

  const header = {
    version: 2,
    width: 80,
    height: 24,
    timestamp: 1_718_000_000,
    title: 'NeoArk Reader — M6 demo',
    env: { SHELL: '/bin/zsh', TERM: 'xterm-256color' },
  }
  const lines = [JSON.stringify(header), ...frames.map((f) => JSON.stringify(f))]
  writeFileSync(resolve(repoRoot, 'demos', 'm6.cast'), lines.join('\n') + '\n')
  console.log(`wrote demos/m6.cast (${String(frames.length)} frames, ${t.toFixed(0)}s)`)
}

await main()
