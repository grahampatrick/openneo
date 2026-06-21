/**
 * Shared types for the NeoOS importer.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

/** A single canonical book entry from book-order.json. */
export interface BookMeta {
  index: number
  id: string
  english: string
  hebrew: string
  source: string
}

/** One verse after parsing + naming-map application. */
export interface Verse {
  bookId: string
  bookIndex: number
  chapter: number
  verse: number
  /** Final NeoOS text (naming map applied). */
  text: string
  /** Verbatim source text before any substitution — kept for audit. */
  original: string
  /** Source corpus tag, e.g. "BSB", "KJV-Apocrypha-PD". */
  source: string
}

/** A Nostr-compatible signed event (NIP-01 envelope). */
export interface ArkEvent {
  id: string
  pubkey: string
  created_at: number
  kind: number
  tags: string[][]
  content: string
  sig: string
}

/** Per-book Merkle summary embedded in the manifest. */
export interface BookHash {
  index: number
  id: string
  english: string
  hebrew: string
  source: string
  chapters: number
  verses: number
  /** blake3 hash of the book (over its chapter hashes). */
  hash: string
}
