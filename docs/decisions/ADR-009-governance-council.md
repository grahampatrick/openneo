# ADR-009: Governance — a maintainer council gates merges (anti-Sybil)

**Date:** 2026-06-22
**Status:** Accepted

## Context

Merges decide what becomes canonical NeoOS — and, once Phase-3 payouts run, each
merge moves real sats. The review engine originally counted **any** distinct
pubkey toward quorum (3 approvals / 67%). With no Sybil resistance, anyone could
generate three keys, self-approve, merge arbitrary text, and (post-payout) drain
the treasury. We need accountable merge control **before** money flows.

## Decision

Introduce a **maintainer council**: an explicit allowlist of pubkeys whose votes
are the only ones that count toward a merge. Implemented as:

- A signed, parameterized-replaceable **governance event** (`kind:30750`, `d` =
  translationId) listing `maintainer` pubkeys + the quorum (`buildGovernanceEvent`
  / `parseGovernance` in `@neoark/translation-protocol`).
- `tallyReviews(reviews, quorum, { maintainers })` — when a council is set, only
  maintainer votes count toward `meetsQuorum`; non-maintainer approvals are tracked
  as `communityApprovals` (a public signal that never merges).
- `mergeProposal` / `maybeMerge` refuse a merge unless the merger is a maintainer.
- **Self-amending:** `resolveGovernance` honors a new config only if signed by a
  current maintainer; the first config bootstraps the founding council, with an
  optional `foundingPubkey` pin for hijack resistance.

For v1 the council is seeded with the operator's single key (one-click "Become
founding maintainer" in the portal), expandable later by a signed amendment.

## Rationale

- **Anti-Sybil before payouts.** Gating merges to named maintainers is the
  precondition for M19 paying out without funding an attack.
- **Preserves "no gatekeeper owns the text."** The council config is a public,
  signed, forkable event; every proposal and vote stays public; anyone may fork
  the translation with their own council. Gatekeeping applies only to what becomes
  *this* canonical NeoOS — not to the right to translate, read, or fork.
- **Backward compatible.** With no governance event, behavior is unchanged
  (permissionless) and the portal badges it "ungoverned (anyone can merge)" — so
  the insecure state is visible, not silent.
- **On-protocol, not a database.** The council lives on relays as signed events,
  consistent with the architecture (identity = pubkey, everything signed).

## Alternatives Considered

- **Open + stake/reputation weighting** — more decentralized, but needs a bonding
  or reputation system that doesn't exist yet. Deferred to a later phase; ADR
  documents council as the v1 step with a migration path.
- **Hardcoded maintainer constant in the app** — not forkable, not auditable on
  relays, requires a code change to amend. Rejected.

## Consequences

- New event kind `30750`; documented in `docs/protocol/TRANSLATION_PROTOCOL.md`.
- `Tally` gains `communityApprovals` + `governed`; `ReviewableProposal` mirrors them.
- The M19 payout runner must verify a merge is **governed** (maintainer-signed,
  council-quorum) before paying — the key pitfall called out in `plan.md`.
- Long-term governance (elected/staked) is a future ADR; the council is amendable
  without protocol changes via signed governance events.
