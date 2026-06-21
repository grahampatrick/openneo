/**
 * A pool of relays. Publishes to all (one failure never blocks the rest) and
 * merges + de-duplicates query results across relays by event id.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import type { NostrEvent, NostrFilter, PublishAck, RelayLike } from './types'

export class RelayPool {
  constructor(private readonly relays: RelayLike[]) {
    if (relays.length === 0) throw new Error('RelayPool needs at least one relay')
  }

  get urls(): string[] {
    return this.relays.map((r) => r.url)
  }

  /** Publish to every relay; returns one ack per relay (failures as ok:false). */
  async publish(event: NostrEvent): Promise<PublishAck[]> {
    const settled = await Promise.allSettled(this.relays.map((r) => r.publish(event)))
    return settled.map((s, i) =>
      s.status === 'fulfilled'
        ? s.value
        : { relay: this.relays[i]?.url ?? 'unknown', ok: false, message: errorText(s.reason) },
    )
  }

  /** Query every relay and merge results, de-duplicating by event id. */
  async query(filter: NostrFilter): Promise<NostrEvent[]> {
    const settled = await Promise.allSettled(this.relays.map((r) => r.query(filter)))
    const byId = new Map<string, NostrEvent>()
    for (const s of settled) {
      if (s.status !== 'fulfilled') continue
      for (const ev of s.value) byId.set(ev.id, ev)
    }
    return [...byId.values()]
  }

  close(): void {
    for (const r of this.relays) r.close()
  }
}

function errorText(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason)
}
