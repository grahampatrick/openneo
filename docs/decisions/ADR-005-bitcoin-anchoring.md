# ADR-005: OpenTimestamps (batched) for Bitcoin anchoring

**Date:** 2026-06-20
**Status:** Accepted

## Context

Every merged translation change must be permanently timestamped to Bitcoin so
the revision history is immutable and independently verifiable. Two approaches
were considered: OpenTimestamps (OTS) and Bitcoin Ordinals / on-chain inscription.

## Decision

Use **OpenTimestamps with daily batching**: collect a day's merge event ids as
the leaves of a SHA-256 Merkle tree, and timestamp only the **single root** via
an OTS calendar → one Bitcoin transaction covers thousands of changes.
`@neoark/translation-protocol` implements the Merkle batching + inclusion proofs;
the calendar / Bitcoin attestation is behind a `CalendarClient` interface.

## Rationale

- **Cost.** One OTS commitment per day costs a fraction of a transaction fee and
  covers an unbounded number of merges. Inscribing each change as an Ordinal puts
  full content on-chain and costs per change — orders of magnitude more expensive.
- **Right tool.** We need *proof a change existed at time T*, not on-chain content
  storage. OTS is exactly a timestamp proof; Ordinals is content inscription.
- **Verifiability.** OTS proofs are independently verifiable against the Bitcoin
  blockchain by anyone, with no trusted third party — only the calendar's
  availability for the upgrade step, and the proof stands alone once confirmed.
- **Latency is acceptable.** OTS proofs take ~1 hour to confirm. The protocol
  models this explicitly: an `Attestation` is `pending` until it upgrades to
  `bitcoin`, and the UI shows that state.

## Alternatives Considered

- **Ordinals / inscriptions** — puts the full text on-chain (permanent, but
  expensive and bloats the chain). Rejected for v1; revisit only if there's a
  reason to store content rather than a commitment.
- **Anchor every PR individually** — too many transactions, too costly. Rejected
  in favor of daily batching.

## Consequences

- `CalendarClient` is injected, so the protocol is deterministic and offline in
  tests (`MockCalendar`); production wires a real OTS calendar + Bitcoin node.
- Proofs live under `data/anchors/` (per the repo layout) so anyone can verify.
- `verifyAnchor` checks both Merkle inclusion and the calendar attestation.
