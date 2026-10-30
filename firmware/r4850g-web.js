// ============================================================================
// Pagina web per l'alimentatore Huawei R4850G / R48xx (firmware ESPHome v12)
// https://github.com/tecno-consulenza/r4850g-esphome  (licenza MIT)
// Va messa nella stessa cartella del file yaml della scheda: ESPHome la
// salva dentro la scheda e la serve all'indirizzo http://IP-della-scheda
// Legge i valori dal flusso /events e manda i comandi con le chiamate
// REST di ESPHome (POST /dominio/nome/azione).
// ============================================================================

const VERSIONE_PAGINA = "12";

// ----------------------------------------------------------------------------
// Stato: ultimo valore ricevuto per ogni voce e funzioni da avvisare
// ----------------------------------------------------------------------------
const voci = new Map();
const ascoltatori = new Map();

function ascolta(id, fn) {
  if (!ascoltatori.has(id)) ascoltatori.set(id, []);
  ascoltatori.get(id).push(fn);
  if (voci.has(id)) fn(voci.get(id));
}

function aggiorna(d) {
  if (!d || typeof d.id !== "string") return;
  const v = Object.assign(voci.get(d.id) || {}, d);
  voci.set(d.id, v);
  (ascoltatori.get(d.id) || []).forEach((fn) => {
    try { fn(v); } catch (e) { console.error(e); }
  });
}

// valore numerico di una voce (NaN se sconosciuto)
function num(v) {
  if (!v) return NaN;
  if (v.state === "NA") return NaN;
  const x = typeof v.value === "number" ? v.value : parseFloat(v.value);
  return Number.isFinite(x) ? x : NaN;
}
function numId(id) { return num(voci.get(id)); }

