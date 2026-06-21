<!-- SPDX-License-Identifier: AGPL-3.0 -->

# @neoark/relay

Nostr distribution for ARK use-proofs. Publish and query `kind:30078` use-proof
events across a pool of relays — the data behind the reader's
**"where is this verse used?"** panel.

```ts
const pool = new RelayPool([
  new WebSocketRelay('wss://relay.damus.io', wsFactory),
  new WebSocketRelay('wss://nos.lol', wsFactory),
])

// publish a use-proof (built + signed from a Lightning preimage)
await publishUseProof(
  { manifest, passage: { book: 'John', chapter: 3, verseStart: 16, verseEnd: 21 },
    trigger: '80pct_visible_30s', preimage, amount_sat: 10, created_at },
  readerPrivKey,
  pool,
)

// query — relay filters by kind + time window, then narrows client-side
const proofs = await queryUseProofs({ translationId: 'osv-en-2025', passage: { book: 'John', chapter: 3 } }, pool)
```

## Design

- **`RelayPool`** — publishes to every relay (`Promise.allSettled`, so one dead
  relay never blocks the rest) and merges query results, de-duplicating by event id.
- **`RelayLike`** — the connection contract. Two implementations:
  - **`WebSocketRelay`** — speaks the Nostr wire protocol (`EVENT`/`OK`,
    `REQ`/`EVENT`/`EOSE`) over an **injected** WebSocket factory (browser
    `WebSocket`, node `ws`, or a fake), so this package never bundles a transport.
  - **`MockRelay`** — in-memory, verifies signatures, full NIP-01 filter
    matching. The reusable test/dev relay (also used by the M6 reader).
- **Querying** — use-proofs carry their translation + passage in multi-char tags
  that public relays don't index, so we filter at the relay by kind + time window
  + limit, then narrow client-side (`matchesQuery`). Invalid events are dropped.

```bash
pnpm --filter @neoark/relay test     # 22 tests, ≥80% coverage
pnpm --filter @neoark/relay run demo  # publish → query → verify round trip
```
