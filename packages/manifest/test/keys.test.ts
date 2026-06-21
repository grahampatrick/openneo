import { describe, it, expect } from 'vitest'
import {
  getPublicKey,
  normalizePubkey,
  normalizeSeckey,
  keypairFromSeed,
  decodeBech32Key,
} from '../src/keys'
import { bech32 } from '@scure/base'
import { hexToBytes } from '@noble/hashes/utils'

describe('keys', () => {
  const seed = '01'.repeat(32)

  it('derives a stable 32-byte x-only pubkey from a seed', () => {
    const { seckey, pubkey } = keypairFromSeed(seed)
    expect(seckey).toBe(seed)
    expect(pubkey).toHaveLength(64)
    expect(getPublicKey(seed)).toBe(pubkey)
  })

  it('rejects a malformed seed', () => {
    expect(() => keypairFromSeed('xyz')).toThrow(/32-byte hex/)
  })

  it('normalizes hex pubkeys (lowercasing) and rejects junk', () => {
    const { pubkey } = keypairFromSeed(seed)
    expect(normalizePubkey(pubkey.toUpperCase())).toBe(pubkey)
    expect(() => normalizePubkey('nope')).toThrow(/64-char hex or an npub/)
  })

  it('decodes npub/nsec bech32 to hex', () => {
    const { seckey, pubkey } = keypairFromSeed(seed)
    const npub = bech32.encode('npub', bech32.toWords(hexToBytes(pubkey)))
    const nsec = bech32.encode('nsec', bech32.toWords(hexToBytes(seckey)))
    expect(normalizePubkey(npub)).toBe(pubkey)
    expect(normalizeSeckey(nsec)).toBe(seckey)
    expect(decodeBech32Key(npub, 'npub')).toBe(pubkey)
  })

  it('rejects a bech32 key with the wrong prefix', () => {
    const { pubkey } = keypairFromSeed(seed)
    const npub = bech32.encode('npub', bech32.toWords(hexToBytes(pubkey)))
    expect(() => decodeBech32Key(npub, 'nsec')).toThrow(/Expected nsec/)
  })

  it('rejects a non-hex secret key', () => {
    expect(() => normalizeSeckey('zz')).toThrow(/64-char hex or an nsec/)
  })
})
