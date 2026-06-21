/**
 * @neoark/manifest demo — sign → verify → use-proof round trip.
 *
 *   pnpm --filter @neoark/manifest run demo
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import {
  signManifest,
  verifyManifest,
  parseManifest,
  buildUseProof,
  verifyUseProof,
  parseUseProof,
  keypairFromSeed,
} from './src/index'

function line(label: string, value: unknown): void {
  console.log(`  ${label.padEnd(28)} ${String(value)}`)
}

const translator = keypairFromSeed('01'.repeat(32))
const reader = keypairFromSeed('02'.repeat(32))

console.log('\n1. Sign a value manifest (AVM-1)')
const manifest = signManifest(
  {
    version: 'avm-1',
    translation_id: 'osv-en-2025',
    translation_blake3: 'b3:' + '7d3a9f2c1e8b4a6d5f0c2b1a9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d',
    translator_pubkey: translator.pubkey,
    issued_at: '2025-01-01T00:00:00Z',
    stream_rates: {
      chapter_read: { sats: 10, trigger: '80pct_visible_30s' },
      citation: { sats: 50, trigger: 'copy_or_share_with_attribution' },
    },
    splits: [
      { lightning_address: 'ruiz@strike.me', weight: 70, role: 'translator' },
      { lightning_address: 'review@gtu.edu', weight: 20, role: 'scholarly_review' },
      { lightning_address: 'dev@neoark.io', weight: 10, role: 'protocol' },
    ],
    fork_policy: { allowed: true, min_translator_weight: 50, predecessor_blake3: null },
  },
  translator.seckey,
)
line('translator pubkey', manifest.translator_pubkey.slice(0, 16) + '…')
line('signature', manifest.signature.slice(0, 16) + '…')

console.log('\n2. Verify it (and survive a JSON round-trip / key reorder)')
line('verifyManifest', JSON.stringify(verifyManifest(manifest)))
const roundTripped = parseManifest(JSON.parse(JSON.stringify(manifest)))
line('after JSON round-trip', JSON.stringify(verifyManifest(roundTripped)))

console.log('\n3. Tamper detection')
const tampered = { ...manifest, splits: manifest.splits.map((s, i) => (i === 0 ? { ...s, lightning_address: 'attacker@evil.io' } : s)) }
line('verifyManifest(tampered)', JSON.stringify(verifyManifest(tampered)))

console.log('\n4. Reader emits a use-proof (UP-1) anchored to a Lightning payment')
const proof = buildUseProof(
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
)
const parsed = parseUseProof(proof)
line('reader pubkey', proof.pubkey.slice(0, 16) + '…')
line('passage', `${parsed.passage.book} ${String(parsed.passage.chapter)}:${String(parsed.passage.verseStart)}-${String(parsed.passage.verseEnd)}`)
line('amount_sat', parsed.amount_sat)

console.log('\n5. Verify the use-proof against the manifest')
line('verifyUseProof', JSON.stringify(verifyUseProof(proof, manifest)))

console.log('\n6. Reject a forged amount')
const forged = { ...proof, tags: proof.tags.map((t) => (t[0] === 'amount_sat' ? ['amount_sat', '9999'] : t)) }
line('verifyUseProof(forged)', JSON.stringify(verifyUseProof(forged, manifest)))

console.log('\nDone.\n')
