/**
 * NeoArkCite — drop-in: when a page renders NeoOS verses (marked with
 * `data-neoos-ref`), auto-publish a kind:30710 use-proof so verse usage becomes
 * verifiable public data.
 *
 *   <span data-neoos-ref="neoos-en-2026:JHN:3:16">For Elohiym so loved…</span>
 *   <script src="https://cdn.neoark.org/cite.min.js"></script>
 *   <script>NeoArkCite.init({ relays: ["wss://nos.lol"] }).scan()</script>
 *
 * The bundle ships no crypto: signing is delegated to a NIP-07 signer
 * (`window.nostr` by default, or an injected/ephemeral signer).
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { publishToRelays } from './relay-publish'
import { KIND_USE_PROOF } from './types'
import type { CiteOptions, Signer, SignedEvent, UnsignedEvent } from './types'

interface Ref {
  raw: string
  translationId: string
}

/** Parse a `data-neoos-ref` value "translation:book:ch:vs[-vs]". */
export function parseRef(raw: string): Ref | null {
  const trimmed = raw.trim()
  const translationId = trimmed.split(':')[0]
  if (!translationId || trimmed.split(':').length < 2) return null
  return { raw: trimmed, translationId }
}

function getSigner(opts: CiteOptions): Signer {
  if (opts.signer) return opts.signer
  const injected = (globalThis as unknown as { nostr?: Signer }).nostr
  if (injected) return injected
  throw new Error('NeoArkCite: no signer provided and window.nostr is unavailable')
}

export class NeoArkCite {
  private readonly signer: Signer
  private readonly now: () => number
  private readonly published = new Set<string>()

  private constructor(private readonly opts: CiteOptions) {
    this.signer = getSigner(opts)
    this.now = opts.now ?? (() => Math.floor(Date.now() / 1000))
  }

  static init(opts: CiteOptions): NeoArkCite {
    if (!opts.relays.length) throw new Error('NeoArkCite.init requires at least one relay')
    return new NeoArkCite(opts)
  }

  /** Collect `data-neoos-ref` values from a DOM root, de-duplicated. */
  collectRefs(root?: Document | Element): Ref[] {
    const doc = root ?? this.opts.doc ?? (globalThis as unknown as { document?: Document }).document
    if (!doc) throw new Error('NeoArkCite: no document to scan')
    const nodes = doc.querySelectorAll('[data-neoos-ref]')
    const refs: Ref[] = []
    const seen = new Set<string>()
    nodes.forEach((el) => {
      const raw = el.getAttribute('data-neoos-ref')
      if (!raw) return
      const ref = parseRef(raw)
      if (ref && !seen.has(ref.raw)) {
        seen.add(ref.raw)
        refs.push(ref)
      }
    })
    return refs
  }

  /**
   * Scan the DOM and publish use-proofs. In rollup mode, every fresh ref this
   * call sees is folded into a single aggregated event (privacy: no per-render
   * granularity). Otherwise one event per ref. Returns the published events.
   */
  async scan(root?: Document | Element): Promise<SignedEvent[]> {
    const pubkey = await this.signer.getPublicKey()
    const fresh = this.collectRefs(root).filter((r) => !this.published.has(r.raw))
    for (const r of fresh) this.published.add(r.raw)
    if (fresh.length === 0) return []

    const created = this.now()
    const events: UnsignedEvent[] = this.opts.rollup
      ? [this.rollupEvent(fresh, pubkey, created)]
      : fresh.map((r) => this.singleEvent(r, pubkey, created))

    const out: SignedEvent[] = []
    for (const unsigned of events) {
      const signed = await this.signer.signEvent(unsigned)
      await publishToRelays(signed, this.opts.relays, this.opts.socketFactory)
      out.push(signed)
    }
    return out
  }

  private baseTags(pubkey: string): string[][] {
    const tags: string[][] = [
      ['consumer', pubkey],
      ['t', 'neoos-use'],
    ]
    if (this.opts.context) tags.push(['context', this.opts.context])
    const source = this.opts.source ?? this.hostname()
    if (source) tags.push(['source', source])
    return tags
  }

  /** The embedding page's hostname, for the reader's "where used?" list. */
  private hostname(): string | undefined {
    const fromDoc = (this.opts.doc as unknown as { location?: { hostname?: string } } | undefined)?.location?.hostname
    const fromGlobal = (globalThis as unknown as { location?: { hostname?: string } }).location?.hostname
    return fromDoc ?? fromGlobal
  }

  private singleEvent(ref: Ref, pubkey: string, created: number): UnsignedEvent {
    return {
      kind: KIND_USE_PROOF,
      created_at: created,
      pubkey,
      tags: [
        ['d', `neoos-use:${ref.raw}:${String(created)}`],
        ['verse', ref.raw],
        ['translation', ref.translationId],
        ...this.baseTags(pubkey),
      ],
      content: '',
    }
  }

  private rollupEvent(refs: Ref[], pubkey: string, created: number): UnsignedEvent {
    const day = Math.floor(created / 86_400)
    const translations = [...new Set(refs.map((r) => r.translationId))]
    return {
      kind: KIND_USE_PROOF,
      created_at: created,
      pubkey,
      tags: [
        ['d', `neoos-use-rollup:${String(day)}`],
        ...refs.map((r) => ['verse', r.raw]),
        ...translations.map((t) => ['translation', t]),
        ...this.baseTags(pubkey),
      ],
      content: '',
    }
  }
}
