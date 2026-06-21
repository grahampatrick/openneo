/**
 * Reader types.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export interface Verse {
  bookId: string
  chapter: number
  verse: number
  text: string
}

export interface BookMeta {
  index: number
  id: string
  english: string
  hebrew: string
}

/** A parsed scripture reference (verse range optional). */
export interface Reference {
  bookId: string
  chapter: number
  verseStart?: number
  verseEnd?: number
}
