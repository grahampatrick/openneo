/// <reference lib="webworker" />
/**
 * Service worker — cache the app shell + corpus so the reader works offline.
 * Cache-first for built assets and the corpus; network falls back to cache.
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { build, files, version } from '$service-worker'

const sw = self as unknown as ServiceWorkerGlobalScope
const CACHE = `neoark-${version}`
const PRECACHE = [...build, ...files]

sw.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => sw.skipWaiting()))
})

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => sw.clients.claim()),
  )
})

sw.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request)
      if (cached) return cached
      try {
        const response = await fetch(request)
        if (response.ok && new URL(request.url).origin === location.origin) {
          cache.put(request, response.clone())
        }
        return response
      } catch (err) {
        const fallback = await cache.match(request)
        if (fallback) return fallback
        throw err
      }
    }),
  )
})
