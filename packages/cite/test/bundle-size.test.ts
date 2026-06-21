// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { build } from 'esbuild'
import { gzipSync } from 'node:zlib'
import { resolve } from 'node:path'

describe('CDN bundle size', () => {
  it('cite.min.js (browser entry) is under 5KB', async () => {
    const result = await build({
      entryPoints: [resolve(__dirname, '..', 'src', 'browser.ts')],
      bundle: true,
      minify: true,
      format: 'iife',
      globalName: 'NeoArkCite',
      write: false,
    })
    const out = result.outputFiles[0]!
    const raw = out.contents.length
    const gzipped = gzipSync(out.contents).length
    expect(raw).toBeLessThan(5 * 1024)
    expect(gzipped).toBeLessThan(5 * 1024)
  })
})
