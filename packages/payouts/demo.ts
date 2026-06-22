/**
 * @neoark/payouts demo — the merge → payout loop:
 *   merge on relay → resolve translator LN address → pay from treasury →
 *   publish receipt (kind:30712). Closes the M10–M13 translator payment loop.
 *
 *   pnpm --filter @neoark/payouts run demo
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { PayoutService, createTreasury, MemoryProfileRegistry } from './src/index'
import { keypairFromSeed } from '@neoark/manifest'
import { RelayPool, MockRelay } from '@neoark/relay'
import { submitProposal, parseProposal, submitReview, parseReview, mergeProposal } from '@neoark/translation-protocol'
import type { resolveLnurlPay } from '@neoark/payer'

const log = (s: string): void => {
  console.log(s)
}

const author = keypairFromSeed('a1'.repeat(32))
const reviewers = ['b1', 'b2', 'b3'].map((s) => keypairFromSeed(s.repeat(32)))
const maintainer = keypairFromSeed('cc'.repeat(32))
const payer = keypairFromSeed('dd'.repeat(32))
const pool = new RelayPool([new MockRelay()])

const main = async (): Promise<void> => {
  // A proposal is reviewed and merged (M11/M12 produced this).
  const pe = submitProposal({ ref: { translationId: 'neoos-en-2026', book: 'GEN', chapter: 1, verse: 6 }, newText: 'a firmament', rationale: 'raqia', createdAt: 100 }, author.seckey)
  await pool.publish(pe)
  const proposal = parseProposal(pe)
  const reviews = reviewers.map((r, i) => parseReview(submitReview({ proposalId: proposal.id, vote: 'approve', comment: '', createdAt: 200 + i }, r.seckey)))
  const merge = mergeProposal(proposal, reviews, maintainer.seckey, 300)
  await pool.publish(merge.event)
  log(`1. Merge on relay: ${merge.event.id.slice(0, 14)}… (translator ${author.pubkey.slice(0, 12)}…)`)

  // The translator's Lightning address comes from their profile.
  const profiles = new MemoryProfileRegistry().set(author.pubkey, 'translator@strike.me')
  const wallet = { payInvoice: () => Promise.resolve({ preimage: 'ab'.repeat(32) }) } // an NWC wallet (OQ-P2-1)
  const resolveInvoice: typeof resolveLnurlPay = (ln, sats) => Promise.resolve({ invoice: `lnbc-${ln}`, decoded: { paymentHash: 'cd'.repeat(32), amountSat: sats } })

  const svc = new PayoutService({
    wallet,
    fetchJson: () => Promise.reject(new Error('off')),
    payerSeckey: payer.seckey,
    treasury: createTreasury(1000), // donations-only pool (OQ-P2-3)
    profiles,
    pool,
    resolveInvoice,
  })
  log(`2. Treasury balance: ${String(svc.treasuryBalance)} sats`)

  log('3. Process merges → pay translators')
  const outcomes = await svc.processMerges('neoos-en-2026')
  for (const o of outcomes) {
    log(`   ${o.paid ? 'PAID' : 'skip'} ${String(o.amountSat ?? 0)} sats → ${o.receipt?.recipient ?? '—'} · ${o.reason}`)
    if (o.record) log(`     receipt event kind:${String(o.record.kind)} ${o.record.id.slice(0, 14)}… published`)
  }
  log(`4. Treasury after: ${String(svc.treasuryBalance)} sats`)

  log('\n5. Idempotency — re-process (no double pay)')
  const again = await svc.processMerges('neoos-en-2026')
  log(`   ${again.map((o) => o.reason).join(', ')} · treasury still ${String(svc.treasuryBalance)} sats`)

  log('\nMerge → pay → receipt. No custody — sats route donor wallet → translator.')
}

await main()
