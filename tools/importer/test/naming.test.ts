import { describe, it, expect } from 'vitest'
import { buildReplacer, defaultReplacer } from '../src/naming'

const map = {
  version: 'test-1',
  divine_names: {
    replacements: [
      { from: ['LORD God'], to: 'Yahuah Elohiym' },
      { from: ['LORD', 'YHWH'], to: 'Yahuah' },
      { from: ['God'], to: 'Elohiym' },
      { from: ['Jesus Christ'], to: 'Yahusha HaMashiach' },
      { from: ['Jesus'], to: 'Yahusha' },
      { from: ['Lord'], to: 'Adonai' },
    ],
  },
  accuracy_terms: {
    replacements: [
      { from: ['firmament', 'expanse'], to: 'firmament' },
      { from: ['angel'], to: 'messenger' },
      { from: ['hell'], to: 'CONTEXT_DEPENDENT' },
      { from: ['baptize'], to: 'immerse / immersion' },
      { from: ['Sheol'], to: 'Sheol' },
      { from: ['Old Testament'], to: 'Tanakh' },
    ],
  },
}

describe('buildReplacer', () => {
  const r = buildReplacer(map)

  it('replaces the longest match first', () => {
    expect(r.apply('the LORD God spoke')).toBe('the Yahuah Elohiym spoke')
    expect(r.apply('Jesus Christ rose')).toBe('Yahusha HaMashiach rose')
    expect(r.apply('Jesus wept')).toBe('Yahusha wept')
  })

  it('is case-sensitive (lowercase god untouched)', () => {
    expect(r.apply('a god of stone')).toBe('a god of stone')
    expect(r.apply('the God of Abraham')).toBe('the Elohiym of Abraham')
    expect(r.apply('the LORD reigns')).toBe('the Yahuah reigns')
    expect(r.apply('the Lord reigns')).toBe('the Adonai reigns')
  })

  it('does not rewrite substrings inside other words', () => {
    expect(r.apply('Godhead')).toBe('Godhead')
    expect(r.apply("God's people")).toBe("Elohiym's people")
  })

  it('fixes a/an agreement when the replacement changes initial sound', () => {
    expect(r.apply('an expanse above')).toBe('a firmament above')
    expect(r.apply('An expanse above')).toBe('A firmament above')
    expect(r.apply('an angel came')).toBe('a messenger came')
  })

  it('does not double-apply within one pass', () => {
    // "LORD God" -> "Yahuah Elohiym", and "Elohiym" is not re-scanned.
    expect(r.apply('LORD God')).toBe('Yahuah Elohiym')
  })

  it('skips context-dependent, ambiguous, identity and metadata entries', () => {
    expect(r.apply('cast into hell')).toBe('cast into hell')
    expect(r.apply('he will baptize you')).toBe('he will baptize you')
    expect(r.apply('down to Sheol')).toBe('down to Sheol')
    expect(r.apply('the Old Testament')).toBe('the Old Testament')
    const reasons = new Set(r.skipped.map((s) => s.reason))
    expect(reasons).toContain('context-dependent')
    expect(reasons).toContain('ambiguous dual form')
    expect(reasons).toContain('identity (retain)')
    expect(reasons).toContain('metadata-only')
  })

  it('exposes the rule set and map version', () => {
    expect(r.version).toBe('test-1')
    expect(r.rules.length).toBeGreaterThan(0)
    // identity "firmament -> firmament" term is dropped; "expanse" kept.
    expect(r.rules.some((x) => x.from === 'expanse' && x.to === 'firmament')).toBe(true)
    expect(r.rules.some((x) => x.from === 'firmament')).toBe(false)
  })

  it('handles an empty map without throwing', () => {
    const empty = buildReplacer({ version: 'v0' })
    expect(empty.apply('unchanged text')).toBe('unchanged text')
    expect(empty.rules).toHaveLength(0)
  })
})

describe('defaultReplacer (real naming-map.json)', () => {
  it('applies divine names from the on-disk map', () => {
    const r = defaultReplacer()
    expect(r.apply('the LORD is my shepherd')).toContain('Yahuah')
    expect(r.apply('an expanse')).toBe('a firmament')
    expect(r.rules.length).toBeGreaterThan(50)
  })
})
