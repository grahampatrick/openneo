/**
 * LNURL-auth (LUD-04) — server side.
 *
 * The server issues a `k1` challenge encoded as an `lnurl1…` string. The user's
 * Lightning wallet derives a per-domain linking key, signs `k1` with ECDSA, and
 * returns `(sig, key)`. The server verifies the signature against the linking
 * public key. The wallet side (key derivation + signing) lives in
 * `@neoark/translator-auth`; this is the verifier.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { secp256k1 } from '@noble/curves/secp256k1'
import { bech32 } from '@scure/base'
import { hexToBytes, utf8ToBytes } from '@noble/hashes/utils'

const HEX32 = /^[0-9a-f]{64}$/i
const COMPRESSED = /^0[23][0-9a-f]{64}$/i

export interface LnurlAuthCallback {
  /** The challenge hex the wallet signed. */
  k1: string
  /** DER-encoded ECDSA signature (hex). */
  sig: string
  /** Compressed secp256k1 linking public key (hex). */
  key: string
}

/**
 * Build the `lnurl1…` bech32 string a wallet scans/opens. `endpoint` is the
 * server's callback URL (e.g. https://neoark.org/api/lnurl-auth).
 */
export function buildLnurlAuth(endpoint: string, k1: string): string {
  if (!HEX32.test(k1)) throw new Error('lnurl-auth: k1 must be 32-byte hex')
  const url = new URL(endpoint)
  url.searchParams.set('tag', 'login')
  url.searchParams.set('k1', k1)
  url.searchParams.set('action', 'login')
  const words = bech32.toWords(utf8ToBytes(url.toString()))
  return bech32.encode('lnurl', words, 1023).toUpperCase()
}

/** Verify the wallet's signed callback. Pure crypto — no challenge bookkeeping. */
export function verifyLnurlSignature(cb: LnurlAuthCallback): boolean {
  if (!HEX32.test(cb.k1) || !COMPRESSED.test(cb.key)) return false
  try {
    const sig = secp256k1.Signature.fromBytes(hexToBytes(cb.sig), 'der').toBytes('compact')
    return secp256k1.verify(sig, hexToBytes(cb.k1), hexToBytes(cb.key))
  } catch {
    return false
  }
}
