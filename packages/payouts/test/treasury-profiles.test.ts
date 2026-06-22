import { describe, it, expect } from 'vitest'
import { createTreasury, computePayout, debit, DEFAULT_PER_MERGE_SATS } from '../src/treasury'
import { MemoryProfileRegistry, profilesFromMetadata } from '../src/profiles'

describe('treasury', () => {
  it('defaults to 500 sats per merge (OQ-7)', () => {
    expect(createTreasury(1000).perMergeSats).toBe(DEFAULT_PER_MERGE_SATS)
  })

  it('funds a payout when the balance covers the reward', () => {
    const c = computePayout(createTreasury(1000))
    expect(c.fundable).toBe(true)
    expect(c.amountSat).toBe(500)
  })

  it('refuses when the balance is short (no partial payouts)', () => {
    const c = computePayout(createTreasury(300))
    expect(c.fundable).toBe(false)
    expect(c.reason).toMatch(/insufficient/)
  })

  it('debits the balance and rejects over-debit', () => {
    const t = createTreasury(1000)
    debit(t, 500)
    expect(t.balanceSats).toBe(500)
    expect(() => debit(t, 600)).toThrow(/exceeds/)
  })

  it('validates constructor inputs', () => {
    expect(() => createTreasury(-1)).toThrow()
    expect(() => createTreasury(100, 0)).toThrow()
  })
})

describe('profiles', () => {
  it('registers and resolves a Lightning address (case-insensitive pubkey)', () => {
    const r = new MemoryProfileRegistry().set('ABCD', 'ruiz@strike.me')
    expect(r.lightningAddress('abcd')).toBe('ruiz@strike.me')
    expect(r.lightningAddress('ffff')).toBeUndefined()
  })

  it('builds a resolver from kind:0 metadata (lud16)', () => {
    const r = profilesFromMetadata([
      { pubkey: 'aa', content: JSON.stringify({ name: 'Ruiz', lud16: 'ruiz@strike.me' }) },
      { pubkey: 'bb', content: JSON.stringify({ name: 'NoAddr' }) },
      { pubkey: 'cc', content: 'not-json' },
    ])
    expect(r.lightningAddress('aa')).toBe('ruiz@strike.me')
    expect(r.lightningAddress('bb')).toBeUndefined()
    expect(r.lightningAddress('cc')).toBeUndefined()
  })
})
