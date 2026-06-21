import { describe, it, expect } from 'vitest'
import { decodeBolt11 } from '../src/bolt11'

// BOLT11 spec vector: 2500u ("$3 cup of coffee"), known payment hash.
const SPEC_2500U =
  'lnbc2500u1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdq5xysxxatsyp3k7enxv4jsxqzpuaztrnwngzn3kdzw5hydlzf03qdgm2hdq27cqv3agm2awhz5se903vruatfhq77w3ls4evs3ch9zw97j25emudupq63nyw24cg27h2rspfj9srp'

describe('decodeBolt11', () => {
  it('extracts the payment hash, amount, and description', () => {
    const d = decodeBolt11(SPEC_2500U)
    expect(d.paymentHash).toBe('0001020304050607080900010203040506070809000102030405060708090102')
    expect(d.amountSat).toBe(250000) // 2500u BTC = 250,000 sat
    expect(d.description).toBe('1 cup coffee')
    expect(typeof d.timestamp).toBe('number')
  })

  it('throws on a malformed invoice', () => {
    expect(() => decodeBolt11('not-an-invoice')).toThrow()
  })
})
