/**
 * Parse, sign, and verify AVM-1 value manifests.
 *
 * Signing model: BIP-340 Schnorr over sha256 of the canonical JSON of the
 * manifest with the `signature` field removed, keyed by `translator_pubkey`.
 * Canonical JSON (sorted keys) makes the signed bytes independent of property
 * order, so a manifest survives a round-trip through any JSON tool.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { schnorr } from '@noble/curves/secp256k1'
import { sha256 } from '@noble/hashes/sha2'
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils'
import { canonicalJson } from './canonical'
import { validateManifestSchema, schemaErrors } from './schema'
import { getPublicKey, normalizePubkey, normalizeSeckey } from './keys'
import { TRIGGERS } from './types'
import type { ValueManifest, VerifyResult } from './types'

const ZERO_AUX = new Uint8Array(32)

export class ManifestParseError extends Error {
  readonly errors: string[]
  constructor(errors: string[]) {
    super(`Invalid value manifest:\n  ${errors.join('\n  ')}`)
    this.name = 'ManifestParseError'
    this.errors = errors
  }
}

/** sha256 digest (bytes) of the manifest's canonical form, sans signature. */
function signingDigest(manifest: ValueManifest): Uint8Array {
  const { signature: _omit, ...rest } = manifest
  return sha256(utf8ToBytes(canonicalJson(rest)))
}

/**
 * Semantic checks beyond JSON-schema shape: split weights sum to 100 and every
 * stream-rate trigger is one of the normative AVM-1 triggers.
 */
export function semanticErrors(manifest: ValueManifest): string[] {
  const errors: string[] = []
  const sum = manifest.splits.reduce((acc, s) => acc + s.weight, 0)
  if (sum !== 100) errors.push(`splits weights sum to ${String(sum)}, must equal 100`)

  for (const [name, rate] of Object.entries(manifest.stream_rates)) {
    if (!(TRIGGERS as readonly string[]).includes(rate.trigger)) {
      errors.push(`stream_rates.${name}.trigger "${rate.trigger}" is not a known AVM-1 trigger`)
    }
  }
  return errors
}

/** Validate JSON against the schema + semantics, returning a typed manifest. */
export function parseManifest(json: unknown): ValueManifest {
  if (!validateManifestSchema(json)) {
    throw new ManifestParseError(schemaErrors())
  }
  const manifest = json as unknown as ValueManifest
  const sem = semanticErrors(manifest)
  if (sem.length > 0) throw new ManifestParseError(sem)
  return manifest
}

/**
 * Sign a manifest (any `signature` already present is ignored/replaced). The
 * returned manifest's `translator_pubkey` is set to the key's public key so the
 * signature is self-consistent.
 */
export function signManifest(
  manifest: Omit<ValueManifest, 'signature'> & { signature?: string },
  privKey: string,
): ValueManifest {
  const seckeyHex = normalizeSeckey(privKey)
  const withKey: ValueManifest = {
    ...manifest,
    translator_pubkey: getPublicKey(seckeyHex),
    signature: '',
  }
  const digest = signingDigest(withKey)
  const sig = bytesToHex(schnorr.sign(digest, hexToBytes(seckeyHex), ZERO_AUX))
  return { ...withKey, signature: sig }
}

/**
 * Verify a manifest: schema shape, semantic rules, and the BIP-340 signature
 * against `translator_pubkey`. Returns a boolean plus error detail.
 */
export function verifyManifest(manifest: unknown): VerifyResult {
  const errors: string[] = []
  if (!validateManifestSchema(manifest)) {
    return { valid: false, errors: schemaErrors() }
  }
  const m = manifest as unknown as ValueManifest
  errors.push(...semanticErrors(m))

  let sigOk = false
  try {
    const pubHex = normalizePubkey(m.translator_pubkey)
    sigOk = schnorr.verify(hexToBytes(m.signature), signingDigest(m), hexToBytes(pubHex))
  } catch (e) {
    errors.push(`signature check error: ${e instanceof Error ? e.message : String(e)}`)
  }
  if (!sigOk) errors.push('BIP-340 signature does not verify against translator_pubkey')

  return { valid: errors.length === 0, errors }
}

/** Sats configured for a given trigger, or undefined if the trigger is absent. */
export function rateForTrigger(manifest: ValueManifest, trigger: string): number | undefined {
  for (const rate of Object.values(manifest.stream_rates)) {
    if (rate.trigger === trigger) return rate.sats
  }
  return undefined
}
