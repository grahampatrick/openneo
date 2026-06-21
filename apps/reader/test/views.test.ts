import { describe, it, expect } from 'vitest'
import { anchorLabel, sortRevisions, fullyAnchored, type Revision } from '../src/lib/history'
import { parseNote, groupByVerse, notesForVerse, KIND_NOTE, type CommunityNote } from '../src/lib/notes'
import { signEvent, keypairFromSeed } from '@neoark/manifest'

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

describe('community notes', () => {
  const author = keypairFromSeed('aa'.repeat(32))
  const noteEvent = (book: string, ch: number, vs: number, content: string, at: number) =>
    signEvent({ created_at: at, kind: KIND_NOTE, tags: [['ark_ref', book, String(ch), String(vs)]], content }, author.seckey)

  it('parses a kind:30704 note', () => {
    const n = parseNote(noteEvent('GEN', 1, 6, 'raqia = solid surface', 5))
    expect(n).toMatchObject({ bookId: 'GEN', chapter: 1, verse: 6, content: 'raqia = solid surface' })
  })

  it('rejects wrong-kind or ref-less events', () => {
    expect(parseNote(signEvent({ created_at: 1, kind: 1, tags: [], content: '' }, author.seckey))).toBeNull()
    expect(parseNote(signEvent({ created_at: 1, kind: KIND_NOTE, tags: [], content: '' }, author.seckey))).toBeNull()
  })

  it('groups notes by verse, newest first, and looks them up', () => {
    const notes = [
      parseNote(noteEvent('GEN', 1, 6, 'first', 10)),
      parseNote(noteEvent('GEN', 1, 6, 'later', 20)),
      parseNote(noteEvent('JHN', 3, 16, 'love', 5)),
    ].filter((n): n is CommunityNote => n !== null)
    const grouped = groupByVerse(notes)
    expect(notesForVerse(grouped, 'GEN', 1, 6).map((n) => n.content)).toEqual(['later', 'first'])
    expect(notesForVerse(grouped, 'GEN', 1, 6)).toHaveLength(2)
    expect(notesForVerse(grouped, 'ROM', 8, 28)).toEqual([])
  })
})
