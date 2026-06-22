import { describe, it, expect } from 'vitest'
import { AuthService } from '../src/session'
import { ChallengeStore } from '../src/challenge'
import { buildNip07AuthEvent } from '../src/nip07'
import { keypairFromSeed, signEvent } from '@neoark/manifest'
import { hexToNpub } from '../src/npub'
import { secp256k1 } from '@noble/curves/secp256k1'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'

function service(now: () => number) {
  return new AuthService({ jwtSecret: 'sk', now, challengeStore: new ChallengeStore({ now }), sessionTtlSec: 3600 })
}

describe('AuthService — NIP-07 flow', () => {
  const kp = keypairFromSeed('11'.repeat(32))

  it('challenge → sign → verify → npub-tied session', () => {
    const t = 1000
    const svc = service(() => t)
    const ch = svc.issueChallenge()
    const signed = signEvent(buildNip07AuthEvent(ch.k1, t), kp.seckey)
    const r = svc.verifyNip07(signed)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.claims.sub).toBe(hexToNpub(kp.pubkey))
    expect(r.value.claims.method).toBe('nip07')
    expect(svc.verifySession(r.value.token).ok).toBe(true)
  })

  it('rejects a replayed challenge', () => {
    const t = 1000
    const svc = service(() => t)
    const ch = svc.issueChallenge()
    const signed = signEvent(buildNip07AuthEvent(ch.k1, t), kp.seckey)
    expect(svc.verifyNip07(signed).ok).toBe(true)
    const replay = svc.verifyNip07(signed)
    expect(replay.ok).toBe(false)
    if (!replay.ok) expect(replay.error).toMatch(/already-used/)
  })

  it('rejects an event whose challenge was never issued', () => {
    const t = 1000
    const svc = service(() => t)
    const signed = signEvent(buildNip07AuthEvent('ff'.repeat(32), t), kp.seckey)
    expect(svc.verifyNip07(signed).ok).toBe(false)
  })
})

describe('AuthService — LNURL-auth flow', () => {
  const linkSec = hexToBytes('22'.repeat(32))
  const key = bytesToHex(secp256k1.getPublicKey(linkSec, true))

  it('challenge → wallet sig → verify → session', () => {
    const t = 1000
    const svc = service(() => t)
    const ch = svc.issueChallenge('https://neoark.org/api/lnurl-auth')
    expect(ch.lnurl?.startsWith('LNURL1')).toBe(true)
    const sig = bytesToHex(secp256k1.sign(hexToBytes(ch.k1), linkSec).toBytes('der'))
    const r = svc.verifyLnurlAuth({ k1: ch.k1, sig, key })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.claims.method).toBe('lnurl-auth')
    expect(r.value.claims.sub.startsWith('npub1')).toBe(true)
    // a Lightning login yields the x-only npub of the linking key
    expect(r.value.claims.pubkey).toBe(key.slice(2))
  })

  it('rejects a bad signature even with a valid challenge', () => {
    const t = 1000
    const svc = service(() => t)
    const ch = svc.issueChallenge()
    const r = svc.verifyLnurlAuth({ k1: ch.k1, sig: '00', key })
    expect(r.ok).toBe(false)
  })
})

describe('AuthService — sessions', () => {
  const kp = keypairFromSeed('11'.repeat(32))

  it('rejects an expired session', () => {
    let t = 1000
    const svc = service(() => t)
    const ch = svc.issueChallenge()
    const signed = signEvent(buildNip07AuthEvent(ch.k1, t), kp.seckey)
    const r = svc.verifyNip07(signed)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    t = 1000 + 3601 // past the 3600s TTL
    expect(svc.verifySession(r.value.token).ok).toBe(false)
  })

  it('rejects a forged session token', () => {
    const svc = service(() => 1000)
    expect(svc.verifySession('a.b.c').ok).toBe(false)
  })

  it('requires a jwt secret', () => {
    expect(() => new AuthService({ jwtSecret: '' })).toThrow(/jwtSecret/)
  })
})
