const SHELL_CACHE = 'mmc-shell-v2';
const RUNTIME_CACHE = 'mmc-runtime-v2';
const APP_SHELL = ['/', '/index.html'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => Promise.resolve())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

function hasExpectedContentType(request, response) {
  const contentType = response.headers.get('content-type') || '';

  switch (request.destination) {
    case 'script':
    case 'worker':
      return contentType.includes('javascript');
    case 'style':
      return contentType.includes('text/css');
    case 'image':
      return contentType.startsWith('image/');
    case 'font':
      return contentType.includes('font') || contentType.includes('application/octet-stream');
    case 'document':
      return contentType.includes('text/html');
    default:
      return true;
  }
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(RUNTIME_CACHE);

      try {
        const response = await fetch(event.request, { cache: 'no-store' });

        if (response.ok && hasExpectedContentType(event.request, response)) {
          await cache.put(event.request, response.clone());
        }

        return response;
      } catch (error) {
        const cached = await cache.match(event.request);
        if (cached && hasExpectedContentType(event.request, cached)) return cached;

        if (event.request.mode === 'navigate') {
          return (await caches.match('/index.html')) || (await caches.match('/'));
        }

        throw error;
      }
    })()
  );
});