function fmt(x, dec) {
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString("it-IT", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function decStep(step) {
  const s = String(step);
  return s.includes(".") ? s.split(".")[1].replace(/0+$/, "").length : 0;
}

function minuti(m) {
  if (!Number.isFinite(m)) return "—";
  m = Math.round(m);
  const h = Math.floor(m / 60), r = m % 60;
  return h > 0 ? `${h} h ${r} min` : `${r} min`;
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ----------------------------------------------------------------------------
// Comandi verso la scheda
// ----------------------------------------------------------------------------
function url(id, azione) {
  const i = id.indexOf("/");
  return "/" + id.slice(0, i) + "/" + encodeURIComponent(id.slice(i + 1)) + "/" + azione;
}

async function invia(id, azione) {
  const r = await fetch(url(id, azione), { method: "POST" });
  if (!r.ok) throw new Error("HTTP " + r.status);
}

// ----------------------------------------------------------------------------
// Avvisi in basso
// ----------------------------------------------------------------------------
let timerAvviso = null;
function avviso(testo, tipo = "ok") {
  const el = document.getElementById("avviso");
  el.textContent = testo;
  el.className = "avviso mostra " + tipo;
  clearTimeout(timerAvviso);
  timerAvviso = setTimeout(() => { el.className = "avviso"; }, 3200);
}

// ----------------------------------------------------------------------------
// Icone (disegnate qui per non dipendere da internet)
// ----------------------------------------------------------------------------
const ICO = {
  casa: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  fasi: '<path d="M3 20h5v-5h5v-5h5V5h3"/>',
  orologio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  ingranaggio: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M4.2 6.2l2.1 2.1M17.7 15.7l2.1 2.1M2.5 12h3M18.5 12h3M4.2 17.8l2.1-2.1M17.7 8.3l2.1-2.1"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  power: '<path d="M12 3v8"/><path d="M6.3 6.9a8 8 0 1 0 11.4 0"/>',
  sole: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.5 1.5M17.2 17.2l1.5 1.5M5.3 18.7l1.5-1.5M17.2 6.8l1.5-1.5"/>',
  luna: '<path d="M20 14.6A8.2 8.2 0 0 1 9.4 4a8.2 8.2 0 1 0 10.6 10.6z"/>',
  auto: '<circle cx="12" cy="12" r="8.5"/><path class="pieno" d="M12 3.5a8.5 8.5 0 0 1 0 17z"/>',
  wifi: '<path d="M2.5 9a14 14 0 0 1 19 0"/><path d="M5.5 12.5a9.5 9.5 0 0 1 13 0"/><path d="M8.7 16a5 5 0 0 1 6.6 0"/><circle cx="12" cy="19.3" r="1"/>',
};
const icona = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICO[n]}</svg>`;

// ----------------------------------------------------------------------------
// Stile
// ----------------------------------------------------------------------------
// colori del tema scuro: valgono con il tema "Scuro" e, con "Automatico",
// quando il telefono o il computer è impostato in modalità scura
const SCURO = `color-scheme:dark;--bg:#11161b;--card:#1a2128;--ink:#e6ebef;--muted:#93a0ab;--line:#2b343d;--acc:#3fb0ef;--acc2:#16303f;--on:#0d1418;
--ok:#3ccf7e;--okbg:#14301f;--warn:#f0a83a;--warnbg:#3a2c12;--err:#ff6b62;--errbg:#3d1a18;--track:#2b343d;--shadow:none`;

const CSS = `
:root{color-scheme:light;--bg:#f3f5f7;--card:#fff;--ink:#1b2127;--muted:#5f6b76;--line:#dde3e8;--acc:#0872ac;--acc2:#e8f4fb;--on:#fff;
--ok:#17814a;--okbg:#e5f6ec;--warn:#985d00;--warnbg:#fff3dc;--err:#c42d25;--errbg:#fde8e7;--track:#e4e9ed;--shadow:0 1px 3px rgba(0,0,0,.06),0 1px 2px rgba(0,0,0,.04)}
@media (prefers-color-scheme:dark){:root:not([data-tema=chiaro]){${SCURO}}}
:root[data-tema=scuro]{${SCURO}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif}
esp-app{display:none}
header{position:sticky;top:0;z-index:5;background:var(--card);border-bottom:1px solid var(--line);padding:10px 16px calc(10px) 16px}
.testa{max-width:1120px;margin:0 auto;display:flex;align-items:center;gap:12px}
.testa h1{font-size:17px;margin:0;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.testa .sotto{font-size:12px;color:var(--muted)}
.testa .tit{flex:1;min-width:0}
.conn{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);white-space:nowrap}
.pall{width:9px;height:9px;border-radius:50%;background:var(--muted)}
.conn.on .pall{background:var(--ok)}.conn.off .pall{background:var(--err)}
.tema{display:flex;gap:2px;padding:2px;border:1px solid var(--line);border-radius:11px;background:var(--bg);flex:none}
.tema button{display:flex;align-items:center;justify-content:center;gap:5px;min-width:34px;height:32px;padding:0 7px;border:0;border-radius:9px;background:none;color:var(--muted);font:inherit;font-size:13px;font-weight:600;cursor:pointer}
.tema button svg{width:18px;height:18px;flex:none;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
.tema button svg .pieno{fill:currentColor;stroke:none}
.tema button[aria-checked=true]{background:var(--card);color:var(--acc);box-shadow:0 1px 3px rgba(0,0,0,.18)}
.tema button:focus-visible{outline:2px solid var(--acc);outline-offset:1px}
.tema .et{display:none}
nav.schede{display:flex;gap:4px;max-width:1120px;margin:8px auto 0}
nav.schede button{flex:1;display:flex;align-items:center;justify-content:center;gap:7px;border:0;background:none;color:var(--muted);font:inherit;font-weight:600;font-size:14px;padding:8px 6px;border-radius:9px;cursor:pointer}
nav.schede button svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
nav.schede button[aria-selected=true]{color:var(--acc);background:var(--acc2)}
main{max-width:1120px;margin:0 auto;padding:14px 16px 28px}
.banner{display:none;max-width:1120px;margin:10px auto 0;padding:9px 14px;border-radius:10px;background:var(--warnbg);color:var(--warn);font-weight:600;font-size:14px}
.banner.mostra{display:block}
section.scheda{display:none}section.scheda.attiva{display:block}
.griglia{display:grid;gap:14px;grid-template-columns:1fr}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px;box-shadow:var(--shadow)}
.card h2{font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin:0 0 10px;font-weight:700}
.nota{font-size:13px;color:var(--muted);margin:6px 0 0}
.stato{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.pill{display:inline-flex;align-items:center;gap:8px;font-weight:700;font-size:20px}
.pill i{width:13px;height:13px;border-radius:50%;background:var(--muted);box-shadow:0 0 0 4px var(--track)}
.pill.acceso i{background:var(--ok);box-shadow:0 0 0 4px var(--okbg)}.pill.spento i{background:var(--muted)}
.pill.errore i{background:var(--err);box-shadow:0 0 0 4px var(--errbg)}.pill.assente i{background:var(--warn);box-shadow:0 0 0 4px var(--warnbg)}
.fase{font-size:13px;color:var(--muted);margin-top:3px}
.az{display:flex;gap:10px}
.btn{border:1px solid var(--line);background:var(--card);color:var(--ink);font:inherit;font-weight:600;padding:10px 16px;border-radius:11px;cursor:pointer;min-height:44px;display:inline-flex;align-items:center;justify-content:center;gap:8px}
.btn svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round}
.btn:active{transform:translateY(1px)}.btn:disabled{opacity:.5;cursor:default}
.btn.verde{background:var(--ok);border-color:var(--ok);color:var(--on)}.btn.rosso{background:var(--card);border-color:var(--err);color:var(--err)}
.btn.prim{background:var(--acc);border-color:var(--acc);color:var(--on)}
.btn.conferma{background:var(--warnbg);border-color:var(--warn);color:var(--warn)}
.btn.largo{flex:1}
.indicatori{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.colonne{display:grid;grid-template-columns:1fr;gap:14px}
.ind{text-align:center;padding:8px 6px 10px}
.ind svg{width:100%;max-width:210px;display:block;margin:0 auto}
.ind .nome{font-size:13px;font-weight:600;color:var(--muted);margin-top:2px}
.ind .extra{font-size:12px;color:var(--muted);margin-top:2px;min-height:17px}
.g-track{fill:none;stroke:var(--track);stroke-width:14;stroke-linecap:round}
.g-val{fill:none;stroke:var(--acc);stroke-width:14;stroke-linecap:round;transition:stroke-dasharray .6s ease}
.g-mark{stroke:var(--ink);stroke-width:3;stroke-linecap:round;transition:transform .6s ease}
.g-num{font-size:30px;font-weight:700;fill:var(--ink);text-anchor:middle}
.g-unit{font-size:17px;font-weight:600;fill:var(--muted);text-anchor:middle}
.g-lim{font-size:14px;fill:var(--muted);text-anchor:middle}
.tiles{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
.tile{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 12px;box-shadow:var(--shadow)}
.tile .n{font-size:12px;color:var(--muted)}.tile .v{font-size:19px;font-weight:700;margin-top:1px;white-space:nowrap}
.tile .v small{font-size:12px;font-weight:600;color:var(--muted);margin-left:3px}
.campo{padding:10px 0;border-top:1px solid var(--line)}.campo:first-of-type{border-top:0;padding-top:2px}
.campo label{display:block;font-weight:600;margin-bottom:6px}
.ctl{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.ctl input{width:96px;font:inherit;font-size:17px;font-weight:600;padding:9px 10px;border:1.5px solid var(--line);border-radius:10px;background:var(--bg);color:var(--ink);text-align:right}
.ctl select{font:inherit;font-size:17px;font-weight:600;padding:9px 8px;border:1.5px solid var(--line);border-radius:10px;background:var(--bg);color:var(--ink);min-width:70px}
.campo.mod select{border-color:var(--acc);background:var(--acc2)}.campo.err select{border-color:var(--err);background:var(--errbg)}
.ctl input:focus{outline:none;border-color:var(--acc)}
.ctl .u{color:var(--muted);font-weight:600;min-width:18px}
.passo{width:44px;height:44px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--ink);font-size:21px;font-weight:600;cursor:pointer;line-height:1}
.campo .imposta{display:none}.campo.mod .imposta{display:inline-flex}
.ctl input.largo{flex:1 1 0;width:0;min-width:0;max-width:320px;text-align:left}
.ctl:has(input.largo){flex-wrap:nowrap}
.corto{display:none}
.scelta{display:flex;gap:18px;flex-wrap:wrap;padding:2px 0 8px;font-weight:600}.scelta input{accent-color:var(--acc);width:18px;height:18px;vertical-align:-3px}
.esito{margin-top:10px;font-size:13px;font-weight:600;color:var(--warn)}.esito.ok{color:var(--ok)}.esito.err{color:var(--err)}
.campo.err input.largo{border-color:var(--err);background:var(--errbg)}
.campo.mod input{border-color:var(--acc);background:var(--acc2)}
.campo.err input{border-color:var(--err);background:var(--errbg)}
.campo .info{font-size:12px;color:var(--muted);margin-top:5px}
.campo .msg{font-size:13px;font-weight:600;margin-top:4px;min-height:0}
.campo .msg.ok{color:var(--ok)}.campo .msg.err{color:var(--err)}.campo .msg.warn{color:var(--warn)}
.interr{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:4px 0}
.interr .t{font-weight:600}
.sw{position:relative;width:54px;height:32px;border-radius:16px;border:0;background:var(--track);cursor:pointer;flex:none;transition:background .2s}
.sw::after{content:"";position:absolute;left:3px;top:3px;width:26px;height:26px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:left .2s}
.sw[aria-checked=true]{background:var(--ok)}.sw[aria-checked=true]::after{left:25px}.sw:disabled{opacity:.6}
.tabfasi{width:100%;border-collapse:collapse}
.tabfasi th{font-size:12px;color:var(--muted);text-align:left;font-weight:600;padding:0 4px 6px}
.tabfasi td{padding:6px 4px;border-top:1px solid var(--line);vertical-align:top}
.tabfasi td.f{font-weight:700;white-space:nowrap;padding-top:16px}
.tabfasi .campo{padding:0;border:0}.tabfasi .campo label{display:none}
.tabfasi .ctl input{width:84px}.tabfasi .passo{display:none}
.tabfasi .info{display:none}
.scala svg{width:100%;height:auto;display:block}
.sc-ax{stroke:var(--line);stroke-width:1}.sc-step{fill:none;stroke:var(--acc);stroke-width:3;stroke-linejoin:round}
.sc-area{fill:var(--acc2)}.sc-t{font-size:11px;fill:var(--muted)}.sc-now{stroke:var(--err);stroke-width:2;stroke-dasharray:4 3}
.sc-nowt{font-size:11px;fill:var(--err);font-weight:700}
.righe{display:grid;grid-template-columns:auto 1fr;gap:8px 14px;font-size:14px}
.righe dt{color:var(--muted)}.righe dd{margin:0;font-weight:600;text-align:right;word-break:break-all}
.righe dd.codice{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;font-weight:500}
.grande{font-size:34px;font-weight:700;line-height:1.1}
.bottoni{display:flex;gap:10px;flex-wrap:wrap}
.slider{display:flex;align-items:center;gap:12px}.slider input{flex:1;accent-color:var(--acc);height:32px}
.slider .val{font-weight:700;min-width:48px;text-align:right}
.puntino{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:7px;background:var(--muted);vertical-align:0}
.puntino.ok{background:var(--ok)}.puntino.warn{background:var(--warn)}.puntino.err{background:var(--err)}
.avviso{position:fixed;left:50%;bottom:86px;transform:translate(-50%,20px);opacity:0;pointer-events:none;background:var(--ink);color:var(--card);padding:10px 16px;border-radius:12px;font-weight:600;font-size:14px;transition:all .25s;z-index:20;max-width:calc(100% - 32px);text-align:center}
.avviso.mostra{opacity:1;transform:translate(-50%,0)}.avviso.err{background:var(--err);color:var(--on)}
.vuoto .v,.vuoto .g-num{opacity:.45}
footer{max-width:1120px;margin:0 auto;padding:0 16px 24px;color:var(--muted);font-size:12px}
.consenso{position:fixed;inset:0;z-index:40;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px}
.consenso[hidden]{display:none}
.consenso-box{background:var(--card);color:var(--ink);border-radius:16px;padding:20px 22px;max-width:460px;width:100%;box-shadow:0 10px 30px rgba(0,0,0,.25)}
.consenso-box h2{margin:0 0 10px;font-size:18px}.consenso-box p{margin:0 0 10px;font-size:14px}
.consenso-box .bottoni{margin-top:14px}.consenso-box .btn{flex:1}
.link{border:0;background:none;color:var(--muted);text-decoration:underline;font:inherit;font-size:13px;cursor:pointer;padding:4px 0}
@media (max-width:899px){
  nav.schede{position:fixed;left:0;right:0;bottom:0;margin:0;background:var(--card);border-top:1px solid var(--line);padding:6px 6px calc(6px + env(safe-area-inset-bottom));gap:2px;z-index:10}
  nav.schede button{flex-direction:column;gap:2px;font-size:11px;padding:5px 2px}
  nav.schede button svg{width:23px;height:23px}
  nav.schede button[aria-selected=true]{background:none}
  nav.schede .lungo{display:none}nav.schede .corto{display:inline}
  main{padding-bottom:96px}footer{padding-bottom:96px}
  .indicatori{grid-template-columns:repeat(2,1fr);gap:6px 4px}
  .ind{padding:4px 0 6px}.ind svg{max-width:148px}.g-num{font-size:32px}.ind .nome{font-size:13px}
  .card.indcard{padding:10px 6px}
}
@media (max-width:599px){ .conn.on #conntxt{display:none} .testa{gap:10px} }
@media (max-width:420px){ .ind .extra{font-size:11px} .btn{padding:10px 12px} .ctl input{width:88px} }
@media (min-width:900px){
  .tema .et{display:inline}
  .avviso{bottom:24px}
  .griglia.due{grid-template-columns:1fr 1fr}
  .tiles{grid-template-columns:repeat(2,1fr)}
  .tile .v{font-size:22px}
  .colonne{grid-template-columns:1.25fr 1fr;align-items:start}
}
`;

// ----------------------------------------------------------------------------
// Pezzi di pagina
// ----------------------------------------------------------------------------
const N = (n) => "number/" + n, S = (n) => "sensor/" + n, T = (n) => "text_sensor/" + n, B = (n) => "button/" + n;

function campo(nome, opz = {}) {
  const id = N(nome);
  return `<div class="campo" data-num="${esc(id)}" data-dec="${opz.dec ?? ""}">
    <label>${esc(opz.etichetta || nome)}</label>
    <div class="ctl">
      ${opz.senzaPassi ? "" : '<button class="passo" data-passo="-1" aria-label="meno">−</button>'}
      <input type="text" inputmode="decimal" autocomplete="off" enterkeyhint="done" aria-label="${esc(nome)}">
      <span class="u"></span>
      ${opz.senzaPassi ? "" : '<button class="passo" data-passo="1" aria-label="più">+</button>'}
      <button class="btn prim imposta">Imposta</button>
    </div>
    <div class="info"></div><div class="msg"></div>
  </div>`;
}

const opzioni = (n) => Array.from({ length: n }, (_, i) => `<option value="${i}">${String(i).padStart(2, "0")}</option>`).join("");

function campoOra(nome, numOra, numMin) {
  return `<div class="campo" data-ora="${esc(N(numOra))}" data-min="${esc(N(numMin))}">
    <label>${esc(nome)}</label>
    <div class="ctl">
      <select class="sel-h" aria-label="${esc(nome)}: ora"><option value="">--</option>${opzioni(24)}</select><span class="u">:</span>
      <select class="sel-m" aria-label="${esc(nome)}: minuti"><option value="">--</option>${opzioni(60)}</select>
      <button class="btn prim imposta">Imposta</button>
    </div>
    <div class="msg"></div>
  </div>`;
}

function campoTesto(id, etichetta, opz = {}) {
  return `<div class="campo" data-testo="${esc(id)}" data-tipo="${opz.tipo || ""}" ${opz.vuotoOk ? 'data-vuotook="1"' : ""}>
    <label>${esc(etichetta)}</label>
    <div class="ctl"><input type="text" class="largo" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="${esc(opz.placeholder || "")}" aria-label="${esc(etichetta)}"><button class="btn prim imposta">Imposta</button></div>
    <div class="msg"></div>
  </div>`;
}

function bottone(nome, testo, conferma, classe = "") {
  return `<button class="btn ${classe}" data-btn="${esc(B(nome))}" ${conferma ? 'data-conferma="1"' : ""}>${esc(testo)}</button>`;
}

function tile(id, nome, dec, unita, conv) {
  return `<div class="tile" data-tile="${esc(id)}" data-dec="${dec}" data-unita="${esc(unita)}" ${conv ? `data-conv="${conv}"` : ""}><div class="n">${esc(nome)}</div><div class="v">—</div></div>`;
}

// indicatore a lancetta: arco di 270 gradi
const G = { cx: 100, cy: 100, r: 78 };
function punto(a) {
  const rad = (a * Math.PI) / 180;
  return [G.cx + G.r * Math.sin(rad), G.cy - G.r * Math.cos(rad)];
}
function arco(a0, a1) {
  const [x0, y0] = punto(a0), [x1, y1] = punto(a1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${G.r} ${G.r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}
function indicatore(chiave, nome) {
  const d = arco(-135, 135);
  return `<div class="ind" data-ind="${chiave}">
    <svg viewBox="0 0 200 182" role="img" aria-label="${esc(nome)}">
      <path class="g-track" d="${d}"/>
      <path class="g-val" d="${d}" pathLength="100" stroke-dasharray="0 100"/>
      <line class="g-mark" x1="100" y1="14" x2="100" y2="31" style="transform-origin:100px 100px;transform:rotate(-135deg);opacity:0"/>
      <text class="g-num" x="100" y="110">—</text>
      <text class="g-unit" x="100" y="134"></text>
      <text class="g-lim g-min" x="45" y="178"></text>
      <text class="g-lim g-max" x="155" y="178"></text>
    </svg>
    <div class="nome">${esc(nome)}</div><div class="extra"></div>
  </div>`;
}

function pagina() {
  return `
<header>
  <div class="testa">
    <div class="tit"><h1 id="titolo">Alimentatore R4850G</h1><div class="sotto" id="sottotitolo">collegamento in corso…</div></div>
    <div class="conn" id="conn"><span class="pall"></span><span id="conntxt">in attesa</span></div>
    <div class="tema" id="tema" role="radiogroup" aria-label="Aspetto della pagina">
      <button type="button" role="radio" data-tema="auto" aria-checked="true" title="Automatico: segue l'impostazione del telefono o del computer">${icona("auto")}<span class="et">Auto</span></button>
      <button type="button" role="radio" data-tema="chiaro" aria-checked="false" title="Sempre chiaro">${icona("sole")}<span class="et">Chiaro</span></button>
      <button type="button" role="radio" data-tema="scuro" aria-checked="false" title="Sempre scuro">${icona("luna")}<span class="et">Scuro</span></button>
    </div>
  </div>
  <nav class="schede" role="tablist">
    <button role="tab" data-scheda="principale">${icona("casa")}<span>Principale</span></button>
    <button role="tab" data-scheda="fasi">${icona("fasi")}<span class="lungo">Carica a fasi</span><span class="corto">Fasi</span></button>
    <button role="tab" data-scheda="orari">${icona("orologio")}<span>Orari</span></button>
    <button role="tab" data-scheda="impostazioni">${icona("ingranaggio")}<span>Impostazioni</span></button>
    <button role="tab" data-scheda="rete">${icona("wifi")}<span>Rete</span></button>
    <button role="tab" data-scheda="info">${icona("info")}<span>Info</span></button>
  </nav>
</header>
<div class="banner" id="banner">Collegamento con la scheda perso: riprovo…</div>
<main>

<section class="scheda" id="s-principale">
  <div class="griglia">
    <div class="card">
      <div class="stato">
        <div><div class="pill" id="pill"><i></i><span id="statotxt">—</span></div><div class="fase" id="fasetxt"></div></div>
        <div class="az">
          <button class="btn verde" data-btn="${B("Accendi")}">${icona("power")}Accendi</button>
          <button class="btn rosso" data-btn="${B("Spegni")}">${icona("power")}Spegni</button>
        </div>
      </div>
    </div>
    <div class="card indcard">
      <div class="indicatori">
        ${indicatore("v", "Tensione")}
        ${indicatore("a", "Corrente")}
        ${indicatore("w", "Potenza")}
        ${indicatore("r", "Rendimento")}
      </div>
    </div>
    <div class="colonne">
      <div class="card">
        <h2>Regolazioni</h2>
        ${campo("Tensione di carica")}
        ${campo("Corrente di carica")}
        ${campo("Limite rete AC", { etichetta: "Limite dalla rete AC (0 = nessuno)" })}
        <div class="campo"><div class="interr"><span class="t">Carica a fasi</span><button class="sw" role="switch" aria-checked="false" data-sw="switch/Carica a fasi attiva" aria-label="Carica a fasi"></button></div></div>
      </div>
      <div class="tiles">
        ${tile(S("Energia erogata"), "Energia erogata", 2, "kWh", "wh")}
        ${tile(S("Energia dalla rete"), "Energia dalla rete", 2, "kWh", "wh")}
        ${tile(S("Rendimento medio"), "Rendimento medio", 1, "%")}
        ${tile(S("Potenza AC"), "Potenza dalla rete", 0, "W")}
        ${tile(S("Tensione AC"), "Tensione rete", 1, "V")}
        ${tile(S("Corrente AC"), "Corrente rete", 2, "A")}
        ${tile(S("Temp. uscita"), "Temp. uscita", 1, "°C")}
        ${tile(S("Temp. ingresso"), "Temp. ingresso", 1, "°C")}
        ${tile(S("Giri ventola"), "Ventola", 0, "giri/min")}
        ${tile(S("Frequenza AC"), "Frequenza rete", 2, "Hz")}
      </div>
    </div>
  </div>
</section>

<section class="scheda" id="s-fasi">
  <div class="griglia">
    <div class="card">
      <div class="interr"><div><div class="t">Carica a fasi attiva</div><div class="fase" id="fasetxt2"></div></div><button class="sw" role="switch" aria-checked="false" data-sw="switch/Carica a fasi attiva" aria-label="Carica a fasi attiva"></button></div>
      <p class="nota">Ogni fase scatta quando la batteria raggiunge la sua tensione e da lì usa la sua corrente, mai oltre la Corrente di carica. Dopo la durata della fase 4 l'alimentatore si spegne.</p>
    </div>
    <div class="colonne">
      <div class="card">
        <h2>Fasi</h2>
        <table class="tabfasi">
          <tr><th></th><th>Tensione di inizio</th><th>Corrente</th></tr>
          ${[1, 2, 3, 4].map((i) => `<tr><td class="f">${i}</td><td>${campo(`Fase ${i} tensione`, { senzaPassi: true })}</td><td>${campo(`Fase ${i} corrente`, { senzaPassi: true })}</td></tr>`).join("")}
        </table>
        ${campo("Fase 4 durata", { etichetta: "Durata della fase 4 (bilanciamento)" })}
        ${campo("Ripartenza fasi", { etichetta: "Ripartenza: sotto questa tensione il ciclo ricomincia" })}
      </div>
      <div class="griglia">
        <div class="card scala"><h2>Corrente in funzione della tensione</h2><div id="scala"></div></div>
        <div class="card">
          <h2>Valori pronti</h2>
          <div class="bottoni">
            ${bottone("Valori 16 celle", "16 celle LiFePO4", true)}
            ${bottone("Valori 15 celle", "15 celle LiFePO4", true)}
            ${bottone("Salva valori", "Salva i miei valori", true)}
            ${bottone("Richiama valori", "Richiama i miei valori", true)}
          </div>
          <p class="nota">I pulsanti chiedono una conferma: tocca una seconda volta entro 4 secondi.</p>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="scheda" id="s-orari">
  <div class="griglia due">
    <div class="card">
      <h2>Adesso</h2>
      <div class="grande" id="oraatt">—</div>
      <dl class="righe" style="margin-top:12px">
        <dt>Prossima accensione</dt><dd id="accfra">—</dd>
        <dt>Prossimo spegnimento</dt><dd id="spefra">—</dd>
        <dt>Fonte dell'ora</dt><dd data-txt="text_sensor/Fonte ora">—</dd>
      </dl>
    </div>
    <div class="card">
      <h2>Programmazione giornaliera</h2>
      ${campoOra("Accensione", "Accendi: ora", "Accendi: minuti")}
      ${campoOra("Spegnimento", "Spegni: ora", "Spegni: minuti")}
      <div class="campo"><button class="btn" id="disattiva">Disattiva la programmazione</button>
      <p class="nota">La programmazione è disattivata quando accensione e spegnimento hanno lo stesso orario.</p></div>
    </div>
    <div class="card">
      <h2>Orologio manuale</h2>
      ${campoOra("Ora corrente", "Ora manuale", "Minuti manuali")}
      <p class="nota">Serve solo se la scheda non ha l'ora da internet né da Home Assistant (per esempio su una rete senza internet). Appena arriva l'ora da una delle due fonti, vale quella.</p>
    </div>
    <div class="card">
      <h2>Ora da internet</h2>
      ${campoTesto("text/Server NTP", "Server NTP (vuoto = predefiniti)", { placeholder: "es. pool.ntp.org", tipo: "host", vuotoOk: true })}
      <p class="nota">Di solito non serve cambiarlo. Su una rete senza internet si può indicare un server NTP locale, per esempio il router.</p>
    </div>
  </div>
</section>

<section class="scheda" id="s-impostazioni">
  <div class="griglia due">
    <div class="card">
      <h2>Valori di riserva</h2>
      ${campo("Tensione di riserva")}
      ${campo("Corrente di riserva")}
      <p class="nota">L'alimentatore li usa da solo se perde il contatto con la scheda. Restano memorizzati anche quando è staccato dalla rete.</p>
    </div>
    <div class="card">
      <h2>Ventola</h2>
      <div class="campo" data-slider="${N("Ventola minima")}">
        <label>Velocità minima</label>
        <div class="slider"><input type="range" min="0" max="100" step="1" aria-label="Velocità minima ventola"><span class="val">—</span></div>
        <div class="msg"></div>
      </div>
      <dl class="righe"><dt>Giri adesso</dt><dd data-txt="${S("Giri ventola")}" data-dec="0" data-unita="giri/min">—</dd></dl>
      <div class="bottoni" style="margin-top:12px">
        ${bottone("Ventola al massimo", "Sempre al massimo", false)}
        ${bottone("Ventola automatica", "Automatica", false)}
      </div>
    </div>
    <div class="card">
      <h2>Contatori energia</h2>
      <div class="grande" data-txt="${S("Energia erogata")}" data-conv="wh" data-dec="2" data-unita="kWh">—</div>
      <dl class="righe" style="margin-top:10px">
        <dt>Energia dalla rete</dt><dd data-txt="${S("Energia dalla rete")}" data-conv="wh" data-dec="2" data-unita="kWh">—</dd>
        <dt>Rendimento medio</dt><dd data-txt="${S("Rendimento medio")}" data-dec="1" data-unita="%">—</dd>
        <dt>Perdite adesso</dt><dd data-txt="${S("Perdite")}" data-dec="0" data-unita="W">—</dd>
      </dl>
      <p class="nota">I contatori ripartono da zero a ogni riavvio della scheda. Il rendimento medio compare dopo i primi 10 Wh prelevati dalla rete.</p>
      <div class="bottoni" style="margin-top:10px">${bottone("Azzera energia", "Azzera i contatori", true)}</div>
    </div>
  </div>
</section>

<section class="scheda" id="s-rete">
  <div class="griglia due">
    <div class="card">
      <h2>Collegamento</h2>
      <dl class="righe">
        <dt>Rete WiFi</dt><dd data-txt="text_sensor/Rete WiFi collegata">—</dd>
        <dt>Indirizzo IP</dt><dd data-txt="text_sensor/Indirizzo IP">—</dd>
        <dt>Segnale</dt><dd id="segnale">—</dd>
        <dt>Configurazione</dt><dd data-txt="text_sensor/Configurazione IP">—</dd>
        <dt>Indirizzo MAC</dt><dd data-txt="text_sensor/Indirizzo MAC">—</dd>
      </dl>
      <div class="esito" id="esito"></div>
    </div>
    <div class="card" id="cardwifi">
      <h2>Cambia rete WiFi</h2>
      <div class="campo" id="f-ssid"><label>Nome della rete</label><div class="ctl"><input type="text" class="largo" maxlength="32" autocomplete="off" autocapitalize="none" spellcheck="false" aria-label="Nome della rete"></div><div class="msg"></div></div>
      <div class="campo" id="f-pw"><label>Password</label><div class="ctl"><input type="password" class="largo" maxlength="63" autocomplete="new-password" aria-label="Password"><button class="btn" id="mostrapw" type="button">Mostra</button></div><div class="msg"></div></div>
      <div class="campo"><button class="btn prim" id="collegawifi">Collegati e riavvia</button><div class="msg" id="m-wifi"></div></div>
      <p class="nota">La scheda si riavvia e prova la nuova rete; l'indirizzo IP torna automatico. Se nome o password sono sbagliati, dopo circa un minuto e mezzo crea la rete di emergenza, che ha lo stesso nome della scheda (per esempio r4850g o r4850g-a1b2c3): collegati lì con il telefono e scegli la rete giusta.</p>
    </div>
    <div class="card" id="cardip">
      <h2>Indirizzo IP</h2>
      <div class="scelta" role="radiogroup">
        <label><input type="radio" name="modoip" value="Automatico (DHCP)"> Automatico (DHCP)</label>
        <label><input type="radio" name="modoip" value="Statico"> Statico</label>
      </div>
      <div id="campistatici">
        <div class="campo" data-ipf="text/IP statico"><label>Indirizzo IP</label><div class="ctl"><input type="text" inputmode="decimal" class="largo" placeholder="192.168.1.50" autocomplete="off"></div><div class="msg"></div></div>
        <div class="campo" data-ipf="text/Maschera di rete"><label>Maschera di rete</label><div class="ctl"><input type="text" inputmode="decimal" class="largo" placeholder="255.255.255.0" autocomplete="off"></div><div class="msg"></div></div>
        <div class="campo" data-ipf="text/Gateway"><label>Gateway (router)</label><div class="ctl"><input type="text" inputmode="decimal" class="largo" placeholder="192.168.1.1" autocomplete="off"></div><div class="msg"></div></div>
        <div class="campo" data-ipf="text/DNS 1"><label>DNS 1 (vuoto = gateway)</label><div class="ctl"><input type="text" inputmode="decimal" class="largo" placeholder="facoltativo" autocomplete="off"></div><div class="msg"></div></div>
        <div class="campo" data-ipf="text/DNS 2"><label>DNS 2</label><div class="ctl"><input type="text" inputmode="decimal" class="largo" placeholder="facoltativo" autocomplete="off"></div><div class="msg"></div></div>
      </div>
      <div class="campo"><button class="btn prim" id="applicaip">Applica e riavvia</button><div class="msg" id="m-ip"></div></div>
      <p class="nota">Scegli un indirizzo fuori dall'intervallo che il router assegna da solo, oppure riservalo nel router. Se dopo il riavvio la scheda non risponde, spegnila e riaccendila tre volte di seguito (ogni volta entro 10 secondi) oppure tieni premuto il suo pulsante per 5 secondi: l'indirizzo torna automatico.</p>
    </div>
    <div class="card">
      <h2>Riavvio</h2>
      <div class="bottoni">${bottone("Riavvia scheda", "Riavvia la scheda", true)}</div>
      <p class="nota">Le impostazioni restano memorizzate. Durante il riavvio la pagina mostra la striscia arancione e si ricollega da sola dopo circa 20 secondi.</p>
    </div>
  </div>
</section>

<section class="scheda" id="s-info">
  <div class="griglia due">
    <div class="card">
      <h2>Bus CAN</h2>
      <dl class="righe">
        <dt>Stato</dt><dd><span class="puntino" id="canpunto"></span><span data-txt="${T("Stato bus CAN")}">—</span></dd>
        <dt>Messaggi ricevuti</dt><dd data-txt="${S("Messaggi CAN")}" data-dec="0">—</dd>
        <dt>Limite DC attivo</dt><dd data-txt="${S("Limite DC attivo")}" data-dec="1" data-unita="A">—</dd>
        <dt>Corrente DC rapida</dt><dd data-txt="${S("Corrente DC rapida")}" data-dec="2" data-unita="A">—</dd>
        <dt>Pagina collegata</dt><dd id="connInfo">—</dd>
      </dl>
    </div>
    <div class="card">
      <h2>Alimentatore</h2>
      <dl class="righe">
        <dt>Modello</dt><dd data-txt="${T("Modello")}">—</dd>
        <dt>N. di serie</dt><dd data-txt="${T("N. di serie")}">—</dd>
        <dt>Codice articolo</dt><dd data-txt="${T("Codice articolo")}">—</dd>
        <dt>Descrizione</dt><dd data-txt="${T("Descrizione")}">—</dd>
        <dt>Data di produzione</dt><dd data-txt="${T("Data produzione")}">—</dd>
        <dt>Corrente nominale</dt><dd data-txt="${S("Corrente nominale")}" data-dec="1" data-unita="A">—</dd>
        <dt>Ore di lavoro</dt><dd data-txt="${S("Ore di lavoro")}" data-dec="0" data-unita="h">—</dd>
        <dt>Fattore di scala</dt><dd data-txt="${S("Fattore di scala")}" data-dec="4">—</dd>
      </dl>
      <div class="bottoni" style="margin-top:12px">${bottone("Rileva alimentatore", "Rileggi i dati dell'alimentatore", true)}</div>
    </div>
    <div class="card">
      <h2>Statistiche anonime</h2>
      <div class="interr"><span class="t">Invia le statistiche anonime</span><button class="sw" role="switch" aria-checked="false" data-sw="switch/Statistiche anonime" aria-label="Invia le statistiche anonime"></button></div>
      <p class="nota">Una volta al giorno la scheda manda a statistiche-ha.tecnoconsulenza.it un codice casuale, la versione del firmware,
        il tipo di scheda, la versione di ESPHome e il modello dell'alimentatore. Serve solo a contare quante installazioni sono in uso.
        Non manda valori di carica, nomi, password o dati della rete.</p>
      <dl class="righe" style="margin-top:10px">
        <dt>Stato</dt><dd data-txt="text_sensor/Esito statistiche">—</dd>
        <dt>Codice di questa scheda</dt><dd class="codice" data-txt="text_sensor/Codice statistiche">—</dd>
      </dl>
      <div class="bottoni" style="margin-top:12px">${bottone("Invia ora le statistiche", "Invia adesso", false)}</div>
    </div>
  </div>
</section>
</main>
<footer>Pagina versione ${VERSIONE_PAGINA} · i valori si aggiornano da soli</footer>
<div class="avviso" id="avviso" role="status" aria-live="polite"></div>
<div class="consenso" id="consenso" role="dialog" aria-modal="true" aria-labelledby="consenso-tit" hidden>
  <div class="consenso-box">
    <h2 id="consenso-tit">Statistiche anonime</h2>
    <p>Puoi aiutare a capire quante schede usano questo firmware. Se accetti, una volta al giorno la scheda manda a
      statistiche-ha.tecnoconsulenza.it un codice casuale, la versione del firmware, il tipo di scheda, la versione di ESPHome
      e il modello dell'alimentatore.</p>
    <p>Non manda valori di carica, nomi, password o dati della rete. Puoi cambiare idea quando vuoi dalla scheda Info.</p>
    <div class="bottoni"><button class="btn prim" id="consenso-si" type="button">Accetto</button><button class="btn" id="consenso-no" type="button">No, grazie</button></div>
    <p class="nota"><button class="link" id="consenso-dopo" type="button">Decido più tardi</button></p>
  </div>
</div>`;
}

// ----------------------------------------------------------------------------
// Schede
// ----------------------------------------------------------------------------
const SCHEDE = ["principale", "fasi", "orari", "impostazioni", "rete", "info"];
function mostraScheda(nome) {
  if (!SCHEDE.includes(nome)) nome = "principale";
  document.querySelectorAll("section.scheda").forEach((s) => s.classList.toggle("attiva", s.id === "s-" + nome));
  document.querySelectorAll("nav.schede button").forEach((b) => b.setAttribute("aria-selected", b.dataset.scheda === nome ? "true" : "false"));
  if (location.hash !== "#" + nome) history.replaceState(null, "", "#" + nome);
  window.scrollTo(0, 0);
}

// ----------------------------------------------------------------------------
// Campi numerici: validazione, invio, conferma dalla scheda
// ----------------------------------------------------------------------------
function leggiNumero(testo) {
  const t = String(testo).trim().replace(",", ".");
  if (t === "") return { vuoto: true };
  if (!/^-?\d+(\.\d+)?$/.test(t)) return { errato: true };
  return { valore: parseFloat(t) };
}

function limiti(v) {
  const step = parseFloat(v.step) || 1;
  return { min: parseFloat(v.min_value), max: parseFloat(v.max_value), step, dec: decStep(v.step ?? step) };
}

function messaggio(el, testo, tipo) {
  const m = el.querySelector(".msg");
  m.textContent = testo || "";
  m.className = "msg " + (tipo || "");
}

function attivaCampo(el) {
  const id = el.dataset.num;
  const input = el.querySelector("input");
  const u = el.querySelector(".u");
  const info = el.querySelector(".info");
  const btn = el.querySelector(".imposta");
  let atteso = null, inviato = false, timer = null;

  function decimali(v) {
    if (el.dataset.dec !== "") return parseInt(el.dataset.dec, 10);
    return limiti(v).dec;
  }
  function mostraValore(v) {
    const x = num(v);
    input.value = Number.isFinite(x) ? fmt(x, decimali(v)).replace(/\./g, "") : "";
  }
  function segnaModificato(si) {
    el.classList.toggle("mod", si);
    if (si) { el.classList.remove("err"); messaggio(el, ""); }
  }

  // confronta il valore arrivato dalla scheda con quello inviato
  function verifica(v) {
    const l = limiti(v), x = num(v);
    if (Math.abs(x - atteso) <= l.step / 2 + 1e-9) {
      clearTimeout(timer); atteso = null; inviato = false;
      segnaModificato(false); mostraValore(v);
      messaggio(el, "Impostato", "ok");
      setTimeout(() => { if (!el.classList.contains("mod") && !el.classList.contains("err")) messaggio(el, ""); }, 2500);
      return true;
    }
    // un valore diverso conta come correzione solo se arriva dopo la risposta
    // della scheda: prima potrebbe essere un aggiornamento vecchio
    if (inviato && Number.isFinite(x)) {
      clearTimeout(timer); atteso = null; inviato = false;
      segnaModificato(false); mostraValore(v);
      messaggio(el, `La scheda ha corretto il valore a ${fmt(x, decimali(v))} ${v.uom || ""} (limite del modello)`, "warn");
      return true;
    }
    return false;
  }

  ascolta(id, (v) => {
    const l = limiti(v);
    u.textContent = v.uom || "";
    if (info) info.textContent = Number.isFinite(l.min) ? `da ${fmt(l.min, l.dec)} a ${fmt(l.max, l.dec)} ${v.uom || ""}` : "";
    if (atteso !== null) { verifica(v); return; }
    if (!el.classList.contains("mod") && !el.classList.contains("err") && document.activeElement !== input) mostraValore(v);
  });

  input.addEventListener("input", () => segnaModificato(true));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); invio(); }
    if (e.key === "Escape") { segnaModificato(false); el.classList.remove("err"); messaggio(el, ""); mostraValore(voci.get(id)); input.blur(); }
  });
  btn.addEventListener("click", invio);
  el.querySelectorAll(".passo").forEach((p) => p.addEventListener("click", () => {
    const v = voci.get(id); if (!v) return;
    const l = limiti(v);
    const r = leggiNumero(input.value);
    let x = r.valore ?? num(v);
    if (!Number.isFinite(x)) x = l.min;
    x = Math.min(l.max, Math.max(l.min, x + l.step * parseInt(p.dataset.passo, 10)));
    input.value = fmt(x, decimali(v)).replace(/\./g, "");
    segnaModificato(true);
  }));

  async function invio() {
    const v = voci.get(id);
    if (!v) { messaggio(el, "La scheda non ha ancora mandato questo valore", "err"); return; }
    const l = limiti(v);
    const r = leggiNumero(input.value);
    let errore = null;
    if (r.vuoto) errore = "Inserisci un valore";
    else if (r.errato) errore = "Scrivi solo un numero, per esempio " + fmt(l.min, l.dec);
    else if (r.valore < l.min - 1e-9 || r.valore > l.max + 1e-9) errore = `Fuori dai limiti: da ${fmt(l.min, l.dec)} a ${fmt(l.max, l.dec)} ${v.uom || ""}`;
    if (errore) {
      el.classList.add("err"); el.classList.remove("mod");
      messaggio(el, errore, "err"); input.focus();
      return;
    }
    const x = Math.round(r.valore / l.step) * l.step;
    const testo = x.toFixed(l.dec);
    el.classList.remove("err");
    messaggio(el, "Invio…", "");
    btn.disabled = true;
    // il valore atteso va registrato prima dell'invio: la conferma della scheda
    // può arrivare prima della risposta alla richiesta
    atteso = parseFloat(testo); inviato = false;
    clearTimeout(timer);
    try {
      await invia(id, "set?value=" + encodeURIComponent(testo));
      if (atteso !== null) {
        inviato = true;
        const v2 = voci.get(id);
        if (!(v2 && Math.abs(num(v2) - atteso) <= limiti(v2).step / 2 + 1e-9 && verifica(v2))) {
          timer = setTimeout(() => {
            if (atteso !== null) { atteso = null; inviato = false; messaggio(el, "Inviato, ma la scheda non ha confermato. Controlla il valore.", "warn"); }
          }, 5000);
        }
      }
      input.blur();
    } catch (e) {
      atteso = null; inviato = false;
      el.classList.add("err");
      messaggio(el, "Invio non riuscito: controlla il collegamento e riprova", "err");
    } finally {
      btn.disabled = false;
    }
  }
}

