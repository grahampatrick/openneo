<!-- SPDX-License-Identifier: AGPL-3.0 -->

# @neoark/payer

The Lightning payment engine. Reads a value manifest (`@neoark/manifest`),
computes per-recipient splits, and pays each via **LNURL-pay over an NWC wallet**,
under a monthly budget. **No custody** — sats route reader → recipients directly;
this code never holds funds and never touches the network on its own (the wallet
and HTTP fetcher are injected).

## `computeSplits` (pure)

```ts
computeSplits(manifest, 10)
// [{ lightningAddress, role, weight, sats, dustMsat }, …]
// 10 sats over 70/15/10/5 → 7, 1, 1, 0 sats; leftovers as dustMsat (500, …)
```

Whole sats use floor division; the sub-sat remainder is returned as `dustMsat`
so the caller can accumulate it across many small reads and flush it once it
reaches a whole sat. Weights are guaranteed to sum to 100 by `parseManifest`, so
no value is lost.

## `ArkPayer`

```ts
const payer = new ArkPayer({
  wallet,         // { payInvoice(bolt11) → { preimage } }  (NWC, injected)
  budgetStore,    // load()/save() BudgetState  (disk / IndexedDB / memory)
  fetchJson,      // (url) → JSON  (injected; never hits the network in tests)
  monthlyBudgetSats: 1000,
})

const { totalPaidSats, receipts, failures } = await payer.chargeForRead(
  manifest,
  '80pct_visible_30s',
)
```

Guarantees:

- **Budget** — resets on the UTC month boundary; `BudgetExceededError` before any
  payment if the rate would overrun the cap. Debited by sats actually paid.
- **Resilient splits** — `Promise.allSettled`; one bad Lightning address surfaces
  in `failures` without aborting the others.
- **Safe retries** — exponential backoff on payment errors; a settled payment is
  never retried (the wallet returns a preimage only on settlement), and a
  `WalletDisconnectedError` is never retried.
- **Dust** — sub-sat remainders accumulate per recipient and are flushed once they
  reach 1 sat.
- **Trustless amounts** — the LNURL invoice is decoded locally (see
  [ADR-004](../../docs/decisions/ADR-004-bolt11-decode.md)); its amount must match
  the request and its `description_hash` must match the advertised metadata.

## Errors

`BudgetExceededError`, `WalletDisconnectedError`, `LnurlError`, `PaymentError` —
all typed, all exported.

## Commands

```bash
pnpm --filter @neoark/payer test     # 27 tests, ≥80% coverage
pnpm --filter @neoark/payer run demo  # split + pay + dust flush over a mock wallet
```
