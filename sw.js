/* Service Worker: hält die App-Dateien auf dem Handy, damit sie offline startet.
   Mit Internet: App-Dateien immer zuerst frisch vom Server (höchstens 4 Sekunden warten), sonst aus dem Speicher.
   So kommt neuer App-Code beim ersten Öffnen an, und offline startet die App trotzdem.
   Daten (daten.enc), version.json und salt.json laufen NICHT hierüber, die verwaltet start.js selbst. */
const SPEICHER = 'kk-app-v11';
const DATEIEN = ['./', 'index.html', 'start.js', 'manifest.webmanifest', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  // cache: 'reload' umgeht den 10-Minuten-Zwischenspeicher von GitHub Pages
  e.waitUntil(caches.open(SPEICHER).then(c => c.addAll(DATEIEN.map(u => new Request(u, {cache: 'reload'})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(n => Promise.all(n.filter(x => x !== SPEICHER).map(x => caches.delete(x)))).then(() => self.clients.claim()));
});
const mitZeit = (p, ms) => Promise.race([p, new Promise((_, nein) => setTimeout(() => nein(new Error('zeit')), ms))]);
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (/\/(daten\.enc|version\.json|salt\.json)$/.test(url.pathname)) return;   // nie zwischenspeichern (start.js merkt sie sich selbst)
  e.respondWith((async () => {
    const c = await caches.open(SPEICHER);
    const istSeite = e.request.mode === 'navigate';
    const schluessel = istSeite ? 'index.html' : e.request;
    // 1. frisch vom Server (navigate-Anfragen nehmen keine Optionen, darum die Adresse neu bauen)
    try {
      const r = await mitZeit(fetch(istSeite ? 'index.html' : e.request.url, {cache: 'no-cache'}), 4000);
      if (r && r.ok) { await c.put(schluessel, r.clone()); return r; }
    } catch (err) {}
    // 2. offline oder zu langsam: aus dem Speicher
    const da = await c.match(schluessel) || (/app\.js$/.test(url.pathname) ? await c.match(e.request, {ignoreSearch: true}) : null);
    return da || new Response('Offline und noch nicht gespeichert.', {status: 503, headers: {'Content-Type': 'text/plain; charset=utf-8'}});
  })());
});
