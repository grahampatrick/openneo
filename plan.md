# OpenNeo — Phase 3: Production Launch (Compound Engineering Plan)

_Version: 3.0 | Date: 2026-06-22 | Picking up after M0–M15 (all live at openneo.org)_

Phase 3 turns a **deployed demo** into a **real translator community with economic
incentives and trustworthy governance**. The core protocol is built and tested;
what remains is operator/governance work — collecting payout addresses, running a
funded treasury, scoping who can merge (anti-Sybil), and hardening the launch.

> Living document. Update it when decisions change. Older phase plans live at
> `~/neoark/plan.md` (Phase 1) and `~/neoark/plan-phase2.md` (Phase 2).

---

## Current State

### Working & live (openneo.org)
| Area | Package / App | Status |
|---|---|---|
| Corpus (85/87 books, 42,206 verses) | `tools/importer` | ✅ BLAKE3-verified, naming map applied; CI-gated `verify` |
| Crypto core (AVM-1 manifest, UP-1 use-proof) | `packages/manifest` | ✅ 42 tests, BIP-340 |
| Lightning splits engine | `packages/payer` | ✅ LNURL-pay over NWC, no custody |
| Nostr distribution | `packages/relay` | ✅ publish/query; `MockRelay` + `WebSocketRelay` |
| Bitcoin translation protocol | `packages/translation-protocol` | ✅ propose/review/merge/OTS-anchor |
| Peer review engine | `packages/review` | ✅ queue, vote, threshold, merge |
| Payout engine | `packages/payouts` | ✅ tested — but **not run** against a real treasury |
| Decentralized auth | `packages/auth` | ✅ LNURL-auth + NIP-07 → JWT tied to npub |
| Translator-payments | `packages/translator-payments` | ✅ kind:30712 receipts |
| Embeddable use-proof SDK | `packages/cite` | ✅ <5KB bundle |
| CLI reader | `packages/reader` | ✅ `read / proofs / translator-stats` |
| Reader PWA | `apps/reader` | ✅ live `/read`, offline, full corpus |
| Translator portal | `apps/translator` | ✅ live `/translate`, real propose→review→merge, verse picker over 85 books |
| Landing | `apps/landing` | ✅ live `/` |
| Relay image (not deployed) | `infra/relay` | ⚙️ Dockerfile + ARK-tuned config ready; **not running** |
| Deploy pipeline | `vercel.json`, `scripts/build-site.mjs`, `scripts/healthcheck.mjs` | ✅ auto-deploy on push to `main` |
| ADRs 001–008, DEPLOY.md, SOURCES, TRANSLATION_PROTOCOL | `docs/` | ✅ |

### Scaffolded but not production-wired
- **`PayoutService`** — `processMerges(translationId)` + `profilesFromMetadata` (reads kind:0 `lud16`) work in tests, but no process runs them, treasury is in-memory, no NWC wallet is connected.
- **`infra/relay`** — image + config exist; `relay.openneo.org` is not deployed. Portal/reader fall back to public relays (`nos.lol`, `damus`, `snort`).

### Missing (the Phase-3 gaps)
1. **Payout addresses** — the portal never publishes a translator's Lightning address (kind:0 `lud16`); `PayoutService` therefore skips everyone with "no Lightning address."
2. **Funded treasury + running payout service** — no sats pool, no connected wallet, no job invoking payouts on merge.
3. **Governance / anti-Sybil** — `tallyReviews` counts **any** distinct pubkey toward quorum (3 approvals / 67%). No maintainer allowlist exists in the manifest, so 3 self-made keys can merge — and, once payouts run, drain the treasury.
4. **Last 2 books** — Jubilees + 2 Baruch have no clean public-domain machine-readable source found.
5. **NIP-07 merge** — `maybeMerge`/`mergeProposal` require a **raw** maintainer key; extension (NIP-07) maintainers cannot merge.
6. **`www.openneo.org`** — cert pending; apex is primary, so non-blocking.

