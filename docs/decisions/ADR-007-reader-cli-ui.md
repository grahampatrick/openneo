# ADR-007: Reader CLI — testable core + lightweight terminal output (not Ink)

**Date:** 2026-06-20
**Status:** Accepted

## Context

The M6 reader is a terminal app: read NeoOS, pay translators, publish use-proofs.
The plan suggested an Ink (React-for-the-terminal) TUI with arrow navigation. We
need the reader to be (a) unit-testable in CI with no TTY, and (b) able to satisfy
the Definition of Done headlessly (`read --no-pay` renders a chapter; `proofs`
returns use-proofs).

## Decision

Split the reader into a **pure, tested core** and a **thin CLI shell**:

- Core (`corpus`, `reference`, `render`, `session`, `commands`, `secret-store`)
  has no `process`/TTY/network dependency — every function takes its inputs and
  returns strings/data. This is what the tests exercise.
- `cli.ts` parses argv (`node:util` `parseArgs`), loads the corpus, wires a
  `RelayPool`, and prints. Rendering is plain text + ANSI; there is **no React/Ink**.

External systems are injected: the NWC wallet (`@neoark/payer` `Wallet`), the
relay transport (`@neoark/relay` `WebSocketRelay` over an injected factory /
`MockRelay`), and secret storage (`SecretStore`).

## Rationale

- **Testability.** Ink renders through a TTY and React reconciler — awkward to
  assert on and impossible to exercise in headless CI. A pure render function
  returning a string is trivially testable, so the reader's logic is covered.
- **Dependency weight.** Ink pulls in React and a reconciler for what is, at v1,
  chapter text + a status line. Plain ANSI keeps the CLI light and fast to start.
- **DoD headless.** `read --no-pay` and `proofs` run and are tested without a
  terminal.

## Consequences

- Interactive arrow-key navigation between chapters is a thin shell concern
  layered on the (tested) `Corpus.chapters()` / `renderChapter()` core; it can be
  added with `readline` keypress events or swapped for Ink later **without
  touching the core or its tests**.
- Secret storage uses a `SecretStore` interface: a file-backed 0600 store by
  default, with the OS keychain (keytar) as the production implementation —
  abstracted so native-module availability never blocks tests.
