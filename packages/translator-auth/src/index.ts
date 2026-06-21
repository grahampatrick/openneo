/**
 * @neoark/translator-auth — Privy and LNURL-auth adapters that both resolve to
 * a secp256k1 keypair for signing ARK protocol events.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
export { derivePrivyIdentity, PrivyAuthProvider } from './privy'
export type { PrivyUser } from './privy'

export {
  deriveLinkingKey,
  signChallenge,
  verifyChallenge,
  lnurlAuthIdentity,
} from './lnurl-auth'
export type { LnurlAuthSignature } from './lnurl-auth'

export type { AuthIdentity, AuthMethod, AuthProvider } from './types'
