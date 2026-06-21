import { describe, it, expect } from 'vitest'
import { resolveLnurlPay, lnAddressToUrl } from '../src/lnurl'
import { LnurlError } from '../src/errors'
import type { JsonFetch } from '../src/types'

const SPEC_2500U =
  'lnbc2500u1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdq5xysxxatsyp3k7enxv4jsxqzpuaztrnwngzn3kdzw5hydlzf03qdgm2hdq27cqv3agm2awhz5se903vruatfhq77w3ls4evs3ch9zw97j25emudupq63nyw24cg27h2rspfj9srp'
// 20m BTC invoice carrying a description_hash (BOLT11 'h' tag).
const SPEC_HASH =
  'lnbc20m1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqhp58yjmdan79s6qqdhdzgynm4zwqd5d7xmw5fk98klysy043l2ahrqscc6gd6ql3jrc5yzme8v4ntcewwz5cnw92tz0pc8qcuufvq7khhr8wpald05e92xw006sq94mg8v2ndf4sefvf9sygkshp5zfem29trqq2yxxz7'

/** Build a fetchJson that serves metadata then an invoice. */
function stubFetch(meta: Record<string, unknown>, pr: string): JsonFetch {
  return (url: string) =>
    Promise.resolve(url.includes('/.well-known/lnurlp/') ? meta : { pr })
}

const baseMeta = {
  tag: 'payRequest',
  callback: 'https://x.io/cb',
  minSendable: 1000,
  maxSendable: 10_000_000_000,
  metadata: '[["text/plain","coffee"]]',
}

describe('lnAddressToUrl', () => {
  it('maps name@domain to the well-known URL', () => {
    expect(lnAddressToUrl('ruiz@strike.me')).toBe('https://strike.me/.well-known/lnurlp/ruiz')
  })
  it('rejects a malformed address', () => {
    expect(() => lnAddressToUrl('nope')).toThrow(LnurlError)
  })
})

describe('resolveLnurlPay', () => {
  it('returns a validated invoice when the amount matches', async () => {
    const r = await resolveLnurlPay('ruiz@strike.me', 250000, {
      fetchJson: stubFetch(baseMeta, SPEC_2500U),
    })
    expect(r.invoice).toBe(SPEC_2500U)
    expect(r.decoded.paymentHash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('rejects when the invoice amount differs from the request', async () => {
    await expect(
      resolveLnurlPay('ruiz@strike.me', 250001, { fetchJson: stubFetch(baseMeta, SPEC_2500U) }),
    ).rejects.toThrow(/invoice amount .* != requested/)
  })

  it('rejects an amount outside min/maxSendable', async () => {
    await expect(
      resolveLnurlPay('ruiz@strike.me', 250000, {
        fetchJson: stubFetch({ ...baseMeta, maxSendable: 1000 }, SPEC_2500U),
      }),
    ).rejects.toThrow(/outside/)
  })

  it('rejects a non-payRequest metadata tag', async () => {
    await expect(
      resolveLnurlPay('ruiz@strike.me', 250000, {
        fetchJson: stubFetch({ ...baseMeta, tag: 'withdrawRequest' }, SPEC_2500U),
      }),
    ).rejects.toThrow(/payRequest/)
  })

  it('rejects when description_hash does not match the metadata', async () => {
    await expect(
      resolveLnurlPay('ruiz@strike.me', 2_000_000, {
        fetchJson: stubFetch({ ...baseMeta, metadata: 'wrong-metadata' }, SPEC_HASH),
      }),
    ).rejects.toThrow(/description_hash/)
  })

  it('throws when the callback returns no invoice', async () => {
    const fetchJson: JsonFetch = (url) =>
      Promise.resolve(url.includes('lnurlp') ? baseMeta : {})
    await expect(
      resolveLnurlPay('ruiz@strike.me', 250000, { fetchJson }),
    ).rejects.toThrow(/did not return an invoice/)
  })
})
