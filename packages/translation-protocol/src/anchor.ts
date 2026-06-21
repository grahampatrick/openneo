/**
 * Bitcoin anchoring via OpenTimestamps-style batching.
 *
 * Per ADR-005, merged events are batched: many merge event ids form the leaves
 * of one SHA-256 Merkle tree, and only the single root is timestamped to
 * Bitcoin (one transaction covers thousands of changes). The calendar / Bitcoin
 * attestation layer is injected (`CalendarClient`) so this is deterministic and
 * offline in tests; production wires it to a real OTS calendar.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { merkleRoot, inclusionProof, verifyInclusion } from './merkle'
import type { Attestation, BatchAnchor, CalendarClient, InclusionProof } from './types'

/** Anchor a batch of merged event ids: build the Merkle root and timestamp it. */
export async function anchorBatch(
  eventIds: string[],
  calendar: CalendarClient,
): Promise<BatchAnchor> {
  if (eventIds.length === 0) throw new Error('anchorBatch: nothing to anchor')
  const leaves = [...eventIds]
  const root = merkleRoot(leaves)
  const attestation = await calendar.submit(root)
  return { algo: 'sha256', merkleRoot: root, leaves, attestation }
}

/** Compact inclusion proof for one event id within a batch anchor. */
export function inclusionProofFor(anchor: BatchAnchor, eventId: string): InclusionProof {
  const index = anchor.leaves.indexOf(eventId)
  if (index === -1) throw new Error(`Event ${eventId} is not in this batch`)
  return inclusionProof(anchor.leaves, index)
}

export interface AnchorVerification {
  included: boolean
  attested: boolean
  ok: boolean
}

/**
 * Verify that `eventId` is anchored: it is a leaf, the Merkle root reconstructs,
 * and the calendar confirms the attestation over that root.
 */
export async function verifyAnchor(
  eventId: string,
  anchor: BatchAnchor,
  calendar: CalendarClient,
): Promise<AnchorVerification> {
  let included = false
  if (anchor.leaves.includes(eventId)) {
    const proof = inclusionProofFor(anchor, eventId)
    included = verifyInclusion(proof, anchor.merkleRoot)
  }
  const attested = await calendar.verify(anchor.merkleRoot, anchor.attestation)
  return { included, attested, ok: included && attested }
}

/**
 * A simple in-memory calendar for demos/tests. `submit` returns a pending
 * attestation; `confirm` upgrades a root to a Bitcoin attestation; `verify`
 * accepts a pending attestation it issued or any matching Bitcoin attestation.
 */
export class MockCalendar implements CalendarClient {
  readonly url: string
  private pending = new Map<string, Attestation>()
  private confirmed = new Map<string, Attestation>()
  constructor(url = 'https://calendar.test') {
    this.url = url
  }
  submit(rootHex: string): Promise<Attestation> {
    const att: Attestation = { type: 'pending', calendar: this.url, submittedRoot: rootHex }
    this.pending.set(rootHex, att)
    return Promise.resolve(att)
  }
  /** Simulate Bitcoin confirmation ~1 hour later. */
  confirm(rootHex: string, blockHeight: number, blockHash: string): Attestation {
    const att: Attestation = { type: 'bitcoin', blockHeight, blockHash, merkleRoot: rootHex }
    this.confirmed.set(rootHex, att)
    return att
  }
  verify(rootHex: string, attestation: Attestation): Promise<boolean> {
    if (attestation.type === 'bitcoin') {
      return Promise.resolve(attestation.merkleRoot === rootHex && this.confirmed.has(rootHex))
    }
    const known = this.pending.get(rootHex)
    return Promise.resolve(known !== undefined && attestation.submittedRoot === rootHex)
  }
}
