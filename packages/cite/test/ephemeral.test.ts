import { describe, it, expect } from 'vitest'
import { ephemeralSigner } from '../src/ephemeral'
import { schnorr } from '@noble/curves/secp256k1'
import { hexToBytes } from '@noble/hashes/utils'

describe('ephemeralSigner', () => {
  it('derives a pubkey and signs a verifiable event from a fixed secret', async () => {
    const signer = ephemeralSigner('11'.repeat(32))
    const pubkey = await signer.getPublicKey()
    expect(pubkey).toMatch(/^[0-9a-f]{64}$/)
    const event = await signer.signEvent({ kind: 30710, created_at: 1, tags: [['t', 'neoos-use']], content: '' })
    expect(event.pubkey).toBe(pubkey)
    expect(event.id).toMatch(/^[0-9a-f]{64}$/)
    expect(schnorr.verify(event.sig, hexToBytes(event.id), hexToBytes(pubkey))).toBe(true)
  })

  it('generates a fresh random key when no secret is given', async () => {
    const a = await ephemeralSigner().getPublicKey()
    const b = await ephemeralSigner().getPublicKey()
    expect(a).not.toBe(b)
  })

  it('is deterministic for the same secret', async () => {
    expect(await ephemeralSigner('22'.repeat(32)).getPublicKey()).toBe(await ephemeralSigner('22'.repeat(32)).getPublicKey())
  })
})
