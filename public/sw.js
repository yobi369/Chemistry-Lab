const CACHE_PREFIX = 'chemistry-lab-static-';
const CACHE_NAME = CACHE_PREFIX + 'v1';
const APP_SHELL = ['/'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  const isAppShell = url.pathname === '/' || url.pathname === '/index.html';
  const isHashedAsset = url.pathname.startsWith('/assets/');
  const isRdkitAsset = url.pathname.startsWith('/vendor/rdkit/');
  const isRdkitWorker = url.pathname === '/rdkit-worker.js';
  if (!isAppShell && !isHashedAsset && !isRdkitAsset && !isRdkitWorker) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && (response.type === 'basic' || response.type === 'cors')) {
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      if (isAppShell) {
        const fallback = await cache.match('/');
        if (fallback) return fallback;
      }
      return new Response('This Chemistry Lab resource is not available offline yet.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }
  })());
});