// ----------------------------------------------------------------------------
// Campi orario (ora + minuti su due voci)
// ----------------------------------------------------------------------------
function attivaOra(el) {
  const idOra = el.dataset.ora, idMin = el.dataset.min;
  const sh = el.querySelector(".sel-h"), sm = el.querySelector(".sel-m");
  const btn = el.querySelector(".imposta");
  let attesa = null, timer = null;

  function aggiornaCampo() {
    const h = numId(idOra), m = numId(idMin);
    if (attesa && h === attesa.h && m === attesa.m) {
      attesa = null; clearTimeout(timer);
      el.classList.remove("mod"); messaggio(el, "Impostato", "ok");
      setTimeout(() => { if (!el.classList.contains("mod")) messaggio(el, ""); }, 2500);
    }
    if (el.classList.contains("mod") || el.classList.contains("err")) return;
    sh.value = Number.isFinite(h) ? String(h) : "";
    sm.value = Number.isFinite(m) ? String(m) : "";
  }
  ascolta(idOra, aggiornaCampo);
  ascolta(idMin, aggiornaCampo);
  [sh, sm].forEach((s) => s.addEventListener("change", () => {
    el.classList.add("mod"); el.classList.remove("err"); messaggio(el, "");
    s.classList.remove("manca");
  }));
  btn.addEventListener("click", invio);

  async function invio() {
    const mancaH = sh.value === "", mancaM = sm.value === "";
    if (mancaH || mancaM) {
      el.classList.add("err"); el.classList.remove("mod");
      messaggio(el, mancaH && mancaM ? "Scegli ora e minuti" : mancaH ? "Scegli l'ora" : "Scegli i minuti", "err");
      (mancaH ? sh : sm).focus();
      return;
    }
    const h = parseInt(sh.value, 10), m = parseInt(sm.value, 10);
    btn.disabled = true; messaggio(el, "Invio…", "");
    attesa = { h, m };
    clearTimeout(timer);
    try {
      await invia(idOra, "set?value=" + h);
      await invia(idMin, "set?value=" + m);
      timer = setTimeout(() => { if (attesa) { attesa = null; messaggio(el, "Inviato, ma la scheda non ha confermato. Controlla l'orario.", "warn"); } }, 5000);
      aggiornaCampo();
    } catch (e) {
      attesa = null;
      el.classList.add("err");
      messaggio(el, "Invio non riuscito: controlla il collegamento e riprova", "err");
    } finally { btn.disabled = false; }
  }
}

