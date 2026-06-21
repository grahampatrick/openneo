/**
 * Translator auth — both Privy and LNURL-auth resolve to one shape: a
 * secp256k1 keypair usable to sign ARK protocol events.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export type AuthMethod = 'privy' | 'lnurl-auth'

/** The unified result of any auth flow. */
export interface AuthIdentity {
  method: AuthMethod
  /** 32-byte secret key (hex). Keep client-side; never published. */
  seckey: string
  /** x-only public key (hex) — the ARK/Nostr identity used to sign events. */
  pubkey: string
  /** Opaque provenance: Privy user id, or "lnurl-auth:<domain>". */
  subject: string
}

/** Adapter contract: any login method produces an AuthIdentity. */
export interface AuthProvider {
  readonly method: AuthMethod
  login(...args: unknown[]): Promise<AuthIdentity> | AuthIdentity
}
