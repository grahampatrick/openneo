/**
 * AuthService — the orchestrator. Issues challenges, verifies an LNURL-auth or
 * NIP-07 response, and mints a JWT session tied to the user's npub. Works the
 * same in the PWA and the CLI (no DOM, no vendor).
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { signJwt, verifyJwt } from './jwt'
import { ChallengeStore } from './challenge'
import { buildLnurlAuth, verifyLnurlSignature, type LnurlAuthCallback } from './lnurl-auth'
import { verifyNip07Auth, type VerifyNip07Options } from './nip07'
import { hexToNpub, compressedToXonly } from './npub'
import type { AuthMethod, AuthResult, Challenge, NostrEvent, Session, SessionClaims } from './types'

export interface AuthServiceOptions {
  /** HMAC secret for signing session JWTs. Required. */
  jwtSecret: string
  /** Session lifetime in seconds (default 7 days). */
  sessionTtlSec?: number
  /** Challenge store (default: a fresh in-memory store, 5-min TTL). */
  challengeStore?: ChallengeStore
  /** Clock in unix seconds (default real time). */
  now?: () => number
}

export class AuthService {
  private readonly jwtSecret: string
  private readonly sessionTtlSec: number
  private readonly challenges: ChallengeStore
  private readonly now: () => number

  constructor(opts: AuthServiceOptions) {
    if (!opts.jwtSecret) throw new Error('AuthService: jwtSecret is required')
    this.jwtSecret = opts.jwtSecret
    this.sessionTtlSec = opts.sessionTtlSec ?? 7 * 24 * 3600
    this.now = opts.now ?? (() => Math.floor(Date.now() / 1000))
    this.challenges = opts.challengeStore ?? new ChallengeStore({ now: this.now })
  }

  /** Issue a login challenge. For LNURL-auth, also returns the `lnurl1…` string. */
  issueChallenge(lnurlEndpoint?: string): Challenge & { lnurl?: string } {
    const challenge = this.challenges.issue()
    return lnurlEndpoint ? { ...challenge, lnurl: buildLnurlAuth(lnurlEndpoint, challenge.k1) } : challenge
  }

  /** Mint a session JWT for an x-only pubkey authenticated via `method`. */
  private mint(pubkeyXonly: string, method: AuthMethod): Session {
    const iat = this.now()
    const claims: SessionClaims = {
      sub: hexToNpub(pubkeyXonly),
      pubkey: pubkeyXonly,
      method,
      iat,
      exp: iat + this.sessionTtlSec,
    }
    return { token: signJwt({ ...claims }, this.jwtSecret), claims }
  }

  /** Complete an LNURL-auth login: consume the challenge, verify, issue a session. */
  verifyLnurlAuth(cb: LnurlAuthCallback): AuthResult<Session> {
    if (!this.challenges.consume(cb.k1)) {
      return { ok: false, error: 'unknown, expired, or already-used challenge' }
    }
    if (!verifyLnurlSignature(cb)) return { ok: false, error: 'invalid LNURL-auth signature' }
    return { ok: true, value: this.mint(compressedToXonly(cb.key), 'lnurl-auth') }
  }

  /** Complete a NIP-07 login: consume the challenge, verify the event, issue a session. */
  verifyNip07(event: NostrEvent, opts: VerifyNip07Options = {}): AuthResult<Session> {
    const challenge = event.tags.find((t) => t[0] === 'challenge')?.[1]
    if (!challenge || !this.challenges.consume(challenge)) {
      return { ok: false, error: 'unknown, expired, or already-used challenge' }
    }
    const result = verifyNip07Auth(event, challenge, { now: this.now(), ...opts })
    if (!result.ok || !result.pubkey) return { ok: false, error: result.error ?? 'verification failed' }
    return { ok: true, value: this.mint(result.pubkey, 'nip07') }
  }

  /** Verify a session token and return its claims. */
  verifySession(token: string): AuthResult<SessionClaims> {
    const result = verifyJwt<SessionClaims>(token, this.jwtSecret, { now: this.now() })
    return result.ok ? { ok: true, value: result.payload } : { ok: false, error: result.error }
  }
}
