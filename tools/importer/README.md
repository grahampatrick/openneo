<!-- SPDX-License-Identifier: AGPL-3.0 -->

# @neoark/importer

Ingests source Scripture texts → content-addressed, signed ARK verse events.
This is the M1 data layer: everything downstream reads `data/neoos/verses.jsonl`.

## Pipeline

```
sources/raw/bsb.txt           ─┐
sources/raw/extra/*.usfm      ─┤  parse → naming map → BLAKE3 Merkle → sign (BIP-340)
data/neoos/naming-map.json    ─┤
data/neoos/book-order.json    ─┘        │
                                        ▼
        data/neoos/verses.jsonl              (kind:30700, one signed event/line)
        data/neoos/translation-manifest.json (kind:30701 + embedded AVM-1 value manifest)
        data/neoos/accuracy-corrections.json (naming-map audit trail)
```

## Commands

```bash
pnpm --filter @neoark/importer run fetch    # cache official sources (BSB → sources/raw/)
pnpm --filter @neoark/importer run import    # build corpus → data/neoos/
pnpm --filter @neoark/importer run verify    # recompute BLAKE3 root, check signatures
pnpm --filter @neoark/importer test          # unit tests (+coverage, ≥80%)
```

## Content addressing

Each verse hashes over `"<BOOK> <ch>:<vs>\n<text>"` (BLAKE3). Hashes aggregate
verse → chapter → book → canon **root** (parent = BLAKE3 of newline-joined child
hex hashes, canonical order). The root is recorded in the manifest as `b3:<hex>`;
`verify` recomputes it purely from `verses.jsonl` and fails on any drift.

## Signing

Verse + manifest events use Nostr's NIP-01 envelope; the id is the NIP-01
sha256, the signature BIP-340 Schnorr with **zero aux randomness** so output is
byte-reproducible. The signing key is a deterministic dev key by default; set
`NEOOS_SECKEY=<32-byte hex>` for a real release.

## Sources

First-party / public-domain only — **no third-party Bible APIs**. BSB comes
directly from `bereanbible.com`. Apocrypha / Enoch / Jubilees drop in as USFM
under `sources/raw/extra/<BOOKID>.usfm` (see `docs/neoos/SOURCES.md`); books
without a source file are simply skipped, so the build never depends on them.
