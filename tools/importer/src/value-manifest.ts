/**
 * Build the AVM-1 value manifest embedded in the translation manifest, using
 * the shared @neoark/manifest crypto core so there is a single BIP-340 signing
 * implementation across the monorepo.
 *
 * See spec/value-manifest.md and spec/value-manifest.schema.json.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { signManifest, verifyManifest } from '@neoark/manifest'
import type { ValueManifest } from '@neoark/manifest'
import { CREATED_AT, TRANSLATION_ID } from './config'
import type { NeoosKey } from './keys'

export type { ValueManifest }

const ISO_ISSUED = new Date(CREATED_AT * 1000).toISOString()

/** Build a signed AVM-1 value manifest for the given corpus root hash. */
export function buildValueManifest(root: string, key: NeoosKey): ValueManifest {
  const base: Omit<ValueManifest, 'signature'> = {
    version: 'avm-1',
    translation_id: TRANSLATION_ID,
    translation_blake3: `b3:${root}`,
    translator_pubkey: key.pubkey,
    issued_at: ISO_ISSUED,
    stream_rates: {
      chapter_read: { sats: 10, trigger: '80pct_visible_30s' },
      highlight: { sats: 5, trigger: 'user_highlights_verse' },
      citation: { sats: 50, trigger: 'copy_or_share_with_attribution' },
      use_proof: { sats: 100, trigger: 'user_publishes_signed_use' },
    },
    splits: [
      { lightning_address: 'translators@neoark.org', weight: 70, role: 'translator' },
      { lightning_address: 'review@neoark.org', weight: 15, role: 'scholarly_review' },
      { lightning_address: 'relay@neoark.org', weight: 10, role: 'relay' },
      { lightning_address: 'dev@neoark.org', weight: 5, role: 'protocol' },
    ],
    fork_policy: {
      allowed: true,
      min_translator_weight: 50,
      must_preserve_roles: ['translator'],
      predecessor_blake3: null,
    },
  }
  return signManifest(base, key.secHex)
}

/** Verify a value manifest's embedded signature (and shape/semantics). */
export function verifyValueManifest(vm: ValueManifest): boolean {
  return verifyManifest(vm).valid
}
