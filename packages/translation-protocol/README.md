<!-- SPDX-License-Identifier: AGPL-3.0 -->

# @neoark/translation-protocol

The Bitcoin-anchored translation PR system. Proposals (kind:30702), peer reviews
and merges (kind:30703), and OpenTimestamps-style batch anchoring to Bitcoin.
Full spec: [docs/protocol/TRANSLATION_PROTOCOL.md](../../docs/protocol/TRANSLATION_PROTOCOL.md).

```ts
const proposal = parseProposal(
  submitProposal({ ref, newText: 'a firmament', rationale: 'raqia', createdAt }, translatorKey),
)
const reviews = peers.map((k) => parseReview(submitReview({ proposalId: proposal.id, vote: 'approve', comment: '', createdAt }, k)))
const merge = mergeProposal(proposal, reviews, maintainerKey, createdAt) // enforces quorum

const anchor = await anchorBatch([merge.event.id, …], calendar)           // one Merkle root → Bitcoin
await verifyAnchor(merge.event.id, anchor, calendar)                      // { included, attested, ok }
```

- **Quorum** — `{ minReviewers: 3, approvalThreshold: 0.67 }` by default; latest
  vote per reviewer counts; the author's self-review is dropped; `mergeProposal`
  throws `QuorumNotMetError` if unmet.
- **Anchoring** — `anchorBatch` batches a day's merges into one SHA-256 Merkle
  root and timestamps it via an injected `CalendarClient` (see ADR-005).
  Attestations go `pending` → `bitcoin`. `MockCalendar` is provided for dev/tests.

```bash
pnpm --filter @neoark/translation-protocol test     # 21 tests
pnpm --filter @neoark/translation-protocol run demo  # auth → propose → review → merge → anchor → pay
```
