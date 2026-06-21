/**
 * computeSplits — pure, no I/O. Divides a charge among a manifest's recipients
 * by weight. Whole sats use floor division; the sub-sat remainder is returned
 * as millisats per recipient so the caller (ArkPayer) can accumulate dust
 * across many charges and flush it once it reaches a whole sat.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import type { ValueManifest } from '@neoark/manifest'
import type { SplitShare } from './types'

/**
 * Split `totalSats` across `manifest.splits` by weight.
 *
 * For each recipient the exact share is `totalSats * weight / 100`. We pay
 * `floor(share)` sats now and report the leftover `(totalSats*weight % 100)`
 * hundredths-of-a-sat as `dustMsat = leftover * 10` (1 sat = 1000 msat, /100).
 * Weights are validated to sum to 100 by `parseManifest`, so no sats are lost.
 */
export function computeSplits(manifest: ValueManifest, totalSats: number): SplitShare[] {
  if (!Number.isInteger(totalSats) || totalSats < 0) {
    throw new Error(`totalSats must be a non-negative integer, got ${String(totalSats)}`)
  }
  return manifest.splits.map((s) => {
    const scaled = totalSats * s.weight // hundredths of a sat
    const sats = Math.floor(scaled / 100)
    const dustMsat = (scaled % 100) * 10
    return {
      lightningAddress: s.lightning_address,
      role: s.role,
      weight: s.weight,
      sats,
      dustMsat,
    }
  })
}
