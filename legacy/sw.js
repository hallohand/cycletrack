const CACHE_NAME = 'cycletrack-v9'; // v1.2.6 - Fixed period 2 calculation (end of period 1 + cycle length)
const urlsToCache = [
  '/cycletrack/',
  '/cycletrack/index.html',
  '/cycletrack/app.js',
  '/cycletrack/import-export.js',
  '/cycletrack/manifest.json'
];

// Install event - Cache aktualisieren
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting()) // Sofort aktivieren
  );
});

// Fetch event - Netzwerk bevorzugen, Fallback auf Cache
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Aktualisiere Cache mit neuer Version
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback auf Cache wenn offline
        return caches.match(event.request);
      })
  );
});

// Activate event - Alte Caches löschen
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim()) // Sofort Kontrolle übernehmen
  );
});

// Nachricht vom Hauptthread empfangen
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});