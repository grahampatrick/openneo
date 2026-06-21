/**
 * Privy adapter — web2 logins (email, Google, Twitter) → a deterministic,
 * recoverable secp256k1 keypair for signing ARK events.
 *
 * Real Privy issues an embedded wallet; this adapter models the contract with a
 * deterministic derivation so the keypair is recoverable from the same inputs
 * (ADR-006 documents the production path). The derivation is:
 *
 *   seckey = SHA-256( "neoark/privy/v1" || appId || ":" || userId || ":" || appSecret )
 *
 * `appSecret` is server-side entropy; without it the keypair cannot be
 * recovered, so users are bound to the app's secret + their stable user id.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { sha256 } from '@noble/hashes/sha2'
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils'
import { getPublicKey } from '@neoark/manifest'
import type { AuthIdentity, AuthProvider } from './types'

const DERIVATION_TAG = 'neoark/privy/v1'

export interface PrivyUser {
  appId: string
  userId: string
}

/** Deterministically derive an ARK identity from a Privy user + app secret. */
export function derivePrivyIdentity(user: PrivyUser, appSecret: string): AuthIdentity {
  if (!user.appId || !user.userId) throw new Error('Privy user requires appId and userId')
  if (!appSecret) throw new Error('Privy derivation requires an app secret')
  const seckey = bytesToHex(
    sha256(utf8ToBytes(`${DERIVATION_TAG}|${user.appId}:${user.userId}:${appSecret}`)),
  )
  return {
    method: 'privy',
    seckey,
    pubkey: getPublicKey(seckey),
    subject: `${user.appId}:${user.userId}`,
  }
}

/** An AuthProvider backed by Privy-style derivation. */
export class PrivyAuthProvider implements AuthProvider {
  readonly method = 'privy' as const
  constructor(private readonly appSecret: string) {}
  login(user: PrivyUser): AuthIdentity {
    return derivePrivyIdentity(user, this.appSecret)
  }
}
