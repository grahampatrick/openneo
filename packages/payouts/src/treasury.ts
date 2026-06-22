/**
 * Treasury — computes payout amounts from the donation pool.
 *
 * v1 policy (OQ-P2-3): donations-only, a fixed reward per merged correction
 * (default 500 sats, OQ-7). A payout is skipped when the balance can't cover the
 * full reward — no partial payouts.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import type { Treasury } from './types'

export const DEFAULT_PER_MERGE_SATS = 500

export function createTreasury(balanceSats: number, perMergeSats = DEFAULT_PER_MERGE_SATS): Treasury {
  if (!Number.isInteger(balanceSats) || balanceSats < 0) throw new Error('treasury balance must be a non-negative integer')
  if (!Number.isInteger(perMergeSats) || perMergeSats < 1) throw new Error('perMergeSats must be a positive integer')
  return { balanceSats, perMergeSats }
}

export interface PayoutComputation {
  /** Whether the treasury can fund a full reward. */
  fundable: boolean
  amountSat: number
  reason: string
}

/** Can the treasury fund one merge reward right now? */
export function computePayout(treasury: Treasury): PayoutComputation {
  if (treasury.balanceSats < treasury.perMergeSats) {
    return { fundable: false, amountSat: 0, reason: `insufficient treasury (${String(treasury.balanceSats)} < ${String(treasury.perMergeSats)} sats)` }
  }
  return { fundable: true, amountSat: treasury.perMergeSats, reason: 'fundable' }
}

/** Debit the treasury (mutates and returns it). */
export function debit(treasury: Treasury, amountSat: number): Treasury {
  if (amountSat > treasury.balanceSats) throw new Error('debit exceeds treasury balance')
  treasury.balanceSats -= amountSat
  return treasury
}
