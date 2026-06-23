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
    // Title and brand must be OpenNeo; Odysseus appears only as AGPL attribution
    // (the SPDX header comment + the footer credit), never as branding.
    expect(html).not.toContain('<title>Odysseus')
    expect(html).not.toMatch(/class="brand"[^>]*>[^<]*Odysseus/)
    for (const mention of html.match(/.{0,40}Odysseus.{0,40}/g) ?? []) {
      expect(mention).toMatch(/reskinned|AGPL/)
    }
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

  it('has a donation section with a Lightning address and QR', () => {
    expect(html).toContain('donate@neoark.org')
    expect(html).toContain('Lightning address')
    expect(html).toMatch(/<svg[^>]*viewBox="0 0 29 29"/) // QR placeholder
  })

  it('uses the dark terminal palette', () => {
    expect(html).toContain('#0a0a0a')
    expect(html).toContain('#e6e6e6')
    expect(html).toContain('#6ee7ff')
  })

  it('states the licenses and BSB attribution', () => {
    expect(html).toContain('AGPL-3.0')
    expect(html).toContain('CC-BY-SA 4.0')
    expect(html).toContain('Berean Standard Bible')
  })
})
