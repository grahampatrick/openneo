import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const html = readFileSync(resolve(__dirname, '..', 'index.html'), 'utf8')

describe('OpenNeo landing content', () => {
  it('carries the OpenNeo brand, not Odysseus or NeoArk', () => {
    expect(html).toContain('<title>OpenNeo')
    expect(html).toContain('Open<b>Neo</b>') // nav brand
    expect(html).not.toMatch(/Neo<b>Ark<\/b>/)
    expect(html).not.toContain('The Ark holds') // ark copy removed
    expect(html).not.toContain('<title>Odysseus')
    expect(html).not.toMatch(/class="brand"[^>]*>[^<]*Odysseus/)
  })

  it('has no "reskin" wording, but keeps AGPL attribution in the source (compliance)', () => {
    const visible = html.replace(/<!--[\s\S]*?-->/g, '') // strip HTML comments (source-only)
    expect(visible).not.toMatch(/reskin/i) // no reskinning wording anywhere on the page
    expect(visible).not.toContain('Odysseus') // no visible Odysseus credit
    // The required AGPL attribution lives in the source header comment, not the page.
    expect(html).toMatch(/Odysseus[\s\S]{0,80}AGPL-3\.0/) // credit + license preserved in source
  })

  it('links to the live reader and translator', () => {
    expect(html).toContain('href="/read"')
    expect(html).toContain('href="/translate"')
  })

  it('defines NeoOS (Neo Ontology Scripture, open source)', () => {
    expect(html).toContain('Neo Ontology Scripture')
    expect(html.toLowerCase()).toContain('open source')
  })

  it('lists features that are actually built', () => {
    for (const f of [
      'Read NeoOS — 85 books',
      'Propose, review, merge + Bitcoin anchor',
      'Translators paid in Lightning',
      'Council governance',
      'Open &amp; verifiable',
    ]) {
      expect(html).toContain(f)
    }
  })

  it('does not claim unbuilt features', () => {
    expect(html).not.toContain('Reading plans') // not built
    expect(html).not.toMatch(/Compare NeoOS, KJV/) // no KJV/BSB parallel data
    expect(html).not.toContain('npx @neoark/reader read') // not published to npm
  })

  it('has a donation section with the real Bitcoin address + QR (no placeholder)', () => {
    expect(html).toContain('bc1qj2qfrzfp27na8q2s0mz603z2a9zak9aclnrejt')
    expect(html).not.toContain('donate@neoark.org') // old placeholder removed
    expect(html).toContain('Bitcoin address')
    expect(html).toMatch(/<svg[^>]*viewBox="0 0 35 35"/) // real generated QR, not the 29x29 placeholder
  })

  it('has both reader themes (cream + dark) and a theme toggle', () => {
    expect(html).toContain('[data-theme="cream"]')
    expect(html).toContain('[data-theme="dark"]')
    expect(html).toContain('#f4ecd6') // cream bg (matches the reader)
    expect(html).toContain('#1a1a1a') // dark bg (matches the reader)
    expect(html).toContain('toggleTheme')
  })

  it('uses the reader serif for the brand + headings', () => {
    expect(html).toContain('--serif')
    expect(html).toContain('Iowan Old Style')
  })

  it('states the licenses and BSB attribution', () => {
    expect(html).toContain('AGPL-3.0')
    expect(html).toContain('CC-BY-SA 4.0')
    expect(html).toContain('Berean Standard Bible')
  })
})
