import { describe, it, expect } from 'vitest'
import { computeSplits } from '../src/splits'
import { testManifest } from './helpers'

describe('computeSplits', () => {
  const m = testManifest()

  it('floors whole sats and reports sub-sat dust in millisats', () => {
    const shares = computeSplits(m, 10)
    expect(shares.map((s) => s.sats)).toEqual([7, 1, 1, 0])
    expect(shares.map((s) => s.dustMsat)).toEqual([0, 500, 0, 500])
  })

  it('conserves value: paid sats + dust = total', () => {
    const total = 10
    const shares = computeSplits(m, total)
    const paid = shares.reduce((a, s) => a + s.sats, 0)
    const dustSats = shares.reduce((a, s) => a + s.dustMsat, 0) / 1000
    expect(paid + dustSats).toBe(total)
  })

  it('handles a charge smaller than the recipient count (all dust)', () => {
    const shares = computeSplits(m, 1)
    expect(shares.every((s) => s.sats === 0)).toBe(true)
    expect(shares.reduce((a, s) => a + s.dustMsat, 0)).toBe(1000)
  })

  it('is exact when weights divide evenly', () => {
    const even = testManifest({
      splits: [
        { lightning_address: 'a@x.io', weight: 50, role: 'a' },
        { lightning_address: 'b@x.io', weight: 50, role: 'b' },
      ],
    })
    expect(computeSplits(even, 100).map((s) => s.sats)).toEqual([50, 50])
  })

  it('rejects a non-integer or negative total', () => {
    expect(() => computeSplits(m, 1.5)).toThrow(/non-negative integer/)
    expect(() => computeSplits(m, -1)).toThrow(/non-negative integer/)
  })
})
