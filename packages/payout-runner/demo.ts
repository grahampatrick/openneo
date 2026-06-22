/**
 * @neoark/payout-runner demo — a governed merge → split Lightning payout.
 *
 *   pnpm --filter @neoark/payout-runner run demo
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { PayoutRunner, MemoryPaidStore } from './src/index'
import { keypairFromSeed } from '@neoark/manifest'
import { RelayPool, MockRelay } from '@neoark/relay'
import { submitProposal, parseProposal, submitReview, parseReview, mergeProposal, signGovernance } from '@neoark/translation-protocol'
import { createTreasury, MemoryProfileRegistry } from '@neoark/payouts'
import type { Wallet, resolveLnurlPay } from '@neoark/payer'

const log = (s: string): void => {
  console.log(s)
}
const TID = 'neoos-en-2026'
const translator = keypairFromSeed('a1'.repeat(32))
const council = ['b1', 'b2', 'b3'].map((s) => keypairFromSeed(s.repeat(32)))
const [m1] = council as [(typeof council)[number], ...(typeof council)[number][]]
const payer = keypairFromSeed('dd'.repeat(32))
const pool = new RelayPool([new MockRelay()])

const wallet: Wallet = { payInvoice: () => Promise.resolve({ preimage: 'ab'.repeat(32) }) }
const resolveInvoice: typeof resolveLnurlPay = (ln, sats) => Promise.resolve({ invoice: `lnbc-${ln}`, decoded: { paymentHash: 'cd'.repeat(32), amountSat: sats } })

const main = async (): Promise<void> => {
  // Governed translation: a council of 3, quorum 3.
  await pool.publish(signGovernance({ translationId: TID, maintainers: council.map((k) => k.pubkey), createdAt: 1 }, m1.seckey))
  log('1. Council of 3 published (governed).')

  // A translator proposes; the 3 council members approve; one merges.
  const pe = submitProposal({ ref: { translationId: TID, book: 'GEN', chapter: 1, verse: 6 }, newText: 'a firmament', rationale: 'raqia', createdAt: 10 }, translator.seckey)
  await pool.publish(pe)
  const proposal = parseProposal(pe)
  const reviews = council.map((k, i) => parseReview(submitReview({ proposalId: proposal.id, vote: 'approve', comment: '', createdAt: 20 + i }, k.seckey)))
  for (const r of reviews) await pool.publish(r.event)
  const merge = mergeProposal(proposal, reviews, m1.seckey, 100, { maintainers: council.map((k) => k.pubkey), mergerPubkey: m1.pubkey })
  await pool.publish(merge.event)
  log('2. Translator proposed, 3 maintainers approved, one merged.')

  // Everyone has a Lightning address.
  const profiles = new MemoryProfileRegistry().set(translator.pubkey, 'translator@strike.me')
  for (const k of council) profiles.set(k.pubkey, `${k.pubkey.slice(0, 4)}@strike.me`)

  const runner = new PayoutRunner({
    wallet,
    fetchJson: () => Promise.reject(new Error('off')),
    payerSeckey: payer.seckey,
    treasury: createTreasury(100_000), // 500 sats/merge
    profiles,
    pool,
    paidStore: new MemoryPaidStore(),
    resolveInvoice,
  })

  log(`\n3. Runner processes governed merges (treasury ${String(runner.treasuryBalance)} sats):`)
  const out = await runner.processGovernedMerges(TID)
  for (const m of out) {
    log(`   merge ${m.mergeEventId.slice(0, 12)}… governed=${String(m.governed)} · paid ${String(m.totalPaidSats)} sats`)
    for (const r of m.recipients) log(`     ${r.role.padEnd(10)} ${String(r.sats).padStart(3)} sats → ${r.lightningAddress ?? '—'} (${r.paid ? 'paid' : r.reason})`)
  }
  log(`\n4. Treasury after: ${String(runner.treasuryBalance)} sats`)

  log('\n5. Idempotency — re-run pays no one again:')
  const again = await runner.processGovernedMerges(TID)
  log(`   ${String(again[0]?.recipients.filter((r) => r.paid).length ?? 0)} paid · treasury still ${String(runner.treasuryBalance)} sats`)

  log('\nGoverned merge → split payout (Translator 70 / Reviewers 20 / Submitter 10). No custody.')
}

await main()
