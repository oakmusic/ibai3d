const CACHE_NAME = 'juego-3d-v2';
const urlsToCache = ['./', './index.html', './app.js', './manifest.json'];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    event.respondWith(
        fetch(event.request)
            .then(res => {
                const copy = res.clone();
                caches.open(CACHE_NAME).then(c => c.put(event.request, copy));
                return res;
            })
            .catch(() => caches.match(event.request))
    );
});