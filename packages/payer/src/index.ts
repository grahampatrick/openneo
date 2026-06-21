/**
 * @neoark/payer — Lightning payment engine. Reads value-manifest splits, pays
 * recipients via LNURL-pay over NWC, enforces a monthly budget. No custody.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
export { ArkPayer } from './payer'
export type { ArkPayerOptions, ChargeResult, InvoiceResolver } from './payer'

export { computeSplits } from './splits'
export { decodeBolt11 } from './bolt11'
export { resolveLnurlPay, lnAddressToUrl } from './lnurl'
export type { ResolvedInvoice } from './lnurl'

export { MemoryBudgetStore, monthKey, rollOver, emptyState } from './budget'

export {
  BudgetExceededError,
  WalletDisconnectedError,
  LnurlError,
  PaymentError,
} from './errors'

export type {
  Wallet,
  BudgetStore,
  BudgetState,
  JsonFetch,
  SplitShare,
  PaymentReceipt,
  DecodedInvoice,
} from './types'
