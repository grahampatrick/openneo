import { describe, it, expect } from 'vitest'
import { CANON_66_ORDER, CANON_66, isCanon66, canon66Rank, NEOOS_ORDER, neoosRank } from '../src/lib/canon'

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

describe('full NeoOS reading order (87)', () => {
  it('lists all 87 books with no duplicates', () => {
    expect(NEOOS_ORDER).toHaveLength(87)
    expect(new Set(NEOOS_ORDER).size).toBe(87)
  })

  it('puts Jubilees/Enoch/Jasher right after the Torah', () => {
    expect(NEOOS_ORDER.slice(0, 8)).toEqual(['GEN', 'EXO', 'LEV', 'NUM', 'DEU', 'JUB', 'ENO', 'JSR'])
  })

  it("ends with John's writings + Revelation last", () => {
    expect(NEOOS_ORDER.slice(-5)).toEqual(['JHN', '1JN', '2JN', '3JN', 'REV'])
  })

  it('ranks by NeoOS order (Jubilees before Joshua; Revelation last)', () => {
    expect(neoosRank('JUB')).toBeLessThan(neoosRank('JOS'))
    expect(neoosRank('JHN')).toBeGreaterThan(neoosRank('LUK')) // John's gospel comes last, after Luke
    expect(neoosRank('REV')).toBe(86)
    expect(neoosRank('ZZZ')).toBe(Infinity)
  })
})
