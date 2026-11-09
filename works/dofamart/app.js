/* dofamart — app logic. Nothing here can charge, order or deliver anything. */
(() => {
'use strict';
const D = window.DOFA;
const { VS, LANGS, FIAT, CIS, MAJOR, COINS, PROMOS, CATS, P, ORDER, THEMES, I18N, PN } = D;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const RM = matchMedia('(prefers-reduced-motion: reduce)');
const LOCS = Object.fromEntries(LANGS.map(l => [l[0], l[2]]));
const PM = Object.fromEntries(P.map(p => [p.id, p]));
const COINM = Object.fromEntries(COINS.map(c => [c.c, c]));
const WORLD = MAJOR.concat(Object.keys(FIAT).filter(c => !CIS.includes(c) && !MAJOR.includes(c)).sort());
const TKEYS = Object.keys(THEMES);
const DEST = { home: '🏠', office: '🏢', dacha: '🏡', moon: '🌕' };
const SPEED = { std: '🛵', exp: '🏍' + VS, tp: '🛸' };
const PAY = { card: '💳', crypto: '💎', cash: '💵', mind: '🧠' };
const ST_EMO = ['🧾', '📦', '🤝', '🛣' + VS];
const STX_EMO = ['🔔', '🐈', '⏳', '🔺', '🍲', '🐢', '🌀', '✨'];
const ACH = [['first_cart', '🛒'], ['first_order', '🧾'], ['ten', '🛍' + VS], ['million', '💸'], ['yacht', '⚓'], ['moon', '🌙'], ['rider', '🏁'],
  ['crypto', '💎'], ['promo', '🎟' + VS], ['food', '🍽' + VS], ['night', '🦉'], ['polyglot', '🗣' + VS], ['tourist', '🌍'], ['dj', '🎧']];
const CAP_COINS = ['BTC', 'ETH', 'USDT', 'TON', 'SOL', 'BNB', 'DOGE', 'DOFA'];
const imgUrl = (id, w) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=70`;

/* ---------- state ---------- */
const KEY = 'dofamart:v2';
const DEF = { lang: null, cur: null, cap: 'BTC', theme: 'sunset', autoTheme: true, sound: true, cart: {}, fav: [], orders: [], ach: [], promo: null,
  stats: { saved: 0, items: 0, orders: 0, max: 0, food: 0 }, langs: [], curs: [], themes: [], dopa: 0, dopaT: 0, cat: 'all', sort: 'pop' };
let S = JSON.parse(JSON.stringify(DEF));
try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
S.stats = Object.assign({}, DEF.stats, S.stats || {});
if (!LOCS[S.lang]) S.lang = null;
if (S.cur && !FIAT[S.cur] && !COINM[S.cur]) S.cur = null;
if (!THEMES[S.theme]) S.theme = 'sunset';
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

function detectLang() {
  const list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en'];
  for (const l of list) {
    const p = String(l).toLowerCase().split('-')[0];
    if (LOCS[p]) return p;
    if (['be', 'hy', 'ka', 'ky', 'tg', 'tk'].includes(p)) return 'ru';
  }
  return 'en';
}
const TZ = { 'Asia/Almaty': 'KZT', 'Asia/Qostanay': 'KZT', 'Asia/Aqtobe': 'KZT', 'Asia/Aqtau': 'KZT', 'Asia/Atyrau': 'KZT', 'Asia/Oral': 'KZT', 'Asia/Qyzylorda': 'KZT',
  'Asia/Tashkent': 'UZS', 'Asia/Samarkand': 'UZS', 'Asia/Baku': 'AZN', 'Europe/Minsk': 'BYN', 'Asia/Yerevan': 'AMD', 'Asia/Tbilisi': 'GEL', 'Asia/Bishkek': 'KGS',
  'Asia/Dushanbe': 'TJS', 'Europe/Chisinau': 'MDL', 'Asia/Ashgabat': 'TMT', 'Europe/Kiev': 'UAH', 'Europe/Kyiv': 'UAH' };
const RU_TZ = /^(Europe\/(Moscow|Samara|Kaliningrad|Volgograd|Saratov|Ulyanovsk|Astrakhan|Kirov)|Asia\/(Yekaterinburg|Omsk|Novosibirsk|Krasnoyarsk|Irkutsk|Yakutsk|Vladivostok|Magadan|Kamchatka|Barnaul|Tomsk|Novokuznetsk|Chita|Sakhalin|Srednekolymsk|Anadyr|Khandyga|Ust-Nera))$/;
const REG = { US: 'USD', GB: 'GBP', DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR', AT: 'EUR', BE: 'EUR', FI: 'EUR', IE: 'EUR', PT: 'EUR', GR: 'EUR', LV: 'EUR', LT: 'EUR', EE: 'EUR',
  PL: 'PLN', CZ: 'CZK', TR: 'TRY', CN: 'CNY', JP: 'JPY', KR: 'KRW', IN: 'INR', AE: 'AED', IL: 'ILS', CA: 'CAD', AU: 'AUD', BR: 'BRL', MX: 'MXN', CH: 'CHF',
  KZ: 'KZT', UZ: 'UZS', UA: 'UAH', BY: 'BYN', AZ: 'AZN', AM: 'AMD', GE: 'GEL', KG: 'KGS', TJ: 'TJS', MD: 'MDL', TM: 'TMT', RU: 'RUB' };
function detectCur() {
  let tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
  if (TZ[tz]) return TZ[tz];
  if (RU_TZ.test(tz)) return 'RUB';
  const reg = String(navigator.language || '').split('-')[1];
  if (reg && REG[reg.toUpperCase()]) return REG[reg.toUpperCase()];
  return { ru: 'RUB', uk: 'UAH', kk: 'KZT', uz: 'UZS', az: 'AZN', en: 'USD' }[S.lang] || 'USD';
}
if (!S.lang) S.lang = detectLang();
if (!S.cur) S.cur = detectCur();
if (!S.langs.includes(S.lang)) S.langs.push(S.lang);
if (!S.curs.includes(S.cur)) S.curs.push(S.cur);
if (!S.themes.includes(S.theme)) S.themes.push(S.theme);

/* ---------- i18n ---------- */
const LOC = () => LOCS[S.lang] || 'en-US';
function t(key, vars) {
  const get = o => key.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  let v = get(I18N[S.lang]); if (v == null) v = get(I18N.en); if (v == null) v = key;
  if (typeof v === 'string' && vars) v = v.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
  return v;
}
const pn = id => (PN[S.lang] && PN[S.lang][id]) || PN.en[id] || [id, ''];

/* ---------- money ---------- */
const NF = new Map();
function nf(k, o) {
  const key = LOC() + '|' + k; let f = NF.get(key);
  if (!f) { try { f = new Intl.NumberFormat(LOC(), o); } catch (e) { f = new Intl.NumberFormat('en-US', o.style === 'currency' ? Object.assign({}, o, { currencyDisplay: 'code' }) : o); } NF.set(key, f); }
  return f;
}
const DEC = {};
function decOf(c) { if (c in DEC) return DEC[c]; let d = 2; try { d = new Intl.NumberFormat('en-US', { style: 'currency', currency: c }).resolvedOptions().maximumFractionDigits; } catch (e) {} return (DEC[c] = d); }
const isCoin = c => !!COINM[c];
function nice(v, dec) {
  if (!(v > 0)) return 0;
  if (v < 10) return dec ? Math.max(0.09, Math.ceil(v * 10) / 10 - 0.01) : Math.ceil(v);
  if (v < 1000) return dec ? Math.ceil(v) - 0.01 : Math.ceil(v);
  const d = Math.floor(Math.log10(v)) + 1, step = Math.pow(10, d - (d <= 5 ? 2 : 3)), sub = d <= 4 ? 1 : step / 100;
  return Math.ceil(v / step) * step - sub;
}
function conv(usd, c = S.cur) { return isCoin(c) ? usd / COINM[c].r : usd * FIAT[c]; }
function priceIn(usd, c = S.cur) { if (isCoin(c)) return usd / COINM[c].r; if (c === 'USD') return usd; return nice(usd * FIAT[c], decOf(c)); }
function oldIn(p, c = S.cur) { const u = p.usd / (1 - p.d / 100); if (isCoin(c)) return u / COINM[c].r; return nice(c === 'USD' ? u : u * FIAT[c], decOf(c)); }
function fmtCoin(v, c) {
  const a = Math.abs(v); const o = a === 0 || a >= 1000 ? { maximumFractionDigits: 0 } : a >= 1 ? { maximumFractionDigits: 2 } : { maximumSignificantDigits: 4 };
  return nf('k' + JSON.stringify(o), o).format(v) + ' ' + c;
}
function fmt(v, c = S.cur) {
  if (isCoin(c)) return fmtCoin(v, c);
  const dec = decOf(c), int = Math.abs(v - Math.round(v)) < 0.005, n = int ? 0 : dec;
  return nf('c' + c + n, { style: 'currency', currency: c, currencyDisplay: 'narrowSymbol', minimumFractionDigits: n, maximumFractionDigits: n }).format(int ? Math.round(v) : v);
}
function q4(v, c = S.cur) { if (isCoin(c)) return v / 4; const m = Math.pow(10, decOf(c)); return Math.ceil(v / 4 * m) / m; }
function capStr(usd) {
  if (isCoin(S.cur)) return '≈ ' + fmt(usd, 'USD');
  if (!S.cap || !COINM[S.cap]) return '';
  return '≈ ' + fmtCoin(usd / COINM[S.cap].r, S.cap);
}
function curSym(c) {
  if (COINM[c]) return COINM[c].g;
  try { return new Intl.NumberFormat(LOC(), { style: 'currency', currency: c, currencyDisplay: 'narrowSymbol' }).formatToParts(0).find(p => p.type === 'currency').value; } catch (e) { return c; }
}
const DN = {};
function curName(c) {
  if (COINM[c]) return COINM[c].n;
  try { if (!DN[LOC()]) DN[LOC()] = new Intl.DisplayNames([LOC()], { type: 'currency' }); const n = DN[LOC()].of(c); return n ? n.charAt(0).toUpperCase() + n.slice(1) : c; } catch (e) { return c; }
}
const rating = r => nf('r', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(r);
const compact = n => { try { return nf('cp', { notation: 'compact', maximumFractionDigits: 1 }).format(n); } catch (e) { return String(n); } };
const dateFmt = d => { try { return new Intl.DateTimeFormat(LOC(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d); } catch (e) { return d.toLocaleString(); } };
const lenCls = s => (s.length <= 9 ? 'l1' : s.length <= 12 ? 'l2' : s.length <= 15 ? 'l3' : 'l4');

/* ---------- icons ---------- */
const sv = d => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const IC = {
  cart: sv('<path d="M3 4h2.2l2.3 11a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.5L20.8 8H6.1"/><circle cx="9.5" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/>'),
  box: sv('<path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/>'),
  trophy: sv('<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5.5a2.5 2.5 0 0 0 2.6 4M16 6h2.5a2.5 2.5 0 0 1-2.6 4M12 13v4M8.5 20h7M10 17h4"/>'),
  globe: sv('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>'),
  snd: sv('<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
  mute: sv('<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/>'),
  heart: sv('<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>'),
  x: sv('<path d="M6 6l12 12M18 6 6 18"/>'),
  search: sv('<circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4 4"/>'),
  trash: sv('<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/>'),
  phone: sv('<path d="M5 4h3.5l1.5 4-2 1.5a11 11 0 0 0 6.5 6.5l1.5-2 4 1.5V19a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>'),
  lock: sv('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>')
};
$$('[data-ic]').forEach(el => { el.innerHTML = IC[el.dataset.ic] || ''; });

/* photo with emoji fallback (used when images can't load) */
function photo(p, w, cls = '') {
  return `<span class="fb emo" aria-hidden="true">${p.e}</span><img class="loading ${cls}" src="${imgUrl(p.img, w)}" alt="" loading="lazy" decoding="async" onload="this.classList.remove('loading')" onerror="this.remove()">`;
}

/* ---------- sound ---------- */
let AC = null;
function ac() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } } if (AC.state === 'suspended') AC.resume(); return AC; }
function tone(f, t0, dur, type = 'sine', vol = 0.12, f2) {
  const a = ac(); if (!a) return; const n = a.currentTime + t0;
  const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.setValueAtTime(f, n); if (f2) o.frequency.exponentialRampToValueAtTime(f2, n + dur);
  g.gain.setValueAtTime(0.0001, n); g.gain.exponentialRampToValueAtTime(vol, n + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, n + dur);
  o.connect(g); g.connect(a.destination); o.start(n); o.stop(n + dur + 0.03);
}
const SFX = {
  pop() { tone(520, 0, 0.09, 'sine', 0.14, 900); },
  cash() { tone(1318.5, 0, 0.12, 'triangle', 0.12); tone(1760, 0.08, 0.4, 'triangle', 0.12); tone(2637, 0.1, 0.3, 'sine', 0.05); },
  ach() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.08, 0.2, 'square', 0.045)); },
  tick() { tone(1200, 0, 0.03, 'square', 0.03); },
  err() { tone(220, 0, 0.18, 'sawtooth', 0.05, 150); },
  ring() { [0, 0.45].forEach(s => { tone(440, s, 0.3, 'sine', 0.07); tone(480, s, 0.3, 'sine', 0.07); }); },
  whoosh() { tone(180, 0, 0.35, 'sawtooth', 0.03, 900); }
};
function sfx(n) { if (S.sound) { try { SFX[n](); } catch (e) {} } }
function vibrate(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} }

/* ---------- colors / themes ---------- */
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const PAL_KEYS = ['a1', 'a2', 'a3', 'bg', 'sky', 'hz', 'sun1', 'sun2', 'grid'];
const palOf = k => Object.fromEntries(PAL_KEYS.map(n => [n, hex(THEMES[k][n])]));
let pal = palOf(S.theme), target = palOf(S.theme), palMoving = true;
const rgb = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
function stepPalette() {
  if (!palMoving) return;
  let d = 0;
  for (const k of PAL_KEYS) { const a = pal[k], b = target[k]; for (let i = 0; i < 3; i++) { a[i] += (b[i] - a[i]) * 0.045; d += Math.abs(b[i] - a[i]); } }
  const r = document.documentElement.style;
  r.setProperty('--a1', rgb(pal.a1)); r.setProperty('--a2', rgb(pal.a2)); r.setProperty('--a3', rgb(pal.a3)); r.setProperty('--bg', rgb(pal.bg));
  if (d < 2) { for (const k of PAL_KEYS) pal[k] = target[k].slice(); palMoving = false; }
}
function setTheme(k, manual) {
  if (!THEMES[k]) return;
  S.theme = k; if (manual) S.autoTheme = false;
  target = palOf(k); palMoving = true;
  if (typeof bgVideo !== 'undefined') bgVideo.show(k);
  if (!S.themes.includes(k)) S.themes.push(k);
  save(); renderThemeUI(); if (DLG.prefs.open) renderPrefs();
  if (S.themes.length >= 3) queueUnlock(['dj']);
}
function renderThemeUI() { const l = $('#themeLbl'); if (l) l.textContent = THEMES[S.theme].name; }
setInterval(() => { if (S.autoTheme && !document.hidden) { const i = TKEYS.indexOf(S.theme); setTheme(TKEYS[(i + 1) % TKEYS.length], false); } }, 22000);

/* ---------- moving background: neon night race ---------- */
const race = (() => {
  const cv = $('#race'), g = cv.getContext('2d');
  let W = 0, H = 0, stars = [], mts = [], t0 = performance.now(), last = 0;
  const bikes = [
    { lane: -0.5, z: 2.8, sp: 0.55, ph: 0.0, col: 'a1' },
    { lane: 0.45, z: 3.9, sp: 0.42, ph: 1.7, col: 'a2' },
    { lane: -0.1, z: 5.4, sp: 0.35, ph: 3.1, col: 'a3' },
    { lane: 0.75, z: 7.2, sp: 0.5, ph: 4.4, col: 'a1' },
    { lane: -0.8, z: 9.5, sp: 0.3, ph: 2.2, col: 'a2' }
  ];
  function ridge(n, h, rough) { const pts = []; let y = h * 0.5; for (let i = 0; i <= n; i++) { y = Math.max(h * 0.15, Math.min(h, y + (Math.random() - 0.5) * h * rough)); pts.push([i / n, y]); } return pts; }
  function resize() {
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    W = innerWidth; H = innerHeight; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    stars = Array.from({ length: Math.round(W * H / 9000) }, () => ({ x: Math.random(), y: Math.random() * 0.5, r: Math.random() * 1.3 + 0.3, p: Math.random() * 6.3 }));
    mts = [ridge(14, 0.16, 0.9), ridge(22, 0.09, 1.1)];
  }
  function drawBike(b, x, y, s, lean, col) {
    // s = bike height in px; rear view of rider on a sport bike
    g.save(); g.translate(x, y); g.rotate(lean);
    // light trails toward the viewer
    const tl = g.createLinearGradient(0, 0, 0, s * 2.6);
    tl.addColorStop(0, rgba(pal.sun2, 0.75)); tl.addColorStop(1, rgba(pal.sun2, 0));
    g.fillStyle = tl;
    g.beginPath(); g.moveTo(-s * 0.08, -s * 0.18); g.lineTo(s * 0.08, -s * 0.18); g.lineTo(s * 0.26, s * 2.6); g.lineTo(-s * 0.26, s * 2.6); g.closePath(); g.fill();
    // wheel
    g.fillStyle = '#05040A'; g.beginPath(); g.ellipse(0, -s * 0.16, s * 0.09, s * 0.17, 0, 0, Math.PI * 2); g.fill();
    // body / fairing
    const bg = g.createLinearGradient(0, -s * 0.75, 0, -s * 0.2);
    bg.addColorStop(0, rgb(col)); bg.addColorStop(1, rgb(mix(col, pal.bg, 0.6)));
    g.fillStyle = bg;
    g.beginPath(); g.moveTo(-s * 0.3, -s * 0.42); g.quadraticCurveTo(0, -s * 0.62, s * 0.3, -s * 0.42); g.lineTo(s * 0.16, -s * 0.22); g.lineTo(-s * 0.16, -s * 0.22); g.closePath(); g.fill();
    // rider torso
    g.fillStyle = '#0B0A14';
    g.beginPath(); g.moveTo(-s * 0.22, -s * 0.5); g.quadraticCurveTo(-s * 0.26, -s * 0.86, 0, -s * 0.9); g.quadraticCurveTo(s * 0.26, -s * 0.86, s * 0.22, -s * 0.5); g.closePath(); g.fill();
    g.strokeStyle = rgba(col, 0.9); g.lineWidth = Math.max(1, s * 0.025); g.stroke();
    // helmet
    const hg = g.createRadialGradient(-s * 0.04, -s * 1.02, s * 0.02, 0, -s * 0.98, s * 0.15);
    hg.addColorStop(0, rgb(mix(col, [255, 255, 255], 0.5))); hg.addColorStop(1, rgb(mix(col, pal.bg, 0.35)));
    g.fillStyle = hg; g.beginPath(); g.arc(0, -s * 0.98, s * 0.14, 0, Math.PI * 2); g.fill();
    // tail light glow
    g.globalCompositeOperation = 'lighter';
    const lg = g.createRadialGradient(0, -s * 0.3, 0, 0, -s * 0.3, s * 0.45);
    lg.addColorStop(0, rgba(pal.sun2, 0.95)); lg.addColorStop(0.25, rgba(pal.sun2, 0.35)); lg.addColorStop(1, rgba(pal.sun2, 0));
    g.fillStyle = lg; g.fillRect(-s * 0.5, -s * 0.75, s, s * 0.9);
    g.fillStyle = rgba([255, 240, 240], 0.95); g.fillRect(-s * 0.12, -s * 0.33, s * 0.24, Math.max(1.5, s * 0.04));
    g.globalCompositeOperation = 'source-over';
    g.restore();
  }
  function frame(now) {
    const t = (now - t0) / 1000;
    stepPalette();
    const hz = H * 0.56, cx = W / 2, depth = H - hz;
    // sky
    const sky = g.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, rgb(pal.bg)); sky.addColorStop(0.55, rgb(pal.sky)); sky.addColorStop(1, rgb(mix(pal.hz, pal.sky, 0.25)));
    g.fillStyle = sky; g.fillRect(0, 0, W, hz + 1);
    // stars
    for (const s of stars) { g.fillStyle = rgba([255, 255, 255], 0.25 + 0.6 * Math.abs(Math.sin(t * 1.3 + s.p))); g.fillRect(s.x * W, s.y * H, s.r, s.r); }
    // sun
    const R = Math.min(W * 0.22, H * 0.26), sy = hz - R * 0.42;
    g.globalCompositeOperation = 'lighter';
    const glow = g.createRadialGradient(cx, sy, R * 0.6, cx, sy, R * 2.4);
    glow.addColorStop(0, rgba(pal.sun2, 0.45)); glow.addColorStop(1, rgba(pal.sun2, 0));
    g.fillStyle = glow; g.fillRect(cx - R * 2.4, sy - R * 2.4, R * 4.8, R * 4.8);
    g.globalCompositeOperation = 'source-over';
    g.save(); g.beginPath(); g.arc(cx, sy, R, 0, Math.PI * 2); g.clip();
    const sg = g.createLinearGradient(0, sy - R, 0, sy + R); sg.addColorStop(0, rgb(pal.sun1)); sg.addColorStop(1, rgb(pal.sun2));
    g.fillStyle = sg; g.fillRect(cx - R, sy - R, R * 2, R * 2);
    g.fillStyle = sky;
    for (let i = 0; i < 9; i++) { const k = (i + (t * 0.4) % 1) / 9; const yy = sy + k * R * 1.05; g.fillRect(cx - R, yy, R * 2, 1 + k * R * 0.1); }
    g.restore();
    // mountains
    mts.forEach((m, li) => {
      g.beginPath(); g.moveTo(0, hz);
      m.forEach(([x, y]) => g.lineTo(x * W, hz - y * H));
      g.lineTo(W, hz); g.closePath();
      g.fillStyle = rgb(mix(pal.bg, pal.sky, li ? 0.35 : 0.7)); g.fill();
      g.strokeStyle = rgba(li ? pal.a1 : pal.a2, li ? 0.8 : 0.55); g.lineWidth = 1.5;
      g.beginPath(); m.forEach(([x, y], i) => (i ? g.lineTo(x * W, hz - y * H) : g.moveTo(x * W, hz - y * H))); g.stroke();
    });
    // ground
    const gg = g.createLinearGradient(0, hz, 0, H); gg.addColorStop(0, rgb(mix(pal.bg, pal.hz, 0.3))); gg.addColorStop(1, rgb(pal.bg));
    g.fillStyle = gg; g.fillRect(0, hz, W, depth);
    // grid
    const gl = g.createLinearGradient(0, hz, 0, H); gl.addColorStop(0, rgba(pal.grid, 0)); gl.addColorStop(0.25, rgba(pal.grid, 0.45)); gl.addColorStop(1, rgba(pal.grid, 0.9));
    g.strokeStyle = gl; g.lineWidth = 1.2; g.beginPath();
    for (let i = -16; i <= 16; i++) { g.moveTo(cx + i * W * 0.004, hz); g.lineTo(cx + i * W * 0.16, H); }
    const N = 16, spd = t * 2.4;
    for (let k = 0; k < N; k++) { const z = N - ((k + spd) % N) + 0.6; const y = hz + depth * 1.1 / z; if (y > H) continue; g.moveTo(0, y); g.lineTo(W, y); }
    g.stroke();
    // road
    const hw = y => W * 0.012 + W * 0.3 * ((y - hz) / depth);
    g.fillStyle = rgba(pal.bg, 0.72);
    g.beginPath(); g.moveTo(cx - hw(hz), hz); g.lineTo(cx + hw(hz), hz); g.lineTo(cx + hw(H), H); g.lineTo(cx - hw(H), H); g.closePath(); g.fill();
    g.strokeStyle = rgba(pal.a2, 0.95); g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(cx - hw(hz), hz); g.lineTo(cx - hw(H), H); g.moveTo(cx + hw(hz), hz); g.lineTo(cx + hw(H), H); g.stroke();
    g.strokeStyle = rgba(pal.a2, 0.25); g.lineWidth = 10; g.stroke();
    // lane dashes
    g.fillStyle = rgba(pal.a3, 0.85);
    for (let k = 0; k < 14; k++) {
      const z1 = 14 - ((k + t * 3.2) % 14) + 0.6, z2 = z1 + 0.45;
      const y1 = hz + depth * 1.1 / z1, y2 = hz + depth * 1.1 / z2; if (y2 > H) continue;
      const w1 = 2 + 14 / z1, w2 = 2 + 14 / z2;
      for (const lx of [-0.34, 0.34]) {
        const x1 = cx + lx * hw(y1), x2 = cx + lx * hw(y2);
        g.beginPath(); g.moveTo(x2 - w2 / 2, y2); g.lineTo(x2 + w2 / 2, y2); g.lineTo(x1 + w1 / 2, Math.min(H, y1)); g.lineTo(x1 - w1 / 2, Math.min(H, y1)); g.closePath(); g.fill();
      }
    }
    // horizon line
    g.fillStyle = rgba(pal.hz, 0.9); g.fillRect(0, hz - 1, W, 2);
    // bikes (far first)
    const list = bikes.map(b => {
      const z = b.z + Math.sin(t * b.sp + b.ph) * 2.2 + Math.sin(t * b.sp * 2.3 + b.ph) * 0.6;
      const lane = b.lane + Math.sin(t * 0.5 + b.ph * 1.3) * 0.18;
      const dl = Math.cos(t * 0.5 + b.ph * 1.3) * 0.09;
      return { b, z: Math.max(1.6, z), lane, dl };
    }).sort((a, b) => b.z - a.z);
    for (const o of list) {
      const y = hz + depth * 1.1 / o.z; if (y > H + 40) continue;
      const x = cx + o.lane * hw(y) * 0.8, s = depth * 0.85 / o.z;
      drawBike(o.b, x, y, s, o.dl * 0.6, pal[o.b.col]);
    }
    // speed sparks on the sides
    g.strokeStyle = rgba(pal.a1, 0.5); g.lineWidth = 1.5; g.beginPath();
    for (let i = 0; i < 18; i++) {
      const k = ((i * 0.37 + t * 0.9) % 1), y = hz + depth * Math.pow(k, 1.8), side = i % 2 ? 1 : -1;
      const x = cx + side * (hw(y) + 20 + (i * 37 % 200) * (y - hz) / depth);
      g.moveTo(x, y); g.lineTo(x + side * 6 * k, y + 30 * k);
    }
    g.stroke();
  }
  function loop(now) {
    if (document.body.classList.contains('has-video')) stepPalette();
    else if (!document.hidden && now - last > 30) { last = now; frame(now); }
    if (!RM.matches) requestAnimationFrame(loop);
  }
  addEventListener('resize', () => { resize(); if (RM.matches) frame(performance.now()); });
  resize();
  if (RM.matches) { const f = () => { stepPalette(); frame(t0 + 4000); if (palMoving) requestAnimationFrame(f); }; f(); setInterval(() => { if (palMoving) f(); }, 500); }
  else requestAnimationFrame(loop);
  return { frame };
})();

/* ---------- video background: one looping clip per theme, cross-fade on change ---------- */
/* Which themes already have a clip in bg/. The others show their still image. */
const HAS_VIDEO = new Set(['race-rave', 'race-sunset', 'race-ice', 'solo', 'duo']);
const bgVideo = (() => {
  const box = $('.bgv'), vs = [$('#v1'), $('#v2')]; let cur = 0, want = '';
  // the still image always sits under the video, so the page is never black (no autoplay, low-power mode, slow network)
  function setStill(name) { box.style.backgroundImage = `url("bg/${name}.jpg")`; document.body.classList.add('has-video'); }
  function hideAll() { vs.forEach(v => { v.classList.remove('on', 'ready'); v.pause(); }); }
  function show(key) {
    const th = THEMES[key]; if (!th || !th.bg_v) return;
    const name = th.bg_v; if (want === name) return; want = name;
    setStill(name);
    if (RM.matches || !HAS_VIDEO.has(name)) { hideAll(); return; }
    const next = vs[1 - cur], prev = vs[cur];
    next.classList.remove('ready');
    next.src = `bg/${name}.mp4`; next.load();
    const p = next.play(); if (p && p.catch) p.catch(() => {});
    next.addEventListener('playing', () => {
      if (want !== name) return;
      cur = vs.indexOf(next);
      next.classList.add('on', 'ready'); prev.classList.remove('on', 'ready');
      setTimeout(() => { if (!prev.classList.contains('on')) prev.pause(); }, 1500);
    }, { once: true });
  }
  document.addEventListener('visibilitychange', () => { const v = vs[cur]; if (!v.src) return; if (document.hidden) v.pause(); else { const p = v.play(); if (p && p.catch) p.catch(() => {}); } });
  return { show };
})();
bgVideo.show(S.theme);

/* ---------- dialogs ---------- */
const DLG = { pd: $('#dlgPd'), cart: $('#dlgCart'), orders: $('#dlgOrders'), co: $('#dlgCo'), prefs: $('#dlgPrefs'), ach: $('#dlgAch') };
let needRaise = false;
const RENDER = {};
function openDlg(n) {
  const d = DLG[n]; RENDER[n]();
  if (!d.open) { try { d.showModal(); } catch (e) { d.setAttribute('open', ''); } }
  needRaise = true;
}
function closeDlg(n) { if (DLG[n].open) DLG[n].close(); }
const anyOpen = () => Object.values(DLG).some(d => d.open);
Object.values(DLG).forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));

/* ---------- toasts & confetti ---------- */
const toastBox = $('#toasts');
function topLayer(el) { if (!el.showPopover) return; try { if (el.matches(':popover-open')) el.hidePopover(); el.showPopover(); } catch (e) {} }
topLayer(toastBox);
function toast(icon, text, o = {}) {
  const el = document.createElement('div'); el.className = 'toast';
  el.innerHTML = (o.img ? `<img class="ti" src="${imgUrl(o.img, 80)}" alt="" onerror="this.outerHTML='<span class=&quot;emo&quot;>${icon}</span>'">` : `<span class="emo">${icon}</span>`) + `<span>${esc(text)}</span>`;
  if (o.act) { el.style.cursor = 'pointer'; el.addEventListener('click', () => openPd(o.act)); }
  toastBox.appendChild(el);
  if (needRaise) { topLayer(toastBox); needRaise = false; }
  while (toastBox.children.length > 3) toastBox.firstElementChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 260); }, o.ms || 3400);
}
const fx = $('#fx'), fg = fx.getContext('2d'); let parts = [], fxRaf = 0;
function confetti(n = 180) {
  if (RM.matches) return; topLayer(fx);
  const dpr = Math.min(2, window.devicePixelRatio || 1); fx.width = innerWidth * dpr; fx.height = innerHeight * dpr; fg.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cols = [rgb(pal.a1), rgb(pal.a2), rgb(pal.a3), '#FFFFFF', '#3BF0A0'];
  for (let i = 0; i < n; i++) {
    const left = i % 2 === 0;
    parts.push({ x: left ? -10 : innerWidth + 10, y: innerHeight * 0.7, vx: (left ? 1 : -1) * (5 + Math.random() * 10), vy: -(9 + Math.random() * 13), w: 6 + Math.random() * 6, h: 8 + Math.random() * 10, r: Math.random() * 6.3, vr: (Math.random() - 0.5) * 0.35, c: cols[i % cols.length], life: 0 });
  }
  if (!fxRaf) fxRaf = requestAnimationFrame(fxStep);
}
function fxClear() { fg.save(); fg.setTransform(1, 0, 0, 1, 0, 0); fg.clearRect(0, 0, fx.width, fx.height); fg.restore(); }
addEventListener('resize', () => { if (!fxRaf) return; const dpr = Math.min(2, window.devicePixelRatio || 1); fx.width = innerWidth * dpr; fx.height = innerHeight * dpr; fg.setTransform(dpr, 0, 0, dpr, 0, 0); });
function fxStep() {
  fxClear();
  parts = parts.filter(p => p.y < innerHeight + 40 && p.life < 420);
  for (const p of parts) {
    p.life++; p.vy += 0.33; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
    fg.save(); fg.translate(p.x, p.y); fg.rotate(p.r); fg.fillStyle = p.c; fg.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.life * 0.1)) + 1); fg.restore();
  }
  if (parts.length) fxRaf = requestAnimationFrame(fxStep);
  else { fxRaf = 0; fxClear(); try { fx.hidePopover(); } catch (e) {} }
}

/* ---------- dopamine ---------- */
const dopaGet = () => Math.max(0, (S.dopa || 0) - (Date.now() - (S.dopaT || 0)) / 4000);
function dopaAdd(n) { S.dopa = Math.min(100, dopaGet() + n); S.dopaT = Date.now(); save(); renderDopa(); }
function renderDopa() {
  const v = dopaGet(), lv = t('dopaLv'), i = v < 15 ? 0 : v < 45 ? 1 : v < 80 ? 2 : 3;
  $('#dopaFill').style.width = v + '%'; $('#dopaLv').textContent = lv[i];
  const r = $('#rcDopa'); if (r) { const k = Math.round(v / 10); r.textContent = '█'.repeat(k) + '░'.repeat(10 - k) + ' ' + Math.round(v) + '%'; }
}

/* ---------- achievements ---------- */
let unlockDelay = 0;
function queueUnlock(ids) {
  ids.forEach(id => {
    if (S.ach.includes(id)) return;
    S.ach.push(id); save();
    const e = (ACH.find(a => a[0] === id) || [0, '🏆'])[1];
    setTimeout(() => { toast(e, t('achUnlocked') + ': ' + t('ach')[id][0]); sfx('ach'); dopaAdd(12); if (DLG.ach.open) renderAch(); }, unlockDelay);
    unlockDelay += 750; setTimeout(() => { unlockDelay = Math.max(0, unlockDelay - 750); }, unlockDelay);
  });
}

/* ---------- static text ---------- */
function renderStatic() {
  document.documentElement.lang = S.lang;
  $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
  $$('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  $$('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
}

/* ---------- cart math ---------- */
function cartIds() { return Object.keys(S.cart).filter(id => PM[id] && S.cart[id] > 0); }
function cartSum(c = S.cur) {
  let sub = 0, usd = 0, n = 0;
  for (const id of cartIds()) { const p = PM[id], q = S.cart[id]; sub += priceIn(p.usd, c) * q; usd += p.usd * q; n += q; }
  const pct = S.promo ? PROMOS[S.promo] || 0 : 0, disc = sub * pct / 100;
  return { sub, disc, total: sub - disc, usd: usd * (1 - pct / 100), n, pct };
}

/* ---------- header ---------- */
function renderHeader() {
  const s = cartSum(), b = $('#cartBadge');
  b.hidden = !s.n; b.textContent = s.n;
  $('#cartSum').textContent = s.n ? fmt(s.total) : fmt(0);
  const ob = $('#ordBadge'); ob.hidden = !S.orders.length; ob.textContent = S.orders.length;
  $('#prefsLbl').textContent = S.lang.toUpperCase() + ' · ' + curSym(S.cur);
  $('#btnSound').innerHTML = S.sound ? IC.snd : IC.mute;
  renderThemeUI();
}
function bumpBadge() { const b = $('#cartBadge'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }

/* ---------- hero ---------- */
function barcode(seed) {
  let h = 0; for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  let out = ''; for (let i = 0; i < 44; i++) { h = (Math.imul(h, 1103515245) + 12345) >>> 0; out += `<span style="width:${1 + ((h >>> 16) % 3)}px"></span>`; }
  return `<div class="barcode" aria-hidden="true">${out}</div>`;
}
const row = (a, b, cls = '') => `<div class="rc-row ${cls}"><span>${esc(a)}</span><i></i><b>${esc(b)}</b></div>`;
function renderHero() {
  $('#trust').innerHTML = t('trust').map(([a, b]) => `<li><b>${esc(a.replace('{zero}', fmt(0)))}</b>${esc(b)}</li>`).join('');
  const st = S.stats;
  $('#heroRc').innerHTML = `<div class="rc-head"><b>dofamart</b><span>${esc(t('rcTitle'))}</span><span>${esc(dateFmt(new Date()))}</span></div>`
    + row(t('rcSaved'), fmt(conv(st.saved))) + row(t('rcOrders'), st.orders) + row(t('rcItems'), st.items)
    + row(t('rcCharged'), fmt(0), 'big')
    + `<div class="rc-row"><span>${esc(t('rcDopa'))}</span><i></i><b id="rcDopa"></b></div>`
    + barcode('DF' + st.orders + st.items) + `<div class="rc-thanks">${esc(t('rcThanks'))}</div>`;
  renderDopa();
}

/* ---------- categories ---------- */
function renderTiles() {
  $('#catCount').textContent = CATS.length;
  const all = `<button class="tile all${S.cat === 'all' ? ' on' : ''}" data-act="tile" data-v="all"><span class="big">${P.length}</span><span class="t-n">${esc(t('cats.all'))}</span><span class="t-c">${CATS.length} × ${esc(t('catsTitle'))}</span></button>`;
  $('#tiles').innerHTML = all + CATS.map(([c, e]) => {
    const items = P.filter(p => p.c === c); const cover = items[0];
    return `<button class="tile${S.cat === c ? ' on' : ''}" data-act="tile" data-v="${c}"><img src="${imgUrl(cover.img, 400)}" alt="" loading="lazy" onerror="this.remove()"><span class="emo">${e}</span><span class="t-n">${esc(t('cats')[c])}</span><span class="t-c">${items.length} · ${esc(t('items'))}</span></button>`;
  }).join('');
}

/* ---------- deals ---------- */
function dealIds() {
  let s = Math.floor(Date.now() / 600000) % 233280;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const pool = P.filter(p => p.d >= 20);
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, 4).map(p => p.id);
}
function renderDeals() {
  $('#deals').innerHTML = dealIds().map(id => {
    const p = PM[id];
    return `<button class="deal" data-act="open" data-id="${id}"><span class="ph">${photo(p, 160)}</span><span class="deal-t"><span class="deal-n">${esc(pn(id)[0])}</span><span class="deal-p"><span>${esc(fmt(priceIn(p.usd)))}</span><span class="disc" style="position:static">−${p.d}%</span></span></span></button>`;
  }).join('');
}

/* ---------- catalog ---------- */
function renderChips() {
  const cats = ['all', ...CATS.map(c => c[0]), 'fav'];
  $('#chips').innerHTML = cats.map(c => {
    const n = c === 'all' ? P.length : c === 'fav' ? S.fav.length : P.filter(p => p.c === c).length;
    return `<button class="chip${S.cat === c ? ' on' : ''}" data-act="cat" data-v="${c}" aria-pressed="${S.cat === c}">${c === 'fav' ? '♥ ' : ''}${esc(t('cats')[c])}<small>${n}</small></button>`;
  }).join('');
}
function renderSort() {
  const o = t('sort');
  $('#sort').innerHTML = Object.keys(o).map(k => `<option value="${k}"${S.sort === k ? ' selected' : ''}>${esc(o[k])}</option>`).join('');
}
function filtered() {
  const q = ($('#q').value || '').trim().toLowerCase();
  let list = ORDER.map(id => PM[id]).filter(Boolean);
  P.forEach(p => { if (!list.includes(p)) list.push(p); });
  if (q) list = list.filter(p => [pn(p.id)[0], pn(p.id)[1], PN.en[p.id][0], PN.ru[p.id][0], p.id, t('cats')[p.c]].join(' ').toLowerCase().includes(q));
  else if (S.cat === 'fav') list = list.filter(p => S.fav.includes(p.id));
  else if (S.cat !== 'all') list = list.filter(p => p.c === S.cat);
  const srt = { cheap: (a, b) => a.usd - b.usd, exp: (a, b) => b.usd - a.usd, disc: (a, b) => b.d - a.d }[S.sort];
  if (srt) list.sort(srt);
  return list;
}
function priceHTML(p) {
  const ps = fmt(priceIn(p.usd)), os = p.d ? fmt(oldIn(p)) : '', cap = capStr(p.usd);
  return `<div class="price ${lenCls(ps)}"><b>${esc(ps)}</b>${os ? `<s>${esc(os)}</s>` : ''}</div>${cap ? `<div class="cap">${esc(cap)}</div>` : ''}`;
}
function buyHTML(id) {
  const q = S.cart[id] || 0;
  return q ? `<div class="stepper"><button data-act="dec" aria-label="−">−</button><span>${q}</span><button data-act="inc" aria-label="+">+</button></div>`
    : `<button class="add" data-act="add">${IC.cart}<span class="lbl">${esc(t('toCart'))}</span><span class="lbl-s">+</span></button>`;
}
function cardHTML(p) {
  const nm = pn(p.id)[0], fav = S.fav.includes(p.id);
  return `<article class="card" data-id="${p.id}">
<div class="ph" data-act="open" role="button" tabindex="0" aria-label="${esc(nm)}">${photo(p, 520)}${p.d ? `<span class="disc">−${p.d}%</span>` : ''}${p.s <= 5 ? `<span class="stock">${esc(t('left', { n: p.s }))}</span>` : ''}</div>
<button class="fav${fav ? ' on' : ''}" data-act="fav" aria-pressed="${fav}" aria-label="${esc(t('fav'))}">${IC.heart}</button>
${priceHTML(p)}
<h3 class="nm"><button data-act="open">${esc(nm)}</button></h3>
<div class="meta"><span class="star">★</span>${rating(p.r)}<span>· ${compact(p.n)}</span></div>
<div class="buy">${buyHTML(p.id)}</div>
</article>`;
}
function renderGrid() {
  const list = filtered(), q = ($('#q').value || '').trim();
  $('#count').textContent = list.length;
  $('#grid').innerHTML = list.map(cardHTML).join('');
  const em = $('#gridEmpty');
  if (list.length) { em.hidden = true; return; }
  em.hidden = false;
  em.innerHTML = !q && S.cat === 'fav' ? `<span class="emo">💜</span><p>${esc(t('favEmpty'))}</p>`
    : `<span class="emo">🔍</span><p>${esc(t('noResults'))}</p><button class="btn btn-ghost" data-act="clear-q">${esc(t('resetSearch'))}</button>`;
}
function updateCard(id) {
  const c = $(`#grid .card[data-id="${id}"]`); if (!c) return;
  c.querySelector('.buy').innerHTML = buyHTML(id);
  const f = c.querySelector('.fav'), on = S.fav.includes(id); f.classList.toggle('on', on); f.setAttribute('aria-pressed', on);
}
function renderSteps() { $('#steps').innerHTML = t('how').map(([a, b]) => `<li><h3>${esc(a)}</h3><p>${esc(b)}</p></li>`).join(''); }

/* ---------- cart actions ---------- */
function fly(src, p) {
  const a = src.getBoundingClientRect(), b = $('#btnCart').getBoundingClientRect();
  const s = document.createElement('div'); s.className = 'flyer';
  s.innerHTML = `<img src="${imgUrl(p.img, 140)}" alt="" onerror="this.outerHTML='<span class=&quot;emo&quot;>${p.e}</span>'">`;
  s.style.left = (a.left + a.width / 2 - 35) + 'px'; s.style.top = (a.top + a.height / 2 - 35) + 'px';
  document.body.appendChild(s);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const an = s.animate([
    { transform: 'translate(0,0) scale(1) rotate(0)', opacity: 1 },
    { transform: `translate(${dx * 0.45}px,${dy * 0.45 - 90}px) scale(.85) rotate(-12deg)`, opacity: 1, offset: 0.5 },
    { transform: `translate(${dx}px,${dy}px) scale(.2) rotate(8deg)`, opacity: 0.4 }
  ], { duration: 720, easing: 'cubic-bezier(.5,0,.6,1)' });
  an.onfinish = () => { s.remove(); bumpBadge(); };
}
function addToCart(id, n = 1, src = null) {
  if (!PM[id]) return;
  S.cart[id] = Math.min(99, (S.cart[id] || 0) + n); save();
  updateCard(id); renderHeader(); if (DLG.cart.open) renderCart();
  sfx('pop'); vibrate(15); dopaAdd(6);
  if (src && !RM.matches) fly(src, PM[id]); else { bumpBadge(); toast(PM[id].e, t('added'), { img: PM[id].img, ms: 1800 }); }
  queueUnlock(['first_cart']);
}
function setQty(id, q) {
  if (q <= 0) delete S.cart[id]; else S.cart[id] = Math.min(99, q);
  if (!cartIds().length) S.promo = null;
  save(); updateCard(id); renderHeader(); if (DLG.cart.open) renderCart(); sfx('tick');
}
function toggleFav(id) {
  const i = S.fav.indexOf(id); if (i >= 0) S.fav.splice(i, 1); else { S.fav.push(id); dopaAdd(2); }
  save(); sfx('pop'); renderChips(); if (S.cat === 'fav') renderGrid(); else updateCard(id);
}
function applyPromo(code) {
  const c = String(code || '').trim().toUpperCase();
  if (PROMOS[c] != null) { S.promo = c; save(); renderCart(); renderHeader(); sfx('cash'); dopaAdd(10); confetti(70); queueUnlock(['promo']); }
  else { const m = $('#promoMsg'); if (m) m.textContent = t('promoBad'); sfx('err'); }
}

/* ---------- product modal ---------- */
let pdId = null, pdQty = 1;
function openPd(id) { if (!PM[id]) return; if (pdId !== id) pdQty = 1; pdId = id; openDlg('pd'); }
RENDER.pd = function () {
  const p = PM[pdId]; if (!p) return; const [nm, ds] = pn(p.id); const pr = priceIn(p.usd);
  $('#pdBox').innerHTML = `<button class="x" data-act="close" aria-label="${esc(t('close'))}">${IC.x}</button>
<div class="pd-grid"><div class="ph pd-ph">${photo(p, 900)}${p.d ? `<span class="disc">−${p.d}%</span>` : ''}</div>
<div class="pd-info"><span class="eyebrow">${esc(t('cats')[p.c])}</span><h2>${esc(nm)}</h2>
<div class="meta"><span class="star">★</span>${rating(p.r)} · ${compact(p.n)}${p.s <= 5 ? ` · <span class="hot">${esc(t('left', { n: p.s }))}</span>` : ''}</div>
<p class="pd-desc">${esc(ds)}</p>${priceHTML(p)}
<div class="split">${esc(t('split', { x: '§' })).replace('§', `<b>${esc(fmt(q4(pr)))}</b>`)}</div>
<dl class="facts">${t('pdFacts').map(([a, b]) => `<div><dt>${esc(a)}</dt><dd>${esc(b)}</dd></div>`).join('')}</dl>
<div class="pd-buy"><div class="stepper"><button data-act="pd-q" data-v="-1" aria-label="−">−</button><span>${pdQty}</span><button data-act="pd-q" data-v="1" aria-label="+">+</button></div>
<button class="btn btn-ghost" data-act="pd-add">${esc(t('toCart'))}</button><button class="btn btn-main" data-act="pd-buy">${esc(t('buyNow'))}</button></div>
<div class="credit"><a href="https://unsplash.com/photos/${p.img}" target="_blank" rel="noopener">${esc(t('photos'))}</a></div></div></div>`;
};

/* ---------- cart drawer ---------- */
function sumHTML(sum) {
  const cap = capStr(sum.usd);
  return `<div class="sum"><div><span>${esc(t('subtotal'))}</span><b>${esc(fmt(sum.sub))}</b></div>${sum.disc ? `<div class="neg"><span>${esc(t('discount'))} ${sum.pct}%</span><b>−${esc(fmt(sum.disc))}</b></div>` : ''}<div><span>${esc(t('delivery'))}</span><b class="ok">${esc(t('free'))}</b></div><div class="tot"><span>${esc(t('total'))}</span><b>${esc(fmt(sum.total))}</b></div>${cap ? `<div class="capr">${esc(cap)}</div>` : ''}</div>`;
}
RENDER.cart = function renderCart() {
  const ids = cartIds(), sum = cartSum();
  const head = `<div class="d-head"><h2>${esc(t('cart'))} <span class="count">${sum.n || ''}</span></h2><button class="x" data-act="close" aria-label="${esc(t('close'))}">${IC.x}</button></div>`;
  if (!ids.length) { $('#cartBox').innerHTML = head + `<div class="d-empty"><span class="emo">🛒</span><p>${esc(t('cartEmpty'))}</p><button class="btn btn-main" data-act="go-shop">${esc(t('goShop'))}</button></div>`; return; }
  const items = ids.map(id => {
    const p = PM[id], q = S.cart[id], u = priceIn(p.usd);
    return `<div class="ci" data-id="${id}"><button class="ph" data-act="open" aria-label="${esc(pn(id)[0])}">${photo(p, 160)}</button><div class="ci-t"><button class="ci-n" data-act="open">${esc(pn(id)[0])}</button><div class="ci-p">${esc(fmt(u))}</div><div class="stepper sm"><button data-act="dec" aria-label="−">−</button><span>${q}</span><button data-act="inc" aria-label="+">+</button></div></div><div class="ci-r"><b>${esc(fmt(u * q))}</b><button class="rm" data-act="rm" aria-label="${esc(t('remove'))}">${IC.trash}</button></div></div>`;
  }).join('');
  const promo = S.promo ? `<div class="promo-ok"><span>${esc(t('promoOk', { c: S.promo, p: PROMOS[S.promo] }))}</span><button data-act="promo-clear" aria-label="${esc(t('remove'))}">${IC.x}</button></div>`
    : `<form id="promoForm" class="promo"><input id="promoIn" placeholder="${esc(t('promo'))}" autocomplete="off" aria-label="${esc(t('promo'))}"><button class="btn btn-ghost sm">${esc(t('apply'))}</button></form><div class="promo-msg" id="promoMsg"></div>`;
  $('#cartBox').innerHTML = head + `<div class="d-body">${items}</div><div class="d-foot">${promo}${sumHTML(sum)}<button class="btn btn-main full" data-act="checkout">${esc(t('checkout'))} · ${esc(fmt(sum.total))}</button></div>`;
};
const renderCart = () => RENDER.cart();

/* ---------- checkout ---------- */
let co = { step: 1, dest: 'home', speed: 'std', pay: 'card', coin: 'USDT', phase: null, order: null, log: [] };
let paying = false;
function startCheckout() {
  if (!cartIds().length) { closeDlg('pd'); openDlg('cart'); return; }
  closeDlg('cart'); closeDlg('pd');
  Object.assign(co, { step: 1, phase: null, order: null, log: [], ok: false, coin: isCoin(S.cur) ? S.cur : (co.coin || 'USDT') });
  openDlg('co'); sfx('whoosh');
}
const opt = (k, v, emo, [a, b]) => `<button class="opt" data-act="co-set" data-k="${k}" data-v="${v}" aria-pressed="${co[k] === v}"><span class="emo">${emo}</span><span><b>${esc(a)}</b><small>${esc(b)}</small></span></button>`;
function coSum(btn) {
  const ids = cartIds(), sum = cartSum();
  const lines = ids.slice(0, 4).map(id => `<div class="co-li"><span class="emo">${PM[id].e}</span><span>${esc(pn(id)[0])}</span><em>×${S.cart[id]}</em></div>`).join('') + (ids.length > 4 ? `<div class="co-more">+${ids.length - 4}</div>` : '');
  return `<aside class="co-sum">${lines}${sumHTML(sum)}${btn}</aside>`;
}
function coStep1() {
  const d = t('dest'), s = t('speed');
  return `<div class="co-grid"><div class="co-main"><h3>${esc(t('coWhere'))}</h3><div class="opts">${Object.keys(DEST).map(k => opt('dest', k, DEST[k], d[k])).join('')}</div>
<h3>${esc(t('coSpeed'))}</h3><div class="opts three">${Object.keys(SPEED).map(k => opt('speed', k, SPEED[k], s[k])).join('')}</div></div>
${coSum(`<button class="btn btn-main full" data-act="co-next">${esc(t('next'))} →</button>`)}</div>`;
}
function coStep2() {
  const pm = t('pay'), sum = cartSum(); let det = '';
  if (co.pay === 'card') det = `<div class="dcard"><div class="dc-top"><span class="dc-chip"></span><b>DOFAMIN</b></div><div class="dc-num">•••• •••• •••• 0000</div><div class="dc-bot"><span>${esc(t('cardHolder'))}</span><b>∞</b></div></div>`;
  else if (co.pay === 'crypto') {
    const c = COINM[co.coin];
    det = `<h3>${esc(t('coinPick'))}</h3><div class="coins">${COINS.map(k => `<button class="coin" data-act="co-set" data-k="coin" data-v="${k.c}" aria-pressed="${co.coin === k.c}"><i style="background:${k.bg}">${k.g}</i>${k.c}</button>`).join('')}</div>
<div class="cbox"><div><span>${esc(t('toPay'))}</span><b>${esc(fmtCoin(sum.usd / c.r, c.c))}</b></div><div><span>${esc(t('network'))}</span><span>${esc(c.net)}</span></div></div><p class="note">${esc(t('cryptoNote'))}</p>`;
  } else det = `<p class="note big"><span class="emo">${PAY[co.pay]}</span><span>${esc(pm[co.pay][1])}</span></p>`;
  const amt = co.pay === 'crypto' ? fmtCoin(sum.usd / COINM[co.coin].r, co.coin) : fmt(sum.total);
  return `<div class="co-grid"><div class="co-main"><h3>${esc(t('coPay'))}</h3><div class="opts">${Object.keys(PAY).map(k => opt('pay', k, PAY[k], pm[k])).join('')}</div>
<div class="pay-det">${det}</div><div id="coConsentSlot"></div><p class="note">${IC.lock}<span>${esc(t('noDataNote'))}</span></p></div>
${coSum(`<div class="co-btns"><button class="btn btn-ghost" data-act="co-back">← ${esc(t('back'))}</button><span id="coPaySlot" data-amt="${esc(amt)}" style="display:contents"></span></div>`)}</div>`;
}
const plogHTML = () => co.log.map((s, i) => `<li class="${i < co.log.length - 1 ? 'ok' : 'cur'}">${esc(s)}</li>`).join('');
function receiptHTML(o) {
  const rc = t('rc');
  const lines = o.items.map(i => { const p = PM[i.id]; if (!p) return ''; const u = priceIn(p.usd, o.cur); return `<div class="rc-item"><span>${esc(pn(i.id)[0])}</span>${row(i.q + ' × ' + fmt(u, o.cur), fmt(u * i.q, o.cur))}</div>`; }).join('');
  const payLbl = t('pay')[o.pay][0] + (o.pay === 'crypto' ? ' · ' + fmtCoin(o.coinAmt, o.coin) : '');
  return `<div class="rc-head"><b>dofamart</b><span>${esc(rc.head)}</span><span>${esc(rc.cashier)}</span><span>${esc(dateFmt(new Date(o.ts)))}</span><span>№ ${esc(o.id)}</span></div>${lines}`
    + (o.disc ? row(t('discount') + ' ' + o.promo, '−' + fmt(o.disc, o.cur)) : '')
    + row(rc.total, fmt(o.total, o.cur), 'big') + row(rc.method, payLbl) + row(rc.charged, fmt(0, o.cur), 'big') + row(rc.saved, fmt(o.total, o.cur))
    + barcode(o.id) + `<div class="rc-thanks">${esc(t('rcThanks'))}</div><div class="rc-fake">${esc(rc.fake)}</div>`;
}
function coDone() {
  const o = co.order;
  return `<div class="done"><div class="printer"><div class="rc-clip"><div class="receipt print">${receiptHTML(o)}</div></div></div>
<div class="done-copy"><div class="okmark">✓</div><h2>${esc(t('paid'))}</h2><p>${esc(t('paidSub', { zero: fmt(0, o.cur), x: fmt(o.total, o.cur) }))}</p><div class="saved">+ ${esc(fmt(o.total, o.cur))}</div>
<p class="mono" style="color:var(--mute)">${esc(t('orderNo', { id: o.id }))}</p>
<div class="cta"><button class="btn btn-main" data-act="track">${IC.box}<span>${esc(t('track'))}</span></button><button class="btn btn-ghost" data-act="go-shop">${esc(t('keepShopping'))}</button></div></div></div>`;
}
RENDER.co = function renderCo() {
  const steps = t('coSteps').map((s, i) => `<li class="${co.step === i + 1 ? 'on' : co.step > i + 1 ? 'done' : ''}"><span>${co.step > i + 1 ? '✓' : i + 1}</span>${esc(s)}</li>`).join('');
  const body = co.step === 1 ? coStep1() : co.step === 2 ? coStep2() : co.phase === 'done' ? coDone() : `<div class="proc"><div class="spin" aria-hidden="true"></div><ul class="plog">${plogHTML()}</ul></div>`;
  $('#coBox').innerHTML = `<button class="x" data-act="close" aria-label="${esc(t('close'))}">${IC.x}</button><ol class="co-steps">${steps}</ol>${body}`;
  const slot = $('#coConsentSlot'), paySlot = $('#coPaySlot');
  if (slot && paySlot) {
    const frag = $('#tplConsent').content.cloneNode(true);
    const label = frag.querySelector('.consent'), box = frag.querySelector('input'), pay = frag.querySelector('[data-act="co-pay"]');
    label.querySelector('[data-i18n]').textContent = t('consent');
    pay.textContent = t('payBtn', { x: paySlot.dataset.amt });
    box.checked = !!co.ok; pay.disabled = !co.ok;
    box.addEventListener('change', () => { co.ok = box.checked; pay.disabled = !co.ok; sfx('tick'); });
    slot.appendChild(label); paySlot.appendChild(pay);
  }
};
const renderCo = () => RENDER.co();
function placeOrder() {
  const items = cartIds().map(id => ({ id, q: S.cart[id] })), sum = cartSum();
  const o = { id: 'DF-' + String(Math.floor(100000 + Math.random() * 900000)), ts: Date.now(), items, cur: S.cur, sub: sum.sub, disc: sum.disc, total: sum.total, usd: sum.usd, promo: S.promo,
    pay: co.pay, coin: co.coin, coinAmt: co.pay === 'crypto' ? sum.usd / COINM[co.coin].r : 0, dest: co.dest, speed: co.speed, seed: Math.floor(Math.random() * 8) };
  S.orders.unshift(o); S.orders = S.orders.slice(0, 30);
  const st = S.stats; st.saved += sum.usd; st.orders++; st.items += items.reduce((a, b) => a + b.q, 0);
  st.max = Math.max(st.max, ...items.map(i => PM[i.id].usd)); st.food += items.filter(i => PM[i.id].c === 'food').reduce((a, b) => a + b.q, 0);
  S.cart = {}; S.promo = null; save();
  return o;
}
async function runPay() {
  if (paying) return; paying = true;
  co.step = 3; co.phase = 'proc'; co.log = [];
  const o = placeOrder(); co.order = o;
  const lines = co.pay === 'crypto' ? [t('procC')[0], 1, 2, 3].map(x => typeof x === 'number' ? t('procC')[1].replace('{n}', x) : x) : t('proc').map(s => s.replace('{zero}', fmt(0, o.cur)));
  renderHeader(); renderHero(); renderGrid(); renderCo();
  for (const l of lines) {
    co.log.push(l); const ul = $('#coBox .plog'); if (ul) ul.innerHTML = plogHTML();
    sfx('tick'); await sleep(RM.matches ? 150 : 700);
  }
  co.phase = 'done'; paying = false;
  if (DLG.co.open) renderCo(); else toast('🧾', t('paid'));
  sfx('cash'); vibrate([30, 40, 30]); confetti(); dopaAdd(30);
  const ids = ['first_order'], st = S.stats;
  if (st.items >= 10) ids.push('ten'); if (st.saved >= 1e6) ids.push('million');
  if (o.items.some(i => i.id === 'yacht')) ids.push('yacht'); if (o.items.some(i => i.id === 'moon')) ids.push('moon');
  if (o.items.some(i => ['superbike', 'cruiser'].includes(i.id))) ids.push('rider');
  if (o.pay === 'crypto') ids.push('crypto'); if (st.food >= 5) ids.push('food'); if (new Date(o.ts).getHours() < 5) ids.push('night');
  setTimeout(() => queueUnlock(ids), 900);
}

/* ---------- orders ---------- */
function track(o) {
  const e = (Date.now() - o.ts) / 1000, th = [0, 12, 35, 70, 110], pr = [6, 24, 46, 66, 72];
  let i = 0; while (i < 4 && e >= th[i + 1]) i++;
  let txt, prog, emo;
  if (i < 4) { txt = t('st')[i]; emo = ST_EMO[i]; prog = pr[i] + (pr[i + 1] - pr[i]) * ((e - th[i]) / (th[i + 1] - th[i])); }
  else { const L = t('stx'), k = (Math.floor((e - 110) / 40) + o.seed) % L.length; txt = L[k]; emo = STX_EMO[k]; prog = 72 + 26 * (1 - Math.exp(-(e - 110) / 1200)); }
  return { txt, prog, emo, eta: 12 - Math.floor(e / 20) % 12 };
}
RENDER.orders = function () {
  const head = `<div class="d-head"><h2>${esc(t('ordersTitle'))} <span class="count">${S.orders.length || ''}</span></h2><button class="x" data-act="close" aria-label="${esc(t('close'))}">${IC.x}</button></div>`;
  if (!S.orders.length) { $('#ordBox').innerHTML = head + `<div class="d-empty"><span class="emo">📦</span><p>${esc(t('ordersEmpty'))}</p><button class="btn btn-main" data-act="go-shop">${esc(t('goShop'))}</button></div>`; return; }
  $('#ordBox').innerHTML = head + `<div class="d-body">${S.orders.map(o => `<article class="ord" data-oid="${esc(o.id)}">
<div class="ord-top"><b>${esc(t('orderNo', { id: o.id }))}</b><span>${esc(dateFmt(new Date(o.ts)))}</span></div>
<div class="ord-items">${o.items.slice(0, 7).map(i => PM[i.id] ? `<span class="th" title="${esc(pn(i.id)[0])}"><img src="${imgUrl(PM[i.id].img, 80)}" alt="" onerror="this.outerHTML='<span class=&quot;emo&quot;>${PM[i.id].e}</span>'"></span>` : '').join('')}${o.items.length > 7 ? `<span class="count">+${o.items.length - 7}</span>` : ''}<b class="ord-sum">${esc(fmt(o.total, o.cur))}</b></div>
<div class="route"><span class="emo a">🏪</span><span class="prog"></span><span class="emo cour">${SPEED[o.speed] || '🛵'}</span><span class="emo b">${DEST[o.dest] || '🏠'}</span></div>
<div class="ord-st"><span class="emo st-e"></span><span class="st-t"></span></div>
<div class="ord-bot"><span class="ord-eta"></span><button class="btn btn-ghost sm" data-act="call">${IC.phone}<span>${esc(t('callCourier'))}</span></button></div></article>`).join('')}</div>`;
  updateOrders();
};
function updateOrders() {
  $$('#ordBox .ord').forEach(el => {
    const o = S.orders.find(x => x.id === el.dataset.oid); if (!o) return; const tr = track(o);
    el.querySelector('.prog').style.width = tr.prog + '%'; el.querySelector('.cour').style.left = tr.prog + '%';
    el.querySelector('.st-t').textContent = tr.txt; el.querySelector('.st-e').textContent = tr.emo; el.querySelector('.ord-eta').textContent = t('eta', { n: tr.eta });
  });
}

/* ---------- achievements ---------- */
let resetAsk = false;
RENDER.ach = function renderAch() {
  const st = S.stats, a = t('ach'), s = t('stats');
  $('#achBox').innerHTML = `<button class="x" data-act="close" aria-label="${esc(t('close'))}">${IC.x}</button><h2 class="m-title">${esc(t('achTitle'))} <span class="count">${S.ach.length}/${ACH.length}</span></h2>
<div class="stats"><div class="stat"><small>${esc(s[0])}</small><b>${esc(fmt(conv(st.saved)))}</b></div><div class="stat"><small>${esc(s[1])}</small><b>${st.orders}</b></div><div class="stat"><small>${esc(s[2])}</small><b>${st.items}</b></div><div class="stat"><small>${esc(s[3])}</small><b>${st.max ? esc(fmt(priceIn(st.max))) : '—'}</b></div></div>
<h3>${esc(t('achievements'))}</h3><div class="achs">${ACH.map(([id, e]) => { const got = S.ach.includes(id); return `<div class="ach ${got ? 'got' : 'lock'}"><span class="emo">${e}</span><span><b>${esc(a[id][0])}</b><small>${esc(a[id][1])}</small></span></div>`; }).join('')}</div>
<div class="reset">${resetAsk ? `<p>${esc(t('resetQ'))}</p><div class="cta"><button class="btn btn-danger" data-act="reset-yes">${esc(t('resetYes'))}</button><button class="btn btn-ghost" data-act="reset-no">${esc(t('cancel'))}</button></div>` : `<button class="link" data-act="reset">${esc(t('reset'))}</button>`}</div>`;
};
const renderAch = () => RENDER.ach();
function doReset() {
  const keep = { lang: S.lang, cur: S.cur, cap: S.cap, theme: S.theme, autoTheme: S.autoTheme, sound: S.sound };
  S = Object.assign(JSON.parse(JSON.stringify(DEF)), keep, { langs: [keep.lang], curs: [keep.cur], themes: [keep.theme] });
  resetAsk = false; save(); renderAll(); toast('🧹', t('resetDone'));
}

/* ---------- preferences ---------- */
let curQ = '';
RENDER.prefs = function renderPrefs() {
  const keep = $('#curList') ? $('#curList').scrollTop : 0;
  $('#prefsBox').innerHTML = `<button class="x" data-act="close" aria-label="${esc(t('close'))}">${IC.x}</button><h2 class="m-title">${esc(t('prefs'))}</h2>
<h3>${esc(t('lang'))}</h3><div class="langs">${LANGS.map(([c, n]) => `<button class="lng" data-act="lang" data-v="${c}" aria-pressed="${S.lang === c}" lang="${c}"><small>${c.toUpperCase()}</small>${esc(n)}</button>`).join('')}</div>
<h3>${esc(t('currency'))}</h3><label class="search">${IC.search}<input id="curQ" type="search" value="${esc(curQ)}" placeholder="${esc(t('curSearch'))}" autocomplete="off" aria-label="${esc(t('curSearch'))}"></label>
<div class="curs" id="curList"></div><p class="note">${esc(t('ratesNote'))}</p>
<h3>${esc(t('capLabel'))}</h3><div class="capc">${[['', t('capOff')]].concat(CAP_COINS.map(c => [c, c])).map(([v, l]) => `<button data-act="cap" data-v="${v}" aria-pressed="${(S.cap || '') === v}">${esc(l)}</button>`).join('')}</div>
<h3>${esc(t('theme'))}</h3><div class="themes">${TKEYS.map(k => { const th = THEMES[k]; return `<button class="th-b" data-act="theme" data-v="${k}" aria-pressed="${S.theme === k}"><i style="background:linear-gradient(100deg,${th.a1},${th.a2} 60%,${th.a3})"></i>${esc(th.name)}</button>`; }).join('')}</div>
<div class="prow"><button class="switch" data-act="auto-theme" aria-pressed="${S.autoTheme}"><span class="k"></span>${esc(t('autoTheme'))}</button>
<button class="switch" data-act="sound" aria-pressed="${S.sound}"><span class="k"></span>${esc(t('sound'))}</button></div>`;
  renderCurList(); $('#curList').scrollTop = keep;
};
const renderPrefs = () => RENDER.prefs();
function renderCurList() {
  const q = curQ.trim().toLowerCase();
  const m = c => !q || c.toLowerCase().includes(q) || curName(c).toLowerCase().includes(q) || curSym(c).toLowerCase().includes(q);
  const grp = (title, list) => { const f = list.filter(m); return f.length ? `<div class="cur-g">${esc(title)}</div>` + f.map(c => `<button class="cur" data-act="cur" data-v="${c}" aria-pressed="${S.cur === c}"><b>${c}</b><span>${esc(curName(c))}</span><em>${esc(curSym(c))}</em></button>`).join('') : ''; };
  const html = grp(t('curCis'), CIS) + grp(t('curCrypto'), COINS.map(c => c.c)) + grp(t('curWorld'), WORLD);
  $('#curList').innerHTML = html || '<p class="note" style="padding:14px">—</p>';
}
function setLang(c) {
  if (!LOCS[c]) return; S.lang = c; if (!S.langs.includes(c)) S.langs.push(c); save(); renderAll(); sfx('pop');
  if (S.langs.length >= 3) queueUnlock(['polyglot']);
}
function setCur(c) {
  if (!FIAT[c] && !COINM[c]) return; S.cur = c; if (!S.curs.includes(c)) S.curs.push(c); save(); renderAll(); sfx('cash');
  if (S.curs.length >= 5) queueUnlock(['tourist']);
}

/* ---------- render all ---------- */
function renderAll() {
  renderStatic(); renderHeader(); renderHero(); renderTiles(); renderDeals(); renderChips(); renderSort(); renderGrid(); renderSteps();
  for (const [k, d] of Object.entries(DLG)) if (d.open) RENDER[k]();
}
function scrollToId(id) { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: RM.matches ? 'auto' : 'smooth', block: 'start' }); }

