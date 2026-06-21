import { describe, it, expect } from 'vitest'
import { signManifest, keypairFromSeed } from '@neoark/manifest'
import type { ValueManifest } from '@neoark/manifest'
import { ArkPayer, MemoryBudgetStore } from '@neoark/payer'
import type { InvoiceResolver } from '@neoark/payer'
import { RelayPool, MockRelay, queryUseProofs } from '@neoark/relay'
import { ReaderSession } from '../src/session'

const reader = keypairFromSeed('22'.repeat(32))
const translator = keypairFromSeed('11'.repeat(32))

const manifest: ValueManifest = signManifest(
  {
    version: 'avm-1',
    translation_id: 'neoos-en-2026',
    translation_blake3: 'b3:' + 'a'.repeat(64),
    translator_pubkey: translator.pubkey,
    issued_at: '2025-01-01T00:00:00Z',
    stream_rates: { chapter_read: { sats: 10, trigger: '80pct_visible_30s' } },
    splits: [
      { lightning_address: 'translator@x.io', weight: 70, role: 'translator' },
      { lightning_address: 'dev@x.io', weight: 30, role: 'protocol' },
    ],
    fork_policy: { allowed: true, predecessor_blake3: null },
  },
  translator.seckey,
)

const fakeResolver: InvoiceResolver = (lnAddress, amountSat) =>
  Promise.resolve({ invoice: `inv-${lnAddress}`, decoded: { paymentHash: 'cd'.repeat(32), amountSat } })

function payingSession(pool: RelayPool) {
  const payer = new ArkPayer({
    wallet: { payInvoice: () => Promise.resolve({ preimage: 'ab'.repeat(32) }) },
    budgetStore: new MemoryBudgetStore(),
    fetchJson: () => Promise.reject(new Error('off')),
    monthlyBudgetSats: 1000,
    resolveInvoice: fakeResolver,
    now: () => new Date('2026-06-15T00:00:00Z'),
  })
  return new ReaderSession({ manifest, budgetSats: 1000, payer, pool, readerPrivKey: reader.seckey, now: () => 1717545600, app: 'neoark-reader/test' })
}

describe('ReaderSession', () => {
  it('renders only (no pay/publish) in --no-pay mode', async () => {
    const session = new ReaderSession({ manifest, budgetSats: 1000, noPay: true })
    const out = await session.onChapterRead({ bookId: 'GEN', chapter: 1 })
    expect(out).toEqual({ paidSats: 0, proofPublished: false, failures: [] })
    expect(session.status.spentSats).toBe(0)
  })

  it('pays splits and publishes a use-proof on a qualifying read', async () => {
    const pool = new RelayPool([new MockRelay()])
    const session = payingSession(pool)
    const out = await session.onChapterRead({ bookId: 'GEN', chapter: 1 })
    expect(out.paidSats).toBe(10)
    expect(out.proofPublished).toBe(true)
    expect(session.status.spentSats).toBe(10)
    expect(session.status.proofsPublished).toBe(1)
    expect(session.status.lastPaidTranslator).toBe('translator@x.io')
    const found = await queryUseProofs({ translationId: 'neoos-en-2026' }, pool)
    expect(found).toHaveLength(1)
  })

  it('bills each chapter only once', async () => {
    const pool = new RelayPool([new MockRelay()])
    const session = payingSession(pool)
    await session.onChapterRead({ bookId: 'GEN', chapter: 1 })
    const second = await session.onChapterRead({ bookId: 'GEN', chapter: 1 })
    expect(second.paidSats).toBe(0)
    expect(session.status.proofsPublished).toBe(1)
  })

  it('requires payer/pool/key when paying', async () => {
    const session = new ReaderSession({ manifest, budgetSats: 1000 })
    await expect(session.onChapterRead({ bookId: 'GEN', chapter: 1 })).rejects.toThrow(/requires payer/)
  })
})
