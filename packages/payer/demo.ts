/**
 * @neoark/payer demo — split a chapter-read charge across recipients over a
 * mocked NWC wallet, with budget enforcement and dust accumulation.
 *
 *   pnpm --filter @neoark/payer run demo
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { ArkPayer, MemoryBudgetStore, computeSplits } from './src/index'
import type { InvoiceResolver } from './src/payer'
import type { ValueManifest } from '@neoark/manifest'

const manifest: ValueManifest = {
  version: 'avm-1',
  translation_id: 'osv-en-2025',
  translation_blake3: 'b3:' + 'a'.repeat(64),
  translator_pubkey: '1'.repeat(64),
  issued_at: '2025-01-01T00:00:00Z',
  stream_rates: { chapter_read: { sats: 10, trigger: '80pct_visible_30s' } },
  splits: [
    { lightning_address: 'translator@strike.me', weight: 70, role: 'translator' },
    { lightning_address: 'review@gtu.edu', weight: 15, role: 'scholarly_review' },
    { lightning_address: 'relay@neoark.io', weight: 10, role: 'relay' },
    { lightning_address: 'dev@neoark.io', weight: 5, role: 'protocol' },
  ],
  fork_policy: { allowed: true, predecessor_blake3: null },
  signature: 'ff'.repeat(32),
}

console.log('Splits for a 10-sat chapter read:')
for (const s of computeSplits(manifest, 10)) {
  console.log(`  ${s.role.padEnd(18)} ${String(s.sats)} sat  (+${String(s.dustMsat)} msat dust)`)
}

const resolveInvoice: InvoiceResolver = (lnAddress, amountSat) =>
  Promise.resolve({ invoice: `lnbc-${lnAddress}-${String(amountSat)}`, decoded: { paymentHash: 'cd'.repeat(32), amountSat } })

const payer = new ArkPayer({
  wallet: { payInvoice: () => Promise.resolve({ preimage: 'ab'.repeat(32) }) },
  budgetStore: new MemoryBudgetStore(),
  fetchJson: () => Promise.reject(new Error('network disabled')),
  monthlyBudgetSats: 1000,
  resolveInvoice,
})

const main = async (): Promise<void> => {
  console.log('\nCharging two chapter reads (watch the dust flush):')
  for (let i = 1; i <= 2; i++) {
    const res = await payer.chargeForRead(manifest, '80pct_visible_30s')
    const paid = res.receipts.map((r) => `${r.role}:${String(r.amountSat)}`).join('  ')
    console.log(`  read ${String(i)} → paid ${String(res.totalPaidSats)} sat  [${paid}]`)
  }
  console.log(`\nRemaining budget: ${String(await payer.remainingBudget())} sat`)
}

await main()