// ----------------------------------------------------------------------------
// Pulsanti (con eventuale conferma) e interruttori
// ----------------------------------------------------------------------------
function attivaBottone(b) {
  const id = b.dataset.btn;
  const testo = b.innerHTML;
  let armato = null;
  b.addEventListener("click", async () => {
    if (b.dataset.conferma && !armato) {
      b.classList.add("conferma");
      b.textContent = "Tocca di nuovo per confermare";
      armato = setTimeout(() => { armato = null; b.classList.remove("conferma"); b.innerHTML = testo; }, 4000);
      return;
    }
    if (armato) { clearTimeout(armato); armato = null; b.classList.remove("conferma"); b.innerHTML = testo; }
    b.disabled = true;
    try {
      await invia(id, "press");
      avviso("Comando inviato: " + id.slice(id.indexOf("/") + 1));
    } catch (e) {
      avviso("Comando non inviato: controlla il collegamento", "err");
    } finally {
      setTimeout(() => { b.disabled = false; }, 600);
    }
  });
}

function attivaInterruttore(sw) {
  const id = sw.dataset.sw;
  ascolta(id, (v) => { sw.setAttribute("aria-checked", v.value === true || v.state === "ON" ? "true" : "false"); sw.disabled = false; });
  sw.addEventListener("click", async () => {
    const acceso = sw.getAttribute("aria-checked") === "true";
    sw.disabled = true;
    try {
      await invia(id, acceso ? "turn_off" : "turn_on");
      setTimeout(() => { sw.disabled = false; }, 3000);
    } catch (e) {
      sw.disabled = false;
      avviso("Comando non inviato: controlla il collegamento", "err");
    }
  });
}

