import { describe, it, expect } from 'vitest'
import { summarize, type NostrEventLite } from '../src/stats-core'

const TID = 'neoos-en-2026'
const ev = (id: string, kind: number, tags: string[][]): NostrEventLite => ({ id, kind, pubkey: 'p', tags, content: '' })

describe('summarize', () => {
  it('counts proposals, merges, payouts (summing sats), and maintainers', () => {
    const events: NostrEventLite[] = [
      ev('p1', 30702, [['ark_translation', TID]]),
      ev('p2', 30702, [['ark_translation', TID]]),
      ev('m1', 30703, [['ark_action', 'merge']]),
      ev('r1', 30703, [['ark_action', 'review']]), // a vote, not a merge
      ev('pay1', 30712, [['ark_action', 'payout'], ['amount_sat', '400']]),
      ev('pay2', 30712, [['ark_action', 'payout'], ['amount_sat', '100']]),
      ev('gov', 30750, [['d', TID], ['maintainer', 'a'], ['maintainer', 'b']]),
    ]
    const s = summarize(events, TID)
    expect(s).toEqual({ proposals: 2, merges: 1, payouts: 2, satsPaid: 500, maintainers: 2 })
  })

  it('deduplicates events seen on multiple relays', () => {
    const dup = ev('m1', 30703, [['ark_action', 'merge']])
    expect(summarize([dup, dup, dup], TID).merges).toBe(1)
  })

  it('ignores proposals from other translations', () => {
    expect(summarize([ev('x', 30702, [['ark_translation', 'web-en-2020']])], TID).proposals).toBe(0)
  })

  it('takes the largest maintainer set across governance events', () => {
    const events = [
      ev('g1', 30750, [['d', TID], ['maintainer', 'a']]),
      ev('g2', 30750, [['d', TID], ['maintainer', 'a'], ['maintainer', 'b'], ['maintainer', 'c']]),
    ]
    expect(summarize(events, TID).maintainers).toBe(3)
  })
})
