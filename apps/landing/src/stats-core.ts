/**
 * Pure stats aggregation over public Nostr events — no network, so it's
 * unit-testable. The browser widget (stats.js) fetches the events and calls this.
 * Every number is derivable from public signed events; there is no backend.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
export interface NostrEventLite {
  id: string
  kind: number
  pubkey: string
  tags: string[][]
  content: string
}

export interface NetworkStats {
  proposals: number
  merges: number
  payouts: number
  satsPaid: number
  maintainers: number
}

const KIND_PROPOSAL = 30702
const KIND_REVIEW = 30703
const KIND_PAYOUT = 30712
const KIND_GOVERNANCE = 30750

function tag(e: NostrEventLite, name: string): string | undefined {
  return e.tags.find((t) => t[0] === name)?.[1]
}
function belongsTo(e: NostrEventLite, translationId: string): boolean {
  return e.tags.some((t) => t[1] === translationId)
}

/** Aggregate a deduplicated event set into the verifiable network stats. */
export function summarize(events: NostrEventLite[], translationId: string): NetworkStats {
  const byId = new Map<string, NostrEventLite>()
  for (const e of events) byId.set(e.id, e)
  const unique = [...byId.values()]

  let proposals = 0
  let merges = 0
  let payouts = 0
  let satsPaid = 0
  let maintainers = 0

  for (const e of unique) {
    if (e.kind === KIND_PROPOSAL && belongsTo(e, translationId)) proposals++
    else if (e.kind === KIND_REVIEW && tag(e, 'ark_action') === 'merge') merges++
    else if (e.kind === KIND_PAYOUT && tag(e, 'ark_action') === 'payout') {
      payouts++
      satsPaid += Number(tag(e, 'amount_sat') ?? '0') || 0
    } else if (e.kind === KIND_GOVERNANCE && belongsTo(e, translationId)) {
      // Newest governance config wins; count its maintainers.
      maintainers = Math.max(maintainers, e.tags.filter((t) => t[0] === 'maintainer').length)
    }
  }
  return { proposals, merges, payouts, satsPaid, maintainers }
}