function attivaSlider(el) {
  const id = el.dataset.slider;
  const r = el.querySelector("input"), val = el.querySelector(".val");
  let toccato = false;
  ascolta(id, (v) => {
    if (!toccato) { const x = num(v); if (Number.isFinite(x)) { r.value = x; val.textContent = fmt(x, 0) + " %"; } }
  });
  r.addEventListener("input", () => { toccato = true; val.textContent = r.value + " %"; });
  r.addEventListener("change", async () => {
    try { await invia(id, "set?value=" + r.value); messaggio(el, "Impostato", "ok"); }
    catch (e) { messaggio(el, "Invio non riuscito: riprova", "err"); }
    toccato = false;
    setTimeout(() => messaggio(el, ""), 2500);
  });
}

// ----------------------------------------------------------------------------
// Valori in sola lettura
// ----------------------------------------------------------------------------
function testoValore(v, el) {
  const dec = el.dataset.dec;
  if (dec === undefined || dec === "") {
    const s = v.value ?? v.state;
    return s === undefined || s === null || s === "" || s === "NA" ? "—" : String(s);
  }
  let x = num(v);
  if (el.dataset.conv === "wh") x = x / 1000;
  return fmt(x, parseInt(dec, 10)) + (el.dataset.unita && Number.isFinite(x) ? " " + el.dataset.unita : "");
}

