/**
 * Theme (cream / dark) shared with the reader + landing via the same
 * localStorage key, so a visitor's choice carries across openneo.org.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { writable, type Writable } from 'svelte/store'

export type Theme = 'cream' | 'dark'
const KEY = 'neoos.theme'

/** Resolve the startup theme: a stored choice, else the OS preference, else cream. */
export function initialTheme(): Theme {
  if (typeof localStorage !== 'undefined') {
    const t = localStorage.getItem(KEY)
    if (t === 'cream' || t === 'dark') return t
  }
  if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
  return 'cream'
}

export const theme: Writable<Theme> = writable(initialTheme())

export function applyTheme(t: Theme): void {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', t)
  if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, t)
}
