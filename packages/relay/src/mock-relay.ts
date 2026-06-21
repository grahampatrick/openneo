/**
 * In-memory relay implementing the bits of the Nostr filter model we need.
 * Used by tests, demos, and (per the M4 deliverable) reused by the M6 reader.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { verifyEventSignature } from '@neoark/manifest'
import type { NostrEvent, NostrFilter, PublishAck, RelayLike } from './types'

export interface MockRelayOptions {
  /** Reject events whose signature does not verify (default true). */
  verify?: boolean
  url?: string
}

export class MockRelay implements RelayLike {
  readonly url: string
  private readonly events = new Map<string, NostrEvent>()
  private readonly verify: boolean
  private closed = false

  constructor(opts: MockRelayOptions = {}) {
    this.url = opts.url ?? 'mock://relay'
    this.verify = opts.verify ?? true
  }

  /** Events currently stored (test inspection). */
  get size(): number {
    return this.events.size
  }

  publish(event: NostrEvent): Promise<PublishAck> {
    if (this.closed) return Promise.resolve({ relay: this.url, ok: false, message: 'closed' })
    if (this.verify && !verifyEventSignature(event)) {
      return Promise.resolve({ relay: this.url, ok: false, message: 'invalid: bad signature' })
    }
    this.events.set(event.id, event) // newer event with same id replaces (NIP-01)
    return Promise.resolve({ relay: this.url, ok: true })
  }

  query(filter: NostrFilter): Promise<NostrEvent[]> {
    if (this.closed) return Promise.resolve([])
    let out = [...this.events.values()].filter((e) => matchesFilter(e, filter))
    out.sort((a, b) => b.created_at - a.created_at) // newest first (NIP-01)
    if (filter.limit !== undefined) out = out.slice(0, filter.limit)
    return Promise.resolve(out)
  }

  close(): void {
    this.closed = true
  }
}

/** NIP-01 filter matching, including `#<tag>` filters. */
export function matchesFilter(event: NostrEvent, filter: NostrFilter): boolean {
  if (filter.ids && !filter.ids.includes(event.id)) return false
  if (filter.authors && !filter.authors.includes(event.pubkey)) return false
  if (filter.kinds && !filter.kinds.includes(event.kind)) return false
  if (filter.since !== undefined && event.created_at < filter.since) return false
  if (filter.until !== undefined && event.created_at > filter.until) return false
  for (const [key, wanted] of Object.entries(filter)) {
    if (!key.startsWith('#') || !Array.isArray(wanted)) continue
    const wantedValues = wanted as string[]
    const tagName = key.slice(1)
    const values = event.tags.filter((t) => t[0] === tagName).map((t) => t[1])
    if (!wantedValues.some((w) => values.includes(w))) return false
  }
  return true
}
