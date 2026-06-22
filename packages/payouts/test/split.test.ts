import { describe, it, expect } from 'vitest'
import { computeMergeSplit, DEFAULT_SPLIT } from '../src/split'

const T = 'a'.repeat(64)
const r1 = 'b'.repeat(64)
const r2 = 'c'.repeat(64)
const r3 = 'd'.repeat(64)
const S = 'e'.repeat(64)

describe('computeMergeSplit', () => {
  it('70/20/10 with a distinct submitter + 2 reviewers, conserving sats', () => {
    const shares = computeMergeSplit({ translator: T, reviewers: [r1, r2], submitter: S }, 1000)
    const byRole = Object.fromEntries(shares.map((s) => [s.role + ':' + s.pubkey.slice(0, 1), s.sats]))
    // reviewers: 20% = 200, /2 = 100 each; submitter 10% = 100; translator gets the rest
    expect(byRole['reviewer:b']).toBe(100)
    expect(byRole['reviewer:c']).toBe(100)
    expect(byRole['submitter:e']).toBe(100)
    expect(byRole['translator:a']).toBe(700)
    expect(shares.reduce((a, s) => a + s.sats, 0)).toBe(1000) // exact
  })

  it('folds the submitter share into the translator when there is no distinct submitter', () => {
    const shares = computeMergeSplit({ translator: T, reviewers: [r1, r2] }, 1000)
    const translator = shares.find((s) => s.role === 'translator')
    expect(translator?.sats).toBe(800) // 70% + folded 10% submitter
    expect(shares.some((s) => s.role === 'submitter')).toBe(false)
    expect(shares.reduce((a, s) => a + s.sats, 0)).toBe(1000)
  })

  it('absorbs rounding dust into the translator (3 reviewers of 200)', () => {
    const shares = computeMergeSplit({ translator: T, reviewers: [r1, r2, r3] }, 1000)
    // reviewer pool 200 / 3 = 66 each (198); translator gets 1000 - 198 - 100(submitter folded? no submitter) ...
    const total = shares.reduce((a, s) => a + s.sats, 0)
    expect(total).toBe(1000) // nothing lost to rounding
    expect(shares.filter((s) => s.role === 'reviewer').every((s) => s.sats === 66)).toBe(true)
  })

  it('pays only the translator when there are no reviewers', () => {
    const shares = computeMergeSplit({ translator: T, reviewers: [] }, 500)
    expect(shares).toHaveLength(1)
    expect(shares[0]).toMatchObject({ role: 'translator', sats: 500 })
  })

  it('excludes the translator from the reviewer set (no self-pay double)', () => {
    const shares = computeMergeSplit({ translator: T, reviewers: [T, r1] }, 1000)
    expect(shares.filter((s) => s.role === 'reviewer').map((s) => s.pubkey)).toEqual([r1])
  })

  it('rejects bad totals or non-100 percents', () => {
    expect(() => computeMergeSplit({ translator: T, reviewers: [] }, -1)).toThrow(/non-negative/)
    expect(() => computeMergeSplit({ translator: T, reviewers: [] }, 100, { translator: 50, reviewers: 20, submitter: 10 })).toThrow(/sum to 100/)
  })

  it('exposes the default split', () => {
    expect(DEFAULT_SPLIT).toEqual({ translator: 70, reviewers: 20, submitter: 10 })
  })
})
