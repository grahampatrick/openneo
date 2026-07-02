import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const html = readFileSync(resolve(__dirname, '..', 'index.html'), 'utf8')
const brand = readFileSync(resolve(__dirname, '..', 'brand.html'), 'utf8')

describe('OpenNeo landing content', () => {
  it('carries the OpenNeo brand, not Odysseus or NeoArk', () => {
    expect(html).toContain('<title>OpenNeo')
    expect(html).toContain('class="brand"') // nav brand wordmark
    expect(html).toMatch(/>Open<svg class="nmark"[\s\S]*?<\/svg>eo</) // Open + N lettermark + eo
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

  it('shows the four pastel pillars', () => {
    for (const label of ['Content-', 'Bitcoin-', 'Lightning-', 'verifiable']) {
      expect(html).toContain(label)
    }
    expect(html).toContain('class="pillars"')
  })

  it('has an "Explore the OpenNeo stack" tools grid of real shipped tools', () => {
    expect(html).toContain('Explore the OpenNeo stack')
    for (const tool of [
      'OpenNeo Reader',
      'Translator Portal',
      'Cite SDK',
      'Relay Protocol',
      'Payout Runner',
      'Crypto Core',
    ]) {
      expect(html).toContain(tool)
    }
    // every tool card points at a live route or the real repo (no vaporware links)
    expect(html).not.toMatch(/href="\/(cli|sdk|coming-soon)"/)
  })

  it('has an original N lettermark and links to the brand page', () => {
    expect(html).toContain('class="nmark"')
    expect(html).toContain('<title>N</title>')
    expect(html).toContain('href="/brand.html"')
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

  it('uses Space Grotesk for display headings, keeps the serif available', () => {
    expect(html).toContain('--display')
    expect(html).toContain('Space Grotesk')
    expect(html).toMatch(/h1, h2, h3 \{ font-family: var\(--display\)/)
    // serif token retained (reading samples / chart numerals)
    expect(html).toContain('--serif')
    expect(html).toContain('Iowan Old Style')
  })

  it('renders the live-network metrics as charts (not just numbers)', () => {
    for (const id of ['chart-proposals', 'chart-merges', 'chart-sats', 'chart-council']) {
      expect(html).toContain(`id="${id}"`)
    }
    expect(html).toContain('hover any chart')
  })

  it('states the licenses and BSB attribution', () => {
    expect(html).toContain('AGPL-3.0')
    expect(html).toContain('CC-BY-SA 4.0')
    expect(html).toContain('Berean Standard Bible')
  })
})

describe('OpenNeo brand page', () => {
  it('documents logo, colour, and typography with original assets', () => {
    expect(brand).toContain('<title>OpenNeo — Brand</title>')
    expect(brand).toContain('The OpenNeo brand')
    expect(brand).toContain('class="nmark"') // the N lettermark on the page
    expect(brand).toContain('#F5DFA0') // pillar palette documented
    expect(brand).toContain('Space Grotesk')
    // brand assets are declared original (no third-party marks reproduced)
    expect(brand).toContain('original')
    expect(brand).not.toMatch(/Aleo|Leo/)
  })

  it('shares the cream + dark theme system', () => {
    expect(brand).toContain('[data-theme="cream"]')
    expect(brand).toContain('[data-theme="dark"]')
    expect(brand).toContain('toggleTheme')
  })
})
