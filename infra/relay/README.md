<!-- SPDX-License-Identifier: AGPL-3.0 -->

# infra/relay — ARK Nostr relay (relay.openneo.org)

A tuned [nostr-rs-relay](https://github.com/scsibug/nostr-rs-relay) for ARK
events. `config.toml` allowlists the ARK kinds (30700–30799) plus the reused
Nostr kinds (0 profile, 1 note, 22242 NIP-42 auth, 30078 use-proof) and sets a
128 KB event cap (comfortably over a chapter of verses).

```bash
docker compose up -d        # relay on :8080, db persisted in a volume
docker compose ps           # healthcheck via NIP-11 relay info
```

Front it with a TLS-terminating proxy for `wss://relay.openneo.org/`
(Cloudflare proxy, or Caddy with automatic HTTPS). See
[`../../docs/DEPLOY.md`](../../docs/DEPLOY.md).

Until this is live, the clients fall back to public relays (`wss://nos.lol`,
`wss://relay.damus.io`, `wss://relay.snort.social`) — the defaults in
`@neoark/relay`.
