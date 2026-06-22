/**
 * Portal governance — read the council (maintainer allowlist) for the
 * translation and let a maintainer (or the founder, bootstrapping) publish/amend
 * it. The council gates which votes count toward a merge (anti-Sybil).
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import {
  KIND_GOVERNANCE,
  buildGovernanceEvent,
  resolveGovernance,
  type Governance,
} from '@neoark/translation-protocol'
import type { RelayPool } from '@neoark/relay'
import type { Signer } from './signer'

/** Fetch the authoritative council for a translation, or null if ungoverned. */
export async function fetchGovernance(
  pool: RelayPool,
  translationId: string,
  foundingPubkey?: string,
): Promise<Governance | null> {
  const events = await pool.query({ kinds: [KIND_GOVERNANCE], limit: 50 })
  return resolveGovernance(events, translationId, foundingPubkey ? { foundingPubkey } : {})
}

/** Publish (or amend) the council. Signer must be a current maintainer or the founder. */
export async function publishGovernance(
  pool: RelayPool,
  signer: Signer,
  translationId: string,
  maintainers: string[],
  createdAt: number,
): Promise<{ relaysAccepted: number }> {
  const event = await signer.signEvent(buildGovernanceEvent({ translationId, maintainers, createdAt }))
  const acks = await pool.publish(event)
  return { relaysAccepted: acks.filter((a) => a.ok).length }
}
