/**
 * NIP-07 auth — a browser extension (`window.nostr`) signs a challenge event;
 * the server verifies its BIP-340 signature and that it carries the expected,
 * fresh challenge. Modeled on NIP-42 (kind:22242 auth events).
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { verifyEventSignature } from '@neoark/manifest'
import type { NostrEvent } from './types'

/** NIP-42 client authentication event kind. */
export const KIND_AUTH = 22242

/**
 * Build the unsigned auth event for a challenge. The PWA/CLI passes this to
 * `window.nostr.signEvent(...)`; the signed result goes back to the server.
 */
export function buildNip07AuthEvent(challenge: string, createdAt: number, domain?: string): Omit<NostrEvent, 'id' | 'pubkey' | 'sig'> {
  const tags: string[][] = [['challenge', challenge]]
  if (domain) tags.push(['domain', domain])
  return { kind: KIND_AUTH, created_at: createdAt, tags, content: '' }
}

export interface VerifyNip07Options {
  /** Reject events older/newer than this many seconds from `now` (default 600). */
  maxAgeSec?: number
  now?: number
}

export interface Nip07Verification {
  ok: boolean
  /** x-only pubkey (hex) of the signer, when ok. */
  pubkey?: string
  error?: string
}

/**
 * Verify a signed NIP-07 auth event against the expected challenge:
 *  1. it is a kind:22242 event
 *  2. its `challenge` tag matches `expectedChallenge`
 *  3. its `created_at` is fresh
 *  4. its BIP-340 signature verifies (and the id is well-formed)
 */
export function verifyNip07Auth(
  event: NostrEvent,
  expectedChallenge: string,
  opts: VerifyNip07Options = {},
): Nip07Verification {
  if (event.kind !== KIND_AUTH) return { ok: false, error: `not an auth event (kind ${String(event.kind)})` }
  const challenge = event.tags.find((t) => t[0] === 'challenge')?.[1]
  if (challenge !== expectedChallenge) return { ok: false, error: 'challenge mismatch' }

  const now = opts.now ?? Math.floor(Date.now() / 1000)
  const maxAge = opts.maxAgeSec ?? 600
  if (Math.abs(now - event.created_at) > maxAge) return { ok: false, error: 'stale auth event' }

  if (!verifyEventSignature(event)) return { ok: false, error: 'signature does not verify' }
  return { ok: true, pubkey: event.pubkey }
}
