/**
 * Typed errors for the payment engine.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

/** The configured monthly budget would be exceeded by a charge. */
export class BudgetExceededError extends Error {
  readonly requestedSats: number
  readonly remainingSats: number
  constructor(requestedSats: number, remainingSats: number) {
    super(`Budget exceeded: need ${String(requestedSats)} sats, ${String(remainingSats)} remaining this month`)
    this.name = 'BudgetExceededError'
    this.requestedSats = requestedSats
    this.remainingSats = remainingSats
  }
}

/** The NWC wallet is not connected or rejected the operation. */
export class WalletDisconnectedError extends Error {
  constructor(message = 'Wallet is not connected') {
    super(message)
    this.name = 'WalletDisconnectedError'
  }
}

/** LNURL-pay resolution failed (bad address, out-of-range amount, metadata mismatch). */
export class LnurlError extends Error {
  readonly lightningAddress: string
  constructor(lightningAddress: string, message: string) {
    super(`LNURL-pay (${lightningAddress}): ${message}`)
    this.name = 'LnurlError'
    this.lightningAddress = lightningAddress
  }
}

/** A Lightning payment failed after retries. */
export class PaymentError extends Error {
  readonly recipient: string
  constructor(recipient: string, message: string) {
    super(`Payment to ${recipient} failed: ${message}`)
    this.name = 'PaymentError'
    this.recipient = recipient
  }
}
