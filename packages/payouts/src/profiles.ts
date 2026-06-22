/**
 * Profile resolution — translator pubkey → Lightning address.
 *
 * In production this resolves from a Nostr profile (kind:0 `lud16`) or the auth
 * profile; the `ProfileResolver` is injected so the source is pluggable. A
 * simple in-memory registry is provided for tests/CLI.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import type { ProfileResolver } from './types'

export class MemoryProfileRegistry implements ProfileResolver {
  private readonly map = new Map<string, string>()
  set(pubkeyHex: string, lightningAddress: string): this {
    this.map.set(pubkeyHex.toLowerCase(), lightningAddress)
    return this
  }
  lightningAddress(pubkeyHex: string): string | undefined {
    return this.map.get(pubkeyHex.toLowerCase())
  }
}

/** Build a resolver from Nostr kind:0 profile events (reads the `lud16` field). */
export function profilesFromMetadata(events: { pubkey: string; content: string }[]): ProfileResolver {
  const registry = new MemoryProfileRegistry()
  for (const e of events) {
    try {
      const meta = JSON.parse(e.content) as { lud16?: string }
      if (typeof meta.lud16 === 'string' && meta.lud16.includes('@')) registry.set(e.pubkey, meta.lud16)
    } catch {
      /* skip non-JSON metadata */
    }
  }
  return registry
}
