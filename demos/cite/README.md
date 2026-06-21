# @neoark/cite — demo embeds

Three example sites showing the embeddable use-proof SDK:

| File | Shows |
|---|---|
| `sermon-notes.html` | Default usage — `window.nostr` signer, per-verse use-proofs |
| `bible-game.html` | `rollup: true` — one aggregated daily proof (privacy) |
| `blog-post.html` | ESM import with an injected `ephemeralSigner()` (no wallet needed) |

Each renders NeoOS verses marked with `data-neoos-ref="<translation>:<book>:<ch>:<vs>"`.
On load, `NeoArkCite.init({ relays }).scan()` publishes a `kind:30710` use-proof per
verse (or one rollup event), making verse usage verifiable public data on Nostr relays.
