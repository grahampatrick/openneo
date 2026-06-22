/**
 * Manual payout CLI — for paying from your own wallet (e.g. Phoenix).
 *
 *   # show who to pay for governed merges (a copy-paste sheet for your wallet)
 *   NEOOS_PAYER_NSEC=nsec1… pnpm --filter @neoark/payout-runner run payouts plan
 *
 *   # after you've paid one, record it + publish the public receipt
 *   NEOOS_PAYER_NSEC=nsec1… pnpm --filter @neoark/payout-runner run payouts \
 *     confirm <mergeEventId> <recipientPubkeyHex>
 *
 * Env:
 *   NEOOS_PAYER_NSEC   nsec that signs the public payout receipts (required for confirm)
 *   NEOOS_TRANSLATION  translation id (default neoos-en-2026)
 *   NEOOS_PER_MERGE    total sats per merge (default 500)
 *   NEOOS_PAID_FILE    paid-state file (default ./payouts.paid.json)
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { RelayPool, WebSocketRelay, DEFAULT_RELAYS } from '@neoark/relay'
import { profilesFromMetadata, type ProfileResolver } from '@neoark/payouts'
import { normalizeSeckey } from '@neoark/manifest'
import { ManualPayouts, FilePaidStore } from './src/index'

const log = (s = ''): void => {
  console.log(s)
}
const TID = process.env.NEOOS_TRANSLATION ?? 'neoos-en-2026'
const PER_MERGE = Number(process.env.NEOOS_PER_MERGE ?? '500')
const PAID_FILE = process.env.NEOOS_PAID_FILE ?? './payouts.paid.json'

function pool(): RelayPool {
  const factory = ((u: string) => new WebSocket(u)) as never
  return new RelayPool(DEFAULT_RELAYS.map((u) => new WebSocketRelay(u, factory, { timeoutMs: 9000 })))
}

/** Build a profile resolver from live kind:0 events on the relays. */
async function liveProfiles(p: RelayPool): Promise<ProfileResolver> {
  const metas = await p.query({ kinds: [0], limit: 500 })
  return profilesFromMetadata(metas.map((e) => ({ pubkey: e.pubkey, content: e.content })))
}

function payerSeckey(): string {
  const nsec = process.env.NEOOS_PAYER_NSEC
  if (!nsec) throw new Error('set NEOOS_PAYER_NSEC (the nsec that signs receipts)')
  return normalizeSeckey(nsec)
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2)
  const p = pool()
  try {
    if (cmd === 'plan' || cmd === undefined) {
      // plan never signs, so the payer key is unused here.
      const mp = new ManualPayouts({ pool: p, profiles: await liveProfiles(p), paidStore: new FilePaidStore(PAID_FILE), payerSeckey: '0'.repeat(64), perMergeSats: PER_MERGE })
      log(ManualPayouts.formatSheet(await mp.plan(TID)))
      log('\nWhen you have paid one, run:  payouts confirm <mergeEventId> <recipientPubkeyHex>')
    } else if (cmd === 'confirm') {
      const [mergeEventId, pubkey] = rest
      if (!mergeEventId || !pubkey) throw new Error('usage: payouts confirm <mergeEventId> <recipientPubkeyHex>')
      const mp = new ManualPayouts({ pool: p, profiles: await liveProfiles(p), paidStore: new FilePaidStore(PAID_FILE), payerSeckey: payerSeckey(), perMergeSats: PER_MERGE })
      const match = (await mp.plan(TID)).find((x) => x.mergeEventId === mergeEventId && x.pubkey.toLowerCase() === pubkey.toLowerCase())
      if (!match) throw new Error('no matching unpaid recipient found for that merge + pubkey')
      const res = await mp.markPaid(match, Math.floor(Date.now() / 1000))
      log('already' in res ? 'Already recorded.' : `✓ Recorded + published receipt ${res.receipt.id.slice(0, 12)}… for ${String(match.sats)} sats → ${match.lightningAddress ?? '?'}`)
    } else {
      log(`unknown command: ${cmd}. Use "plan" or "confirm".`)
    }
  } finally {
    p.close()
  }
}

await main()
