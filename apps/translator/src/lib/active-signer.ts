/**
 * Resolve the signer for the current session. Both the NIP-07 extension and a
 * locally-generated key authenticate via the same flow (method "nip07"), so we
 * record which source was used and re-derive the signer for signing proposals
 * and review votes (including after a page reload).
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { browserSigner, type Signer } from './signer'
import { loadLocalSeckey, signerFor } from './identity'
import type { KeyValueStore } from './auth-client'

const SOURCE_KEY = 'neoark.translator.authsource'
export type AuthSource = 'extension' | 'local'

export function recordAuthSource(store: KeyValueStore, source: AuthSource): void {
  store.set(SOURCE_KEY, source)
}

/** The signer for the active session, or null if it can't be reconstructed. */
export function activeSigner(store: KeyValueStore): Signer | null {
  if (store.get(SOURCE_KEY) === 'local') {
    const hex = loadLocalSeckey(store)
    return hex ? signerFor(hex) : null
  }
  return browserSigner() // NIP-07 extension (may be absent after a reload)
}

/** The raw secret key, only when the user holds a local key (needed to sign a merge). */
export function activeSeckey(store: KeyValueStore): string | null {
  return store.get(SOURCE_KEY) === 'local' ? loadLocalSeckey(store) : null
}
