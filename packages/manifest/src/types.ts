/**
 * ARK value-manifest (AVM-1) and use-proof (UP-1) types.
 * See spec/value-manifest.md and spec/use-proof.md.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

/** The only triggers a conformant reader may bill on (AVM-1, normative). */
export const TRIGGERS = [
  '80pct_visible_30s',
  'user_highlights_verse',
  'copy_or_share_with_attribution',
  'user_publishes_signed_use',
] as const

export type Trigger = (typeof TRIGGERS)[number]

export interface StreamRate {
  sats: number
  trigger: Trigger
}

export interface Split {
  lightning_address: string
  weight: number
  role: string
}

export interface ForkPolicy {
  allowed: boolean
  min_translator_weight?: number
  must_preserve_roles?: string[]
  predecessor_blake3?: string | null
}

export interface ValueManifest {
  version: 'avm-1'
  translation_id: string
  translation_blake3: string
  translator_pubkey: string
  issued_at: string
  stream_rates: Record<string, StreamRate>
  splits: Split[]
  fork_policy: ForkPolicy
  signature: string
}

/** A signed Nostr event envelope (NIP-01). Use-proofs are kind:30078. */
export interface NostrEvent {
  id: string
  pubkey: string
  created_at: number
  kind: number
  tags: string[][]
  content: string
  sig: string
}

/** Structured view of a UP-1 use-proof event after parsing its tags. */
export interface UseProof {
  event: NostrEvent
  translation_id: string
  blake3: string
  passage: { book: string; chapter: number; verseStart: number; verseEnd: number }
  trigger: string
  app?: string
  bolt11_hash: string
  preimage: string
  amount_sat: number
}

/** Result of a verification call: a boolean plus human-readable error detail. */
export interface VerifyResult {
  valid: boolean
  errors: string[]
}
