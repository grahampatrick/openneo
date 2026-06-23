import { describe, it, expect } from 'vitest'
import { CANON_66_ORDER, CANON_66, isCanon66, canon66Rank } from '../src/lib/canon'

describe('Protestant 66 canon', () => {
  it('has exactly 66 books (39 OT + 27 NT)', () => {
    expect(CANON_66_ORDER).toHaveLength(66)
    expect(CANON_66.size).toBe(66)
    expect(CANON_66_ORDER.indexOf('MAT')).toBe(39) // first NT book at index 39
  })

  it('includes the 66 and excludes extended books', () => {
    expect(isCanon66('GEN')).toBe(true)
    expect(isCanon66('REV')).toBe(true)
    expect(isCanon66('MAL')).toBe(true)
    // extended (apocrypha / pseudepigrapha) are excluded
    for (const ext of ['ENO', 'JUB', 'JSR', '2BA', 'TOB', '1MA', 'SIR', 'PSL']) {
      expect(isCanon66(ext)).toBe(false)
    }
  })

  it('ranks the 66 in standard order, Infinity for extended', () => {
    expect(canon66Rank('GEN')).toBe(0)
    expect(canon66Rank('MAL')).toBe(38)
    expect(canon66Rank('MAT')).toBe(39)
    expect(canon66Rank('REV')).toBe(65)
    expect(canon66Rank('ENO')).toBe(Infinity)
  })
})
