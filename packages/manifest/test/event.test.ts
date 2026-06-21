import { describe, it, expect } from 'vitest'
import { computeEventId, signEvent, verifyEventSignature } from '../src/event'
import { keypairFromSeed } from '../src/keys'

const kp = keypairFromSeed('03'.repeat(32))

describe('event (NIP-01)', () => {
  const body = { created_at: 1717545600, kind: 1, tags: [['t', 'ark']], content: 'hello' }

  it('computes a 64-char hex id and a verifiable signature', () => {
    const e = signEvent(body, kp.seckey)
    expect(e.id).toMatch(/^[0-9a-f]{64}$/)
    expect(e.pubkey).toBe(kp.pubkey)
    expect(verifyEventSignature(e)).toBe(true)
  })

  it('id is a deterministic function of the canonical fields', () => {
    const e = signEvent(body, kp.seckey)
    expect(computeEventId(e)).toBe(e.id)
  })

  it('detects content tampering', () => {
    const e = signEvent(body, kp.seckey)
    expect(verifyEventSignature({ ...e, content: 'tampered' })).toBe(false)
  })

  it('returns false for a malformed signature instead of throwing', () => {
    const e = signEvent(body, kp.seckey)
    expect(verifyEventSignature({ ...e, sig: 'zz' })).toBe(false)
  })
})
