import { describe, it, expect } from 'vitest'
import { ArkPayer } from '../src/payer'
import { MemoryBudgetStore } from '../src/budget'
import { BudgetExceededError, WalletDisconnectedError } from '../src/errors'
import type { InvoiceResolver } from '../src/payer'
import type { JsonFetch, Wallet } from '../src/types'
import { testManifest, okWallet, fakeResolver } from './helpers'

const noFetch: JsonFetch = () => Promise.reject(new Error('network disabled in tests'))
const noSleep = () => Promise.resolve()

function payer(over: Partial<ConstructorParameters<typeof ArkPayer>[0]> = {}) {
  return new ArkPayer({
    wallet: okWallet(),
    budgetStore: new MemoryBudgetStore(),
    fetchJson: noFetch,
    monthlyBudgetSats: 1000,
    now: () => new Date('2026-06-15T00:00:00Z'),
    sleep: noSleep,
    resolveInvoice: fakeResolver(),
    ...over,
  })
}

describe('ArkPayer.chargeForRead', () => {
  it('pays each split with ≥1 sat and reports the total', async () => {
    const wallet = okWallet()
    const p = payer({ wallet })
    const res = await p.chargeForRead(testManifest(), '80pct_visible_30s')
    // 10 sats over 70/15/10/5 → 7,1,1,0; the 0-sat split is not paid.
    expect(res.receipts.map((r) => r.amountSat)).toEqual([7, 1, 1])
    expect(res.totalPaidSats).toBe(9)
    expect(res.failures).toEqual([])
    expect(wallet.paid).toHaveLength(3)
  })

  it('carries sub-sat dust and flushes it once it reaches a whole sat', async () => {
    const store = new MemoryBudgetStore()
    const p = payer({ budgetStore: store })
    const m = testManifest()
    await p.chargeForRead(m, '80pct_visible_30s') // review: 1 sat + 500 msat dust
    const second = await p.chargeForRead(m, '80pct_visible_30s')
    const review = second.receipts.find((r) => r.role === 'scholarly_review')
    expect(review?.amountSat).toBe(2) // 1 + flushed dust
  })

  it('debits the monthly budget by the amount actually paid', async () => {
    const store = new MemoryBudgetStore()
    const p = payer({ budgetStore: store })
    await p.chargeForRead(testManifest(), '80pct_visible_30s')
    expect(store.load().spentSats).toBe(9)
    expect(await p.remainingBudget()).toBe(991)
  })

  it('throws BudgetExceededError when the rate would overrun the budget', async () => {
    const p = payer({ monthlyBudgetSats: 5 })
    await expect(p.chargeForRead(testManifest(), '80pct_visible_30s')).rejects.toBeInstanceOf(
      BudgetExceededError,
    )
  })

  it('resets the budget when the month rolls over', async () => {
    const store = new MemoryBudgetStore({ monthKey: '2026-05', spentSats: 998, dustMsat: {} })
    const p = payer({ budgetStore: store })
    const res = await p.chargeForRead(testManifest(), '80pct_visible_30s')
    expect(res.totalPaidSats).toBe(9) // would have exceeded if May's 998 carried over
    expect(store.load().monthKey).toBe('2026-06')
  })

  it('does not let one bad recipient abort the others (allSettled)', async () => {
    const failing: InvoiceResolver = (lnAddress, amountSat) =>
      lnAddress === 'review@x.io'
        ? Promise.reject(new Error('bad address'))
        : Promise.resolve({ invoice: `inv-${lnAddress}`, decoded: { paymentHash: 'cd'.repeat(32), amountSat } })
    const p = payer({ resolveInvoice: failing })
    const res = await p.chargeForRead(testManifest(), '80pct_visible_30s')
    expect(res.failures.map((f) => f.recipient)).toEqual(['review@x.io'])
    expect(res.receipts.map((r) => r.recipient)).toEqual(['translator@x.io', 'relay@x.io'])
  })

  it('retries a failing payment with backoff, then succeeds', async () => {
    let calls = 0
    const flaky: Wallet = {
      payInvoice() {
        calls++
        if (calls < 3) return Promise.reject(new Error('temporary'))
        return Promise.resolve({ preimage: 'ab'.repeat(32) })
      },
    }
    // Single-split manifest so we count attempts precisely.
    const single = testManifest({ splits: [{ lightning_address: 'a@x.io', weight: 100, role: 'translator' }] })
    const p = payer({ wallet: flaky })
    const res = await p.chargeForRead(single, '80pct_visible_30s')
    expect(calls).toBe(3)
    expect(res.totalPaidSats).toBe(10)
  })

  it('never retries when the wallet reports it is disconnected', async () => {
    let calls = 0
    const dead: Wallet = {
      payInvoice() {
        calls++
        return Promise.reject(new WalletDisconnectedError())
      },
    }
    const single = testManifest({ splits: [{ lightning_address: 'a@x.io', weight: 100, role: 'translator' }] })
    const p = payer({ wallet: dead })
    const res = await p.chargeForRead(single, '80pct_visible_30s')
    expect(calls).toBe(1)
    expect(res.failures).toHaveLength(1)
  })

  it('throws on an unknown trigger', async () => {
    const p = payer()
    await expect(p.chargeForRead(testManifest(), 'no_such_trigger')).rejects.toThrow(/no rate/)
  })
})
