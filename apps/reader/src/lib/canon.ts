/**
 * The Protestant 66-book canon — for the reader's "show 66 / show all 87" toggle.
 * Listed in standard order so a 66-only view reads like a familiar Bible.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
export const CANON_66_ORDER: readonly string[] = [
  // Old Testament (39)
  'GEN', 'EXO', 'LEV', 'NUM', 'DEU', 'JOS', 'JDG', 'RUT', '1SA', '2SA', '1KI', '2KI',
  '1CH', '2CH', 'EZR', 'NEH', 'EST', 'JOB', 'PSA', 'PRO', 'ECC', 'SNG', 'ISA', 'JER',
  'LAM', 'EZK', 'DAN', 'HOS', 'JOL', 'AMO', 'OBA', 'JON', 'MIC', 'NAH', 'HAB', 'ZEP',
  'HAG', 'ZEC', 'MAL',
  // New Testament (27)
  'MAT', 'MRK', 'LUK', 'JHN', 'ACT', 'ROM', '1CO', '2CO', 'GAL', 'EPH', 'PHP', 'COL',
  '1TH', '2TH', '1TI', '2TI', 'TIT', 'PHM', 'HEB', 'JAS', '1PE', '2PE', '1JN', '2JN',
  '3JN', 'JUD', 'REV',
]

const order = new Map(CANON_66_ORDER.map((id, i) => [id, i]))

export const CANON_66 = new Set(CANON_66_ORDER)

export function isCanon66(bookId: string): boolean {
  return CANON_66.has(bookId)
}

/** The 66-canon rank of a book (for sorting a 66-only view), or Infinity if extended. */
export function canon66Rank(bookId: string): number {
  return order.get(bookId) ?? Infinity
}