---

## North Star

> Anyone opens **openneo.org/translate**, signs in with one click (a generated key — no extension needed), proposes a correction to any of the 87 books; a **known council of reviewers** votes and merges it; the change is anchored to Bitcoin, and the **payout splits in Lightning across everyone who did the work** — translator, reviewers, and the submitter who flagged it — with every step a public, signed, verifiable event and no central account anywhere.

## Translator Roles & Payment Splits

Three roles, mapped to existing primitives. Submitter and Translator are **open**
(anyone, one-click key); Reviewer/Council is the **gated** role (the M17 maintainer
allowlist — the people who "log in and check"). Payout on merge is a **dynamic
per-merge Lightning split** across the actual participants, reusing the no-custody
LNURL/NWC engine in `@neoark/payer` (whose splits are already role-weighted).

| Role | Permission | Event | Default share |
|---|---|---|---|
| **Submitter** | open (anyone) | flags an issue (kind:30702 *issue* variant), or folded into the proposal | 10% |
| **Translator** | open (anyone) | drafts the corrected verse text (kind:30702 *proposal*) | 70% |
| **Reviewer / Council** | gated = maintainer allowlist | votes approve/reject (kind:30703) | 20%, split among the approvers |

**Flow:** Submitter flags → Translator drafts → Reviewers (council) vote → quorum →
merge → BLAKE3 root updates + Bitcoin anchor → split Lightning payout.

**Sequencing note:** Submitter + Translator may be the **same person by default**
(flag + draft in one proposal). The standalone flag-only Submitter bounty needs an
extra issue event + linking, so **Translator + Reviewer splits land first (M19)**
and the separate Submitter role is a fast follow (M19b). Splits are configurable
(see OQ-P3-5); 70/20/10 is the default.

**NIP-07 decision:** NIP-07 stays as an *optional* login alongside one-click
"Create a key" and nsec import. It is **not required** to propose, review, or merge.
NIP-07-specific *merge* support is **deferred** (council can merge with a local
key); see M18 (optional).

---

## Milestones

> Critical path: **M16 → M17 → M18 → M19** (the real payment-with-governance loop), with **M20** (public relay) runnable in parallel, then **M21** (books) and **M22** (launch hardening). **M17 must land before M19** — paying real sats with no Sybil resistance is a treasury-drain attack.

---

### M16 — Translator Profiles (Nostr kind:0 + Lightning address)

**Goal:** A translator sets a display name and Lightning address in the portal, published as a signed Nostr kind:0 metadata event carrying `lud16` — the payout target every later milestone reads.

**Deliverables:**
- [ ] `packages/translator-auth` or new `apps/translator/src/lib/profile.ts` — `buildProfileEvent({ name, lud16, about }, createdAt)` → unsigned kind:0 event; `parseProfile(event)` → `{ name?, lud16?, about? }`
- [ ] Validate `lud16` is a Lightning Address (`name@domain`) before publishing; reject otherwise with a clear message
- [ ] Portal **Profile** tab/panel: load current profile (query kind:0 by the session pubkey), edit name + Lightning address, **Sign & publish** via the active signer (NIP-07 or local key), confirm relays accepted
- [ ] Portal surfaces "⚠ Set a Lightning address to get paid on merge" when the signed-in user's profile has no `lud16`
- [ ] Reuse `@neoark/payouts` `profilesFromMetadata` to confirm round-trip (publish → query → resolve address)
- [ ] Tests: `apps/translator/test/profile.test.ts` (build/parse/validate); a round-trip test through `MockRelay` + `profilesFromMetadata`

**CE Principle:** Establishes the **identity → payout-address** mapping as public Nostr data. M19's payout service and any future "translator stats" read it directly — no private database of who-gets-paid-where.

