#!/usr/bin/env node
/**
 * Assemble the full openneo.org static site from the three apps:
 *   landing    → /            (apps/landing/dist)
 *   reader PWA → /read        (apps/reader/build)
 *   translator → /translate   (apps/translator/build)
 *
 * Output: ./site  (upload to Cloudflare Pages / Vercel / Netlify / any static host).
 * Run the per-app builds first (or use `pnpm run build:site` which chains them).
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { cpSync, rmSync, mkdirSync, existsSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = resolve(root, 'site')

const parts = [
  { name: 'landing', from: 'apps/landing/dist', to: '.' },
  { name: 'reader', from: 'apps/reader/build', to: 'read' },
  { name: 'translator', from: 'apps/translator/build', to: 'translate' },
]

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })

let ok = 0
for (const p of parts) {
  const src = resolve(root, p.from)
  if (!existsSync(src)) {
    console.warn(`  ⚠ ${p.name}: ${p.from} missing — run its build first (skipping)`)
    continue
  }
  const dest = p.to === '.' ? out : resolve(out, p.to)
  mkdirSync(dest, { recursive: true })
  cpSync(src, dest, { recursive: true })
  console.log(`  ✓ ${p.name} → site/${p.to === '.' ? '' : p.to}`)
  ok++
}

// A tiny health endpoint static hosts can probe.
writeFileSync(resolve(out, 'health.json'), JSON.stringify({ status: 'ok', site: 'openneo.org' }) + '\n')

console.log(`\nAssembled ${String(ok)}/${String(parts.length)} apps into ./site`)
if (ok < parts.length) process.exitCode = 1
