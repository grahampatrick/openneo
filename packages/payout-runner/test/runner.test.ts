import { describe, it, expect } from 'vitest'
import { PayoutRunner } from '../src/runner'
import { MemoryPaidStore } from '../src/paid-store'
import { keypairFromSeed } from '@neoark/manifest'
import { RelayPool, MockRelay } from '@neoark/relay'
import {
  submitProposal,
  parseProposal,
  submitReview,
  parseReview,
  mergeProposal,
  signGovernance,
} from '@neoark/translation-protocol'
import { createTreasury, MemoryProfileRegistry } from '@neoark/payouts'
import { KIND_PAYOUT } from '@neoark/translator-payments'
import type { Wallet, resolveLnurlPay } from '@neoark/payer'

const TID = 'neoos-en-2026'
const translator = keypairFromSeed('a1'.repeat(32))
const m1 = keypairFromSeed('b1'.repeat(32))
const m2 = keypairFromSeed('b2'.repeat(32))
const m3 = keypairFromSeed('b3'.repeat(32))
const payer = keypairFromSeed('dd'.repeat(32))
const council = [m1.pubkey, m2.pubkey, m3.pubkey]

const okWallet = (): Wallet => ({ payInvoice: () => Promise.resolve({ preimage: 'ab'.repeat(32) }) })
const resolveInvoice: typeof resolveLnurlPay = (ln, sats) =>
  Promise.resolve({ invoice: `lnbc-${ln}`, decoded: { paymentHash: 'cd'.repeat(32), amountSat: sats } })

/** Seed a governed translation with a quorum-met, council-merged proposal. */
async function seed(pool: RelayPool, opts: { merger?: typeof m1 } = {}) {
  await pool.publish(signGovernance({ translationId: TID, maintainers: council, quorum: { minReviewers: 3, approvalThreshold: 0.67 }, createdAt: 1 }, m1.seckey))
  const pe = submitProposal({ ref: { translationId: TID, book: 'GEN', chapter: 1, verse: 6 }, newText: 'a firmament', rationale: 'raqia', createdAt: 10 }, translator.seckey)
  await pool.publish(pe)
  const proposal = parseProposal(pe)
  const reviews = [m1, m2, m3].map((k, i) => parseReview(submitReview({ proposalId: proposal.id, vote: 'approve', comment: '', createdAt: 20 + i }, k.seckey)))
  for (const r of reviews) await pool.publish(r.event)
  const merger = opts.merger ?? m1
  const merge = mergeProposal(proposal, reviews, merger.seckey, 100, { maintainers: council, mergerPubkey: merger.pubkey })
  await pool.publish(merge.event)
  return { proposalId: proposal.id, mergeId: merge.event.id }
}

function runner(pool: RelayPool, profiles: MemoryProfileRegistry, treasurySats = 10000, paidStore = new MemoryPaidStore(), wallet: Wallet = okWallet()) {
  return new PayoutRunner({
    wallet,
    fetchJson: () => Promise.reject(new Error('off')),
    payerSeckey: payer.seckey,
    treasury: createTreasury(treasurySats),
    profiles,
    pool,
    paidStore,
    resolveInvoice,
  })
}

/** Everyone (translator + 3 maintainers) has a Lightning address. */
function allProfiles(): MemoryProfileRegistry {
  const p = new MemoryProfileRegistry()
  p.set(translator.pubkey, 'translator@x.io')
  for (const k of [m1, m2, m3]) p.set(k.pubkey, `${k.pubkey.slice(0, 4)}@x.io`)
  return p
}

