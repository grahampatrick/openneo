/**
 * Reader session — the pay loop. When a chapter qualifies (≥80% visible for
 * 30s, signalled by the UI), charge the manifest splits via ArkPayer and publish
 * a use-proof to the relay pool. Tracks status-bar state.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { rateForTrigger } from '@neoark/manifest'
import type { ValueManifest } from '@neoark/manifest'
import type { ArkPayer } from '@neoark/payer'
import { publishUseProof } from '@neoark/relay'
import type { RelayPool } from '@neoark/relay'
import type { Reference } from './types'
import type { StatusBarState } from './render'

export interface ReaderSessionOptions {
  manifest: ValueManifest
  budgetSats: number
  /** When true, render only — never pay or publish. */
  noPay?: boolean
  payer?: ArkPayer
  pool?: RelayPool
  readerPrivKey?: string
  app?: string
  /** Clock injection for deterministic created_at. */
  now?: () => number
}

export interface ReadOutcome {
  paidSats: number
  proofPublished: boolean
  failures: string[]
}

const READ_TRIGGER = '80pct_visible_30s'

export class ReaderSession {
  private spentSats = 0
  private proofsPublished = 0
  private lastPaidTranslator: string | undefined
  private readonly billed = new Set<string>()

  constructor(private readonly o: ReaderSessionOptions) {}

  get status(): StatusBarState {
    return {
      spentSats: this.spentSats,
      budgetSats: this.o.budgetSats,
      proofsPublished: this.proofsPublished,
      ...(this.lastPaidTranslator !== undefined ? { lastPaidTranslator: this.lastPaidTranslator } : {}),
    }
  }

  /** Signal that a chapter qualified for billing (called by the UI after 30s). */
  async onChapterRead(ref: Reference): Promise<ReadOutcome> {
    const key = `${ref.bookId}:${String(ref.chapter)}`
    if (this.o.noPay || this.billed.has(key)) {
      return { paidSats: 0, proofPublished: false, failures: [] }
    }
    if (!this.o.payer || !this.o.pool || !this.o.readerPrivKey) {
      throw new Error('Paying session requires payer, pool, and readerPrivKey')
    }
    this.billed.add(key)

    const result = await this.o.payer.chargeForRead(this.o.manifest, READ_TRIGGER)
    this.spentSats += result.totalPaidSats
    const translator = result.receipts.find((r) => r.role === 'translator') ?? result.receipts[0]
    if (translator) this.lastPaidTranslator = translator.recipient

    let proofPublished = false
    const anchor = result.receipts[0]
    if (anchor) {
      const rate = rateForTrigger(this.o.manifest, READ_TRIGGER) ?? result.totalPaidSats
      await publishUseProof(
        {
          manifest: this.o.manifest,
          passage: {
            book: ref.bookId,
            chapter: ref.chapter,
            verseStart: ref.verseStart ?? 1,
            verseEnd: ref.verseEnd ?? ref.verseStart ?? 1,
          },
          trigger: READ_TRIGGER,
          preimage: anchor.preimage,
          amount_sat: rate,
          created_at: (this.o.now ?? (() => 0))(),
          ...(this.o.app !== undefined ? { app: this.o.app } : {}),
        },
        this.o.readerPrivKey,
        this.o.pool,
      )
      this.proofsPublished += 1
      proofPublished = true
    }

    return {
      paidSats: result.totalPaidSats,
      proofPublished,
      failures: result.failures.map((f) => `${f.recipient}: ${f.reason}`),
    }
  }
}
