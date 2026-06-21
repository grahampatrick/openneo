/**
 * Verse revision history with Bitcoin anchor status — the data behind the
 * "change history" view. Mirrors @neoark/translation-protocol's Attestation.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
export type AnchorStatus =
  | { state: 'none' }
  | { state: 'pending'; calendar: string }
  | { state: 'bitcoin'; blockHeight: number }

export interface Revision {
  mergeEventId: string
  text: string
  rationale: string
  maintainer: string
  mergedAt: number
  anchor: AnchorStatus
}

/** Human label + dot color for an anchor status (for the UI). */
export function anchorLabel(a: AnchorStatus): { text: string; color: string } {
  switch (a.state) {
    case 'bitcoin':
      return { text: `Anchored · block ${a.blockHeight}`, color: '#50fa7b' }
    case 'pending':
      return { text: 'Anchoring to Bitcoin…', color: '#f0ad4e' }
    default:
      return { text: 'Not yet anchored', color: '#8a949c' }
  }
}

/** Newest revision first. */
export function sortRevisions(revs: Revision[]): Revision[] {
  return [...revs].sort((a, b) => b.mergedAt - a.mergedAt)
}

/** Whether every revision in a history is confirmed to Bitcoin. */
export function fullyAnchored(revs: Revision[]): boolean {
  return revs.length > 0 && revs.every((r) => r.anchor.state === 'bitcoin')
}
