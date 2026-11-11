
const D = window.__KK_DATEN || null;

/* ---------- Hilfen ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const FACHFARBE = (D && D.farben) || {};   // Kühl & Warm: FSWI/PROG kühl, QM/EV warm, Tableau warmes Waldgrün   // wie das Dashboard (Tailwind 600)
/* Fach-Paletten wie im Dashboard (Azure Flow): Karten in Stufe 50, beim gewählten Fach schwingt alles um */
const FACHSCHEMA = {
  Fallstudie:    {p50:'#eff6ff', p100:'#dbeafe', p300:'#93c5fd', p600:'#2563eb', p800:'#1e40af'},
  Programmierung:{p50:'#f5f3ff', p100:'#ede9fe', p300:'#c4b5fd', p600:'#7c3aed', p800:'#5b21b6'},
  Tableau:       {p50:'#f1f6ec', p100:'#dfeacf', p300:'#a9c48f', p600:'#3a6e2f', p800:'#26491f'},
  Quantitative:  {p50:'#fff1f2', p100:'#ffe4e6', p300:'#fda4af', p600:'#e11d48', p800:'#9f1239'},
  Entscheidung:  {p50:'#fff7ed', p100:'#ffedd5', p300:'#fdba74', p600:'#f97316', p800:'#9a3412'}
};
const fachSchema = n => FACHSCHEMA[Object.keys(FACHSCHEMA).find(k => String(n).includes(k))] || FACHSCHEMA.Fallstudie;
function statusleisteFaerben(farbe){
  // Statusleiste (iPhone) in der Farbe, mit der der Verlauf oben beginnt
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => { if (!m.media || m.media.includes('light')) m.content = farbe; });
}
function farbschemaSetzen(){
  const r = document.documentElement.style;
  const namen = ['--accent','--accent-soft','--accent-ink','--sicher','--gelernt','--wackelig','--verlauf-oben','--verlauf-mitte','--kopf'];
  const dunkel = matchMedia('(prefers-color-scheme: dark)').matches;
  /* neutraler Apple-Stil: kein Farbumschwung mehr je Fach (Wunsch Maxie 11.11.2026) */
  if (true) { namen.forEach(n => r.removeProperty(n)); statusleisteFaerben('#ffffff'); return; }
  const c = fachSchema(FAECHER[fachAuswahl].name);
  statusleisteFaerben('#ffffff');
  r.setProperty('--accent', c.p600); r.setProperty('--accent-soft', c.p100); r.setProperty('--accent-ink', c.p800);
  r.setProperty('--sicher', c.p800); r.setProperty('--gelernt', c.p600); r.setProperty('--wackelig', c.p300);
  r.setProperty('--verlauf-oben', c.p100); r.setProperty('--verlauf-mitte', c.p50);
}
const fachFarbe = n => FACHFARBE[Object.keys(FACHFARBE).find(k => String(n).includes(k))] || '#1f5f4a';
const pad = n => String(n).padStart(2, '0');
const isoTag = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const HEUTE = isoTag(new Date());
const MORGEN = isoTag(new Date(Date.now() + 864e5));
const datumKurz = iso => iso ? iso.slice(8, 10) + '.' + iso.slice(5, 7) + '.' : '';
const tageBis = iso => Math.round((new Date(iso + 'T12:00') - new Date(HEUTE + 'T12:00')) / 864e5);
const mischen = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const speicher = {
  get(k, d) { try { const v = localStorage.getItem('handy.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('handy.' + k, JSON.stringify(v)); } catch (e) {} }
};

/* Inline-Markdown für Fragen: `code` und **fett** */
function inline(s){
  return String(s ?? '').split(/(`[^`]+`)/).map(p => /^`[^`]+`$/.test(p)
    ? '<code>' + esc(p.slice(1,-1)) + '</code>'
    : esc(p).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')).join('');
}

/* Quiz-Text: kurzer Code bleibt im Satz, längerer Code wird ein eigener Block mit sinnvollen Umbrüchen:
   HTML ein Tag pro Zeile (eingerückt), PHP eine Anweisung pro Zeile, lange echo-Ketten vor jedem Punkt. */
const LEER_TAGS = /^<(img|input|br|hr|link|meta)\b/i;
function codeUmbrechen(c){
  if (/<[a-z\/!]/i.test(c) && /></.test(c)) {
    let tiefe = 0;
    return c.replace(/>\s*</g, '>\n<').split('\n').map(z => {
      if (/^<\//.test(z)) tiefe = Math.max(0, tiefe - 1);
      const zeile = '  '.repeat(tiefe) + z;
      if (/^<[a-z]/i.test(z) && !LEER_TAGS.test(z) && !/\/>$/.test(z) && !/<\/[a-z]+>$/i.test(z)) tiefe++;
      return zeile;
    }).join('\n');
  }
  if (/;\s*\S/.test(c) || /\{\s*\S/.test(c)) {
    let tiefe = 0;
    return c.replace(/;\s+/g, ';\n').replace(/\{\s*/g, '{\n').replace(/\s*\}/g, '\n}').split('\n').map(z => z.trim()).filter(Boolean).map(z => {
      if (/^\}/.test(z)) tiefe = Math.max(0, tiefe - 1);
      const zeile = '  '.repeat(tiefe) + z;
      if (/\{$/.test(z)) tiefe++;
      return zeile;
    }).join('\n');
  }
  if (c.length > 34 && / \. /.test(c)) return c.replace(/ \. /g, '\n  . ');
  return c;
}
function quizText(s){
  return String(s ?? '').split(/(`[^`]+`)/).map(p => {
    if (!/^`[^`]+`$/.test(p)) return esc(p).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    const c = p.slice(1, -1);
    if (c.length <= 28) return '<code>' + esc(c) + '</code>';
    // jede Zeile ein eigener Block; bricht sie um, wird der Rest eingerückt (hängender Einzug)
    return '<code class="block">' + codeUmbrechen(c).split('\n').map(z => {
      const e = (z.match(/^ */)[0].length) / 2;
      return `<span class="cz" style="--e:${e}">${esc(z.trim())}</span>`;
    }).join('') + '</code>';
  }).join('');
}

/* ---------- Formelkästen fürs Handy ----------
   Quelle: Codeblock `formel`, Spalten mit 3+ Leerzeichen, Gleichheitszeichen oft mit Leerzeichen ausgerichtet.
   Darstellung: ein Raster mit drei Spalten (linke Seite | = | rechte Seite), damit die = untereinander stehen.
   Eine Formel bleibt in einer Zeile; passt sie nicht, bricht sie nur vor + − = → < > (außerhalb von Klammern)
   und der Rest steht eingerückt unter dem Anfang der rechten Seite. Hinweise (→ …, ( … ), Wörter nach 2 Leerzeichen)
   werden klein und grau. */
function formelStuecke(t){
  const stuecke = [];
  let tiefe = 0, akt = '';
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if ('([{'.includes(ch)) tiefe++;
    if (')]}'.includes(ch)) tiefe = Math.max(0, tiefe - 1);
    if (tiefe === 0 && ch === ' ' && /^[+−=→<>≤≥]$/.test(t[i + 1] || '') && t[i + 2] === ' ' && akt.trim()) { stuecke.push(akt); akt = ''; }
    akt += ch;
    if (tiefe === 0 && ch === ',' && t[i + 1] === ' ') { stuecke.push(akt); akt = ''; }
  }
  if (akt.trim()) stuecke.push(akt);
  // lange Stücke ohne Rechenzeichen (Text wie „Von-Neumann-Morgenstern-Kriterium (Folie 12)“) dürfen normal umbrechen
  return stuecke.map(s => `<span class="fp${(s.trim().length > 24 && /[A-Za-zÄÖÜäöüß]{3,} [A-Za-zÄÖÜäöüß(]/.test(s)) || s.trim().length > 38 ? ' lang' : ''}">${esc(s.trim())}</span>`).join(' <wbr>');
}
function formelInhalt(t){
  // Wörter nach 2+ Leerzeichen am Ende („gesamt“, „Nutzen auf …“) sind Anmerkungen
  const m = t.match(/^(.*\S)\s{2,}(\S.*)$/);
  if (m && !/:$/.test(m[1])) return formelStuecke(m[1]) + ` <span class="fnote">${esc(m[2])}</span>`;
  return formelStuecke(t.replace(/:\s{2,}/g, ': '));
}
function formelHtml(code){
  const out = [];
  let erste = true;
  code.filter(z => z.trim()).forEach(z => {
    const ein = /^\s+/.test(z);
    const zeileKlasse = ein ? ' ein' : erste ? '' : ' neu';
    erste = false;
    let segs = z.trim().replace(/\s{2,}=\s/g, ' = ').split(/\s{3,}/);
    // „Bestimmtheitsmaß:  r² = …“ oder „Varianz (diskret):   VAR(X) = …“: Beschriftung über die Formel
    let label = null;
    const lm = segs[0].match(/^([^=]{4,40}?:)\s{2,}(.*)$/);
    if (lm) { label = lm[1]; segs[0] = lm[2]; }
    else if (segs.length > 1 && /^[^=]{4,40}:$/.test(segs[0])) { label = segs.shift(); }
    let k = zeileKlasse;
    if (label) { out.push(`<span class="c flab${k}">${esc(label)}</span>`); k = ein ? ' ein' : ''; }
    segs.forEach((s, si) => {
      // Hinweise: „→ …“, „( … )“ und Erklärsätze neben einer Formel („Vorzeichen = Richtung, Betrag = Stärke“)
      const istSatz = si > 0 && (
        (/, /.test(s) && /[A-Za-zÄÖÜäöüß]{5,}/.test(s) && !/[·√Σ²]/.test(s)) ||   // Erklärsatz
        !/[=+−·√Σ²<>≤≥\/]/.test(s));                                                  // nur Wörter, z. B. „gesamte Streuung“
      if (/^[→(]/.test(s) || istSatz) { out.push(`<span class="c fn${ein ? ' ein' : ''}">${esc(s)}</span>`); return; }
      const g = s.indexOf(' = ');
      const lhs = g > 0 ? s.slice(0, g) : '';
      // nur kurze linke Seiten (bis 8 Zeichen) bilden die =-Spalte, sonst wird sie für alle zu breit
      if (lhs && lhs.length <= 8 && !/[,:]/.test(lhs)) {
        out.push(`<span class="c fl${k}">${esc(lhs)}</span><span class="c fe${k}">=</span><span class="c fr${k}">${formelInhalt(s.slice(g + 3))}</span>`);
      } else {
        out.push(`<span class="c fs${k}">${formelInhalt(s)}</span>`);
      }
      k = ein ? ' ein' : '';
    });
  });
  return out.join('');
}

/* ---------- Lernzettel lesen (gleicher Leser wie im Dashboard) ---------- */
function md(src){
  const zeilen = [];
  let imCode = false;
  String(src || '').replace(/\r/g, '').split('\n').forEach(z => {
    if (/^\s*```/.test(z)) { imCode = !imCode; zeilen.push(z); return; }
    if (imCode) { zeilen.push(z); return; }
    z.split(/(<details>\s*<summary>.*?<\/summary>|<\/details>)/).forEach(t => { if (t.trim() || !zeilen.length || t === z) zeilen.push(t); });
  });
  const out = [];
  let i = 0;
  const istBlock = z => /^\s*(```|#{1,6}\s|[-*]\s|\d+\.\s|\||>)/.test(z) || /^<\/?details|^<summary/.test(z.trim());
  while (i < zeilen.length) {
    const z = zeilen[i], t = z.trim();
    let m;
    if (!t) { i++; continue; }
    if ((m = t.match(/^<details>\s*<summary>(.*?)<\/summary>$/))) { out.push(`<details><summary>${inline(m[1])}</summary>`); i++; continue; }
    if (t === '</details>') { out.push('</details>'); i++; continue; }
    if (/^```/.test(t)) {
      const sprache = t.replace(/^`+/, '').trim();
      const code = []; i++;
      while (i < zeilen.length && !/^\s*```/.test(zeilen[i])) code.push(zeilen[i++]);
      i++;
      const roh = esc(code.join('\n'));
      out.push(/^formel$/i.test(sprache)
        ? `<div class="formel"><span class="lbl">Formel</span><div class="fzeilen">${formelHtml(code)}</div></div>`
        : `<div class="code">${sprache ? `<div class="sp">${esc(sprache)}</div>` : ''}<pre><code>${roh}</code></pre></div>`);
      continue;
    }
    if ((m = t.match(/^(#{1,6})\s+(.*)$/))) { const n = Math.min(m[1].length, 4); out.push(`<h${n}>${inline(m[2])}</h${n}>`); i++; continue; }
    if (/^\|/.test(t)) {
      const rows = [];
      while (i < zeilen.length && /^\s*\|/.test(zeilen[i])) rows.push(zeilen[i++].trim());
      const zellen = r => r.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => inline(c.trim()));
      const daten = rows.filter(r => !/^\|[\s\-:|]+\|$/.test(r));
      out.push('<div class="tabwrap"><table><thead><tr>' + zellen(daten[0]).map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>' +
        daten.slice(1).map(r => '<tr>' + zellen(r).map(c => `<td>${c}</td>`).join('') + '</tr>').join('') + '</tbody></table></div>');
      continue;
    }
    if (/^>/.test(t)) {
      const q = [];
      while (i < zeilen.length && /^\s*>/.test(zeilen[i])) q.push(zeilen[i++].trim().replace(/^>\s?/, ''));
      const qt = q.join(' ');
      const bm = qt.match(/^\*\*(Definition|Merke|Klausurfalle|Beispiel|Tipp|Achtung)\s*:?\*\*\s*:?\s*([\s\S]*)$/i);
      if (bm) {
        const art = {definition:'def', merke:'note', tipp:'note', klausurfalle:'warn', achtung:'warn', beispiel:'ex'}[bm[1].toLowerCase()];
        out.push(`<div class="box ${art}"><span class="lbl">${esc(bm[1])}</span><p>${inline(bm[2])}</p></div>`);
      } else out.push('<blockquote>' + inline(qt) + '</blockquote>');
      continue;
    }
    if ((m = t.match(/^([-*]|\d+\.)\s+/))) {
      const nummeriert = /\d/.test(m[1]), muster = nummeriert ? /^\s*\d+\.\s+/ : /^\s*[-*]\s+/;
      const items = [];
      while (i < zeilen.length && muster.test(zeilen[i])) {
        let text = zeilen[i++].replace(muster, '');
        while (i < zeilen.length && zeilen[i].trim() && !istBlock(zeilen[i])) text += ' ' + zeilen[i++].trim();
        items.push('<li>' + inline(text) + '</li>');
      }
      out.push(nummeriert ? `<ol start="${parseInt(m[1])}">${items.join('')}</ol>` : `<ul>${items.join('')}</ul>`);
      continue;
    }
    const absatz = [t]; i++;
    while (i < zeilen.length && zeilen[i].trim() && !istBlock(zeilen[i])) absatz.push(zeilen[i++].trim());
    const at = absatz.join(' ');
    let am;
    if ((am = at.match(/^Klausurrelevant:\s*(.*)$/))) out.push(`<p class="relevanz"><b>Klausurrelevant</b> ${inline(am[1])}</p>`);
    else if ((am = at.match(/^Alltagsbeispiel:\s*(.*)$/))) out.push(`<p class="alltag"><b>Alltagsbeispiel</b> ${inline(am[1])}</p>`);
    else out.push('<p>' + inline(at) + '</p>');
  }
  return out.join('\n');
}
function zettelCss(s){
  const mono = 'ui-monospace,SFMono-Regular,Menlo,monospace';
  const lbl = `font:600 .72em/1 ${mono};letter-spacing:.09em;text-transform:uppercase`;
  return `
${s}{--fach-text:color-mix(in srgb,var(--fach) 72%,var(--ink));--c-def:#2f6fb0;--c-note:#2f8a5f;--c-warn:#b4532a;--c-ex:#7a5bb5}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) ${s}{--c-def:#7fb0e6;--c-note:#6cc79a;--c-warn:#e8895c;--c-ex:#b79cec}}
:root[data-theme="dark"] ${s}{--c-def:#7fb0e6;--c-note:#6cc79a;--c-warn:#e8895c;--c-ex:#b79cec}
${s} h1{font-size:1.45em;line-height:1.2;letter-spacing:-.02em;margin:0 0 .6em;padding:.55em .8em;border-radius:.8em;text-wrap:balance;
  background:color-mix(in srgb,var(--fach) 9%,transparent);border:1px solid color-mix(in srgb,var(--fach) 24%,transparent)}
${s} h2{font-size:1.1em;margin:1.4em 0 .5em;display:flex;align-items:center;gap:.5em}
${s} h2::before{content:"";width:.55em;height:.55em;border-radius:.18em;background:var(--fach);flex:none}
${s} h3,${s} h4{font-size:.98em;margin:1.1em 0 .3em;color:var(--fach-text)}
${s} .relevanz{display:inline-block;margin:0 0 1em;padding:.35em .85em;border-radius:.8em;font-size:.88em;background:color-mix(in srgb,var(--fach) 12%,transparent);color:var(--fach-text)}
${s} .alltag{margin:0 0 .9em;padding:.6em .85em;border-radius:.8em;background:color-mix(in srgb,var(--muted) 10%,transparent)}
${s} .alltag b{${lbl};display:block;color:var(--muted);margin-bottom:.4em}
${s} .box{--c:var(--fach);margin:0 0 .85em;padding:.7em .9em;border-radius:.8em;
  background:color-mix(in srgb,var(--c) 10%,transparent);border:1px solid color-mix(in srgb,var(--c) 30%,transparent)}
${s} .box.def{--c:var(--c-def)} ${s} .box.note{--c:var(--c-note)} ${s} .box.warn{--c:var(--c-warn)} ${s} .box.ex{--c:var(--c-ex)}
${s} .box .lbl{${lbl};display:block;margin-bottom:.45em;color:color-mix(in srgb,var(--c) 75%,var(--ink))}
${s} .box p{margin:0 0 .3em} ${s} .box p:last-child{margin:0}
${s} code{font:.88em/1.45 ${mono};padding:.1em .38em;border-radius:.35em;background:color-mix(in srgb,var(--fach) 10%,transparent)}
${s} .code{margin:0 0 .9em;border:1px solid var(--line);border-radius:.8em;overflow:hidden;background:var(--panel)}
${s} .code .sp{${lbl};padding:.45em .9em;color:var(--muted);border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--fach) 8%,transparent)}
${s} .code pre{margin:0;padding:.75em .9em;overflow-x:auto;white-space:pre}
${s} pre code{font-size:.9em;padding:0;background:none}
${s} .formel{margin:0 0 .9em;padding:.7em .9em;border-radius:.8em;background:color-mix(in srgb,var(--fach) 8%,transparent);border:1px solid color-mix(in srgb,var(--fach) 35%,transparent)}
${s} .formel .lbl{${lbl};display:block;margin-bottom:.45em;color:var(--fach-text)}
${s} .formel{overflow-x:auto}
${s} .formel .fzeilen{display:grid;grid-template-columns:max-content max-content minmax(0,1fr);column-gap:.5em;align-items:baseline;font:13px/1.6 ${mono}}
@media (min-width:600px){${s} .formel .fzeilen{font-size:14.5px}}
${s} .formel .c{padding:.1em 0}
${s} .formel .neu{border-top:1px solid color-mix(in srgb,var(--fach) 18%,transparent);margin-top:.35em;padding-top:.45em}
${s} .formel .fl{white-space:nowrap}
${s} .formel .fl.ein{padding-left:1.4em}
${s} .formel .fe{color:var(--muted)}
${s} .formel .fs,${s} .formel .flab,${s} .formel .fn{grid-column:1/-1}
${s} .formel .fs{padding-left:2ch;text-indent:-2ch}
${s} .formel .fs.ein{padding-left:calc(1.4em + 2ch)}
${s} .formel .fp{white-space:nowrap}
${s} .formel .fp.lang{white-space:normal;overflow-wrap:anywhere}
${s} .formel .fnote{font:12px/1.4 -apple-system,BlinkMacSystemFont,sans-serif;color:var(--muted);margin-left:.4em;white-space:nowrap}
${s} .formel .fn{font:12px/1.4 -apple-system,BlinkMacSystemFont,sans-serif;color:var(--muted);padding-left:1.4em}
${s} .formel .flab{font:600 12px/1.3 -apple-system,BlinkMacSystemFont,sans-serif;color:var(--fach-text)}
${s} .formel .flab.ein{padding-left:1.4em}
${s} table{border-collapse:separate;border-spacing:0;min-width:100%;border:1px solid var(--line);border-radius:.7em;overflow:hidden;font-size:.92em}
${s} th{font-size:.78em;letter-spacing:.05em;text-transform:uppercase;color:var(--fach-text);background:color-mix(in srgb,var(--fach) 9%,transparent);padding:.5em .7em;border-bottom:1px solid var(--line);text-align:left}
${s} td{padding:.45em .7em;border-bottom:1px solid var(--line);vertical-align:top}
${s} tr:last-child td{border-bottom:0}
${s} blockquote{margin:0 0 .9em;padding:.2em .9em;border-left:3px solid var(--fach);color:var(--muted)}
`;
}
document.getElementById('zettelStil').textContent = zettelCss('.md');

/* ---------- Daten aufbereiten ---------- */
const FAECHER = (D && D.faecher) || [];
const alleFragen = [];
FAECHER.forEach(f => (f.fragen || []).forEach(q => alleFragen.push(Object.assign({}, q, {fach: f.name, kurz: f.kurz}))));
const themaVon = (fach, nr) => (FAECHER.find(f => f.name === fach)?.themen || []).find(t => t.nr === nr);
/* Heute im Quiz wiederholt? Erster Versuch, ab 3 Fragen und 80 % richtig = vorläufig erledigt,
   bis der Mac es beim nächsten Abgleich in den Lernstand einträgt (danach ist es dort ohnehin nicht mehr fällig). */
/* Erledigt-Regel (nach „Successive Relearning“, Rawson & Dunlosky): Ein Thema gilt heute als wiederholt, wenn
   - mindestens 6 verschiedene Fragen dran waren (bei kleineren Themen alle),
   - davon mindestens 80 % im ersten Versuch sicher richtig (Geratenes zählt nicht),
   - jeder Fehler später richtig nachgeholt wurde,
   - mindestens 2 Fragen selbst abgerufen wurden (Lücke oder Karte), sofern das Thema so viele hat. */
function heuteGeuebt(f, t){
  const qs = alleFragen.filter(q => q.fach === f.name && q.nr === t.nr);
  const ziel = Math.min(6, qs.length), freiZiel = Math.min(2, qs.filter(q => q.typ === 'luecke' || q.typ === 'karte').length);
  let n = 0, r = 0, offen = 0, frei = 0;
  qs.forEach(q => {
    const heute = (verlauf[q.id] || []).filter(v => isoTag(new Date(v.t)) === HEUTE);
    if (!heute.length) return;
    n++;
    const gut = v => v.r && v.s !== false;
    if (gut(heute[0])) r++;
    if (!heute.some(v => gut(v) || v.n)) offen++;
    if ((q.typ === 'luecke' || q.typ === 'karte') && heute.some(gut)) frei++;
  });
  const fehlt = [];
  if (n < ziel) fehlt.push(`noch ${ziel - n} ${ziel - n === 1 ? 'Frage' : 'Fragen'}`);
  if (n && r / n < .8) fehlt.push('unter 80 %');
  if (offen) fehlt.push(`${offen} ${offen === 1 ? 'Fehler' : 'Fehler'} nachholen`);
  if (frei < freiZiel) fehlt.push(`${freiZiel - frei} zum Eintippen`);
  const erledigt = n >= ziel && n > 0 && r / n >= .8 && !offen && frei >= freiZiel;
  return {n, r, ziel, erledigt, fehlt, durch: !erledigt && n >= ziel && !offen && r / n < .8};   // durch = genug geübt, aber unter 80 %: morgen wieder
}
/* Karteikasten pro Frage: sicher richtig an aufeinanderfolgenden Tagen → nächster Abstand 1, 3, 7, 14, 30 Tage.
   Falsch oder geraten → morgen wieder. Noch nie gefragt → sofort. */
const ABSTAND = [1, 1, 3, 7, 14, 30];
function frageStufe(q){
  const v = verlauf[q.id] || [];
  if (!v.length) return {neu: true, faellig: true, ueber: 99};
  let stufe = 0, tag = null;
  for (let i = v.length - 1; i >= 0; i--) {
    const d = isoTag(new Date(v[i].t));
    if (d === tag) continue;
    if (!(v[i].r && v[i].s !== false)) break;
    stufe++; tag = d;
  }
  const letzte = v[v.length - 1], seit = (Date.now() - new Date(letzte.t)) / 864e5;
  const abstand = ABSTAND[Math.min(stufe, ABSTAND.length - 1)];
  return {neu: false, stufe, faellig: seit >= abstand - .25, ueber: seit / abstand};
}
function istFaellig(f, t, mitHeute){
  if (!t || t.status === 'offen') return false;
  if (!mitHeute && heuteGeuebt(f, t).erledigt) return false;
  if (t.naechsteWdh && t.naechsteWdh <= HEUTE) return true;
  return (f.faellig || []).some(x => x.nr === t.nr && /fällig|abfragen|wiederhol/i.test(x.titel) && !/nichts mehr fällig/i.test(x.titel));
}
function faelligListe(){
  const l = [];
  FAECHER.forEach(f => f.themen.forEach(t => { if (istFaellig(f, t)) l.push({f, t}); }));
  return l;
}
function heuteErledigtListe(){
  const l = [];
  FAECHER.forEach(f => f.themen.forEach(t => { if (istFaellig(f, t, true) && heuteGeuebt(f, t).erledigt) l.push({f, t}); }));
  return l;
}

/* Verlauf: pro Frage die letzten Antworten (aus diesem Browser und aus der Datenbank) */
let verlauf = speicher.get('verlauf', {});
function merkeAntwort(id, richtig, zeit, sicher){
  (verlauf[id] = verlauf[id] || []).push({t: zeit, r: richtig, s: sicher, rid: runde ? runde.id : undefined});
  verlauf[id] = verlauf[id].slice(-5);
}

/* Runden vom Mac (Briefkasten-Archiv) einmischen: Nach einer Neuinstallation der App
   kommen so Verlauf, „Meine Runden“, „Heute“ und „Tage in Folge“ zurück. Doppeltes wird erkannt. */
(() => {
  const runden = (D && D.runden) || [];
  if (!runden.length) return;
  const meine = speicher.get('meineRunden', []);
  let geaendert = false;
  runden.forEach(r => {
    if (!meine.some(x => x.id === r.id)) {
      const a = r.antworten || [];
      meine.push({id: r.id, start: r.start, wahl: r.wahl, n: a.length, richtig: a.filter(x => x.richtig).length,
        themen: [...new Set(a.map(x => x.nr))].sort(), ok: true,
        fragen: a.map(x => ({id: x.id, r: x.richtig, s: x.sicher, w: x.eingabe ?? null, t: !!x.tippfehler}))});
      geaendert = true;
    }
    (r.antworten || []).forEach(x => {
      const l = verlauf[x.id] = verlauf[x.id] || [];
      // schon da? gleiche Runde (rid) oder eine lokale Antwort aus dem Zeitraum dieser Runde
      const bis = new Date(new Date(r.ende || r.start).getTime() + 60000).toISOString();
      if (l.some(v => v.rid === r.id || v.t === r.start || (String(v.t) >= String(r.start) && String(v.t) <= bis))) return;
      l.push({t: r.start, r: x.richtig, s: x.sicher, rid: r.id, n: !!x.spaeterRichtig});
      l.sort((p, q) => String(p.t).localeCompare(String(q.t)));
      verlauf[x.id] = l.slice(-5);
      geaendert = true;
    });
  });
  if (geaendert) {
    meine.sort((p, q) => String(p.start).localeCompare(String(q.start)));
    speicher.set('meineRunden', meine.slice(-300));
    speicher.set('verlauf', verlauf);
  }
})();

/* ---------- Datenbank (nur im Artifact, sonst null) ---------- */
let db = null, dbStatus = 'pruefe';
(async () => {
  try { db = window.claude && window.claude.use ? await window.claude.use('db') : null; } catch (e) { db = null; }
  dbStatus = db ? 'ok' : 'aus';
  if (db) {
    try {
      const snap = await db.collection('runden').get();
      const neu = {};
      snap.docs.forEach(d => (d.data().antworten || []).forEach(a => (neu[a.id] = neu[a.id] || []).push({t: a.zeit, r: a.richtig, s: a.sicher})));
      Object.keys(neu).forEach(id => { neu[id].sort((a, b) => String(a.t).localeCompare(String(b.t))); verlauf[id] = neu[id].slice(-5); });
      speicher.set('verlauf', verlauf);
    } catch (e) {}
  }
  if (seite === 'quiz' && !runde) render();
})();

/* ---------- Seitenwahl ---------- */
var seite = 'heute';   // var: die Datenbank-Abfrage oben liest sie evtl. schon vorher
function seiteAusHash(){
  const h = location.hash.replace('#', '');
  const vorher = seite;
  seite = h === 'zettel' ? 'faecher' : ['heute', 'quiz', 'faecher', 'einstellungen'].includes(h) ? h : 'heute';
  if (seite === 'faecher' && vorher !== 'faecher') { fachAuswahl = null; offeneFaecher.clear(); }   // neu auf „Fächer“: Gesamtansicht, alles zu
  farbschemaSetzen();
  document.querySelectorAll('nav.tabs a').forEach(a => a.setAttribute('aria-current', a.dataset.s === seite ? 'page' : 'false'));
  render();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', seiteAusHash);
function geheZu(s){ if (location.hash === '#' + s) seiteAusHash(); else location.hash = s; }

function standHinweis(){
  if (!D) return '';
  const alt = tageBis(D.stand) < -1;
  return `<p class="stand${alt ? ' alt' : ''}"><span class="punkt"></span>Stand vom Mac: ${datumKurz(D.stand)} ${esc(D.standZeit || '')}${alt ? ' · etwas älter, am Mac „Handy aktualisieren“ sagen' : ''}</p>`;
}

function render(){
  const app = $('#app');
  if (!D) { app.innerHTML = '<section><h1>Keine Daten</h1><p class="sub">Am Mac „Handy aktualisieren“ sagen.</p></section>'; return; }
  app.innerHTML = ({heute: seiteHeute, quiz: seiteQuiz, faecher: seiteFaecher, einstellungen: seiteEinstellungen})[seite]();
}

/* ---------- Heute ---------- */
function planTag(datum, ueberschrift){
  const t = (D.plan || []).find(x => x.datum === datum);
  if (!t) return `<section><h2>${ueberschrift}</h2><p class="leer">Für diesen Tag steht nichts im Lernplan.</p></section>`;
  const titel = t.titel.replace(/^[^(]*\(?/, '').replace(/\)$/, '');
  const punkte = t.punkte.map(p => `<li class="${p.erledigt ? 'erledigt' : ''}">${p.check ? `<span class="haken${p.erledigt ? ' ja' : ''}">${p.erledigt ? '✓' : ''}</span>` : ''}<span class="txt">${inline(p.text)}</span></li>`).join('');
  return `<section><h2>${ueberschrift} · ${esc(t.titel.split(' (')[0])}</h2>${titel && titel !== t.titel ? `<p class="sub">${esc(titel)}</p>` : ''}<ul class="liste">${punkte || '<li><span class="txt">frei</span></li>'}</ul></section>`;
}
function seiteHeute(){
  const fl = faelligListe();
  const nFragen = alleFragen.length;
  const faelligHtml = fl.length
    ? `<ul class="liste">${fl.map(({f, t}) => {
        const fi = FAECHER.indexOf(f), n = f.fragen.filter(q => q.nr === t.nr).length;
        const hatZettel = f.cheats.some(z => z.nr === t.nr) || f.zettel.some(z => z.nr === t.nr);
        const aktion = n ? `quizStarten(${fi}, Math.min(quizLaenge, ${n}), '${t.nr}')` : hatZettel ? `zeigeZettel(${fi}, '${t.nr}', ${f.cheats.some(z => z.nr === t.nr)})` : '';
        const hinweis = n ? `${n} Fragen` : hatZettel ? 'noch keine Fragen, Zettel öffnen' : 'noch keine Fragen';
        return `<li style="--f:${fachFarbe(f.name)}${aktion ? ';cursor:pointer' : ''}"${aktion ? ` role="button" tabindex="0" onclick="${aktion}" onkeydown="if(event.key==='Enter'){${aktion}}"` : ''}><span class="tag">${esc(f.kurz)} ${t.nr}</span><span class="txt">${esc(t.titel)}<div class="klein">${(g => g.n ? `heute geübt: ${Math.round(g.r / g.n * 100)} % (ab 80 % erledigt)` : t.naechsteWdh ? 'fällig seit ' + datumKurz(t.naechsteWdh) : 'fällig')(heuteGeuebt(f, t))} · <span class="pill ${t.status}">${t.status}</span> · ${hinweis}</div></span>${aktion ? '<span class="pfeil" aria-hidden="true">→</span>' : ''}</li>`;
      }).join('')}</ul>`
    : '<p class="leer">Heute ist nichts fällig. Ein Quiz über alles Gelernte geht trotzdem.</p>';
  const klausuren = FAECHER.filter(f => f.klausur).map(f => tageBis(f.klausur)).filter(n => n >= 0);
  const nochTage = klausuren.length ? Math.min(...klausuren) : null;
  return `
  <section>
    ${nochTage !== null ? `<p class="sub">Noch ${nochTage} Tage bis zur ersten Klausur</p>` : ''}
    <h1>${new Date().toLocaleDateString('de-DE', {weekday: 'long', day: 'numeric', month: 'short'})}</h1>
    ${standHinweis()}
  </section>
  ${window.__KK && !window.__KK.briefkastenAn() ? `<button class="zweit warnhinweis" type="button" onclick="geheZu('einstellungen')">Übertragung zum Mac ist nicht eingerichtet. Hier antippen und unter „Übertragung zum Mac“ den Schlüssel einfügen.</button>` : ''}
  ${nFragen ? tagesbilanzHtml() : ''}
  ${(() => { const v = nFragen ? vorschlaege() : [];
    if (!v.length) return nFragen ? `<p class="leer">Für heute ist alles wiederholt. Ein Quiz geht trotzdem: Quiz-Seite.</p>` : '<p class="leer">Noch keine Quizfragen vorhanden.</p>';
    return `<section><h2>Als Nächstes sinnvoll</h2>${vorschlagKnopf(v[0], true)}
      ${v.length > 1 ? `<ul class="liste" style="margin-top:10px">${v.slice(1, 3).map(x => vorschlagKnopf(x)).join('')}</ul>` : ''}
      ${v.length > 3 ? `<details class="schw"><summary>${v.length - 3} weitere Vorschläge</summary><ul class="liste" style="margin-top:6px">${v.slice(3).map(x => vorschlagKnopf(x)).join('')}</ul></details>` : ''}</section>`; })()}
  ${nFragen ? heuteFaecherHtml() : ''}
  ${(l => l.length ? `<section><h2>Heute geschafft ✓</h2><ul class="liste">${l.map(({f, t}) => { const g = heuteGeuebt(f, t); return `<li style="--f:${fachFarbe(f.name)}" class="erledigt-heute"><span class="haken ja">✓</span><span class="tag">${esc(f.kurz)} ${t.nr}</span><span class="txt">${esc(t.titel)}<div class="klein">${Math.round(g.r)} von ${g.n} richtig · wird beim nächsten Abgleich in den Lernstand eingetragen</div></span></li>`; }).join('')}</ul></section>` : '')(heuteErledigtListe())}
`;
}

/* Fortschritt pro Fach: ein Balken je Fach (sicher, gelernt, wackelig, offen), Tipp öffnet die Fächer-Seite */
function fortschrittHtml(){
  const STUFEN = [['sicher', 'sicher'], ['gelernt', 'gelernt'], ['wackelig', 'wackelig'], ['offen', 'offen']];
  let alle = 0, gelernt = 0;
  const zeilen = FAECHER.map(f => {
    const n = f.themen.length || 1;
    const z = s => f.themen.filter(t => t.status === s).length;
    const g = z('sicher') + z('gelernt') + z('wackelig');
    alle += f.themen.length; gelernt += g;
    const segs = STUFEN.slice(0, 3).map(([s]) => z(s) ? `<span style="width:${z(s) / n * 100}%;background:var(--${s})"></span>` : '').join('');
    return `<li class="fs" style="--f:${fachFarbe(f.name)}" role="button" tabindex="0" onclick="geheZu('faecher')" onkeydown="if(event.key==='Enter')geheZu('faecher')">
      <div class="fs-kopf"><span class="tag">${esc(f.kurz)}</span><span class="fs-zahl">${g}<small> / ${f.themen.length}</small></span></div>
      <div class="bar" aria-label="${g} von ${f.themen.length} Themen gelernt">${segs}</div></li>`;
  }).join('');
  const prozent = alle ? Math.round(gelernt / alle * 100) : 0;
  return `<section><h2>Fortschritt · ${gelernt} von ${alle} Themen (${prozent} %)</h2>
    <ul class="liste fortschrittsliste">${zeilen}</ul>
    <div class="legende">${STUFEN.map(([s, l]) => `<span><i style="background:var(--${s})"></i>${l}</span>`).join('')}</div></section>`;
}

/* ---------- Fächer (mit Lernzetteln) ---------- */
// Themenlisten sind eingeklappt; was aufgeklappt wurde, bleibt es bis zum Neuladen.
const offeneFaecher = new Set();
let zettelSuche = '';
function seiteFaecher(){
  const alle = FAECHER.reduce((n, f) => n + f.themen.length, 0);
  const gel = FAECHER.reduce((n, f) => n + f.themen.filter(t => ['sicher', 'gelernt', 'wackelig'].includes(t.status)).length, 0);
  return `<section><h1>Fächer</h1><p class="sub">${gel} von ${alle} Themen gelernt (${alle ? Math.round(gel / alle * 100) : 0} %) </p></section>
  <input class="suche" id="suche" type="search" placeholder="In allen Lernzetteln suchen" value="${esc(zettelSuche)}" oninput="zettelSuche=this.value;fachInhalt()" autocomplete="off">
  <div class="chips fachsprung">${FAECHER.map((f, fi) => `<button class="chip" type="button" style="--f:${fachFarbe(f.name)}" aria-pressed="${fachAuswahl === fi}" onclick="springeZuFach(${fi})">${esc(f.kurz)}</button>`).join('')}</div>
  <button class="chip gesamt" id="gesamt" type="button" aria-pressed="${fachAuswahl === null}" onclick="springeZuFach(null)">Gesamtansicht · alle 5 Fächer</button>
  <div id="fachinhalt" class="fachliste">${fachInhaltHtml()}</div>`;
}
/* Schnellwahl oben: zum Fach springen und seine Lernzettel aufklappen */
let fachAuswahl = null;   // Schnellwahl: nur dieses Fach zeigen (direkt unter den Kürzeln), null = alle
function springeZuFach(fi){
  if (zettelSuche.trim()) { zettelSuche = ''; $('#suche').value = ''; }
  fachAuswahl = (fi === null || fachAuswahl === fi) ? null : fi;      // nochmal antippen oder „Gesamtansicht“ = alle
  document.querySelectorAll('.fachsprung .chip').forEach((c, i) => c.setAttribute('aria-pressed', i === fachAuswahl));
  const g = $('#gesamt'); if (g) g.setAttribute('aria-pressed', fachAuswahl === null);
  fachInhalt();
  farbschemaSetzen();
}
function fachInhalt(){ $('#fachinhalt').innerHTML = fachInhaltHtml(); }
function fachInhaltHtml(){
  if (zettelSuche.trim()) return zettelTrefferHtml();
  return FAECHER.map((f, fi) => {
    if (fachAuswahl !== null && fi !== fachAuswahl) return '';
    const n = f.themen.length || 1;
    const zahl = s => f.themen.filter(t => t.status === s).length;
    const gel = zahl('sicher') + zahl('gelernt') + zahl('wackelig');
    const bar = ['sicher', 'gelernt', 'wackelig'].map(s => `<span style="width:${zahl(s) / n * 100}%;background:var(--${s})"></span>`).join('');
    const tage = f.klausur ? tageBis(f.klausur) : null;
    // 1. Lernzettel und Cheat Sheets (das Wichtigste)
    const nrs = [...new Set([...f.zettel.map(z => z.nr), ...f.cheats.map(z => z.nr)])].sort();
    const zettel = nrs.map(nr => {
      const z = f.zettel.find(x => x.nr === nr), c = f.cheats.find(x => x.nr === nr);
      return `<li class="zrow"><div class="zkopf"><span class="nr">${nr}</span><span class="t">${esc((z || c).titel.replace(/^\d+\s*[_.:-]?\s*/, ''))}</span></div>
        <div class="zknoepfe">${z ? `<button class="zweit lang" type="button" onclick="zeigeZettel(${fi},'${nr}',false)">Lernzettel</button>` : ''}${c ? `<button class="zweit kurz" type="button" onclick="zeigeZettel(${fi},'${nr}',true)">Cheat Sheet</button>` : ''}</div></li>`;
    }).join('');
    // 2. Themen mit Status (weniger wichtig), Schwächen darunter
    const themen = f.themen.map(t => `<li><span class="nr">${t.nr}</span><span class="t">${esc(t.titel)}${istFaellig(f, t) ? ' <span class="countdown warn">fällig</span>' : ''}</span><span class="pill ${t.status}">${t.status}</span></li>`).join('');
    const schw = f.schwaechen.length ? `<p class="unterkopf">Schwächen</p><ul class="schwliste">${f.schwaechen.map(s => `<li>[${esc(s.nr)}] ${inline(s.text)}</li>`).join('')}</ul>` : '';
    const nF = f.themen.filter(t => istFaellig(f, t)).length;
    const auf = k => offeneFaecher.has(fi + k) ? ' open' : '';
    const merk = k => `ontoggle="this.open ? offeneFaecher.add('${fi + k}') : offeneFaecher.delete('${fi + k}')"`;
    return `<article class="fach" id="fach-${fi}" style="--f:${fachFarbe(f.name)}">
      <div class="kopf"><div><span class="tag">${esc(f.kurz)}</span><div class="name">${esc(f.name)}</div><div class="sub">${gel} von ${f.themen.length} Themen gelernt (${Math.round(gel / n * 100)} %)</div></div>
        ${tage !== null && tage >= 0 ? `<span class="countdown${tage < 21 ? ' warn' : ''}">${tage} Tage</span>` : ''}</div>
      <div class="bar">${bar}</div>
      <details class="fachteil"${auf('z')} ${merk('z')}><summary>Lernzettel und Cheat Sheets <span class="zahl">${nrs.length}</span></summary>
        ${nrs.length ? `<ul class="themen zettelliste">${zettel}</ul>` : '<p class="sub">Noch keine Lernzettel.</p>'}</details>
      <details class="fachteil neben"${auf('t')} ${merk('t')}><summary>Themen und Schwächen <span class="zahl">${f.themen.length}${nF ? ` · ${nF} fällig` : ''}</span></summary>
        <ul class="themen">${themen}</ul>${schw}</details>
    </article>`;
  }).join('');
}
function zettelTrefferHtml(){
  const q = zettelSuche.trim().toLowerCase();
  const eintraege = [];
  FAECHER.forEach((f, fi) => {
    const nrs = [...new Set([...f.zettel.map(z => z.nr), ...f.cheats.map(z => z.nr)])].sort();
    nrs.forEach(nr => {
      const z = f.zettel.find(x => x.nr === nr), c = f.cheats.find(x => x.nr === nr);
      const titel = (z || c).titel;
      const quelle = (z ? z.text : '') + '\n' + (c ? c.text : '');
      const pos = quelle.toLowerCase().indexOf(q);
      if (pos < 0 && !titel.toLowerCase().includes(q)) return;
      let treffer = '';
      if (pos >= 0) {
        const a = Math.max(0, pos - 40), stueck = quelle.slice(a, pos + q.length + 60).replace(/[#>*`|]/g, ' ').replace(/\s+/g, ' ');
        const p = stueck.toLowerCase().indexOf(q);
        treffer = `<div class="treffer">…${esc(stueck.slice(0, p))}<mark>${esc(stueck.slice(p, p + q.length))}</mark>${esc(stueck.slice(p + q.length))}…</div>`;
      }
      eintraege.push(`<li style="--f:${fachFarbe(f.name)}"><span class="tag">${esc(f.kurz)} ${nr}</span><span class="txt">${esc(titel.replace(/^\d+\s*/, ''))}${treffer}</span>
        <span class="knoepfe">${c ? `<button class="zweit" type="button" onclick="zeigeZettel(${fi},'${nr}',true)">Kurz</button>` : ''}${z ? `<button class="zweit" type="button" onclick="zeigeZettel(${fi},'${nr}',false)">Lang</button>` : ''}</span></li>`);
    });
  });
  return eintraege.length ? `<ul class="liste zl">${eintraege.join('')}</ul>` : '<p class="leer">Nichts gefunden.</p>';
}

/* ---------- Einstellungen ---------- */
function seiteEinstellungen(){
  return `<section><h1>Einstellungen</h1>${standHinweis()}</section>
  ${window.__KK ? window.__KK.einstellungenHtml()
    : `<section><h2>App</h2><p class="sub">${dbStatus === 'ok' ? 'Verbunden: Ergebnisse werden gespeichert und beim nächsten Chat am Mac übernommen.' : 'Ohne Verbindung: Ergebnisse bleiben auf dem Handy, am Ende einer Runde kannst du sie kopieren.'}</p></section>`}`;
}

let leserScroll = 0;
function zeigeZettel(fi, nr, kurz){
  const f = FAECHER[fi];
  const z = (kurz ? f.cheats : f.zettel).find(x => x.nr === nr);
  if (!z) return;
  leserScroll = window.scrollY;
  $('#leserTitel').textContent = f.kurz + ' · ' + (kurz ? 'Cheat Sheet' : 'Lernzettel');
  const inhalt = $('#leserInhalt');
  inhalt.style.setProperty('--fach', fachFarbe(f.name));
  inhalt.innerHTML = md(z.text);
  $('#leser').hidden = false; $('#leser').scrollTop = 0; leseStart = Date.now();
  document.body.style.overflow = 'hidden';
}
function leserZu(){ leseZeitBuchen(); $('#leser').hidden = true; document.body.style.overflow = ''; window.scrollTo(0, leserScroll); }
/* Lesezeit in Lernzettel/Cheat Sheet: nur solange einer offen und die App im Vordergrund ist, höchstens 20 Min am Stück.
   Pro Tag gesammelt und (in der Offline-App) als eigener Eintrag „lesen-<Tag>“ über den Briefkasten zum Mac geschickt. */
let leseStart = null;
function leseZeitBuchen(){
  if (!leseStart) return;
  const sek = Math.min(1200, (Date.now() - leseStart) / 1000);
  leseStart = null;
  if (sek < 5) return;
  const tag = HEUTE, l = speicher.get('lesezeit', {});
  l[tag] = Math.round((l[tag] || 0) + sek);
  speicher.set('lesezeit', l);
  if (window.__KK) {
    const offen = speicher.get('offeneRunden', []).filter(x => x.id !== 'lesen-' + tag);
    offen.push({id: 'lesen-' + tag, typ: 'lesen', tag, start: tag + 'T00:00:00', ende: new Date().toISOString(), sekunden: l[tag], antworten: []});
    speicher.set('offeneRunden', offen.slice(-120));
    if (window.__KK.senden) window.__KK.senden();
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') leseZeitBuchen();
  else if (!$('#leser').hidden) leseStart = Date.now();
});
$('#leserZu').addEventListener('click', leserZu);

/* ---------- Quiz ---------- */
let runde = null, quizWahl = null, quizLaenge = 10;

/* Heute in einem Fach geübt: Antworten (erster Versuch) von heute aus dem Verlauf, geraten zählt halb */
function heuteFach(f){
  let n = 0, r = 0;
  f.fragen.forEach(q => (verlauf[q.id] || []).forEach(v => { if (isoTag(new Date(v.t)) === HEUTE) { n++; if (v.r && v.s !== false) r++; else if (v.r) r += .5; } }));
  return {n, r, prozent: n ? Math.round(r / n * 100) : 0};
}
/* Was ist JETZT am sinnvollsten? Ändert sich nach jeder Runde:
   1. fällige Themen, heute noch nicht (unter 3 Fragen) geübt   2. wackelige Themen, heute noch nicht geübt
   3. fällige Themen, heute geübt aber unter 80 %             4. Fächer, die heute noch gar nicht dran waren (gemischt) */
function imPlanHeute(f){
  const heute = (D.plan || []).find(t => t.datum === HEUTE);
  const offen = heute ? heute.punkte.filter(p => !p.erledigt).map(p => p.text) : [];
  const wort = new RegExp('(^|[^A-Za-zÄÖÜäöü])' + f.kurz + '([^A-Za-zÄÖÜäöü]|$)', 'i');
  return offen.some(t => wort.test(t) && /wdh|wiederhol|abfrag|auffrisch/i.test(t));
}
function vorschlaege(){
  const l = [];
  FAECHER.forEach((f, fi) => {
    const tage = f.klausur ? tageBis(f.klausur) : 999, klausurDruck = Math.max(0, 100 - tage) / 10 + (imPlanHeute(f) && !heuteFach(f).n ? 50 : 0);
    f.themen.forEach(t => {
      const anzahl = f.fragen.filter(q => q.nr === t.nr).length;
      if (!anzahl) {
        const zettel = f.cheats.some(z => z.nr === t.nr) || f.zettel.some(z => z.nr === t.nr);
        if (istFaellig(f, t) && zettel) l.push({fi, f, nr: t.nr, t, anzahl: 0, punkte: 90, grund: 'fällig, noch keine Quizfragen: Zettel lesen', zettel: true, kurz: f.cheats.some(z => z.nr === t.nr)});
        return;
      }
      const g = heuteGeuebt(f, t), faellig = istFaellig(f, t), seit = t.naechsteWdh ? -tageBis(t.naechsteWdh) : 0;
      if (faellig && g.durch) l.push({fi, f, nr: t.nr, t, anzahl, punkte: 100 + klausurDruck, grund: `heute ${Math.round(g.r / g.n * 100)} % im ersten Versuch, morgen nochmal`});
      else if (faellig && g.n > 0) l.push({fi, f, nr: t.nr, t, anzahl, punkte: 320 + klausurDruck, grund: `heute angefangen, es fehlt: ${g.fehlt.join(', ')}`});
      else if (faellig) l.push({fi, f, nr: t.nr, t, anzahl, punkte: 300 + seit * 5 + klausurDruck, grund: (t.naechsteWdh ? `fällig seit ${datumKurz(t.naechsteWdh)}` : 'fällig') + (imPlanHeute(f) && !heuteFach(f).n ? ' · laut Plan heute dran' : '')});
      else if (t.status === 'wackelig' && !g.erledigt && !faellig) l.push({fi, f, nr: t.nr, t, anzahl, punkte: 200 + klausurDruck, grund: 'wackelig'});
    });
    if (f.fragen.length && !heuteFach(f).n) l.push({fi, f, nr: null, anzahl: f.fragen.length, punkte: 50 + klausurDruck, grund: 'heute noch nicht wiederholt, gemischt'});
  });
  // Alles Fällige geschafft → gemischte Runde über alle Fächer (Interleaving), fällige Einzelfragen zuerst
  if (!l.some(x => x.punkte >= 200)) l.push({alle: true, punkte: 260, anzahl: alleFragen.length, grund: 'Fälliges geschafft: gemischt über alle Fächer, fällige Einzelfragen zuerst'});
  return l.sort((a, b) => b.punkte - a.punkte);
}
function vorschlagKnopf(v, haupt){
  if (v.alle) return haupt
    ? `<button class="haupt" type="button" onclick="quizStarten('alle', quizLaenge)"><span><span class="vfach" style="--f:var(--ink)">MIX</span>Alle Fächer gemischt<small>${esc(v.grund)}</small></span><span class="pfeil">→</span></button>`
    : `<li class="vorschlag" style="cursor:pointer" role="button" tabindex="0" onclick="quizStarten('alle', quizLaenge)"><span class="tag">MIX</span><span class="txt">Alle Fächer gemischt<div class="klein">${esc(v.grund)}</div></span><span class="pfeil" aria-hidden="true">→</span></li>`;
  const n = v.nr ? `Math.min(quizLaenge, ${v.anzahl})` : 'quizLaenge';
  const aktion = v.zettel ? `zeigeZettel(${v.fi}, '${v.nr}', ${v.kurz})` : `quizStarten(${v.fi}, ${n}${v.nr ? `, '${v.nr}'` : ''})`;
  const titel = v.nr ? `${v.f.kurz} ${v.nr} · ${v.t.titel}` : `${v.f.name} gemischt`;
  return haupt
    ? `<button class="haupt" type="button" style="--f:${fachFarbe(v.f.name)}" onclick="${aktion}"><span><span class="vfach">${esc(v.f.kurz)}${v.nr ? ' ' + esc(v.nr) : ''}</span>${esc(v.nr ? v.t.titel : 'gemischt')}<small>${esc(v.grund)}</small></span><span class="pfeil">→</span></button>`
    : `<li class="vorschlag" style="--f:${fachFarbe(v.f.name)};cursor:pointer" role="button" tabindex="0" onclick="${aktion}" onkeydown="if(event.key==='Enter'){${aktion}}"><span class="tag">${esc(v.f.kurz)}${v.nr ? ' ' + esc(v.nr) : ''}</span><span class="txt">${esc(v.nr ? v.t.titel : 'gemischt')}<div class="klein">${esc(v.grund)}</div></span><span class="pfeil" aria-hidden="true">→</span></li>`;
}
/* Startseite: Tagesbilanz (Runden, Fragen, Quote, Fälliges geschafft, Tage in Folge) */
function tagesbilanzHtml(){
  let n = 0, r = 0;
  const tage = new Set();
  Object.values(verlauf).forEach(l => l.forEach(v => { const d = isoTag(new Date(v.t)); tage.add(d); if (d === HEUTE) { n++; if (v.r && v.s !== false) r++; else if (v.r) r += .5; } }));
  const runden = speicher.get('meineRunden', []).filter(x => x.n > 0 && isoTag(new Date(x.start)) === HEUTE).length;
  let faellig = 0, geschafft = 0;
  FAECHER.forEach(f => f.themen.forEach(t => { if (istFaellig(f, t, true)) { faellig++; if (heuteGeuebt(f, t).erledigt) geschafft++; } }));
  let serie = 0;
  for (let d = new Date(); tage.has(isoTag(d)); d.setDate(d.getDate() - 1)) serie++;
  const anteil = faellig ? geschafft / faellig : 0;
  return `<section class="bilanz">
    <div class="bilanz-zahlen">
      <div><b>${runden || (n ? '–' : 0)}</b><span>${runden === 1 ? 'Runde' : 'Runden'}</span></div>
      <div><b>${n}</b><span>Fragen</span></div>
      <div><b>${n ? Math.round(r / n * 100) + ' %' : '–'}</b><span>richtig</span></div>
      <div><b>${serie}</b><span>${serie === 1 ? 'Tag' : 'Tage'} in Folge</span></div>
    </div>
    ${faellig ? `<div class="bilanz-fort"><div class="bar"><span style="width:${anteil * 100}%;background:var(--sicher)"></span></div>
      <p class="klein">${geschafft === faellig ? 'Alles Fällige für heute geschafft ✓' : `${geschafft} von ${faellig} fälligen Themen heute geschafft`}</p></div>` : ''}
  </section>`;
}
/* Startseite: pro Fach, ob heute schon wiederholt, und was dort noch offen ist */
function heuteFaecherHtml(){
  const zeilen = fachReihenfolge().map(x => {
    const h = x.heute;
    const status = h.n ? `<span class="haken ja">✓</span>` : `<span class="haken"></span>`;
    const text = h.n ? `heute ${h.n} ${h.n === 1 ? 'Frage' : 'Fragen'} · ${h.prozent} % richtig` : 'heute noch nicht wiederholt';
    const offen = x.offen ? `<span class="countdown warn">${x.offen} fällig</span>` : x.faellig ? `<span class="pill wackelig">festigen</span>` : h.n ? `<span class="pill sicher">erledigt</span>` : '';
    return `<li style="--f:${fachFarbe(x.f.name)};cursor:pointer" role="button" tabindex="0" onclick="quizOffen=new Set([${x.fi}]);runde=null;geheZu('quiz')" onkeydown="if(event.key==='Enter'){quizOffen=new Set([${x.fi}]);runde=null;geheZu('quiz')}">
      ${status}<span class="tag">${esc(x.f.kurz)}</span><span class="txt">${esc(x.f.name)} ${offen}<div class="klein">${text}</div></span><span class="pfeil" aria-hidden="true">→</span></li>`;
  }).join('');
  return `<section><h2>Heute wiederholt</h2><ul class="liste">${zeilen}</ul></section>`;
}

/* Welches Fach ist als Erstes dran? Plan von heute (offene Wiederholung) > fällige Themen > wackelige Themen > nächste Klausur */
function fachReihenfolge(){
  const heute = (D.plan || []).find(t => t.datum === HEUTE);
  const offen = heute ? heute.punkte.filter(p => !p.erledigt).map(p => p.text) : [];
  return FAECHER.map((f, fi) => {
    const wort = new RegExp('(^|[^A-Za-zÄÖÜäöü])' + f.kurz + '([^A-Za-zÄÖÜäöü]|$)', 'i');
    const imPlan = offen.some(t => wort.test(t) && /wdh|wiederhol|abfrag|auffrisch/i.test(t));
    const faellig = f.themen.filter(t => istFaellig(f, t));
    const offenF = faellig.filter(t => heuteGeuebt(f, t).n === 0);          // fällig und heute noch nicht angefasst
    const wackelig = f.themen.filter(t => t.status === 'wackelig').length;
    const tage = f.klausur ? tageBis(f.klausur) : 999;
    const h = heuteFach(f);
    const punkte = (imPlan && !h.n ? 1000 : 0) + offenF.length * 100 + (faellig.length - offenF.length) * 15 + wackelig * 10
      + Math.max(0, 100 - tage) / 10 - Math.min(h.n, 20) * 3;
    const grund = offenF.length ? `${offenF.length} ${offenF.length === 1 ? 'Thema' : 'Themen'} fällig`
      : faellig.length ? `heute geübt, ${faellig.length} noch nicht sicher`
      : h.n ? 'Fälliges erledigt' : wackelig ? `${wackelig} wackelig, nichts fällig` : 'nichts fällig';
    return {fi, f, punkte, grund, faellig: faellig.length, offen: offenF.length, heute: h};
  }).filter(x => x.f.fragen.length).sort((a, b) => b.punkte - a.punkte);
}

/* Vorrang beim Auswählen: fällig, wackelig, Schwäche, alte Fehler (sichere Fehler am stärksten), geratene Treffer zählen nur halb */
function punkte(q){
  const f = FAECHER.find(x => x.name === q.fach), t = themaVon(q.fach, q.nr);
  let p = Math.random() * 2;
  if (istFaellig(f, t)) p += 4;
  if (t && t.status === 'wackelig') p += 2; else if (t && t.status === 'gelernt') p += 1;
  if (q.schwaeche) p += 1;
  const v = verlauf[q.id] || [];
  const letzte = v[v.length - 1];
  const k = frageStufe(q);                                  // Karteikasten: fällige Einzelfragen zuerst
  if (k.neu) p += 2;
  else if (k.faellig) p += 3 + Math.min(k.ueber, 3);
  else p -= 5;
  if (letzte && !letzte.r) p += letzte.s ? 6 : 4;          // sicher und falsch: kommt am ehesten wieder
  else if (letzte && letzte.s === false) p += 2;           // richtig, aber geraten
  if (q.typ === 'luecke' || q.typ === 'karte') p += .5;    // selbst abrufen wirkt stärker als wiedererkennen
  return p;
}
function fragenWaehlen(wahl, n, nr){
  const pool = alleFragen.filter(q => (wahl === 'alle' || q.fach === FAECHER[wahl].name) && (!nr || q.nr === nr));
  const sortiert = pool.map(q => ({q, p: punkte(q)})).sort((a, b) => b.p - a.p);
  const proThema = {}, gewaehlt = [];
  const grenze = nr ? n : wahl === 'alle' ? 3 : 4;
  for (const {q} of sortiert) {
    const k = q.fach + q.nr;
    if ((proThema[k] || 0) >= grenze) continue;
    proThema[k] = (proThema[k] || 0) + 1; gewaehlt.push(q);
    if (gewaehlt.length >= n) break;
  }
  for (const {q} of sortiert) { if (gewaehlt.length >= n) break; if (!gewaehlt.includes(q)) gewaehlt.push(q); }
  return mischen(gewaehlt);
}
/* Zufällige Anordnung pro Frage (Optionen, rechte Seiten, Schritte) */
function mischung(q){
  return {
    opt: q.typ === 'mc' ? mischen(q.optionen.map((_, i) => i)) : null,
    rechts: q.typ === 'zuordnung' ? mischen(q.paare.map((_, i) => i)) : null,
    schritte: q.typ === 'reihenfolge' ? mischenAnders(q.schritte.map((_, i) => i)) : null
  };
}
function mischenAnders(a){ for (let k = 0; k < 6; k++) { const m = mischen(a); if (m.some((x, i) => x !== i)) return m; } return a.slice().reverse(); }

let quizThema = null;  // gesetzt, wenn die Runde von einem fälligen Thema aus gestartet wurde
function quizStarten(wahl, n, nr){
  quizWahl = wahl; quizThema = nr || null;
  if (!nr) quizLaenge = n;
  const fragen = fragenWaehlen(wahl, n, nr);
  if (!fragen.length) { runde = null; geheZu('quiz'); return; }
  runde = {
    id: new Date().toISOString().replace(/[:.]/g, '-') + '-' + Math.random().toString(36).slice(2, 6),
    start: new Date().toISOString(), wahl: wahl === 'alle' ? 'alle' : FAECHER[wahl].name, aktivSek: 0, letzteAktion: Date.now(),
    fragen, mix: fragen.map(mischung), pos: 0, antworten: [], beantwortet: false, gespeichert: null,
    vorlaeufig: null, reihe: [], aufgedeckt: false
  };
  geheZu('quiz');
}

/* Stand eines Themas aus dem Verlauf: wie viele Fragen schon gesehen, wann zuletzt geübt, Ergebnis an dem Tag */
function themaStand(f, t){
  const qs = f.fragen.filter(q => q.nr === t.nr);
  let gesehen = 0, zuletzt = null;
  qs.forEach(q => { const v = verlauf[q.id] || []; if (v.length) gesehen++; v.forEach(x => { const d = isoTag(new Date(x.t)); if (!zuletzt || d > zuletzt) zuletzt = d; }); });
  let n = 0, r = 0;
  if (zuletzt) qs.forEach(q => (verlauf[q.id] || []).forEach(x => { if (isoTag(new Date(x.t)) === zuletzt) { n++; if (x.r) r++; } }));
  return {anzahl: qs.length, gesehen, zuletzt, n, r};
}
const tagWort = d => d === HEUTE ? 'heute' : d === isoTag(new Date(Date.now() - 864e5)) ? 'gestern' : 'am ' + datumKurz(d);
let quizOffen = null;   // aufgeklappte Fächer auf der Quiz-Seite (bis zum Neuladen)
function quizFachHtml(x){
  const {f, fi} = x;
  if (!quizOffen) quizOffen = new Set();   // anfangs alle Fächer zu
  const rang = t => istFaellig(f, t) ? 0 : t.status === 'wackelig' ? 1 : 2;
  const themen = f.themen.filter(t => f.fragen.some(q => q.nr === t.nr) || istFaellig(f, t))
    .sort((a, b) => rang(a) - rang(b) || String(a.nr).localeCompare(String(b.nr)));
  const zeilen = themen.map(t => {
    const s = themaStand(f, t), g = heuteGeuebt(f, t);
    const marke = istFaellig(f, t) ? '<span class="countdown warn">fällig</span>'
      : g.erledigt ? '<span class="pill sicher">heute ✓</span>' : `<span class="pill ${t.status}">${t.status}</span>`;
    const info = !s.anzahl ? 'noch keine Fragen'
      : (s.zuletzt ? `zuletzt ${tagWort(s.zuletzt)}: ${s.r} von ${s.n} richtig` : 'noch nicht geübt') + ` · ${s.gesehen} von ${s.anzahl} Fragen gesehen`
        + (g.n && !g.erledigt && istFaellig(f, t) ? ` · bis erledigt: ${g.fehlt.join(', ')}` : '');
    const aktion = s.anzahl ? `quizStarten(${fi}, Math.min(quizLaenge, ${s.anzahl}), '${t.nr}')` : '';
    return `<li style="--f:${fachFarbe(f.name)}${aktion ? ';cursor:pointer' : ''}"${aktion ? ` role="button" tabindex="0" onclick="${aktion}" onkeydown="if(event.key==='Enter'){${aktion}}"` : ''}>
      <span class="tag">${esc(t.nr)}</span><span class="txt">${esc(t.titel)} ${marke}<div class="klein">${info}</div></span>${aktion ? '<span class="pfeil" aria-hidden="true">→</span>' : ''}</li>`;
  }).join('');
  return `<details class="schw themenauf quizfach" style="--f:${fachFarbe(f.name)}"${quizOffen.has(fi) ? ' open' : ''} ontoggle="this.open ? quizOffen.add(${fi}) : quizOffen.delete(${fi})">
    <summary><span class="tag">${esc(f.kurz)}</span> ${esc(f.name)}<div class="klein">${esc(x.grund)} · ${f.fragen.length} Fragen</div></summary>
    <button class="zweit" type="button" onclick="quizStarten(${fi}, quizLaenge)">Ganzes Fach gemischt (${quizLaenge} Fragen)</button>
    <ul class="liste">${zeilen}</ul></details>`;
}

function seiteQuiz(){
  if (runde && runde.pos < runde.fragen.length) return quizFrage();
  if (runde) return quizEnde();
  const reihe = fachReihenfolge();
  const laengen = [5, 10, 20].map(n => `<button class="chip" type="button" aria-pressed="${quizLaenge === n}" onclick="quizLaenge=${n};render()">${n} Fragen</button>`).join('');
  const offline = speicher.get('offeneRunden', []);
  const erstes = reihe[0];
  return `<section><h1>Quiz</h1><p class="sub">Eine Runde, ein Fach. Nur Wiederholung zu Themen, die du schon gelernt hast. Fälliges und alte Fehler kommen zuerst, was du falsch hast, kommt am Ende der Runde noch einmal.</p></section>
  ${erstes ? `
  <section><h2>Länge</h2><div class="chips segment">${laengen}</div></section>
  <section><h2>Fächer und Themen</h2>
    ${reihe.map(x => quizFachHtml(x)).join('')}</section>`
  : '<p class="leer">Noch keine Fragen. Am Mac „Handy aktualisieren“ sagen, dann schreibt der Wiederholer welche.</p>'}
  ${kalibrierungHtml()}
  ${meineRundenHtml()}
  ${offline.length && dbStatus !== 'ok' && !window.__KK ? `<section><h2>Noch nicht übertragen (von Hand)</h2><p class="sub">Ohne Briefkasten-Schlüssel (unten auf der Startseite unter „App“) kommt das nur per Kopieren zum Mac.</p><textarea class="kopie" id="kopieAlt" readonly>${esc(offline.map(rundeAlsText).join('\n\n'))}</textarea><div class="reihe"><button class="zweit" type="button" onclick="kopieren('kopieAlt')">Text kopieren</button><button class="zweit" type="button" onclick="speicher.set('offeneRunden',[]);render()">Liste leeren</button></div></section>` : ''}`;
}

const TYPNAME = {mc: 'Auswahl', wf: 'Richtig oder falsch', zuordnung: 'Zuordnen', luecke: 'Lücke füllen', karte: 'Aufdecken', reihenfolge: 'Reihenfolge', fehler: 'Fehler finden'};
/* Lücke „___“ im Fragetext sichtbar machen */
const mitLuecke = html => html.split('___').join('<span class="luecke">&nbsp;?&nbsp;</span>');
/* Antwort vergleichen: Groß/klein, Leerzeichen, Minus- und Anführungszeichen-Varianten egal */
/* Tippfehler-Regel (offline, ohne KI): Fachbegriffe dürfen 1–2 Buchstaben abweichen, Code muss exakt stimmen.
   Code = Sonderzeichen wie < > = " ; . ( ) $ oder Wörter mit Bindestrich/Unterstrich (font-weight, max_len).
   Fragen mit "streng": true (z. B. Schreibweise ist der Lernpunkt) immer exakt. Die KI am Mac bewertet später nach. */
const istCode = s => /[<>="'`;.,(){}\[\]$#\/\\:_@!?+*|&%]/.test(s) || /\w-\w/.test(s) || /\d/.test(s);
function abstand(a, b){   // Buchstaben-Abstand (Einfügen, Löschen, Ersetzen, zwei vertauscht)
  const m = a.length, n = b.length, d = Array.from({length: m + 1}, (_, i) => [i].concat(Array(n).fill(0)));
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[m][n];
}
function lueckePruefen(q, eingabe){
  const loes = q.antworten || [];
  if (loes.some(x => normal(x) === normal(eingabe))) return {richtig: true, tippfehler: false};
  // streng: markiert, oder die Lücke steht in Code (Backticks, spitze/geschweifte Klammern im Fragetext)
  if (q.streng || /[`<>{}]/.test(String(q.frage))) return {richtig: false, tippfehler: false};
  const e = normal(eingabe);
  const nah = loes.some(x => {
    if (istCode(x) || istCode(eingabe)) return false;
    const z = normal(x), grenze = z.length <= 4 ? 0 : z.length <= 8 ? 1 : 2;
    return grenze > 0 && abstand(e, z) <= grenze;
  });
  return {richtig: nah, tippfehler: nah};
}
const normal = s => String(s ?? '').toLowerCase().replace(/[`\s]/g, '').replace(/[−–—]/g, '-').replace(/[„“”'‚‘’]/g, '"').replace(/[×*]/g, '·');

function quizFrage(){
  const r = runde, q = r.fragen[r.pos], i = r.pos, mix = r.mix[i];
  const fertig = r.beantwortet, a = r.antworten[i], v = r.vorlaeufig;
  let koerper = '', brauchtSicherheit = true, bereit = !!v;
  if (q.typ === 'mc') {
    koerper = '<div class="optionen">' + mix.opt.map((oi, k) => {
      let kl = '';
      if (fertig) { if (oi === q.richtig) kl = ' richtig'; else if (a.wahl === oi) kl = ' falsch'; }
      else if (v && v.wahl === oi) kl = ' gewaehlt';
      return `<button class="opt${kl}" type="button" ${fertig ? 'disabled' : `onclick="waehle(${oi})"`}><span class="b">${'ABCD'[k]}</span><span>${quizText(q.optionen[oi])}</span></button>`;
    }).join('') + '</div>';
  } else if (q.typ === 'wf') {
    koerper = '<div class="wf">' + [true, false].map(w => {
      let kl = '';
      if (fertig) { if (w === q.richtig) kl = ' richtig'; else if (a.wahl === w) kl = ' falsch'; }
      else if (v && v.wahl === w) kl = ' gewaehlt';
      return `<button class="opt${kl}" type="button" ${fertig ? 'disabled' : `onclick="waehle(${w})"`}>${w ? 'Richtig' : 'Falsch'}</button>`;
    }).join('') + '</div>';
  } else if (q.typ === 'zuordnung') {
    bereit = false;
    koerper = '<div class="zuo">' + q.paare.map((p, k) => {
      const gew = a ? a.wahl[k] : null;
      const kl = fertig ? (gew === k ? ' richtig' : ' falsch') : '';
      return `<label for="z${k}">${quizText(p[0])}
        <select id="z${k}" class="${kl.trim()}" ${fertig ? 'disabled' : ''} onchange="bereitPruefen()">
          <option value="">bitte wählen</option>${mix.rechts.map(ri => `<option value="${ri}"${gew === ri ? ' selected' : ''}>${esc(q.paare[ri][1].replace(/`/g, ''))}</option>`).join('')}
        </select>${fertig && gew !== k ? `<span class="loes">richtig: ${quizText(p[1])}</span>` : ''}</label>`;
    }).join('') + '</div>';
  } else if (q.typ === 'luecke') {
    bereit = false;
    koerper = fertig
      ? `<div class="eingabe-erg ${a.richtig ? 'richtig' : 'falsch'}"><span class="klein">Deine Antwort${a.tippfehler ? ' (kleiner Tippfehler, zählt als richtig)' : ''}</span><code>${esc(a.wahl || '–')}</code></div>
         ${a.richtig && !a.tippfehler ? '' : `<div class="eingabe-erg richtig"><span class="klein">Richtig</span><code>${esc(q.antworten[0])}</code></div>`}`
      : `<input id="lin" class="lueckenfeld" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Antwort eintippen" oninput="bereitPruefen()" onkeydown="if(event.key==='Enter'&&this.value.trim())abschicken(null)">`;
  } else if (q.typ === 'karte') {
    brauchtSicherheit = false;
    koerper = r.aufgedeckt || fertig
      ? `<div class="karte-antwort">${quizText(q.antwort)}</div>
         ${fertig ? '' : `<p class="sub">Hast du es gewusst? Sei ehrlich zu dir.</p><div class="wf"><button class="opt" type="button" onclick="selbst(true)">Gewusst</button><button class="opt" type="button" onclick="selbst(false)">Nicht gewusst</button></div>`}`
      : `<p class="sub">Erst im Kopf antworten (am besten halblaut), dann aufdecken.</p><button class="haupt" type="button" onclick="runde.aufgedeckt=true;render()"><span>Aufdecken</span><span class="pfeil">→</span></button>`;
  } else if (q.typ === 'reihenfolge') {
    const gelegt = fertig ? a.wahl : r.reihe;
    bereit = !fertig && gelegt.length === q.schritte.length;
    const liste = gelegt.map((si, k) => {
      const kl = fertig ? (si === k ? ' richtig' : ' falsch') : '';
      return `<li><button class="schritt${kl}" type="button" ${fertig ? 'disabled' : `onclick="schrittWeg(${k})"`}><span class="b">${k + 1}</span><span>${quizText(q.schritte[si])}</span></button></li>`;
    }).join('');
    const rest = fertig ? [] : mix.schritte.filter(si => !gelegt.includes(si));
    koerper = `<ol class="schritte">${liste || '<li class="leer-hinweis">Tippe unten die Schritte in der richtigen Reihenfolge an.</li>'}</ol>
      ${rest.length ? `<div class="vorrat">${rest.map(si => `<button class="schritt" type="button" onclick="schrittDazu(${si})">${quizText(q.schritte[si])}</button>`).join('')}</div>` : ''}
      ${fertig && !a.richtig ? `<p class="sub">Richtige Reihenfolge:</p><ol class="loesung">${q.schritte.map(s => `<li>${quizText(s)}</li>`).join('')}</ol>` : ''}`;
  } else if (q.typ === 'fehler') {
    koerper = `<div class="tokens">${q.teile.map((t, k) => {
      let kl = '';
      if (fertig) { if (k === q.falsch) kl = ' richtig'; else if (a.wahl === k) kl = ' falsch'; }
      else if (v && v.wahl === k) kl = ' gewaehlt';
      return `<button class="token${kl}" type="button" ${fertig ? 'disabled' : `onclick="waehle(${k})"`}>${esc(t)}</button>`;
    }).join('')}</div>${fertig ? `<p class="sub">Richtig wäre: ${quizText(q.korrektur || '')}</p>` : ''}`;
  }

  // Abschicken: bei Wiederholungen in der Runde ohne Sicherheitsfrage
  let senden = '';
  if (!fertig && brauchtSicherheit) {
    senden = q._wdh
      ? `<button class="haupt" id="sendKnopf" type="button" onclick="abschicken(null)" ${bereit ? '' : 'disabled'}><span>Prüfen</span><span class="pfeil">✓</span></button>`
      : `<div class="sicherheit"><p class="sub">Wie sicher bist du?</p><div class="wf">
          <button class="opt sendKnopf" type="button" onclick="abschicken(true)" ${bereit ? '' : 'disabled'}>Sicher</button>
          <button class="opt sendKnopf" type="button" onclick="abschicken(false)" ${bereit ? '' : 'disabled'}>Geraten</button></div></div>`;
  }
  const rueck = fertig ? `<div class="rueck ${a.richtig ? 'ok' : 'bad'}"><b>${a.richtig ? (a.tippfehler ? 'Richtig, nur ein kleiner Tippfehler. ' : '') + (a.sicher === false ? 'Richtig, aber geraten. Kommt bald wieder.' : a.tippfehler ? '' : 'Richtig') : (a.sicher ? 'Nicht ganz, obwohl du sicher warst. Gut merken!' : 'Nicht ganz')}</b>${quizText(q.erklaerung || '')}${!a.richtig && !q._wdh ? '<div class="klein" style="margin-top:6px">Kommt am Ende der Runde noch einmal.</div>' : ''}</div>
    <button class="haupt" type="button" onclick="weiter()"><span>${r.pos + 1 < r.fragen.length ? 'Weiter' : 'Ergebnis ansehen'}</span><span class="pfeil">→</span></button>` : '';
  const t = themaVon(q.fach, q.nr);
  const ersteZahl = r.fragen.filter(x => !x._wdh).length;
  return `<div class="fortschritt" aria-hidden="true"><span style="width:${(i + (fertig ? 1 : 0)) / r.fragen.length * 100}%"></span></div>
  <div class="frage" style="--f:${fachFarbe(q.fach)}">
    <div class="meta"><span class="tag">${esc(q.kurz)} ${esc(q.nr)}</span><span>${q._wdh ? 'Noch einmal' : `Frage ${Math.min(i + 1, ersteZahl)} von ${ersteZahl}`} · ${TYPNAME[q.typ] || ''}</span></div>
    ${t ? `<p class="sub" style="margin-top:-6px">${esc(t.titel)}</p>` : ''}
    <p class="text">${mitLuecke(quizText(q.frage))}</p>
    ${koerper}
    ${senden}
  </div>
  ${rueck}
  <button class="zweit" type="button" onclick="abbrechen()">Runde beenden</button>`;
}

/* Eingaben */
function waehle(w){
  runde.vorlaeufig = {wahl: w}; render();
  const k = document.querySelector('.sicherheit, #sendKnopf');   // Sicherheitsknöpfe ins Bild holen
  if (k) k.scrollIntoView({block: 'nearest', behavior: 'smooth'});
}
function schrittDazu(si){ runde.reihe.push(si); render(); }
function schrittWeg(k){ runde.reihe.splice(k, 1); render(); }
function bereitPruefen(){
  const q = runde.fragen[runde.pos];
  let ok = false;
  if (q.typ === 'zuordnung') ok = q.paare.every((_, k) => $('#z' + k).value);
  if (q.typ === 'luecke') ok = !!$('#lin').value.trim();
  document.querySelectorAll('.sendKnopf, #sendKnopf').forEach(b => b.disabled = !ok);
}
function abschicken(sicher){
  const r = runde, q = r.fragen[r.pos];
  let wahl, richtig, tipp = false;
  if (q.typ === 'mc' || q.typ === 'wf') { wahl = r.vorlaeufig.wahl; richtig = wahl === q.richtig; }
  else if (q.typ === 'fehler') { wahl = r.vorlaeufig.wahl; richtig = wahl === q.falsch; }
  else if (q.typ === 'zuordnung') { wahl = q.paare.map((_, k) => Number($('#z' + k).value)); richtig = wahl.every((w, k) => w === k); }
  else if (q.typ === 'luecke') { wahl = $('#lin').value.trim(); const p = lueckePruefen(q, wahl); richtig = p.richtig; tipp = p.tippfehler; }
  else if (q.typ === 'reihenfolge') { wahl = r.reihe.slice(); richtig = wahl.every((si, k) => si === k); }
  beantworte(wahl, richtig, q._wdh ? null : sicher, tipp);
}
function selbst(gewusst){ beantworte(null, gewusst, null); }

function beantworte(wahl, richtig, sicher, tippfehler){
  const r = runde, q = r.fragen[r.pos], zeit = new Date().toISOString();
  // aktive Lernzeit: Zeit seit der letzten Antwort, höchstens 3 Min pro Frage (Pausen zählen nicht)
  r.aktivSek = (r.aktivSek || 0) + Math.min(180, Math.max(0, (Date.now() - (r.letzteAktion || Date.now())) / 1000));
  r.letzteAktion = Date.now();
  r.antworten[r.pos] = {wahl, richtig, sicher, tippfehler: !!tippfehler};
  r.beantwortet = true; r.vorlaeufig = null;
  if (!q._wdh) {
    merkeAntwort(q.id, richtig, zeit, sicher);
    speicher.set('verlauf', verlauf);
  } else if (richtig) {                                    // Fehler in derselben Runde nachgeholt
    const e = (verlauf[q.id] || []).filter(v => v.rid === r.id).pop();
    if (e) { e.n = true; speicher.set('verlauf', verlauf); }
  }
  // Falsches kommt am Ende der Runde wieder, höchstens zweimal pro Frage
  if (!richtig && r.fragen.filter(x => x.id === q.id).length < 3) {
    const kopie = Object.assign({}, q, {_wdh: true});
    r.fragen.push(kopie); r.mix.push(mischung(kopie));
  }
  render();
  rundeLokalMerken();
  rundeSichern();
}
function weiter(){ Object.assign(runde, {pos: runde.pos + 1, beantwortet: false, vorlaeufig: null, reihe: [], aufgedeckt: false}); render(); window.scrollTo(0, 0); }
function abbrechen(){ if (!runde.antworten.filter(Boolean).length) { runde = null; render(); return; } runde.pos = runde.fragen.length; render(); }

/* Gespeichert wird nur der erste Versuch je Frage, dazu, ob sie in der Runde später noch richtig wurde */
function rundeDaten(){
  const r = runde;
  const spaeter = id => r.fragen.some((x, i) => x._wdh && x.id === id && r.antworten[i] && r.antworten[i].richtig);
  return {
    start: r.start, ende: new Date().toISOString(), wahl: r.wahl, importiert: false, aktivSek: Math.round(r.aktivSek || 0),
    antworten: r.fragen.map((q, i) => (!q._wdh && r.antworten[i]) ? {
      id: q.id, fach: q.fach, nr: q.nr, typ: q.typ, frage: String(q.frage).slice(0, 160),
      richtig: r.antworten[i].richtig, sicher: r.antworten[i].sicher,
      ...(q.typ === 'luecke' ? {eingabe: String(r.antworten[i].wahl || '').slice(0, 120), tippfehler: !!r.antworten[i].tippfehler} : {}),
      spaeterRichtig: r.antworten[i].richtig ? null : spaeter(q.id), zeit: r.start
    } : null).filter(Boolean)
  };
}
let sichernLaeuft = false, sichernNochmal = false;
async function rundeSichern(){
  if (!runde) return;
  if (!db) { offlineMerken(); return; }
  if (sichernLaeuft) { sichernNochmal = true; return; }
  sichernLaeuft = true;
  const r = runde;
  try { await db.collection('runden').doc(r.id).set(rundeDaten()); r.gespeichert = 'ok'; rundeLokalMerken(); }
  catch (e) { r.gespeichert = 'fehler'; offlineMerken(); }
  sichernLaeuft = false;
  if (sichernNochmal) { sichernNochmal = false; rundeSichern(); }
}
/* Meine Runden: Übersicht auf diesem Gerät (Fach, Ergebnis, Themen, übertragen?) */
function rundeLokalMerken(){
  if (!runde) return;
  const d = rundeDaten();
  const l = speicher.get('meineRunden', []);
  const alt = l.find(x => x.id === runde.id);
  const kurzWahl = w => (typeof w === 'string' ? w.slice(0, 120) : (typeof w === 'number' || typeof w === 'boolean') ? w : null);
  const eintrag = {id: runde.id, start: d.start, wahl: d.wahl, n: d.antworten.length,
    richtig: d.antworten.filter(a => a.richtig).length,
    themen: [...new Set(d.antworten.map(a => a.nr))].sort(),
    fragen: runde.fragen.map((q, i) => (!q._wdh && runde.antworten[i]) ? {id: q.id, r: runde.antworten[i].richtig, s: runde.antworten[i].sicher, w: kurzWahl(runde.antworten[i].wahl), t: !!runde.antworten[i].tippfehler} : null).filter(Boolean),
    ok: runde.gespeichert === 'ok' || (alt && alt.ok) || false};
  speicher.set('meineRunden', l.filter(x => x.id !== runde.id).concat([eintrag]).slice(-300));
}
/* Lösung und eigene Antwort einer Frage als kurzer Text (für „Meine Runden“) */
function loesungHtml(q){
  if (q.typ === 'mc') return quizText(q.optionen[q.richtig]);
  if (q.typ === 'wf') return q.richtig ? 'Richtig' : 'Falsch';
  if (q.typ === 'luecke') return `<code>${esc(q.antworten[0])}</code>`;
  if (q.typ === 'karte') return quizText(q.antwort || '');
  if (q.typ === 'fehler') return `Fehler bei <code>${esc(q.teile[q.falsch])}</code>${q.korrektur ? ' · ' + quizText(q.korrektur) : ''}`;
  if (q.typ === 'zuordnung') return '<ul class="mini">' + q.paare.map(p => `<li>${quizText(p[0])} → ${quizText(p[1])}</li>`).join('') + '</ul>';
  if (q.typ === 'reihenfolge') return '<ol class="mini">' + q.schritte.map(x => `<li>${quizText(x)}</li>`).join('') + '</ol>';
  return '';
}
function deineHtml(q, w){
  if (w === null || w === undefined || w === '') return '';
  if (q.typ === 'mc' && q.optionen[w] !== undefined) return quizText(q.optionen[w]);
  if (q.typ === 'wf' && typeof w === 'boolean') return w ? 'Richtig' : 'Falsch';
  if (q.typ === 'luecke' && typeof w === 'string') return `<code>${esc(w)}</code>`;
  if (q.typ === 'fehler' && q.teile[w] !== undefined) return `<code>${esc(q.teile[w])}</code> markiert`;
  return '';
}
const offeneRundenAuf = new Set(), offeneRundenFach = new Set();
function rundeFragen(x){
  if (x.fragen) return x.fragen;
  const o = speicher.get('offeneRunden', []).find(y => y.id === x.id);
  return o ? (o.antworten || []).map(a => ({id: a.id, r: a.richtig, s: a.sicher, w: a.eingabe ?? null, t: !!a.tippfehler})) : null;
}
const KI_URTEIL = {richtig: ['sicher', 'KI: eigentlich richtig'], fast: ['gelernt', 'KI: fast richtig'], verwechselt: ['wackelig', 'KI: verwechselt'], falsch: ['wackelig', 'KI: falsch']};
function rundeDetailHtml(x){
  const fr = rundeFragen(x);
  const ki = (D && D.bewertungen) || {};
  if (!fr) return '<p class="sub">Die einzelnen Fragen dieser Runde sind auf diesem Gerät nicht gespeichert.</p>';
  return `<ul class="rfragen">${fr.map(e => {
    const q = alleFragen.find(y => y.id === e.id);
    if (!q) return `<li class="${e.r ? 'ok' : 'bad'}"><span class="haken ${e.r ? 'ja' : 'nein'}">${e.r ? '✓' : '✗'}</span><span class="txt klein">Diese Frage gibt es nicht mehr.</span></li>`;
    const deine = (!e.r || e.t) ? deineHtml(q, e.w) : '';
    const b = ki[x.id + '|' + e.id], u = b && KI_URTEIL[b.u];
    const marke = (e.r ? (e.s === false ? ' <span class="pill wackelig">geraten</span>' : '') : (e.s ? ' <span class="pill wackelig">war sicher</span>' : ''))
      + (e.t ? ' <span class="pill gelernt">Tippfehler</span>' : '') + (u ? ` <span class="pill ${u[0]}">${u[1]}</span>` : '');
    return `<li class="${e.r ? 'ok' : 'bad'}"><span class="haken ${e.r ? 'ja' : 'nein'}">${e.r ? '✓' : '✗'}</span><span class="txt">
      <span class="tag">${esc(q.nr)}</span> ${mitLuecke(quizText(q.frage))}${marke}
      ${deine ? `<div class="klein">Deine Antwort: ${deine}</div>` : ''}
      <div class="klein"><b>Richtig:</b> ${loesungHtml(q)}</div>
      ${b && b.k ? `<div class="erkl"><b>KI:</b> ${esc(b.k)}</div>` : ''}
      ${q.erklaerung ? `<div class="erkl">${quizText(q.erklaerung)}</div>` : ''}</span></li>`;
  }).join('')}</ul>`;
}
/* Selbsteinschätzung (Kalibrierung): Wie oft stimmt „sicher“ wirklich? Sichere Fehler sind die gefährlichsten. */
function kalibrierungHtml(){
  const proFach = {};
  let sicherN = 0, sicherF = 0, geratenN = 0, geratenR = 0;
  alleFragen.forEach(q => (verlauf[q.id] || []).forEach(v => {
    if (v.s === true) { sicherN++; if (!v.r) { sicherF++; (proFach[q.fach] = proFach[q.fach] || {n: 0, f: 0}).f++; } (proFach[q.fach] = proFach[q.fach] || {n: 0, f: 0}).n++; }
    else if (v.s === false) { geratenN++; if (v.r) geratenR++; }
  }));
  if (sicherN < 10) return '';
  const quote = Math.round((sicherN - sicherF) / sicherN * 100);
  const schlimm = Object.entries(proFach).filter(([, x]) => x.n >= 5).map(([name, x]) => ({name, q: x.f / x.n, f: x.f})).sort((a, b) => b.f - a.f).slice(0, 2).filter(x => x.f);
  return `<section><h2>Selbsteinschätzung</h2><div class="liste" style="padding:12px 14px">
    <div><b>${quote} %</b> richtig, wenn du dir sicher warst${quote < 85 ? ' · da lohnt sich genaueres Hinschauen' : ''}</div>
    ${geratenN >= 5 ? `<div class="klein" style="margin-top:4px">Geraten: ${Math.round(geratenR / geratenN * 100)} % trotzdem richtig, diese Fragen kommen bald wieder</div>` : ''}
    ${schlimm.length ? `<div class="klein" style="margin-top:4px">Am häufigsten „sicher, aber falsch“: ${schlimm.map(x => `${esc((FAECHER.find(f => f.name === x.name) || {}).kurz || x.name)} (${x.f}×)`).join(', ')}</div>` : ''}
  </div></section>`;
}
function meineRundenHtml(){
  const l = speicher.get('meineRunden', []).filter(x => x.n > 0).slice().reverse();
  if (!l.length) return '';
  const tag = iso => { const d = new Date(iso); const t = isoTag(d); return (t === HEUTE ? 'heute' : t === isoTag(new Date(Date.now() - 864e5)) ? 'gestern' : datumKurz(t)) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const wartend = l.filter(x => !x.ok).length;
  const gruppen = [];
  l.forEach(x => { let g = gruppen.find(y => y.name === x.wahl); if (!g) gruppen.push(g = {name: x.wahl, runden: []}); g.runden.push(x); });
  return `<section><h2>Meine Runden</h2>
    ${gruppen.map(g => {
      const f = FAECHER.find(y => y.name === g.name);
      const n = g.runden.reduce((s, x) => s + x.n, 0), r = g.runden.reduce((s, x) => s + x.richtig, 0);
      return `<details class="schw themenauf quizfach" style="--f:${fachFarbe(g.name)}"${offeneRundenFach.has(g.name) ? ' open' : ''} ontoggle="this.open ? offeneRundenFach.add(this.dataset.n) : offeneRundenFach.delete(this.dataset.n)" data-n="${esc(g.name)}">
        <summary><span class="tag">${esc(f ? f.kurz : 'Mix')}</span> ${esc(f ? f.name : 'Gemischt')}<div class="klein">${g.runden.length} ${g.runden.length === 1 ? 'Runde' : 'Runden'} · ${r} von ${n} richtig · zuletzt ${tag(g.runden[0].start)}</div></summary>
        ${g.runden.slice(0, 30).map(x => `<details class="runde"${offeneRundenAuf.has(x.id) ? ' open' : ''} ontoggle="this.open ? offeneRundenAuf.add('${x.id}') : offeneRundenAuf.delete('${x.id}')">
          <summary><span class="txt"><b>${x.richtig} von ${x.n}</b> richtig<div class="klein">${tag(x.start)} · Thema ${x.themen.join(', ')}</div></span>
          <span class="pill ${x.ok ? 'sicher' : 'wackelig'}">${x.ok ? 'übertragen' : 'wartet'}</span></summary>
          ${offeneRundenAuf.has(x.id) ? rundeDetailHtml(x) : '<div class="lade" data-id="' + x.id + '"></div>'}</details>`).join('')}
      </details>`;
    }).join('')}</section>`;
}
/* Runde aufklappen: Fragen erst dann einsetzen (spart Arbeit bei vielen Runden) */
document.addEventListener('toggle', e => {
  const d = e.target;
  if (!d.classList || !d.classList.contains('runde') || !d.open) return;
  const platz = d.querySelector('.lade');
  if (!platz) return;
  const x = speicher.get('meineRunden', []).find(y => y.id === platz.dataset.id);
  if (x) platz.outerHTML = rundeDetailHtml(x);
}, true);
function offlineMerken(){
  const liste = speicher.get('offeneRunden', []).filter(x => x.id !== runde.id);
  liste.push(Object.assign({id: runde.id}, rundeDaten()));
  speicher.set('offeneRunden', liste.slice(-100));
  runde.gespeichert = 'lokal';
  if (window.__KK && window.__KK.senden) window.__KK.senden(runde.id);
}
function rundeAlsText(d){
  const gruppen = {};
  d.antworten.forEach(a => { const k = a.fach + '|' + a.nr; (gruppen[k] = gruppen[k] || []).push(a); });
  return `Handy-Quiz ${String(d.start).slice(0, 16).replace('T', ' ')}\n` + Object.keys(gruppen).map(k => {
    const [fach, nr] = k.split('|'), l = gruppen[k];
    const falsch = l.filter(a => !a.richtig).map(a => a.id + (a.sicher ? ' (sicher)' : ''));
    const geraten = l.filter(a => a.richtig && a.sicher === false).length;
    return `- ${fach}, Thema ${nr}: ${l.filter(a => a.richtig).length} von ${l.length} im ersten Versuch${geraten ? `, davon ${geraten} geraten` : ''}${falsch.length ? ' (falsch: ' + falsch.join(', ') + ')' : ''}`;
  }).join('\n');
}
async function kopieren(id){
  const feld = $('#' + id);
  try { await navigator.clipboard.writeText(feld.value); feld.insertAdjacentHTML('afterend', '<p class="sub">Kopiert. In die Claude-App einfügen.</p>'); }
  catch (e) { feld.focus(); feld.select(); }
}

function quizEnde(){
  const r = runde;
  const erste = r.fragen.map((q, i) => ({q, a: r.antworten[i]})).filter(x => x.a && !x.q._wdh);
  const richtig = erste.filter(x => x.a.richtig).length;
  const geraten = erste.filter(x => x.a.richtig && x.a.sicher === false).length;
  const falsche = erste.filter(x => !x.a.richtig);
  const sicherFalsch = falsche.filter(x => x.a.sicher).length;
  const nachgeholt = falsche.filter(x => r.fragen.some((y, i) => y._wdh && y.id === x.q.id && r.antworten[i] && r.antworten[i].richtig)).length;
  const bk = window.__KK && window.__KK.briefkastenAn && window.__KK.briefkastenAn();
  const gesichert = r.gespeichert === 'ok'
    ? 'Gespeichert. Beim nächsten Chat am Mac kommt das in deinen Lernstand.'
    : bk ? 'Gespeichert. Wird automatisch zum Mac übertragen, sobald Internet da ist (unter „Meine Runden“ steht dann „übertragen“).'
    : window.__KK ? 'Die Übertragung zum Mac ist auf diesem Handy nicht eingerichtet: Einstellungen → „Übertragung zum Mac“ → Schlüssel einfügen. Bis dahin bleibt das Ergebnis hier gespeichert.'
    : 'Keine Verbindung zur Ablage: Ergebnis bleibt auf dem Handy. Kopier den Text und schick ihn mir in der Claude-App.';
  const zeilen = [
    geraten ? `${geraten} davon geraten, die kommen bald wieder` : '',
    falsche.length ? `${nachgeholt} von ${falsche.length} Fehlern in der Runde noch richtig nachgeholt` : '',
    sicherFalsch ? `${sicherFalsch} ${sicherFalsch === 1 ? 'Fehler' : 'Fehler'} trotz „sicher“: genau die lohnen sich zum Merken` : ''
  ].filter(Boolean);
  return `<section><p class="sub">Runde fertig</p><p class="ergebnis">${richtig} <small>von ${erste.length} im ersten Versuch</small></p>
    ${zeilen.length ? `<ul class="ende-info">${zeilen.map(z => `<li>${esc(z)}</li>`).join('')}</ul>` : ''}</section>
  ${falsche.length ? `<section><h2>Noch mal anschauen</h2><ul class="liste">${falsche.map(({q, a}) => `<li style="--f:${fachFarbe(q.fach)}"><span class="tag">${esc(q.kurz)} ${esc(q.nr)}</span><span class="txt">${mitLuecke(quizText(q.frage))}${a.sicher ? ' <span class="pill wackelig">war sicher</span>' : ''}<div class="klein">${quizText(q.erklaerung || '')}</div></span></li>`).join('')}</ul></section>` : '<p class="leer">Alles im ersten Versuch richtig. Diese Fragen kommen erst in ein paar Tagen wieder.</p>'}
  <p class="sub">${gesichert}</p>
  ${r.gespeichert === 'ok' || bk ? '' : `<textarea class="kopie" id="kopieNeu" readonly>${esc(rundeAlsText(rundeDaten()))}</textarea><button class="zweit" type="button" onclick="kopieren('kopieNeu')">Text kopieren</button>`}
  ${(v => v ? `<section><h2>Als Nächstes sinnvoll</h2>${vorschlagKnopf(v, true)}</section>` : '<p class="leer">Für heute ist alles Fällige wiederholt.</p>')(vorschlaege()[0])}
  <button class="zweit" type="button" style="width:100%" onclick="quizStarten(quizWahl, quizLaenge)">Noch eine Runde: ${esc(FAECHER[quizWahl]?.name || '')}${quizThema ? ' gemischt' : ''}</button>
  <div class="reihe"><button class="zweit" type="button" onclick="runde=null;render();window.scrollTo(0,0)">Anderes Fach wählen</button>
  <button class="zweit" type="button" onclick="runde=null;geheZu('heute')">Zurück zu Heute</button></div>`;
}

/* ---------- Nach unten ziehen = aktualisieren (wie auf normalen Webseiten) ----------
   Nur ganz oben auf der Seite, nicht während einer Quizfrage und nicht im geöffneten Lernzettel.
   In der Offline-App: Runden senden, neuen Stand holen (bei Neuem neu laden). Sonst: Seite neu laden. */
(() => {
  // In Safari als normaler Tab gibt es das schon eingebaut, dort nicht doppelt
  const eigeneSeite = window.top === window, alsApp = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  if (eigeneSeite && !alsApp && !/[?&]ziehtest/.test(location.search)) return;
  const anzeige = document.createElement('div');
  anzeige.id = 'ziehen'; anzeige.innerHTML = '<span class="ziehen-kreis">↓</span>';
  document.body.appendChild(anzeige);
  let start = null, weg = 0, laeuft = false;
  const SCHWELLE = 80;
  const darf = () => !laeuft && window.scrollY <= 0 && $('#leser').hidden && !(runde && runde.pos < runde.fragen.length);
  document.addEventListener('touchstart', e => { start = darf() && e.touches.length === 1 ? e.touches[0].clientY : null; weg = 0; }, {passive: true});
  document.addEventListener('touchmove', e => {
    if (start === null) return;
    weg = Math.max(0, e.touches[0].clientY - start);
    if (window.scrollY > 0) { start = null; weg = 0; }
    const d = Math.min(weg * .5, SCHWELLE * .9);
    anzeige.style.transform = `translate(-50%, ${d - 50}px)`;
    anzeige.style.opacity = Math.min(1, weg / SCHWELLE);
    anzeige.classList.toggle('bereit', weg >= SCHWELLE * 1.6);
  }, {passive: true});
  document.addEventListener('touchend', async () => {
    if (start === null) return;
    const los = weg >= SCHWELLE * 1.6;
    start = null;
    if (!los) { anzeige.style.transform = ''; anzeige.style.opacity = 0; anzeige.classList.remove('bereit'); return; }
    laeuft = true; anzeige.classList.add('dreht'); anzeige.style.transform = 'translate(-50%, 16px)'; anzeige.style.opacity = 1;
    try {
      if (window.__KK && window.__KK.ziehen) await window.__KK.ziehen();
      else location.reload();
    } finally {
      laeuft = false; anzeige.classList.remove('dreht', 'bereit'); anzeige.style.transform = ''; anzeige.style.opacity = 0;
      render();
    }
  });
})();

seiteAusHash();
