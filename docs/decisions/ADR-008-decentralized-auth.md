# ADR-008: Decentralized auth — LNURL-auth + NIP-07, JWT sessions tied to npub

**Date:** 2026-06-21
**Status:** Accepted

> The Phase-2 plan names this `ADR-004-decentralized-auth.md`, but ADR-004 is
> already taken (BOLT11 decode). To avoid clobbering it, this ADR continues the
> existing monorepo series as **ADR-008**.

## Context

Translators must sign in to propose corrections (M11) without an email, a
password, or a third-party identity vendor. Phase 1 included a Privy adapter in
`@neoark/translator-auth` for web2 logins; M10 supersedes that with a fully
decentralized `@neoark/auth` package. **No Privy, no auth vendor.**

## Decision

Two sign-in methods, both resolving to the same identity (an **npub**) and the
same artifact (a **JWT session**):

- **LNURL-auth (LUD-04)** — the server issues a random `k1` challenge as an
  `lnurl1…` string; the user's Lightning wallet derives a per-domain linking key,
  signs `k1` (ECDSA over secp256k1), and the server verifies `(k1, sig, key)`.
- **NIP-07** — the server issues the same challenge; the user's Nostr browser
  extension (`window.nostr`) signs a kind:22242 auth event carrying it; the
  server verifies the BIP-340 signature and challenge freshness.

Challenges are **single-use and short-lived** (`ChallengeStore`, 5-min TTL,
consumed on first use → replay-proof). On success the server mints a **JWT
(HS256)** whose `sub` is the npub, `pubkey` the x-only hex, and `method` the
flow used. There is no email field anywhere.

## Rationale

- **No vendor, no custody of identity.** Identity is a keypair the user already
  controls (a Lightning wallet or a Nostr key). Nothing to deplatform.
- **One identity for both flows.** An LNURL-auth linking key is a compressed
  secp256k1 key; we reduce it to its x-only form so a Lightning login and a Nostr
  login for the same key produce the **same npub**, consistent with the protocol
  (proposals/reviews are signed by npub, ADR-003).
- **Self-contained JWT.** HS256 is implemented with `@noble/hashes` (HMAC-SHA256)
  rather than pulling `jsonwebtoken` — the format is small and this keeps the
  package free of any JWT/auth dependency. The secret is the server's; tokens are
  stateless and verifiable in the PWA and CLI alike.
- **Works in PWA and CLI.** No DOM dependency in the core; `window.nostr` is only
  touched at the edge (the client builds the event, the server verifies it).

## Alternatives Considered

- **Privy / Auth0 / Clerk** — rejected by requirement: third-party vendors that
  own the identity and add a dependency and a data-sharing surface.
- **Bundling a JWT library** — unnecessary for HS256 and adds a dependency; the
  hand-rolled signer is ~30 lines and fully tested.
- **Sessions stored server-side** — stateless JWT is simpler for a
  multi-surface (PWA + CLI) client; revocation, if needed later, can layer a
  short TTL + refresh.

## Consequences

- `AuthService` is the one entry point: `issueChallenge` → `verifyLnurlAuth` /
  `verifyNip07` → `verifySession`. M11 (translator portal) and the reader PWA
  consume it directly.
- The Phase-1 Privy adapter in `@neoark/translator-auth` is now legacy; new
  surfaces should use `@neoark/auth`.
- Tests: 33 (DoD ≥20), both flows demoed end to end.
