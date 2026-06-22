import { describe, it, expect } from 'vitest'
import { keySigner, browserSigner } from '../src/lib/signer'
import { browserStore } from '../src/lib/auth-client'
import { keypairFromSeed, verifyEventSignature } from '@neoark/manifest'

describe('keySigner', () => {
  it('exposes the pubkey and signs a verifiable event', async () => {
    const kp = keypairFromSeed('a1'.repeat(32))
    const signer = keySigner(kp.seckey)
    expect(await signer.getPublicKey()).toBe(kp.pubkey)
    const e = await signer.signEvent({ kind: 30702, created_at: 1, tags: [], content: 'x' })
    expect(e.pubkey).toBe(kp.pubkey)
    expect(verifyEventSignature(e)).toBe(true)
  })
})

describe('browserSigner', () => {
  it('returns null when no NIP-07 extension is present', () => {
    expect(browserSigner()).toBeNull()
  })

  it('returns the injected window.nostr when present', () => {
    const fake = { getPublicKey: () => 'p', signEvent: (e: unknown) => e as never }
    ;(globalThis as unknown as { nostr?: unknown }).nostr = fake
    try {
      expect(browserSigner()).toBe(fake)
    } finally {
      delete (globalThis as unknown as { nostr?: unknown }).nostr
    }
  })
})

describe('browserStore', () => {
  it('round-trips via the available storage (localStorage under jsdom)', () => {
    const store = browserStore()
    store.set('k', 'v')
    expect(store.get('k')).toBe('v')
    store.remove('k')
    expect(store.get('k')).toBeNull()
  })
})
