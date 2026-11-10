/* Startprogramm der Offline-App „Lernen unterwegs“ (GitHub-Pages-Fassung).
   Ablauf: 1. bei Netz kurz prüfen, ob es einen neuen Stand gibt (version.json, ca. 100 Byte)
           2. verschlüsselte Daten aus dem Speicher des Handys holen (IndexedDB)
           3. mit dem gemerkten Schlüssel oder dem eingegebenen Passwort entschlüsseln
           4. die eigentliche App (app.js) starten.
   Verschlüsselung: AES-256-GCM, Schlüssel per PBKDF2-SHA-256 aus dem Passwort (Durchgänge in salt.json).
   Das Passwort verlässt das Handy nie. Gemerkt wird nur ein nicht exportierbarer Schlüssel. */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const ls = {
    get(k, d) { try { const v = localStorage.getItem('kk.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('kk.' + k, JSON.stringify(v)); } catch (e) {} }
  };

  /* ---------- kleiner Speicher (IndexedDB) ---------- */
  function idb() {
    return new Promise((ok, fail) => {
      const r = indexedDB.open('kk', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => ok(r.result);
      r.onerror = () => fail(r.error);
    });
  }
  async function hole(k) {
    const db = await idb();
    return new Promise((ok, fail) => { const t = db.transaction('kv').objectStore('kv').get(k); t.onsuccess = () => ok(t.result); t.onerror = () => fail(t.error); });
  }
  async function lege(k, v) {
    const db = await idb();
    return new Promise((ok, fail) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => ok(); t.onerror = () => fail(t.error); });
  }
  async function weg(k) {
    const db = await idb();
    return new Promise(ok => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').delete(k); t.oncomplete = () => ok(); t.onerror = () => ok(); });
  }

  /* ---------- Netz ---------- */
  function mitZeitlimit(p, ms) { return Promise.race([p, new Promise((_, f) => setTimeout(() => f(new Error('Zeit')), ms))]); }
  async function holeVersion() {
    const r = await mitZeitlimit(fetch('version.json', {cache: 'no-store'}), 5000);
    if (!r.ok) throw new Error('version');
    return r.json();
  }
  // Neuen Stand laden. auto=false: nur nachsehen, nichts herunterladen.
  async function aktualisieren(laden) {
    if (navigator.onLine === false) return 'offline';
    try {
      const v = await holeVersion();
      const alt = await hole('version');
      if (alt && alt.v === v.v) return 'aktuell';
      if (!laden) { neueVersion = v; return 'verfuegbar'; }
      const r = await mitZeitlimit(fetch('daten.enc?v=' + encodeURIComponent(v.v), {cache: 'no-store'}), 30000);
      if (!r.ok) throw new Error('daten');
      await lege('daten', await r.arrayBuffer());
      await lege('version', v);
      return 'neu';
    } catch (e) { return 'fehler'; }
  }
  let neueVersion = null;

  /* ---------- Krypto ---------- */
  const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  let saltInfo = null;
  async function salt() {
    if (saltInfo) return saltInfo;
    const gespeichert = await hole('salt');
    try {
      const r = await mitZeitlimit(fetch('salt.json', {cache: 'no-cache'}), 5000);
      if (r.ok) { saltInfo = await r.json(); await lege('salt', saltInfo); return saltInfo; }
    } catch (e) {}
    if (gespeichert) { saltInfo = gespeichert; return saltInfo; }
    throw new Error('salt');
  }
  async function schluesselAus(passwort) {
    const s = await salt();
    const basis = await crypto.subtle.importKey('raw', new TextEncoder().encode(passwort), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({name: 'PBKDF2', salt: b64(s.salt), iterations: s.iter, hash: 'SHA-256'},
      basis, {name: 'AES-GCM', length: 256}, false, ['decrypt']);
  }
  async function entschluesseln(schluessel) {
    const buf = await hole('daten');
    if (!buf) throw new Error('keine-daten');
    const iv = new Uint8Array(buf, 0, 12), ct = new Uint8Array(buf, 12);
    const klar = await crypto.subtle.decrypt({name: 'AES-GCM', iv}, schluessel, ct);
    const text = await new Response(new Blob([klar]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    return JSON.parse(text);
  }

  /* ---------- Sperrbildschirm ---------- */
  function sperre(meldung) {
    const s = $('#schloss');
    s.hidden = false;
    $('#schlossMeldung').textContent = meldung || '';
    $('#schlossMeldung').hidden = !meldung;
    setTimeout(() => { try { $('#kkPasswort').focus(); } catch (e) {} }, 50);
  }
  function hinweis(text) {
    const s = $('#schloss');
    s.hidden = false;
    $('#schlossForm').hidden = true;
    $('#schlossMeldung').hidden = false;
    $('#schlossMeldung').textContent = text;
  }

  /* ---------- App starten ---------- */
  let gestartet = false;
  async function starten(daten) {
    if (gestartet) return;
    gestartet = true;
    window.__KK_DATEN = daten;
    $('#schloss').hidden = true;
    const v = (await hole('version')) || {};
    const s = document.createElement('script');
    s.src = 'app.js?v=' + encodeURIComponent(v.app || '0');
    document.body.appendChild(s);
  }

  /* ---------- Einstellungen (erscheinen auf der Startseite) ---------- */
  window.__KK = {
    einstellungenHtml() {
      const auto = ls.get('auto', true);
      const v = window.__KK_VERSION || {};
      const stand = v.stand ? new Date(v.stand).toLocaleString('de-DE', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'}) : '–';
      return `<section><h2>App</h2><ul class="liste">
        <li><span class="txt">Stand auf diesem Handy<div class="klein">${stand}${neueVersion ? ' · <b>neuer Stand verfügbar</b>' : ''}</div></span>
          <button class="zweit" type="button" onclick="__KK.jetzt()">Aktualisieren</button></li>
        <li><label class="txt" for="kkAuto" style="display:flex;gap:10px;align-items:center;cursor:pointer">
          <input id="kkAuto" type="checkbox" ${auto ? 'checked' : ''} onchange="__KK.auto(this.checked)" style="width:20px;height:20px">
          <span>Automatisch aktualisieren, sobald Internet da ist<div class="klein">Aus: Die App prüft nur kurz (ca. 100 Byte) und lädt erst, wenn du auf „Aktualisieren“ tippst, z. B. im WLAN.</div></span></label></li>
        <li><span class="txt">Passwort auf diesem Handy vergessen<div class="klein">Danach fragt die App beim Öffnen wieder nach dem Passwort.</div></span>
          <button class="zweit" type="button" onclick="__KK.abmelden()">Vergessen</button></li>
      </ul></section>`;
    },
    auto(an) { ls.set('auto', !!an); },
    async jetzt() {
      const e = await aktualisieren(true);
      if (e === 'neu') location.reload();
      else alertLeise(e === 'aktuell' ? 'Schon auf dem neuesten Stand.' : e === 'offline' ? 'Kein Internet. Später noch einmal versuchen.' : 'Aktualisieren hat nicht geklappt. Später noch einmal versuchen.');
    },
    async abmelden() { await weg('schluessel'); location.reload(); }
  };
  function alertLeise(text) {
    let b = $('#kkMeldung');
    if (!b) { b = document.createElement('div'); b.id = 'kkMeldung'; b.className = 'kk-meldung'; document.body.appendChild(b); }
    b.textContent = text; b.hidden = false;
    clearTimeout(b._t); b._t = setTimeout(() => { b.hidden = true; }, 3500);
  }

  /* ---------- Ablauf ---------- */
  async function los() {
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
    if ('serviceWorker' in navigator) { try { navigator.serviceWorker.register('sw.js'); } catch (e) {} }

    const auto = ls.get('auto', true);
    const hatDaten = !!(await hole('daten'));
    const ergebnis = await aktualisieren(auto || !hatDaten);
    window.__KK_VERSION = await hole('version');
    if (!(await hole('daten'))) {
      hinweis(ergebnis === 'offline' || ergebnis === 'fehler'
        ? 'Beim ersten Öffnen braucht die App einmal Internet. Danach geht sie auch offline.'
        : 'Es sind noch keine Daten da.');
      return;
    }
    if (ergebnis === 'verfuegbar') alertLeise('Neuer Stand verfügbar. Unten auf der Startseite „Aktualisieren“ tippen.');

    const gemerkt = await hole('schluessel');
    if (gemerkt) {
      try { return starten(await entschluesseln(gemerkt)); }
      catch (e) { await weg('schluessel'); }
    }
    sperre('');
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('#schlossForm').addEventListener('submit', async ev => {
      ev.preventDefault();
      const feld = $('#kkPasswort'), knopf = $('#schlossKnopf');
      if (!feld.value) return;
      knopf.disabled = true; knopf.textContent = 'Wird geöffnet …';
      try {
        const k = await schluesselAus(feld.value);
        const daten = await entschluesseln(k);
        if ($('#kkMerken').checked) await lege('schluessel', k);
        feld.value = '';
        starten(daten);
      } catch (e) {
        sperre(e && e.message === 'salt' ? 'Beim ersten Öffnen braucht die App einmal Internet.' : 'Das Passwort stimmt nicht.');
      }
      knopf.disabled = false; knopf.textContent = 'Öffnen';
    });
    los();
  });
})();
