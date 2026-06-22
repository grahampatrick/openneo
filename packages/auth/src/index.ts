/**
 * @neoark/auth — decentralized auth. Translators sign in with their Lightning
 * wallet (LNURL-auth) or Nostr key (NIP-07); the result is a JWT session tied to
 * an npub, not an email. No Privy, no auth vendor.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
export { AuthService } from './session'
export type { AuthServiceOptions } from './session'

export { ChallengeStore } from './challenge'
export type { ChallengeStoreOptions } from './challenge'

export { signJwt, verifyJwt } from './jwt'
export type { JwtVerifyResult } from './jwt'

export { buildLnurlAuth, verifyLnurlSignature } from './lnurl-auth'
export type { LnurlAuthCallback } from './lnurl-auth'

export { buildNip07AuthEvent, verifyNip07Auth, KIND_AUTH } from './nip07'
export type { VerifyNip07Options, Nip07Verification } from './nip07'

export { hexToNpub, npubToHex, compressedToXonly } from './npub'

export type {
  AuthMethod,
  AuthResult,
  Challenge,
  NostrEvent,
  Session,
  SessionClaims,
} from './types'
