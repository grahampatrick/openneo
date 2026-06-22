# ADR-010: Treasury & split payouts on governed merges

**Date:** 2026-06-22
**Status:** Accepted

## Context

M19 turns governed merges into real Lightning payments. Each merge rewards the
people who did the work — the Translator who drafted the text, the Reviewers
(council) who approved, and (later) the Submitter who flagged the issue. We need:
how much, to whom, from where, and how to never double-pay or fund a Sybil attack.

## Decision

- **Split, not single payout.** A merge's reward is divided by role:
  **Translator 70% / Reviewers 20% / Submitter 10%** (`computeMergeSplit` in
  `@neoark/payouts`). The reviewer share is split evenly among the approving
  maintainers; with no distinct submitter, that share folds into the translator;
  the translator absorbs rounding dust so the split is sat-exact.
- **Per-merge rate:** 500 sats total (OQ-P3-5, configurable), from a
  donations-only treasury (OQ-P3-3).
- **Only governed merges are paid.** `@neoark/payout-runner` verifies the merge is
  signed by a **council maintainer** and that the counted approvals are council
  members (depends on ADR-009). An ungoverned translation (no council) is **never
  paid** — this is the anti-Sybil guarantee.
- **Idempotency is per (mergeId, recipient)**, reserved *before* the payment and
  persisted (`FilePaidStore`), so a crash, restart, or re-run never double-pays.
  A failed payment un-reserves so it can retry.
- **No custody.** The wallet (NWC), HTTP, and invoice resolver are injected. Sats
  route the operator's NWC treasury → recipient via LNURL-pay; the runner never
  holds funds beyond the operator-controlled wallet. Each payment publishes a
  signed kind:30712 receipt for public auditing.

The wallet (OQ-P3-1, default **Alby Hub**) plugs into the injected `Wallet`
interface — the runner code is wallet-agnostic.

## Rationale

- **Incentive alignment.** Paying reviewers and submitters, not just translators,
  funds the whole quality pipeline rather than only the final author.
- **Reuses the no-custody engine.** `payTranslator` (`@neoark/translator-payments`)
  already does LNURL-pay + kind:30712 receipts; the runner orchestrates one call
  per recipient. No new payment surface.
- **Safety before money.** Governance gating (ADR-009) + per-recipient persistent
  idempotency are the two attack surfaces (Sybil drain, double-pay); both are
  covered by tests that assert "ungoverned merge is never paid" and
  "restart-safe."

## Alternatives Considered

- **Pay only the translator** (the Phase-2 behavior) — simpler, but doesn't reward
  reviewers/submitters, weakening the review incentive. Rejected for the 3-role model.
- **Static value-manifest splits** — the manifest's splits are fixed addresses per
  role; here recipients are different per merge, so a dynamic per-merge split is
  required.

## Consequences

- New package `@neoark/payout-runner` (operator service) + `computeMergeSplit` in
  `@neoark/payouts`.
- Going live needs the operator to fund an NWC wallet and run the service against
  `relay.openneo.org` (or public relays) — see `docs/DEPLOY.md`.
- The standalone Submitter bounty (linking a flag-only issue event) is M19b; until
  then the submitter share folds into the translator.
