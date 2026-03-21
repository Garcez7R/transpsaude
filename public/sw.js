const CACHE_NAME = 'transpsaude-v3'
const STATIC_ASSETS = ['/manifest.webmanifest', '/favicon.png', '/pwa-192.png', '/pwa-512.png']

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      ),
    ]),
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return
  }

  const url = new URL(event.request.url)
  const isSameOrigin = url.origin === self.location.origin
  const isNavigation = event.request.mode === 'navigate'
  const isStaticAsset = isSameOrigin && STATIC_ASSETS.includes(url.pathname)

  if (isNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const responseClone = response.clone()

          caches.open(CACHE_NAME).then((cache) => {
            cache.put('/', responseClone)
          })

          return response
        })
        .catch(async () => {
          const cachedResponse = await caches.match('/')
          return cachedResponse || Response.error()
        }),
    )
    return
  }

  if (isStaticAsset) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse
        }

        return fetch(event.request).then((response) => {
          const responseClone = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone)
          })
          return response
        })
      }),
    )
    return
  }

  if (isSameOrigin) {
    event.respondWith(
      fetch(event.request)
        .then((response) => response)
        .catch(() => caches.match(event.request)),
    )
  }
})
