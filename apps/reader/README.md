<!-- SPDX-License-Identifier: AGPL-3.0 -->

# @neoark/reader-pwa — NeoArk Reader (PWA)

Read NeoOS in the browser, offline-first. SvelteKit + Tailwind in the dark
terminal aesthetic (`#0a0a0a` / `#e6e6e6` / `#6ee7ff`), built as an installable
PWA via `@sveltejs/adapter-static`.

## Features

- **Read** — book/chapter navigation over the content-addressed corpus.
- **Parallel view** — NeoOS beside a parallel column (BSB), toggle on/off.
- **Change history** — per verse, every revision with its **Bitcoin anchor
  status** (`pending` → `bitcoin block N`), mirroring `@neoark/translation-protocol`.
- **Community notes** — signed `kind:30704` commentary, toggleable per verse.
- **"Where is this verse used?"** — a count of `kind:30710` use-proofs.
- **Offline** — a service worker pre-caches the app shell + corpus; an online/
  offline badge reflects connectivity. The corpus loads from `static/corpus/`
  (a sample of Genesis 1 + John 3 ships for the demo; point at the full corpus
  in production).

## Architecture

The data layer (`src/lib/`) is plain TypeScript — `Corpus` (index + offline
search), `reference`, `history` (anchor status), `notes` (kind:30704), `stores`
— and is **unit-tested** independently of Svelte. The routes (`src/routes/`) are
thin Svelte components over that layer.

```bash
pnpm --filter @neoark/reader-pwa dev        # dev server
pnpm --filter @neoark/reader-pwa build       # static PWA → build/
pnpm --filter @neoark/reader-pwa preview      # preview the production build
pnpm --filter @neoark/reader-pwa test         # 11 data-layer tests
pnpm --filter @neoark/reader-pwa typecheck    # svelte-check (0 errors)
```

> **Verification note:** the build, type-check, and data-layer logic are
> verified in CI. The visual UI, PWA install, and true offline behaviour should
> be confirmed in a browser via `preview` (DevTools → Application → Service
> Workers / Offline).
