/**
 * NeoOS importer — shared configuration and constants.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** Repo root (…/code). */
export const REPO_ROOT = resolve(__dirname, '..', '..', '..')

/** Where input data + emitted corpus live. */
export const DATA_DIR = resolve(REPO_ROOT, 'data', 'neoos')

/** Cached raw source downloads (USFM / txt / json). */
export const RAW_DIR = resolve(__dirname, '..', 'sources', 'raw')

export const NAMING_MAP_PATH = resolve(DATA_DIR, 'naming-map.json')
export const BOOK_ORDER_PATH = resolve(DATA_DIR, 'book-order.json')
export const ACCURACY_PATH = resolve(DATA_DIR, 'accuracy-corrections.json')

export const VERSES_OUT = resolve(DATA_DIR, 'verses.jsonl')
export const MANIFEST_OUT = resolve(DATA_DIR, 'translation-manifest.json')

/** ARK / Nostr event kinds (see neoark-build-prompt.md). */
export const KIND_VERSE = 30700
export const KIND_MANIFEST = 30701

/** Stable translation identifier — matches AVM-1 pattern `[a-z0-9]+-[a-z]{2,3}-[0-9]{4}`. */
export const TRANSLATION_ID = 'neoos-en-2026'

export const TRANSLATION_NAME = 'NeoOS — The Open Standard Version'
export const TEXT_LICENSE = 'CC-BY-SA-4.0'
export const LANG = 'eng'

/**
 * Deterministic timestamp for all emitted events. Using a fixed instant keeps
 * Nostr event ids — and therefore the whole verses.jsonl — byte-reproducible
 * across runs. `Date.now()` would make the corpus non-deterministic.
 * 2026-06-17T00:00:00Z (the plan's working date).
 */
export const CREATED_AT = 1781481600

/**
 * BSB attribution string required in every distribution (CC-BY 4.0 / PD
 * dedication). See docs/legal/SOURCES.md.
 */
export const BSB_ATTRIBUTION =
  'Based on the Berean Standard Bible (BSB), berean.bible — dedicated to the public domain.'
