/**
 * @neoark/payouts — Lightning payouts to translators on merge. Listens for merge
 * events, looks up the translator's Lightning address, pays from the treasury via
 * NWC/LNURL, and publishes a signed payout receipt. No custody.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
export { PayoutService } from './payout-service'
export type { PayoutServiceOptions, MergeToPay } from './payout-service'

export { createTreasury, computePayout, debit, DEFAULT_PER_MERGE_SATS } from './treasury'
export type { PayoutComputation } from './treasury'

export { MemoryProfileRegistry, profilesFromMetadata } from './profiles'

export type { Treasury, ProfileResolver, PaidStore, PayoutOutcome, PaymentReceipt } from './types'
