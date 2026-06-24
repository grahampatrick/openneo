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

  // Build cumulative time-series (sorted, deduped) for each metric.
  function build(events) {
    var seen = {}
    var props = [], merges = [], pays = [], govs = []
    for (var i = 0; i < events.length; i++) {
      var e = events[i]
      if (seen[e.id]) continue
      seen[e.id] = 1
      var t = e.created_at || 0
      if (e.kind === 30702 && belongsTo(e)) props.push({ t: t, dv: 1 })
      else if (e.kind === 30703 && tag(e, 'ark_action') === 'merge') merges.push({ t: t, dv: 1 })
      else if (e.kind === 30712 && tag(e, 'ark_action') === 'payout') pays.push({ t: t, dv: Number(tag(e, 'amount_sat') || '0') || 0 })
      else if (e.kind === 30750 && belongsTo(e)) {
        var n = 0
        for (var j = 0; j < e.tags.length; j++) if (e.tags[j][0] === 'maintainer') n++
        govs.push({ t: t, v: n })
      }
    }
    return { proposals: cumulative(props), merges: cumulative(merges), sats: cumulative(pays), council: step(govs) }
  }
  function cumulative(pts) {
    pts.sort(function (a, b) { return a.t - b.t })
    var out = [], acc = 0
    for (var i = 0; i < pts.length; i++) { acc += pts[i].dv; out.push({ t: pts[i].t, v: acc }) }
    return out
  }
  function step(govs) {
    govs.sort(function (a, b) { return a.t - b.t })
    return govs
  }
  function fmtDate(t) {
    return new Date(t * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }
  var commas = function (x) { return x.toLocaleString() }

  // Draw an interactive area sparkline; set the total; wire a hover tooltip.
  function chart(svgId, numId, tipId, series) {
    var svg = document.getElementById(svgId)
    var numEl = document.getElementById(numId)
    var tip = document.getElementById(tipId)
    var total = series.length ? series[series.length - 1].v : 0
    if (numEl) numEl.textContent = commas(total)
    if (!svg) return
    var W = 280, H = 56, P = 6, ns = 'http://www.w3.org/2000/svg'
    while (svg.firstChild) svg.removeChild(svg.firstChild)
    if (series.length === 0) {
      var base = document.createElementNS(ns, 'line')
      base.setAttribute('x1', P); base.setAttribute('y1', H - P); base.setAttribute('x2', W - P); base.setAttribute('y2', H - P)
      base.style.stroke = 'var(--border)'; base.style.strokeWidth = '1.5'
      svg.appendChild(base); return
    }
    var minT = series[0].t, maxT = series[series.length - 1].t, spanT = (maxT - minT) || 1
    var maxV = 0; for (var i = 0; i < series.length; i++) if (series[i].v > maxV) maxV = series[i].v
    if (maxV === 0) maxV = 1
    var X = function (t) { return P + ((t - minT) / spanT) * (W - 2 * P) }
    var Y = function (v) { return H - P - (v / maxV) * (H - 2 * P) }
    var pts = series.map(function (s) { return [X(s.t), Y(s.v)] })
    var prepended = false
    if (pts.length === 1) { pts = [[P, Y(0)], pts[0]]; prepended = true } // single point → rising line
    var d = 'M' + pts.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1) }).join(' L')
    var area = document.createElementNS(ns, 'path')
    area.setAttribute('d', d + ' L' + pts[pts.length - 1][0].toFixed(1) + ' ' + (H - P) + ' L' + pts[0][0].toFixed(1) + ' ' + (H - P) + ' Z')
    area.style.fill = 'var(--accent)'; area.style.opacity = '0.14'
    var line = document.createElementNS(ns, 'path')
    line.setAttribute('d', d); line.style.fill = 'none'; line.style.stroke = 'var(--accent)'; line.style.strokeWidth = '2'
    svg.appendChild(area); svg.appendChild(line)
    var dot = document.createElementNS(ns, 'circle')
    dot.setAttribute('r', '3.2'); dot.style.fill = 'var(--accent)'; dot.style.opacity = '0'
    svg.appendChild(dot)
    svg.addEventListener('mousemove', function (ev) {
      var rect = svg.getBoundingClientRect()
      var vx = ((ev.clientX - rect.left) / rect.width) * W
      var best = 0, bd = 1e9
      for (var i = 0; i < pts.length; i++) { var dd = Math.abs(pts[i][0] - vx); if (dd < bd) { bd = dd; best = i } }
      dot.setAttribute('cx', pts[best][0]); dot.setAttribute('cy', pts[best][1]); dot.style.opacity = '1'
      var si = prepended ? 0 : best
      var s = series[si]
      if (tip) {
        tip.textContent = fmtDate(s.t) + ' · ' + commas(s.v)
        tip.style.left = (pts[best][0] / W) * 100 + '%'
        tip.style.opacity = '1'
      }
    })
    svg.addEventListener('mouseleave', function () { dot.style.opacity = '0'; if (tip) tip.style.opacity = '0' })
  }

  function run() {
    Promise.all(
      RELAYS.map(function (u) {
        return queryRelay(u, 6000)
      }),
    ).then(function (lists) {
      var all = []
      for (var i = 0; i < lists.length; i++) all = all.concat(lists[i])
      var s = build(all)
      chart('chart-proposals', 'stat-proposals', 'tip-proposals', s.proposals)
      chart('chart-merges', 'stat-merges', 'tip-merges', s.merges)
      chart('chart-sats', 'stat-sats', 'tip-sats', s.sats)
      chart('chart-council', 'stat-maintainers', 'tip-council', s.council)
    })
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run)
  else run()
})()
