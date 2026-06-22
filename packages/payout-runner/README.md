<!-- SPDX-License-Identifier: AGPL-3.0 -->

# @neoark/payout-runner

The operator service that turns **governed merges into Lightning payouts**. It
watches the relays for merges of a translation, verifies each is **governed**
(signed by a council maintainer, approvals met the council quorum — ADR-009),
splits the reward across the participants (**Translator 70 / Reviewers 20 /
Submitter 10** — ADR-010), pays each one's Lightning address from the treasury,
and publishes a kind:30712 receipt per recipient. **No custody.**

```ts
const runner = new PayoutRunner({
  wallet,        // NWC wallet (Alby Hub etc.) — injected
  fetchJson,     // injected HTTP (LNURL-pay)
  payerSeckey,   // signs the public receipts
  treasury: createTreasury(100_000),        // donations-only pool, 500 sats/merge
  profiles,      // pubkey → lud16 (from kind:0 events, @neoark/payouts)
  pool,          // relay pool
  paidStore: new FilePaidStore('./paid.json'), // persistent, per-(merge,recipient)
})

const results = await runner.processGovernedMerges('neoos-en-2026')
// each merge: { governed, recipients: [{ role, sats, paid, lightningAddress, receiptId }], totalPaidSats }
```

## Guarantees

- **Only governed merges pay.** An ungoverned translation (no council) is never
  paid — the anti-Sybil guarantee. A merge not signed by a council maintainer is
  skipped.
- **Idempotent + restart-safe.** Paid state is per `(mergeId, recipient)`,
  reserved before the payment and persisted (`FilePaidStore`); a crash/re-run
  never double-pays. A failed payment un-reserves to retry.
- **No silent reallocation.** A recipient with no Lightning address is skipped and
  logged — their share is not redistributed.
- **No custody.** Wallet/HTTP/resolver injected; sats route NWC treasury →
  recipient via LNURL-pay.

## Run it

See [docs/DEPLOY.md](../../docs/DEPLOY.md) for the operator runbook (fund an NWC
wallet, point at the relays, run on a schedule/worker).

```bash
pnpm --filter @neoark/payout-runner test     # 8 tests (governed/idempotent/restart-safe/no-address)
pnpm --filter @neoark/payout-runner run demo  # governed merge → split payout → idempotent re-run
```
