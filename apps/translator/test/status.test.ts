import { describe, it, expect } from 'vitest'
import { proposalStatus, statusBadge } from '../src/lib/status'
import { submitReview, parseReview, mergeProposal, parseProposal, submitProposal as protoPropose } from '@neoark/translation-protocol'
import { keypairFromSeed } from '@neoark/manifest'
import type { NostrEvent } from '@neoark/manifest'

const author = keypairFromSeed('a1'.repeat(32))
const reviewers = ['b1', 'b2', 'b3'].map((s) => keypairFromSeed(s.repeat(32)))
const maintainer = keypairFromSeed('cc'.repeat(32))

const proposalEvent = protoPropose(
  { ref: { translationId: 'neoos-en-2026', book: 'GEN', chapter: 1, verse: 6 }, newText: 'a firmament', rationale: 'r', createdAt: 1 },
  author.seckey,
)
const proposal = parseProposal(proposalEvent)

const review = (i: number, vote: 'approve' | 'reject', at: number): NostrEvent =>
  submitReview({ proposalId: proposal.id, vote, comment: '', createdAt: at }, reviewers[i]!.seckey)

describe('proposalStatus', () => {
  it('is pending with no reviews', () => {
    const s = proposalStatus(proposal.id, author.pubkey, [])
    expect(s.state).toBe('pending')
    expect(s.needed).toBe(3)
  })

  it('stays pending below quorum and reports how many more are needed', () => {
    const s = proposalStatus(proposal.id, author.pubkey, [review(0, 'approve', 1), review(1, 'approve', 2)])
    expect(s.state).toBe('pending')
    expect(s.approvals).toBe(2)
    expect(s.needed).toBe(1)
  })

  it('becomes approved at quorum (3 approvals)', () => {
    const s = proposalStatus(proposal.id, author.pubkey, [review(0, 'approve', 1), review(1, 'approve', 2), review(2, 'approve', 3)])
    expect(s.state).toBe('approved')
    expect(s.needed).toBe(0)
  })

  it('ignores a self-review by the author', () => {
    const selfReview = submitReview({ proposalId: proposal.id, vote: 'approve', comment: '', createdAt: 1 }, author.seckey)
    const s = proposalStatus(proposal.id, author.pubkey, [selfReview, review(0, 'approve', 2), review(1, 'approve', 3)])
    expect(s.reviewers).toBe(2) // self dropped
    expect(s.state).toBe('pending')
  })

  it('is merged once a merge event exists', () => {
    const reviews = [0, 1, 2].map((i) => review(i, 'approve', i + 1))
    const merge = mergeProposal(proposal, reviews.map((e) => parseReview(e)), maintainer.seckey, 10)
    const s = proposalStatus(proposal.id, author.pubkey, [...reviews, merge.event])
    expect(s.state).toBe('merged')
  })

  it('honours a configurable threshold (OQ-P2-2)', () => {
    const twoOfTwo = { minReviewers: 2, approvalThreshold: 0.67 }
    const s = proposalStatus(proposal.id, author.pubkey, [review(0, 'approve', 1), review(1, 'approve', 2)], twoOfTwo)
    expect(s.state).toBe('approved')
  })
})

describe('statusBadge', () => {
  it('labels each state', () => {
    expect(statusBadge(proposalStatus(proposal.id, author.pubkey, [])).text).toMatch(/Pending/)
    const approved = proposalStatus(proposal.id, author.pubkey, [review(0, 'approve', 1), review(1, 'approve', 2), review(2, 'approve', 3)])
    expect(statusBadge(approved).text).toMatch(/Approved/)
  })
})
