/**
 * CDN bundle entry — exposes only NeoArkCite (no crypto), so cite.min.js stays
 * under the 5KB budget. Signing is delegated to window.nostr or an injected
 * signer. Built to `dist/cite.min.js` via `pnpm --filter @neoark/cite bundle`.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
export { NeoArkCite, parseRef } from './cite'
