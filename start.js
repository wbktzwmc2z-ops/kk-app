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
      basis, {name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']);   // encrypt: für den Briefkasten
  }
  async function entschluesseln(schluessel) {
    const buf = await hole('daten');
    if (!buf) throw new Error('keine-daten');
    const iv = new Uint8Array(buf, 0, 12), ct = new Uint8Array(buf, 12);
    const klar = await crypto.subtle.decrypt({name: 'AES-GCM', iv}, schluessel, ct);
    // ungepackt (kein DecompressionStream nötig, läuft auch auf älteren iPhones)
    return JSON.parse(new TextDecoder().decode(klar));
  }

  /* ---------- Briefkasten: Runden verschlüsselt an das private Projekt kk-eingang ----------
     Der Schlüssel (Token) darf nur in kk-eingang schreiben. Die Runden sind mit demselben Schlüssel
     verschlüsselt wie die Lerndaten; der Mac entschlüsselt sie mit dem Passwort aus dem Schlüsselbund. */
  const EINGANG = 'https://api.github.com/repos/wbktzwmc2z-ops/kk-eingang/contents/runden/';
  let aktSchluessel = null, eingangToken = null, sendeTimer = null, sendetGerade = false;
  const lsRoh = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  const zuB64 = bytes => { let s = ''; const b = new Uint8Array(bytes); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
  async function kennung(text) { const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)); return zuB64(h).slice(0, 16); }
  function api(url, opt) {
    return mitZeitlimit(fetch(url, Object.assign({cache: 'no-store'}, opt, {headers: Object.assign({
      'Authorization': 'Bearer ' + eingangToken, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28'}, (opt || {}).headers || {})})), 15000);
  }
  async function sendeAlles() {
    if (sendetGerade || !eingangToken || !aktSchluessel || navigator.onLine === false) return;
    if (!aktSchluessel.usages || aktSchluessel.usages.indexOf('encrypt') < 0) return;
    sendetGerade = true;
    try {
      const offen = lsRoh.get('handy.offeneRunden', []);
      const gesendet = ls.get('gesendet', {}), shas = ls.get('shas', {});
      let fehler = false;
      for (const r of offen) {
        const text = JSON.stringify(r), k = await kennung(text);
        if (gesendet[r.id] === k) continue;
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ct = new Uint8Array(await crypto.subtle.encrypt({name: 'AES-GCM', iv}, aktSchluessel, new TextEncoder().encode(text)));
        const bytes = new Uint8Array(12 + ct.length); bytes.set(iv); bytes.set(ct, 12);
        const url = EINGANG + encodeURIComponent(r.id) + '.bin';
        const body = sha => JSON.stringify(Object.assign({message: 'Runde', content: zuB64(bytes)}, sha ? {sha} : {}));
        let res = await api(url, {method: 'PUT', body: body(shas[r.id])});
        if (res.status === 409 || res.status === 422) {          // Datei gibt es schon: aktuellen Stand (sha) holen
          const g = await api(url, {method: 'GET'});
          if (g.ok) { shas[r.id] = (await g.json()).sha; res = await api(url, {method: 'PUT', body: body(shas[r.id])}); }
        }
        if (res.ok) { shas[r.id] = (await res.json()).content.sha; gesendet[r.id] = k; markiereUebertragen(r.id); }
        else { fehler = true; ls.set('letzterFehler', res.status + ' ' + new Date().toISOString()); break; }
      }
      // gesendete Runden, die älter als ein Tag sind, aus der Warteliste nehmen
      const tag = Date.now() - 864e5;
      lsRoh.set('handy.offeneRunden', offen.filter(r => !(gesendet[r.id] && new Date(r.ende || r.start).getTime() < tag)));
      ls.set('gesendet', gesendet); ls.set('shas', shas);
      if (!fehler) ls.set('letzterVersand', new Date().toISOString());
    } catch (e) { ls.set('letzterFehler', (e && e.message) + ' ' + new Date().toISOString()); }
    sendetGerade = false;
  }
  function markiereUebertragen(id) {
    const l = lsRoh.get('handy.meineRunden', []);
    const e = l.find(x => x.id === id);
    if (e && !e.ok) { e.ok = true; lsRoh.set('handy.meineRunden', l); }
  }
  function spaeterSenden(ms) { clearTimeout(sendeTimer); sendeTimer = setTimeout(sendeAlles, ms); }
  window.addEventListener('online', () => spaeterSenden(2000));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') spaeterSenden(3000); });

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
  async function starten(daten, schluessel) {
    if (gestartet) return;
    gestartet = true;
    aktSchluessel = schluessel || null;
    eingangToken = (await hole('eingangToken')) || null;
    spaeterSenden(3000);
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
        <li><span class="txt">Übertragung zum Mac (Briefkasten)<div class="klein">${eingangToken ? 'eingerichtet' + (ls.get('letzterVersand', null) ? ' · zuletzt gesendet ' + new Date(ls.get('letzterVersand')).toLocaleString('de-DE', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'}) : '') + (ls.get('letzterFehler', null) ? '<br>letzter Fehler: ' + String(ls.get('letzterFehler')).split(' ')[0] : '') : 'noch nicht eingerichtet: Schlüssel für kk-eingang einfügen'}</div>
          <div style="display:flex;gap:6px;margin-top:8px"><input id="kkToken" type="password" autocomplete="off" placeholder="${eingangToken ? 'neuen Schlüssel einfügen' : 'github_pat_…'}" style="flex:1;min-width:0;font:inherit;font-size:15px;padding:8px 10px;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:var(--ink)">
          <button class="zweit" type="button" onclick="__KK.tokenSpeichern()">Speichern</button></div></span></li>
        <li><span class="txt">Passwort auf diesem Handy vergessen<div class="klein">Danach fragt die App beim Öffnen wieder nach dem Passwort.</div></span>
          <button class="zweit" type="button" onclick="__KK.abmelden()">Vergessen</button></li>
      </ul></section>`;
    },
    auto(an) { ls.set('auto', !!an); },
    briefkastenAn() { return !!eingangToken; },
    senden() { spaeterSenden(4000); },
    async tokenSpeichern() {
      const t = ($('#kkToken').value || '').trim();
      if (!/^github_pat_[A-Za-z0-9_]+$/.test(t)) return alertLeise('Das sieht nicht wie ein GitHub-Schlüssel aus (fängt mit github_pat_ an).');
      const alt = eingangToken; eingangToken = t;
      try {
        const r = await api('https://api.github.com/repos/wbktzwmc2z-ops/kk-eingang', {method: 'GET'});
        if (!r.ok) throw new Error(r.status);
        await lege('eingangToken', t); $('#kkToken').value = '';
        alertLeise('Gespeichert. Deine Runden werden jetzt automatisch übertragen.');
        await sendeAlles();
        if (typeof render === 'function') render();
      } catch (e) { eingangToken = alt; alertLeise('Der Schlüssel funktioniert nicht für kk-eingang (' + (e && e.message) + '). Ist er für das richtige Projekt erstellt?'); }
    },
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
      // alter gemerkter Schlüssel ohne „encrypt“: einmal neu anmelden, damit der Briefkasten senden kann
      if (gemerkt.usages && gemerkt.usages.indexOf('encrypt') < 0) { await weg('schluessel'); return sperre('Einmal neu anmelden, damit deine Runden automatisch zum Mac übertragen werden können.'); }
      try { return starten(await entschluesseln(gemerkt), gemerkt); }
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
      $('#schlossMeldung').hidden = true;
      // Schritt für Schritt, damit eine Fehlermeldung sagt, wo es hängt
      let schritt = 'Schlüssel berechnen';
      try {
        const k = await schluesselAus(feld.value.normalize('NFC'));
        schritt = 'Entschlüsseln';
        const daten = await entschluesseln(k);
        schritt = 'Merken';
        if ($('#kkMerken').checked) {
          try { await lege('schluessel', k); }
          catch (e) { alertLeise('Merken geht in diesem Browser nicht, die App fragt beim nächsten Mal wieder.'); }
        }
        schritt = 'Starten';
        feld.value = '';
        await starten(daten, k);
      } catch (e) {
        const name = (e && (e.name || e.message)) || 'unbekannt';
        let text;
        if (e && e.message === 'salt') text = 'Beim ersten Öffnen braucht die App einmal Internet.';
        else if (schritt === 'Entschlüsseln' && name === 'OperationError') text = 'Das Passwort stimmt nicht (eingegeben: ' + feld.value.length + ' Zeichen).';
        else text = 'Technischer Fehler beim Schritt „' + schritt + '“: ' + name + (e && e.message && e.message !== name ? ' (' + e.message + ')' : '');
        sperre(text);
      }
      knopf.disabled = false; knopf.textContent = 'Öffnen';
    });
    los();
  });
})();
