import { describe, it, expect } from 'vitest'
import { keypairFromSeed } from '@neoark/manifest'
import {
  buildGovernanceEvent,
  parseGovernance,
  resolveGovernance,
  signGovernance,
  KIND_GOVERNANCE,
} from '../src/governance'
import { tallyReviews, submitReview, parseReview, submitProposal, parseProposal } from '../src/index'
import { mergeProposal, NotAMaintainerError, QuorumNotMetError } from '../src/merge'
import { DEFAULT_QUORUM } from '../src/types'

const founder = keypairFromSeed('f1'.repeat(32))
const m2 = keypairFromSeed('f2'.repeat(32))
const outsider = keypairFromSeed('99'.repeat(32))
const council = [founder.pubkey, m2.pubkey, keypairFromSeed('f3'.repeat(32)).pubkey]
const TID = 'neoos-en-2026'

describe('governance event', () => {
  it('builds + parses a kind:30750 config with maintainers + quorum', () => {
    const ev = signGovernance({ translationId: TID, maintainers: council, createdAt: 1 }, founder.seckey)
    const g = parseGovernance(ev)
    expect(g.event.kind).toBe(KIND_GOVERNANCE)
    expect(g.translationId).toBe(TID)
    expect(g.maintainers).toHaveLength(3)
    expect(g.maintainers).toContain(founder.pubkey.toLowerCase())
    expect(g.quorum).toEqual(DEFAULT_QUORUM)
  })

  it('rejects an unsigned/tampered or empty-council event', () => {
    const ev = signGovernance({ translationId: TID, maintainers: council, createdAt: 1 }, founder.seckey)
    expect(() => parseGovernance({ ...ev, content: '{"quorum":{"minReviewers":1,"approvalThreshold":1}}' })).toThrow(/signature/)
    expect(() => buildGovernanceEvent({ translationId: TID, maintainers: [], createdAt: 1 })).toThrow(/at least one/)
  })
})

describe('resolveGovernance (self-amending chain)', () => {
  it('bootstraps from the first config and honors amendments by a current maintainer', () => {
    const v1 = signGovernance({ translationId: TID, maintainers: [founder.pubkey], createdAt: 10 }, founder.seckey)
    // founder adds m2
    const v2 = signGovernance({ translationId: TID, maintainers: [founder.pubkey, m2.pubkey], createdAt: 20 }, founder.seckey)
    const g = resolveGovernance([v2, v1], TID)
    expect(g?.maintainers).toHaveLength(2)
  })

  it('ignores an amendment from a non-maintainer (hijack attempt)', () => {
    const v1 = signGovernance({ translationId: TID, maintainers: [founder.pubkey], createdAt: 10 }, founder.seckey)
    const hijack = signGovernance({ translationId: TID, maintainers: [outsider.pubkey], createdAt: 20 }, outsider.seckey)
    const g = resolveGovernance([v1, hijack], TID)
    expect(g?.maintainers).toEqual([founder.pubkey.toLowerCase()]) // hijack ignored
  })

  it('pins the founder when foundingPubkey is given', () => {
    const real = signGovernance({ translationId: TID, maintainers: [founder.pubkey], createdAt: 10 }, founder.seckey)
    const frontrun = signGovernance({ translationId: TID, maintainers: [outsider.pubkey], createdAt: 5 }, outsider.seckey)
    const g = resolveGovernance([frontrun, real], TID, { foundingPubkey: founder.pubkey })
    expect(g?.publishedBy).toBe(founder.pubkey.toLowerCase())
  })
})

