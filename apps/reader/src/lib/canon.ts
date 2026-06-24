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

/**
 * The full NeoOS reading order (87) — the extended canon arrangement: Jubilees /
 * Enoch / Jasher right after the Torah, the Twelve and Writings grouped, John's
 * Gospel + epistles + Revelation last. This is the default reading order; the 66
 * toggle reverts to the standard canonical order above. Display order only — the
 * corpus content-address is unchanged.
 */
export const NEOOS_ORDER: readonly string[] = [
  'GEN', 'EXO', 'LEV', 'NUM', 'DEU',
  'JUB', 'ENO', 'JSR',
  'JOS', 'JDG', '1SA', '2SA', '1KI', '2KI', 'ISA', 'JER', 'LJE', 'EZK', 'TOB', 'BAR', '2BA',
  'HOS', 'JOL', 'AMO', 'OBA', 'JON', 'MIC', 'NAH', 'HAB', 'ZEP', 'HAG', 'ZEC', 'MAL',
  'PSA', 'PSL', 'PRO', 'JOB', 'WIS', 'SIR',
  'SNG', 'RUT', 'LAM', 'ECC', 'EST', 'JDT',
  '1CH', '2CH', 'MAN', 'DAN', 'S3Y', 'SUS', 'BEL', 'EZR', 'NEH', '1ES', '2ES', '1MA', '2MA', '3MA', '4MA',
  'MAT', 'MRK', 'LUK', 'ACT',
  'JAS', '1PE', '2PE', 'JUD',
  '1TI', 'TIT', '1TH', '2TH', 'ROM', 'GAL', '2TI', '1CO', '2CO', 'EPH', 'PHP', 'COL', 'PHM', 'HEB',
  'JHN', '1JN', '2JN', '3JN', 'REV',
]

const neoosOrder = new Map(NEOOS_ORDER.map((id, i) => [id, i]))

/** NeoOS reading-order rank of a book (for the full 87 view). */
export function neoosRank(bookId: string): number {
  return neoosOrder.get(bookId) ?? Infinity
}
