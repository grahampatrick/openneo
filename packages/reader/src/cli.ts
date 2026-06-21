#!/usr/bin/env -S npx tsx
/**
 * NeoArk Reader CLI.
 *
 *   neoark-reader read --translation neoos-en-2026 --no-pay [--passage "GEN 1"]
 *   neoark-reader proofs --passage "Bere'shiyth 1:6" [--relay wss://…]
 *   neoark-reader translator-stats --pubkey <hex> [--relay wss://…]
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { parseArgs } from 'node:util'
import { loadCorpus } from './corpus'
import { readPassage, proofsForPassage, translatorStats } from './commands'
import { RelayPool, WebSocketRelay, DEFAULT_RELAYS } from '@neoark/relay'
import type { WebSocketFactory } from '@neoark/relay'
import { DEFAULT_TRANSLATION } from './config'

function makePool(relayArg?: string): RelayPool {
  const urls = relayArg ? [relayArg] : [...DEFAULT_RELAYS]
  const factory = globalThis.WebSocket as unknown as WebSocketFactory
  return new RelayPool(urls.map((u) => new WebSocketRelay(u, factory)))
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2)
  const { values } = parseArgs({
    args: rest,
    options: {
      translation: { type: 'string', default: DEFAULT_TRANSLATION },
      passage: { type: 'string' },
      pubkey: { type: 'string' },
      relay: { type: 'string' },
      width: { type: 'string', default: '80' },
      'no-pay': { type: 'boolean', default: false },
      budget: { type: 'string', default: '1000' },
    },
    allowPositionals: true,
  })

  const width = Number(values.width)

  if (command === 'read') {
    const corpus = loadCorpus()
    console.log(readPassage(corpus, values.passage ?? 'GEN 1', width))
    if (!values['no-pay']) console.log('\n(paying disabled in this build of the CLI demo; use --no-pay)')
    return
  }

  if (command === 'proofs') {
    if (!values.passage) throw new Error('proofs requires --passage')
    const corpus = loadCorpus()
    const pool = makePool(values.relay)
    const { text } = await proofsForPassage(corpus, pool, values.passage, values.translation)
    console.log(text)
    pool.close()
    return
  }

  if (command === 'translator-stats') {
    if (!values.pubkey) throw new Error('translator-stats requires --pubkey')
    const pool = makePool(values.relay)
    const { text } = await translatorStats(pool, values.translation, { pubkey: values.pubkey })
    console.log(text)
    pool.close()
    return
  }

  console.error('Usage: neoark-reader <read|proofs|translator-stats> [options]')
  process.exit(command ? 1 : 0)
}

await main()
