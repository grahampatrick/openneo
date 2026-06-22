import { describe, it, expect } from 'vitest'
import { buildNip07AuthEvent, verifyNip07Auth, KIND_AUTH } from '../src/nip07'
import { keypairFromSeed, signEvent } from '@neoark/manifest'
import type { NostrEvent } from '../src/types'

const kp = keypairFromSeed('11'.repeat(32))
const challenge = 'ab'.repeat(32)

function authEvent(ch: string, createdAt: number): NostrEvent {
  return signEvent(buildNip07AuthEvent(ch, createdAt), kp.seckey)
}

describe('NIP-07 auth', () => {
  it('builds a kind:22242 event carrying the challenge', () => {
    const unsigned = buildNip07AuthEvent(challenge, 100, 'neoark.org')
    expect(unsigned.kind).toBe(KIND_AUTH)
    expect(unsigned.tags).toContainEqual(['challenge', challenge])
    expect(unsigned.tags).toContainEqual(['domain', 'neoark.org'])
  })

  it('verifies a fresh, correctly-signed event', () => {
    const r = verifyNip07Auth(authEvent(challenge, 100), challenge, { now: 100 })
    expect(r.ok).toBe(true)
    expect(r.pubkey).toBe(kp.pubkey)
  })

  it('rejects a challenge mismatch', () => {
    const r = verifyNip07Auth(authEvent(challenge, 100), 'cd'.repeat(32), { now: 100 })
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/challenge mismatch/)
  })

  it('rejects a stale event', () => {
    const r = verifyNip07Auth(authEvent(challenge, 100), challenge, { now: 100 + 601 })
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/stale/)
  })

  it('rejects a tampered signature', () => {
    const e = authEvent(challenge, 100)
    const r = verifyNip07Auth({ ...e, content: 'tampered' }, challenge, { now: 100 })
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/signature/)
  })

  it('rejects the wrong kind', () => {
    const e = signEvent({ kind: 1, created_at: 100, tags: [['challenge', challenge]], content: '' }, kp.seckey)
    expect(verifyNip07Auth(e, challenge, { now: 100 }).ok).toBe(false)
  })
})
