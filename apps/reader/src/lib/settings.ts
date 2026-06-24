/**
 * Reading settings — theme, text size, verse-number visibility. Persisted to
 * localStorage and applied to the document root (no account, local-only).
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { writable, type Writable } from 'svelte/store'

export type Theme = 'auto' | 'cream' | 'dark'
export type TextSize = 'sm' | 'md' | 'lg'

export interface Settings {
  theme: Theme
  size: TextSize
  verseNumbers: boolean
}

const KEY = 'neoos.reader.settings'
const DEFAULTS: Settings = { theme: 'auto', size: 'md', verseNumbers: true }

function load(): Settings {
  if (typeof localStorage === 'undefined') return DEFAULTS
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>) }
  } catch {
    return DEFAULTS
  }
}

export const settings: Writable<Settings> = writable(load())

/** Resolve 'auto' against the OS preference. */
export function resolveTheme(theme: Theme): 'cream' | 'dark' {
  if (theme !== 'auto') return theme
  if (typeof matchMedia === 'undefined') return 'cream'
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'cream'
}

/** Persist + apply settings to <html> (data-theme / data-size). Call in the browser. */
export function applySettings(s: Settings): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.setAttribute('data-theme', resolveTheme(s.theme))
  root.setAttribute('data-size', s.size)
  if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(s))
}
