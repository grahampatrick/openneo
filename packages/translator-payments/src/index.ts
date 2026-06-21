/**
 * @neoark/translator-payments — Lightning payouts to translators on merge,
 * with signed, auditable payment records. No custody.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
export { payTranslator, KIND_PAYOUT } from './payouts'
export type { PayTranslatorInput, PayTranslatorDeps, PayoutResult } from './payouts'
