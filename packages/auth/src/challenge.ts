/**
 * Login challenges (the `k1` of LUD-04, reused for NIP-07). A challenge is a
 * random 32-byte hex value, single-use, with a short TTL. Randomness and clock
 * are injectable so flows are deterministic in tests.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { bytesToHex } from '@noble/hashes/utils'
import { randomBytes } from '@noble/hashes/utils'
import type { Challenge } from './types'

export interface ChallengeStoreOptions {
  /** Time-to-live in seconds (default 300). */
  ttlSec?: number
  /** Clock in unix seconds (default real time). */
  now?: () => number
  /** 32-byte k1 generator (default CSPRNG). */
  genK1?: () => string
}

export class ChallengeStore {
  private readonly ttlSec: number
  private readonly now: () => number
  private readonly genK1: () => string
  private readonly pending = new Map<string, Challenge>()

  constructor(opts: ChallengeStoreOptions = {}) {
    this.ttlSec = opts.ttlSec ?? 300
    this.now = opts.now ?? (() => Math.floor(Date.now() / 1000))
    this.genK1 = opts.genK1 ?? (() => bytesToHex(randomBytes(32)))
  }

  /** Issue a fresh single-use challenge. */
  issue(): Challenge {
    const issuedAt = this.now()
    const challenge: Challenge = { k1: this.genK1(), issuedAt, expiresAt: issuedAt + this.ttlSec }
    this.pending.set(challenge.k1, challenge)
    return challenge
  }

  /**
   * Consume a challenge by k1. Returns true exactly once for a valid, unexpired
   * k1; subsequent calls (replay) and unknown/expired k1 return false.
   */
  consume(k1: string): boolean {
    const challenge = this.pending.get(k1)
    if (!challenge) return false
    this.pending.delete(k1) // single-use: gone whether or not it was expired
    return this.now() < challenge.expiresAt
  }

  /** Drop expired challenges (housekeeping). Returns the number removed. */
  sweep(): number {
    const now = this.now()
    let removed = 0
    for (const [k1, c] of this.pending) {
      if (now >= c.expiresAt) {
        this.pending.delete(k1)
        removed++
      }
    }
    return removed
  }

  get size(): number {
    return this.pending.size
  }
}
