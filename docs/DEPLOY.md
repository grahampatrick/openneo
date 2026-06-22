<!-- SPDX-License-Identifier: AGPL-3.0 -->

# Deploying OpenNeo (M15)

Everything here is **prepared and verified** — the only things left are the parts
that need your accounts/DNS. Nothing in this repo touches a live account until you
add the secrets below.

## What ships

| Surface | Source | URL |
|---|---|---|
| Landing | `apps/landing` (static HTML) | `openneo.org` (`/`) |
| Reader PWA | `apps/reader` (SvelteKit static, full 83-book corpus bundled) | `openneo.org/read` |
| Translator portal | `apps/translator` (SvelteKit static) | `openneo.org/translate` |
| ARK relay | `infra/relay` (nostr-rs-relay, Docker) | `relay.openneo.org` |

## 1. Build the static site

```bash
pnpm run build:site     # builds all three apps → ./site
node scripts/healthcheck.mjs http://localhost:4180   # after serving ./site
```

`scripts/build-site.mjs` assembles `apps/landing/dist` → `/`,
`apps/reader/build` → `/read`, `apps/translator/build` → `/translate`, plus a
`/health.json` probe. (Verified: all four endpoints return 200.)

## 2. Deploy the site (Vercel — recommended)

`vercel.json` at the repo root makes this turnkey (build → `pnpm run build:site`,
output → `site/`, static; no server adapter needed):

1. **Import the repo** at vercel.com → New Project → import `grahampatrick/openneo`.
   Vercel reads `vercel.json` — leave the build/output settings as detected.
2. **Deploy.** First build runs the three app builds + assembles `./site`
   (~30–60 s). The 24 MB reader corpus ships as a static asset (cached immutable
   via the header rule).
3. **Add your domain:** Project → Settings → Domains → add `openneo.org`
   (and `www`). Vercel gives you the DNS records (an `A`/`ALIAS` or `CNAME`);
   set them at your registrar. TLS is automatic.
4. **Verify:** `node scripts/healthcheck.mjs https://openneo.org` → `/`, `/read/`,
   `/translate/`, `/health.json` all 200.

That's it — landing at `openneo.org`, reader at `/read`, translator at `/translate`.

> CLI alternative: `npm i -g vercel && vercel --prod` from the repo root.

## 2b. Deploy the site (Cloudflare Pages)

A gated workflow is ready at `.github/workflows/deploy.yml`. It **no-ops until**
you set two repo secrets, so it's safe already:

1. Create a Cloudflare Pages project named **`openneo`**.
2. Add repo secrets **`CLOUDFLARE_API_TOKEN`** and **`CLOUDFLARE_ACCOUNT_ID`**.
3. Push to `main` (or run the *Deploy* workflow manually). It builds `./site` and
   runs `wrangler pages deploy`, then the health check.

> **Vercel / Netlify alternative:** point the project at `pnpm run build:site`
> with output dir `site`. No SvelteKit server adapter is needed — everything is
> static (`adapter-static`, relative paths), so any static host works.

### DNS + TLS
- `openneo.org` (and `www`) → the Pages project (Cloudflare manages TLS).
- `relay.openneo.org` → the relay host (step 3), TLS via Cloudflare or Caddy.

### Subdomain option
If you prefer `read.openneo.org` / `translate.openneo.org` over subpaths, deploy
each app's `build/` to its own Pages project — relative paths mean no rebuild is
needed.

## 3. Run the relay

```bash
cd infra/relay
docker compose up -d            # nostr-rs-relay on :8080, ARK kind allowlist
```

Put a TLS proxy in front for `wss://relay.openneo.org/` (Cloudflare proxy, or
Caddy with automatic HTTPS). The relay's allowlist (`config.toml`) accepts the
ARK kinds (30700–30799) plus reused Nostr kinds (0, 1, 22242, 30078). Compose
has a NIP-11 healthcheck. Until it's up, the apps can use public relays
(`wss://nos.lol`, `wss://relay.damus.io`) — already the defaults in `@neoark/relay`.

## 4. Verify

```bash
node scripts/healthcheck.mjs https://openneo.org
```
Checks `/health.json`, `/`, `/read/`, `/translate/` all return 200.

## Open items (need you)

| Item | Why |
|---|---|
| Cloudflare/Vercel account + `openneo` project | hosting |
| `openneo.org` domain + DNS records | the URLs |
| A host for the relay (any VPS with Docker) | `relay.openneo.org` |
| Repo secrets `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` | un-gate the deploy workflow |
