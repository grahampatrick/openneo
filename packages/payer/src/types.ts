/**
 * Payment-engine interfaces. External dependencies (the NWC wallet, the budget
 * store, the HTTP fetcher) are injected so the engine is pure and testable.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

/** A decoded BOLT11 invoice (only the fields the payer needs). */
export interface DecodedInvoice {
  paymentHash: string
  /** Invoice amount in sats, or null for an amountless invoice. */
  amountSat: number | null
  description?: string
  /** sha256 of the LNURL metadata (BOLT11 'h' tag), hex, if present. */
  descriptionHash?: string
  timestamp?: number
  expirySeconds?: number
}

/** Minimal NWC wallet surface (subset of NIP-47). Mocked in tests. */
export interface Wallet {
  /** Pay a BOLT11 invoice. Resolves with the preimage on settlement. */
  payInvoice(invoice: string): Promise<{ preimage: string }>
}

/**
 * Persistent monthly budget. CLI backs this with disk, the browser with
 * IndexedDB; tests use the in-memory store. `monthKey` is "YYYY-MM" UTC.
 */
export interface BudgetState {
  monthKey: string
  spentSats: number
  /** Per-recipient sub-sat carry, in millisats, keyed by lightning address. */
  dustMsat: Record<string, number>
}

export interface BudgetStore {
  load(): BudgetState | Promise<BudgetState>
  save(state: BudgetState): void | Promise<void>
}

/** Injectable HTTP getter returning parsed JSON (so tests avoid the network). */
export type JsonFetch = (url: string) => Promise<unknown>

/** One recipient's share of a charge. */
export interface SplitShare {
  lightningAddress: string
  role: string
  weight: number
  /** Whole sats owed this charge (floor of the weighted share). */
  sats: number
  /** Sub-sat remainder in millisats, carried until it accumulates to ≥1 sat. */
  dustMsat: number
}

/** Receipt for a settled split payment. */
export interface PaymentReceipt {
  recipient: string
  role: string
  amountSat: number
  paymentHash: string
  preimage: string
}
