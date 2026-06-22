import { describe, it, expect } from 'vitest'
import { signJwt, verifyJwt } from '../src/jwt'

describe('JWT (HS256, self-contained)', () => {
  const secret = 'super-secret'

  it('signs and verifies a round-trip payload', () => {
    const token = signJwt({ sub: 'npub1abc', n: 1 }, secret)
    expect(token.split('.')).toHaveLength(3)
    const r = verifyJwt<{ sub: string; n: number }>(token, secret)
    expect(r.ok && r.payload).toMatchObject({ sub: 'npub1abc', n: 1 })
  })

  it('rejects a wrong secret', () => {
    const token = signJwt({ sub: 'x' }, secret)
    const r = verifyJwt(token, 'other')
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error).toMatch(/signature/)
  })

  it('rejects a tampered payload', () => {
    const token = signJwt({ admin: false }, secret)
    const [h = '', , s = ''] = token.split('.')
    const forged = `${h}.${btoa(JSON.stringify({ admin: true })).replace(/=+$/, '')}.${s}`
    expect(verifyJwt(forged, secret).ok).toBe(false)
  })

  it('rejects an expired token and accepts a future-dated one', () => {
    const token = signJwt({ exp: 100 }, secret)
    expect(verifyJwt(token, secret, { now: 200 }).ok).toBe(false)
    expect(verifyJwt(token, secret, { now: 50 }).ok).toBe(true)
  })

  it('rejects malformed tokens', () => {
    expect(verifyJwt('a.b', secret).ok).toBe(false)
    expect(verifyJwt('only-one-part', secret).ok).toBe(false)
  })

  it('requires a secret to sign', () => {
    expect(() => signJwt({}, '')).toThrow(/secret/)
  })
})
