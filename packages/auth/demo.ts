/**
 * @neoark/auth demo — both flows end to end:
 *   LNURL-auth:  challenge → wallet signs → verify → session
 *   NIP-07:      challenge → extension signs → verify → session
 *
 *   pnpm --filter @neoark/auth run demo
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { AuthService, ChallengeStore, buildNip07AuthEvent } from './src/index'
import { keypairFromSeed, signEvent } from '@neoark/manifest'
import { secp256k1 } from '@noble/curves/secp256k1'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'

const line = (label: string, value: unknown): void => {
  console.log(`  ${label.padEnd(22)} ${String(value)}`)
}

// Fixed clock so the run is reproducible.
const clock = 1_717_545_600
const svc = new AuthService({
  jwtSecret: 'demo-server-secret',
  now: () => clock,
  challengeStore: new ChallengeStore({ now: () => clock }),
})

console.log('\n=== LNURL-auth (Lightning wallet) ===')
{
  const ch = svc.issueChallenge('https://neoark.org/api/lnurl-auth')
  line('1. challenge issued', ch.k1.slice(0, 24) + '…')
  line('   lnurl (wallet scans)', (ch.lnurl ?? '').slice(0, 30) + '…')
  // Wallet derives a per-domain linking key and signs k1 (ECDSA).
  const linkSec = hexToBytes('22'.repeat(32))
  const key = bytesToHex(secp256k1.getPublicKey(linkSec, true))
  const sig = bytesToHex(secp256k1.sign(hexToBytes(ch.k1), linkSec).toBytes('der'))
  line('2. wallet signs', 'sig ' + sig.slice(0, 20) + '…')
  const r = svc.verifyLnurlAuth({ k1: ch.k1, sig, key })
  if (r.ok) {
    line('3. verified → session', r.value.claims.sub.slice(0, 24) + '…')
    line('   method', r.value.claims.method)
    line('   session valid', JSON.stringify(svc.verifySession(r.value.token).ok))
  } else line('verify failed', r.error)
}

console.log('\n=== NIP-07 (Nostr browser extension) ===')
{
  const kp = keypairFromSeed('11'.repeat(32)) // stands in for window.nostr
  const ch = svc.issueChallenge()
  line('1. challenge issued', ch.k1.slice(0, 24) + '…')
  const signed = signEvent(buildNip07AuthEvent(ch.k1, clock, 'neoark.org'), kp.seckey)
  line('2. extension signs', 'kind ' + String(signed.kind) + ' event ' + signed.id.slice(0, 16) + '…')
  const r = svc.verifyNip07(signed)
  if (r.ok) {
    line('3. verified → session', r.value.claims.sub.slice(0, 24) + '…')
    line('   method', r.value.claims.method)
    line('   session valid', JSON.stringify(svc.verifySession(r.value.token).ok))
    line('   replay rejected', JSON.stringify(!svc.verifyNip07(signed).ok))
  } else line('verify failed', r.error)
}

console.log('\nNo email, no Privy, no vendor — identity is an npub.\n')
