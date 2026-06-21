/**
 * NeoOS signing keypair (BIP-340 / Nostr secp256k1, x-only pubkey).
 *
 * By default this derives a DETERMINISTIC DEV key from a fixed seed so the
 * corpus is reproducible in CI and local dev. For a real release, set
 * NEOOS_SECKEY to the production 32-byte hex secret — the public key embedded
 * in the manifest will change accordingly.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { schnorr } from '@noble/curves/secp256k1'
import { blake3 } from '@noble/hashes/blake3'
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils'

const DEV_SEED = 'NeoOS-corpus-signing-key/dev/v1'

export interface NeoosKey {
  /** 32-byte secret key. */
  sec: Uint8Array
  /** 32-byte x-only public key (hex). */
  pubkey: string
  /** True when using the deterministic dev key (no NEOOS_SECKEY set). */
  isDev: boolean
}

export function loadNeoosKey(env: NodeJS.ProcessEnv = process.env): NeoosKey {
  const fromEnv = env.NEOOS_SECKEY?.trim()
  let sec: Uint8Array
  let isDev: boolean
  if (fromEnv) {
    if (!/^[0-9a-fA-F]{64}$/.test(fromEnv)) {
      throw new Error('NEOOS_SECKEY must be 32-byte hex (64 chars)')
    }
    sec = hexToBytes(fromEnv)
    isDev = false
  } else {
    sec = blake3(utf8ToBytes(DEV_SEED)) // 32 bytes
    isDev = true
  }
  const pubkey = bytesToHex(schnorr.getPublicKey(sec))
  return { sec, pubkey, isDev }
}
