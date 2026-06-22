<!-- SPDX-License-Identifier: AGPL-3.0 -->

# @neoark/review

The peer-review layer. Fetch pending proposals from the relays, cast votes
(kind:30703), apply **configurable threshold logic**, and emit a merge when
quorum is met. The review UI in the translator portal sits on top of this.

```ts
// the queue a reviewer sees
const queue = await fetchReviewQueue(pool, 'neoos-en-2026')   // ReviewableProposal[]
pendingOnly(queue)                                            // still awaiting reviews

// cast a vote (signed via NIP-07 in the browser; key-backed in tests/CLI)
await castVote({ proposalId, vote: 'approve', comment, createdAt }, signer, pool)

// merge when quorum is met (maintainer key — a maintainer action)
const r = await maybeMerge(proposal, reviews, maintainerKey, createdAt, pool)
// r.merged === true once approvals reach the threshold
```

## Threshold logic (configurable)

Every queue/vote/merge call takes an optional `QuorumConfig`
(`{ minReviewers, approvalThreshold }`), defaulting to the M5 quorum
**(3 reviewers, 67% approval)** — answers OQ-P2-2. `reviewState()` reports
`needed` (how many more reviewers) and `mergeReady` (quorum met, not yet merged).
The author's self-reviews are dropped (no self-approval).

Built on `@neoark/translation-protocol` (the kind:30702/30703 schema) and
`@neoark/relay` (publish/query), so every vote and merge validates downstream.

```bash
pnpm --filter @neoark/review test     # 15 tests, ≥80% coverage
pnpm --filter @neoark/review run demo  # proposal → 3 votes → quorum → merge
```
