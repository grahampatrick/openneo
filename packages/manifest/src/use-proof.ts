/**
 * Parse and verify UP-1 use-proof events (Nostr kind:30078).
 *
 * A use-proof is a signed, public record that a reader paid to consume a
 * passage, anchored to a real Lightning payment (the preimage hashes to the
 * invoice payment hash). See spec/use-proof.md.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { sha256 } from '@noble/hashes/sha2'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'
import { verifyEventSignature, signEvent } from './event'
import { rateForTrigger } from './manifest'
import type { NostrEvent, UseProof, ValueManifest, VerifyResult } from './types'

export const USE_PROOF_KIND = 30078

function tagValue(event: NostrEvent, name: string): string | undefined {
  return event.tags.find((t) => t[0] === name)?.[1]
}

/** Parse a kind:30078 event's tags into a structured use-proof. Throws if malformed. */
export function parseUseProof(event: NostrEvent): UseProof {
  if (event.kind !== USE_PROOF_KIND) {
    throw new Error(`Not a use-proof event: kind ${String(event.kind)} (expected ${String(USE_PROOF_KIND)})`)
  }

  const missing: string[] = []
  const req = (name: string): string => {
    const v = tagValue(event, name)
    if (v === undefined || v === '') {
      missing.push(name)
      return ''
    }
    return v
  }
  const translation_id = req('ark_translation')
  const blake3 = req('ark_blake3')
  const trigger = req('ark_trigger')
  const bolt11_hash = req('bolt11_hash')
  const preimage = req('preimage')
  const amountStr = req('amount_sat')

  const passage = event.tags.find((t) => t[0] === 'ark_passage')
  const book = passage?.[1]
  const chapter = passage?.[2]
  const verseStart = passage?.[3]
  const verseEnd = passage?.[4]
  if (book === undefined || chapter === undefined || verseStart === undefined || verseEnd === undefined) {
    missing.push('ark_passage')
  }
  if (missing.length > 0) throw new Error(`Use-proof missing tags: ${missing.join(', ')}`)

  const amount_sat = Number(amountStr)
  if (!Number.isInteger(amount_sat) || amount_sat < 0) {
    throw new Error(`Invalid amount_sat: ${amountStr}`)
  }

  const app = tagValue(event, 'ark_app')
  return {
    event,
    translation_id,
    blake3,
    passage: {
      book: book ?? '',
      chapter: Number(chapter),
      verseStart: Number(verseStart),
      verseEnd: Number(verseEnd),
    },
    trigger,
    ...(app !== undefined ? { app } : {}),
    bolt11_hash,
    preimage,
    amount_sat,
  }
}

/**
 * Verify a use-proof against its value manifest. UP-1 checks, in order:
 *  1. Schnorr signature on the event validates against pubkey
 *  2. bolt11_hash === sha256(preimage)  (proves the payment settled)
 *  3. ark_blake3 corresponds to the given signed manifest
 *  4. amount_sat is consistent with stream_rates[trigger].sats
 *  5. (off-chain LN node check) — out of scope here
 */
export function verifyUseProof(event: NostrEvent, manifest: ValueManifest): VerifyResult {
  const errors: string[] = []

  let proof: UseProof
  try {
    proof = parseUseProof(event)
  } catch (e) {
    return { valid: false, errors: [e instanceof Error ? e.message : String(e)] }
  }

  // 1. signature
  if (!verifyEventSignature(event)) errors.push('event Schnorr signature does not verify')

  // 2. payment anchor: preimage hashes to the payment hash
  try {
    const computed = bytesToHex(sha256(hexToBytes(proof.preimage)))
    if (computed.toLowerCase() !== proof.bolt11_hash.toLowerCase()) {
      errors.push('bolt11_hash does not match sha256(preimage)')
    }
  } catch {
    errors.push('preimage is not valid hex')
  }

  // 3. manifest binding
  if (proof.translation_id !== manifest.translation_id) {
    errors.push(
      `ark_translation "${proof.translation_id}" != manifest "${manifest.translation_id}"`,
    )
  }
  if (proof.blake3 !== manifest.translation_blake3) {
    errors.push('ark_blake3 does not match manifest translation_blake3')
  }

  // 4. amount consistency
  const expected = rateForTrigger(manifest, proof.trigger)
  if (expected === undefined) {
    errors.push(`trigger "${proof.trigger}" has no rate in manifest`)
  } else if (expected !== proof.amount_sat) {
    errors.push(`amount_sat ${String(proof.amount_sat)} != rate ${String(expected)} for trigger`)
  }

  return { valid: errors.length === 0, errors }
}

export interface BuildUseProofInput {
  manifest: ValueManifest
  passage: { book: string; chapter: number; verseStart: number; verseEnd: number }
  trigger: string
  preimage: string
  amount_sat: number
  created_at: number
  app?: string
}

/**
 * Build + sign a use-proof event. `bolt11_hash` is derived from the preimage so
 * the result satisfies the payment-anchor check by construction.
 */
export function buildUseProof(input: BuildUseProofInput, readerPrivKey: string): NostrEvent {
  const { manifest, passage, trigger, preimage, amount_sat, created_at, app } = input
  const bolt11_hash = bytesToHex(sha256(hexToBytes(preimage)))
  const { book, chapter, verseStart, verseEnd } = passage
  const d = `ark-up:${manifest.translation_id}:${book}:${String(chapter)}:${String(verseStart)}-${String(verseEnd)}:${String(created_at)}`
  const tags: string[][] = [
    ['d', d],
    ['ark_translation', manifest.translation_id],
    ['ark_blake3', manifest.translation_blake3],
    ['ark_passage', book, String(chapter), String(verseStart), String(verseEnd)],
    ['ark_trigger', trigger],
    ...(app ? [['ark_app', app]] : []),
    ['bolt11_hash', bolt11_hash],
    ['preimage', preimage],
    ['amount_sat', String(amount_sat)],
  ]
  return signEvent({ created_at, kind: USE_PROOF_KIND, tags, content: '' }, readerPrivKey)
}
