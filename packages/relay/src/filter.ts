/**
 * Translate a high-level use-proof query into a Nostr REQ filter, and
 * post-filter results by the fields relays do not index.
 *
 * Use-proofs (kind:30078) carry their translation + passage in multi-character
 * tags (`ark_translation`, `ark_passage`) that public relays don't index. So we
 * filter at the relay by kind + time window + limit, then narrow client-side.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { USE_PROOF_KIND } from '@neoark/manifest'
import type { UseProof } from '@neoark/manifest'
import type { NostrFilter, UseProofQuery } from './types'

/** Build the relay-level filter (kind + time window + limit). */
export function buildUseProofFilter(query: UseProofQuery): NostrFilter {
  const filter: NostrFilter = { kinds: [USE_PROOF_KIND] }
  if (query.since !== undefined) filter.since = query.since
  if (query.until !== undefined) filter.until = query.until
  if (query.limit !== undefined) filter.limit = query.limit
  return filter
}

/** Client-side predicate: does a parsed use-proof match the query? */
export function matchesQuery(proof: UseProof, query: UseProofQuery): boolean {
  if (proof.translation_id !== query.translationId) return false
  const p = query.passage
  if (!p) return true
  if (proof.passage.book !== p.book) return false
  if (p.chapter !== undefined && proof.passage.chapter !== p.chapter) return false
  // Verse-range overlap (inclusive), when a range is specified.
  if (p.verseStart !== undefined) {
    const qEnd = p.verseEnd ?? p.verseStart
    if (proof.passage.verseEnd < p.verseStart || proof.passage.verseStart > qEnd) return false
  }
  return true
}
