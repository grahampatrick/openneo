import { describe, it, expect } from 'vitest'
import { anchorBatch, inclusionProofFor, verifyAnchor, MockCalendar } from '../src/anchor'

const ids = Array.from({ length: 5 }, (_, i) => (i + 1).toString(16).padStart(64, '0'))

describe('anchorBatch / verifyAnchor', () => {
  it('anchors a batch and verifies inclusion under a pending attestation', async () => {
    const cal = new MockCalendar()
    const anchor = await anchorBatch(ids, cal)
    expect(anchor.attestation.type).toBe('pending')
    expect(anchor.leaves).toHaveLength(5)
    for (const id of ids) {
      expect(await verifyAnchor(id, anchor, cal)).toEqual({ included: true, attested: true, ok: true })
    }
  })

  it('upgrades to a Bitcoin attestation and still verifies', async () => {
    const cal = new MockCalendar()
    const anchor = await anchorBatch(ids, cal)
    const bitcoin = cal.confirm(anchor.merkleRoot, 840000, 'ab'.repeat(32))
    const res = await verifyAnchor(ids[0]!, { ...anchor, attestation: bitcoin }, cal)
    expect(res.ok).toBe(true)
  })

  it('reports not-included for an event outside the batch', async () => {
    const cal = new MockCalendar()
    const anchor = await anchorBatch(ids, cal)
    const res = await verifyAnchor('f'.repeat(64), anchor, cal)
    expect(res.included).toBe(false)
    expect(res.ok).toBe(false)
  })

  it('fails attestation when the calendar never saw the root', async () => {
    const cal = new MockCalendar()
    const anchor = await anchorBatch(ids, cal)
    const otherCal = new MockCalendar()
    const res = await verifyAnchor(ids[0]!, anchor, otherCal)
    expect(res.attested).toBe(false)
    expect(res.ok).toBe(false)
  })

  it('inclusionProofFor throws for a missing event', async () => {
    const cal = new MockCalendar()
    const anchor = await anchorBatch(ids, cal)
    expect(() => inclusionProofFor(anchor, 'f'.repeat(64))).toThrow(/not in this batch/)
  })

  it('anchorBatch rejects an empty batch', async () => {
    await expect(anchorBatch([], new MockCalendar())).rejects.toThrow(/nothing to anchor/)
  })
})
