/**
 * Live verse data from the relays — the change history (merges), community notes
 * (kind:30704), and use-proof count behind the verse pop-up. Read-only; queries
 * the same relays the translator portal publishes to.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { RelayPool, WebSocketRelay, DEFAULT_RELAYS } from '@neoark/relay'
import type { WebSocketFactory } from '@neoark/relay'
import { parseMerge, parseProposal } from '@neoark/translation-protocol'
import { parseNote, type CommunityNote } from './notes'
import { signWith } from './identity'
import type { Revision } from './history'

export const TRANSLATION_ID = 'neoos-en-2026'
const KIND_PROPOSAL = 30702
const KIND_REVIEW = 30703
const KIND_NOTE = 30704

export function createReaderPool(): RelayPool {
  const factory = ((u: string) => new WebSocket(u)) as unknown as WebSocketFactory
  return new RelayPool(DEFAULT_RELAYS.map((u) => new WebSocketRelay(u, factory, { timeoutMs: 8000 })))
}

/** Sign + publish a community note (kind:30704) for a verse. Returns relays accepted. */
export async function publishNote(
  pool: RelayPool,
  seckey: string,
  ref: { bookId: string; chapter: number; verse: number },
  content: string,
  createdAt: number,
): Promise<number> {
  const event = signWith(seckey, {
    kind: KIND_NOTE,
    created_at: createdAt,
    tags: [
      ['ark_ref', ref.bookId, String(ref.chapter), String(ref.verse)],
      ['ark_translation', TRANSLATION_ID],
    ],
    content: content.trim(),
  })
  const acks = await pool.publish(event)
  return acks.filter((a) => a.ok).length
}

// The cite SDK's free, on-render citation (NO payment), distinct from the
// payment-tied UP-1 use-proof (kind:30078). This is what "Where is this verse
// used?" should count — real embeds across the web, while reading stays free.
const KIND_CITATION = 30710

export interface Citation {
  count: number
  /** Distinct sources (page host, context, or consumer pubkey) embedding the verse. */
  sources: string[]
}

export interface VerseData {
  revisions: Revision[]
  notes: CommunityNote[]
  citations: Citation
}

function tryParse<T>(fn: () => T): T | null {
  try {
    return fn()
  } catch {
    return null
  }
}

/** Does a cite `verse` tag ("tid:book:ch:vs" or "…:a-b") cover this verse? */
function citationCoversVerse(verseTag: string, ref: { bookId: string; chapter: number; verse: number }): boolean {
  const parts = verseTag.split(':')
  if (parts.length < 4) return false
  const [tid, book, ch, vs] = parts
  if (tid !== TRANSLATION_ID || book !== ref.bookId || Number(ch) !== ref.chapter) return false
  const [a, b] = (vs ?? '').split('-').map(Number)
  return ref.verse >= a && ref.verse <= (Number.isFinite(b) ? b : a)
}

/** Count free citations (cite SDK kind:30710) for a verse + their sources. */
export async function fetchCitations(pool: RelayPool, ref: { bookId: string; chapter: number; verse: number }): Promise<Citation> {
  const events = await pool.query({ kinds: [KIND_CITATION], limit: 1000 }).catch(() => [])
  const sources = new Set<string>()
  let count = 0
  for (const e of events) {
    const verses = e.tags.filter((t) => t[0] === 'verse').map((t) => t[1] ?? '')
    if (!verses.some((v) => citationCoversVerse(v, ref))) continue
    count++
    const src = e.tags.find((t) => t[0] === 'source')?.[1] ?? e.tags.find((t) => t[0] === 'context')?.[1] ?? `${e.pubkey.slice(0, 8)}…`
    sources.add(src)
  }
  return { count, sources: [...sources] }
}

/** Fetch the live change history, notes, and citation count for one verse. */
export async function fetchVerseData(
  pool: RelayPool,
  ref: { bookId: string; chapter: number; verse: number },
): Promise<VerseData> {
  const [proposalEvents, reviewEvents, noteEvents, citations] = await Promise.all([
    pool.query({ kinds: [KIND_PROPOSAL], limit: 500 }),
    pool.query({ kinds: [KIND_REVIEW], limit: 1000 }),
    pool.query({ kinds: [KIND_NOTE], limit: 500 }),
    fetchCitations(pool, ref),
  ])

  // Proposals indexed by id → text + rationale for the merges that reference them.
  const proposals = new Map<string, ReturnType<typeof parseProposal>>()
  for (const e of proposalEvents) {
    const p = tryParse(() => parseProposal(e))
    if (p) proposals.set(p.id, p)
  }

  // Merges for THIS verse → revisions (newest first).
  const revisions: Revision[] = []
  for (const e of reviewEvents) {
    const m = tryParse(() => parseMerge(e))
    if (!m) continue
    const p = proposals.get(m.proposalId)
    if (!p) continue
    if (p.ref.translationId !== TRANSLATION_ID || p.ref.book !== ref.bookId || p.ref.chapter !== ref.chapter || p.ref.verse !== ref.verse) continue
    revisions.push({
      mergeEventId: m.id,
      text: p.newText,
      rationale: p.rationale,
      maintainer: m.maintainer,
      mergedAt: m.event.created_at,
      // The merge is the on-relay record; Bitcoin anchoring is a separate OTS
      // batch not verified here, so report it honestly as not-yet-anchored.
      anchor: { state: 'none' },
    })
  }
  revisions.sort((a, b) => b.mergedAt - a.mergedAt)

  // Notes for this verse.
  const notes: CommunityNote[] = []
  for (const e of noteEvents) {
    const n = parseNote(e)
    if (n && n.bookId === ref.bookId && n.chapter === ref.chapter && n.verse === ref.verse) notes.push(n)
  }
  notes.sort((a, b) => b.createdAt - a.createdAt)

  return { revisions, notes, citations }
}
