/**
 * @neoark/payout-runner — operator service: watch governed merges, split-pay the
 * participants (Translator/Reviewers/Submitter) in Lightning, publish receipts.
 * No custody; verifies a merge is governed before paying (anti-Sybil).
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
export { PayoutRunner } from './runner'
export type { PayoutRunnerOptions, MergePayout, RecipientPayout } from './runner'
export { MemoryPaidStore, FilePaidStore } from './paid-store'
export { collectGovernedPayouts } from './collect'
export type { GovernedMergePayout, CollectOptions } from './collect'
export { ManualPayouts } from './manual'
export type { PlannedPayment, ManualPayoutsOptions } from './manual'
