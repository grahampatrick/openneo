<!-- SPDX-License-Identifier: AGPL-3.0 -->

# @neoark/manifest

The crypto trust anchor for ARK payments and use-proofs. Parse, sign, and verify
**AVM-1 value manifests** (`spec/value-manifest.md`) and **UP-1 use-proofs**
(`spec/use-proof.md`). Every payment split and every "where is this verse used?"
claim downstream (M3 payer, M4 relay, M5 protocol) is validated through here.

## Install / use

Workspace package — import directly:

```ts
import {
  signManifest,
  verifyManifest,
  parseManifest,
  buildUseProof,
  verifyUseProof,
  parseUseProof,
  keypairFromSeed,
} from '@neoark/manifest'
```

## Value manifests (AVM-1)

```ts
const { seckey, pubkey } = keypairFromSeed('01'.repeat(32))

const manifest = signManifest(
  {
    version: 'avm-1',
    translation_id: 'osv-en-2025',
    translation_blake3: 'b3:7d3a…',
    translator_pubkey: pubkey, // overwritten with the signer's pubkey
    issued_at: '2025-01-01T00:00:00Z',
    stream_rates: { chapter_read: { sats: 10, trigger: '80pct_visible_30s' } },
    splits: [{ lightning_address: 'ruiz@strike.me', weight: 100, role: 'translator' }],
    fork_policy: { allowed: true, predecessor_blake3: null },
  },
  seckey,
)

verifyManifest(manifest) // → { valid: true, errors: [] }
parseManifest(json)      // → typed ValueManifest, or throws ManifestParseError
```

- **`parseManifest(json)`** — AJV-validates against the canonical JSON Schema
  (draft 2020-12) plus semantic rules (`splits` weights sum to 100; every
  `stream_rates[*].trigger` is a normative AVM-1 trigger). Throws
  `ManifestParseError` with an `errors: string[]` detail list.
- **`signManifest(manifest, privKey)`** — BIP-340 Schnorr over
  `sha256(canonicalJson(manifest − signature))`. Sets `translator_pubkey` to the
  signer's key. `privKey` is 64-char hex or an `nsec…`.
- **`verifyManifest(manifest)`** — schema + semantics + signature →
  `{ valid, errors }`.

### Why canonical JSON

The signed bytes are the manifest serialized with **recursively sorted object
keys** (`canonicalJson`). A manifest therefore verifies after any round-trip
through a JSON tool that reorders keys — the signature binds content, not byte
layout.

## Use-proofs (UP-1)

```ts
const proof = buildUseProof(
  {
    manifest,
    passage: { book: 'John', chapter: 3, verseStart: 16, verseEnd: 21 },
    trigger: '80pct_visible_30s',
    preimage: 'a1'.repeat(32), // Lightning payment preimage
    amount_sat: 10,
    created_at: 1717545600,
    app: 'neoark-reader/0.3.2',
  },
  readerSeckey,
)

verifyUseProof(proof, manifest) // → { valid: true, errors: [] }
```

A use-proof is a Nostr `kind:30078` event. `verifyUseProof` runs the UP-1 checks:

1. Event Schnorr signature validates against the reader pubkey (NIP-01 id).
2. `bolt11_hash === sha256(preimage)` — proves the Lightning payment settled.
3. `ark_translation` / `ark_blake3` match the given signed manifest.
4. `amount_sat` equals `stream_rates[trigger].sats` in the manifest.

(Step 5 of the spec — live LN-node invoice lookup — is out of scope here; it
belongs to the payer in M3.) `buildUseProof` derives `bolt11_hash` from the
preimage, so generated proofs satisfy the payment anchor by construction.

## Keys

BIP-340 uses **32-byte x-only public keys**. Helpers accept raw hex or NIP-19
bech32 and normalize to hex: `getPublicKey`, `normalizePubkey`,
`normalizeSeckey`, `decodeBech32Key`, `keypairFromSeed` (deterministic, for
fixtures/demos — not production secrets).

## Fixtures

`fixtures/osv-en-2025.manifest.json` + `fixtures/use-proofs.json` (3 events),
regenerated deterministically by `scripts/gen-fixtures.ts`. `test/fixtures.test.ts`
asserts they all verify. M3/M4/M5 import these as cross-package fixtures, so a
spec change here breaks downstream tests together (intended).

## Commands

```bash
pnpm --filter @neoark/manifest test    # 42 tests, ≥80% coverage
pnpm --filter @neoark/manifest run demo # sign → verify → use-proof round trip
```

See [ADR-003](../../docs/decisions/ADR-003-bip340-schnorr.md) for the
BIP-340-vs-ECDSA decision.