function attivaLetture() {
  document.querySelectorAll("[data-txt]").forEach((el) => ascolta(el.dataset.txt, (v) => { el.textContent = testoValore(v, el); }));
  document.querySelectorAll("[data-tile]").forEach((el) => {
    const out = el.querySelector(".v");
    ascolta(el.dataset.tile, (v) => {
      let x = num(v);
      if (el.dataset.conv === "wh") x = x / 1000;
      out.innerHTML = Number.isFinite(x) ? esc(fmt(x, parseInt(el.dataset.dec, 10))) + `<small>${esc(el.dataset.unita)}</small>` : "—";
      el.classList.toggle("vuoto", !Number.isFinite(x));
    });
  });

  // stato alimentatore
  const pill = document.getElementById("pill"), st = document.getElementById("statotxt");
  ascolta(T("Stato alimentatore"), (v) => {
    const s = String(v.value ?? v.state ?? "");
    st.textContent = s || "—";
    pill.className = "pill " + ({ Acceso: "acceso", Spento: "spento", Errore: "errore", "Non risponde": "assente" }[s] || "");
  });
  ["fasetxt", "fasetxt2"].forEach((k) => {
    const el = document.getElementById(k);
    ascolta(T("Fase attiva"), (v) => { el.textContent = v.value ? "Carica a fasi: " + v.value : ""; });
  });

  // stato del bus con colore
  const punto = document.getElementById("canpunto");
  ascolta(T("Stato bus CAN"), (v) => {
    const s = String(v.value || "");
    punto.className = "puntino " + (s === "OK" ? "ok" : s.startsWith("Nessun dato") || s.startsWith("CAN fermo") ? "warn" : s ? "err" : "");
  });

  // orari
  ascolta(T("Ora attuale"), (v) => { document.getElementById("oraatt").textContent = v.value || "—"; });
  const aggiornaFra = () => {
    const testo = String((voci.get(T("Accende fra")) || {}).value || "");
    const acc = document.getElementById("accfra"), spe = document.getElementById("spefra");
    if (testo.startsWith("Programmazione")) { acc.textContent = "programmazione disattivata"; spe.textContent = "—"; return; }
    acc.textContent = testo ? "fra " + minuti(parseInt(testo, 10)) : "—";
    const m = numId(S("Spegne fra"));
    spe.textContent = Number.isFinite(m) ? "fra " + minuti(m) : "—";
  };
  ascolta(T("Accende fra"), aggiornaFra);
  ascolta(S("Spegne fra"), aggiornaFra);
}

// ----------------------------------------------------------------------------
// Indicatori a lancetta
// ----------------------------------------------------------------------------
function disegnaIndicatore(chiave, { valore, min, max, dec, unita, segno, extra }) {
  const el = document.querySelector(`[data-ind="${chiave}"]`);
  if (!el) return;
  const ok = Number.isFinite(valore);
  const p = ok ? Math.max(0, Math.min(1, (valore - min) / (max - min))) : 0;
  el.querySelector(".g-val").setAttribute("stroke-dasharray", `${(p * 100).toFixed(2)} 100`);
  el.querySelector(".g-num").textContent = ok ? fmt(valore, dec) : "—";
  el.querySelector(".g-unit").textContent = unita;
  el.querySelector(".g-min").textContent = fmt(min, 0);
  el.querySelector(".g-max").textContent = fmt(max, 0);
  const m = el.querySelector(".g-mark");
  if (Number.isFinite(segno) && segno >= min && segno <= max) {
    const a = -135 + 270 * ((segno - min) / (max - min));
    m.style.transform = `rotate(${a}deg)`; m.style.opacity = "1";
  } else m.style.opacity = "0";
  el.querySelector(".extra").textContent = extra || "";
  el.classList.toggle("vuoto", !ok);
}

function aggiornaIndicatori() {
  const nominale = numId(S("Corrente nominale"));
  const maxA = Number.isFinite(nominale) && nominale > 0 ? Math.ceil(nominale / 10) * 10 : 50;
  const vset = numId(N("Tensione di carica"));
  const lim = numId(S("Limite DC attivo"));
  const iset = numId(N("Corrente di carica"));
  disegnaIndicatore("v", {
    valore: numId(S("Tensione DC")), min: 48, max: 58, dec: 2, unita: "V", segno: vset,
    extra: Number.isFinite(vset) ? "carica a " + fmt(vset, 1) + " V" : "",
  });
  disegnaIndicatore("a", {
    valore: numId(S("Corrente DC")), min: 0, max: maxA, dec: 1, unita: "A",
    segno: Number.isFinite(lim) ? lim : iset,
    extra: Number.isFinite(lim) ? "limite " + fmt(lim, 1) + " A" : Number.isFinite(iset) ? "massimo " + fmt(iset, 1) + " A" : "",
  });
  const maxW = Math.max(1000, Math.ceil((Number.isFinite(nominale) ? nominale * 57.6 : 3000) / 500) * 500);
  const ac = numId(S("Potenza AC"));
  disegnaIndicatore("w", {
    valore: numId(S("Potenza DC")), min: 0, max: maxW, dec: 0, unita: "W", segno: NaN,
    extra: Number.isFinite(ac) ? "dalla rete " + fmt(ac, 0) + " W" : "",
  });
  const rend = numId(S("Rendimento")), perd = numId(S("Perdite"));
  disegnaIndicatore("r", {
    valore: rend, min: 80, max: 100, dec: 1, unita: "%", segno: NaN,
    extra: Number.isFinite(rend) ? (Number.isFinite(perd) ? "perdite " + fmt(perd, 0) + " W" : "")
      : (Number.isFinite(ac) && ac < 30 ? "carico troppo basso" : ""),
  });
}

// ----------------------------------------------------------------------------
// Grafico a gradini della carica a fasi
// ----------------------------------------------------------------------------
function aggiornaScala() {
  const box = document.getElementById("scala");
  const t = [1, 2, 3, 4].map((i) => numId(N(`Fase ${i} tensione`)));
  const c = [1, 2, 3, 4].map((i) => numId(N(`Fase ${i} corrente`)));
  const imax = numId(N("Corrente di carica"));
  const rip = numId(N("Ripartenza fasi"));
  const vb = numId(S("Tensione DC"));
  if (![...t, ...c, imax].every(Number.isFinite)) { box.innerHTML = '<p class="nota">In attesa dei valori…</p>'; return; }
  const W = 360, H = 170, L = 34, R = 10, TOP = 12, BOT = 26;
  const vmin = Math.min(...t) - 0.8, vmax = Math.max(...t) + 0.3;
  const amax = Math.max(imax, ...c) * 1.1 || 1;
  const X = (v) => L + ((v - vmin) / (vmax - vmin)) * (W - L - R);
  const Y = (a) => TOP + (1 - a / amax) * (H - TOP - BOT);
  // corrente effettiva: la fase non supera la Corrente di carica
  const pts = [[vmin, imax]];
  let att = imax;
  for (let i = 0; i < 4; i++) {
    const nuova = Math.min(imax, c[i]);
    pts.push([t[i], att]); pts.push([t[i], nuova]); att = nuova;
  }
  pts.push([vmax, att]);
  const linea = pts.map((p, i) => (i ? "L" : "M") + X(p[0]).toFixed(1) + " " + Y(p[1]).toFixed(1)).join(" ");
  const area = linea + ` L${X(vmax).toFixed(1)} ${Y(0).toFixed(1)} L${X(vmin).toFixed(1)} ${Y(0).toFixed(1)} Z`;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Corrente per ogni fase">`;
  s += `<path class="sc-area" d="${area}"/><line class="sc-ax" x1="${L}" y1="${Y(0)}" x2="${W - R}" y2="${Y(0)}"/>`;
  s += `<path class="sc-step" d="${linea}"/>`;
  // sull'asse solo la prima e l'ultima soglia: le altre sono troppo vicine
  const tmin = Math.min(...t), tmax = Math.max(...t);
  s += `<text class="sc-t" x="${X(tmin).toFixed(1)}" y="${H - 8}" text-anchor="middle">${fmt(tmin, 2)} V</text>`;
  if (X(tmax) - X(tmin) > 50) s += `<text class="sc-t" x="${X(tmax).toFixed(1)}" y="${H - 8}" text-anchor="middle">${fmt(tmax, 2)} V</text>`;
  t.forEach((v, i) => {
    s += `<text class="sc-t" x="${(X(v) + 3).toFixed(1)}" y="${(Y(Math.min(imax, c[i])) - 4).toFixed(1)}">F${i + 1}</text>`;
  });
  s += `<text class="sc-t" x="${L - 4}" y="${Y(imax) + 4}" text-anchor="end">${fmt(imax, 0)}</text><text class="sc-t" x="${L - 4}" y="${Y(0) + 4}" text-anchor="end">0 A</text>`;
  if (Number.isFinite(vb) && vb >= vmin && vb <= vmax) {
    const destra = X(vb) > W - 130;
    s += `<line class="sc-now" x1="${X(vb).toFixed(1)}" y1="${TOP}" x2="${X(vb).toFixed(1)}" y2="${Y(0)}"/><text class="sc-nowt" x="${(X(vb) + (destra ? -4 : 4)).toFixed(1)}" y="${TOP + 10}" text-anchor="${destra ? "end" : "start"}">batteria ${fmt(vb, 2)} V</text>`;
  } else if (Number.isFinite(vb)) {
    s += `<text class="sc-nowt" x="${vb < vmin ? L + 4 : W - R}" y="${TOP + 10}" text-anchor="${vb < vmin ? "start" : "end"}">${vb < vmin ? "◀ " : ""}batteria ${fmt(vb, 2)} V${vb > vmax ? " ▶" : ""}</text>`;
  }
  box.innerHTML = s + "</svg>";
}

