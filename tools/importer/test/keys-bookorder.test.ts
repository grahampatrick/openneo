import { describe, it, expect } from 'vitest'
import { loadNeoosKey } from '../src/keys'
import { bookIdForName, bookMeta, BOOKS } from '../src/book-order'
import { buildAccuracyAudit } from '../src/accuracy'
import type { Verse } from '../src/types'

describe('loadNeoosKey', () => {
  it('derives a deterministic dev key with no env secret', () => {
    const a = loadNeoosKey({})
    const b = loadNeoosKey({})
    expect(a.isDev).toBe(true)
    expect(a.pubkey).toBe(b.pubkey)
    expect(a.pubkey).toHaveLength(64)
  })

  it('uses NEOOS_SECKEY when provided', () => {
    const sec = '11'.repeat(32)
    const k = loadNeoosKey({ NEOOS_SECKEY: sec })
    expect(k.isDev).toBe(false)
    expect(k.pubkey).not.toBe(loadNeoosKey({}).pubkey)
  })

  it('rejects malformed NEOOS_SECKEY', () => {
    expect(() => loadNeoosKey({ NEOOS_SECKEY: 'not-hex' })).toThrow(/32-byte hex/)
  })
})

describe('book-order', () => {
  it('has 87 unique books and resolves names + aliases', () => {
    expect(BOOKS).toHaveLength(87)
    expect(bookIdForName('Genesis')).toBe('GEN')
    expect(bookIdForName('1 Samuel')).toBe('1SA')
    expect(bookIdForName('Psalm')).toBe('PSA')
    expect(bookIdForName('Psalms')).toBe('PSA')
    expect(bookIdForName('Song of Solomon')).toBe('SNG')
    expect(bookIdForName('nope')).toBeUndefined()
  })

  it('exposes metadata and the fixed Jasher id collision', () => {
    expect(bookMeta('GEN').english).toBe('Genesis')
    expect(bookMeta('JSR').english).toBe('Jasher')
    expect(bookMeta('JAS').english).toBe('James')
  })

  it('throws on unknown id', () => {
    expect(() => bookMeta('ZZZ')).toThrow(/Unknown book id/)
  })
})

describe('accuracy audit', () => {
  it('captures firmament corrections and skipped rules', () => {
    const verses: Verse[] = [
      {
        bookId: 'GEN',
        bookIndex: 1,
        chapter: 1,
        verse: 6,
        original: 'Let there be an expanse',
        text: 'Let there be a firmament',
        source: 'BSB',
      },
    ]
    const audit = buildAccuracyAudit(verses)
    expect(audit.applied_rules).toBeGreaterThan(0)
    expect(audit.skipped_rules.length).toBeGreaterThan(0)
    const gen16 = audit.corrections.find((c) => c.ref === 'GEN 1:6')
    expect(gen16?.original).toContain('expanse')
    expect(gen16?.correction).toContain('firmament')
  })
})
