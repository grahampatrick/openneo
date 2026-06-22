#!/usr/bin/env node
/**
 * Probe the deployed site's endpoints. Exits non-zero if any check fails.
 *   node scripts/healthcheck.mjs https://openneo.org
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
const base = (process.argv[2] ?? 'https://openneo.org').replace(/\/$/, '')

const checks = [
  { path: '/health.json', expect: (r) => r.ok },
  { path: '/', expect: (r) => r.ok },
  { path: '/read/', expect: (r) => r.ok },
  { path: '/translate/', expect: (r) => r.ok },
]

let failed = 0
for (const c of checks) {
  const url = base + c.path
  try {
    const res = await fetch(url, { redirect: 'follow' })
    const ok = c.expect(res)
    console.log(`  ${ok ? '✓' : '✗'} ${url} → ${String(res.status)}`)
    if (!ok) failed++
  } catch (e) {
    console.log(`  ✗ ${url} → ${e instanceof Error ? e.message : String(e)}`)
    failed++
  }
}

if (failed > 0) {
  console.error(`\n${String(failed)} health check(s) failed`)
  process.exit(1)
}
console.log('\nAll health checks passed.')
