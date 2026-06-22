/**
 * @neoark/auth — decentralized auth types.
 *
 * Two sign-in methods (LNURL-auth, NIP-07) both resolve to the same identity (an
 * npub) and the same artifact (a JWT session). No email, no vendor.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export type AuthMethod = 'lnurl-auth' | 'nip07'

/** A signed Nostr event envelope (NIP-01) — used by the NIP-07 flow. */
export interface NostrEvent {
  id: string
  pubkey: string
  created_at: number
  kind: number
  tags: string[][]
  content: string
  sig: string
}

/** A pending login challenge. `k1` is 32-byte hex (LUD-04). */
export interface Challenge {
  k1: string
  issuedAt: number
  expiresAt: number
}

/** Decoded JWT session payload. `sub` is the npub; identity is a key, not email. */
export interface SessionClaims {
  /** npub (NIP-19 bech32) — the canonical identity. */
  sub: string
  /** 32-byte x-only public key (hex). */
  pubkey: string
  /** How the user authenticated. */
  method: AuthMethod
  /** Issued-at (unix seconds). */
  iat: number
  /** Expiry (unix seconds). */
  exp: number
}

export interface Session {
  token: string
  claims: SessionClaims
}

/** Result of a verification: ok + the value, or an error reason. */
export type AuthResult<T> = { ok: true; value: T } | { ok: false; error: string }
