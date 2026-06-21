// Minimal static server for local preview: `node serve.mjs` → http://localhost:4173
// SPDX-License-Identifier: AGPL-3.0
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const dir = dirname(fileURLToPath(import.meta.url))
const html = readFileSync(resolve(dir, 'index.html'))
const port = Number(process.env.PORT ?? 4173)
createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
  res.end(html)
}).listen(port, () => console.log(`NeoArk landing → http://localhost:${port}`))
