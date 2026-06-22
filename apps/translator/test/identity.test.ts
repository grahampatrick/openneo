import { describe, it, expect } from 'vitest'
import {
  generateSeckey,
  nsecEncode,
  nsecDecode,
  loadLocalSeckey,
  saveLocalSeckey,
  clearLocalSeckey,
  npubFor,
  signerFor,
} from '../src/lib/identity'
import type { KeyValueStore } from '../src/lib/auth-client'
import { getPublicKey, verifyEventSignature } from '@neoark/manifest'

function memStore(): KeyValueStore {
  const m = new Map<string, string>()
  return { get: (k) => m.get(k) ?? null, set: (k, v) => void m.set(k, v), remove: (k) => void m.delete(k) }
}

describe('local identity', () => {
  it('generates a valid 32-byte secp256k1 key', () => {
    const hex = generateSeckey()
    expect(hex).toMatch(/^[0-9a-f]{64}$/)
    expect(getPublicKey(hex)).toMatch(/^[0-9a-f]{64}$/) // usable
    expect(generateSeckey()).not.toBe(hex) // random
  })

  it('round-trips a key through nsec', () => {
    const hex = generateSeckey()
    const nsec = nsecEncode(hex)
    expect(nsec.startsWith('nsec1')).toBe(true)
    expect(nsecDecode(nsec)).toBe(hex)
    expect(nsecDecode(' ' + nsec + ' ')).toBe(hex) // tolerates whitespace
  })

  it('rejects a non-nsec or malformed key on import', () => {
    expect(() => nsecDecode('npub1abc')).toThrow()
    expect(() => nsecDecode('not-a-key')).toThrow()
  })

  it('persists and clears the local key', () => {
    const store = memStore()
    expect(loadLocalSeckey(store)).toBeNull()
    const hex = generateSeckey()
    saveLocalSeckey(store, hex)
    expect(loadLocalSeckey(store)).toBe(hex)
    clearLocalSeckey(store)
    expect(loadLocalSeckey(store)).toBeNull()
  })

  it('derives an npub and a working signer', async () => {
    const hex = generateSeckey()
    expect(npubFor(hex).startsWith('npub1')).toBe(true)
    const signer = signerFor(hex)
    const event = await signer.signEvent({ kind: 22242, created_at: 1, tags: [], content: '' })
    expect(event.pubkey).toBe(getPublicKey(hex))
    expect(verifyEventSignature(event)).toBe(true)
  })
})
