import { describe, it, expect } from 'vitest'
import { payTranslator, KIND_PAYOUT } from '../src/payouts'
import { keypairFromSeed, verifyEventSignature } from '@neoark/manifest'
import type { resolveLnurlPay } from '@neoark/payer'
import type { Wallet } from '@neoark/payer'

const payer = keypairFromSeed('dd'.repeat(32))

const okWallet = (): Wallet & { paid: string[] } => {
  const paid: string[] = []
  return {
    paid,
    payInvoice(inv: string) {
      paid.push(inv)
      return Promise.resolve({ preimage: 'ab'.repeat(32) })
    },
  }
}

const fakeResolve: typeof resolveLnurlPay = (lnAddress, amountSat) =>
  Promise.resolve({ invoice: `lnbc-${lnAddress}-${String(amountSat)}`, decoded: { paymentHash: 'cd'.repeat(32), amountSat } })

const deps = (wallet: Wallet = okWallet()) => ({
  wallet,
  fetchJson: () => Promise.reject(new Error('network disabled')),
  payerSeckey: payer.seckey,
  resolveInvoice: fakeResolve,
})

describe('payTranslator', () => {
  it('pays the translator and returns a receipt', async () => {
    const wallet = okWallet()
    const { receipt } = await payTranslator(
      { lightningAddress: 'translator@x.io', sats: 500, mergeEventId: 'merge123', createdAt: 1 },
      deps(wallet),
    )
    expect(receipt.amountSat).toBe(500)
    expect(receipt.recipient).toBe('translator@x.io')
    expect(receipt.preimage).toBe('ab'.repeat(32))
    expect(wallet.paid).toHaveLength(1)
  })

  it('emits a signed, verifiable payment record referencing the merge', async () => {
    const { record } = await payTranslator(
      { lightningAddress: 'translator@x.io', sats: 500, mergeEventId: 'merge123', createdAt: 1 },
      deps(),
    )
    expect(record.kind).toBe(KIND_PAYOUT)
    expect(record.pubkey).toBe(payer.pubkey)
    expect(verifyEventSignature(record)).toBe(true)
    expect(record.tags).toContainEqual(['e', 'merge123'])
    expect(record.tags).toContainEqual(['amount_sat', '500'])
    expect(record.tags).toContainEqual(['recipient', 'translator@x.io'])
  })

  it('rejects a non-positive payout amount', async () => {
    await expect(
      payTranslator({ lightningAddress: 'a@x.io', sats: 0, mergeEventId: 'm', createdAt: 1 }, deps()),
    ).rejects.toThrow(/positive integer/)
  })

  it('propagates a wallet failure', async () => {
    const failing: Wallet = { payInvoice: () => Promise.reject(new Error('no route')) }
    await expect(
      payTranslator(
        { lightningAddress: 'a@x.io', sats: 10, mergeEventId: 'm', createdAt: 1 },
        deps(failing),
      ),
    ).rejects.toThrow(/no route/)
  })
})
