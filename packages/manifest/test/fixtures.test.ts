import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseManifest, verifyManifest } from '../src/manifest'
import { verifyUseProof } from '../src/use-proof'
import type { NostrEvent, ValueManifest } from '../src/types'

const FIX = resolve(__dirname, '..', 'fixtures')

const manifest = JSON.parse(
  readFileSync(resolve(FIX, 'osv-en-2025.manifest.json'), 'utf8'),
) as ValueManifest
const proofs = JSON.parse(readFileSync(resolve(FIX, 'use-proofs.json'), 'utf8')) as NostrEvent[]

describe('fixtures', () => {
  it('OSV-EN-2025 manifest parses and verifies', () => {
    expect(parseManifest(manifest).translation_id).toBe('osv-en-2025')
    expect(verifyManifest(manifest)).toEqual({ valid: true, errors: [] })
  })

  it('ships three use-proofs that all verify against the manifest', () => {
    expect(proofs).toHaveLength(3)
    for (const p of proofs) {
      expect(verifyUseProof(p, manifest)).toEqual({ valid: true, errors: [] })
    }
  })
})
