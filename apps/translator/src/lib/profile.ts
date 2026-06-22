/**
 * Translator profile — a Nostr kind:0 metadata event carrying the translator's
 * Lightning address (`lud16`). This is the payout target the M19 payout runner
 * reads (via @neoark/payouts `profilesFromMetadata`). No custom event kind —
 * kind:0 is the NIP-01 metadata event the whole Nostr ecosystem understands.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import type { NostrEvent } from '@neoark/manifest'
import type { RelayPool } from '@neoark/relay'
import type { Signer, UnsignedEvent } from './signer'

export const KIND_METADATA = 0

/** A Lightning Address: name@domain (LUD-16). Not an LNURL (lud06). */
const LN_ADDRESS = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export interface Profile {
  name?: string
  about?: string
  /** Lightning Address (lud16) — where payouts are sent. */
  lud16?: string
}

export function isLightningAddress(value: string): boolean {
  return LN_ADDRESS.test(value.trim())
}

/** Build the unsigned kind:0 metadata event for a profile. */
export function buildProfileEvent(profile: Profile, createdAt: number): UnsignedEvent {
  const meta: Record<string, string> = {}
  if (profile.name?.trim()) meta.name = profile.name.trim()
  if (profile.about?.trim()) meta.about = profile.about.trim()
  if (profile.lud16?.trim()) {
    const addr = profile.lud16.trim()
    if (!isLightningAddress(addr)) throw new Error('Lightning address must look like name@domain')
    meta.lud16 = addr
  }
  return { kind: KIND_METADATA, created_at: createdAt, tags: [], content: JSON.stringify(meta) }
}

/** Parse a kind:0 event's content into a Profile (lenient — ignores extra fields). */
export function parseProfile(event: NostrEvent): Profile {
  if (event.kind !== KIND_METADATA) throw new Error('Not a kind:0 metadata event')
  let meta: Record<string, unknown>
  try {
    meta = JSON.parse(event.content) as Record<string, unknown>
  } catch {
    return {}
  }
  const out: Profile = {}
  if (typeof meta.name === 'string') out.name = meta.name
  if (typeof meta.about === 'string') out.about = meta.about
  if (typeof meta.lud16 === 'string' && isLightningAddress(meta.lud16)) out.lud16 = meta.lud16
  return out
}

/** Sign + publish a profile. Returns the event and how many relays accepted it. */
export async function publishProfile(
  profile: Profile,
  signer: Signer,
  pool: RelayPool,
  createdAt: number,
): Promise<{ event: NostrEvent; relaysAccepted: number }> {
  const event = await signer.signEvent(buildProfileEvent(profile, createdAt))
  const acks = await pool.publish(event)
  return { event, relaysAccepted: acks.filter((a) => a.ok).length }
}

/**
 * Fetch the latest profile for a pubkey from the relays. kind:0 is replaceable —
 * take the newest by created_at.
 */
export async function fetchProfile(pool: RelayPool, pubkey: string): Promise<Profile | null> {
  const events = await pool.query({ kinds: [KIND_METADATA], authors: [pubkey], limit: 5 })
  const newest = events.sort((a, b) => b.created_at - a.created_at)[0]
  return newest ? parseProfile(newest) : null
}
