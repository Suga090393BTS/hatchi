/* Hatchi service worker — offline app shell cache */
const CACHE = 'hatchi-v49';
const ASSETS = [
  './',
  './index.html',
  './maj.html',
  './css/styles.css',
  './icon.svg',
  './manifest.webmanifest',
  './js/store.js',
  './js/ui.js',
  './js/app.js',
  './js/views/today.js',
  './js/views/meals.js',
  './js/views/shopping.js',
  './js/views/health.js',
  './js/views/treatments.js',
  './js/views/journal.js',
  './js/views/dog.js',
  './js/views/settings.js'
];

self.addEventListener('install', (e) => {
  // 'reload' force le réseau (ignore le cache HTTP/CDN) => une nouvelle version met VRAIMENT
  // à jour les fichiers, pas seulement le numéro de version.
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(ASSETS.map((u) => fetch(new Request(u, { cache: 'reload' })).then((res) => res.ok && c.put(u, res)))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

// Network-first (avec repli sur le cache hors-ligne) : les mises à jour s'affichent
// dès qu'on est en ligne, et l'app reste utilisable sans connexion.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin || e.request.method !== 'GET') return; // jamais Supabase / cross-origin
  e.respondWith(
    // 'no-store' force le réseau (contourne le cache HTTP du navigateur) => mises à jour immédiates
    fetch(new Request(e.request, { cache: 'no-store' })).then((res) => {
      if (res && res.status === 200) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request).then((cached) => cached || caches.match('./index.html')))
  );
});
