/**
 * Regenerate fixtures/ — a signed OSV-EN-2025 value manifest and three
 * use-proof events. Deterministic (fixed seeds + timestamps) so re-running
 * produces byte-identical files.
 *
 *   pnpm --filter @neoark/manifest exec tsx scripts/gen-fixtures.ts
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { signManifest, buildUseProof, keypairFromSeed } from '../src/index'
import type { ValueManifest } from '../src/index'

const FIX = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures')

const translator = keypairFromSeed('01'.repeat(32))
const reader = keypairFromSeed('02'.repeat(32))

const manifest: ValueManifest = signManifest(
  {
    version: 'avm-1',
    translation_id: 'osv-en-2025',
    translation_blake3: 'b3:7d3a9f2c1e8b4a6d5f0c2b1a9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d',
    translator_pubkey: translator.pubkey,
    issued_at: '2025-01-01T00:00:00Z',
    stream_rates: {
      chapter_read: { sats: 10, trigger: '80pct_visible_30s' },
      highlight: { sats: 5, trigger: 'user_highlights_verse' },
      citation: { sats: 50, trigger: 'copy_or_share_with_attribution' },
      use_proof: { sats: 100, trigger: 'user_publishes_signed_use' },
    },
    splits: [
      { lightning_address: 'ruiz@strike.me', weight: 70, role: 'translator' },
      { lightning_address: 'review@gtu.edu', weight: 15, role: 'scholarly_review' },
      { lightning_address: 'relay@neoark.io', weight: 10, role: 'relay' },
      { lightning_address: 'dev@neoark.io', weight: 5, role: 'protocol' },
    ],
    fork_policy: {
      allowed: true,
      min_translator_weight: 50,
      must_preserve_roles: ['translator'],
      predecessor_blake3: null,
    },
  },
  translator.seckey,
)

const proofs = [
  buildUseProof(
    {
      manifest,
      passage: { book: 'John', chapter: 3, verseStart: 16, verseEnd: 21 },
      trigger: '80pct_visible_30s',
      preimage: 'a1'.repeat(32),
      amount_sat: 10,
      created_at: 1717545600,
      app: 'neoark-reader/0.3.2',
    },
    reader.seckey,
  ),
  buildUseProof(
    {
      manifest,
      passage: { book: 'Genesis', chapter: 1, verseStart: 1, verseEnd: 1 },
      trigger: 'copy_or_share_with_attribution',
      preimage: 'b2'.repeat(32),
      amount_sat: 50,
      created_at: 1717549200,
      app: 'sermon-notes/1.0',
    },
    reader.seckey,
  ),
  buildUseProof(
    {
      manifest,
      passage: { book: 'Psalm', chapter: 23, verseStart: 1, verseEnd: 6 },
      trigger: 'user_highlights_verse',
      preimage: 'c3'.repeat(32),
      amount_sat: 5,
      created_at: 1717552800,
    },
    reader.seckey,
  ),
]

writeFileSync(resolve(FIX, 'osv-en-2025.manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
writeFileSync(resolve(FIX, 'use-proofs.json'), JSON.stringify(proofs, null, 2) + '\n')
console.log(`Wrote manifest + ${String(proofs.length)} use-proofs to fixtures/`)
console.log(`translator npub-hex: ${translator.pubkey}`)
console.log(`reader npub-hex:     ${reader.pubkey}`)
