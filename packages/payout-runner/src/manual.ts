/**
 * Manual payouts — for an operator who pays from their own wallet (e.g. Phoenix
 * mobile) rather than running an automated NWC bot. `plan` lists exactly who to
 * pay for each governed merge; after paying, `markPaid` records it and publishes
 * a kind:30712 receipt so the payout is publicly auditable.
 *
 * Manual receipts are *attestations* signed by the payer key (amount, recipient,
 * merge) — not preimage-proven like the auto path, since the human pays out of
 * band. That is the honest tradeoff for zero-infrastructure payouts.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { signEvent } from '@neoark/manifest'
import type { NostrEvent } from '@neoark/manifest'
import type { RelayPool } from '@neoark/relay'
import { KIND_PAYOUT } from '@neoark/translator-payments'
import type { ProfileResolver, PaidStore, SplitPercents } from '@neoark/payouts'
import { collectGovernedPayouts } from './collect'

export interface PlannedPayment {
  mergeEventId: string
  ref: string
  role: 'translator' | 'reviewer' | 'submitter'
  pubkey: string
  sats: number
  lightningAddress?: string
  /** Already paid (in the store) — skip. */
  paid: boolean
  /** Reason it can't be paid (no address), if any. */
  blocked?: string
}

export interface ManualPayoutsOptions {
  pool: RelayPool
  profiles: ProfileResolver
  paidStore: PaidStore
  /** Signs the public receipt attestations. */
  payerSeckey: string
  perMergeSats: number
  percents?: SplitPercents
  foundingPubkey?: string
}

export class ManualPayouts {
  constructor(private readonly o: ManualPayoutsOptions) {}

  /** The list of payments to make from your own wallet (governed, unpaid). */
  async plan(translationId: string): Promise<PlannedPayment[]> {
    const merges = await collectGovernedPayouts(this.o.pool, translationId, {
      perMergeSats: this.o.perMergeSats,
      ...(this.o.percents ? { percents: this.o.percents } : {}),
      ...(this.o.foundingPubkey ? { foundingPubkey: this.o.foundingPubkey } : {}),
    })
    const out: PlannedPayment[] = []
    for (const m of merges) {
      for (const share of m.shares) {
        const paid = this.o.paidStore.has(`${m.mergeEventId}:${share.pubkey}`)
        const lightningAddress = await this.o.profiles.lightningAddress(share.pubkey)
        out.push({
          mergeEventId: m.mergeEventId,
          ref: `${m.ref.book} ${String(m.ref.chapter)}:${String(m.ref.verse)}`,
          role: share.role,
          pubkey: share.pubkey,
          sats: share.sats,
          ...(lightningAddress ? { lightningAddress } : {}),
          paid,
          ...(lightningAddress ? {} : { blocked: 'no Lightning address on profile' }),
        })
      }
    }
    return out
  }

  /** Just the unpaid, payable lines (what you actually need to send). */
  async toPay(translationId: string): Promise<PlannedPayment[]> {
    return (await this.plan(translationId)).filter((p) => !p.paid && p.lightningAddress)
  }

  /**
   * After you've paid `pubkey` for `mergeEventId` from your wallet, record it and
   * publish a signed kind:30712 receipt. Idempotent.
   */
  async markPaid(payment: PlannedPayment, createdAt: number): Promise<{ receipt: NostrEvent } | { already: true }> {
    const key = `${payment.mergeEventId}:${payment.pubkey}`
    if (this.o.paidStore.has(key)) return { already: true }
    const receipt = signEvent(
      {
        created_at: createdAt,
        kind: KIND_PAYOUT,
        tags: [
          ['d', `ark-payout:${payment.mergeEventId}:${payment.pubkey}`],
          ['e', payment.mergeEventId],
          ['ark_action', 'payout'],
          ['ark_role', payment.role],
          ['amount_sat', String(payment.sats)],
          ['recipient', payment.lightningAddress ?? ''],
          ['p', payment.pubkey],
          ['ark_method', 'manual'],
        ],
        content: '',
      },
      this.o.payerSeckey,
    )
    this.o.paidStore.add(key)
    await this.o.pool.publish(receipt)
    return { receipt }
  }

  /** Format the plan as a copy-paste payout sheet (e.g. to pay from Phoenix). */
  static formatSheet(payments: PlannedPayment[]): string {
    const pay = payments.filter((p) => !p.paid && p.lightningAddress)
    const blocked = payments.filter((p) => !p.paid && !p.lightningAddress)
    const lines = ['Pay from your wallet:']
    for (const p of pay) lines.push(`  ${String(p.sats).padStart(5)} sats → ${p.lightningAddress ?? ''}  (${p.role}, ${p.ref})`)
    if (pay.length === 0) lines.push('  (nothing to pay)')
    if (blocked.length > 0) {
      lines.push('', 'Skipped — recipient has no Lightning address:')
      for (const p of blocked) lines.push(`  ${String(p.sats).padStart(5)} sats · ${p.role} ${p.pubkey.slice(0, 12)}… (${p.ref})`)
    }
    const total = pay.reduce((a, p) => a + p.sats, 0)
    lines.push('', `Total to pay: ${String(total)} sats across ${String(pay.length)} payment(s).`)
    return lines.join('\n')
  }
}