**Key pitfalls:**
- Don't invent a custom event kind — NIP-01 **kind:0** with the `lud16` field is what wallets, `profilesFromMetadata`, and the broader Nostr ecosystem already understand.
- kind:0 is a *replaceable* event — newer `created_at` replaces the old profile. Always stamp `created_at = now`, and when reading take the newest.
- A Lightning **Address** (`lud16`, `name@domain`) is not an LNURL (`lud06`); `@neoark/payouts` expects the address form.

**Definition of Done:**
```bash
pnpm --filter translator test          # incl. profile build/parse/round-trip
pnpm --filter translator typecheck     # svelte-check: 0 errors
pnpm lint && pnpm run build:site
# manual: set an address in the portal → query kind:0 → profilesFromMetadata resolves it
```

---

### M17 — Governance: maintainer-scoped review (anti-Sybil)

**Goal:** Only an explicit **council of maintainer pubkeys** counts toward merge quorum, closing the Sybil hole before any sats move; community members may still vote as a public signal.

**Deliverables:**
- [ ] **ADR-009** — governance model: council/maintainer allowlist for v1 (vs. open + stake/reputation); document the "no gatekeeper" tension resolution (forkability + public votes preserve it)
- [ ] Governance config as a signed event or a field in the translation manifest: `maintainers: string[]` (npub/hex) + `quorum: { minReviewers, approvalThreshold }`, signed by the translation key. Define its kind/schema in `docs/protocol/TRANSLATION_PROTOCOL.md`
- [ ] `packages/translation-protocol` — `tallyReviews(reviews, quorum, opts?)` gains an optional `maintainers` allowlist; votes from non-maintainers are tracked separately (`communityApprovals`) and **do not** count toward `meetsQuorum`
- [ ] `packages/review` — `reviewState` / `fetchReviewQueue` thread the maintainer set through; `maybeMerge` refuses if the merger is not a maintainer
- [ ] Portal **Review** tab: badge maintainers vs community; show "maintainer approvals X/N · community signal Y"; Merge button only for maintainers
- [ ] Tests: maintainer-scoped quorum (community votes don't merge; 3 maintainer approvals do); non-maintainer merge rejected; backward-compat when no maintainer set is configured (falls back to permissionless — explicitly flagged)

**CE Principle:** A **trustworthy merge** is the precondition for spending real money. Once merges require named maintainers, M19 can pay out without funding an attack. The maintainer set is itself a signed, auditable, forkable event.

**Key pitfalls:**
- Do **not** silently change existing behavior — when no governance config exists, keep permissionless but log/badge it as "ungoverned (anyone can merge)". Tests must cover both paths.
- Quorum is over **maintainer** reviewers, not all reviewers — a proposal with 10 community approvals and 0 maintainer approvals is **not** merge-ready.
- Self-review exclusion (author ≠ reviewer) still applies on top of the allowlist.
- Preserve the architectural value: anyone can **fork** the translation with their own maintainer set; gatekeeping applies only to *this* canonical NeoOS, and all votes stay public.

**Definition of Done:**
```bash
pnpm --filter @neoark/translation-protocol test   # maintainer-scoped tallies
pnpm --filter @neoark/review test                 # merge gated to maintainers
pnpm --filter @neoark/review run demo             # council approves → merge; community-only → no merge
pnpm --filter translator test && pnpm lint && pnpm typecheck
```

---

### M18 — NIP-07 merge support _(optional / deferred)_

**Status:** Deferred. NIP-07 stays an optional *login*; it is not required to
propose, review, or merge. Council members can merge with a local key today. Build
this only if extension-based maintainers ask for it. The work below is the unify-
on-`Signer` refactor that also benefits M19.

**Goal:** Maintainers signed in with a browser extension (NIP-07) can merge, not just local-key holders.

**Deliverables:**
- [ ] `packages/translation-protocol` — `mergeProposal` accepts a `Signer` (the NIP-07-shaped interface already used by proposals/votes) in addition to a raw key; keep the raw-key overload for CLI/server
- [ ] `packages/review` — `maybeMerge(proposal, reviews, signer, …)` (Signer-based); update its types + demo
- [ ] Portal `merge()` uses `activeSigner(store)` for both local and extension identities; remove the "merge needs a local key" limitation
- [ ] Tests: merge via a key-backed Signer and via a mock NIP-07 signer produce identical, valid kind:30703 merge events

**CE Principle:** Unifies signing on one `Signer` abstraction across propose/vote/merge, so every future signed action (payout authorization, governance updates) uses the same path — no more raw-key special cases.

**Key pitfalls:**
- A merge event must remain a valid kind:30703 with the `ark_action=merge` + quorum tags regardless of signer source — assert byte-shape equivalence in tests.
- NIP-07 `signEvent` is async and may prompt the user; the portal must handle rejection/cancel gracefully.

**Definition of Done:**
```bash
pnpm --filter @neoark/translation-protocol test
pnpm --filter @neoark/review test
pnpm --filter translator test && pnpm typecheck && pnpm lint
```

---

### M19 — Treasury & Split Payout Runner (pay everyone who did the work)

**Goal:** A running operator service connects an NWC wallet, watches the relay for **governed** merges, computes the **per-merge split** (Translator 70% / Reviewers 20% / Submitter 10%), and pays each participant's `lud16` in Lightning, publishing kind:30712 receipts — no custody.

**Deliverables:**
- [ ] **ADR-010** — treasury & split-payout operations: NWC wallet (OQ-P3-1), funding source (OQ-P3-3), per-merge total + split percentages (OQ-P3-5), durable paid-state store
- [ ] `packages/payouts` — `computeMergeSplit({ translator, reviewers[], submitter? }, totalSats, percents)` → per-pubkey sat amounts (floor + dust handling, reusing the payer's split math); **dynamic** per-merge recipients, not the manifest's static splits
- [ ] `packages/payout-runner` (or `tools/payout-runner`) — long-running process: connect NWC wallet, build `ProfileResolver` from live kind:0 events, load treasury balance + a persistent `PaidStore` (file/SQLite, survives restarts), subscribe merges, resolve each participant's `lud16`, pay each share, log outcomes
- [ ] **Only pay governed merges** — verify the merge is by a maintainer and the counted approvals are maintainers (M17) before paying; reject ungoverned merges
- [ ] Identify participants from the merge's linked events: the proposal author (Translator), the approving reviewers (Reviewers), and the linked issue author (Submitter, if present — else fold into Translator)
- [ ] Receipts (kind:30712) per recipient published to the relay; a read path (CLI/stats) so anyone can verify a payout
- [ ] `infra/` — deployment unit + runbook in `docs/DEPLOY.md`
- [ ] Tests: end-to-end through `MockRelay` (governed merge → resolve participants' lud16 → split-pay via injected wallet → receipts published → idempotent → restart-safe); skip recipients with no address (don't reallocate silently — log it); insufficient-treasury path

**M19b (fast follow) — standalone Submitter bounty:** add a kind:30702 *issue* event (flag without drafting), link the Translator's proposal to it, and include the issue author in the split as the 10% Submitter. Until then, Submitter share folds into the Translator (proposer).

**CE Principle:** The first time real value flows. Persistent idempotent paid-state + receipts-on-relay make every payout publicly auditable and replay-safe — the audit trail others (stats dashboards, translators) build on.

**Key pitfalls:**
- **Never pay an ungoverned merge** (depends on M17) — without it, the runner funds a Sybil attack.
- **Idempotency must survive restarts** — the in-memory `MemoryPaidStore` is test-only; production needs a durable `PaidStore`, reserved *before* the payment call (the engine already reserves-then-pays; persist that).
- **No custody** — sats route donor-wallet → translator via NWC/LNURL; the runner never holds funds beyond the NWC wallet the operator controls.
- A payout failure must un-reserve so it can retry (engine already does this; verify against the persistent store).
- Secrets (NWC URI) never in git — env/secret store only.

**Definition of Done:**
```bash
pnpm --filter @neoark/payout-runner test   # governed→paid, idempotent, restart-safe, insufficient/missing-addr
pnpm --filter @neoark/payout-runner run demo   # merge → pay (mock wallet) → receipt
pnpm lint && pnpm typecheck
# staging: run against a real NWC test wallet + relay; one real merge pays one real (test) address
```

---

### M20 — Public relay (relay.openneo.org)

**Goal:** A durable, ARK-tuned relay the community publishes to, so proposals/reviews/merges/receipts don't depend on third-party public relays staying up.

**Deliverables:**
- [ ] Deploy `infra/relay` (nostr-rs-relay, ARK kind allowlist) to a host with a TLS proxy → `wss://relay.openneo.org/`
- [ ] Persistent DB volume; health check; basic rate limits / abuse config reviewed
- [ ] Point portal + reader default relay lists at `relay.openneo.org` (keep public relays as redundancy)
- [ ] `scripts/healthcheck.mjs` (or a new probe) checks the relay over NIP-11 + a publish/query round-trip
- [ ] DNS + TLS documented in `docs/DEPLOY.md`

**CE Principle:** A relay the project controls makes use-proofs, proposals, and receipts durable and queryable on day one — the substrate every "where is this used / what's my status / did I get paid" view reads.

**Key pitfalls:**
- The ARK kind allowlist must include every kind in use (0, 1, 22242, 30078, 30700–30712) or events silently drop — diff the allowlist against the protocol doc.
- `wss://` needs TLS termination in front of the container; the bare relay is `ws` on :8080.
- Don't make it a single point of failure — clients keep multi-relay fallback.

**Definition of Done:**
```bash
node scripts/healthcheck.mjs https://openneo.org      # site still green
# new: relay probe — NIP-11 info + publish a signed test event + query it back returns it
# manual: portal publishes a proposal that lands on relay.openneo.org and is queryable
```

---

### M21 — 87-Book completion (Jubilees + 2 Baruch)

**Goal:** Ingest the final 2 books so the corpus is the full 87, with the same verification bar as the other 85.

**Deliverables:**
- [ ] Acquire clean public-domain text for **Jubilees** and **2 Baruch** (R.H. Charles 1913). See OQ-P3-4 resolution path — no clean machine-readable source has been found; options are a hand-verified parse of the archive.org critical editions (`cu31924060029984`, `theapocalypseofb00charuoft`) or user-provided text
- [ ] Converter handling the source's verse segmentation (extend `sources/raw/extra/convert-charles.mjs`), with marker/apparatus stripping and **monotonic chapter/verse acceptance** (as used for Enoch/Jasher)
- [ ] USFM in `tools/importer/sources/raw/extra/{JUB,2BA}.usfm`; book ids already reserved in `parse-extra.ts`
- [ ] Re-run importer; naming map applied; **new BLAKE3 root**; manifest + PWA corpus updated; `docs/neoos/SOURCES.md` updated to 87/87
- [ ] Spot-check sample verses per book for OCR/apparatus bleed before committing

**CE Principle:** Completes the corpus to its full canonical claim; the converter + provenance pattern is reusable for any future public-domain text.

**Key pitfalls:**
- The archive.org Charles editions interleave translation with footnotes/cross-references — a naive parse **corrupts Scripture**. Verse boundaries must be validated (monotonic) and apparatus stripped; spot-check before committing.
- Cite provenance precisely in `SOURCES.md` (edition, source, license) — `SOURCES.md` is CI-gated.

**Definition of Done:**
```bash
pnpm --filter @neoark/importer run import
pnpm --filter @neoark/importer run verify    # new root matches manifest
pnpm --filter @neoark/importer test
# assert 87 books / verse count; spot-check JUB + 2BA sample verses render clean
```

---

### M22 — Launch hardening & public signal

**Goal:** Make OpenNeo a trustworthy public launch — domains, observability, a public stats view, and contributor onboarding.

**Deliverables:**
- [ ] **`www.openneo.org`** cert resolved (Vercel Domains: refresh/re-add www; verify no CAA block); both apex + www serve 200
- [ ] **Uses/stats view** — a page (extend `apps/landing` or a small `apps/uses`) querying relays for top-cited verses, open proposals, merges, and payout receipts (verifiable public numbers, no private DB) — fulfilling the project's "verifiable stats" non-negotiable
- [ ] **Monitoring** — uptime/health checks for site + relay + payout runner; alert on failure
- [ ] **Abuse/rate handling** reviewed at the relay and portal (proposal spam, vote spam)
- [ ] **Contributor docs** — `CONTRIBUTING.md`, repo description/topics, a "how to become a maintainer" doc tied to the M17 governance model
- [ ] **Security pass** — `pnpm run` a dependency/secret audit; confirm no secrets in git; license headers present

**CE Principle:** Verifiable public stats + monitoring close the loop the whole protocol was designed for — adoption that anyone can independently verify from signed events, not vendor claims.

**Key pitfalls:**
- Stats must be derived from public signed events (use-proofs, proposals, receipts), never a private analytics store — that's an architectural non-negotiable.
- Don't ship telemetry/PII; use-proofs and stats stay crypto-only.

**Definition of Done:**
```bash
node scripts/healthcheck.mjs https://openneo.org
node scripts/healthcheck.mjs https://www.openneo.org   # both 200
pnpm test && pnpm lint && pnpm typecheck
# manual: stats page shows real proposals/merges/receipts pulled from relays
```

---

## Open Questions

| ID | Question | Owner | Resolution Path |
|---|---|---|---|
| OQ-P3-1 | Which NWC wallet holds/sends the treasury? (Alby Hub, Mutiny, Phoenixd) | Graham | Pick before M19. Default: Alby Hub (mature NWC, hosted option). Spike a testnet/low-balance connection in M19 staging. |
| OQ-P3-2 | Who are the initial maintainers (council pubkeys)? | Graham | Resolve before M17 ships to prod. Start with 1–3 trusted pubkeys (can include the project key); publish the signed maintainer set; expand later. |
| OQ-P3-3 | Treasury funding source — donations only, or a seed fund? | Graham | Resolve before M19. Default: donations-only pool (per Phase-2 OQ-P2-3) seeded with a small operator float; surface the Lightning donate address on the landing page. |
| OQ-P3-4 | Public-domain source for Jubilees + 2 Baruch? | Graham/Claude | M21 blocked. Path: (a) Graham provides clean text, or (b) Claude hand-verifies a parse of the archive.org Charles editions with per-verse spot-checks. Ship 85/87 until resolved. |
| OQ-P3-5 | Per-merge total + split percentages? Does it vary by book/difficulty? | Graham | Resolve before M19. Default: 500 sats/merge total, split Translator 70% / Reviewers 20% / Submitter 10% (configurable). Revisit tiers post-launch. |
| OQ-P3-9 | Is "Translator" open (anyone drafts) or a trusted/gated role? | Graham | Default: **open** for v1 — anyone drafts; the council gates merge, which is the quality control. Revisit a trusted-translator tier if spam appears. |
| OQ-P3-10 | Reviewers paid per-review or only on merge? Paid for rejections too? | Graham | Resolve before M19. Default: approvers of a **merged** proposal split the 20%; rejected/abandoned proposals pay no one (prevents vote-farming). |
| OQ-P3-6 | Governance model long-term — council vs. open+stake? | Graham | ADR-009 (M17) picks council for v1 with a documented migration path to elected/staked governance in a later phase. |
| OQ-P3-7 | Anti-spam: cost to propose/vote? (none, PoW, tiny sat bond) | Graham | Resolve during M20/M22. Default: relay rate limits + maintainer-gated merges; revisit a proposal bond if spam appears. |
| OQ-P3-8 | Relay hosting — self-host VPS vs. managed? | Graham | M20. Default: a small VPS with Docker + Caddy TLS; community mirrors encouraged. |

---

## Architectural Non-Negotiables

Every PR is reviewed against these:

1. **No custody.** Sats route donor-wallet → translator via NWC/LNURL. No OpenNeo code ever holds user funds; the only wallet is the operator-controlled NWC treasury.
2. **No gatekeeper owns the text.** Maintainer-gated *merges* are quality control for canonical NeoOS only — the text is CC-BY-SA 4.0, every proposal/vote/merge is a public signed event, and anyone may fork with their own maintainer set.
3. **Everything is a signed, content-addressed event.** Identity = pubkey (npub); no accounts, no email. Verses are BLAKE3-addressed; the corpus root is CI-verified.
4. **Verifiable stats only.** Every "X reads / Y merges / Z sats paid" must be derivable from public signed events (use-proofs, proposals, receipts). No private analytics DB, no telemetry, no PII.
5. **Bitcoin-anchored history.** Every merge is OTS-batched and timestamped to Bitcoin; proofs are public and independently verifiable.
6. **No vendor lock.** No Privy/Auth0/Clerk; auth is LNURL-auth + NIP-07. Wallets are injected interfaces (NWC), not a hardcoded provider.
7. **Licensing.** AGPL-3.0 headers in every source file; CC-BY-SA 4.0 for text; BSB attribution preserved; `SOURCES.md` kept current (CI-gated).
8. **Secrets never in git.** NWC URIs, treasury keys, deploy tokens live in env/secret stores only.

---

## CE Feedback Loops

| Loop | Mechanism |
|---|---|
| Breaking changes caught immediately | CI on every PR: `lint → typecheck → test → importer verify → SOURCES check` (`.github/workflows/ci.yml`) |
| Corpus integrity | `pnpm --filter @neoark/importer run verify` is a CI gate — the BLAKE3 root can't drift unnoticed |
| Spec drift caught across packages | Shared fixtures: `@neoark/manifest` fixtures + `MockRelay` are imported by payer/relay/review/payouts — a protocol change breaks all downstream tests together |
| Governance/payout correctness | M17/M19 tests assert "ungoverned merge is never paid" and "idempotent across restarts" — the two attack surfaces stay covered |
| Decision rationale preserved | ADRs written at decision time: ADR-009 (governance), ADR-010 (treasury/payout) join 001–008 |
| Deploy can't silently rot | `scripts/healthcheck.mjs` + auto-deploy on `main`; M20 adds a relay probe; M22 adds monitoring |
| Adoption is verifiable, not claimed | M22 stats view derives every number from public signed events |
| Demo per milestone | Each package ships a `run demo`; new packages (payout-runner) must too, committed before the milestone closes |

---

## What to Do First

1. **Resolve OQ-P3-2 (initial maintainer pubkeys)** — M17 can't ship to prod without it; pick 1–3 trusted pubkeys.
2. **M16 — Translator Profiles** — add the kind:0 `lud16` profile panel to the portal; verify `profilesFromMetadata` resolves it. (No external deps; unblocks payouts.)
3. **M17 — Governance** — write ADR-009, add the maintainer allowlist to `tallyReviews`/`reviewState`/`maybeMerge`, gate the portal Merge button. **Must precede M19.**
4. **M18 — NIP-07 merge** — unify merge on the `Signer` abstraction so extension maintainers can merge.
5. **M20 — Public relay** (parallelizable) — deploy `infra/relay` to `relay.openneo.org`, point clients at it.
6. **Resolve OQ-P3-1 & OQ-P3-3 (wallet + treasury funding)**, then **M19 — Payout Runner** against a staging NWC wallet; promote once a real test merge pays a real test address.
7. **M21 — last 2 books** once OQ-P3-4 has a source; **M22 — launch hardening** (www cert, stats view, monitoring, contributor docs) to close the public launch.

> Commit after every passing test. Do not skip ahead. **M17 before M19, always.**

---

_Update this file when decisions change, specs evolve, or a milestone teaches you something the next one needs to know._
