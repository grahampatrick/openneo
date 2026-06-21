import { describe, it, expect } from 'vitest'
import {
  signManifest,
  verifyManifest,
  parseManifest,
  semanticErrors,
  rateForTrigger,
  ManifestParseError,
} from '../src/manifest'
import { keypairFromSeed } from '../src/keys'
import type { ValueManifest } from '../src/types'

const kp = keypairFromSeed('01'.repeat(32))

function baseManifest(): Omit<ValueManifest, 'signature'> {
  return {
    version: 'avm-1',
    translation_id: 'osv-en-2025',
    translation_blake3: 'b3:' + 'a'.repeat(64),
    translator_pubkey: kp.pubkey,
    issued_at: '2025-01-01T00:00:00Z',
    stream_rates: {
      chapter_read: { sats: 10, trigger: '80pct_visible_30s' },
      citation: { sats: 50, trigger: 'copy_or_share_with_attribution' },
    },
    splits: [
      { lightning_address: 'ruiz@strike.me', weight: 70, role: 'translator' },
      { lightning_address: 'review@gtu.edu', weight: 30, role: 'scholarly_review' },
    ],
    fork_policy: { allowed: true, min_translator_weight: 50, predecessor_blake3: null },
  }
}

describe('signManifest / verifyManifest', () => {
  it('signs and verifies a valid manifest', () => {
    const m = signManifest(baseManifest(), kp.seckey)
    expect(m.signature).toMatch(/^[0-9a-f]{128}$/)
    expect(verifyManifest(m)).toEqual({ valid: true, errors: [] })
  })

  it('sets translator_pubkey from the signing key', () => {
    const m = signManifest({ ...baseManifest(), translator_pubkey: 'f'.repeat(64) }, kp.seckey)
    expect(m.translator_pubkey).toBe(kp.pubkey)
    expect(verifyManifest(m).valid).toBe(true)
  })

  it('signature is deterministic', () => {
    expect(signManifest(baseManifest(), kp.seckey).signature).toBe(
      signManifest(baseManifest(), kp.seckey).signature,
    )
  })

  it('verification survives object-key reordering (canonical JSON)', () => {
    const m = signManifest(baseManifest(), kp.seckey)
    const reordered = JSON.parse(
      JSON.stringify({
        signature: m.signature,
        splits: m.splits,
        version: m.version,
        fork_policy: m.fork_policy,
        translator_pubkey: m.translator_pubkey,
        stream_rates: m.stream_rates,
        issued_at: m.issued_at,
        translation_blake3: m.translation_blake3,
        translation_id: m.translation_id,
      }),
    ) as ValueManifest
    expect(verifyManifest(reordered).valid).toBe(true)
  })

  it('detects a tampered split address', () => {
    const m = signManifest(baseManifest(), kp.seckey)
    const bad = { ...m, splits: [{ ...m.splits[0]!, lightning_address: 'evil@x.io' }, m.splits[1]!] }
    const res = verifyManifest(bad)
    expect(res.valid).toBe(false)
    expect(res.errors).toContain('BIP-340 signature does not verify against translator_pubkey')
  })

  it('detects a swapped signature from another key', () => {
    const other = keypairFromSeed('09'.repeat(32))
    const m = signManifest(baseManifest(), kp.seckey)
    const otherSig = signManifest(baseManifest(), other.seckey).signature
    expect(verifyManifest({ ...m, signature: otherSig }).valid).toBe(false)
  })
})

describe('parseManifest', () => {
  it('returns a typed manifest for valid input', () => {
    const m = signManifest(baseManifest(), kp.seckey)
    expect(parseManifest(JSON.parse(JSON.stringify(m))).translation_id).toBe('osv-en-2025')
  })

  it('throws ManifestParseError on schema violation', () => {
    const m = signManifest(baseManifest(), kp.seckey)
    const { version: _v, ...broken } = m
    expect(() => parseManifest(broken)).toThrow(ManifestParseError)
  })

  it('throws on a bad translation_id pattern', () => {
    const m = signManifest({ ...baseManifest(), translation_id: 'NOT VALID' }, kp.seckey)
    expect(() => parseManifest(m)).toThrow(ManifestParseError)
  })

  it('throws when split weights do not sum to 100', () => {
    const m = signManifest(
      { ...baseManifest(), splits: [{ lightning_address: 'a@b.co', weight: 50, role: 'translator' }] },
      kp.seckey,
    )
    expect(() => parseManifest(m)).toThrow(/sum to 50/)
  })
})

describe('semanticErrors', () => {
  it('flags an unknown trigger', () => {
    const m = { ...baseManifest(), signature: '' } as ValueManifest
    m.stream_rates = { weird: { sats: 1, trigger: 'made_up' as never } }
    expect(semanticErrors(m).some((e) => e.includes('not a known AVM-1 trigger'))).toBe(true)
  })

  it('passes a clean manifest', () => {
    expect(semanticErrors({ ...baseManifest(), signature: '' })).toEqual([])
  })
})

describe('rateForTrigger', () => {
  it('returns sats for a present trigger and undefined otherwise', () => {
    const m = { ...baseManifest(), signature: '' } as ValueManifest
    expect(rateForTrigger(m, '80pct_visible_30s')).toBe(10)
    expect(rateForTrigger(m, 'user_highlights_verse')).toBeUndefined()
  })
})
