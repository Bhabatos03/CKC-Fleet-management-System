// CKC Fleet Service Worker - offline shell + queue for OUT/IN/Fuel
const CACHE = 'ckc-fleet-v2' // bump this on every deploy to force cache cleanup
const APP_SHELL = ['/', '/manifest.json', '/ckc-logo.png', '/ckc-logo-pdf.png']

self.addEventListener('install', (e) => {
  self.skipWaiting()
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP_SHELL).catch(() => {})))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)

  // Network-first for navigation requests (the HTML page itself)
  // This is the key fix: normal refresh now always tries the network first,
  // so a new deploy shows up without needing a hard refresh.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const clone = res.clone()
          caches.open(CACHE).then((c) => c.put(e.request, clone)).catch(() => {})
          return res
        })
        .catch(() => caches.match(e.request).then((r) => r || caches.match('/')))
    )
    return
  }

  // Cache-first for same-origin static assets (JS/CSS/images/app shell)
  if (e.request.method === 'GET' && url.origin === location.origin && !url.pathname.startsWith('/api/')) {
    e.respondWith(
      caches.match(e.request).then((r) => r || fetch(e.request).then((res) => {
        const clone = res.clone()
        caches.open(CACHE).then((c) => c.put(e.request, clone)).catch(() => {})
        return res
      }).catch(() => caches.match('/')))
    )
    return
  }

  // Network-first for API GETs (with cache fallback for read-only endpoints)
  if (e.request.method === 'GET' && url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request).then((res) => {
        const clone = res.clone()
        caches.open(CACHE).then((c) => c.put(e.request, clone)).catch(() => {})
        return res
      }).catch(() => caches.match(e.request))
    )
  }
})
