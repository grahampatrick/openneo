import { describe, it, expect } from 'vitest'
import { keypairFromSeed, signEvent } from '@neoark/manifest'
import { submitProposal, parseProposal } from '../src/proposals'
import { submitReview, parseReview, tallyReviews } from '../src/reviews'
import { mergeProposal, parseMerge, QuorumNotMetError } from '../src/merge'
import { DEFAULT_QUORUM } from '../src/types'
import type { Review, VerseRef } from '../src/types'

const author = keypairFromSeed('a1'.repeat(32))
const reviewers = ['b1', 'b2', 'b3', 'b4'].map((s) => keypairFromSeed(s.repeat(32)))
const maintainer = keypairFromSeed('cc'.repeat(32))

const ref: VerseRef = { translationId: 'neoos-en-2026', book: 'GEN', chapter: 1, verse: 6 }

function proposal() {
  return submitProposal(
    { ref, newText: 'a firmament', rationale: 'Hebrew raqia', createdAt: 1700000000 },
    author.seckey,
  )
}

function reviewsFor(id: string, votes: ('approve' | 'reject')[]): Review[] {
  return votes.map((vote, i) =>
    parseReview(submitReview({ proposalId: id, vote, comment: 'c', createdAt: 1700000100 + i }, reviewers[i]!.seckey)),
  )
}

describe('proposals', () => {
  it('builds and parses a kind:30702 proposal', () => {
    const p = parseProposal(proposal())
    expect(p.event.kind).toBe(30702)
    expect(p.ref).toEqual(ref)
    expect(p.newText).toBe('a firmament')
    expect(p.rationale).toBe('Hebrew raqia')
    expect(p.author).toBe(author.pubkey)
  })

  it('rejects a wrong-kind or unsigned event', () => {
    const p = proposal()
    expect(() => parseProposal({ ...p, kind: 1 })).toThrow(/Not a proposal/)
    expect(() => parseProposal({ ...p, content: 'tampered' })).toThrow(/signature/)
  })
})

describe('reviews + tally', () => {
  it('builds and parses a review', () => {
    const r = parseReview(submitReview({ proposalId: 'abc', vote: 'approve', comment: 'lgtm', createdAt: 1 }, reviewers[0]!.seckey))
    expect(r.vote).toBe('approve')
    expect(r.proposalId).toBe('abc')
    expect(r.comment).toBe('lgtm')
  })

  it('rejects an invalid vote', () => {
    // Properly signed event carrying a bogus vote value.
    const bad = signEvent(
      {
        created_at: 1,
        kind: 30703,
        tags: [
          ['e', 'abc'],
          ['ark_action', 'review'],
          ['ark_vote', 'maybe'],
        ],
        content: '',
      },
      reviewers[0]!.seckey,
    )
    expect(() => parseReview(bad)).toThrow(/valid vote/)
  })

  it('counts only the latest vote per reviewer', () => {
    const p = parseProposal(proposal())
    const mk = (k: number, vote: 'approve' | 'reject', at: number): Review =>
      parseReview(submitReview({ proposalId: p.id, vote, comment: '', createdAt: at }, reviewers[k]!.seckey))
    const flip = [
      mk(0, 'reject', 1), // reviewer 0 first rejects…
      mk(0, 'approve', 2), // …then changes to approve (latest wins)
      mk(1, 'approve', 3),
      mk(2, 'approve', 4),
    ]
    const t = tallyReviews(flip, DEFAULT_QUORUM)
    expect(t.reviewers).toBe(3)
    expect(t.approvals).toBe(3)
    expect(t.meetsQuorum).toBe(true)
  })

  it('fails quorum below minReviewers or below threshold', () => {
    const p = parseProposal(proposal())
    expect(tallyReviews(reviewsFor(p.id, ['approve', 'approve']), DEFAULT_QUORUM).meetsQuorum).toBe(false)
    expect(tallyReviews(reviewsFor(p.id, ['approve', 'reject', 'reject']), DEFAULT_QUORUM).meetsQuorum).toBe(false)
  })
})

describe('mergeProposal', () => {
  it('merges when quorum is met and carries the verse update', () => {
    const p = parseProposal(proposal())
    const merge = mergeProposal(p, reviewsFor(p.id, ['approve', 'approve', 'approve']), maintainer.seckey, 1700000200)
    expect(merge.event.kind).toBe(30703)
    expect(merge.update).toEqual({ ref, newText: 'a firmament', proposalId: p.id })
    const parsed = parseMerge(merge.event)
    expect(parsed.maintainer).toBe(maintainer.pubkey)
    expect(parsed.approvals).toBe(3)
    expect(parsed.proposalId).toBe(p.id)
  })

  it('throws QuorumNotMetError when reviews fall short', () => {
    const p = parseProposal(proposal())
    expect(() =>
      mergeProposal(p, reviewsFor(p.id, ['approve', 'approve']), maintainer.seckey, 1),
    ).toThrow(QuorumNotMetError)
  })

  it('does not count a self-review by the proposal author', () => {
    const p = parseProposal(proposal())
    const selfReview = parseReview(submitReview({ proposalId: p.id, vote: 'approve', comment: '', createdAt: 1 }, author.seckey))
    const twoReal = reviewsFor(p.id, ['approve', 'approve'])
    // 2 real approvals + 1 self → still only 2 eligible reviewers, below min 3.
    expect(() => mergeProposal(p, [selfReview, ...twoReal], maintainer.seckey, 1)).toThrow(QuorumNotMetError)
  })
})
