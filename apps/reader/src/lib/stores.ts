/**
 * App stores: current reference, community-notes toggle, online status.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { writable, type Writable } from 'svelte/store'
import type { Reference } from './reference'

export const currentRef: Writable<Reference> = writable({ bookId: 'GEN', chapter: 1 })
export const showNotes: Writable<boolean> = writable(false)
export const showParallel: Writable<boolean> = writable(false)
export const online: Writable<boolean> = writable(true)

/** Wire the online store to the browser's connectivity events. */
export function trackConnectivity(): () => void {
  if (typeof window === 'undefined') return () => undefined
  const set = () => online.set(navigator.onLine)
  set()
  window.addEventListener('online', set)
  window.addEventListener('offline', set)
  return () => {
    window.removeEventListener('online', set)
    window.removeEventListener('offline', set)
  }
}