describe('tallyReviews — council scoping (anti-Sybil)', () => {
  const author = keypairFromSeed('a1'.repeat(32))
  const proposal = parseProposal(
    submitProposal({ ref: { translationId: TID, book: 'GEN', chapter: 1, verse: 6 }, newText: 'a firmament', rationale: 'r', createdAt: 1 }, author.seckey),
  )
  const review = (k: ReturnType<typeof keypairFromSeed>, vote: 'approve' | 'reject', at: number) =>
    parseReview(submitReview({ proposalId: proposal.id, vote, comment: '', createdAt: at }, k.seckey))

  it('ungoverned (no council) counts every pubkey — backward compatible', () => {
    const t = tallyReviews([review(founder, 'approve', 1), review(m2, 'approve', 2), review(outsider, 'approve', 3)], DEFAULT_QUORUM)
    expect(t.governed).toBe(false)
    expect(t.meetsQuorum).toBe(true)
    expect(t.communityApprovals).toBe(0)
  })

  it('3 community approvals do NOT merge a governed proposal', () => {
    const outsiders = ['1a', '1b', '1c'].map((s) => keypairFromSeed(s.repeat(32)))
    const reviews = outsiders.map((k, i) => review(k, 'approve', i + 1))
    const t = tallyReviews(reviews, DEFAULT_QUORUM, { maintainers: council })
    expect(t.governed).toBe(true)
    expect(t.approvals).toBe(0)
    expect(t.communityApprovals).toBe(3)
    expect(t.meetsQuorum).toBe(false)
  })

  it('3 maintainer approvals DO merge', () => {
    const m3 = keypairFromSeed('f3'.repeat(32))
    const t = tallyReviews([review(founder, 'approve', 1), review(m2, 'approve', 2), review(m3, 'approve', 3)], DEFAULT_QUORUM, { maintainers: council })
    expect(t.approvals).toBe(3)
    expect(t.meetsQuorum).toBe(true)
  })
})

describe('mergeProposal — council gating', () => {
  const author = keypairFromSeed('a1'.repeat(32))
  const proposal = parseProposal(
    submitProposal({ ref: { translationId: TID, book: 'GEN', chapter: 1, verse: 6 }, newText: 'a firmament', rationale: 'r', createdAt: 1 }, author.seckey),
  )
  const m3 = keypairFromSeed('f3'.repeat(32))
  const approvals = [founder, m2, m3].map((k, i) => parseReview(submitReview({ proposalId: proposal.id, vote: 'approve', comment: '', createdAt: i + 1 }, k.seckey)))

  it('a maintainer can merge a quorum-met governed proposal', () => {
    const res = mergeProposal(proposal, approvals, founder.seckey, 10, { maintainers: council, mergerPubkey: founder.pubkey })
    expect(res.event.kind).toBe(30703)
    expect(res.update.newText).toBe('a firmament')
  })

  it('a non-maintainer cannot merge even with quorum', () => {
    expect(() => mergeProposal(proposal, approvals, outsider.seckey, 10, { maintainers: council, mergerPubkey: outsider.pubkey })).toThrow(NotAMaintainerError)
  })

  it('community-only approvals do not reach quorum under a council', () => {
    const outsiders = ['1a', '1b', '1c'].map((s) => keypairFromSeed(s.repeat(32)))
    const communityReviews = outsiders.map((k, i) => parseReview(submitReview({ proposalId: proposal.id, vote: 'approve', comment: '', createdAt: i + 1 }, k.seckey)))
    expect(() => mergeProposal(proposal, communityReviews, founder.seckey, 10, { maintainers: council, mergerPubkey: founder.pubkey })).toThrow(QuorumNotMetError)
  })
})

describe('signMerge — Signer-based merge (NIP-07)', () => {
  const author = keypairFromSeed('a1'.repeat(32))
  const proposal = parseProposal(
    submitProposal({ ref: { translationId: TID, book: 'GEN', chapter: 1, verse: 6 }, newText: 'a firmament', rationale: 'r', createdAt: 1 }, author.seckey),
  )
  const m3 = keypairFromSeed('f3'.repeat(32))
  const approvals = [founder, m2, m3].map((k, i) => parseReview(submitReview({ proposalId: proposal.id, vote: 'approve', comment: '', createdAt: i + 1 }, k.seckey)))

  it('a Signer produces a merge byte-equivalent to the raw-key path', async () => {
    const { signMerge, mergeProposal } = await import('../src/merge')
    const { signEvent, getPublicKey } = await import('@neoark/manifest')
    const signer = { signEvent: (e: { created_at: number; kind: number; tags: string[][]; content: string }) => signEvent(e, founder.seckey) }
    const viaSigner = await signMerge(proposal, approvals, signer, 10, { maintainers: council, mergerPubkey: founder.pubkey })
    const viaKey = mergeProposal(proposal, approvals, founder.seckey, 10, { maintainers: council, mergerPubkey: founder.pubkey })
    expect(viaSigner.event.id).toBe(viaKey.event.id) // same content, same id
    expect(getPublicKey(founder.seckey)).toBe(viaSigner.event.pubkey)
  })
})
