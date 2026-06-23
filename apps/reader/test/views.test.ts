import { describe, it, expect } from 'vitest'
import { anchorLabel, sortRevisions, fullyAnchored, type Revision } from '../src/lib/history'

describe('history (change view)', () => {
  const rev = (id: string, mergedAt: number, anchor: Revision['anchor']): Revision => ({
    mergeEventId: id, text: 't', rationale: 'r', maintainer: 'm', mergedAt, anchor,
  })

  it('labels anchor status with a colour', () => {
    expect(anchorLabel({ state: 'bitcoin', blockHeight: 840000 }).text).toMatch(/block 840000/)
    expect(anchorLabel({ state: 'pending', calendar: 'c' }).text).toMatch(/Anchoring/)
    expect(anchorLabel({ state: 'none' }).text).toMatch(/Not yet/)
  })

  it('sorts revisions newest-first and reports full anchoring', () => {
    const revs = sortRevisions([
      rev('a', 100, { state: 'bitcoin', blockHeight: 1 }),
      rev('b', 300, { state: 'bitcoin', blockHeight: 2 }),
    ])
    expect(revs[0]!.mergeEventId).toBe('b')
    expect(fullyAnchored(revs)).toBe(true)
    expect(fullyAnchored([rev('c', 1, { state: 'pending', calendar: 'x' })])).toBe(false)
    expect(fullyAnchored([])).toBe(false)
  })
})
