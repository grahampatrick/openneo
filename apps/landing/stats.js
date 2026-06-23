/**
 * Live network stats widget — queries public Nostr relays directly from the
 * browser and renders verifiable counts. No backend: every number comes from
 * public signed events, and anyone can recount them.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
(function () {
  var RELAYS = ['wss://relay.openneo.org', 'wss://nos.lol', 'wss://relay.damus.io', 'wss://relay.snort.social']
  var TID = 'neoos-en-2026'
  var KINDS = [30702, 30703, 30712, 30750]

  function queryRelay(url, timeoutMs) {
    return new Promise(function (resolve) {
      var events = []
      var ws
      try {
        ws = new WebSocket(url)
      } catch (e) {
        return resolve(events)
      }
      var sub = 's' + Math.random().toString(36).slice(2)
      var settled = false
      function done() {
        if (settled) return
        settled = true
        try {
          ws.close()
        } catch (e) {}
        resolve(events)
      }
      var timer = setTimeout(done, timeoutMs)
      ws.onopen = function () {
        ws.send(JSON.stringify(['REQ', sub, { kinds: KINDS, limit: 2000 }]))
      }
      ws.onmessage = function (m) {
        try {
          var d = JSON.parse(m.data)
          if (d[0] === 'EVENT' && d[1] === sub) events.push(d[2])
          else if (d[0] === 'EOSE') {
            clearTimeout(timer)
            done()
          }
        } catch (e) {}
      }
      ws.onerror = function () {
        clearTimeout(timer)
        done()
      }
    })
  }

  function tag(e, name) {
    for (var i = 0; i < e.tags.length; i++) if (e.tags[i][0] === name) return e.tags[i][1]
    return undefined
  }
  function belongsTo(e) {
    for (var i = 0; i < e.tags.length; i++) if (e.tags[i][1] === TID) return true
    return false
  }

  function summarize(events) {
    var seen = {}
    var proposals = 0,
      merges = 0,
      payouts = 0,
      satsPaid = 0,
      maintainers = 0
    for (var i = 0; i < events.length; i++) {
      var e = events[i]
      if (seen[e.id]) continue
      seen[e.id] = 1
      if (e.kind === 30702 && belongsTo(e)) proposals++
      else if (e.kind === 30703 && tag(e, 'ark_action') === 'merge') merges++
      else if (e.kind === 30712 && tag(e, 'ark_action') === 'payout') {
        payouts++
        satsPaid += Number(tag(e, 'amount_sat') || '0') || 0
      } else if (e.kind === 30750 && belongsTo(e)) {
        var n = 0
        for (var j = 0; j < e.tags.length; j++) if (e.tags[j][0] === 'maintainer') n++
        if (n > maintainers) maintainers = n
      }
    }
    return { proposals: proposals, merges: merges, payouts: payouts, satsPaid: satsPaid, maintainers: maintainers }
  }

  function render(s) {
    var el = function (id) {
      return document.getElementById(id)
    }
    if (el('stat-proposals')) el('stat-proposals').textContent = String(s.proposals)
    if (el('stat-merges')) el('stat-merges').textContent = String(s.merges)
    if (el('stat-sats')) el('stat-sats').textContent = s.satsPaid.toLocaleString()
    if (el('stat-maintainers')) el('stat-maintainers').textContent = String(s.maintainers)
  }

  function run() {
    Promise.all(
      RELAYS.map(function (u) {
        return queryRelay(u, 6000)
      }),
    ).then(function (lists) {
      var all = []
      for (var i = 0; i < lists.length; i++) all = all.concat(lists[i])
      render(summarize(all))
    })
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run)
  else run()
})()
