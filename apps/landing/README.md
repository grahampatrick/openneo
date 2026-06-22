<!-- SPDX-License-Identifier: AGPL-3.0 -->

# @neoark/landing

The neoark.org landing page — a single, self-contained static HTML file in the
dark terminal aesthetic (`#0a0a0a` / `#e6e6e6` / `#6ee7ff`)

- **Hero:** *"The Ark holds. The text endures. — running on your hardware."*
- **Feature grid** (hover-to-play clip placeholders): parallel reading, translator
  merge + Bitcoin anchor, use-proof graph, reading plans, offline mode, community notes.
- **Install block:** `npx @neoark/reader`.
- **Donation:** Lightning address + QR placeholder.

```bash
pnpm --filter @neoark/landing serve   # preview at http://localhost:4173
pnpm --filter @neoark/landing build   # → dist/index.html
pnpm --filter @neoark/landing test    # validates hero, install, features, licenses
```

> Verification note: content/structure are asserted by the test suite. Visual
> rendering should be eyeballed via `serve` in a browser.
