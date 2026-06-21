import { describe, it, expect } from 'vitest'
import { signManifest } from '../src/manifest'
import { buildUseProof, parseUseProof, verifyUseProof, USE_PROOF_KIND } from '../src/use-proof'
import { keypairFromSeed } from '../src/keys'
import { verifyEventSignature } from '../src/event'
import type { NostrEvent, ValueManifest } from '../src/types'

const translator = keypairFromSeed('01'.repeat(32))
const reader = keypairFromSeed('02'.repeat(32))

const manifest: ValueManifest = signManifest(
  {
    version: 'avm-1',
    translation_id: 'osv-en-2025',
    translation_blake3: 'b3:' + 'a'.repeat(64),
    translator_pubkey: translator.pubkey,
    issued_at: '2025-01-01T00:00:00Z',
    stream_rates: {
      chapter_read: { sats: 10, trigger: '80pct_visible_30s' },
      citation: { sats: 50, trigger: 'copy_or_share_with_attribution' },
    },
    splits: [
      { lightning_address: 'ruiz@strike.me', weight: 70, role: 'translator' },
      { lightning_address: 'dev@neoark.io', weight: 30, role: 'protocol' },
    ],
    fork_policy: { allowed: true, predecessor_blake3: null },
  },
  translator.seckey,
)

function proof(): NostrEvent {
  return buildUseProof(
    {
      manifest,
      passage: { book: 'John', chapter: 3, verseStart: 16, verseEnd: 21 },
      trigger: '80pct_visible_30s',
      preimage: 'a1'.repeat(32),
      amount_sat: 10,
      created_at: 1717545600,
      app: 'neoark-reader/0.3.2',
    },
    reader.seckey,
  )
}

describe('buildUseProof / parseUseProof', () => {
  it('builds a signed kind:30078 event with a payment-anchored hash', () => {
    const e = proof()
    expect(e.kind).toBe(USE_PROOF_KIND)
    expect(e.pubkey).toBe(reader.pubkey)
    expect(verifyEventSignature(e)).toBe(true)
  })

  it('parses tags into a structured proof', () => {
    const p = parseUseProof(proof())
    expect(p.translation_id).toBe('osv-en-2025')
    expect(p.blake3).toBe(manifest.translation_blake3)
    expect(p.passage).toEqual({ book: 'John', chapter: 3, verseStart: 16, verseEnd: 21 })
    expect(p.amount_sat).toBe(10)
    expect(p.app).toBe('neoark-reader/0.3.2')
  })

  it('omits app when not provided', () => {
    const e = buildUseProof(
      {
        manifest,
        passage: { book: 'Psalm', chapter: 23, verseStart: 1, verseEnd: 6 },
        trigger: 'copy_or_share_with_attribution',
        preimage: 'c3'.repeat(32),
        amount_sat: 50,
        created_at: 100,
      },
      reader.seckey,
    )
    expect(parseUseProof(e).app).toBeUndefined()
  })

  it('rejects a non-use-proof event kind', () => {
    expect(() => parseUseProof({ ...proof(), kind: 1 })).toThrow(/Not a use-proof/)
  })

  it('throws when required tags are missing', () => {
    const e = { ...proof(), tags: proof().tags.filter((t) => t[0] !== 'preimage') }
    expect(() => parseUseProof(e)).toThrow(/missing tags: preimage/)
  })

  it('throws on a non-integer amount_sat', () => {
    const e = { ...proof(), tags: proof().tags.map((t) => (t[0] === 'amount_sat' ? ['amount_sat', 'NaN'] : t)) }
    expect(() => parseUseProof(e)).toThrow(/Invalid amount_sat/)
  })
})

describe('verifyUseProof', () => {
  it('accepts a well-formed proof', () => {
    expect(verifyUseProof(proof(), manifest)).toEqual({ valid: true, errors: [] })
  })

  it('rejects a forged amount (sig + rate mismatch)', () => {
    const e = { ...proof(), tags: proof().tags.map((t) => (t[0] === 'amount_sat' ? ['amount_sat', '9999'] : t)) }
    const res = verifyUseProof(e, manifest)
    expect(res.valid).toBe(false)
    expect(res.errors).toContain('amount_sat 9999 != rate 10 for trigger')
  })

  it('rejects a preimage that does not hash to bolt11_hash', () => {
    const e = { ...proof(), tags: proof().tags.map((t) => (t[0] === 'preimage' ? ['preimage', 'ff'.repeat(32)] : t)) }
    const res = verifyUseProof(e, manifest)
    expect(res.valid).toBe(false)
    // signature also breaks because tags changed; the payment-anchor error must be present too
    expect(res.errors).toContain('bolt11_hash does not match sha256(preimage)')
  })

  it('rejects a proof bound to a different translation', () => {
    const other = signManifest({ ...manifest, translation_id: 'web-en-2020', signature: '' }, translator.seckey)
    const res = verifyUseProof(proof(), other)
    expect(res.valid).toBe(false)
    expect(res.errors.some((e) => e.includes('!= manifest'))).toBe(true)
  })

  it('rejects a trigger with no rate in the manifest', () => {
    const e = buildUseProof(
      {
        manifest,
        passage: { book: 'John', chapter: 3, verseStart: 16, verseEnd: 16 },
        trigger: 'user_highlights_verse',
        preimage: 'a1'.repeat(32),
        amount_sat: 5,
        created_at: 1,
      },
      reader.seckey,
    )
    const res = verifyUseProof(e, manifest)
    expect(res.errors).toContain('trigger "user_highlights_verse" has no rate in manifest')
  })

  it('returns a parse error for a malformed event', () => {
    const res = verifyUseProof({ ...proof(), kind: 1 }, manifest)
    expect(res.valid).toBe(false)
    expect(res.errors[0]).toMatch(/Not a use-proof/)
  })
})
