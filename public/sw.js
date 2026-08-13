const CACHE_NAME = 'txunos-v1'

const PRECACHE_ASSETS = [
  '/',
  '/favicon.png',
  '/icon.png',
  '/logo.png',
  '/banner.png',
  '/manifest.webmanifest'
]

// Install: precache essential shell assets and activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS)
    }).then(() => {
      return self.skipWaiting()
    })
  )
})

// Activate: clean up outdated caches and take control of all clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName)
          }
        })
      )
    }).then(() => {
      return self.clients.claim()
    })
  )
})

// Fetch strategy
self.addEventListener('fetch', (event) => {
  const request = event.request

  // Only cache GET requests
  if (request.method !== 'GET') {
    return
  }

  const url = new URL(request.url)

  // 1. Navigation requests (HTML pages): Network-first with offline cache fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache)
            })
          }
          return response
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request)
          if (cachedResponse) {
            return cachedResponse
          }
          return caches.match('/')
        })
    )
    return
  }

  // 2. Same-origin static assets or CDN fonts: Stale-While-Revalidate
  const isSameOrigin = url.origin === self.location.origin
  const isStaticAsset = isSameOrigin && (
    url.pathname.startsWith('/_nuxt/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.json')
  )
  const isFontCdn = url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')

  if (isStaticAsset || isFontCdn) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone()
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseToCache)
              })
            }
            return networkResponse
          })
          .catch(() => {
            // Network failure: return cachedResponse if available
            return cachedResponse
          })

        return cachedResponse || fetchPromise
      })
    )
  }
})
