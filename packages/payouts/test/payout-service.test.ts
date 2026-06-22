import { describe, it, expect } from 'vitest'
import { PayoutService } from '../src/payout-service'
import { createTreasury } from '../src/treasury'
import { MemoryProfileRegistry } from '../src/profiles'
import { keypairFromSeed } from '@neoark/manifest'
import { RelayPool, MockRelay } from '@neoark/relay'
import { submitProposal, parseProposal, submitReview, parseReview, mergeProposal } from '@neoark/translation-protocol'
import { KIND_PAYOUT } from '@neoark/translator-payments'
import type { Wallet, resolveLnurlPay } from '@neoark/payer'

const author = keypairFromSeed('a1'.repeat(32))
const reviewers = ['b1', 'b2', 'b3'].map((s) => keypairFromSeed(s.repeat(32)))
const maintainer = keypairFromSeed('cc'.repeat(32))
const payer = keypairFromSeed('dd'.repeat(32))

const okWallet = (): Wallet => ({ payInvoice: () => Promise.resolve({ preimage: 'ab'.repeat(32) }) })
const resolveInvoice: typeof resolveLnurlPay = (ln, sats) =>
  Promise.resolve({ invoice: `lnbc-${ln}`, decoded: { paymentHash: 'cd'.repeat(32), amountSat: sats } })

async function seedMerge(pool: RelayPool, verse = 6, createdAt = 100) {
  const pe = submitProposal({ ref: { translationId: 'neoos-en-2026', book: 'GEN', chapter: 1, verse }, newText: 'a firmament', rationale: 'raqia', createdAt }, author.seckey)
  await pool.publish(pe)
  const proposal = parseProposal(pe)
  const reviews = reviewers.map((r, i) => parseReview(submitReview({ proposalId: proposal.id, vote: 'approve', comment: '', createdAt: createdAt + i + 1 }, r.seckey)))
  const merge = mergeProposal(proposal, reviews, maintainer.seckey, createdAt + 10)
  await pool.publish(merge.event)
  return { mergeEventId: merge.event.id }
}

function service(pool: RelayPool, balance = 1000, profiles = new MemoryProfileRegistry().set(author.pubkey, 'translator@strike.me')) {
  return new PayoutService({
    wallet: okWallet(),
    fetchJson: () => Promise.reject(new Error('off')),
    payerSeckey: payer.seckey,
    treasury: createTreasury(balance),
    profiles,
    pool,
    resolveInvoice,
  })
}

describe('PayoutService.processMerges', () => {
  it('pays the translator on merge, publishes a kind:30712 receipt, debits treasury', async () => {
    const pool = new RelayPool([new MockRelay()])
    await seedMerge(pool)
    const svc = service(pool)
    const out = await svc.processMerges('neoos-en-2026')
    expect(out).toHaveLength(1)
    expect(out[0]!.paid).toBe(true)
    expect(out[0]!.amountSat).toBe(500)
    expect(out[0]!.receipt?.recipient).toBe('translator@strike.me')
    expect(out[0]!.record?.kind).toBe(KIND_PAYOUT)
    expect(svc.treasuryBalance).toBe(500)
  })

  it('is idempotent — a second run does not pay again', async () => {
    const pool = new RelayPool([new MockRelay()])
    await seedMerge(pool)
    const svc = service(pool)
    await svc.processMerges('neoos-en-2026')
    const again = await svc.processMerges('neoos-en-2026')
    expect(again[0]!.paid).toBe(false)
    expect(again[0]!.reason).toMatch(/already paid/)
    expect(svc.treasuryBalance).toBe(500)
  })

  it('skips when the translator has no Lightning address', async () => {
    const pool = new RelayPool([new MockRelay()])
    await seedMerge(pool)
    const svc = service(pool, 1000, new MemoryProfileRegistry()) // no profile
    const out = await svc.processMerges('neoos-en-2026')
    expect(out[0]!.paid).toBe(false)
    expect(out[0]!.reason).toMatch(/no Lightning address/)
  })

  it('skips when the treasury is insufficient', async () => {
    const pool = new RelayPool([new MockRelay()])
    await seedMerge(pool)
    const svc = service(pool, 100) // < 500
    const out = await svc.processMerges('neoos-en-2026')
    expect(out[0]!.paid).toBe(false)
    expect(out[0]!.reason).toMatch(/insufficient/)
  })

  it('ignores merges for other translations', async () => {
    const pool = new RelayPool([new MockRelay()])
    await seedMerge(pool)
    const svc = service(pool)
    expect(await svc.processMerges('web-en-2020')).toHaveLength(0)
  })

  it('pays multiple distinct merges', async () => {
    const pool = new RelayPool([new MockRelay()])
    await seedMerge(pool, 6, 100)
    await seedMerge(pool, 7, 200)
    const svc = service(pool)
    const out = await svc.processMerges('neoos-en-2026')
    expect(out.filter((o) => o.paid)).toHaveLength(2)
    expect(svc.treasuryBalance).toBe(0)
  })
})

describe('PayoutService.payoutForMerge', () => {
  it('un-reserves on payment failure so it can retry', async () => {
    const pool = new RelayPool([new MockRelay()])
    let calls = 0
    const flaky: Wallet = {
      payInvoice: () => {
        calls++
        return calls === 1 ? Promise.reject(new Error('no route')) : Promise.resolve({ preimage: 'ab'.repeat(32) })
      },
    }
    const svc = new PayoutService({
      wallet: flaky,
      fetchJson: () => Promise.reject(new Error('off')),
      payerSeckey: payer.seckey,
      treasury: createTreasury(1000),
      profiles: new MemoryProfileRegistry().set(author.pubkey, 'translator@strike.me'),
      pool,
      resolveInvoice,
    })
    const merge = { mergeEventId: 'm1', translatorPubkey: author.pubkey, createdAt: 1 }
    const first = await svc.payoutForMerge(merge)
    expect(first.paid).toBe(false)
    expect(first.reason).toMatch(/payment failed/)
    const second = await svc.payoutForMerge(merge) // retry succeeds
    expect(second.paid).toBe(true)
    expect(svc.treasuryBalance).toBe(500)
  })

  it('publishes the receipt where a relay query can find it', async () => {
    const pool = new RelayPool([new MockRelay({ verify: false })])
    const svc = service(pool)
    await svc.payoutForMerge({ mergeEventId: 'm9', translatorPubkey: author.pubkey, createdAt: 1 })
    const events = await pool.query({ kinds: [KIND_PAYOUT] })
    expect(events).toHaveLength(1)
  })
})
