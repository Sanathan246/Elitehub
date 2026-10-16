/* EliteHub service worker: network first, cached copy when offline.
   Online visitors always get the latest files; offline visitors see the last
   version of each page they opened, or a short offline notice. */
const CACHE = 'elitehub-v2';
const CORE = ['./', 'index.html', 'shop.html', 'manifest.webmanifest', 'css/style.css', 'js/config.js', 'js/mockups.js', 'js/products.js', 'js/app.js', 'js/home.js', 'js/shop.js', 'js/pwa.js', 'assets/favicon.png', 'assets/pwa-icon-192.png', 'assets/pwa-icon-512.png', 'assets/apple-touch-icon.png', 'assets/logo-monogram.png', 'assets/logo-wordmark.png'];

// Redirected responses can't be replayed for page loads (clean URLs on Firebase Hosting redirect /page.html).
const cacheable = (response) => response && response.ok && response.type === 'basic' && !response.redirected;

const OFFLINE_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>You're offline — EliteHub</title><style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#070609;color:#efe7dc;font:16px/1.6 Montserrat,system-ui,sans-serif;text-align:center;padding:24px}
h1{font:600 34px/1.2 'Cormorant Garamond',Georgia,serif;color:#e6bf86;margin:0 0 10px}p{margin:0 0 22px;color:#b7ada2}
button{font:inherit;font-weight:600;padding:12px 26px;border-radius:99px;border:0;background:#e6bf86;color:#141016;cursor:pointer}</style></head>
<body><main><h1>You're offline</h1><p>This page hasn't been saved on your device yet.<br>Check your connection and try again.</p>
<button type="button" onclick="location.reload()">Try again</button></main></body></html>`;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // One missing file must not stop the worker from installing.
    await Promise.allSettled(CORE.map(async (path) => {
      const response = await fetch(new Request(path, { cache: 'reload' }));
      if (cacheable(response)) await cache.put(path, response);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('elitehub-') && key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});


self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  // Requests the network stack must handle itself (DevTools cache probes, media ranges).
  if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') return;
  if (request.headers.has('range')) return;

  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (cacheable(response)) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {}));
      }
      return response;
    } catch (error) {
      const cached = await caches.match(request) || (request.mode === 'navigate' ? await caches.match(request, { ignoreSearch: true }) : null);
      if (cached) return cached;
      if (request.mode === 'navigate') {
        return new Response(OFFLINE_PAGE, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
      return Response.error();
    }
  })());
});
