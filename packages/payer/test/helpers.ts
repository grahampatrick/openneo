import type { ValueManifest } from '@neoark/manifest'
import type { InvoiceResolver } from '../src/payer'
import type { ResolvedInvoice, Wallet } from '../src/index'

/** A manifest with a 10-sat chapter_read rate and a 70/15/10/5 split. */
export function testManifest(overrides: Partial<ValueManifest> = {}): ValueManifest {
  return {
    version: 'avm-1',
    translation_id: 'osv-en-2025',
    translation_blake3: 'b3:' + 'a'.repeat(64),
    translator_pubkey: '1'.repeat(64),
    issued_at: '2025-01-01T00:00:00Z',
    stream_rates: {
      chapter_read: { sats: 10, trigger: '80pct_visible_30s' },
      citation: { sats: 50, trigger: 'copy_or_share_with_attribution' },
    },
    splits: [
      { lightning_address: 'translator@x.io', weight: 70, role: 'translator' },
      { lightning_address: 'review@x.io', weight: 15, role: 'scholarly_review' },
      { lightning_address: 'relay@x.io', weight: 10, role: 'relay' },
      { lightning_address: 'dev@x.io', weight: 5, role: 'protocol' },
    ],
    fork_policy: { allowed: true, predecessor_blake3: null },
    signature: 'ff'.repeat(32),
    ...overrides,
  }
}

/** A wallet that always settles, recording every invoice it pays. */
export function okWallet(): Wallet & { paid: string[] } {
  const paid: string[] = []
  return {
    paid,
    payInvoice(invoice: string) {
      paid.push(invoice)
      return Promise.resolve({ preimage: 'ab'.repeat(32) })
    },
  }
}

/** An invoice resolver that fabricates a deterministic invoice per recipient. */
export function fakeResolver(): InvoiceResolver {
  return (lnAddress, amountSat): Promise<ResolvedInvoice> =>
    Promise.resolve({
      invoice: `lnbc-${lnAddress}-${String(amountSat)}`,
      decoded: { paymentHash: 'cd'.repeat(32), amountSat },
    })
}
