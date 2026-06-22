import { describe, it, expect } from 'vitest'
import { PortalAuth, type KeyValueStore } from '../src/lib/auth-client'
import { keySigner } from '../src/lib/signer'
import { keypairFromSeed } from '@neoark/manifest'
import { hexToNpub } from '@neoark/auth'

function memStore(): KeyValueStore {
  const m = new Map<string, string>()
  return { get: (k) => m.get(k) ?? null, set: (k, v) => void m.set(k, v), remove: (k) => void m.delete(k) }
}

const kp = keypairFromSeed('a1'.repeat(32))

describe('PortalAuth', () => {
  it('logs in via a NIP-07-style signer and yields an npub session', async () => {
    const t = 1000
    const auth = PortalAuth.create({ jwtSecret: 'sk', store: memStore(), now: () => t })
    const session = await auth.loginWithNip07(keySigner(kp.seckey))
    expect(session.claims.sub).toBe(hexToNpub(kp.pubkey))
    expect(session.claims.method).toBe('nip07')
  })

  it('persists and restores the session', async () => {
    const store = memStore()
    const t = 1000
    const auth = PortalAuth.create({ jwtSecret: 'sk', store, now: () => t })
    await auth.loginWithNip07(keySigner(kp.seckey))
    // a fresh instance over the same store sees the session
    const auth2 = PortalAuth.create({ jwtSecret: 'sk', store, now: () => t })
    expect(auth2.currentSession()?.pubkey).toBe(kp.pubkey)
  })

  it('returns null and clears an expired/invalid session', async () => {
    const store = memStore()
    let t = 1000
    const auth = PortalAuth.create({ jwtSecret: 'sk', store, now: () => t })
    await auth.loginWithNip07(keySigner(kp.seckey))
    t = 1000 + 8 * 24 * 3600 // past the default 7-day TTL
    expect(auth.currentSession()).toBeNull()
  })

  it('logs out', async () => {
    const auth = PortalAuth.create({ jwtSecret: 'sk', store: memStore(), now: () => 1000 })
    await auth.loginWithNip07(keySigner(kp.seckey))
    auth.logout()
    expect(auth.currentSession()).toBeNull()
  })

  it('rejects a session signed with a different secret', async () => {
    const store = memStore()
    const auth = PortalAuth.create({ jwtSecret: 'sk', store, now: () => 1000 })
    await auth.loginWithNip07(keySigner(kp.seckey))
    const other = PortalAuth.create({ jwtSecret: 'different', store, now: () => 1000 })
    expect(other.currentSession()).toBeNull()
  })
})
