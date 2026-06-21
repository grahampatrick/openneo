/**
 * @neoark/manifest — parse, sign, and verify ARK value manifests (AVM-1) and
 * use-proofs (UP-1). The trust anchor for payments and use-proofs.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
export type {
  ValueManifest,
  StreamRate,
  Split,
  ForkPolicy,
  Trigger,
  NostrEvent,
  UseProof,
  VerifyResult,
} from './types'
export { TRIGGERS } from './types'

export {
  parseManifest,
  signManifest,
  verifyManifest,
  semanticErrors,
  rateForTrigger,
  ManifestParseError,
} from './manifest'

export { parseUseProof, verifyUseProof, buildUseProof, USE_PROOF_KIND } from './use-proof'
export type { BuildUseProofInput } from './use-proof'

export { computeEventId, signEvent, verifyEventSignature } from './event'
export type { UnsignedEvent } from './event'

export {
  getPublicKey,
  normalizePubkey,
  normalizeSeckey,
  decodeBech32Key,
  keypairFromSeed,
} from './keys'

export { canonicalJson } from './canonical'
