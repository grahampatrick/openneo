/**
 * @neoark/review demo — the peer-review loop end to end:
 *   proposal on relay → reviewers vote → quorum → maintainer merges.
 *
 *   pnpm --filter @neoark/review run demo
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { fetchReviewQueue, castVote, maybeMerge, pendingOnly } from './src/index'
import { keypairFromSeed, getPublicKey, signEvent } from '@neoark/manifest'
import { RelayPool, MockRelay } from '@neoark/relay'
import { submitProposal } from '@neoark/translation-protocol'
import type { Signer } from './src/types'

const keySigner = (sec: string): Signer => ({ getPublicKey: () => getPublicKey(sec), signEvent: (e) => signEvent(e, sec) })
const log = (s: string): void => {
  console.log(s)
}

const author = keypairFromSeed('a1'.repeat(32))
const reviewers = ['b1', 'b2', 'b3'].map((s) => keypairFromSeed(s.repeat(32)))
const maintainer = keypairFromSeed('cc'.repeat(32))
const pool = new RelayPool([new MockRelay()])

const main = async (): Promise<void> => {
  log('1. A translator publishes a proposal (GEN 1:6 → firmament)')
  const proposalEv = submitProposal(
    { ref: { translationId: 'neoos-en-2026', book: 'GEN', chapter: 1, verse: 6 }, newText: 'a firmament', rationale: 'Hebrew raqia', createdAt: 100 },
    author.seckey,
  )
  await pool.publish(proposalEv)

  let queue = await fetchReviewQueue(pool, 'neoos-en-2026')
  log(`   review queue: ${String(queue.length)} pending · needs ${String(queue[0]?.needed)} more reviewer(s)`)

  log('\n2. Three peers vote (kind:30703)')
  let t = 200
  let n = 0
  for (const reviewer of reviewers) {
    await castVote({ proposalId: proposalEv.id, vote: 'approve', comment: 'Accurate.', createdAt: t++ }, keySigner(reviewer.seckey), pool)
    queue = await fetchReviewQueue(pool, 'neoos-en-2026')
    const st = queue[0]
    log(`   vote ${String(++n)} → ${String(st?.approvals)}/${String(st?.reviewers)} approvals · merge-ready: ${String(st?.mergeReady)}`)
  }

  log('\n3. Threshold met → maintainer merges')
  const target = queue[0]
  if (!target) throw new Error('no proposal in queue')
  const merge = await maybeMerge(target.proposal, target.reviews, maintainer.seckey, 300, pool)
  log(`   ${merge.merged ? 'MERGED' : 'not merged'} · ${merge.reason}`)

  queue = await fetchReviewQueue(pool, 'neoos-en-2026')
  log(`\n   queue now: ${String(pendingOnly(queue).length)} pending, ${String(queue.filter((q) => q.merged).length)} merged`)
  log('\nThreshold logic is configurable per translation (default 3 reviewers, 67%).')
}

await main()
