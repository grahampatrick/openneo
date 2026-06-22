<!-- SPDX-License-Identifier: AGPL-3.0 -->

# translator — NeoArk Translator Portal

Where authenticated translators propose verse corrections. SvelteKit + Tailwind,
dark terminal aesthetic. Sign in with a Nostr key (NIP-07) via
[`@neoark/auth`](../../packages/auth) — no email, no vendor.

## Flow

1. **Login** — `PortalAuth.loginWithNip07(signer)` → challenge → the user's Nostr
   extension signs it → a JWT session tied to their **npub**.
2. **Browse + edit** — pick a verse, edit the text; a word-level **diff** shows
   exactly what changed (`wordDiff`).
3. **Propose** — `submitProposal()` builds a **kind:30702** event, signs it via
   the extension, validates it against `@neoark/translation-protocol`, and
   publishes to the relay pool.
4. **Status** — `proposalStatus()` derives `pending → approved → merged` from the
   review/merge events on the relay. The approval **threshold is configurable**
   (default 3, the M5 quorum — answers OQ-P2-2).

## Architecture

The logic layer (`src/lib/`) is plain, unit-tested TypeScript — `signer`
(NIP-07 / key-backed), `auth-client` (`PortalAuth`), `proposal` (build/submit/
fetch), `diff`, `status`. The route is a thin Svelte component over it. The
portal never holds a private key: signing is delegated to the Nostr extension.

```bash
pnpm --filter translator test        # 21 tests, ≥80% coverage
pnpm --filter translator build        # static SPA → build/
pnpm --filter translator typecheck    # svelte-check: 0 errors
pnpm --filter translator preview       # run it
```

> **Verification note:** build, type-check, and the logic layer are verified in
> CI; the visual UI and the live NIP-07 extension handshake should be confirmed
> in a browser with a Nostr extension (Alby, nos2x).