/* ---------- events ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const act = el.dataset.act, host = el.closest('[data-id]'), id = el.dataset.id || (host && host.dataset.id);
  switch (act) {
    case 'open': openPd(id); break;
    case 'add': addToCart(id, 1, el.closest('.card') && el.closest('.card').querySelector('.ph')); break;
    case 'inc': setQty(id, (S.cart[id] || 0) + 1); break;
    case 'dec': setQty(id, (S.cart[id] || 0) - 1); break;
    case 'rm': setQty(id, 0); break;
    case 'fav': toggleFav(id); break;
    case 'cat': S.cat = el.dataset.v; $('#q').value = ''; save(); renderChips(); renderTiles(); renderGrid(); break;
    case 'tile': S.cat = el.dataset.v; $('#q').value = ''; save(); renderChips(); renderTiles(); renderGrid(); sfx('whoosh'); scrollToId('catalog'); break;
    case 'clear-q': $('#q').value = ''; S.cat = 'all'; renderChips(); renderTiles(); renderGrid(); break;
    case 'lang': setLang(el.dataset.v); break;
    case 'cur': setCur(el.dataset.v); break;
    case 'cap': S.cap = el.dataset.v || null; save(); renderAll(); break;
    case 'theme': setTheme(el.dataset.v, true); sfx('whoosh'); break;
    case 'theme-next': { const i = TKEYS.indexOf(S.theme); setTheme(TKEYS[(i + 1) % TKEYS.length], true); sfx('whoosh'); break; }
    case 'auto-theme': S.autoTheme = !S.autoTheme; save(); renderPrefs(); break;
    case 'sound': S.sound = !S.sound; save(); renderHeader(); if (DLG.prefs.open) renderPrefs(); sfx('pop'); break;
    case 'dlg': openDlg(el.dataset.v); break;
    case 'close': { const d = el.closest('dialog'); if (d) d.close(); break; }
    case 'checkout': startCheckout(); break;
    case 'go-shop': Object.values(DLG).forEach(d => d.open && d.close()); scrollToId('catalog'); break;
    case 'scroll': scrollToId(el.dataset.v); break;
    case 'top': window.scrollTo({ top: 0, behavior: RM.matches ? 'auto' : 'smooth' }); break;
    case 'co-set': co[el.dataset.k] = el.dataset.v; sfx('tick'); renderCo(); break;
    case 'co-next': co.step = 2; sfx('pop'); renderCo(); break;
    case 'co-back': co.step = 1; renderCo(); break;
    case 'co-pay': if (co.ok) runPay(); break;
    case 'track': closeDlg('co'); openDlg('orders'); break;
    case 'call': sfx('ring'); toast('📵', t('callResp')); break;
    case 'pd-q': pdQty = Math.max(1, Math.min(99, pdQty + Number(el.dataset.v))); RENDER.pd(); break;
    case 'pd-add': addToCart(pdId, pdQty); closeDlg('pd'); break;
    case 'pd-buy': addToCart(pdId, pdQty); startCheckout(); break;
    case 'promo-clear': S.promo = null; save(); renderCart(); renderHeader(); break;
    case 'reset': resetAsk = true; renderAch(); break;
    case 'reset-no': resetAsk = false; renderAch(); break;
    case 'reset-yes': doReset(); break;
  }
});
document.addEventListener('submit', e => { if (e.target.id === 'promoForm') { e.preventDefault(); applyPromo($('#promoIn').value); } });
document.addEventListener('input', e => { if (e.target.id === 'curQ') { curQ = e.target.value; renderCurList(); } });
document.addEventListener('keydown', e => {
  if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName) && !anyOpen()) { e.preventDefault(); $('#q').focus(); }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.ph[role="button"]')) { e.preventDefault(); const c = e.target.closest('[data-id]'); if (c) openPd(c.dataset.id); }
});
let qT = 0;
$('#q').addEventListener('input', () => { clearTimeout(qT); qT = setTimeout(() => { if ($('#q').value.trim()) { S.cat = 'all'; renderChips(); renderTiles(); } renderGrid(); }, 140); });
$('#q').addEventListener('keydown', e => { if (e.key === 'Enter') scrollToId('catalog'); });
$('#sort').addEventListener('change', e => { S.sort = e.target.value; save(); renderGrid(); });
DLG.ach.addEventListener('close', () => { resetAsk = false; });

/* ---------- timers ---------- */
let lastCycle = Math.floor(Date.now() / 600000);
setInterval(() => {
  const s = Math.floor(Date.now() / 1000), rem = 599 - (s % 600);
  $('#timer').textContent = String(Math.floor(rem / 60)).padStart(2, '0') + ':' + String(rem % 60).padStart(2, '0');
  const cyc = Math.floor(Date.now() / 600000); if (cyc !== lastCycle) { lastCycle = cyc; renderDeals(); }
  if (DLG.orders.open) updateOrders();
  if (s % 2 === 0) renderDopa();
}, 1000);
(function social() {
  setTimeout(() => {
    if (!document.hidden && !anyOpen()) {
      const p = P[Math.floor(Math.random() * P.length)], cities = t('cities');
      toast(p.e, t('social', { city: cities[Math.floor(Math.random() * cities.length)], item: pn(p.id)[0] }), { act: p.id, img: p.img });
    }
    social();
  }, 26000 + Math.random() * 24000);
})();

renderAll();
})();
