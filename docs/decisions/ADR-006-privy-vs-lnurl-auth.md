# ADR-006: Privy and LNURL-auth — support both, one keypair shape

**Date:** 2026-06-20
**Status:** Accepted

## Context

Translators come in two flavors: web2 users who expect email/social login, and
Bitcoin-native users who sign in with a Lightning wallet. The protocol needs a
single signing identity (a secp256k1 keypair) regardless of how the user logged in.

## Decision

Support **both** auth methods behind one adapter contract (`AuthProvider` →
`AuthIdentity`), so everything downstream sees only a secp256k1 keypair:

- **Privy** for web2 (email, Google, Twitter). The login resolves to a
  deterministic, recoverable keypair.
- **LNURL-auth** (LUD-04) for Bitcoin-native users. A per-domain *linking key*
  (LUD-05 style) signs the service `k1` challenge and doubles as the ARK identity.

## Rationale

- **Reach vs. sovereignty.** Privy lowers the barrier for the long tail of
  translators; LNURL-auth serves users who want no email and no custodian. Forcing
  one excludes half the contributors.
- **One downstream shape.** Both produce an `AuthIdentity { seckey, pubkey, … }`,
  so proposals/reviews/merges/payouts don't care which was used. The x-only pubkey
  is the Nostr/ARK identity (BIP-340), consistent with ADR-003.
- **Recoverability.** The Privy derivation is deterministic from
  `(appId, userId, appSecret)` so the same login always recovers the same key; the
  derivation tag + inputs are documented in `src/privy.ts`. LNURL-auth keys are
  derived from the wallet seed, so the user already owns recovery.

## Key pitfalls (carried from plan.md)

- Privy keypair derivation must be deterministic and recoverable — document the
  derivation path. ✅ `SHA-256("neoark/privy/v1" | appId:userId:appSecret)`.
- Never hold donations in a hot wallet — payouts use NWC so funds stay in the
  donor's own wallet (see `@neoark/translator-payments`).

## Consequences

- The reference Privy adapter models the derivation deterministically; wiring the
  real Privy SDK (embedded-wallet export) replaces only `derivePrivyIdentity`'s
  internals, keeping the `AuthIdentity` contract.
- LNURL-auth gives a *different* identity per domain by design (LUD-05), so a
  translator's neoark.org key is unlinkable to their key on other services.
