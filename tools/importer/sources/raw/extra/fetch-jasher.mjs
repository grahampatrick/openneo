#!/usr/bin/env node
// Fetch the Book of Jasher (Sefer ha-Yashar, 1840 Moses Samuel translation) from
// Wikisource — clean, hand-transcribed, with explicit wst-verse markup. Caches
// each chapter's HTML so re-parses don't re-hit the rate limit. PD (1840).
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'

const base = 'https://en.wikisource.org/w/api.php?action=parse&prop=text&format=json&disablelimitreport=1&page='
const pagePrefix = 'Sefer Ha-yashar, or, the Book of Jasher (1840)/Chapter '
const UA = 'NeoArk-importer/1.0 (openneo.org; public-domain text)'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
mkdirSync('jasher-cache', { recursive: true })

const decode = (s) =>
  s
    .replace(/<sup[\s\S]*?<\/sup>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&#8203;|&#160;|&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#39;|&#8217;|&rsquo;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/^[>\s"']+/, '') // drop the span tag-close artifact
    .replace(/\s+/g, ' ')
    .trim()

async function getHtml(ch) {
  const cache = `jasher-cache/ch${ch}.html`
  if (existsSync(cache)) return readFileSync(cache, 'utf8')
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const res = await fetch(base + encodeURIComponent(pagePrefix + ch), { headers: { 'User-Agent': UA } })
      if (res.status === 429) {
        await sleep(15000)
        continue
      }
      if (res.ok) {
        const html = (await res.json()).parse?.text?.['*']
        if (html) {
          writeFileSync(cache, html)
          await sleep(2500)
          return html
        }
      }
    } catch {
      /* retry */
    }
    await sleep(3000 * (attempt + 1))
  }
  throw new Error(`ch ${ch}: FETCH FAILED`)
}

const out = ['\\id JSR', '\\h Jasher']
let totalVerses = 0
const empties = []

for (let ch = 1; ch <= 91; ch++) {
  const html = await getHtml(ch)
  out.push(`\\c ${ch}`)
  // Verse markers: wst-verse spans with id="C:V" OR id="V". Split on the opening
  // span; each fragment's text runs to the next span. Capture the trailing number.
  const parts = html.split(/<span class="wst-verse[^"]*"\s+id="(?:\d+:)?(\d+)"[^>]*>/)
  let count = 0
  for (let i = 1; i < parts.length; i += 2) {
    const v = Number(parts[i])
    const text = decode(parts[i + 1] ?? '')
    if (text) {
      out.push(`\\v ${v} ${text}`)
      count++
      totalVerses++
    }
  }
  if (count === 0) empties.push(ch)
  console.error(`  ch ${ch}: ${count} verses`)
}

writeFileSync('JSR.usfm', out.join('\n') + '\n')
console.log(`Jasher: 91 chapters, ${totalVerses} verses → JSR.usfm`)
if (empties.length) console.log('EMPTY chapters:', empties.join(', '))
