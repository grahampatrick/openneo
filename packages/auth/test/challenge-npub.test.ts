import { describe, it, expect } from 'vitest'
import { ChallengeStore } from '../src/challenge'
import { hexToNpub, npubToHex, compressedToXonly } from '../src/npub'
import { secp256k1 } from '@noble/curves/secp256k1'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'

describe('ChallengeStore', () => {
  it('issues unique, single-use challenges', () => {
    const t = 0
    let n = 0
    const store = new ChallengeStore({ now: () => t, genK1: () => (++n).toString(16).padStart(64, '0') })
    const a = store.issue()
    const b = store.issue()
    expect(a.k1).not.toBe(b.k1)
    expect(store.size).toBe(2)
    expect(store.consume(a.k1)).toBe(true)
    expect(store.consume(a.k1)).toBe(false) // replay
    expect(store.size).toBe(1)
  })

  it('rejects unknown and expired challenges', () => {
    let t = 0
    const store = new ChallengeStore({ ttlSec: 100, now: () => t, genK1: () => 'a'.repeat(64) })
    expect(store.consume('f'.repeat(64))).toBe(false) // unknown
    store.issue()
    t = 101
    expect(store.consume('a'.repeat(64))).toBe(false) // expired
  })

  it('sweeps expired challenges', () => {
    let t = 0
    let n = 0
    const store = new ChallengeStore({ ttlSec: 10, now: () => t, genK1: () => (++n).toString(16).padStart(64, '0') })
    store.issue()
    store.issue()
    t = 20
    expect(store.sweep()).toBe(2)
    expect(store.size).toBe(0)
  })
})

describe('npub (NIP-19)', () => {
  const xonly = '11'.repeat(32)

  it('round-trips hex ↔ npub', () => {
    const npub = hexToNpub(xonly)
    expect(npub.startsWith('npub1')).toBe(true)
    expect(npubToHex(npub)).toBe(xonly)
  })

  it('rejects bad input', () => {
    expect(() => hexToNpub('xyz')).toThrow(/x-only/)
    expect(() => npubToHex('nsec1abc')).toThrow()
  })

  it('reduces a compressed pubkey to x-only (Lightning login → same npub)', () => {
    const compressed = bytesToHex(secp256k1.getPublicKey(hexToBytes('22'.repeat(32)), true))
    const reduced = compressedToXonly(compressed)
    expect(reduced).toHaveLength(64)
    expect(compressed.slice(2)).toBe(reduced)
    // already-x-only passes through
    expect(compressedToXonly(xonly)).toBe(xonly)
  })

  it('rejects a non-key value', () => {
    expect(() => compressedToXonly('nope')).toThrow(/pubkey/)
  })
})
