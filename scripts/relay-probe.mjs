/**
 * Relay health probe — checks a Nostr relay is up and speaking the protocol.
 * Fetches its NIP-11 info document, then does a REQ/EOSE round-trip.
 *
 *   node scripts/relay-probe.mjs wss://relay.openneo.org
 *
 * Exit 0 if both checks pass, 1 otherwise.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
process.on('unhandledRejection', () => {}) // the global WebSocket emits on a dead host; handled via onerror

const wss = process.argv[2] ?? 'wss://relay.openneo.org'
const https = wss.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:')

async function nip11() {
  try {
    const r = await fetch(https, { headers: { Accept: 'application/nostr+json' } })
    if (!r.ok) return { ok: false, why: `HTTP ${r.status}` }
    const info = await r.json()
    return { ok: true, name: info.name ?? '(unnamed)', nips: info.supported_nips?.length ?? 0 }
  } catch (e) {
    return { ok: false, why: e instanceof Error ? e.message : String(e) }
  }
}

function reqRoundTrip(timeoutMs = 8000) {
  return new Promise((resolve) => {
    let ws
    try {
      ws = new WebSocket(wss)
    } catch (e) {
      return resolve({ ok: false, why: String(e) })
    }
    const sub = 'probe' + Math.random().toString(36).slice(2)
    let settled = false
    const done = (r) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      ws.onerror = ws.onmessage = ws.onopen = null
      try {
        ws.close()
      } catch {}
      resolve(r)
    }
    const timer = setTimeout(() => done({ ok: false, why: 'no EOSE within timeout' }), timeoutMs)
    ws.onopen = () => ws.send(JSON.stringify(['REQ', sub, { kinds: [1], limit: 1 }]))
    ws.onmessage = (m) => {
      try {
        const d = JSON.parse(m.data)
        if (d[0] === 'EOSE' || d[0] === 'EVENT') done({ ok: true })
      } catch {}
    }
    ws.onerror = () => done({ ok: false, why: 'socket error (down or no TLS)' })
  })
}

const info = await nip11()
console.log(info.ok ? `✓ NIP-11: ${info.name}, ${String(info.nips)} NIPs` : `✗ NIP-11 failed: ${info.why}`)
const rt = await reqRoundTrip()
console.log(rt.ok ? '✓ REQ/EOSE round-trip OK' : `✗ round-trip failed: ${rt.why}`)
process.exit(info.ok && rt.ok ? 0 : 1)
