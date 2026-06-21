<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->

# Bitcoin Translation Protocol

An immutable, Bitcoin-anchored PR system for Scripture translation. Translators
propose verse revisions, peers review, maintainers merge under quorum, and every
merged batch is timestamped to Bitcoin forever. Implemented across three packages:

| Package | Role |
|---|---|
| `@neoark/translation-protocol` | proposals, reviews, merges, OTS anchoring |
| `@neoark/translator-auth` | Privy + LNURL-auth → secp256k1 keypair |
| `@neoark/translator-payments` | Lightning payouts + signed payment records |

All events use the Nostr NIP-01 envelope and BIP-340 Schnorr signatures
(`@neoark/manifest`). Identity = pubkey; there are no accounts.

## Event kinds

| Kind | Event | `content` | Key tags |
|---|---|---|---|
| **30702** | Verse-revision proposal | new verse text | `ark_translation`, `ark_ref`(book,ch,vs), `ark_rationale` |
| **30703** | Review | reviewer comment | `e`(proposalId), `ark_action=review`, `ark_vote`(approve\|reject) |
| **30703** | Merge | — | `e`(proposalId), `ark_action=merge`, `ark_ref`, `ark_quorum`(approvals,reviewers) |
| **30712** | Payout record | — | `e`(mergeId), `ark_action=payout`, `amount_sat`, `bolt11_hash`, `recipient` |

## Lifecycle

```
auth → submitProposal → submitReview ×N → mergeProposal → anchorBatch → payTranslator
        (30702)          (30703 review)    (30703 merge)    (OTS)         (30712)
```

1. **Propose** — `submitProposal({ ref, newText, rationale }, privKey)` → signed 30702.
2. **Review** — `submitReview({ proposalId, vote, comment }, privKey)` → signed 30703.
   `tallyReviews` counts the *latest* vote per reviewer.
3. **Merge** — `mergeProposal(proposal, reviews, maintainerKey)` enforces quorum
   (`{ minReviewers: 3, approvalThreshold: 0.67 }` by default) and drops any
   self-review by the proposal author. Throws `QuorumNotMetError` otherwise.
   Returns the merge event plus the `{ ref, newText }` update to apply to the corpus.
4. **Anchor** — `anchorBatch(mergeEventIds, calendar)` builds one SHA-256 Merkle
   root over a day's merges and timestamps it (see ADR-005). `verifyAnchor`
   proves a given merge is included and the root is attested.
5. **Pay** — `payTranslator({ lightningAddress, sats, mergeEventId }, deps)` pays
   from the donation pool via LNURL-pay over NWC and emits a signed 30712 record.

## Quorum

```ts
{ minReviewers: 3, approvalThreshold: 0.67 }
```

A merge requires at least `minReviewers` distinct reviewers (excluding the
author) and an approval ratio ≥ `approvalThreshold`. Configurable per translation.

## Bitcoin anchoring

Anchoring is **batched**: thousands of merges per day collapse into one Merkle
root, and only the root is timestamped via OpenTimestamps → one Bitcoin
transaction (ADR-005). Proofs are pending (~1 hour) until the Bitcoin attestation
confirms; `Attestation` carries that state (`pending` → `bitcoin`). The
`CalendarClient` interface abstracts the OTS calendar so the protocol is
deterministic and offline-testable; production wires it to a real calendar.

## Auth

Both methods resolve to a secp256k1 keypair (`AuthIdentity`) usable to sign any
protocol event (ADR-006):

- **Privy** — web2 logins (email/Google/Twitter) → deterministic, recoverable
  key derived from the app secret + stable user id.
- **LNURL-auth** — Bitcoin-native; a per-domain linking key signs the `k1`
  challenge (LUD-04) and doubles as the ARK identity.

## Non-custodial payments

Payouts route donor-wallet → translator directly via LNURL-pay over NWC. NeoArk
code never holds funds; the payout record (30712) makes every payment publicly
auditable against the merge it rewards.
