/**
 * @neoark/payouts types.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import type { PaymentReceipt } from '@neoark/payer'
import type { NostrEvent } from '@neoark/manifest'

export type { PaymentReceipt, NostrEvent }

/** Treasury config. Donations-only by default (OQ-P2-3). */
export interface Treasury {
  /** Current spendable balance (sats). */
  balanceSats: number
  /** Reward per merged correction (sats). Default 500 (OQ-7). */
  perMergeSats: number
}

/** Maps a translator's pubkey → their Lightning address (from a Nostr/auth profile). */
export interface ProfileResolver {
  lightningAddress(pubkeyHex: string): string | undefined | Promise<string | undefined>
}

/** Tracks which merge events have already been paid (idempotency). */
export interface PaidStore {
  has(mergeEventId: string): boolean
  add(mergeEventId: string): void
  /** Undo a reservation when a payment fails, so it can be retried. */
  remove(mergeEventId: string): void
}

/** Outcome of attempting a payout for one merge. */
export interface PayoutOutcome {
  paid: boolean
  reason: string
  mergeEventId: string
  translatorPubkey: string
  amountSat?: number
  receipt?: PaymentReceipt
  /** The signed payout-record event (kind:30712). */
  record?: NostrEvent
  relaysAccepted?: number
}
