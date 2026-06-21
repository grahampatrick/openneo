/**
 * @neoark/cite — tiny embeddable SDK that auto-publishes kind:30710 use-proofs
 * when NeoOS verses (marked with `data-neoos-ref`) are rendered.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
export { NeoArkCite, parseRef } from './cite'
export { ephemeralSigner } from './ephemeral'
export { publishToRelay, publishToRelays } from './relay-publish'
export { KIND_USE_PROOF } from './types'
export type {
  CiteOptions,
  Signer,
  SignedEvent,
  UnsignedEvent,
  SocketLike,
  SocketFactory,
} from './types'
