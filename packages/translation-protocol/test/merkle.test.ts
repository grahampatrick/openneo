import { describe, it, expect } from 'vitest'
import { merkleRoot, inclusionProof, verifyInclusion } from '../src/merkle'

const h = (n: number): string => n.toString(16).padStart(64, '0')

describe('merkle', () => {
  it('root of a single leaf is the leaf', () => {
    expect(merkleRoot([h(1)])).toBe(h(1))
  })

  it('is deterministic and order-sensitive', () => {
    expect(merkleRoot([h(1), h(2), h(3)])).toBe(merkleRoot([h(1), h(2), h(3)]))
    expect(merkleRoot([h(1), h(2)])).not.toBe(merkleRoot([h(2), h(1)]))
  })

  it('throws on empty input', () => {
    expect(() => merkleRoot([])).toThrow(/no leaves/)
  })

  it('produces verifiable inclusion proofs for every leaf (odd count)', () => {
    const leaves = [h(1), h(2), h(3), h(4), h(5)]
    const root = merkleRoot(leaves)
    for (let i = 0; i < leaves.length; i++) {
      const proof = inclusionProof(leaves, i)
      expect(proof.merkleRoot).toBe(root)
      expect(verifyInclusion(proof, root)).toBe(true)
    }
  })

  it('rejects a tampered proof', () => {
    const leaves = [h(1), h(2), h(3), h(4)]
    const root = merkleRoot(leaves)
    const proof = inclusionProof(leaves, 1)
    expect(verifyInclusion({ ...proof, leaf: h(99) }, root)).toBe(false)
    expect(verifyInclusion(proof, h(123))).toBe(false)
  })

  it('throws for an out-of-range index', () => {
    expect(() => inclusionProof([h(1), h(2)], 5)).toThrow(/out of range/)
  })
})
