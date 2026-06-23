import { describe, it, expect } from 'vitest'
import { fetchVerseData, publishNote, TRANSLATION_ID } from '../src/lib/relay-data'
import { RelayPool, MockRelay } from '@neoark/relay'
import { keypairFromSeed, signEvent } from '@neoark/manifest'
import { submitProposal, parseProposal, submitReview, parseReview, mergeProposal } from '@neoark/translation-protocol'

const author = keypairFromSeed('a1'.repeat(32))
const reviewers = ['b1', 'b2', 'b3'].map((s) => keypairFromSeed(s.repeat(32)))
const noteAuthor = keypairFromSeed('cc'.repeat(32))
const ref = { bookId: 'GEN', chapter: 1, verse: 6 }

function noteEvent(book: string, ch: number, vs: number, content: string, createdAt: number) {
  return signEvent(
    { kind: 30704, created_at: createdAt, tags: [['ark_ref', book, String(ch), String(vs)], ['ark_translation', TRANSLATION_ID]], content },
    noteAuthor.seckey,
  )
}

async function seed(pool: RelayPool) {
  const pe = submitProposal({ ref: { translationId: TRANSLATION_ID, book: 'GEN', chapter: 1, verse: 6 }, newText: 'a firmament', rationale: 'raqia', createdAt: 10 }, author.seckey)
  await pool.publish(pe)
  const proposal = parseProposal(pe)
  const reviews = reviewers.map((k, i) => parseReview(submitReview({ proposalId: proposal.id, vote: 'approve', comment: '', createdAt: 20 + i }, k.seckey)))
  const merge = mergeProposal(proposal, reviews, reviewers[0]!.seckey, 100)
  await pool.publish(merge.event)
  await pool.publish(noteEvent('GEN', 1, 6, 'See raqia in context.', 30))
  await pool.publish(noteEvent('GEN', 1, 1, 'A note on a different verse.', 31))
}

describe('fetchVerseData', () => {
  it('returns the change history + notes for the verse from the relays', async () => {
    const pool = new RelayPool([new MockRelay()])
    await seed(pool)
    const data = await fetchVerseData(pool, ref)
    expect(data.revisions).toHaveLength(1)
    expect(data.revisions[0]!.text).toBe('a firmament')
    expect(data.revisions[0]!.rationale).toBe('raqia')
    expect(data.notes).toHaveLength(1) // only the GEN 1:6 note, not GEN 1:1
    expect(data.notes[0]!.content).toBe('See raqia in context.')
    expect(data.citations.count).toBe(0)
  })

  it('returns empties for a verse with no merges or notes', async () => {
    const pool = new RelayPool([new MockRelay()])
    await seed(pool)
    const data = await fetchVerseData(pool, { bookId: 'JHN', chapter: 3, verse: 16 })
    expect(data.revisions).toEqual([])
    expect(data.notes).toEqual([])
  })

  it('counts free citations (cite SDK kind:30710) for the verse with their sources', async () => {
    const pool = new RelayPool([new MockRelay({ verify: false })])
    // two sites embed GEN 1:6 (single + a range that covers it); one embeds GEN 1:1
    const cite = (verse: string, source: string, at: number) =>
      signEvent({ kind: 30710, created_at: at, tags: [['verse', verse], ['translation', TRANSLATION_ID], ['source', source]], content: '' }, noteAuthor.seckey)
    await pool.publish(cite(`${TRANSLATION_ID}:GEN:1:6`, 'blog.example.com', 1))
    await pool.publish(cite(`${TRANSLATION_ID}:GEN:1:5-7`, 'studyapp.io', 2)) // range covers v6
    await pool.publish(cite(`${TRANSLATION_ID}:GEN:1:1`, 'other.site', 3)) // different verse
    const data = await fetchVerseData(pool, ref)
    expect(data.citations.count).toBe(2)
    expect(data.citations.sources.sort()).toEqual(['blog.example.com', 'studyapp.io'])
  })

  it('publishNote signs a kind:30704 note that fetchVerseData then returns', async () => {
    const pool = new RelayPool([new MockRelay()])
    const ok = await publishNote(pool, noteAuthor.seckey, ref, 'raqia = a solid dome', 50)
    expect(ok).toBe(1)
    const data = await fetchVerseData(pool, ref)
    expect(data.notes).toHaveLength(1)
    expect(data.notes[0]!.content).toBe('raqia = a solid dome')
    expect(data.notes[0]!.author).toBe(noteAuthor.pubkey)
  })

  it('ignores merges whose proposal is for another verse', async () => {
    const pool = new RelayPool([new MockRelay()])
    // a proposal+merge for GEN 2:1, then query GEN 1:6
    const pe = submitProposal({ ref: { translationId: TRANSLATION_ID, book: 'GEN', chapter: 2, verse: 1 }, newText: 'x', rationale: 'r', createdAt: 10 }, author.seckey)
    await pool.publish(pe)
    const proposal = parseProposal(pe)
    const reviews = reviewers.map((k, i) => parseReview(submitReview({ proposalId: proposal.id, vote: 'approve', comment: '', createdAt: 20 + i }, k.seckey)))
    await pool.publish(mergeProposal(proposal, reviews, reviewers[0]!.seckey, 100).event)
    const data = await fetchVerseData(pool, ref)
    expect(data.revisions).toEqual([])
  })
})
