/**
 * Local BOLT11 invoice decoding.
 *
 * We decode invoices ourselves and treat the locally-decoded `payment_hash`
 * and `amount` as authoritative — never a value handed back by the LNURL
 * server alongside the invoice. See ADR-004 for the library choice.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { decode } from 'light-bolt11-decoder'
import type { DecodedInvoice } from './types'

interface Section {
  name: string
  value?: unknown
}

function sectionValue(sections: Section[], name: string): unknown {
  return sections.find((s) => s.name === name)?.value
}

/** Decode a BOLT11 invoice to the fields the payer relies on. Throws on invalid input. */
export function decodeBolt11(invoice: string): DecodedInvoice {
  const decoded = decode(invoice) as { sections: Section[] }
  const sections = decoded.sections

  const paymentHash = sectionValue(sections, 'payment_hash')
  if (typeof paymentHash !== 'string' || !/^[0-9a-f]{64}$/i.test(paymentHash)) {
    throw new Error('BOLT11 invoice missing a valid payment_hash')
  }

  // `amount` is millisats as a string; absent for an amountless invoice.
  const amountRaw = sectionValue(sections, 'amount')
  let amountSat: number | null = null
  if (typeof amountRaw === 'string' && amountRaw.length > 0) {
    const msat = Number(amountRaw)
    if (!Number.isFinite(msat) || msat < 0) throw new Error('BOLT11 invoice has an invalid amount')
    amountSat = Math.floor(msat / 1000)
  }

  const description = sectionValue(sections, 'description')
  const descriptionHash = sectionValue(sections, 'description_hash')
  const timestamp = sectionValue(sections, 'timestamp')
  const expiry = sectionValue(sections, 'expiry')

  return {
    paymentHash: paymentHash.toLowerCase(),
    amountSat,
    ...(typeof description === 'string' ? { description } : {}),
    ...(typeof descriptionHash === 'string' ? { descriptionHash: descriptionHash.toLowerCase() } : {}),
    ...(typeof timestamp === 'number' ? { timestamp } : {}),
    ...(typeof expiry === 'number' ? { expirySeconds: expiry } : {}),
  }
}
