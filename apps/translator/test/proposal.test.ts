import { describe, it, expect } from 'vitest'
import { buildProposalEvent, submitProposal, fetchMyProposals } from '../src/lib/proposal'
import { keySigner } from '../src/lib/signer'
import { keypairFromSeed } from '@neoark/manifest'
import { RelayPool, MockRelay } from '@neoark/relay'
import { parseProposal, KIND_PROPOSAL } from '@neoark/translation-protocol'

const kp = keypairFromSeed('a1'.repeat(32))
const signer = keySigner(kp.seckey)
const ref = { translationId: 'neoos-en-2026', book: 'GEN', chapter: 1, verse: 6 }
const input = { ref, newText: 'a firmament between the waters', rationale: 'Hebrew raqia', createdAt: 1717545600 }

describe('buildProposalEvent', () => {
  it('produces a kind:30702 event with the protocol tags', () => {
    const e = buildProposalEvent(input)
    expect(e.kind).toBe(KIND_PROPOSAL)
    expect(e.tags).toContainEqual(['ark_translation', 'neoos-en-2026'])
    expect(e.tags).toContainEqual(['ark_ref', 'GEN', '1', '6'])
    expect(e.tags).toContainEqual(['ark_rationale', 'Hebrew raqia'])
    expect(e.content).toBe(input.newText)
  })
})

describe('submitProposal', () => {
  it('signs, validates against the protocol, and publishes', async () => {
    const pool = new RelayPool([new MockRelay(), new MockRelay({ url: 'mock://2' })])
    const r = await submitProposal(input, signer, pool)
    expect(r.relaysAccepted).toBe(2)
    expect(r.proposal.author).toBe(kp.pubkey)
    // the published event parses as a valid M5 proposal
    expect(parseProposal(r.event).newText).toBe(input.newText)
  })

  it('rejects empty text or missing rationale', async () => {
    const pool = new RelayPool([new MockRelay()])
    await expect(submitProposal({ ...input, newText: '  ' }, signer, pool)).rejects.toThrow(/empty/)
    await expect(submitProposal({ ...input, rationale: '' }, signer, pool)).rejects.toThrow(/rationale/)
  })
})

describe('fetchMyProposals', () => {
  it('returns the author’s proposals newest-first', async () => {
    const pool = new RelayPool([new MockRelay()])
    await submitProposal({ ...input, createdAt: 100 }, signer, pool)
    await submitProposal({ ...input, createdAt: 200, ref: { ...ref, verse: 7 } }, signer, pool)
    const mine = await fetchMyProposals(pool, kp.pubkey)
    expect(mine.length).toBe(2)
    expect(mine[0]!.event.created_at).toBe(200)
    // a different author sees none of mine
    const other = keypairFromSeed('b2'.repeat(32))
    expect(await fetchMyProposals(pool, other.pubkey)).toHaveLength(0)
  })
})
