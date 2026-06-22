<!-- SPDX-License-Identifier: AGPL-3.0 -->

# @neoark/auth

Decentralized auth. Translators sign in with their **Lightning wallet**
(LNURL-auth) or **Nostr key** (NIP-07); the result is a **JWT session tied to an
npub**, not an email. No Privy, no auth vendor. See
[ADR-008](../../docs/decisions/ADR-008-decentralized-auth.md).

## One service, two flows

```ts
import { AuthService } from '@neoark/auth'

const auth = new AuthService({ jwtSecret: process.env.JWT_SECRET })
```

### LNURL-auth (Lightning wallet)

```ts
const { k1, lnurl } = auth.issueChallenge('https://neoark.org/api/lnurl-auth')
// → show `lnurl1…` as a QR; the wallet signs k1 and POSTs back (k1, sig, key)
const r = auth.verifyLnurlAuth({ k1, sig, key })
if (r.ok) r.value.token // JWT; r.value.claims.sub is the npub
```

### NIP-07 (Nostr browser extension)

```ts
const { k1 } = auth.issueChallenge()
// client: const ev = await window.nostr.signEvent(buildNip07AuthEvent(k1, now))
const r = auth.verifyNip07(ev)
if (r.ok) r.value.token
```

### Verify a session

```ts
const s = auth.verifySession(token) // → { ok, value: { sub, pubkey, method, iat, exp } }
```

## Guarantees

- **Single-use challenges** — `ChallengeStore` (5-min TTL) consumes a `k1` on
  first use, so a signed response can't be replayed.
- **One npub for both flows** — an LNURL-auth linking key is reduced to its
  x-only form, so a Lightning login and a Nostr login for the same key yield the
  same npub (consistent with how proposals/reviews are signed).
- **Self-contained JWT** — HS256 implemented with `@noble/hashes`; no JWT/auth
  vendor dependency. Stateless, verifiable in both the PWA and the CLI.

```bash
pnpm --filter @neoark/auth test     # 33 tests, ≥80% coverage
pnpm --filter @neoark/auth run demo  # both flows: challenge → sign → verify → session
```