describe('PayoutRunner.processGovernedMerges', () => {
  it('split-pays a governed merge: translator 70% + reviewers split 20%, publishes receipts', async () => {
    const pool = new RelayPool([new MockRelay()])
    const { mergeId } = await seed(pool)
    const run = runner(pool, allProfiles())
    const out = await run.processGovernedMerges(TID)

    expect(out).toHaveLength(1)
    expect(out[0]!.governed).toBe(true)
    const recips = out[0]!.recipients
    const translatorPay = recips.find((r) => r.role === 'translator')
    const reviewerPays = recips.filter((r) => r.role === 'reviewer')
    // 500 total: translator 70% + folded 10% submitter = 400; reviewers 20% = 100 / 3 = 33 each
    expect(translatorPay?.sats).toBe(500 - reviewerPays.reduce((a, r) => a + r.sats, 0))
    expect(reviewerPays).toHaveLength(3)
    expect(recips.every((r) => r.paid)).toBe(true)
    // a kind:30712 receipt per recipient
    const receipts = await pool.query({ kinds: [KIND_PAYOUT] })
    expect(receipts.length).toBe(recips.length)
    void mergeId
  })

  it('NEVER pays an ungoverned translation (no council)', async () => {
    const pool = new RelayPool([new MockRelay()])
    // a merge with NO governance event published
    const pe = submitProposal({ ref: { translationId: TID, book: 'GEN', chapter: 1, verse: 6 }, newText: 'x', rationale: 'r', createdAt: 10 }, translator.seckey)
    await pool.publish(pe)
    const proposal = parseProposal(pe)
    const reviews = [m1, m2, m3].map((k, i) => parseReview(submitReview({ proposalId: proposal.id, vote: 'approve', comment: '', createdAt: 20 + i }, k.seckey)))
    const merge = mergeProposal(proposal, reviews, m1.seckey, 100)
    await pool.publish(merge.event)
    const out = await runner(pool, allProfiles()).processGovernedMerges(TID)
    expect(out).toHaveLength(0) // ungoverned → nothing paid
  })

  it('skips a validly-signed merge by a non-maintainer (council check)', async () => {
    const pool = new RelayPool([new MockRelay()])
    const outsider = keypairFromSeed('99'.repeat(32))
    await pool.publish(signGovernance({ translationId: TID, maintainers: council, createdAt: 1 }, m1.seckey))
    const pe = submitProposal({ ref: { translationId: TID, book: 'GEN', chapter: 1, verse: 6 }, newText: 'x', rationale: 'r', createdAt: 10 }, translator.seckey)
    await pool.publish(pe)
    const proposal = parseProposal(pe)
    const reviews = [m1, m2, m3].map((k, i) => parseReview(submitReview({ proposalId: proposal.id, vote: 'approve', comment: '', createdAt: 20 + i }, k.seckey)))
    // outsider signs a real (validly-signed) merge — no governance gate at sign time
    const merge = mergeProposal(proposal, reviews, outsider.seckey, 100)
    await pool.publish(merge.event)
    const out = await runner(pool, allProfiles()).processGovernedMerges(TID)
    const result = out.find((o) => o.mergeEventId === merge.event.id)
    expect(result?.governed).toBe(false)
    expect(result?.reason).toMatch(/not signed by a council maintainer/)
  })

  it('reports a payment failure and un-reserves it for retry', async () => {
    const pool = new RelayPool([new MockRelay()])
    await seed(pool)
    const failWallet: Wallet = { payInvoice: () => Promise.reject(new Error('boom')) }
    const store = new MemoryPaidStore()
    const out = await runner(pool, allProfiles(), 10000, store, failWallet).processGovernedMerges(TID)
    const recips = out[0]!.recipients
    expect(recips.every((r) => !r.paid)).toBe(true)
    expect(recips.some((r) => r.reason.includes('payment failed'))).toBe(true)
    // a retry with a working wallet now succeeds (the reservation was undone)
    const retry = await runner(pool, allProfiles(), 10000, store).processGovernedMerges(TID)
    expect(retry[0]!.recipients.some((r) => r.paid)).toBe(true)
  })

  it('is idempotent — a second run pays no one again', async () => {
    const pool = new RelayPool([new MockRelay()])
    await seed(pool)
    const store = new MemoryPaidStore()
    const run = runner(pool, allProfiles(), 10000, store)
    const first = await run.processGovernedMerges(TID)
    const firstPaid = first[0]!.recipients.filter((r) => r.paid).length
    expect(firstPaid).toBeGreaterThan(0)
    const balanceAfter = run.treasuryBalance
    const second = await run.processGovernedMerges(TID)
    expect(second[0]!.recipients.every((r) => !r.paid)).toBe(true)
    expect(run.treasuryBalance).toBe(balanceAfter) // unchanged
  })

  it('is restart-safe — a fresh runner over the same paid store does not re-pay', async () => {
    const pool = new RelayPool([new MockRelay()])
    await seed(pool)
    const store = new MemoryPaidStore()
    await runner(pool, allProfiles(), 10000, store).processGovernedMerges(TID)
    // simulate a restart: new runner, same persistent store
    const out2 = await runner(pool, allProfiles(), 10000, store).processGovernedMerges(TID)
    expect(out2[0]!.recipients.every((r) => !r.paid)).toBe(true)
  })

  it('skips a recipient with no Lightning address (no silent reallocation)', async () => {
    const pool = new RelayPool([new MockRelay()])
    await seed(pool)
    const profiles = new MemoryProfileRegistry().set(translator.pubkey, 'translator@x.io') // reviewers have none
    const out = await runner(pool, profiles).processGovernedMerges(TID)
    const recips = out[0]!.recipients
    expect(recips.find((r) => r.role === 'translator')?.paid).toBe(true)
    expect(recips.filter((r) => r.role === 'reviewer').every((r) => !r.paid && r.reason.includes('no Lightning address'))).toBe(true)
  })
})
