/**
 * M5 demo — the full Bitcoin-anchored translation flow:
 *   auth → propose → review ×3 → merge (quorum) → anchor (OTS) → pay translator.
 *
 *   pnpm --filter @neoark/translation-protocol run demo
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import {
  submitProposal,
  parseProposal,
  submitReview,
  parseReview,
  mergeProposal,
  anchorBatch,
  verifyAnchor,
  MockCalendar,
  DEFAULT_QUORUM,
} from './src/index'
import { lnurlAuthIdentity, derivePrivyIdentity } from '@neoark/translator-auth'
import { payTranslator } from '@neoark/translator-payments'
import type { Wallet, resolveLnurlPay } from '@neoark/payer'

const log = (s: string): void => {
  console.log(s)
}

// 1. Auth — translator signs in with a Lightning wallet, reviewers via Privy.
const translator = lnurlAuthIdentity('11'.repeat(32), 'neoark.org')
const reviewers = ['r1', 'r2', 'r3'].map((u) => derivePrivyIdentity({ appId: 'neoark', userId: u }, 'secret'))
const maintainer = derivePrivyIdentity({ appId: 'neoark', userId: 'maintainer' }, 'secret')
log(`1. translator authed (LNURL-auth): ${translator.pubkey.slice(0, 16)}…`)

// 2. Propose a correction to Genesis 1:6.
const proposalEvent = submitProposal(
  {
    ref: { translationId: 'neoos-en-2026', book: 'GEN', chapter: 1, verse: 6 },
    newText: 'And Elohiym said, “Let there be a firmament between the waters.”',
    rationale: 'Hebrew raqia = a solid beaten surface; "firmament" over "expanse".',
    createdAt: 1_700_000_000,
  },
  translator.seckey,
)
const proposal = parseProposal(proposalEvent)
log(`2. proposal ${proposal.id.slice(0, 12)}… — ${proposal.ref.book} ${String(proposal.ref.chapter)}:${String(proposal.ref.verse)}`)

// 3. Three peers review and approve.
const reviews = reviewers.map((rev, i) =>
  parseReview(submitReview({ proposalId: proposal.id, vote: 'approve', comment: 'Accurate.', createdAt: 1_700_000_100 + i }, rev.seckey)),
)
log(`3. ${String(reviews.length)} approvals (quorum: ≥${String(DEFAULT_QUORUM.minReviewers)} at ${String(DEFAULT_QUORUM.approvalThreshold)})`)

// 4. Maintainer merges (quorum enforced).
const merge = mergeProposal(proposal, reviews, maintainer.seckey, 1_700_000_200)
log(`4. merged ${merge.event.id.slice(0, 12)}… → corpus update: "${merge.update.newText.slice(0, 40)}…"`)

const main = async (): Promise<void> => {
  // 5. Anchor the day's merges to Bitcoin via OpenTimestamps (batched).
  const calendar = new MockCalendar()
  const anchor = await anchorBatch([merge.event.id, 'a'.repeat(64), 'b'.repeat(64)], calendar)
  log(`5. anchored Merkle root ${anchor.merkleRoot.slice(0, 16)}… (${anchor.attestation.type})`)
  const v1 = await verifyAnchor(merge.event.id, anchor, calendar)
  log(`   verify (pending):  ${JSON.stringify(v1)}`)
  const confirmed = calendar.confirm(anchor.merkleRoot, 840_000, 'cc'.repeat(32))
  const v2 = await verifyAnchor(merge.event.id, { ...anchor, attestation: confirmed }, calendar)
  log(`   verify (bitcoin):  ${JSON.stringify(v2)}`)

  // 6. Pay the translator 500 sats from the donation pool.
  const wallet: Wallet = { payInvoice: () => Promise.resolve({ preimage: 'ab'.repeat(32) }) }
  const resolveInvoice: typeof resolveLnurlPay = (lnAddress, sats) =>
    Promise.resolve({ invoice: `lnbc-${lnAddress}`, decoded: { paymentHash: 'cd'.repeat(32), amountSat: sats } })
  const payout = await payTranslator(
    { lightningAddress: 'translator@strike.me', sats: 500, mergeEventId: merge.event.id, createdAt: 1_700_000_300 },
    { wallet, fetchJson: () => Promise.reject(new Error('off')), payerSeckey: maintainer.seckey, resolveInvoice },
  )
  log(`6. paid ${String(payout.receipt.amountSat)} sats → record ${payout.record.id.slice(0, 12)}…`)
  log('\nDone — proposal anchored to Bitcoin and translator paid, no gatekeeper.')
}

await main()
