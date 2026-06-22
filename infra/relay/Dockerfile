# NeoArk / OpenNeo Nostr relay — relay.openneo.org
# Wraps nostr-rs-relay (MIT) with an ARK-tuned config: the kind allowlist for
# ARK events (30700–30799) plus the kinds the protocol reuses (0, 1, 22242).
# SPDX-License-Identifier: AGPL-3.0
FROM scsibug/nostr-rs-relay:latest

# Config is mounted/baked from config.toml; data persists in /usr/src/app/db.
COPY config.toml /usr/src/app/config.toml
ENV RUST_LOG=info
EXPOSE 8080
VOLUME ["/usr/src/app/db"]
