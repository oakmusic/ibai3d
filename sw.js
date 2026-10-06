const CACHE_NAME = 'juego-3d-v1';
const urlsToCache = [
    './',
    './index.html',
    './app.js',
    './manifest.json',
    './Jump.fbx'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
        .then(cache => {
            return cache.addAll(urlsToCache);
        })
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
        .then(response => {
            // Si está en la caché, lo entrega. Si no, lo pide a internet.
            if (response) return response;
            return fetch(event.request);
        })
    );
});