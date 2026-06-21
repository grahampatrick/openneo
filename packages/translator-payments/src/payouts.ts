/**
 * Translator payouts. On a successful merge, the project pays the translator a
 * Lightning reward from the donation pool (an NWC wallet) and publishes a
 * signed payment-record event so the payout is publicly auditable.
 *
 * No custody: funds move donor-wallet → translator via LNURL-pay; this code
 * never holds sats. The wallet, HTTP, and invoice resolver are injected.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { signEvent } from '@neoark/manifest'
import type { NostrEvent } from '@neoark/manifest'
import { resolveLnurlPay } from '@neoark/payer'
import type { JsonFetch, PaymentReceipt, Wallet } from '@neoark/payer'

/** ARK kind for a translator payment record. */
export const KIND_PAYOUT = 30712

export interface PayTranslatorInput {
  lightningAddress: string
  sats: number
  /** The merge event this payout rewards. */
  mergeEventId: string
  createdAt: number
}

export interface PayTranslatorDeps {
  wallet: Wallet
  fetchJson: JsonFetch
  /** Key that signs the public payment record (the payer/project key). */
  payerSeckey: string
  /** Invoice resolver injection; defaults to LNURL-pay. */
  resolveInvoice?: typeof resolveLnurlPay
}

export interface PayoutResult {
  receipt: PaymentReceipt
  /** Signed, publishable payment-record event (kind:30712). */
  record: NostrEvent
}

/** Pay a translator and produce a signed, auditable payment record. */
export async function payTranslator(
  input: PayTranslatorInput,
  deps: PayTranslatorDeps,
): Promise<PayoutResult> {
  if (!Number.isInteger(input.sats) || input.sats < 1) {
    throw new Error(`payout amount must be a positive integer, got ${String(input.sats)}`)
  }
  const resolve = deps.resolveInvoice ?? resolveLnurlPay
  const { invoice, decoded } = await resolve(input.lightningAddress, input.sats, {
    fetchJson: deps.fetchJson,
  })

  const { preimage } = await deps.wallet.payInvoice(invoice)

  const receipt: PaymentReceipt = {
    recipient: input.lightningAddress,
    role: 'translator',
    amountSat: input.sats,
    paymentHash: decoded.paymentHash,
    preimage,
  }

  const record = signEvent(
    {
      created_at: input.createdAt,
      kind: KIND_PAYOUT,
      tags: [
        ['d', `ark-payout:${input.mergeEventId}`],
        ['e', input.mergeEventId],
        ['ark_action', 'payout'],
        ['amount_sat', String(input.sats)],
        ['bolt11_hash', decoded.paymentHash],
        ['recipient', input.lightningAddress],
      ],
      content: '',
    },
    deps.payerSeckey,
  )

  return { receipt, record }
}
