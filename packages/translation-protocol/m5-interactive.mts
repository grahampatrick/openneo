/**
 * Interactive walkthrough of the Bitcoin Translation Protocol — runs the REAL
 * @neoark/translation-protocol code behind clickable buttons. Scratch demo aid
 * (not committed). Run: pnpm exec tsx m5-interactive.mts
 */
import { createServer } from 'node:http'
import { keypairFromSeed } from '@neoark/manifest'
import {
  submitProposal,
  parseProposal,
  submitReview,
  parseReview,
  tallyReviews,
  mergeProposal,
  anchorBatch,
  verifyAnchor,
  MockCalendar,
  DEFAULT_QUORUM,
} from '@neoark/translation-protocol'
import { payTranslator } from '@neoark/translator-payments'

// Actors (deterministic keys so ids are stable across the session).
const translator = keypairFromSeed('a1'.repeat(32))
const reviewers = ['b1', 'b2', 'b3'].map((s) => keypairFromSeed(s.repeat(32)))
const maintainer = keypairFromSeed('cc'.repeat(32))
const calendar = new MockCalendar('https://alice.btc.calendar.opentimestamps.org')

// In-memory session state.
const state: any = { proposal: null, proposalEvent: null, reviews: [], merge: null, anchor: null, confirmed: null }
let clock = 1_700_000_000

const short = (s: string, n = 14) => s.slice(0, n) + '…'

