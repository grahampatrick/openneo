import { describe, it, expect } from 'vitest'
import {
  buildProfileEvent,
  parseProfile,
  isLightningAddress,
  publishProfile,
  fetchProfile,
  KIND_METADATA,
} from '../src/lib/profile'
import { keySigner } from '../src/lib/signer'
import { keypairFromSeed, verifyEventSignature } from '@neoark/manifest'
import { profilesFromMetadata } from '@neoark/payouts'
import { RelayPool, MockRelay } from '@neoark/relay'

const kp = keypairFromSeed('a1'.repeat(32))

describe('isLightningAddress', () => {
  it('accepts name@domain, rejects junk and LNURLs', () => {
    expect(isLightningAddress('ruiz@strike.me')).toBe(true)
    expect(isLightningAddress('a@b.co')).toBe(true)
    expect(isLightningAddress('nope')).toBe(false)
    expect(isLightningAddress('LNURL1DP68…')).toBe(false)
    expect(isLightningAddress('a@b')).toBe(false)
  })
})

describe('buildProfileEvent / parseProfile', () => {
  it('builds a kind:0 event with name + lud16 and round-trips', () => {
    const e = buildProfileEvent({ name: "Sha'ul", lud16: 'paul@strike.me', about: 'translator' }, 100)
    expect(e.kind).toBe(KIND_METADATA)
    const parsed = parseProfile({ ...e, id: 'x', pubkey: 'p', sig: 's' })
    expect(parsed).toEqual({ name: "Sha'ul", about: 'translator', lud16: 'paul@strike.me' })
  })

  it('rejects an invalid lud16 at build time', () => {
    expect(() => buildProfileEvent({ lud16: 'not-an-address' }, 1)).toThrow(/name@domain/)
  })

  it('drops an invalid lud16 on parse (lenient read)', () => {
    const bad = { id: 'x', pubkey: 'p', sig: 's', kind: 0, created_at: 1, tags: [], content: JSON.stringify({ lud16: 'bad' }) }
    expect(parseProfile(bad).lud16).toBeUndefined()
  })

  it('tolerates malformed JSON content', () => {
    expect(parseProfile({ id: 'x', pubkey: 'p', sig: 's', kind: 0, created_at: 1, tags: [], content: 'not json' })).toEqual({})
  })
})

describe('publish + fetch round-trip + payout resolution', () => {
  it('publishes a profile, fetches the newest, and @neoark/payouts resolves the address', async () => {
    const pool = new RelayPool([new MockRelay()])
    const signer = keySigner(kp.seckey)

    const { event, relaysAccepted } = await publishProfile({ name: 'Ruiz', lud16: 'ruiz@strike.me' }, signer, pool, 100)
    expect(relaysAccepted).toBe(1)
    expect(event.pubkey).toBe(kp.pubkey)
    expect(verifyEventSignature(event)).toBe(true)

    const fetched = await fetchProfile(pool, kp.pubkey)
    expect(fetched?.lud16).toBe('ruiz@strike.me')

    // the M19 payout runner reads it via @neoark/payouts
    const resolver = profilesFromMetadata([{ pubkey: event.pubkey, content: event.content }])
    expect(resolver.lightningAddress(kp.pubkey)).toBe('ruiz@strike.me')
  })

  it('returns the newest profile when several exist (kind:0 is replaceable)', async () => {
    const pool = new RelayPool([new MockRelay({ verify: false })])
    const signer = keySigner(kp.seckey)
    await publishProfile({ lud16: 'old@strike.me' }, signer, pool, 100)
    await publishProfile({ lud16: 'new@strike.me' }, signer, pool, 200)
    expect((await fetchProfile(pool, kp.pubkey))?.lud16).toBe('new@strike.me')
  })

  it('returns null when no profile exists', async () => {
    const pool = new RelayPool([new MockRelay()])
    expect(await fetchProfile(pool, 'f'.repeat(64))).toBeNull()
  })
})