// ----------------------------------------------------------------------------
// Collegamento con la scheda (Server-Sent Events)
// ----------------------------------------------------------------------------
function parseJSON(testo) {
  try { return JSON.parse(testo); }
  catch (e) { try { return JSON.parse(testo.replace(/\bNaN\b/g, "null")); } catch (e2) { return null; } }
}

function stato(collegato) {
  const c = document.getElementById("conn");
  c.className = "conn " + (collegato ? "on" : "off");
  c.title = collegato ? "Collegato alla scheda" : "Non collegato alla scheda";
  document.getElementById("conntxt").textContent = collegato ? "collegato" : "non collegato";
  document.getElementById("banner").classList.toggle("mostra", !collegato);
  document.getElementById("connInfo").textContent = collegato ? "sì" : "no, riprovo";
}

function collega() {
  const es = new EventSource("/events");
  es.addEventListener("open", () => stato(true));
  es.addEventListener("error", () => {
    stato(false);
    // se il browser rinuncia (risposta non valida, scheda in riavvio) si riprova da capo
    if (es.readyState === EventSource.CLOSED) setTimeout(collega, 3000);
  });
  es.addEventListener("ping", (e) => {
    stato(true);
    const d = parseJSON(e.data);
    if (d && d.title) {
      document.getElementById("titolo").textContent = d.title;
      document.title = d.title;
    }
    if (d && Number.isFinite(d.uptime)) {
      const g = Math.floor(d.uptime / 86400), h = Math.floor((d.uptime % 86400) / 3600), m = Math.floor((d.uptime % 3600) / 60);
      document.getElementById("sottotitolo").textContent = "scheda accesa da " + (g ? g + " g " : "") + (g || h ? h + " h " : "") + m + " min";
    }
  });
  es.addEventListener("state", (e) => { const d = parseJSON(e.data); if (d) aggiorna(d); });
}


// ----------------------------------------------------------------------------
// Rete: controlli sugli indirizzi (gli stessi che fa la scheda)
// ----------------------------------------------------------------------------
function leggiIP(s) {
  s = String(s || "").trim();
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(s)) return null;
  const p = s.split(".").map(Number);
  if (p.some((x) => x > 255)) return null;
  return ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]) >>> 0;
}
function mascheraValida(m) {
  if (m === null || m === 0 || m === 0xffffffff) return false;
  const inv = ~m >>> 0;
  return ((inv + 1) & inv) === 0;
}
function hostValido(s) {
  return /^[A-Za-z0-9]([A-Za-z0-9-]{0,62})(\.[A-Za-z0-9]([A-Za-z0-9-]{0,62}))*$/.test(s) || leggiIP(s) !== null;
}

function erroreCampo(el, testo) {
  el.classList.add("err");
  el.querySelector(".msg").textContent = testo;
  el.querySelector(".msg").className = "msg err";
}
function pulisciCampo(el) {
  el.classList.remove("err");
  el.querySelector(".msg").textContent = "";
  el.querySelector(".msg").className = "msg";
}

function attivaTesto(el) {
  const id = el.dataset.testo;
  const input = el.querySelector("input"), btn = el.querySelector(".imposta");
  let atteso = null, timer = null;
  ascolta(id, (v) => {
    const s = v.value ?? "";
    if (atteso !== null && s === atteso) {
      atteso = null; clearTimeout(timer);
      el.classList.remove("mod"); messaggio(el, "Impostato", "ok");
      setTimeout(() => { if (!el.classList.contains("mod")) messaggio(el, ""); }, 2500);
    }
    if (!el.classList.contains("mod") && !el.classList.contains("err") && document.activeElement !== input) input.value = s;
  });
  input.addEventListener("input", () => { el.classList.add("mod"); pulisciCampo(el); });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); invio(); } });
  btn.addEventListener("click", invio);
  async function invio() {
    const s = input.value.trim();
    if (!s && !el.dataset.vuotook) { erroreCampo(el, "Inserisci un valore"); el.classList.remove("mod"); return; }
    if (s && el.dataset.tipo === "host" && !hostValido(s)) { erroreCampo(el, "Scrivi un nome di server (es. pool.ntp.org) o un indirizzo IP"); el.classList.remove("mod"); return; }
    btn.disabled = true; messaggio(el, "Invio…", "");
    atteso = s;
    try {
      await invia(id, "set?value=" + encodeURIComponent(s));
      clearTimeout(timer);
      timer = setTimeout(() => { if (atteso !== null) { atteso = null; messaggio(el, "Inviato, ma la scheda non ha confermato", "warn"); } }, 5000);
      if ((voci.get(id) || {}).value === s) { atteso = null; el.classList.remove("mod"); messaggio(el, "Impostato", "ok"); }
    } catch (e) {
      atteso = null; erroreCampo(el, "Invio non riuscito: controlla il collegamento e riprova");
    } finally { btn.disabled = false; }
  }
}

function qualitaSegnale(dbm) {
  if (!Number.isFinite(dbm)) return "—";
  const q = dbm >= -55 ? "ottimo" : dbm >= -67 ? "buono" : dbm >= -75 ? "discreto" : "debole";
  return `${fmt(dbm, 0)} dBm (${q})`;
}

function attivaRete() {
  ascolta("sensor/Segnale WiFi", (v) => { document.getElementById("segnale").textContent = qualitaSegnale(num(v)); });
  const esito = document.getElementById("esito");
  ascolta("text_sensor/Esito rete", (v) => {
    const s = String(v.value || "");
    esito.textContent = s;
    esito.className = "esito " + (s.startsWith("Errore") ? "err" : s.startsWith("Salvato") ? "ok" : "");
  });

  // --- rete WiFi
  const fS = document.getElementById("f-ssid"), fP = document.getElementById("f-pw");
  const iS = fS.querySelector("input"), iP = fP.querySelector("input");
  const mostra = document.getElementById("mostrapw");
  mostra.addEventListener("click", () => {
    const nascosta = iP.type === "password";
    iP.type = nascosta ? "text" : "password";
    mostra.textContent = nascosta ? "Nascondi" : "Mostra";
  });
  [fS, fP].forEach((f) => f.querySelector("input").addEventListener("input", () => pulisciCampo(f)));
  ascolta("text_sensor/Rete WiFi collegata", (v) => { if (!iS.value && document.activeElement !== iS && v.value) iS.placeholder = v.value; });
  const bW = document.getElementById("collegawifi"), mW = document.getElementById("m-wifi");
  let armW = null;
  bW.addEventListener("click", async () => {
    const ss = iS.value, pw = iP.value;
    let ok = true;
    pulisciCampo(fS); pulisciCampo(fP); mW.textContent = ""; mW.className = "msg";
    if (!ss.trim()) { erroreCampo(fS, "Scrivi il nome della rete"); ok = false; }
    else if (new TextEncoder().encode(ss).length > 32) { erroreCampo(fS, "Il nome della rete può avere al massimo 32 caratteri"); ok = false; }
    const lpw = new TextEncoder().encode(pw).length;   // la scheda conta i byte
    if (pw && (pw.length < 8 || lpw > 63)) { erroreCampo(fP, "La password deve avere da 8 a 63 caratteri (vuota solo per reti aperte)"); ok = false; }
    if (!ok) return;
    if (!armW) {
      bW.classList.add("conferma"); bW.textContent = "Tocca di nuovo: la scheda si riavvia";
      armW = setTimeout(() => { armW = null; bW.classList.remove("conferma"); bW.textContent = "Collegati e riavvia"; }, 4000);
      return;
    }
    clearTimeout(armW); armW = null; bW.classList.remove("conferma"); bW.textContent = "Collegati e riavvia";
    bW.disabled = true; mW.textContent = "Invio…";
    try {
      await invia("text/Rete WiFi", "set?value=" + encodeURIComponent(ss));
      await invia("text/Password WiFi", "set?value=" + encodeURIComponent(pw));
      await invia("button/Collegati alla rete WiFi", "press");
      iP.value = "";
      mW.className = "msg ok";
      mW.textContent = `Inviato. La scheda si riavvia e si collega a «${ss}». Il telefono deve essere sulla stessa rete per riaprire la pagina.`;
    } catch (e) {
      mW.className = "msg err"; mW.textContent = "Invio non riuscito: controlla il collegamento e riprova";
    } finally { bW.disabled = false; }
  });

  // --- indirizzo IP
  const radio = [...document.querySelectorAll('input[name="modoip"]')];
  const box = document.getElementById("campistatici");
  const campi = {};
  document.querySelectorAll("[data-ipf]").forEach((f) => { campi[f.dataset.ipf] = f; });
  let modificato = false;
  const modo = () => (radio.find((r) => r.checked) || {}).value;
  const mostraCampi = () => { box.style.display = modo() === "Statico" ? "" : "none"; };
  radio.forEach((r) => r.addEventListener("change", () => { modificato = true; mostraCampi(); }));
  ascolta("select/Modalità IP", (v) => {
    if (modificato) return;
    radio.forEach((r) => { r.checked = r.value === v.value; });
    mostraCampi();
  });
  Object.entries(campi).forEach(([id, f]) => {
    const inp = f.querySelector("input");
    inp.addEventListener("input", () => { modificato = true; pulisciCampo(f); });
    ascolta(id, (v) => { if (!modificato && document.activeElement !== inp) inp.value = v.value ?? ""; });
  });
  mostraCampi();

  const bI = document.getElementById("applicaip"), mI = document.getElementById("m-ip");
  let armI = null;
  bI.addEventListener("click", async () => {
    mI.textContent = ""; mI.className = "msg";
    Object.values(campi).forEach(pulisciCampo);
    const m = modo();
    if (!m) { mI.className = "msg err"; mI.textContent = "Scegli automatico o statico"; return; }
    const val = (id) => campi[id].querySelector("input").value.trim();
    let ok = true;
    if (m === "Statico") {
      const ip = leggiIP(val("text/IP statico")), mask = leggiIP(val("text/Maschera di rete")), gw = leggiIP(val("text/Gateway"));
      if (ip === null) { erroreCampo(campi["text/IP statico"], val("text/IP statico") ? "Indirizzo non valido: quattro numeri da 0 a 255 separati da punti" : "Inserisci l'indirizzo IP"); ok = false; }
      if (!mascheraValida(mask)) { erroreCampo(campi["text/Maschera di rete"], "Maschera non valida (di solito 255.255.255.0)"); ok = false; }
      if (gw === null) { erroreCampo(campi["text/Gateway"], val("text/Gateway") ? "Gateway non valido" : "Inserisci il gateway (l'indirizzo del router)"); ok = false; }
      if (ok) {
        if (((ip & mask) >>> 0) !== ((gw & mask) >>> 0)) { erroreCampo(campi["text/Gateway"], "Il gateway non è nella stessa rete dell'indirizzo IP"); ok = false; }
        const host = (ip & ~mask) >>> 0, tutti = (~mask) >>> 0;
        if (host === 0 || host === tutti) { erroreCampo(campi["text/IP statico"], "Questo indirizzo è riservato (rete o broadcast)"); ok = false; }
        if (ip === gw) { erroreCampo(campi["text/IP statico"], "L'indirizzo IP non può essere uguale al gateway"); ok = false; }
      }
      ["text/DNS 1", "text/DNS 2"].forEach((id) => { if (val(id) && leggiIP(val(id)) === null) { erroreCampo(campi[id], "Indirizzo DNS non valido"); ok = false; } });
    }
    if (!ok) return;
    if (!armI) {
      bI.classList.add("conferma"); bI.textContent = "Tocca di nuovo: la scheda si riavvia";
      armI = setTimeout(() => { armI = null; bI.classList.remove("conferma"); bI.textContent = "Applica e riavvia"; }, 4000);
      return;
    }
    clearTimeout(armI); armI = null; bI.classList.remove("conferma"); bI.textContent = "Applica e riavvia";
    bI.disabled = true; mI.textContent = "Invio…";
    try {
      await invia("select/Modalità IP", "set?option=" + encodeURIComponent(m));
      if (m === "Statico") {
        for (const id of Object.keys(campi)) await invia(id, "set?value=" + encodeURIComponent(val(id)));
      }
      await invia("button/Applica impostazioni IP", "press");
      modificato = false;
      mI.className = "msg ok";
      mI.innerHTML = m === "Statico"
        ? `Inviato. Dopo il riavvio la pagina sarà su <a href="http://${esc(val("text/IP statico"))}/">http://${esc(val("text/IP statico"))}</a>`
        : "Inviato. Dopo il riavvio il router assegnerà l'indirizzo: lo trovi nella lista dei dispositivi del router o in Home Assistant.";
    } catch (e) {
      mI.className = "msg err"; mI.textContent = "Invio non riuscito: controlla il collegamento e riprova";
    } finally { bI.disabled = false; }
  });
}

