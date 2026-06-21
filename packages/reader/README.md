<!-- SPDX-License-Identifier: AGPL-3.0 -->

# @neoark/reader

Terminal reader for NeoOS: read scripture, pay translators via Lightning, publish
use-proofs. A tested core (corpus, references, rendering, pay loop) under a thin
CLI shell — see [ADR-007](../../docs/decisions/ADR-007-reader-cli-ui.md).

## CLI

```bash
# render a chapter (no payment) — the Definition-of-Done command
neoark-reader read --translation neoos-en-2026 --no-pay [--passage "Bere'shiyth 1"]

# "where is this verse used?" — query relays for use-proofs
neoark-reader proofs --passage "Bere'shiyth 1:6" [--relay wss://…]

# usage stats for a translation / reader key
neoark-reader translator-stats --pubkey <hex> [--relay wss://…]
```

References accept the book id, English, or Hebrew name (`GEN 1`, `Genesis 1:6`,
`Bere'shiyth 1:1-10`, `1 Samuel 1:1`). A 2-minute session is recorded in
[`demos/m6.cast`](../../demos/m6.cast) (asciinema v2).

## Pay loop

`ReaderSession.onChapterRead(ref)` runs when a chapter qualifies (≥80% visible
for 30s). It charges the manifest splits via `@neoark/payer` `ArkPayer`, then
publishes a use-proof to the relay pool via `@neoark/relay`. The status bar shows
`sats spent / budget | last paid translator | use-proofs published`. `--no-pay`
renders only. Budget defaults to 1000 sats/month.

## Core (tested, no I/O)

`Corpus` (indexed verses + book-name resolution), `parseReference` /
`renderChapter`, `ReaderSession` (pay loop), `readPassage` / `proofsForPassage` /
`translatorStats`, and `SecretStore` (file-backed 0600 default; keytar in prod).

```bash
pnpm --filter @neoark/reader test     # 25 tests, ≥80% coverage
pnpm --filter @neoark/reader run reader read --no-pay   # renders Bere'shiyth 1
```
