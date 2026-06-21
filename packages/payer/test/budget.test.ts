import { describe, it, expect } from 'vitest'
import { monthKey, rollOver, emptyState, MemoryBudgetStore } from '../src/budget'

describe('budget helpers', () => {
  it('formats a UTC month key', () => {
    expect(monthKey(new Date('2026-06-20T12:00:00Z'))).toBe('2026-06')
    expect(monthKey(new Date('2026-01-01T00:00:00Z'))).toBe('2026-01')
  })

  it('rollOver resets state on a new month and preserves it within a month', () => {
    const june = { monthKey: '2026-06', spentSats: 40, dustMsat: { 'a@x.io': 500 } }
    expect(rollOver(june, '2026-06')).toBe(june)
    const rolled = rollOver(june, '2026-07')
    expect(rolled).toEqual(emptyState('2026-07'))
    expect(rolled.spentSats).toBe(0)
  })

  it('MemoryBudgetStore round-trips state', () => {
    const store = new MemoryBudgetStore()
    const s = { monthKey: '2026-06', spentSats: 12, dustMsat: {} }
    store.save(s)
    expect(store.load()).toEqual(s)
  })
})
