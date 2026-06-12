/* ============================================================
   CROIVA — Service Worker v3.2.0
   BUMP esta versión en cada deploy para invalidar el cache.
   ============================================================ */

const CACHE_NAME = 'croiva-v3.2.0';

// App shell completo — pre-cacheado en install para funcionar offline
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/manifest.json',
  '/logo_transparent.png',
  '/sw.js',
  // Módulos JS
  '/src/main.js',
  '/src/api.js',
  '/src/router.js',
  '/src/state.js',
  '/src/utils.js',
  '/src/ui/dashboard.js',
  '/src/ui/projects.js',
  '/src/ui/quotes.js',
  '/src/ui/payments.js',
  '/src/ui/forms.js',
  '/src/ui/users.js',
  '/src/ui/notifications.js',
  '/src/ui/profile.js',
  '/src/ui/budgets.js',
  '/src/ui/scanner.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // SSE y cross-origin → pasar directo al navegador, sin interceptar
  if (
    url.pathname.includes('/notifications/stream') ||
    event.request.headers.get('accept')?.includes('text/event-stream') ||
    url.origin !== self.location.origin
  ) {
    return;
  }

  // API → siempre network, nunca cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // App shell (HTML, JS, CSS, imágenes) → stale-while-revalidate:
  // Sirve del cache al instante y actualiza en background para la próxima carga.
  // Offline: siempre hay algo en cache gracias al pre-cache del install.
  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      const cached = await cache.match(event.request);

      const networkFetch = fetch(event.request)
        .then(res => {
          if (res && res.status === 200 && res.type !== 'error') {
            cache.put(event.request, res.clone());
          }
          return res;
        })
        .catch(() => null);

      // Si hay cache: devuelve inmediatamente y actualiza en fondo
      // Si no hay cache (primera visita): espera la red
      return cached ?? await networkFetch;
    })
  );
});
