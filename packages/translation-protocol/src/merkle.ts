/**
 * SHA-256 Merkle tree with inclusion proofs (OpenTimestamps uses SHA-256).
 *
 * Odd nodes at a level are paired with themselves (Bitcoin/OTS convention).
 * Parent = sha256(left || right) over raw bytes.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { sha256 } from '@noble/hashes/sha2'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'
import type { InclusionProof, MerkleStep } from './types'

function hashPair(a: string, b: string): string {
  return bytesToHex(sha256(new Uint8Array([...hexToBytes(a), ...hexToBytes(b)])))
}

/** Combine one level into the next (odd last node pairs with itself). */
function nextLevel(level: string[]): string[] {
  const next: string[] = []
  for (let i = 0; i < level.length; i += 2) {
    const left = level[i]
    if (left === undefined) break
    const right = level[i + 1] ?? left
    next.push(hashPair(left, right))
  }
  return next
}

/** Merkle root over an ordered list of hex leaf hashes. */
export function merkleRoot(leaves: string[]): string {
  if (leaves.length === 0) throw new Error('merkleRoot: no leaves')
  let level = [...leaves]
  while (level.length > 1) level = nextLevel(level)
  const root = level[0]
  if (root === undefined) throw new Error('merkleRoot: empty tree')
  return root
}

/** Build an inclusion proof for the leaf at `index`. */
export function inclusionProof(leaves: string[], index: number): InclusionProof {
  const leaf = leaves[index]
  if (leaf === undefined) throw new Error('inclusionProof: index out of range')
  const path: MerkleStep[] = []
  let level = [...leaves]
  let idx = index
  while (level.length > 1) {
    const isRight = idx % 2 === 1
    const sibling = level[isRight ? idx - 1 : idx + 1] ?? level[idx]
    if (sibling === undefined) break
    path.push({ hash: sibling, side: isRight ? 'left' : 'right' })
    level = nextLevel(level)
    idx = Math.floor(idx / 2)
  }
  return { leaf, path, merkleRoot: merkleRoot(leaves) }
}

/** Verify a leaf is included under `root` via the given path. */
export function verifyInclusion(proof: InclusionProof, root: string): boolean {
  let acc = proof.leaf
  for (const step of proof.path) {
    acc = step.side === 'left' ? hashPair(step.hash, acc) : hashPair(acc, step.hash)
  }
  return acc === proof.merkleRoot && proof.merkleRoot === root
}
