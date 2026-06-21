/**
 * LNURL-pay (LUD-06 / LUD-16 Lightning Address) resolution.
 *
 * Resolves a Lightning Address to a BOLT11 invoice for a given amount, with the
 * checks that protect the payer:
 *   - amount must be within the server's min/maxSendable
 *   - the returned invoice is decoded locally; its amount must match what we
 *     asked for (never trust the server to bill the right amount)
 *   - if the invoice commits to a description hash, it must equal sha256 of the
 *     metadata the server advertised (LUD-06)
 *
 * HTTP is injected (`JsonFetch`) so the engine never talks to the network in
 * tests.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { sha256 } from '@noble/hashes/sha2'
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils'
import { decodeBolt11 } from './bolt11'
import { LnurlError } from './errors'
import type { DecodedInvoice, JsonFetch } from './types'

interface LnurlPayMetadata {
  tag: string
  callback: string
  minSendable: number
  maxSendable: number
  metadata: string
  commentAllowed?: number
}

interface LnurlInvoiceResponse {
  pr: string
}

/** Split a Lightning Address into its well-known LNURL-pay URL. */
export function lnAddressToUrl(lnAddress: string): string {
  const parts = lnAddress.split('@')
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new LnurlError(lnAddress, 'not a valid name@domain address')
  }
  const [name, domain] = parts
  return `https://${domain}/.well-known/lnurlp/${name}`
}

export interface ResolvedInvoice {
  invoice: string
  decoded: DecodedInvoice
}

/** Resolve a Lightning Address to a validated invoice for `amountSat`. */
export async function resolveLnurlPay(
  lnAddress: string,
  amountSat: number,
  opts: { fetchJson: JsonFetch; comment?: string },
): Promise<ResolvedInvoice> {
  const meta = (await opts.fetchJson(lnAddressToUrl(lnAddress))) as LnurlPayMetadata
  if (meta.tag !== 'payRequest') {
    throw new LnurlError(lnAddress, `expected tag "payRequest", got "${meta.tag}"`)
  }

  const amountMsat = amountSat * 1000
  if (amountMsat < meta.minSendable || amountMsat > meta.maxSendable) {
    throw new LnurlError(
      lnAddress,
      `amount ${String(amountMsat)} msat outside [${String(meta.minSendable)}, ${String(meta.maxSendable)}]`,
    )
  }

  const url = new URL(meta.callback)
  url.searchParams.set('amount', String(amountMsat))
  if (opts.comment && (meta.commentAllowed ?? 0) > 0) {
    url.searchParams.set('comment', opts.comment.slice(0, meta.commentAllowed))
  }

  const res = (await opts.fetchJson(url.toString())) as LnurlInvoiceResponse
  if (typeof res.pr !== 'string' || res.pr.length === 0) {
    throw new LnurlError(lnAddress, 'callback did not return an invoice')
  }

  const decoded = decodeBolt11(res.pr)
  if (decoded.amountSat !== null && decoded.amountSat !== amountSat) {
    throw new LnurlError(
      lnAddress,
      `invoice amount ${String(decoded.amountSat)} sat != requested ${String(amountSat)} sat`,
    )
  }
  if (decoded.descriptionHash !== undefined) {
    const expected = bytesToHex(sha256(utf8ToBytes(meta.metadata)))
    if (decoded.descriptionHash !== expected) {
      throw new LnurlError(lnAddress, 'invoice description_hash does not match metadata')
    }
  }

  return { invoice: res.pr, decoded }
}