function json(res: any, body: unknown) {
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

const handlers: Record<string, () => any> = {
  '/api/propose': () => {
    state.proposalEvent = submitProposal(
      {
        ref: { translationId: 'neoos-en-2026', book: 'GEN', chapter: 1, verse: 6 },
        newText: 'And Elohiym said, “Let there be a firmament between the waters, to separate the waters from the waters.”',
        rationale: 'Hebrew raqia = a solid beaten/stretched surface. "Firmament" is accurate; "expanse" is a modern softening.',
        createdAt: clock++,
      },
      translator.seckey,
    )
    state.proposal = parseProposal(state.proposalEvent)
    state.reviews = []
    state.merge = null
    state.anchor = null
    state.confirmed = null
    return {
      ok: true,
      actor: 'Translator (signed in via LNURL-auth)',
      pubkey: short(translator.pubkey),
      event_id: state.proposal.id,
      kind: state.proposalEvent.kind,
      ref: `${state.proposal.ref.book} ${state.proposal.ref.chapter}:${state.proposal.ref.verse}`,
      newText: state.proposal.newText,
      rationale: state.proposal.rationale,
      sig: short(state.proposalEvent.sig, 24),
    }
  },
  '/api/review': () => {
    if (!state.proposal) return { ok: false, error: 'Submit a proposal first.' }
    const i = state.reviews.length
    if (i >= reviewers.length) return { ok: false, error: 'All 3 peers have already reviewed.' }
    const ev = submitReview({ proposalId: state.proposal.id, vote: 'approve', comment: 'Checked against the Hebrew — accurate.', createdAt: clock++ }, reviewers[i].seckey)
    state.reviews.push(parseReview(ev))
    const tally = tallyReviews(state.reviews, DEFAULT_QUORUM)
    return {
      ok: true,
      actor: `Peer reviewer #${i + 1} (signed in via Privy)`,
      pubkey: short(reviewers[i].pubkey),
      vote: 'approve',
      event_id: ev.id,
      tally: `${tally.approvals}/${tally.reviewers} approvals · ratio ${tally.approvalRatio.toFixed(2)}`,
      quorum_met: tally.meetsQuorum,
      quorum_rule: `need ≥${DEFAULT_QUORUM.minReviewers} reviewers at ≥${DEFAULT_QUORUM.approvalThreshold}`,
    }
  },
  '/api/merge': () => {
    if (!state.proposal) return { ok: false, error: 'Submit a proposal first.' }
    try {
      state.merge = mergeProposal(state.proposal, state.reviews, maintainer.seckey, clock++)
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
    return {
      ok: true,
      actor: 'Maintainer',
      pubkey: short(maintainer.pubkey),
      merge_event_id: state.merge.event.id,
      kind: state.merge.event.kind,
      corpus_update: `${state.merge.update.ref.book} ${state.merge.update.ref.chapter}:${state.merge.update.ref.verse} → "${state.merge.update.newText.slice(0, 60)}…"`,
      sig: short(state.merge.event.sig, 24),
    }
  },
  '/api/anchor': () => {
    if (!state.merge) return { ok: false, error: 'Merge the proposal first.' }
    return anchorBatch([state.merge.event.id, 'a'.repeat(64), 'b'.repeat(64)], calendar).then((anchor: any) => {
      state.anchor = anchor
      return {
        ok: true,
        actor: 'Daily batch anchor (OpenTimestamps)',
        leaves: anchor.leaves.length,
        merkle_root: anchor.merkleRoot,
        attestation: anchor.attestation.type,
        note: 'Today’s merges share ONE Merkle root → one Bitcoin transaction. Status is "pending" (~1h to confirm).',
      }
    })
  },
  '/api/confirm': () => {
    if (!state.anchor) return { ok: false, error: 'Anchor the batch first.' }
    state.confirmed = calendar.confirm(state.anchor.merkleRoot, 840_000, 'bc'.repeat(32))
    return verifyAnchor(state.merge.event.id, { ...state.anchor, attestation: state.confirmed }, calendar).then((v: any) => ({
      ok: true,
      actor: 'Bitcoin (≈1 hour later)',
      block_height: 840_000,
      verify: v,
      note: 'The merge is now timestamped to Bitcoin forever. Anyone can verify inclusion + attestation independently.',
    }))
  },
  '/api/pay': () => {
    if (!state.merge) return { ok: false, error: 'Merge the proposal first.' }
    const wallet = { payInvoice: () => Promise.resolve({ preimage: 'ab'.repeat(32) }) }
    const resolveInvoice: any = (lnAddress: string, sats: number) => Promise.resolve({ invoice: `lnbc-${lnAddress}`, decoded: { paymentHash: 'cd'.repeat(32), amountSat: sats } })
    return payTranslator(
      { lightningAddress: 'translator@strike.me', sats: 500, mergeEventId: state.merge.event.id, createdAt: clock++ },
      { wallet, fetchJson: () => Promise.reject(new Error('off')), payerSeckey: maintainer.seckey, resolveInvoice },
    ).then((payout: any) => ({
      ok: true,
      actor: 'Donation pool → translator (Lightning, no custody)',
      paid_sats: payout.receipt.amountSat,
      to: payout.receipt.recipient,
      record_event_id: payout.record.id,
      note: 'Sats route donor-wallet → translator directly. A signed payout record makes it publicly auditable.',
    }))
  },
}

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>NeoArk · Translator merge + Bitcoin anchor</title>
<style>
*{box-sizing:border-box}body{background:#0a0a0a;color:#e6e6e6;font-family:ui-monospace,Menlo,monospace;margin:0;padding:2rem;line-height:1.6}
.wrap{max-width:900px;margin:0 auto}
h1{color:#6ee7ff;font-size:1.25rem}.sub{color:#8a949c;font-size:.85rem;margin:.3rem 0 1.5rem}
.steps{display:flex;flex-wrap:wrap;gap:.6rem;margin-bottom:1.5rem}
button{background:#121518;color:#e6e6e6;border:1px solid #1e2429;border-radius:8px;padding:.6rem 1rem;font-family:inherit;font-size:.85rem;cursor:pointer}
button:hover:not(:disabled){border-color:#6ee7ff;color:#6ee7ff}
button:disabled{opacity:.4;cursor:not-allowed}
button.go{border-color:#3aa6bd}
#log{background:#121518;border:1px solid #1e2429;border-radius:10px;padding:1.2rem;min-height:200px;white-space:pre-wrap;font-size:.85rem}
.actor{color:#6ee7ff;font-weight:bold}.k{color:#8a949c}.ok{color:#50fa7b}.warn{color:#f0ad4e}.err{color:#e06c75}
.reset{margin-left:auto;border-color:#3a2429}
</style></head><body><div class="wrap">
<h1>Translator merge + Bitcoin anchor</h1>
<div class="sub">A translator in Ghana fixes Genesis 1:6 ("expanse" → "firmament"). Click through the real flow — every step runs the actual <span class="actor">@neoark/translation-protocol</span> code and shows the real signed events.</div>
<div class="steps">
  <button class="go" onclick="call('/api/propose',this)">1 ✍️ Propose correction</button>
  <button onclick="call('/api/review',this)">2 ✓ Peer approves (×3)</button>
  <button onclick="call('/api/merge',this)">3 🔀 Maintainer merges</button>
  <button onclick="call('/api/anchor',this)">4 ⛓ Anchor to Bitcoin</button>
  <button onclick="call('/api/confirm',this)">5 ₿ Confirm in block</button>
  <button onclick="call('/api/pay',this)">6 ⚡ Pay translator</button>
  <button class="reset" onclick="location.reload()">reset</button>
</div>
<div id="log"><span class="k">Click "1 ✍️ Propose correction" to begin…</span></div>
</div>
<script>
const log = document.getElementById('log')
let first = true
async function call(url, btn){
  btn.disabled = true
  try {
    const r = await fetch(url, {method:'POST'})
    const d = await r.json()
    if(first){ log.innerHTML=''; first=false }
    const line = document.createElement('div')
    line.style.marginBottom='1rem'
    if(!d.ok){ line.innerHTML='<span class="err">✗ '+d.error+'</span>'; btn.disabled=false }
    else {
      let html = '<span class="actor">'+(d.actor||'')+'</span>\\n'
      for(const [k,v] of Object.entries(d)){
        if(k==='ok'||k==='actor') continue
        let val = typeof v==='object' ? JSON.stringify(v) : String(v)
        const cls = k==='quorum_met'? (v?'ok':'warn') : (k==='note'?'k':'')
        html += '  <span class="k">'+k.padEnd(16)+'</span> '+(cls?'<span class="'+cls+'">'+val+'</span>':val)+'\\n'
      }
      line.innerHTML = html
    }
    log.appendChild(line)
    log.scrollTop = log.scrollHeight
  } catch(e){ btn.disabled=false }
}
</script></body></html>`

createServer(async (req, res) => {
  if (req.method === 'POST' && handlers[req.url ?? '']) {
    try {
      json(res, await handlers[req.url as string]())
    } catch (e: any) {
      json(res, { ok: false, error: e.message })
    }
    return
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
  res.end(PAGE)
}).listen(4177, () => console.log('Translator-merge demo → http://localhost:4177'))
