# ADR-003: BIP-340 Schnorr over ECDSA for all ARK signatures

**Date:** 2026-06-20
**Status:** Accepted

## Decision

All ARK signatures — value manifests (AVM-1), use-proofs (UP-1), verse and
manifest events, and future translation-protocol events — use **BIP-340 Schnorr
over secp256k1 with 32-byte x-only public keys**, via `@noble/curves`'s
`schnorr.sign` / `schnorr.verify`. Not ECDSA.

Signing inputs are a 32-byte SHA-256 digest:
- **Events:** the NIP-01 event id (`sha256` of `[0,pubkey,created_at,kind,tags,content]`).
- **Value manifests:** `sha256(canonicalJson(manifest − signature))`.

Signatures are produced with **zero auxiliary randomness**, making them
deterministic so corpora and fixtures are byte-reproducible across machines.

## Rationale

- **Nostr-native.** ARK is a specialization of Nostr (`neoark-build-prompt.md`):
  "copy Nostr's choices — don't reinvent identity." Nostr identity *is* a BIP-340
  x-only key, and event signatures *are* Schnorr. Using ECDSA would force a
  parallel identity scheme and break relay compatibility.
- **x-only pubkeys.** BIP-340 keys are 32 bytes (x coordinate only), matching the
  `translator_pubkey` / `consumer_pubkey` fields in the AVM-1/UP-1 specs and the
  `npub` encoding. ECDSA needs 33-byte compressed (or 65-byte) keys.
- **Determinism.** BIP-340 with fixed aux randomness yields the same signature
  for the same message+key. ECDSA needs RFC 6979 to be deterministic and is
  malleable (low-s normalization required). Determinism lets us content-address
  and reproduce the entire NeoOS corpus and these fixtures bit-for-bit.
- **Batch verification & linearity.** Schnorr supports batch verification and
  key/signature aggregation — useful for future quorum/multisig governance (M5).
- **One audited dependency.** `@noble/curves` provides Schnorr, secp256k1, and
  (with `@noble/hashes`) BLAKE3/SHA-256 — the same stack already used by the M1
  importer. No new crypto surface.

## Alternatives Considered

- **ECDSA secp256k1** — rejected: 33-byte keys, malleable, not Nostr-native,
  needs RFC 6979 for determinism. No upside here.
- **Ed25519** — rejected: different curve; incompatible with Nostr/Lightning
  identity and with secp256k1 Lightning keys. Would fragment identity.

## Key pitfall (carried from plan.md)

BIP-340 uses **32-byte x-only** pubkeys. Use `schnorr.sign` / `schnorr.verify`
from `@noble/curves/secp256k1` — **not** the ECDSA `sign`/`verify` methods, and
never pass a 33-byte compressed key where a 32-byte x-only key is expected.

## Consequences

- `@neoark/manifest` exposes `getPublicKey`, `normalizePubkey`,
  `normalizeSeckey`, `decodeBech32Key` (npub/nsec) — all normalizing to 32-byte
  x-only hex before any crypto call.
- The M1 importer already signs with the same scheme; a later PR will point it
  at `@neoark/manifest` so there is a single signing implementation
  (see plan: "dedupe signing, separate PR").
