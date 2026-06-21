import { describe, it, expect } from 'vitest'
import { signManifest, keypairFromSeed } from '@neoark/manifest'
import { RelayPool, MockRelay, publishUseProof } from '@neoark/relay'
import { readPassage, proofsForPassage, translatorStats } from '../src/commands'
import { testCorpus } from './helpers'

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

async function seededPool() {
  const pool = new RelayPool([new MockRelay()])
  let i = 0
  const pub = (book: string, chapter: number, vStart: number, vEnd: number) =>
    publishUseProof(
      { manifest, passage: { book, chapter, verseStart: vStart, verseEnd: vEnd }, trigger: '80pct_visible_30s', preimage: (++i).toString(16).padStart(64, '0'), amount_sat: 10, created_at: 1717545600 + i },
      reader.seckey,
      pool,
    )
  await pub('GEN', 1, 1, 5)
  await pub('GEN', 1, 6, 8)
  await pub('JHN', 3, 16, 16)
  return pool
}

describe('readPassage', () => {
  it('renders the requested reference', () => {
    const out = readPassage(testCorpus(), 'GEN 1:6')
    expect(out).toContain('firmament')
  })
})

describe('proofsForPassage', () => {
  it('returns and formats use-proofs for a passage', async () => {
    const pool = await seededPool()
    const { proofs, text } = await proofsForPassage(testCorpus(), pool, 'GEN 1', 'neoos-en-2026')
    expect(proofs).toHaveLength(2) // both GEN 1 proofs
    expect(text).toContain('Use-proofs for')
    expect(text).toContain('read GEN 1')
  })

  it('narrows to a verse range', async () => {
    const pool = await seededPool()
    const { proofs } = await proofsForPassage(testCorpus(), pool, 'GEN 1:6', 'neoos-en-2026')
    expect(proofs).toHaveLength(1)
  })
})

describe('translatorStats', () => {
  it('aggregates use-proof activity for a translation', async () => {
    const pool = await seededPool()
    const { stats, text } = await translatorStats(pool, 'neoos-en-2026')
    expect(stats.totalProofs).toBe(3)
    expect(stats.totalSats).toBe(30)
    expect(stats.uniquePassages).toBe(3)
    expect(text).toContain('3 use-proofs')
  })

  it('filters by reader pubkey', async () => {
    const pool = await seededPool()
    const mine = await translatorStats(pool, 'neoos-en-2026', { pubkey: reader.pubkey })
    expect(mine.stats.totalProofs).toBe(3)
    const other = await translatorStats(pool, 'neoos-en-2026', { pubkey: 'f'.repeat(64) })
    expect(other.stats.totalProofs).toBe(0)
  })
})
