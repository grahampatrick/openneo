/**
 * @neoark/relay demo — publish → query → verify a use-proof over a relay pool.
 *
 *   pnpm --filter @neoark/relay run demo
 *
 * Uses in-memory MockRelays (no network). The same API drives real relays by
 * swapping in WebSocketRelay(DEFAULT_RELAYS[i], wsFactory).
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { RelayPool, MockRelay, publishUseProof, queryUseProofs } from './src/index'
import { signManifest, keypairFromSeed, verifyUseProof } from '@neoark/manifest'

const reader = keypairFromSeed('22'.repeat(32))
const translator = keypairFromSeed('11'.repeat(32))

const manifest = signManifest(
  {
    version: 'avm-1',
    translation_id: 'osv-en-2025',
    translation_blake3: 'b3:' + 'a'.repeat(64),
    translator_pubkey: translator.pubkey,
    issued_at: '2025-01-01T00:00:00Z',
    stream_rates: { chapter_read: { sats: 10, trigger: '80pct_visible_30s' } },
    splits: [{ lightning_address: 'ruiz@strike.me', weight: 100, role: 'translator' }],
    fork_policy: { allowed: true, predecessor_blake3: null },
  },
  translator.seckey,
)

const log = (s: string): void => {
  console.log(s)
}

const main = async (): Promise<void> => {
  const pool = new RelayPool([new MockRelay({ url: 'mock://a' }), new MockRelay({ url: 'mock://b' })])

  log('1. Publish a use-proof for John 3:16-21 to 2 relays')
  const { event, acks } = await publishUseProof(
    {
      manifest,
      passage: { book: 'John', chapter: 3, verseStart: 16, verseEnd: 21 },
      trigger: '80pct_visible_30s',
      preimage: 'a1'.repeat(32),
      amount_sat: 10,
      created_at: 1_717_545_600,
    },
    reader.seckey,
    pool,
  )
  log(`   event ${event.id.slice(0, 12)}… → acks: ${acks.map((a) => `${a.relay}:${String(a.ok)}`).join('  ')}`)

  log('\n2. "Where is this verse used?" — query John 3')
  const found = await queryUseProofs({ translationId: 'osv-en-2025', passage: { book: 'John', chapter: 3 } }, pool)
  log(`   found ${String(found.length)} use-proof(s) (de-duplicated across relays)`)

  log('\n3. Verify the returned proof against the manifest')
  const first = found[0]
  if (first) log(`   verifyUseProof → ${JSON.stringify(verifyUseProof(first.event, manifest))}`)

  log('\n4. A query for a different passage returns nothing')
  const none = await queryUseProofs({ translationId: 'osv-en-2025', passage: { book: 'Romans' } }, pool)
  log(`   Romans query → ${String(none.length)} proofs`)

  pool.close()
  log('\nDone.')
}

await main()
