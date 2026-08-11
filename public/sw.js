const CACHE_NAME = 'fortune-empire-v5';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg'];

async function cacheModuleGraph(url, cache, visited = new Set()) {
  const absolute = new URL(url, self.location.origin).href;
  if (visited.has(absolute)) return;
  visited.add(absolute);
  const response = await fetch(absolute);
  if (!response.ok) return;
  await cache.put(absolute, response.clone());
  const source = await response.text();
  const imports = [...source.matchAll(/(?:from\s*|import\s*\()?["']([^"']+\.js)["']/g)]
    .map(match => new URL(match[1], absolute).href)
    .filter(child => new URL(child).origin === self.location.origin);
  await Promise.all(imports.map(child => cacheModuleGraph(child, cache, visited)));
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    try {
      const indexResponse = await fetch('/index.html');
      const html = await indexResponse.clone().text();
      const initialAssets = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
        .map(match => new URL(match[1], self.location.origin).href)
        .filter(url => new URL(url).origin === self.location.origin);
      await Promise.all(initialAssets.map(url => url.endsWith('.js') ? cacheModuleGraph(url, cache) : cache.add(url)));
      const response = await fetch('/offline-assets.json', { cache: 'no-store' });
      const manifest = await response.json();
      await Promise.allSettled((manifest.assets || []).map(asset => cache.add(asset)));
    } catch (error) {
      console.warn('Optional offline asset preload failed.', error);
    }
  })());
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put('/index.html', copy));
        return response;
      })
      .catch(() => caches.match('/index.html')));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (response.ok && new URL(event.request.url).origin === self.location.origin) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
    }
    return response;
  })));
});
