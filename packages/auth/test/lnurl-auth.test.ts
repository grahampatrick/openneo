import { describe, it, expect } from 'vitest'
import { buildLnurlAuth, verifyLnurlSignature } from '../src/lnurl-auth'
import { secp256k1 } from '@noble/curves/secp256k1'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'

const linkSec = hexToBytes('22'.repeat(32))
const key = bytesToHex(secp256k1.getPublicKey(linkSec, true))
const k1 = 'ab'.repeat(32)
const sign = (challenge: string, sec = linkSec) =>
  bytesToHex(secp256k1.sign(hexToBytes(challenge), sec).toBytes('der'))

describe('buildLnurlAuth', () => {
  it('builds an uppercase lnurl1 string carrying tag/k1/action', () => {
    const lnurl = buildLnurlAuth('https://neoark.org/api/lnurl-auth', k1)
    expect(lnurl.startsWith('LNURL1')).toBe(true)
    // decodes back to the callback URL with our params
    expect(lnurl).toMatch(/^LNURL1[A-Z0-9]+$/)
  })

  it('rejects a bad k1', () => {
    expect(() => buildLnurlAuth('https://x', 'short')).toThrow(/32-byte hex/)
  })
})

describe('verifyLnurlSignature', () => {
  it('accepts a valid (k1, sig, key)', () => {
    expect(verifyLnurlSignature({ k1, sig: sign(k1), key })).toBe(true)
  })

  it('rejects a signature over a different k1', () => {
    expect(verifyLnurlSignature({ k1, sig: sign('cd'.repeat(32)), key })).toBe(false)
  })

  it('rejects a signature from a different key', () => {
    const other = hexToBytes('33'.repeat(32))
    expect(verifyLnurlSignature({ k1, sig: sign(k1, other), key })).toBe(false)
  })

  it('rejects malformed k1 / key / sig', () => {
    expect(verifyLnurlSignature({ k1: 'bad', sig: sign(k1), key })).toBe(false)
    expect(verifyLnurlSignature({ k1, sig: sign(k1), key: 'bad' })).toBe(false)
    expect(verifyLnurlSignature({ k1, sig: '00', key })).toBe(false)
  })
})
