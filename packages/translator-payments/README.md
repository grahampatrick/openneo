<!-- SPDX-License-Identifier: AGPL-3.0 -->

# @neoark/translator-payments

Pays translators a Lightning reward on a successful merge, from the donation pool
(an NWC wallet), and emits a signed, auditable payment record (kind:30712).
**No custody** — funds route donor-wallet → translator via LNURL-pay; the wallet,
HTTP, and invoice resolver are injected.

```ts
const { receipt, record } = await payTranslator(
  { lightningAddress: 'translator@strike.me', sats: 500, mergeEventId, createdAt },
  { wallet, fetchJson, payerSeckey },
)
// record (kind:30712) references the merge, amount, payment hash, and recipient
```

Reuses `@neoark/payer`'s `resolveLnurlPay` (LNURL validation + local BOLT11
decode) and `@neoark/manifest` signing.

```bash
pnpm --filter @neoark/translator-payments test   # 4 tests
```
