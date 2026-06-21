/**
 * Community notes (kind:30704) — signed commentary linked to a verse range.
 * Build/parse helpers + a per-verse grouping for the toggleable overlay.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import type { NostrEvent } from '@neoark/manifest'

export const KIND_NOTE = 30704

export interface CommunityNote {
  id: string
  author: string
  bookId: string
  chapter: number
  verse: number
  content: string
  createdAt: number
}

/** Parse a kind:30704 note event, or null if malformed. */
export function parseNote(event: NostrEvent): CommunityNote | null {
  if (event.kind !== KIND_NOTE) return null
  const ref = event.tags.find((t) => t[0] === 'ark_ref')
  const book = ref?.[1]
  const ch = ref?.[2]
  const vs = ref?.[3]
  if (book === undefined || ch === undefined || vs === undefined) return null
  return {
    id: event.id,
    author: event.pubkey,
    bookId: book,
    chapter: Number(ch),
    verse: Number(vs),
    content: event.content,
    createdAt: event.created_at,
  }
}

/** Group notes by `${bookId}:${chapter}:${verse}` (newest first per verse). */
export function groupByVerse(notes: CommunityNote[]): Map<string, CommunityNote[]> {
  const map = new Map<string, CommunityNote[]>()
  for (const n of notes) {
    const key = `${n.bookId}:${n.chapter}:${n.verse}`
    const list = map.get(key)
    if (list) list.push(n)
    else map.set(key, [n])
  }
  for (const list of map.values()) list.sort((a, b) => b.createdAt - a.createdAt)
  return map
}

export function notesForVerse(grouped: Map<string, CommunityNote[]>, bookId: string, chapter: number, verse: number): CommunityNote[] {
  return grouped.get(`${bookId}:${chapter}:${verse}`) ?? []
}
