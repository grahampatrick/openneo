/**
 * ArkPayer — reads a value manifest, computes splits, pays each recipient via
 * LNURL-pay over an NWC wallet, enforces a monthly budget, and returns receipts.
 *
 * Design rules (plan.md M3):
 *  - splits run under Promise.allSettled — one bad Lightning address must not
 *    abort the rest
 *  - exponential backoff on payment errors; a settled payment is never retried
 *    (wallet.payInvoice resolves with a preimage only on settlement, so a throw
 *    means "not settled" and is safe to retry)
 *  - sub-sat dust accumulates per recipient and is flushed once it reaches 1 sat
 *  - the engine never holds funds and never touches the network directly
 *    (wallet + HTTP are injected)
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { rateForTrigger } from '@neoark/manifest'
import type { ValueManifest } from '@neoark/manifest'
import { computeSplits } from './splits'
import { resolveLnurlPay } from './lnurl'
import type { ResolvedInvoice } from './lnurl'
import { monthKey, rollOver } from './budget'
import { BudgetExceededError, PaymentError, WalletDisconnectedError } from './errors'
import type { BudgetState, BudgetStore, JsonFetch, PaymentReceipt, Wallet } from './types'

/** Resolves a Lightning Address + amount to a validated invoice. */
export type InvoiceResolver = (
  lnAddress: string,
  amountSat: number,
  opts: { fetchJson: JsonFetch; comment?: string },
) => Promise<ResolvedInvoice>

export interface ArkPayerOptions {
  wallet: Wallet
  budgetStore: BudgetStore
  fetchJson: JsonFetch
  monthlyBudgetSats: number
  /** Clock injection for deterministic month handling. Defaults to real time. */
  now?: () => Date
  /** Max payment attempts per split (incl. the first). Default 3. */
  maxAttempts?: number
  /** Base backoff in ms (doubles each retry). Default 500. */
  backoffBaseMs?: number
  /** Sleep injection so tests don't actually wait. Defaults to real setTimeout. */
  sleep?: (ms: number) => Promise<void>
  /** Invoice resolver injection. Defaults to LNURL-pay over `fetchJson`. */
  resolveInvoice?: InvoiceResolver
}

export interface ChargeResult {
  totalPaidSats: number
  receipts: PaymentReceipt[]
  failures: { recipient: string; reason: string }[]
}

const realSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

export class ArkPayer {
  private readonly o: Required<ArkPayerOptions>

  constructor(options: ArkPayerOptions) {
    this.o = {
      now: () => new Date(),
      maxAttempts: 3,
      backoffBaseMs: 500,
      sleep: realSleep,
      resolveInvoice: resolveLnurlPay,
      ...options,
    }
  }

  /** Sats left in this month's budget. */
  async remainingBudget(): Promise<number> {
    const state = rollOver(await this.o.budgetStore.load(), monthKey(this.o.now()))
    return Math.max(0, this.o.monthlyBudgetSats - state.spentSats)
  }

  /**
   * Charge for a single qualifying read. Looks up the trigger's rate in the
   * manifest, splits it, and pays each recipient. Returns receipts + failures.
   */
  async chargeForRead(
    manifest: ValueManifest,
    trigger: string,
    opts: { comment?: string } = {},
  ): Promise<ChargeResult> {
    const rate = rateForTrigger(manifest, trigger)
    if (rate === undefined) throw new Error(`Manifest has no rate for trigger "${trigger}"`)

    const month = monthKey(this.o.now())
    const state = rollOver(await this.o.budgetStore.load(), month)

    if (state.spentSats + rate > this.o.monthlyBudgetSats) {
      throw new BudgetExceededError(rate, Math.max(0, this.o.monthlyBudgetSats - state.spentSats))
    }

    const shares = computeSplits(manifest, rate)
    const nextDust: Record<string, number> = { ...state.dustMsat }

    // Decide how much each recipient is actually paid this round (incl. dust flush).
    const plans = shares.map((s) => {
      const carry = (nextDust[s.lightningAddress] ?? 0) + s.dustMsat
      const bonusSat = Math.floor(carry / 1000)
      return {
        share: s,
        paySats: s.sats + bonusSat,
        newCarry: carry % 1000,
      }
    })

    const receipts: PaymentReceipt[] = []
    const failures: { recipient: string; reason: string }[] = []

    const settled = await Promise.allSettled(
      plans.map(async (p) => {
        if (p.paySats < 1) {
          // Nothing to pay now; just carry the dust forward.
          nextDust[p.share.lightningAddress] = p.newCarry
          return null
        }
        const receipt = await this.payOne(p.share.lightningAddress, p.share.role, p.paySats, opts.comment)
        nextDust[p.share.lightningAddress] = p.newCarry
        return receipt
      }),
    )

    let totalPaidSats = 0
    settled.forEach((r, i) => {
      const plan = plans[i]
      if (!plan) return
      if (r.status === 'fulfilled') {
        if (r.value) {
          receipts.push(r.value)
          totalPaidSats += r.value.amountSat
        }
      } else {
        const err: unknown = r.reason
        failures.push({
          recipient: plan.share.lightningAddress,
          reason: err instanceof Error ? err.message : String(err),
        })
      }
    })

    const newState: BudgetState = {
      monthKey: month,
      spentSats: state.spentSats + totalPaidSats,
      dustMsat: nextDust,
    }
    await this.o.budgetStore.save(newState)

    return { totalPaidSats, receipts, failures }
  }

  /** Resolve + pay a single recipient with exponential backoff. */
  private async payOne(
    lnAddress: string,
    role: string,
    amountSat: number,
    comment?: string,
  ): Promise<PaymentReceipt> {
    const { invoice, decoded } = await this.o.resolveInvoice(lnAddress, amountSat, {
      fetchJson: this.o.fetchJson,
      ...(comment !== undefined ? { comment } : {}),
    })

    let lastErr: unknown
    for (let attempt = 0; attempt < this.o.maxAttempts; attempt++) {
      if (attempt > 0) await this.o.sleep(this.o.backoffBaseMs * 2 ** (attempt - 1))
      try {
        const { preimage } = await this.o.wallet.payInvoice(invoice)
        return { recipient: lnAddress, role, amountSat, paymentHash: decoded.paymentHash, preimage }
      } catch (e) {
        if (e instanceof WalletDisconnectedError) throw e // not retryable
        lastErr = e
      }
    }
    throw new PaymentError(lnAddress, lastErr instanceof Error ? lastErr.message : String(lastErr))
  }
}
