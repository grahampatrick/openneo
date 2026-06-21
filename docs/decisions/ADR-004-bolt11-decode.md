# ADR-004: BOLT11 invoice decoding — `light-bolt11-decoder`

**Date:** 2026-06-20
**Status:** Accepted

## Context

`@neoark/payer` must decode the BOLT11 invoice returned by an LNURL-pay server
**locally**, before paying it. The non-negotiable rule (plan.md M3): never trust
a payment hash or amount the server hands back out-of-band — derive both from the
invoice itself. So we need a dependable BOLT11 decoder that runs in Node and the
browser.

## Decision

Use **`light-bolt11-decoder`**, wrapped behind our own `decodeBolt11()`
(`src/bolt11.ts`) returning a narrow `DecodedInvoice` (payment hash, amount in
sats, description, description hash, timestamp, expiry).

## Alternatives Considered

- **`bolt11` (bitcoinjs)** — the most complete decoder, but pulls in
  `bitcoinjs-lib` + `secp256k1` native bindings. Heavy, awkward to bundle for the
  PWA, and we only need to *read* a handful of fields. Rejected.
- **Hand-rolled bech32 decoder on `@scure/base`** — feasible (BOLT11 is bech32 +
  tagged fields) and dependency-light, but re-implementing tagged-field and
  amount-multiplier parsing is exactly the kind of fiddly crypto-adjacent code an
  audited library already gets right. Rejected to avoid owning that risk for v1;
  revisit if we want zero extra deps.
- **`light-bolt11-decoder`** — small, no native bindings, browser-friendly,
  already conformance-tested against the BOLT11 spec vectors. Returns a flat
  `sections` array we map to our type. **Chosen.**

## Consequences

- One small runtime dependency. Our `decodeBolt11` is the single choke point, so
  swapping the library later touches one file and its tests.
- We validate the decoded `payment_hash` shape (`^[0-9a-f]{64}$`) and treat the
  decoded amount as authoritative: `resolveLnurlPay` rejects an invoice whose
  amount differs from what we requested, and checks `description_hash` against
  `sha256(metadata)` when present (LUD-06).
- Tested against the canonical BOLT11 spec invoice (2500u, payment hash
  `000102…0102`) so a library regression is caught in CI.
