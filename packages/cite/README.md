<!-- SPDX-License-Identifier: AGPL-3.0 -->

# @neoark/cite

A tiny drop-in that any website, sermon-notes platform, or Bible game can embed.
When a page renders NeoOS verses, it auto-publishes a `kind:30710` **use-proof**
— so verse usage becomes verifiable public data and no platform can fake
adoption numbers. This is the ecosystem flywheel.

The CDN bundle ships **no crypto** (~**2.6KB raw / 1.3KB gzipped**, well under the
5KB budget): signing is delegated to a NIP-07 signer (`window.nostr`) or an
injected one.

## Use

```html
<span data-neoos-ref="neoos-en-2026:JHN:3:16">For Elohiym so loved the world…</span>

<script src="https://cdn.neoark.org/cite.min.js"></script>
<script>
  NeoArkCite.init({ relays: ["wss://nos.lol"], context: location.href }).scan()
</script>
```

`scan()` finds every `[data-neoos-ref]`, builds a `kind:30710` event per unique
verse (`verse`, `translation`, `consumer`, `context`, `t:neoos-use` tags), signs
it, and publishes to the relays. Refs already seen in this session are not
re-published.

- **`rollup: true`** — fold every fresh ref into one aggregated daily event
  instead of one-per-verse, so a site never leaks per-render analytics.
- **No NIP-07 wallet?** Import as a module and inject a signer:
  ```ts
  import { NeoArkCite, ephemeralSigner } from '@neoark/cite'
  NeoArkCite.init({ relays, signer: ephemeralSigner() }).scan()
  ```
  `ephemeralSigner` lives in a separate module so it (and its `@noble` crypto)
  stays out of the CDN core bundle.

## Build / test

```bash
pnpm --filter @neoark/cite bundle   # → dist/cite.min.js (IIFE, global NeoArkCite)
pnpm --filter @neoark/cite test     # 18 tests; asserts the bundle is < 5KB
```

Demo embeds: [`demos/cite/`](../../demos/cite/) (sermon notes, Bible game with
rollup, blog with ephemeral signer).
