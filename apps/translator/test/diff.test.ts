import { describe, it, expect } from 'vitest'
import { wordDiff, hasChange } from '../src/lib/diff'

describe('wordDiff', () => {
  it('marks everything equal when unchanged', () => {
    const d = wordDiff('let there be light', 'let there be light')
    expect(d.every((t) => t.op === 'equal')).toBe(true)
  })

  it('detects a single-word substitution', () => {
    const d = wordDiff('an expanse here', 'a firmament here')
    const removed = d.filter((t) => t.op === 'remove').map((t) => t.text)
    const added = d.filter((t) => t.op === 'add').map((t) => t.text)
    expect(removed).toContain('expanse')
    expect(added).toContain('firmament')
    // shared words preserved
    expect(d.some((t) => t.op === 'equal' && t.text === 'here')).toBe(true)
  })

  it('handles pure additions and removals', () => {
    expect(wordDiff('', 'new words').filter((t) => t.op === 'add').length).toBeGreaterThan(0)
    expect(wordDiff('old words', '').filter((t) => t.op === 'remove').length).toBeGreaterThan(0)
  })

  it('reconstructs both sides from the diff', () => {
    const before = 'the quick brown fox'
    const after = 'the slow brown dog'
    const d = wordDiff(before, after)
    const reBefore = d.filter((t) => t.op !== 'add').map((t) => t.text).join('')
    const reAfter = d.filter((t) => t.op !== 'remove').map((t) => t.text).join('')
    expect(reBefore).toBe(before)
    expect(reAfter).toBe(after)
  })
})

describe('hasChange', () => {
  it('ignores surrounding whitespace', () => {
    expect(hasChange('  same  ', 'same')).toBe(false)
    expect(hasChange('a', 'b')).toBe(true)
  })
})
