/**
 * Portal auth — wraps @neoark/auth for a local-first client. The translator
 * connects a Nostr key (NIP-07) or Lightning wallet; we verify the challenge and
 * mint a session JWT tied to their npub, persisted via injectable storage.
 *
 * Local-first note: the session JWT gates the local UI and remembers identity.
 * Real authorization is the *signed proposal events* themselves — a forged
 * session can't forge a signed kind:30702. The JWT secret is a per-install local
 * secret (see `PortalAuth.create`).
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { AuthService, buildNip07AuthEvent } from '@neoark/auth'
import type { Session, SessionClaims } from '@neoark/auth'
import type { Signer } from './signer'

export interface KeyValueStore {
  get(key: string): string | null
  set(key: string, value: string): void
  remove(key: string): void
}

const SESSION_KEY = 'neoark.translator.session'

export class PortalAuth {
  private constructor(
    private readonly svc: AuthService,
    private readonly store: KeyValueStore,
    private readonly now: () => number,
  ) {}

  static create(opts: { jwtSecret: string; store: KeyValueStore; now?: () => number }): PortalAuth {
    const now = opts.now ?? (() => Math.floor(Date.now() / 1000))
    return new PortalAuth(new AuthService({ jwtSecret: opts.jwtSecret, now }), opts.store, now)
  }

  /** Log in with a NIP-07 (or key-backed) signer: challenge → sign → verify → session. */
  async loginWithNip07(signer: Signer): Promise<Session> {
    const { k1 } = this.svc.issueChallenge()
    const signed = await signer.signEvent(buildNip07AuthEvent(k1, this.now(), 'neoark.org'))
    const result = this.svc.verifyNip07(signed)
    if (!result.ok) throw new Error(`Login failed: ${result.error}`)
    this.store.set(SESSION_KEY, result.value.token)
    return result.value
  }

  /** The current session claims, or null if not logged in / expired. */
  currentSession(): SessionClaims | null {
    const token = this.store.get(SESSION_KEY)
    if (!token) return null
    const result = this.svc.verifySession(token)
    if (!result.ok) {
      this.store.remove(SESSION_KEY)
      return null
    }
    return result.value
  }

  logout(): void {
    this.store.remove(SESSION_KEY)
  }
}

/** A localStorage-backed KeyValueStore (browser); falls back to memory. */
export function browserStore(): KeyValueStore {
  const ls = (globalThis as unknown as { localStorage?: Storage }).localStorage
  if (ls) {
    return {
      get: (k) => ls.getItem(k),
      set: (k, v) => {
        ls.setItem(k, v)
      },
      remove: (k) => {
        ls.removeItem(k)
      },
    }
  }
  const map = new Map<string, string>()
  return {
    get: (k) => map.get(k) ?? null,
    set: (k, v) => {
      map.set(k, v)
    },
    remove: (k) => {
      map.delete(k)
    },
  }
}
