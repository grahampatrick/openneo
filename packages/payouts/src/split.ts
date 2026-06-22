/**
 * Per-merge payout split. Unlike the static value-manifest splits, the recipients
 * here are the *actual participants* of one merged proposal: the Translator (who
 * drafted the text), the Reviewers (council members who approved), and optionally
 * the Submitter (who flagged the issue). Shares are role percentages; the
 * Reviewer share is divided evenly among the approvers.
 *
 * Whole sats use floor division so the treasury is never over-spent; the
 * remainder ("rounding dust") is reported so the caller can fold it into the
 * Translator (the largest share) rather than silently lose it.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export interface SplitPercents {
  translator: number
  reviewers: number
  submitter: number
}

/** Default split (OQ-P3-5): Translator 70 / Reviewers 20 / Submitter 10. */
export const DEFAULT_SPLIT: SplitPercents = { translator: 70, reviewers: 20, submitter: 10 }

export interface MergeParticipants {
  /** Translator pubkey (hex) — the proposal author. */
  translator: string
  /** Approving reviewer pubkeys (hex) who split the reviewer share. */
  reviewers: string[]
  /** Submitter pubkey (hex), if a distinct flag-only submitter exists. */
  submitter?: string
}

export interface SplitShare {
  pubkey: string
  role: 'translator' | 'reviewer' | 'submitter'
  sats: number
}

/**
 * Split `totalSats` across the merge participants by role percentages. When there
 * is no distinct submitter, the submitter share folds into the translator. The
 * reviewer share splits evenly among approvers (floor each; leftover folds into
 * the translator). The translator absorbs all rounding dust so sum(shares) ===
 * totalSats exactly.
 */
export function computeMergeSplit(
  participants: MergeParticipants,
  totalSats: number,
  percents: SplitPercents = DEFAULT_SPLIT,
): SplitShare[] {
  if (!Number.isInteger(totalSats) || totalSats < 0) {
    throw new Error(`totalSats must be a non-negative integer, got ${String(totalSats)}`)
  }
  const sum = percents.translator + percents.reviewers + percents.submitter
  if (sum !== 100) throw new Error(`split percents must sum to 100, got ${String(sum)}`)

  const hasSubmitter = !!participants.submitter && participants.submitter !== participants.translator
  const reviewers = [...new Set(participants.reviewers.map((r) => r.toLowerCase()))].filter(
    (r) => r !== participants.translator.toLowerCase(),
  )

  // Reviewer pool (sats), then split evenly among approvers.
  const reviewerPool = reviewers.length > 0 ? Math.floor((totalSats * percents.reviewers) / 100) : 0
  const perReviewer = reviewers.length > 0 ? Math.floor(reviewerPool / reviewers.length) : 0

  // Submitter share (only if distinct), else folds into translator.
  const submitterSats = hasSubmitter ? Math.floor((totalSats * percents.submitter) / 100) : 0

  const shares: SplitShare[] = []
  for (const r of reviewers) shares.push({ pubkey: r, role: 'reviewer', sats: perReviewer })
  if (hasSubmitter && participants.submitter) {
    shares.push({ pubkey: participants.submitter.toLowerCase(), role: 'submitter', sats: submitterSats })
  }

  // Translator gets the rest — its base share plus all rounding dust + folded shares.
  const allocated = shares.reduce((a, s) => a + s.sats, 0)
  shares.unshift({ pubkey: participants.translator.toLowerCase(), role: 'translator', sats: totalSats - allocated })

  return shares.filter((s) => s.sats > 0)
}
