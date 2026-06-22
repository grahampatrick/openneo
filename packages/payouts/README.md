<!-- SPDX-License-Identifier: AGPL-3.0 -->

# @neoark/payouts

Lightning payouts to translators **on merge**. Listens for merge events, looks up
the translator's Lightning address, pays from the treasury via NWC/LNURL, and
publishes a signed payout receipt (kind:30712). **No custody.** Closes the
M10–M13 translator payment loop.

```ts
const svc = new PayoutService({
  wallet,        // NWC wallet (OQ-P2-1 — caller's choice, e.g. Alby)
  fetchJson,     // injected HTTP (LNURL-pay)
  payerSeckey,   // signs the public payout receipts
  treasury: createTreasury(100_000),   // donations-only pool (OQ-P2-3)
  profiles,      // pubkey → Lightning address (Nostr kind:0 lud16 / auth profile)
  pool,          // relay pool
})

// scan the relays for merges and pay every unpaid one
const outcomes = await svc.processMerges('neoos-en-2026')
// each: { paid, amountSat, receipt, record (kind:30712), reason }
```

## Behaviour

- **Merge-triggered** — `processMerges` joins each merge (kind:30703) to its
  proposal (kind:30702) to find the translator (author) to pay.
- **Treasury** — donations-only, a fixed reward per merge (default **500 sats**,
  OQ-7). A payout is skipped if the balance can't cover the full reward.
- **Idempotent** — a merge id is reserved before the payment and never paid
  twice; a failed payment un-reserves so it can retry.
- **Receipt** — a signed kind:30712 event published to the relays makes every
  payout publicly auditable against the merge it rewards.
- **No custody** — the wallet, HTTP, and invoice resolver are injected; sats
  route donor-wallet → translator directly (reuses `@neoark/payer` +
  `@neoark/translator-payments`).

```bash
pnpm --filter @neoark/payouts test     # 15 tests, ≥80% coverage
pnpm --filter @neoark/payouts run demo  # merge → pay → receipt → idempotent re-run
```
