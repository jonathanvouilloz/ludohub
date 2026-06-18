/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

// Service worker « installable only » : on ne met en cache QUE les assets statiques
// (build JS/CSS + fichiers de `static/` : icônes, manifest, favicon). Les pages et les
// requêtes /api restent TOUJOURS network-first → aucune donnée périmée ni fuite entre
// tenants (l'app est multi-tenant SSR + auth par cookie de session).
//
// SvelteKit enregistre ce fichier automatiquement (actif en build/preview, pas en dev).

import { build, files, version } from '$service-worker'

const sw = self as unknown as ServiceWorkerGlobalScope

const CACHE = `ludohub-static-${version}`

// Assets immuables versionnés (build) + assets statiques (icônes, manifest, favicon).
const PRECACHE = [...build, ...files]

sw.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => sw.skipWaiting()),
  )
})

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => sw.clients.claim()),
  )
})

sw.addEventListener('fetch', (event) => {
  const { request } = event

  // Jamais de cache pour autre chose que GET, la navigation de pages, ou /api.
  if (request.method !== 'GET' || request.mode === 'navigate') return

  const url = new URL(request.url)
  if (url.origin !== location.origin) return
  if (url.pathname.startsWith('/api/')) return

  // Cache-first uniquement pour les assets statiques connus (build + files).
  const isStaticAsset = PRECACHE.includes(url.pathname)
  if (!isStaticAsset) return

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request)
      if (cached) return cached
      const response = await fetch(request)
      if (response.ok) cache.put(request, response.clone())
      return response
    }),
  )
})
