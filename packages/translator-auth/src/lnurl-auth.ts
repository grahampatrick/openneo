/**
 * LNURL-auth adapter (LUD-04) — Bitcoin-native sign-in with no passwords.
 *
 * The wallet derives a per-domain *linking key* from its seed (LUD-05 style:
 * HMAC-SHA256(seed, domain)), signs the service's `k1` challenge with ECDSA,
 * and the service verifies it against the linking public key. The same linking
 * key is the translator's ARK signing identity (x-only pubkey).
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { secp256k1 } from '@noble/curves/secp256k1'
import { hmac } from '@noble/hashes/hmac'
import { sha256 } from '@noble/hashes/sha2'
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils'
import { getPublicKey } from '@neoark/manifest'
import type { AuthIdentity } from './types'

const HEX32 = /^[0-9a-f]{64}$/i

/** Derive the per-domain linking secret key (hex) from a wallet seed. */
export function deriveLinkingKey(walletSeedHex: string, domain: string): string {
  if (!HEX32.test(walletSeedHex)) throw new Error('wallet seed must be 32-byte hex')
  if (!domain) throw new Error('domain is required')
  return bytesToHex(hmac(sha256, hexToBytes(walletSeedHex), utf8ToBytes(domain)))
}

export interface LnurlAuthSignature {
  /** DER-encoded ECDSA signature (hex). */
  sig: string
  /** Compressed secp256k1 linking public key (hex) — the `key` LNURL param. */
  key: string
}

/** Sign a `k1` challenge with the linking key (the wallet side of LUD-04). */
export function signChallenge(k1Hex: string, linkingSeckeyHex: string): LnurlAuthSignature {
  if (!HEX32.test(k1Hex)) throw new Error('k1 must be 32-byte hex')
  const sig = secp256k1.sign(hexToBytes(k1Hex), hexToBytes(linkingSeckeyHex))
  return {
    sig: bytesToHex(sig.toBytes('der')),
    key: bytesToHex(secp256k1.getPublicKey(hexToBytes(linkingSeckeyHex), true)),
  }
}

/** Verify a signed `k1` challenge (the service side of LUD-04). */
export function verifyChallenge(k1Hex: string, signature: LnurlAuthSignature): boolean {
  if (!HEX32.test(k1Hex)) return false
  try {
    const sig = secp256k1.Signature.fromBytes(hexToBytes(signature.sig), 'der').toBytes('compact')
    return secp256k1.verify(sig, hexToBytes(k1Hex), hexToBytes(signature.key))
  } catch {
    return false
  }
}

/** Resolve a wallet seed + service domain to an ARK signing identity. */
export function lnurlAuthIdentity(walletSeedHex: string, domain: string): AuthIdentity {
  const seckey = deriveLinkingKey(walletSeedHex, domain)
  return {
    method: 'lnurl-auth',
    seckey,
    pubkey: getPublicKey(seckey),
    subject: `lnurl-auth:${domain}`,
  }
}
