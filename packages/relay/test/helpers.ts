import { signManifest, buildUseProof, keypairFromSeed } from '@neoark/manifest'
import type { ValueManifest, NostrEvent } from '@neoark/manifest'

export const reader = keypairFromSeed('22'.repeat(32))
const translator = keypairFromSeed('11'.repeat(32))

export const manifest: ValueManifest = signManifest(
  {
    version: 'avm-1',
    translation_id: 'osv-en-2025',
    translation_blake3: 'b3:' + 'a'.repeat(64),
    translator_pubkey: translator.pubkey,
    issued_at: '2025-01-01T00:00:00Z',
    stream_rates: {
      chapter_read: { sats: 10, trigger: '80pct_visible_30s' },
      citation: { sats: 50, trigger: 'copy_or_share_with_attribution' },
    },
    splits: [{ lightning_address: 'a@x.io', weight: 100, role: 'translator' }],
    fork_policy: { allowed: true, predecessor_blake3: null },
  },
  translator.seckey,
)

let pre = 0
/** Build a signed use-proof event for a passage (unique preimage each call). */
export function useProof(
  passage: { book: string; chapter: number; verseStart: number; verseEnd: number },
  createdAt = 1717545600,
  trigger = '80pct_visible_30s',
  amount = 10,
): NostrEvent {
  pre += 1
  return buildUseProof(
    { manifest, passage, trigger, preimage: pre.toString(16).padStart(64, '0'), amount_sat: amount, created_at: createdAt },
    reader.seckey,
  )
}
