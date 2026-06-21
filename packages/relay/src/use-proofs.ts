/**
 * Publish and query use-proofs over a relay pool.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { buildUseProof, parseUseProof } from '@neoark/manifest'
import type { BuildUseProofInput, NostrEvent, UseProof } from '@neoark/manifest'
import { buildUseProofFilter, matchesQuery } from './filter'
import type { PublishAck, UseProofQuery } from './types'
import type { RelayPool } from './pool'

export interface PublishedUseProof {
  event: NostrEvent
  acks: PublishAck[]
}

/**
 * Build, sign, and publish a use-proof (kind:30078) to the pool. The reader's
 * key signs it; the event is anchored to a real Lightning preimage by
 * `buildUseProof`.
 */
export async function publishUseProof(
  input: BuildUseProofInput,
  readerPrivKey: string,
  pool: RelayPool,
): Promise<PublishedUseProof> {
  const event = buildUseProof(input, readerPrivKey)
  const acks = await pool.publish(event)
  return { event, acks }
}

/**
 * Query use-proofs matching `query`. Filters at the relay by kind + time window,
 * then narrows client-side by translation + passage, dropping any event that is
 * not a valid use-proof.
 */
export async function queryUseProofs(query: UseProofQuery, pool: RelayPool): Promise<UseProof[]> {
  const events = await pool.query(buildUseProofFilter(query))
  const out: UseProof[] = []
  const seen = new Set<string>()
  for (const event of events) {
    let proof: UseProof
    try {
      proof = parseUseProof(event)
    } catch {
      continue // not a well-formed use-proof
    }
    if (!matchesQuery(proof, query)) continue
    if (seen.has(event.id)) continue
    seen.add(event.id)
    out.push(proof)
  }
  return out
}
