/**
 * @neoark/reader — terminal reader for NeoOS. Read scripture, pay translators
 * via Lightning, publish use-proofs.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
export { Corpus, loadCorpus, parseVersesJsonl } from './corpus'
export { parseReference, formatReference } from './reference'
export { renderChapter, statusBar } from './render'
export type { RenderOptions, StatusBarState } from './render'
export { ReaderSession } from './session'
export type { ReaderSessionOptions, ReadOutcome } from './session'
export { readPassage, proofsForPassage, translatorStats } from './commands'
export type { TranslatorStats } from './commands'
export { MemorySecretStore, FileSecretStore, NWC_KEY } from './secret-store'
export type { SecretStore } from './secret-store'
export { dataDir, DEFAULT_TRANSLATION, DEFAULT_BUDGET_SATS } from './config'
export type { Verse, BookMeta, Reference } from './types'
