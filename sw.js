/* Service Worker: hält die App-Dateien auf dem Handy, damit sie offline startet.
   App-Dateien: aus dem Speicher liefern und im Hintergrund erneuern.
   Daten (daten.enc), version.json und salt.json laufen NICHT hierüber, die verwaltet start.js selbst. */
const SPEICHER = 'kk-app-v4';
const DATEIEN = ['./', 'index.html', 'start.js', 'manifest.webmanifest', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  // cache: 'reload' umgeht den 10-Minuten-Zwischenspeicher von GitHub Pages
  e.waitUntil(caches.open(SPEICHER).then(c => c.addAll(DATEIEN.map(u => new Request(u, {cache: 'reload'})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(n => Promise.all(n.filter(x => x !== SPEICHER).map(x => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (/\/(daten\.enc|version\.json|salt\.json)$/.test(url.pathname)) return;   // nie zwischenspeichern (start.js merkt sie sich selbst)
  e.respondWith((async () => {
    const c = await caches.open(SPEICHER);
    const istSeite = e.request.mode === 'navigate';
    const vorhanden = await c.match(istSeite ? 'index.html' : e.request) || (/app\.js$/.test(url.pathname) ? await c.match(e.request, {ignoreSearch: true}) : null);
    // immer beim Server nachfragen (ETag); bei Seitenaufrufen die Adresse neu bauen (navigate-Anfragen nehmen keine Optionen)
    const neu = fetch(istSeite ? 'index.html' : e.request.url, {cache: 'no-cache'}).then(r => {
      if (r && r.ok) c.put(istSeite ? 'index.html' : e.request, r.clone());
      return r;
    }).catch(() => null);
    if (vorhanden) { e.waitUntil(neu); return vorhanden; }
    return (await neu) || new Response('Offline und noch nicht gespeichert.', {status: 503, headers: {'Content-Type': 'text/plain; charset=utf-8'}});
  })());
});
