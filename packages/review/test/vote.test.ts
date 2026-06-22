import { describe, it, expect } from 'vitest'
import { castVote, maybeMerge } from '../src/vote'
import { RelayPool, MockRelay } from '@neoark/relay'
import { parseProposal, parseReview, parseMerge, submitReview, KIND_REVIEW } from '@neoark/translation-protocol'
import { verifyEventSignature } from '@neoark/manifest'
import { reviewers, maintainer, keySigner, proposalEvent } from './helpers'

const proposal = parseProposal(proposalEvent())
const reviewObjs = (votes: ('approve' | 'reject')[]) =>
  votes.map((v, i) => parseReview(submitReview({ proposalId: proposal.id, vote: v, comment: '', createdAt: i + 1 }, reviewers[i]!.seckey)))

describe('castVote', () => {
  it('signs and publishes a valid kind:30703 review', async () => {
    const pool = new RelayPool([new MockRelay(), new MockRelay({ url: 'mock://2' })])
    const r = await castVote({ proposalId: proposal.id, vote: 'approve', comment: 'lgtm', createdAt: 5 }, keySigner(reviewers[0]!.seckey), pool)
    expect(r.relaysAccepted).toBe(2)
    expect(r.event.kind).toBe(KIND_REVIEW)
    expect(r.review.vote).toBe('approve')
    expect(r.review.reviewer).toBe(reviewers[0]!.pubkey)
    expect(verifyEventSignature(r.event)).toBe(true)
  })

  it('supports reject votes', async () => {
    const pool = new RelayPool([new MockRelay()])
    const r = await castVote({ proposalId: proposal.id, vote: 'reject', comment: 'no', createdAt: 5 }, keySigner(reviewers[1]!.seckey), pool)
    expect(r.review.vote).toBe('reject')
  })
})

describe('maybeMerge', () => {
  it('refuses below quorum and explains', async () => {
    const pool = new RelayPool([new MockRelay()])
    const r = await maybeMerge(proposal, reviewObjs(['approve', 'approve']), maintainer.seckey, 10, pool)
    expect(r.merged).toBe(false)
    expect(r.reason).toMatch(/quorum not met/)
  })

  it('merges at quorum and publishes a valid merge event', async () => {
    const pool = new RelayPool([new MockRelay()])
    const r = await maybeMerge(proposal, reviewObjs(['approve', 'approve', 'approve']), maintainer.seckey, 10, pool)
    expect(r.merged).toBe(true)
    expect(r.relaysAccepted).toBe(1)
    const parsed = parseMerge(r.event!)
    expect(parsed.proposalId).toBe(proposal.id)
    expect(parsed.maintainer).toBe(maintainer.pubkey)
  })

  it('respects a configurable threshold', async () => {
    const pool = new RelayPool([new MockRelay()])
    const r = await maybeMerge(proposal, reviewObjs(['approve', 'approve']), maintainer.seckey, 10, pool, { minReviewers: 2, approvalThreshold: 0.67 })
    expect(r.merged).toBe(true)
  })

  it('does not re-merge an already-merged proposal’s reviews below quorum', async () => {
    const pool = new RelayPool([new MockRelay()])
    // a single rejection → not merge-ready
    const r = await maybeMerge(proposal, reviewObjs(['reject']), maintainer.seckey, 10, pool)
    expect(r.merged).toBe(false)
  })
})
