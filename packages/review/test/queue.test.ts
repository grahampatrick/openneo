import { describe, it, expect } from 'vitest'
import { reviewState, fetchReviewQueue, pendingOnly, buildWithdrawal } from '../src/queue'
import { castVote } from '../src/vote'
import { RelayPool, MockRelay } from '@neoark/relay'
import { parseProposal, submitReview, parseReview, mergeProposal } from '@neoark/translation-protocol'
import { signEvent } from '@neoark/manifest'
import { author, reviewers, maintainer, keySigner, proposalEvent } from './helpers'

const proposal = parseProposal(proposalEvent())
const review = (i: number, vote: 'approve' | 'reject', at: number) =>
  parseReview(submitReview({ proposalId: proposal.id, vote, comment: '', createdAt: at }, reviewers[i]!.seckey))

describe('reviewState', () => {
  it('is pending with no reviews and reports needed', () => {
    const s = reviewState(proposal, [], false)
    expect(s.mergeReady).toBe(false)
    expect(s.needed).toBe(3)
    expect(s.reviewers).toBe(0)
  })

  it('becomes merge-ready at quorum', () => {
    const s = reviewState(proposal, [review(0, 'approve', 1), review(1, 'approve', 2), review(2, 'approve', 3)], false)
    expect(s.approvals).toBe(3)
    expect(s.mergeReady).toBe(true)
    expect(s.needed).toBe(0)
  })

  it('is not merge-ready once merged', () => {
    const s = reviewState(proposal, [review(0, 'approve', 1), review(1, 'approve', 2), review(2, 'approve', 3)], true)
    expect(s.merged).toBe(true)
    expect(s.mergeReady).toBe(false)
  })

  it('drops the author’s self-review', () => {
    const self = parseReview(submitReview({ proposalId: proposal.id, vote: 'approve', comment: '', createdAt: 1 }, author.seckey))
    const s = reviewState(proposal, [self, review(0, 'approve', 2), review(1, 'approve', 3)], false)
    expect(s.reviewers).toBe(2)
    expect(s.mergeReady).toBe(false)
  })

  it('honours a configurable threshold', () => {
    const s = reviewState(proposal, [review(0, 'approve', 1), review(1, 'approve', 2)], false, { minReviewers: 2, approvalThreshold: 0.67 })
    expect(s.mergeReady).toBe(true)
  })
})

describe('fetchReviewQueue', () => {
  async function seed() {
    const pool = new RelayPool([new MockRelay()])
    await pool.publish(proposalEvent())
    return pool
  }

  it('lists proposals for the translation with their state', async () => {
    const pool = await seed()
    const q = await fetchReviewQueue(pool, 'neoos-en-2026')
    expect(q).toHaveLength(1)
    expect(q[0]!.needed).toBe(3)
    expect(pendingOnly(q)).toHaveLength(1)
  })

  it('reflects votes cast through castVote', async () => {
    const pool = await seed()
    let t = 200
    for (const i of [0, 1, 2]) {
      await castVote({ proposalId: proposal.id, vote: 'approve', comment: 'ok', createdAt: t++ }, keySigner(reviewers[i]!.seckey), pool)
    }
    const q = await fetchReviewQueue(pool, 'neoos-en-2026')
    expect(q[0]!.approvals).toBe(3)
    expect(q[0]!.mergeReady).toBe(true)
    expect(pendingOnly(q)).toHaveLength(0)
  })

  it('marks a proposal merged once a merge event is on the relay', async () => {
    const pool = await seed()
    const reviews = [0, 1, 2].map((i) => review(i, 'approve', i + 1))
    const merge = mergeProposal(proposal, reviews, maintainer.seckey, 10)
    await pool.publish(merge.event)
    const q = await fetchReviewQueue(pool, 'neoos-en-2026')
    expect(q[0]!.merged).toBe(true)
    expect(q[0]!.mergeReady).toBe(false)
  })

  it('excludes proposals from other translations', async () => {
    const pool = new RelayPool([new MockRelay()])
    await pool.publish(proposalEvent())
    expect(await fetchReviewQueue(pool, 'web-en-2020')).toHaveLength(0)
  })

  it('drops a proposal its author withdrew (NIP-09 kind:5)', async () => {
    const pool = await seed()
    expect(await fetchReviewQueue(pool, 'neoos-en-2026')).toHaveLength(1)
    const withdrawal = signEvent(buildWithdrawal(proposal.id, 500), author.seckey)
    await pool.publish(withdrawal)
    expect(await fetchReviewQueue(pool, 'neoos-en-2026')).toHaveLength(0)
  })

  it('ignores a withdrawal signed by someone other than the author', async () => {
    const pool = await seed()
    const notAuthor = signEvent(buildWithdrawal(proposal.id, 500), reviewers[0]!.seckey)
    await pool.publish(notAuthor)
    expect(await fetchReviewQueue(pool, 'neoos-en-2026')).toHaveLength(1) // still there
  })
})
