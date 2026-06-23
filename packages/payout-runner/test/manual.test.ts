import { describe, it, expect } from 'vitest'
import { ManualPayouts } from '../src/manual'
import { MemoryPaidStore } from '../src/paid-store'
import { keypairFromSeed } from '@neoark/manifest'
import { RelayPool, MockRelay } from '@neoark/relay'
import { submitProposal, parseProposal, submitReview, parseReview, mergeProposal, signGovernance } from '@neoark/translation-protocol'
import { MemoryProfileRegistry } from '@neoark/payouts'
import { KIND_PAYOUT } from '@neoark/translator-payments'

const TID = 'neoos-en-2026'
const translator = keypairFromSeed('a1'.repeat(32))
const m1 = keypairFromSeed('b1'.repeat(32))
const m2 = keypairFromSeed('b2'.repeat(32))
const m3 = keypairFromSeed('b3'.repeat(32))
const payer = keypairFromSeed('dd'.repeat(32))
const council = [m1.pubkey, m2.pubkey, m3.pubkey]

async function seed(pool: RelayPool) {
  await pool.publish(signGovernance({ translationId: TID, maintainers: council, createdAt: 1 }, m1.seckey))
  const pe = submitProposal({ ref: { translationId: TID, book: 'GEN', chapter: 1, verse: 6 }, newText: 'a firmament', rationale: 'raqia', createdAt: 10 }, translator.seckey)
  await pool.publish(pe)
  const proposal = parseProposal(pe)
  const reviews = [m1, m2, m3].map((k, i) => parseReview(submitReview({ proposalId: proposal.id, vote: 'approve', comment: '', createdAt: 20 + i }, k.seckey)))
  for (const r of reviews) await pool.publish(r.event)
  const merge = mergeProposal(proposal, reviews, m1.seckey, 100, { maintainers: council, mergerPubkey: m1.pubkey })
  await pool.publish(merge.event)
  return merge.event.id
}

function profilesAll(): MemoryProfileRegistry {
  const p = new MemoryProfileRegistry().set(translator.pubkey, 'translator@strike.me')
  for (const k of [m1, m2, m3]) p.set(k.pubkey, `${k.pubkey.slice(0, 4)}@strike.me`)
  return p
}

function manual(pool: RelayPool, profiles: MemoryProfileRegistry, paidStore = new MemoryPaidStore()) {
  return new ManualPayouts({ pool, profiles, paidStore, payerSeckey: payer.seckey, perMergeSats: 500 })
}

describe('ManualPayouts', () => {
  it('plans the payments for a governed merge (translator + reviewers)', async () => {
    const pool = new RelayPool([new MockRelay()])
    await seed(pool)
    const plan = await manual(pool, profilesAll()).plan(TID)
    expect(plan.some((p) => p.role === 'translator' && p.lightningAddress === 'translator@strike.me')).toBe(true)
    expect(plan.filter((p) => p.role === 'reviewer')).toHaveLength(3)
    expect(plan.reduce((a, p) => a + p.sats, 0)).toBe(500)
    expect(plan.every((p) => !p.paid)).toBe(true)
  })

  it('pays reviewers from the merge-recorded approvers even when review events are missing', async () => {
    // Publish governance + proposal + merge, but NOT the review events (simulating
    // a relay that dropped them). The split must still include the reviewer.
    const pool = new RelayPool([new MockRelay()])
    await pool.publish(signGovernance({ translationId: TID, maintainers: council, quorum: { minReviewers: 1, approvalThreshold: 0.67 }, createdAt: 1 }, m1.seckey))
    const pe = submitProposal({ ref: { translationId: TID, book: 'GEN', chapter: 1, verse: 6 }, newText: 'a firmament', rationale: 'r', createdAt: 10 }, translator.seckey)
    await pool.publish(pe)
    const proposal = parseProposal(pe)
    const reviews = [parseReview(submitReview({ proposalId: proposal.id, vote: 'approve', comment: '', createdAt: 20 }, m1.seckey))]
    const merge = mergeProposal(proposal, reviews, m1.seckey, 100, { maintainers: council, mergerPubkey: m1.pubkey, quorum: { minReviewers: 1, approvalThreshold: 0.67 } })
    await pool.publish(merge.event) // reviews intentionally not published
    const plan = await manual(pool, profilesAll()).plan(TID)
    expect(plan.find((p) => p.role === 'translator')?.sats).toBe(400) // 70% + folded submitter
    expect(plan.find((p) => p.role === 'reviewer' && p.pubkey === m1.pubkey.toLowerCase())?.sats).toBe(100) // 20%
  })

  it('plans nothing for an ungoverned translation', async () => {
    const pool = new RelayPool([new MockRelay()])
    const pe = submitProposal({ ref: { translationId: TID, book: 'GEN', chapter: 1, verse: 6 }, newText: 'x', rationale: 'r', createdAt: 10 }, translator.seckey)
    await pool.publish(pe)
    const proposal = parseProposal(pe)
    const reviews = [m1, m2, m3].map((k, i) => parseReview(submitReview({ proposalId: proposal.id, vote: 'approve', comment: '', createdAt: 20 + i }, k.seckey)))
    await pool.publish(mergeProposal(proposal, reviews, m1.seckey, 100).event)
    expect(await manual(pool, profilesAll()).plan(TID)).toEqual([])
  })

  it('markPaid records + publishes a kind:30712 receipt, idempotently', async () => {
    const pool = new RelayPool([new MockRelay()])
    await seed(pool)
    const mp = manual(pool, profilesAll())
    const toPay = await mp.toPay(TID)
    expect(toPay.length).toBe(4)
    const first = toPay[0]!
    const r1 = await mp.markPaid(first, 999)
    expect('receipt' in r1).toBe(true)
    const receipts = await pool.query({ kinds: [KIND_PAYOUT] })
    expect(receipts).toHaveLength(1)
    expect(receipts[0]!.tags.find((t) => t[0] === 'ark_method')?.[1]).toBe('manual')
    // second markPaid is a no-op
    const r2 = await mp.markPaid(first, 1000)
    expect('already' in r2).toBe(true)
    // now toPay excludes it
    expect((await mp.toPay(TID)).some((p) => p.pubkey === first.pubkey)).toBe(false)
  })

  it('flags a recipient with no Lightning address as blocked (not payable)', async () => {
    const pool = new RelayPool([new MockRelay()])
    await seed(pool)
    const onlyTranslator = new MemoryProfileRegistry().set(translator.pubkey, 'translator@strike.me')
    const plan = await manual(pool, onlyTranslator).plan(TID)
    const reviewers = plan.filter((p) => p.role === 'reviewer')
    expect(reviewers.every((p) => p.blocked === 'no Lightning address on profile')).toBe(true)
    expect((await manual(pool, onlyTranslator).toPay(TID)).every((p) => p.role === 'translator')).toBe(true)
  })

  it('formatSheet renders a copy-paste payout sheet', async () => {
    const pool = new RelayPool([new MockRelay()])
    await seed(pool)
    const plan = await manual(pool, profilesAll()).plan(TID)
    const sheet = ManualPayouts.formatSheet(plan)
    expect(sheet).toContain('Pay from your wallet:')
    expect(sheet).toContain('translator@strike.me')
    expect(sheet).toMatch(/Total to pay: 500 sats across 4 payment/)
  })
})
