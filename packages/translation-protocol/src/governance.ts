/**
 * Governance config — the signed council that gates merges (anti-Sybil).
 *
 * A governance event is a parameterized replaceable Nostr event (kind:30750,
 * `d` = translationId) listing the maintainer pubkeys and the merge quorum. Only
 * the maintainers' votes count toward a merge (see tallyReviews); everyone else's
 * approvals are a public community signal. The set is self-amending: a new
 * governance event is honored only if signed by a current maintainer (or, when no
 * config exists yet, by the founding maintainer who bootstraps it).
 *
 * "No gatekeeper owns the text" is preserved: the config is public and signed,
 * anyone may fork the translation with their own council, and all votes stay
 * public — gatekeeping applies only to what becomes *this* canonical NeoOS.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { signEvent, verifyEventSignature } from '@neoark/manifest'
import type { NostrEvent } from '@neoark/manifest'
import { DEFAULT_QUORUM } from './types'
import type { QuorumConfig } from './types'

export const KIND_GOVERNANCE = 30750

export interface Governance {
  event: NostrEvent
  translationId: string
  /** Maintainer pubkeys (hex, lowercased). */
  maintainers: string[]
  quorum: QuorumConfig
  /** Who published this config (must be a maintainer of the prior config, or the founder). */
  publishedBy: string
  createdAt: number
}

export interface BuildGovernanceInput {
  translationId: string
  maintainers: string[]
  quorum?: QuorumConfig
  createdAt: number
}

/** Build the unsigned kind:30750 governance event. */
export function buildGovernanceEvent(input: BuildGovernanceInput): {
  kind: number
  created_at: number
  tags: string[][]
  content: string
} {
  const quorum = input.quorum ?? DEFAULT_QUORUM
  const maintainers = [...new Set(input.maintainers.map((m) => m.toLowerCase()))]
  if (maintainers.length === 0) throw new Error('governance requires at least one maintainer')
  return {
    kind: KIND_GOVERNANCE,
    created_at: input.createdAt,
    tags: [
      ['d', input.translationId],
      ['ark_translation', input.translationId],
      ...maintainers.map((m) => ['maintainer', m]),
    ],
    content: JSON.stringify({ quorum }),
  }
}

/** Parse + verify a governance event. Throws if malformed or unsigned. */
export function parseGovernance(event: NostrEvent): Governance {
  if (event.kind !== KIND_GOVERNANCE) throw new Error(`Not a governance event: kind ${String(event.kind)}`)
  if (!verifyEventSignature(event)) throw new Error('Governance signature does not verify')
  const translationId = event.tags.find((t) => t[0] === 'ark_translation')?.[1] ?? event.tags.find((t) => t[0] === 'd')?.[1]
  if (!translationId) throw new Error('Governance missing translation id')
  const maintainers = event.tags
    .filter((t): t is [string, string, ...string[]] => t[0] === 'maintainer' && typeof t[1] === 'string')
    .map((t) => t[1].toLowerCase())
  if (maintainers.length === 0) throw new Error('Governance lists no maintainers')
  let quorum = DEFAULT_QUORUM
  try {
    const parsed = JSON.parse(event.content) as { quorum?: QuorumConfig }
    if (parsed.quorum) quorum = parsed.quorum
  } catch {
    /* default quorum */
  }
  return { event, translationId, maintainers, quorum, publishedBy: event.pubkey.toLowerCase(), createdAt: event.created_at }
}

/**
 * Pick the authoritative governance from a set of events for one translation:
 * the newest one whose publisher was a maintainer of the *previous* authoritative
 * config. The first-ever config (no prior) bootstraps the founding council — the
 * caller may pin a known founding pubkey for hijack resistance.
 */
export function resolveGovernance(
  events: NostrEvent[],
  translationId: string,
  opts: { foundingPubkey?: string } = {},
): Governance | null {
  const configs = events
    .map((e) => {
      try {
        return parseGovernance(e)
      } catch {
        return null
      }
    })
    .filter((g): g is Governance => g !== null && g.translationId === translationId)
    .sort((a, b) => a.createdAt - b.createdAt) // oldest first — apply the chain forward

  let current: Governance | null = null
  for (const g of configs) {
    if (current === null) {
      // Bootstrap: accept the first config, optionally pinned to a founding key.
      if (opts.foundingPubkey && g.publishedBy !== opts.foundingPubkey.toLowerCase()) continue
      current = g
    } else if (current.maintainers.includes(g.publishedBy)) {
      // Amendment: only honored if signed by a current maintainer.
      current = g
    }
  }
  return current
}

/** Sign + return a governance event (helper for the bootstrap/amend flow). */
export function signGovernance(input: BuildGovernanceInput, privKey: string): NostrEvent {
  return signEvent(buildGovernanceEvent(input), privKey)
}
