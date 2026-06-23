import { describe, it, expect, beforeEach, vi } from 'vitest'
import { generateSeckey, ensureSeckey, loadSeckey, pubkeyHex, signWith } from '../src/lib/identity'
import { getPublicKey, verifyEventSignature } from '@neoark/manifest'

beforeEach(() => {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  })
})

describe('reader identity', () => {
  it('generates a valid secp256k1 key', () => {
    const sk = generateSeckey()
    expect(sk).toMatch(/^[0-9a-f]{64}$/)
    expect(getPublicKey(sk)).toMatch(/^[0-9a-f]{64}$/)
  })

  it('ensureSeckey persists and reuses the same key', () => {
    expect(loadSeckey()).toBeNull()
    const a = ensureSeckey()
    expect(loadSeckey()).toBe(a)
    expect(ensureSeckey()).toBe(a) // reused, not regenerated
    expect(pubkeyHex()).toBe(getPublicKey(a))
  })

  it('pubkeyHex is null before any identity exists', () => {
    expect(pubkeyHex()).toBeNull()
  })

  it('signWith produces a verifiable signed event', () => {
    const sk = generateSeckey()
    const ev = signWith(sk, { kind: 30704, created_at: 1, tags: [['ark_ref', 'GEN', '1', '6']], content: 'note' })
    expect(verifyEventSignature(ev)).toBe(true)
    expect(ev.pubkey).toBe(getPublicKey(sk))
  })
})
