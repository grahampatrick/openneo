/**
 * Optional ephemeral signer for contexts without a NIP-07 wallet. This pulls in
 * @noble crypto, so it is intentionally NOT part of the CDN core bundle
 * (`browser.ts`) — import it explicitly when you need it.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { schnorr } from '@noble/curves/secp256k1'
import { sha256 } from '@noble/hashes/sha2'
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils'
import type { Signer, SignedEvent, UnsignedEvent } from './types'

function eventId(e: UnsignedEvent & { pubkey: string }): string {
  const serialized = JSON.stringify([0, e.pubkey, e.created_at, e.kind, e.tags, e.content])
  return bytesToHex(sha256(utf8ToBytes(serialized)))
}

/**
 * A NIP-07-shaped signer backed by a secp256k1 key. Pass a 32-byte hex secret
 * for reproducibility, or omit to generate a fresh ephemeral key.
 */
export function ephemeralSigner(secretHex?: string): Signer {
  const sec = secretHex ? hexToBytes(secretHex) : schnorr.utils.randomSecretKey()
  const pubkey = bytesToHex(schnorr.getPublicKey(sec))
  return {
    getPublicKey: () => pubkey,
    signEvent: (event: UnsignedEvent): SignedEvent => {
      const unsigned = { ...event, pubkey }
      const id = eventId(unsigned)
      const sig = bytesToHex(schnorr.sign(hexToBytes(id), sec))
      return { ...unsigned, id, sig }
    },
  }
}
