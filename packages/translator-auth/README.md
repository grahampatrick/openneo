<!-- SPDX-License-Identifier: AGPL-3.0 -->

# @neoark/translator-auth

Two sign-in methods, one identity shape: both resolve to a secp256k1 keypair
(`AuthIdentity`) that signs ARK protocol events. See
[ADR-006](../../docs/decisions/ADR-006-privy-vs-lnurl-auth.md).

```ts
// web2 (email / Google / Twitter) — deterministic, recoverable
const id = derivePrivyIdentity({ appId: 'neoark', userId }, appSecret)

// Bitcoin-native (LNURL-auth, LUD-04)
const id = lnurlAuthIdentity(walletSeed, 'neoark.org')
const sig = signChallenge(k1, id.seckey)   // wallet side
verifyChallenge(k1, sig)                    // service side → true
```

Both yield `{ method, seckey, pubkey, subject }`; the x-only `pubkey` is the
Nostr/ARK identity. LNURL-auth derives a **different key per domain** (LUD-05),
so identities are unlinkable across services.

```bash
pnpm --filter @neoark/translator-auth test   # 11 tests
```
