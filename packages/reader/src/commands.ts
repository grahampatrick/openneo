/**
 * Command logic, free of process/arg concerns so it is unit-testable. `cli.ts`
 * parses argv and calls these.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { queryUseProofs } from '@neoark/relay'
import type { RelayPool, UseProofQuery } from '@neoark/relay'
import type { UseProof } from '@neoark/manifest'
import type { Corpus } from './corpus'
import { parseReference, formatReference } from './reference'
import { renderChapter } from './render'

/** `read` — render a passage. */
export function readPassage(corpus: Corpus, refStr: string, width = 0): string {
  const ref = parseReference(refStr, corpus)
  return renderChapter(corpus, ref, { width })
}

/** `proofs --passage` — query use-proofs for a passage and format them. */
export async function proofsForPassage(
  corpus: Corpus,
  pool: RelayPool,
  refStr: string,
  translationId: string,
): Promise<{ proofs: UseProof[]; text: string }> {
  const ref = parseReference(refStr, corpus)
  const query: UseProofQuery = {
    translationId,
    passage: {
      book: ref.bookId,
      chapter: ref.chapter,
      ...(ref.verseStart !== undefined ? { verseStart: ref.verseStart, verseEnd: ref.verseEnd ?? ref.verseStart } : {}),
    },
  }
  const proofs = await queryUseProofs(query, pool)
  const head = `Use-proofs for ${formatReference(ref, corpus)}: ${String(proofs.length)}`
  const lines = proofs.map(
    (p) => `  ${p.event.pubkey.slice(0, 12)}… read ${p.passage.book} ${String(p.passage.chapter)}:${String(p.passage.verseStart)}-${String(p.passage.verseEnd)} (${String(p.amount_sat)} sat)`,
  )
  return { proofs, text: [head, ...lines].join('\n') }
}

export interface TranslatorStats {
  totalProofs: number
  totalSats: number
  uniquePassages: number
}

/** `translator-stats --pubkey` — aggregate use-proof activity for a translation. */
export async function translatorStats(
  pool: RelayPool,
  translationId: string,
  opts: { pubkey?: string } = {},
): Promise<{ stats: TranslatorStats; text: string }> {
  let proofs = await queryUseProofs({ translationId }, pool)
  if (opts.pubkey) proofs = proofs.filter((p) => p.event.pubkey === opts.pubkey)
  const passages = new Set(proofs.map((p) => `${p.passage.book}:${String(p.passage.chapter)}:${String(p.passage.verseStart)}`))
  const stats: TranslatorStats = {
    totalProofs: proofs.length,
    totalSats: proofs.reduce((a, p) => a + p.amount_sat, 0),
    uniquePassages: passages.size,
  }
  const who = opts.pubkey ? `${opts.pubkey.slice(0, 12)}…` : translationId
  const text = `${who}: ${String(stats.totalProofs)} use-proofs, ${String(stats.totalSats)} sat across ${String(stats.uniquePassages)} passage(s)`
  return { stats, text }
}