// ----------------------------------------------------------------------------
// Avvio
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// Aspetto: automatico, chiaro o scuro. La scelta resta nel browser che la fa
// (ogni telefono o computer ha la sua); "Automatico" segue il dispositivo.
// ----------------------------------------------------------------------------
const TEMI = ["auto", "chiaro", "scuro"];
const CHIAVE_TEMA = "r4850g-tema";
const scuroDispositivo = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

function leggiTema() {
  try {
    const t = localStorage.getItem(CHIAVE_TEMA);
    return TEMI.includes(t) ? t : "auto";
  } catch (e) { return "auto"; }
}

function salvaTema(t) {
  try {
    if (t === "auto") localStorage.removeItem(CHIAVE_TEMA);
    else localStorage.setItem(CHIAVE_TEMA, t);
  } catch (e) { /* browser senza memoria locale: la scelta vale fino alla chiusura */ }
}

// colore della barra del browser sul telefono, uguale alla testata
function coloreBarra() {
  let m = document.querySelector('meta[name="theme-color"]');
  if (!m) { m = document.createElement("meta"); m.name = "theme-color"; document.head.appendChild(m); }
  m.content = getComputedStyle(document.documentElement).getPropertyValue("--card").trim() || "#ffffff";
}

function applicaTema(t) {
  if (!TEMI.includes(t)) t = "auto";
  const r = document.documentElement;
  if (t === "auto") r.removeAttribute("data-tema"); else r.setAttribute("data-tema", t);
  document.querySelectorAll("#tema button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.tema === t)));
  if (document.head) coloreBarra();
}

function attivaTema() {
  const tasti = Array.from(document.querySelectorAll("#tema button"));
  tasti.forEach((b) => b.addEventListener("click", () => { salvaTema(b.dataset.tema); applicaTema(b.dataset.tema); }));
  // frecce sinistra/destra come in un normale gruppo di scelte
  document.getElementById("tema").addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const i = tasti.indexOf(document.activeElement);
    if (i < 0) return;
    const j = (i + (e.key === "ArrowRight" ? 1 : tasti.length - 1)) % tasti.length;
    tasti[j].focus(); tasti[j].click(); e.preventDefault();
  });
  // con "Automatico" il cambio del dispositivo (per esempio di sera) si vede subito
  if (scuroDispositivo) {
    if (scuroDispositivo.addEventListener) scuroDispositivo.addEventListener("change", coloreBarra);
    else if (scuroDispositivo.addListener) scuroDispositivo.addListener(coloreBarra);
  }
  // scelta fatta in un'altra finestra dello stesso browser
  window.addEventListener("storage", (e) => { if (e.key === CHIAVE_TEMA || e.key === null) applicaTema(leggiTema()); });
}

// Domanda del consenso alle statistiche: compare finché la scelta non è fatta
function attivaConsenso() {
  const box = document.getElementById("consenso");
  let rimandato = false;
  ascolta("text_sensor/Scelta statistiche", (v) => {
    box.hidden = !(v.value === "da_chiedere" || v.state === "da_chiedere") || rimandato;
  });
  const rispondi = async (id, azione, testo) => {
    try { await invia(id, azione); box.hidden = true; avviso(testo); }
    catch (e) { avviso("Comando non inviato: controlla il collegamento", "err"); }
  };
  document.getElementById("consenso-si").addEventListener("click", () => rispondi("switch/Statistiche anonime", "turn_on", "Grazie: statistiche attivate"));
  document.getElementById("consenso-no").addEventListener("click", () => rispondi("button/Statistiche rifiutate", "press", "Statistiche disattivate"));
  document.getElementById("consenso-dopo").addEventListener("click", () => { rimandato = true; box.hidden = true; });
}

function avvia() {
  document.documentElement.lang = "it";
  applicaTema(leggiTema());   // prima dello stile, così la pagina non lampeggia
  if (!document.querySelector('meta[name="viewport"]')) {
    const m = document.createElement("meta");
    m.name = "viewport"; m.content = "width=device-width, initial-scale=1, viewport-fit=cover";
    document.head.appendChild(m);
  }
  const st = document.createElement("style");
  st.textContent = CSS;
  document.head.appendChild(st);
  document.title = "Alimentatore R4850G";
  const box = document.createElement("div");
  box.id = "app";
  box.innerHTML = pagina();
  document.body.prepend(box);
  applicaTema(leggiTema());
  attivaTema();

  document.querySelectorAll("nav.schede button").forEach((b) => b.addEventListener("click", () => mostraScheda(b.dataset.scheda)));
  window.addEventListener("hashchange", () => mostraScheda(location.hash.slice(1)));
  mostraScheda(location.hash.slice(1));

  document.querySelectorAll("[data-num]").forEach(attivaCampo);
  document.querySelectorAll("[data-ora]").forEach(attivaOra);
  document.querySelectorAll("[data-btn]").forEach(attivaBottone);
  document.querySelectorAll("[data-sw]").forEach(attivaInterruttore);
  document.querySelectorAll("[data-slider]").forEach(attivaSlider);
  document.querySelectorAll("[data-testo]").forEach(attivaTesto);
  attivaLetture();
  attivaRete();
  attivaConsenso();

  // disattiva programmazione: accensione e spegnimento a 00:00
  const dis = document.getElementById("disattiva");
  let armato = null;
  dis.addEventListener("click", async () => {
    if (!armato) {
      dis.classList.add("conferma"); dis.textContent = "Tocca di nuovo per confermare";
      armato = setTimeout(() => { armato = null; dis.classList.remove("conferma"); dis.textContent = "Disattiva la programmazione"; }, 4000);
      return;
    }
    clearTimeout(armato); armato = null; dis.classList.remove("conferma"); dis.textContent = "Disattiva la programmazione";
    dis.disabled = true;
    try {
      for (const n of ["Accendi: ora", "Accendi: minuti", "Spegni: ora", "Spegni: minuti"]) await invia(N(n), "set?value=0");
      avviso("Programmazione disattivata");
    } catch (e) { avviso("Comando non inviato: controlla il collegamento", "err"); }
    finally { dis.disabled = false; }
  });

  // indicatori e grafico si ridisegnano quando cambia uno dei valori usati
  [S("Tensione DC"), S("Corrente DC"), S("Potenza DC"), S("Potenza AC"), S("Corrente nominale"), S("Limite DC attivo"), S("Rendimento"), S("Perdite"),
   N("Tensione di carica"), N("Corrente di carica")].forEach((id) => ascolta(id, aggiornaIndicatori));
  [1, 2, 3, 4].forEach((i) => { ascolta(N(`Fase ${i} tensione`), aggiornaScala); ascolta(N(`Fase ${i} corrente`), aggiornaScala); });
  [N("Corrente di carica"), N("Ripartenza fasi"), S("Tensione DC")].forEach((id) => ascolta(id, aggiornaScala));
  aggiornaIndicatori();
  aggiornaScala();

  collega();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", avvia);
else avvia();
