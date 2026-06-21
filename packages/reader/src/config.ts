/**
 * Reader configuration — where the corpus lives.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))

/** Repo data dir, overridable with NEOARK_DATA (for a published/installed CLI). */
export function dataDir(env: NodeJS.ProcessEnv = process.env): string {
  return env.NEOARK_DATA ?? resolve(here, '..', '..', '..', 'data', 'neoos')
}

export const DEFAULT_TRANSLATION = 'neoos-en-2026'
export const DEFAULT_BUDGET_SATS = 1000
