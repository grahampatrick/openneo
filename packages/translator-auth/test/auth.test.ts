import { describe, it, expect } from 'vitest'
import { derivePrivyIdentity, PrivyAuthProvider } from '../src/privy'
import {
  deriveLinkingKey,
  signChallenge,
  verifyChallenge,
  lnurlAuthIdentity,
} from '../src/lnurl-auth'
import { signEvent, verifyEventSignature } from '@neoark/manifest'

describe('Privy adapter', () => {
  const user = { appId: 'neoark', userId: 'did:privy:abc123' }

  it('derives a deterministic, recoverable identity', () => {
    const a = derivePrivyIdentity(user, 'app-secret')
    const b = derivePrivyIdentity(user, 'app-secret')
    expect(a).toEqual(b)
    expect(a.method).toBe('privy')
    expect(a.seckey).toMatch(/^[0-9a-f]{64}$/)
    expect(a.pubkey).toMatch(/^[0-9a-f]{64}$/)
    expect(a.subject).toBe('neoark:did:privy:abc123')
  })

  it('changes the key when the app secret or user changes', () => {
    const base = derivePrivyIdentity(user, 's1').seckey
    expect(derivePrivyIdentity(user, 's2').seckey).not.toBe(base)
    expect(derivePrivyIdentity({ ...user, userId: 'other' }, 's1').seckey).not.toBe(base)
  })

  it('requires appId, userId, and a secret', () => {
    expect(() => derivePrivyIdentity({ appId: '', userId: 'x' }, 's')).toThrow()
    expect(() => derivePrivyIdentity(user, '')).toThrow(/app secret/)
  })

  it('can sign an ARK event verifiable against its pubkey', () => {
    const id = derivePrivyIdentity(user, 's')
    const ev = signEvent({ created_at: 1, kind: 30702, tags: [], content: 'hi' }, id.seckey)
    expect(ev.pubkey).toBe(id.pubkey)
    expect(verifyEventSignature(ev)).toBe(true)
  })

  it('PrivyAuthProvider.login returns an identity', () => {
    const p = new PrivyAuthProvider('secret')
    expect(p.login(user).pubkey).toBe(derivePrivyIdentity(user, 'secret').pubkey)
  })
})

describe('LNURL-auth adapter', () => {
  const seed = '11'.repeat(32)
  const k1 = 'ab'.repeat(32)

  it('derives a stable per-domain linking key', () => {
    const a = deriveLinkingKey(seed, 'neoark.org')
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(deriveLinkingKey(seed, 'neoark.org')).toBe(a)
    expect(deriveLinkingKey(seed, 'other.org')).not.toBe(a) // different identity per service
  })

  it('rejects a bad seed or domain', () => {
    expect(() => deriveLinkingKey('xyz', 'd')).toThrow(/32-byte hex/)
    expect(() => deriveLinkingKey(seed, '')).toThrow(/domain/)
  })

  it('signs and verifies a k1 challenge (LUD-04 round trip)', () => {
    const linking = deriveLinkingKey(seed, 'neoark.org')
    const sig = signChallenge(k1, linking)
    expect(sig.key).toMatch(/^0[23][0-9a-f]{64}$/) // compressed pubkey
    expect(verifyChallenge(k1, sig)).toBe(true)
  })

  it('rejects a forged challenge response', () => {
    const sig = signChallenge(k1, deriveLinkingKey(seed, 'neoark.org'))
    expect(verifyChallenge('cd'.repeat(32), sig)).toBe(false)
    expect(verifyChallenge(k1, { ...sig, sig: '00' })).toBe(false)
    expect(verifyChallenge('zz', sig)).toBe(false)
  })

  it('rejects a malformed k1 when signing', () => {
    expect(() => signChallenge('nope', deriveLinkingKey(seed, 'd'))).toThrow(/k1 must be/)
  })

  it('resolves an ARK identity that can sign events', () => {
    const id = lnurlAuthIdentity(seed, 'neoark.org')
    expect(id.method).toBe('lnurl-auth')
    expect(id.subject).toBe('lnurl-auth:neoark.org')
    const ev = signEvent({ created_at: 1, kind: 30702, tags: [], content: '' }, id.seckey)
    expect(verifyEventSignature(ev)).toBe(true)
    expect(ev.pubkey).toBe(id.pubkey)
  })
})
