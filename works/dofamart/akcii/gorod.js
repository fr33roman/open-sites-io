/* dofamart · Акции — «Город» (здания дают доход в час) и карточка «Мой результат».
   Игровые деньги. Часть 1 — чистый расчёт без страницы (его же гоняет node: tools/gorod-test.mjs).
   Часть 2 — экран и карточка; работает через небольшой «мост» host, который отдаёт sim.js. Ничего никуда не отправляется. */
(function (root) {
'use strict';

/* ============ 1. ДАННЫЕ И РАСЧЁТ ============ */
// 19.11 «большая карта»: поле MW×MD клеток, здания ставит игрок; у каждого типа площадь w×d, правило места и предел числа.
const HOUR = 3600e3, CAP_H = 8, CAP_BANK_H = 12, HALL_BONUS = 1.05, MAXL = 5, LES_FROM = 4, NB_CAP = 0.5, NB_STEP = 0.2;
const UPK = [1, 0.8, 1.4, 2.2, 3.2];   // цена ступени k = цена здания × UPK[k-1]
const MW = 36, MD = 30, HILL_H = 0.4;
// lvl — уровень игрока (1…10), с которого здание открыто; inc — доход в час по ступеням 1…5; les — урок (0…10) для ступеней 4 и 5;
// w×d — площадь в клетках; rule — место: road (касается дороги), water (у воды), hill (на холме), plaza (на площади), free (где угодно, без дороги);
// lim — предел числа штук (растёт с уровнем игрока: 1 + уровень − lvl); nb — прибавка соседям: p (доля на ступени 1, +20 % за ступень) в радиусе r клеток (r=0 — всему району);
// perk: hall — +5 % ко всему доходу, bank — копилка 12 ч. Первые 10 строк — прежние здания в прежнем порядке (по ним уровни в sim.js).
const B = [
  { id: 'kiosk', cat: 'inc', lvl: 1, price: 500, inc: [5, 8, 14, 24, 40], les: 0, w: 1, d: 1, rule: 'road', lim: 4, ru: 'Киоск данных', en: 'Data Kiosk' },
  { id: 'exch', cat: 'inc', lvl: 2, price: 2000, inc: [18, 30, 50, 84, 140], les: 1, w: 2, d: 2, rule: 'road', lim: 3, ru: 'Обменный пункт', en: 'Exchange Office' },
  { id: 'dc', cat: 'inc', lvl: 3, price: 6000, inc: [50, 83, 140, 230, 380], les: 2, w: 2, d: 2, rule: 'road', lim: 2, ru: 'Дата-центр', en: 'Data Center' },
  { id: 'hall', cat: 'inc', lvl: 4, price: 15000, inc: [110, 180, 310, 510, 850], les: 3, w: 3, d: 3, rule: 'plaza', lim: 1, perk: 'hall', ru: 'Биржевой зал', en: 'Trading Floor' },
  { id: 'bank', cat: 'inc', lvl: 5, price: 40000, inc: [280, 460, 770, 1300, 2100], les: 8, w: 3, d: 2, rule: 'road', lim: 1, perk: 'bank', ru: 'Банк', en: 'Bank' },
  { id: 'lab', cat: 'inc', lvl: 6, price: 90000, inc: [600, 990, 1600, 2700, 4500], les: 6, w: 2, d: 2, rule: 'road', lim: 1, ru: 'Аналитический центр', en: 'Analytics Center' },
  { id: 'fund', cat: 'inc', lvl: 7, price: 200000, inc: [1300, 2200, 3600, 5900, 9800], les: 5, w: 3, d: 2, rule: 'road', lim: 1, ru: 'Фонд', en: 'Fund' },
  { id: 'tower', cat: 'inc', lvl: 8, price: 500000, inc: [3200, 5300, 8800, 15000, 24000], les: 4, w: 2, d: 2, rule: 'road', lim: 1, ru: 'Башня «Магнат»', en: '“Magnate” Tower' },
  { id: 'inst', cat: 'inc', lvl: 9, price: 1500000, inc: [9000, 15000, 25000, 41000, 68000], les: 9, w: 3, d: 3, rule: 'road', lim: 1, ru: 'Институт «Мудрец»', en: '“Sage” Institute' },
  { id: 'obs', cat: 'inc', lvl: 10, price: 5000000, inc: [28000, 46000, 77000, 130000, 210000], les: 10, w: 3, d: 3, rule: 'hill', lim: 1, ru: 'Обсерватория «Оракул»', en: '“Oracle” Observatory' },
  // 19.11: ещё 12 типов — доходные (между прежними по цене)
  { id: 'vend', cat: 'inc', lvl: 2, price: 1200, inc: [10, 16, 27, 45, 75], les: 1, w: 2, d: 1, rule: 'road', lim: 3, ru: 'Робо-автомат', en: 'Robo Vendor' },
  { id: 'atm', cat: 'inc', lvl: 3, price: 3800, inc: [31, 52, 87, 145, 240], les: 2, w: 2, d: 2, rule: 'road', lim: 3, ru: 'Сеть банкоматов', en: 'ATM Network' },
  { id: 'pay', cat: 'inc', lvl: 4, price: 9000, inc: [75, 125, 210, 350, 580], les: 3, w: 2, d: 2, rule: 'road', lim: 2, ru: 'Платёжный шлюз', en: 'Payment Gate' },
  { id: 'broker', cat: 'inc', lvl: 6, price: 62000, inc: [430, 710, 1190, 1980, 3300], les: 7, w: 3, d: 2, rule: 'road', lim: 2, ru: 'Брокерский дом', en: 'Brokerage House' },
  { id: 'vc', cat: 'inc', lvl: 8, price: 330000, inc: [2300, 3800, 6300, 10400, 17000], les: 7, w: 2, d: 2, rule: 'road', lim: 1, ru: 'Венчурный хаб', en: 'Venture Hub' },
  // жильё и сервис: сами почти не платят, но дают прибавку соседям
  { id: 'home', cat: 'home', lvl: 2, price: 1500, inc: [2, 3, 5, 8, 12], les: 1, w: 2, d: 2, rule: 'road', lim: 6, nb: { r: 3, p: 0.06 }, ru: 'Жилой модуль', en: 'Living Module' },
  { id: 'cowork', cat: 'home', lvl: 3, price: 4500, inc: [6, 10, 17, 28, 47], les: 2, w: 2, d: 2, rule: 'road', lim: 4, nb: { r: 3, p: 0.08 }, ru: 'Коворкинг «Улей»', en: '“Hive” Coworking' },
  { id: 'mall', cat: 'home', lvl: 5, price: 30000, inc: [30, 50, 83, 140, 230], les: 8, w: 3, d: 2, rule: 'road', lim: 2, nb: { r: 4, p: 0.10 }, ru: 'Торговый пассаж', en: 'Shopping Arcade' },
  // парки и украшения: дешёвые, 1×1 или 2×2, дорога не нужна
  { id: 'park', cat: 'park', lvl: 1, price: 300, inc: [0, 0, 0, 0, 0], les: 0, w: 1, d: 1, rule: 'free', lim: 12, nb: { r: 2, p: 0.04 }, ru: 'Сквер', en: 'Pocket Park' },
  { id: 'fountain', cat: 'park', lvl: 3, price: 4000, inc: [0, 0, 0, 0, 0], les: 3, w: 2, d: 2, rule: 'free', lim: 4, nb: { r: 3, p: 0.07 }, ru: 'Неоновый фонтан', en: 'Neon Fountain' },
  // особые
  { id: 'port', cat: 'spec', lvl: 5, price: 60000, inc: [420, 700, 1170, 1950, 3250], les: 6, w: 3, d: 2, rule: 'water', lim: 2, ru: 'Порт «Лазурный»', en: '“Azure” Port' },
  { id: 'maglev', cat: 'spec', lvl: 7, price: 250000, inc: [0, 0, 0, 0, 0], les: 5, w: 3, d: 2, rule: 'road', lim: 2, nb: { r: 0, p: 0.10 }, ru: 'Маглев-станция', en: 'Maglev Station' }
];
const BY = {}; B.forEach(b => { BY[b.id] = b; });
const CATS = ['inc', 'home', 'park', 'spec'];
// районы: клетки внутри прямоугольника (дороги открыты всегда); 0 — стартовый
const DIST = [
  { id: 0, x0: 0, z0: 8, x1: 22, z1: 14, lvl: 1, price: 0, ru: 'Центр', en: 'Downtown' },
  { id: 1, x0: 0, z0: 0, x1: 22, z1: 6, lvl: 3, price: 8000, ru: 'Северный квартал', en: 'North Quarter' },
  { id: 2, x0: 0, z0: 16, x1: 22, z1: 23, lvl: 4, price: 25000, ru: 'Южный квартал', en: 'South Quarter' },
  { id: 3, x0: 0, z0: 25, x1: 35, z1: 26, lvl: 5, price: 60000, ru: 'Набережная', en: 'Waterfront' },
  { id: 4, x0: 24, z0: 0, x1: 35, z1: 14, lvl: 6, price: 150000, ru: 'Холм', en: 'The Hill' },
  { id: 5, x0: 24, z0: 16, x1: 35, z1: 23, lvl: 8, price: 600000, ru: 'Восточный сектор', en: 'East Sector' }
];
// карта: 0 земля · 1 дорога · 2 вода · 3 холм · 4 площадь
const T = new Uint8Array(MW * MD), DM = new Int8Array(MW * MD).fill(-1);
(function () {
  const RX = [11, 23], RZ = [7, 15, 24];
  for (let z = 0; z < MD; z++) for (let x = 0; x < MW; x++) {
    const i = z * MW + x;
    const t = z >= 27 ? 2 : ((RX.indexOf(x) >= 0 && z <= 24) || RZ.indexOf(z) >= 0) ? 1 : (x >= 28 && x <= 33 && z >= 1 && z <= 5) ? 3 : (x >= 12 && x <= 18 && z >= 8 && z <= 14) ? 4 : 0;
    T[i] = t;
    if (t !== 1 && t !== 2) DM[i] = DIST.findIndex(d => x >= d.x0 && x <= d.x1 && z >= d.z0 && z <= d.z1);
  }
})();
const MAP = { W: MW, D: MD, T: T, DM: DM, DIST: DIST, HILL_H: HILL_H, START: { x: 11, z: 11 } };
const r2 = v => Math.round(v * 100) / 100;
const fp = (b, r) => (r ? { w: b.d, d: b.w } : { w: b.w, d: b.d });
const rectOf = it => { const f = fp(BY[it.id], it.r); return { x: it.x, y: it.y, w: f.w, d: f.d }; };
const distOf = it => DM[it.y * MW + it.x];

// --- проверка места ---
function occOf(c, ign) {
  const o = new Int32Array(MW * MD);
  c.p.forEach(it => { if (it.s || it.u === ign) return; const q = rectOf(it); for (let j = 0; j < q.d; j++) for (let i = 0; i < q.w; i++) o[(q.y + j) * MW + q.x + i] = it.u; });
  return o;
}
// '' — можно; иначе причина: bounds, blocked, closed, taken, reserved, road, water, hill, plaza
function check(c, b, x, y, r, o) {
  const f = fp(b, r);
  if (x < 0 || y < 0 || x + f.w > MW || y + f.d > MD) return 'bounds';
  let allHill = true, allPlaza = true;
  for (let j = 0; j < f.d; j++) for (let i = 0; i < f.w; i++) {
    const k = (y + j) * MW + x + i, t = T[k];
    if (t === 1 || t === 2) return 'blocked';
    if (c.d.indexOf(DM[k]) < 0) return 'closed';
    if (o[k]) return 'taken';
    if (t !== 3) allHill = false; if (t !== 4) allPlaza = false;
    if ((t === 3 || t === 4) && b.rule !== 'free' && b.rule !== 'hill' && b.rule !== 'plaza') return 'reserved';
  }
  if (b.rule === 'hill') return allHill ? '' : 'hill';
  if (b.rule === 'plaza') return allPlaza ? '' : 'plaza';
  if (b.rule === 'free') return '';
  const want = b.rule === 'water' ? 2 : 1; let near = false;
  for (let j = -1; j <= f.d && !near; j++) for (let i = -1; i <= f.w; i++) {
    if ((j === -1 || j === f.d) === (i === -1 || i === f.w)) continue;       // только клетки сбоку, без углов
    const xx = x + i, yy = y + j; if (xx < 0 || yy < 0 || xx >= MW || yy >= MD) continue;
    if (T[yy * MW + xx] === want) { near = true; break; }
  }
  return near ? '' : b.rule;
}
function availMask(c, b, r, ign) {           // клетки, которые входят хотя бы в одну допустимую расстановку
  const o = occOf(c, ign), m = new Uint8Array(MW * MD), f = fp(b, r);
  for (let y = 0; y + f.d <= MD; y++) for (let x = 0; x + f.w <= MW; x++) if (!check(c, b, x, y, r, o)) for (let j = 0; j < f.d; j++) for (let i = 0; i < f.w; i++) m[(y + j) * MW + x + i] = 1;
  return m;
}
function findSpot(c, b, near, ign) {          // ближайшее допустимое место к точке near {x,z}; поворот 0 или 1
  const o = occOf(c, ign); let best = null, bd = 1e18; near = near || MAP.START;
  for (let r = 0; r < (b.w === b.d ? 1 : 2); r++) { const f = fp(b, r);
    for (let y = 0; y + f.d <= MD; y++) for (let x = 0; x + f.w <= MW; x++) {
      const dd = Math.pow(x + f.w / 2 - near.x, 2) + Math.pow(y + f.d / 2 - near.z, 2) + r * 0.01;
      if (dd < bd && !check(c, b, x, y, r, o)) { bd = dd; best = { x: x, y: y, r: r }; } } }
  return best;
}
const count = (c, id) => c.p.reduce((n, it) => n + (it.id === id ? 1 : 0), 0);
const limOf = (b, lvl) => (lvl < b.lvl ? 0 : Math.min(b.lim, 1 + lvl - b.lvl));
const itOf = (c, u) => { for (let i = 0; i < c.p.length; i++) if (c.p[i].u === u) return c.p[i]; return null; };
const cellsTotal = c => { let n = 0; for (let i = 0; i < MW * MD; i++) if ((T[i] === 0 || T[i] === 3 || T[i] === 4) && c.d.indexOf(DM[i]) >= 0) n++; return n; };
const cellsUsed = c => c.p.reduce((n, it) => { if (it.s) return n; const f = fp(BY[it.id], it.r); return n + f.w * f.d; }, 0);

function migrate(c) {                                  // старое сохранение (по одному зданию каждого вида в c.b) → список c.p с авторасстановкой
  const old = c.b && typeof c.b === 'object' ? c.b : {};
  c.p = []; c.n = 1; c.d = [0];
  B.forEach(b => { const x = old[b.id]; if (!x || !(x.l >= 1)) return;
    const it = { u: c.n++, id: b.id, l: Math.min(MAXL, Math.floor(x.l)), t: +x.t || 0, x: -1, y: -1, r: 0, s: 1 }; c.p.push(it);
    let sp = findSpot(c, b);
    if (!sp) for (let k = 0; k < DIST.length && !sp; k++) { if (c.d.indexOf(k) >= 0) continue; c.d.push(k); sp = findSpot(c, b); if (!sp) c.d.pop(); }   // здание старого города не потеряется: нужный район открывается бесплатно
    if (sp) { it.x = sp.x; it.y = sp.y; it.r = sp.r; it.s = 0; }
  });
  delete c.b; c.v = 2;
}
function norm(S) {                                   // привести состояние к форме города; старый город переносится автоматически
  const c = S.city && typeof S.city === 'object' ? S.city : (S.city = {});
  c['in'] = +c['in'] || 0; c.out = +c.out || 0; c.streak = +c.streak || 0; c.last = c.last == null ? -1 : +c.last;
  if (c.v !== 2 || !Array.isArray(c.p)) migrate(c);
  if (!Array.isArray(c.d) || c.d.indexOf(0) < 0) c.d = [0].concat(Array.isArray(c.d) ? c.d.filter(k => k > 0 && k < DIST.length) : []);
  const seen = {}; c.n = Math.max(+c.n || 1, 1);
  c.p = c.p.filter(it => it && BY[it.id] && it.l >= 1).map(it => {
    it.l = Math.min(MAXL, Math.floor(it.l)); it.t = +it.t || 0; it.r = it.r ? 1 : 0;
    if (!(it.u >= 1) || seen[it.u]) it.u = c.n++; seen[it.u] = 1; if (it.u >= c.n) c.n = it.u + 1;
    if (!it.s) { const q = fp(BY[it.id], it.r); it.x = Math.floor(+it.x); it.y = Math.floor(+it.y); if (!(it.x >= 0 && it.y >= 0 && it.x + q.w <= MW && it.y + q.d <= MD)) it.s = 1; }
    if (it.s) { it.s = 1; it.x = it.y = -1; }
    return it;
  });
  return c;
}
const owned = c => c.p.length;
const placed = c => c.p.filter(it => !it.s);
const hasPerk = (c, k) => c.p.some(it => !it.s && BY[it.id].perk === k);
const capH = c => (hasPerk(c, 'bank') ? CAP_BANK_H : CAP_H);
const bonus = c => (hasPerk(c, 'hall') ? HALL_BONUS : 1);
function nbOf(c, it) {                               // прибавка соседства 0…0.5 для здания it
  if (it.s) return 0; const me = rectOf(it), dm = distOf(it); let s = 0;
  c.p.forEach(o => { if (o === it || o.s) return; const b = BY[o.id]; if (!b.nb) return; const p = b.nb.p * (1 + NB_STEP * (o.l - 1));
    if (b.nb.r > 0) { const q = rectOf(o), gx = Math.max(me.x - (q.x + q.w), q.x - (me.x + me.w), 0), gy = Math.max(me.y - (q.y + q.d), q.y - (me.y + me.d), 0); if (Math.max(gx, gy) <= b.nb.r) s += p; }
    else if (distOf(o) === dm) s += p; });
  return Math.min(NB_CAP, s);
}
const rate = (c, u) => { const it = typeof u === 'object' ? u : itOf(c, u); return it && !it.s ? r2(BY[it.id].inc[it.l - 1] * bonus(c) * (1 + nbOf(c, it))) : 0; };      // $ в час
const rateAll = c => r2(c.p.reduce((s, it) => s + rate(c, it), 0));
const hoursOf = (c, u, now) => { const it = typeof u === 'object' ? u : itOf(c, u); return it && !it.s ? Math.min(capH(c), Math.max(0, now - it.t) / HOUR) : 0; };
const pend = (c, u, now) => { const it = typeof u === 'object' ? u : itOf(c, u); return it ? r2(hoursOf(c, it, now) * rate(c, it)) : 0; };                 // накоплено в копилке здания
const pendAll = (c, now) => r2(c.p.reduce((s, it) => s + pend(c, it, now), 0));
const poolMax = c => r2(rateAll(c) * capH(c));                                                // сколько вместит копилка всего
const stepCost = (id, step) => Math.round(BY[id].price * UPK[step - 1]);
const maxStep = c => c.p.reduce((m, it) => Math.max(m, it.l), 0);
const dayOf = now => Math.floor((now - new Date(now).getTimezoneOffset() * 6e4) / 864e5);     // номер дня по местному времени
const streakNow = (c, now) => (c.last >= dayOf(now) - 1 ? c.streak : 0);

// lvl — уровень игрока 1…10; les(i) — пройден ли урок i. Деньги — тот же S.cash. Доход города в результат торговли не входит (S.city.in / S.city.out).
function precheck(S, c, id, lvl) {
  const b = BY[id]; if (!b) return 'unknown';
  if (lvl < b.lvl) return 'level';
  if (count(c, id) >= limOf(b, lvl)) return 'limit';
  if (S.cash + 1e-9 < b.price) return 'funds';
  return '';
}
function pay(S, c, b, now, spot) {
  S.cash = r2(S.cash - b.price); c.out = r2(c.out + b.price);
  const it = { u: c.n++, id: b.id, l: 1, t: now, x: spot ? spot.x : -1, y: spot ? spot.y : -1, r: spot ? spot.r : 0, s: spot ? 0 : 1 }; c.p.push(it); return it;
}
function place(S, id, lvl, now, x, y, rot) {         // купить новое здание и поставить на клетки (x, y — левый верхний угол)
  const c = norm(S), b = BY[id], e = precheck(S, c, id, lvl);
  if (e) return { ok: false, err: e };
  const g = check(c, b, x, y, rot ? 1 : 0, occOf(c, 0)); if (g) return { ok: false, err: g };
  const it = pay(S, c, b, now, { x: x, y: y, r: rot ? 1 : 0 }); return { ok: true, cost: b.price, u: it.u };
}
function buy(S, id, lvl, now) {                      // купить без выбора места — на первое подходящее (вид «Список»)
  const c = norm(S), b = BY[id], e = precheck(S, c, id, lvl);
  if (e) return { ok: false, err: e === 'limit' ? 'owned' : e };
  const sp = findSpot(c, b); if (!sp) return { ok: false, err: 'space' };
  const it = pay(S, c, b, now, sp); return { ok: true, cost: b.price, u: it.u };
}
function move(S, u, x, y, rot, now) {                // перенос бесплатный; здание со склада ставится тем же вызовом
  const c = norm(S), it = itOf(c, u); if (!it) return { ok: false, err: 'none' };
  const b = BY[it.id], r = rot ? 1 : 0, g = check(c, b, x, y, r, occOf(c, u)); if (g) return { ok: false, err: g };
  if (it.s) it.t = now;                              // на складе доход не копится
  it.x = x; it.y = y; it.r = r; it.s = 0; return { ok: true };
}
function settle(S, u, now) {                         // забрать копилку одного здания в деньги (без учёта серии дней)
  const c = norm(S), it = typeof u === 'object' ? u : itOf(c, u); if (!it) return 0;
  const g = pend(c, it, now);
  if (g > 0) { S.cash = r2(S.cash + g); c['in'] = r2(c['in'] + g); }
  it.t = now; return g;
}
function store(S, u, now) {                          // убрать на склад: накопленное уходит в кошелёк, ступень сохраняется
  const c = norm(S), it = itOf(c, u); if (!it || it.s) return { ok: false, err: 'none' };
  const got = settle(S, it, now); it.s = 1; it.x = it.y = -1; return { ok: true, got: got };
}
function openDist(S, k, lvl) {
  const c = norm(S), d = DIST[k]; if (!d) return { ok: false, err: 'none' };
  if (c.d.indexOf(k) >= 0) return { ok: false, err: 'open' };
  if (lvl < d.lvl) return { ok: false, err: 'level' };
  if (S.cash + 1e-9 < d.price) return { ok: false, err: 'funds', cost: d.price };
  S.cash = r2(S.cash - d.price); c.out = r2(c.out + d.price); c.d.push(k); return { ok: true, cost: d.price };
}
function upgrade(S, u, lesDone, now) {
  const c = norm(S), it = itOf(c, u); if (!it) return { ok: false, err: 'none' };
  const b = BY[it.id];
  if (it.l >= MAXL) return { ok: false, err: 'max' };
  const step = it.l + 1, cost = stepCost(it.id, step);
  if (step >= LES_FROM && !(lesDone && lesDone(b.les))) return { ok: false, err: 'lesson', les: b.les };
  if (S.cash + 1e-9 < cost) return { ok: false, err: 'funds', cost: cost };
  const got = settle(S, it, now);                     // накопленное по старой ставке — в кошелёк, дальше считается по новой
  S.cash = r2(S.cash - cost); c.out = r2(c.out + cost); it.l = step;
  return { ok: true, cost: cost, step: step, got: got };
}
function collect(S, u, now) {                         // u пусто — «Собрать всё»
  const c = norm(S); let got = 0;
  (u ? [itOf(c, u)] : c.p.slice()).forEach(it => { if (it) got += settle(S, it, now); });
  got = r2(got);
  if (got > 0) {
    const d = dayOf(now);
    if (c.last !== d) { c.streak = c.last === d - 1 ? c.streak + 1 : 1; c.last = d; }
  }
  return { ok: got > 0, got: got, err: got > 0 ? '' : 'empty' };
}

const API = { B, BY, UPK, CATS, MAP, DIST, CAP_H, CAP_BANK_H, HALL_BONUS, MAXL, LES_FROM, NB_CAP, norm, owned, placed, capH, bonus, rate, rateAll, hoursOf, pend, pendAll, poolMax, stepCost, maxStep, dayOf, streakNow,
  fp, rectOf, occOf, check, availMask, findSpot, count, limOf, itOf, nbOf, cellsTotal, cellsUsed, place, buy, move, store, openDist, settle, upgrade, collect };
root.DofaGorod = API;
if (typeof module !== 'undefined' && module.exports) { module.exports = API; }
if (typeof document === 'undefined') return;

/* ============ 2. ЭКРАН «ГОРОД» ============ */
const D = {
  ru: {
    m3d: '3D', mlist: 'Список', ld3: 'Загружаю 3D-город…', hint3: 'Тяните — поворот · колесо или щипок — масштаб · нажмите на участок', lbl3: 'Город в 3D',
    nav: 'Город', h: 'Город', sub: 'Здания приносят деньги, даже когда вас нет',
    pool: 'Накоплено', rate: 'Доход в час', cap: 'Копилка до {h} ч', coll_all: 'Собрать всё', nothing: 'Пока нечего собирать',
    own_step: 'Ступень {n} из 5', per_h: '{x}/ч', lock_lv: 'Уровень {n} · {x}', buy_for: 'Купить · {x}', free: 'Свободный участок', soon: 'Скоро',
    buy: 'Купить', up: 'Улучшить до ступени {n}', collect: 'Собрать', maxed: 'Высшая ступень', close: 'Закрыть',
    m_rate: 'Доход в час', m_next: 'На следующей ступени', m_pend: 'В копилке', m_cost: 'Цена', m_need_lv: 'Откроется на уровне {n} «{name}»',
    m_need_les: 'Для ступеней 4 и 5 пройдите урок «{name}»', m_les_go: 'К урокам',
    perk_hall: 'Особенность: +5 % к доходу всех зданий', perk_bank: 'Особенность: копилка дохода 12 часов вместо 8',
    e_funds: 'Не хватает денег: нужно {x}', e_level: 'Здание откроется на уровне {n}', e_lesson: 'Сначала пройдите урок «{name}»',
    t_bought: 'Куплено: {n}', t_up: '{n}: ступень {s}', t_got: 'Собрано {x}', t_got_up: 'Собрано {x}',
    w_h: 'Доход города', w_got: 'Собрано всего', w_wait: 'В копилках сейчас', w_note: 'Не входит в результат торговли и не даёт очков уровня', w_go: 'В город', w_empty: 'Город пока пустой',
    b_h: 'Разбивка по вложениям', b_bets: 'Ставки', b_more: 'ещё {n}', b_open: 'в работе', b_tr: '{n} сд.', b_none: 'За срок нет закрытых сделок и ставок', b_wk: 'В работе сейчас: {n} · {x}',
    r_h: 'Мой результат', r_d1: '1 д', r_d3: '3 д', r_d5: '5 д', r_d7: '7 д', r_d14: '14 д', r_d30: '30 д',
    r_share: 'Поделиться', r_save: 'Скачать картинку', r_none: 'Нет данных за срок: кривая результата появится после первых вложений и сделок.',
    r_part: 'Игре меньше {d}: показан весь срок — {s}', r_hold: 'Нажмите на картинку и удерживайте, чтобы сохранить', r_ok: 'Картинка сохранена', r_fail: 'Не вышло сохранить картинку',
    c_slogan: 'Твоя виртуальная экономическая вселенная', c_for: 'РЕЗУЛЬТАТ ЗА {d}', c_pct: 'к внесённому', c_play: 'игровые деньги',
    c_trades: 'Сделок', c_win: 'В плюс', c_best: 'Лучшая сделка', c_level: 'Уровень {n}', c_nodata: 'нет данных', c_chart: 'Результат во времени',
    d1: '1 день', d3: '3 дня', d5: '5 дней', d7: '7 дней', d14: '14 дней', d30: '30 дней', h_s: '{n} ч', d_s: '{n} д', m_s: '{n} мин'
  },
  en: {
    m3d: '3D', mlist: 'List', ld3: 'Loading the 3D city…', hint3: 'Drag to rotate · wheel or pinch to zoom · tap a plot', lbl3: 'City in 3D',
    nav: 'City', h: 'City', sub: 'Buildings earn money even when you are away',
    pool: 'Accrued', rate: 'Income per hour', cap: 'Stash up to {h} h', coll_all: 'Collect all', nothing: 'Nothing to collect yet',
    own_step: 'Step {n} of 5', per_h: '{x}/h', lock_lv: 'Level {n} · {x}', buy_for: 'Buy · {x}', free: 'Empty plot', soon: 'Soon',
    buy: 'Buy', up: 'Upgrade to step {n}', collect: 'Collect', maxed: 'Top step', close: 'Close',
    m_rate: 'Income per hour', m_next: 'At the next step', m_pend: 'In the stash', m_cost: 'Price', m_need_lv: 'Opens at level {n} “{name}”',
    m_need_les: 'For steps 4 and 5 finish the lesson “{name}”', m_les_go: 'To lessons',
    perk_hall: 'Perk: +5% to the income of all buildings', perk_bank: 'Perk: income stash holds 12 hours instead of 8',
    e_funds: 'Not enough money: {x} needed', e_level: 'The building opens at level {n}', e_lesson: 'Finish the lesson “{name}” first',
    t_bought: 'Bought: {n}', t_up: '{n}: step {s}', t_got: 'Collected {x}', t_got_up: 'Collected {x}',
    w_h: 'City income', w_got: 'Collected in total', w_wait: 'In stashes now', w_note: 'Not part of the trading result and gives no level points', w_go: 'To the city', w_empty: 'The city is empty yet',
    b_h: 'Breakdown by holdings', b_bets: 'Bets', b_more: '{n} more', b_open: 'in play', b_tr: '{n} tr.', b_none: 'No closed trades or bets in this period', b_wk: 'In play now: {n} · {x}',
    r_h: 'My result', r_d1: '1 d', r_d3: '3 d', r_d5: '5 d', r_d7: '7 d', r_d14: '14 d', r_d30: '30 d',
    r_share: 'Share', r_save: 'Download image', r_none: 'No data for this period: the result curve appears after your first deposits and trades.',
    r_part: 'The game is younger than {d}: the whole period is shown — {s}', r_hold: 'Press and hold the image to save it', r_ok: 'Image saved', r_fail: 'Could not save the image',
    c_slogan: 'Your virtual economic universe', c_for: 'RESULT FOR {d}', c_pct: 'of deposited', c_play: 'play money',
    c_trades: 'Trades', c_win: 'Winning', c_best: 'Best trade', c_level: 'Level {n}', c_nodata: 'no data', c_chart: 'Result over time',
    d1: '1 day', d3: '3 days', d5: '5 days', d7: '7 days', d14: '14 days', d30: '30 days', h_s: '{n} h', d_s: '{n} d', m_s: '{n} min'
  }
};
let H = null;                                           // мост к sim.js
const L = () => (H.lang() === 'en' ? 'en' : 'ru');
const g = (k, o) => String(D[L()][k] != null ? D[L()][k] : (D.ru[k] != null ? D.ru[k] : k)).replace(/\{(\w+)\}/g, (m, a) => (o && o[a] != null ? o[a] : ''));
const bn = id => BY[id][L()];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = id => document.getElementById(id);
const mny = (v, d) => H.money(v, d == null ? (Math.abs(v) >= 1000 ? 0 : 2) : d);
const short = v => { const a = Math.abs(v); return (v < 0 ? '−' : '') + '$' + (a >= 1e6 ? +(a / 1e6).toFixed(a >= 1e7 ? 0 : 1) + 'M' : a >= 1e4 ? +(a / 1e3).toFixed(a >= 1e5 ? 0 : 1) + 'K' : Math.round(a).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')); };
const lockSvg = '<svg class="gr-lk" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>';
const city = () => norm(H.S());
const myLvl = () => H.level() + 1;

// Фигуры зданий: линии в сетке 64×64, обводка — градиент (бирюза → фиолет). Ступень добавляет детали и свечение.
const SH = {
  kiosk: '<rect x="18" y="34" width="28" height="22"/><path d="M13 34L32 23l19 11"/><rect x="24" y="41" width="10" height="8"/><path d="M40 42v14"/>',
  exch: '<rect x="14" y="26" width="36" height="30"/><path d="M14 26l18-10 18 10"/><circle cx="32" cy="41" r="7"/><path d="M32 37v8M29.5 39.5h5"/>',
  dc: '<rect x="16" y="14" width="32" height="11"/><rect x="16" y="28" width="32" height="11"/><rect x="16" y="42" width="32" height="11"/><path d="M21 19.500h6M21 33.500h6M21 47.500h6M42 19.500h2M42 33.500h2M42 47.500h2"/>',
  hall: '<path d="M10 26L32 13l22 13z"/><path d="M16 29v22M26 29v22M38 29v22M48 29v22"/><rect x="10" y="51" width="44" height="5"/>',
  bank: '<path d="M12 27L32 14l20 13z"/><rect x="12" y="27" width="40" height="29"/><path d="M20 33v17M32 33v17M44 33v17"/><circle cx="32" cy="21" r="2.500"/>',
  lab: '<rect x="14" y="32" width="26" height="24"/><path d="M20 50v-8M27 50v-13M34 50v-5"/><path d="M44 56V30l8-7"/><path d="M42 24a9 9 0 0113 6"/>',
  fund: '<rect x="14" y="26" width="15" height="30"/><rect x="33" y="12" width="17" height="44"/><path d="M19 33h5M19 40h5M19 47h5M38 20h7M38 28h7M38 36h7M38 44h7"/>',
  tower: '<path d="M23 56L27 14h10l4 42z"/><path d="M32 14V6"/><path d="M25 26h14M24 36h16M23.500 46h17"/><path d="M29 6h6"/>',
  inst: '<path d="M13 32a19 17 0 0138 0z"/><rect x="13" y="32" width="38" height="5"/><path d="M18 37v19M27 37v19M37 37v19M46 37v19"/><path d="M11 56h42"/>',
  obs: '<path d="M12 46a20 20 0 0140 0z"/><path d="M32 26l9-13"/><path d="M10 46h44v10H10z"/><path d="M26 33l5-6"/>'
};
function fig(id, l, big) {
  const extra = (l >= 3 ? '<path d="M8 59h48" opacity=".6"/>' : '') + (l >= 5 ? '<circle cx="32" cy="4.500" r="1.800"/>' : '');
  return '<svg class="gr-fig' + (big ? ' big' : '') + '" viewBox="0 0 64 64" aria-hidden="true" style="--gl:' + (l / MAXL).toFixed(2) + '"><g class="gr-ln">' + (SH[id] || '') + extra + '</g></svg>';
}
const defs = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="grg" gradientUnits="userSpaceOnUse" x1="6" y1="8" x2="58" y2="58"><stop offset="0" stop-color="rgb(var(--acc))"/><stop offset="1" stop-color="rgb(var(--acc2))"/></linearGradient></defs></svg>';
// 19.11: новые строки большой карты
Object.assign(D.ru, {
  hint3: 'Тяните — сдвиг карты · два пальца или правая кнопка — поворот · колесо или щипок — масштаб',
  build: 'Строить', close_rib: 'Свернуть', stash: 'Склад', cat_inc: 'Доход', cat_home: 'Жильё и сервис', cat_park: 'Парки', cat_spec: 'Особые',
  cells: 'Занято {a} из {b} клеток', tip: 'Выберите здание → поставьте на зелёные клетки у дороги', tip_ok: 'Понятно',
  pm_ok: 'Поставить', pm_ok_mv: 'Готово', pm_rot: 'Повернуть', pm_cancel: 'Отмена', pm_move: 'Переставить', pm_store: 'На склад', pm_free: 'бесплатно', pm_good: 'Можно ставить', pm_pick: 'Нажмите на клетку, чтобы поставить здание',
  full: 'Во весь экран', unfull: 'Выйти', zin: 'Ближе', zout: 'Дальше', rl: 'Повернуть влево', rr: 'Повернуть вправо', home: 'К началу', sclose: 'Закрыть',
  rule_road: 'У дороги', rule_water: 'У воды', rule_hill: 'На холме', rule_plaza: 'На площади', rule_free: 'Где угодно',
  e_taken: 'Клетки заняты', e_blocked: 'Здесь дорога или вода', e_closed: 'Район закрыт — откройте его', e_road: 'Здание должно касаться дороги', e_water: 'Нужен берег моря', e_hill: 'Только на холме', e_plaza: 'Только на площади',
  e_bounds: 'За краем карты', e_reserved: 'Холм и площадь — для особых зданий', e_limit: 'Предел числа сейчас: {n} (растёт с уровнем)', e_space: 'Нет подходящего места', e_unknown: '', e_none: '',
  t_placed: 'Поставлено: {n}', t_moved: 'Переставлено: {n}', t_stored: 'На складе: {n}', t_opened: 'Район «{n}» открыт',
  m_size: 'Площадь', m_rule: 'Место', m_nb: 'Соседям', nb_r: '+{p}% в радиусе {r}', nb_d: '+{p}% всему району', m_got_nb: 'Прибавка от соседей', size_s: '{w}×{d}', cnt_s: '{a}/{b}',
  d_h: 'Район «{n}»', d_cond: 'Откроется на уровне {n} «{name}» за {x}', d_open: 'Открыть · {x}', d_have: 'Район открыт', d_lvl: 'Нужен уровень {n}', lvl_s: 'ур. {n}', mine: 'Мои здания', shop: 'Купить', no_stash: 'Склад пуст', mv: 'Переставить',
  st_hint: 'Здание уходит со склада на поле без потери ступени', own_s: 'Ступень {n} из 5'
});
Object.assign(D.en, {
  hint3: 'Drag to pan · two fingers or right button to rotate · wheel or pinch to zoom',
  build: 'Build', close_rib: 'Hide', stash: 'Storage', cat_inc: 'Income', cat_home: 'Housing & services', cat_park: 'Parks', cat_spec: 'Special',
  cells: 'Used {a} of {b} cells', tip: 'Pick a building → place it on green cells next to a road', tip_ok: 'Got it',
  pm_ok: 'Place', pm_ok_mv: 'Done', pm_rot: 'Rotate', pm_cancel: 'Cancel', pm_move: 'Move', pm_store: 'To storage', pm_free: 'free', pm_good: 'Good to place', pm_pick: 'Tap a cell to place the building',
  full: 'Full screen', unfull: 'Exit', zin: 'Zoom in', zout: 'Zoom out', rl: 'Rotate left', rr: 'Rotate right', home: 'Home', sclose: 'Close',
  rule_road: 'Next to a road', rule_water: 'By the water', rule_hill: 'On the hill', rule_plaza: 'On the plaza', rule_free: 'Anywhere',
  e_taken: 'Cells are taken', e_blocked: 'Road or water is here', e_closed: 'District is closed — open it first', e_road: 'The building must touch a road', e_water: 'Needs the seashore', e_hill: 'Hill only', e_plaza: 'Plaza only',
  e_bounds: 'Outside the map', e_reserved: 'Hill and plaza are for special buildings', e_limit: 'Limit right now: {n} (grows with level)', e_space: 'No suitable place', e_unknown: '', e_none: '',
  t_placed: 'Placed: {n}', t_moved: 'Moved: {n}', t_stored: 'In storage: {n}', t_opened: 'District “{n}” opened',
  m_size: 'Size', m_rule: 'Place', m_nb: 'To neighbours', nb_r: '+{p}% within {r} cells', nb_d: '+{p}% to the whole district', m_got_nb: 'Neighbour bonus', size_s: '{w}×{d}', cnt_s: '{a}/{b}',
  d_h: 'District “{n}”', d_cond: 'Opens at level {n} “{name}” for {x}', d_open: 'Open · {x}', d_have: 'District is open', d_lvl: 'Level {n} needed', lvl_s: 'lv {n}', mine: 'My buildings', shop: 'Buy', no_stash: 'Storage is empty', mv: 'Move',
  st_hint: 'The building returns from storage to the field with its step kept', own_s: 'Step {n} of 5'
});
Object.assign(SH, {
  vend: '<rect x="14" y="32" width="36" height="22"/><path d="M10 32h44"/><rect x="20" y="38" width="16" height="10"/><path d="M42 38v10"/>',
  atm: '<rect x="20" y="16" width="24" height="38"/><rect x="25" y="22" width="14" height="9"/><path d="M26 40h12M26 47h12"/>',
  pay: '<path d="M16 54V24M48 54V24M12 24h40"/><circle cx="32" cy="40" r="8"/><path d="M28 40h8"/>',
  broker: '<rect x="10" y="38" width="44" height="16"/><rect x="18" y="14" width="18" height="24"/><path d="M22 20h10M22 26h10M22 32h10M42 46h8"/>',
  vc: '<rect x="20" y="40" width="24" height="14"/><rect x="23" y="28" width="18" height="12"/><rect x="26" y="18" width="12" height="10"/><path d="M32 18V8"/>',
  home: '<rect x="14" y="32" width="18" height="22"/><rect x="34" y="20" width="16" height="34"/><path d="M18 40h6M18 47h6M38 28h8M38 36h8M38 44h8"/>',
  cowork: '<path d="M10 34L32 20l22 14"/><rect x="14" y="34" width="36" height="20"/><path d="M22 42h8M34 42h8M22 48h8"/>',
  mall: '<rect x="8" y="30" width="48" height="24"/><path d="M14 30a18 12 0 0136 0"/><path d="M16 42h10M38 42h10"/>',
  park: '<path d="M32 56V40"/><path d="M32 10l12 16H20z"/><path d="M32 22l14 20H18z"/>',
  fountain: '<ellipse cx="32" cy="46" rx="22" ry="8"/><path d="M32 46V22M32 22c-6 2-8 8-8 12M32 22c6 2 8 8 8 12"/>',
  port: '<path d="M8 50h48M10 56h44"/><rect x="14" y="38" width="12" height="12"/><path d="M42 50V14l12 8M42 22H28"/>',
  maglev: '<path d="M6 54h52"/><path d="M12 44h40l4-8H18z"/><path d="M20 44v10M44 44v10"/>'
});

/* ---- состояние экрана: выбранное здание / район, режим стройки, лента, полный экран ---- */
let openId = null, selU = 0, selD = -1, pm = null, ribOpen = false, ribCat = 'inc', ribWhy = '', full = false, nativeFs = false, fullPushed = false, boxKey = '';
const MWc = MAP.W, MDc = MAP.D, clampN = (v, a, b) => Math.max(a, Math.min(b, v));
const dName = d => d[L()];
const whyType = b => { const c = city(), lv = myLvl(); if (lv < b.lvl) return 'level'; if (count(c, b.id) >= limOf(b, lv)) return 'limit'; if (H.S().cash + 1e-9 < b.price) return 'funds'; return ''; };
const whyText = (b, w) => (w === 'level' ? g('e_level', { n: b.lvl }) : w === 'limit' ? g('e_limit', { n: limOf(b, myLvl()) }) : w === 'funds' ? g('e_funds', { x: mny(b.price, 0) }) : '');
const nbTxt = b => (b.nb ? (b.nb.r > 0 ? g('nb_r', { p: Math.round(b.nb.p * 100), r: b.nb.r }) : g('nb_d', { p: Math.round(b.nb.p * 100) })) : '');

/* 3D-вид (gorod3d.js): по умолчанию, если есть WebGL и не включён режим «меньше движения»; «Список» — запасной вид */
let fail3d = false;
const G3 = () => root.DofaGorod3D || null;
const reduced = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion:reduce)').matches);
const can3 = () => !!(G3() && !fail3d && !reduced() && G3().supported());
const use3d = () => { let m = ''; try { m = localStorage.getItem('dofa_gr_mode') || ''; } catch (e) { /* ничего */ } return can3() && m !== 'list'; };
const sync = () => { if (G3() && G3().alive()) G3().update(); };

function items3() {
  const c = city(), now = H.now();
  return c.p.filter(it => !it.s).map(it => { const f = fp(BY[it.id], it.r), p = pend(c, it, now); return { u: it.u, id: it.id, l: it.l, x: it.x, y: it.y, r: it.r, w: f.w, d: f.d, txt: p >= 1 ? '+' + short(p) : '', sel: it.u === selU }; });
}
function dists3() { const c = city(); return DIST.map(d => ({ id: d.id, open: c.d.indexOf(d.id) >= 0, name: dName(d), cond: myLvl() < d.lvl ? g('lock_lv', { n: d.lvl, x: short(d.price) }) : short(d.price) })); }
function ghost3() { if (!pm) return null; const f = fp(BY[pm.id], pm.r); return { id: pm.id, x: pm.x, y: pm.y, r: pm.r, w: f.w, d: f.d, ok: pm.ok }; }
function radiusMark(m, b, rect, dmId) {
  if (!b.nb) return;
  if (b.nb.r > 0) { for (let z = Math.max(0, rect.y - b.nb.r); z < Math.min(MDc, rect.y + rect.d + b.nb.r); z++) for (let x = Math.max(0, rect.x - b.nb.r); x < Math.min(MWc, rect.x + rect.w + b.nb.r); x++) { const t = MAP.T[z * MWc + x]; if (t !== 1 && t !== 2) m[z * MWc + x] = 2; } }
  else for (let i = 0; i < MWc * MDc; i++) if (MAP.DM[i] === dmId && MAP.T[i] !== 1) m[i] = 2;
}
const ovKey = () => { const c = city(); return (pm ? [pm.id, pm.x, pm.y, pm.r, pm.u, pm.ok ? 1 : 0].join(',') : '-') + '|' + selU + '|' + c.d.join('') + '|' + c.p.map(it => it.u + it.x + ',' + it.y + it.r + it.s + it.l).join(';');
};
let ovMemo = { k: '', m: null };
function ovData() {
  const k = ovKey(); if (ovMemo.k === k) return ovMemo.m;
  const c = city(), m = new Uint8Array(MWc * MDc);
  if (pm) {
    const b = BY[pm.id], av = availMask(c, b, pm.r, pm.u || 0), f = fp(b, pm.r);
    for (let i = 0; i < m.length; i++) if (av[i]) m[i] = 1;
    radiusMark(m, b, { x: pm.x, y: pm.y, w: f.w, d: f.d }, MAP.DM[clampN(pm.y, 0, MDc - 1) * MWc + clampN(pm.x, 0, MWc - 1)]);
    for (let j = 0; j < f.d; j++) for (let i = 0; i < f.w; i++) { const x = pm.x + i, y = pm.y + j; if (x >= 0 && y >= 0 && x < MWc && y < MDc) m[y * MWc + x] = pm.ok ? 3 : 4; }
  } else if (selU) {
    const it = itOf(c, selU); if (it && !it.s) { const q = rectOf(it), b = BY[it.id]; radiusMark(m, b, q, distOfCell(q)); for (let j = 0; j < q.d; j++) for (let i = 0; i < q.w; i++) m[(q.y + j) * MWc + q.x + i] = 5; }
  }
  ovMemo = { k: k, m: m }; return m;
}
const distOfCell = q => MAP.DM[q.y * MWc + q.x];
function api3() {
  return { lang: L, label: g('lbl3'), loading: g('ld3'), hint: g('hint3'), map: MAP, items: items3, districts: dists3, overlay: ovData, ovSig: ovKey, ghost: ghost3, placing: () => !!pm, name: bn,
    cell: pmCell, tapItem: u => selectItem(u), tapCell: (cx, cz) => tapCell(cx, cz),
    fail: () => { fail3d = true; if (G3()) G3().dispose(); const bx = $('gorodBox'); if (bx && !$('v-gorod').hidden) { boxKey = ''; render(bx); } } };
}

/* ---- режим стройки ---- */
function pmCheck() { const c = city(), b = BY[pm.id]; pm.err = check(c, b, pm.x, pm.y, pm.r, occOf(c, pm.u || 0)); pm.ok = !pm.err; }
function startPlace(id, u) {
  const c = city(), b = BY[id], it = u ? itOf(c, u) : null, cen = (G3() && G3().center()) || { cx: MAP.START.x, cz: MAP.START.z };
  pm = { id: id, u: u || 0, r: it ? it.r : 0, x: cen.cx, y: cen.cz, ok: false, err: '' };
  const sp = findSpot(c, b, { x: cen.cx, z: cen.cz }, u || 0);
  if (sp) { pm.x = sp.x; pm.y = sp.y; pm.r = sp.r; pmCheck(); if (G3() && G3().alive()) G3().focus(sp.x + 1, sp.y + 1); } else { pmCheck(); H.toast(g('e_space'), 'down', false); }
  ribOpen = false; selU = 0; selD = -1; hud(); sync();
}
function pmCell(cx, cz, confirm) {
  if (!pm) return; const b = BY[pm.id], f = fp(b, pm.r);
  const x = clampN(cx - ((f.w - 1) >> 1), 0, MWc - f.w), y = clampN(cz - ((f.d - 1) >> 1), 0, MDc - f.d), same = x === pm.x && y === pm.y;
  pm.x = x; pm.y = y; pmCheck();
  if (confirm && same && pm.ok) { pmConfirm(); return; }
  hudPm(); sync();
}
function pmRot() { if (!pm) return; const b = BY[pm.id]; if (b.w === b.d) return; pm.r ^= 1; const f = fp(b, pm.r); pm.x = clampN(pm.x, 0, MWc - f.w); pm.y = clampN(pm.y, 0, MDc - f.d); pmCheck(); hudPm(); sync(); }
function pmConfirm() {
  if (!pm) return; if (!pm.ok) { H.vib(20); hudPm(); return; }
  const S = H.S(), now = H.now(), id = pm.id; let r;
  if (pm.u) r = move(S, pm.u, pm.x, pm.y, pm.r, now); else r = place(S, id, myLvl(), now, pm.x, pm.y, pm.r);
  if (!r.ok) { H.vib(20); const m = r.err === 'funds' ? g('e_funds', { x: mny(BY[id].price, 0) }) : r.err === 'limit' ? g('e_limit', { n: limOf(BY[id], myLvl()) }) : r.err === 'level' ? g('e_level', { n: BY[id].lvl }) : g('e_' + r.err); H.toast(m, 'down', false); pm.err = r.err; hudPm(); return; }
  H.save(); H.snd(); H.vib([10, 30, 10]); H.toast(g(pm.u ? 't_moved' : 't_placed', { n: bn(id) }), 'up', true);
  selU = 0; pm = null; H.render(); hud(); sync();
}
function pmCancel() { pm = null; hud(); sync(); }
function selectItem(u) { if (pm) return; selU = u; selD = -1; ribOpen = false; hud(); sync(); const it = itOf(city(), u); if (it && G3() && G3().alive()) { const f = fp(BY[it.id], it.r); G3().focus(it.x + f.w / 2, it.y + f.d / 2); } }
function tapCell(cx, cz) {
  if (pm) return; selU = 0; selD = -1;
  if (cx >= 0) { const d = MAP.DM[cz * MWc + cx]; if (d >= 0 && city().d.indexOf(d) < 0) selD = d; }
  hud(); sync();
}

/* ---- панели внутри карты: лента построек, окно здания, окно района, строка стройки ---- */
const pips = l => '<span class="gr-pip" aria-hidden="true">' + [1, 2, 3, 4, 5].map(n => '<u' + (n <= l ? ' class="on"' : '') + '></u>').join('') + '</span>';
function cardHTML(b) {
  const w = whyType(b), c = city(), n = count(c, b.id), lm = limOf(b, myLvl());
  return '<button type="button" class="gr3-card' + (w ? ' off' : '') + (w === 'level' ? ' lock' : '') + '" data-g="pick" data-id="' + b.id + '" data-why="' + w + '">' + fig(b.id, 1) +
    '<b>' + esc(bn(b.id)) + '</b><small class="num">' + short(b.price) + ' · ' + g('size_s', { w: b.w, d: b.d }) + '</small>' +
    '<em class="num">' + (w === 'level' ? g('lvl_s', { n: b.lvl }) : g('cnt_s', { a: n, b: lm })) + '</em>' + (w === 'level' ? lockSvg : '') + '</button>';
}
function stashCard(it) { const b = BY[it.id]; return '<button type="button" class="gr3-card" data-g="unst" data-u="' + it.u + '">' + fig(it.id, it.l) + '<b>' + esc(bn(it.id)) + '</b><small class="num">' + g('own_s', { n: it.l }) + '</small><em class="num">' + g('size_s', { w: b.w, d: b.d }) + '</em></button>'; }
function ribHTML() {
  const c = city(), stash = c.p.filter(it => it.s), cats = CATS.map(k => '<button type="button" class="chip' + (ribCat === k ? ' on' : '') + '" data-g="cat" data-k="' + k + '">' + g('cat_' + k) + '</button>').join('') +
    '<button type="button" class="chip' + (ribCat === 'stash' ? ' on' : '') + '" data-g="cat" data-k="stash">' + g('stash') + (stash.length ? ' · ' + stash.length : '') + '</button>';
  const cards = ribCat === 'stash' ? (stash.length ? stash.map(stashCard).join('') : '<p class="gr3-empty">' + g('no_stash') + '</p>') : B.filter(b => b.cat === ribCat).map(cardHTML).join('');
  return '<div class="gr3-rib"><div class="gr3-cats">' + cats + '<span class="gr3-cnt num" id="grCnt">' + g('cells', { a: cellsUsed(c), b: cellsTotal(c) }) + '</span><button type="button" class="gr3-x" data-g="rib" aria-label="' + g('close_rib') + '">×</button></div>' +
    '<p class="gr3-why" id="grWhy">' + esc(ribWhy) + '</p><div class="gr3-cards">' + cards + '</div></div>';
}
function sheetHTML() {
  const c = city(), now = H.now(), it = itOf(c, selU), b = it && BY[it.id], lv = myLvl(), perH = L() === 'en' ? 'h' : 'ч';
  if (!it) return '';
  const row = (k, v, id) => '<div class="grm-r"><span>' + k + '</span><b class="num"' + (id ? ' id="' + id + '"' : '') + '>' + v + '</b></div>';
  const nb = nbOf(c, it), step = it.l, need = step < MAXL && step + 1 >= LES_FROM && !H.lesDone(b.les);
  let rows = '';
  if (b.inc[0] > 0) rows += row(g('m_rate'), mny(rate(c, it)) + '/' + perH) + row(g('m_pend'), mny(pend(c, it, now)), 'grsPend');
  if (nb > 0) rows += row(g('m_got_nb'), '+' + Math.round(nb * 100) + '%');
  if (b.nb) rows += row(g('m_nb'), nbTxt(b));
  rows += row(g('m_rule'), g('rule_' + b.rule) + ' · ' + g('size_s', { w: b.w, d: b.d }));
  const btns = (b.inc[0] > 0 ? '<button type="button" class="gr-btn" id="grsCol" data-g="col" data-u="' + it.u + '">' + g('collect') + '</button>' : '') +
    (step < MAXL ? '<button type="button" class="gr-btn alt" data-g="up" data-u="' + it.u + '"' + (need ? ' data-need="1"' : '') + '>' + g('up', { n: step + 1 }) + ' · ' + short(stepCost(it.id, step + 1)) + '</button>' : '') +
    '<button type="button" class="gr-btn alt" data-g="mv" data-u="' + it.u + '">' + g('pm_move') + '</button><button type="button" class="gr-btn alt" data-g="st" data-u="' + it.u + '">' + g('pm_store') + '</button>';
  return '<div class="gr3-sheet"><button type="button" class="gr3-x" data-g="sclose" aria-label="' + g('sclose') + '">×</button><div class="grm-top">' + fig(it.id, it.l) + '<div><h2>' + esc(bn(it.id)) + '</h2><p class="grm-st num">' + g('own_s', { n: it.l }) + pips(it.l) + '</p></div></div>' +
    '<div class="grm-rows">' + rows + '</div>' + (need ? '<p class="grm-note">' + g('m_need_les', { name: esc(H.lesTitle(b.les)) }) + ' <a href="#learn" data-g="sclose">' + g('m_les_go') + '</a></p>' : '') + (b.perk ? '<p class="grm-note perk">' + g('perk_' + b.perk) + '</p>' : '') +
    '<p class="grm-err" id="grsErr" role="status"></p><div class="m-btns">' + btns + '</div></div>';
}
function distSheetHTML() {
  const d = DIST[selD]; if (!d) return ''; const lv = myLvl(), can = lv >= d.lvl;
  return '<div class="gr3-sheet"><button type="button" class="gr3-x" data-g="sclose" aria-label="' + g('sclose') + '">×</button><h2>' + g('d_h', { n: esc(dName(d)) }) + '</h2>' +
    '<p class="grm-note">' + (can ? g('d_open', { x: mny(d.price, 0) }) : g('d_cond', { n: d.lvl, name: esc(H.levelName(d.lvl - 1)), x: mny(d.price, 0) })) + '</p><p class="grm-err" id="grsErr" role="status"></p>' +
    '<div class="m-btns"><button type="button" class="gr-btn" data-g="dopen" data-id="' + d.id + '"' + (can ? '' : ' data-need="1"') + '>' + g('d_open', { x: short(d.price) }) + '</button></div></div>';
}
function pmBarHTML() {
  const b = BY[pm.id], mv = !!pm.u;
  return '<div class="gr3-pm"><div class="pm-t"><b>' + esc(bn(pm.id)) + '</b><span id="pmMsg" class="' + (pm.ok ? 'ok' : 'bad') + '">' + pmMsg() + '</span></div><div class="pm-b">' +
    (b.w !== b.d ? '<button type="button" class="gr-btn alt" data-g="pmrot">↻ ' + g('pm_rot') + '</button>' : '') + '<button type="button" class="gr-btn" id="pmOk" data-g="pmok"' + (pm.ok ? '' : ' data-off="1"') + '>' + (mv ? g('pm_ok_mv') : g('pm_ok') + ' · ' + short(b.price)) + '</button><button type="button" class="gr-btn alt" data-g="pmx">' + g('pm_cancel') + '</button></div></div>';
}
const pmMsg = () => (pm.ok ? g('pm_good') + ' · ' + g('size_s', { w: fp(BY[pm.id], pm.r).w, d: fp(BY[pm.id], pm.r).d }) : (pm.err ? g('e_' + pm.err) : g('pm_pick')));
function hudPm() { const m = $('pmMsg'), ok = $('pmOk'); if (m && pm) { m.textContent = pmMsg(); m.className = pm.ok ? 'ok' : 'bad'; } if (ok && pm) ok.toggleAttribute('data-off', !pm.ok); if (!m) hud(); }
function hud() {
  const low = $('gr3low'), el = $('gr3'); if (!low || !el) return;
  low.innerHTML = pm ? pmBarHTML() : selU ? sheetHTML() : selD >= 0 ? distSheetHTML() : ribOpen ? ribHTML() : '';
  el.classList.toggle('has-low', !!low.innerHTML); el.classList.toggle('placing', !!pm);
  const bb = $('gr3b'); if (bb) bb.hidden = !!pm || ribOpen || !!selU || selD >= 0;
  const cn = $('gr3cnt'); if (cn) cn.textContent = g('cells', { a: cellsUsed(city()), b: cellsTotal(city()) });
}
function hudTop() {
  return '<div class="gr3-top"><div class="gr3-tp"><span class="lbl">' + g('pool') + '</span><b class="num" id="grPool2"></b></div><button type="button" class="gr-btn" id="grAll2" data-g="all">' + g('coll_all') + '</button><button type="button" class="gr3-ex" data-g="unfull" aria-label="' + g('unfull') + '">' + g('unfull') + ' ×</button></div>';
}
const ICON = { full: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>', unfull: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>' };
function toolsHTML() {
  const t = (a, ic, l) => '<button type="button" class="gr3-b" data-g="' + a + '" aria-label="' + l + '" title="' + l + '">' + ic + '</button>';
  return '<div class="gr3-tools">' + t(full ? 'unfull' : 'full', full ? ICON.unfull : ICON.full, full ? g('unfull') : g('full')) + t('zin', '+', g('zin')) + t('zout', '−', g('zout')) + t('rl', '⟲', g('rl')) + t('rr', '⟳', g('rr')) + t('home', '⌂', g('home')) + '</div>';
}
function render(box) {
  if (!H || !box) return;
  const c = city(), u3 = use3d(), key = L() + '|' + u3, shell = $('gr3');
  if (u3 && shell && boxKey === key && box.contains(shell) && G3() && G3().alive()) { refresh(); hud(); sync(); return; }   // уже собрано: обновить значения, не пересоздавая сцену
  boxKey = key; if (!u3) { pm = null; selU = 0; selD = -1; if (full) setFull(false); }
  let tip = false; try { tip = localStorage.getItem('dofa_gr_tip') !== '1'; } catch (e) { /* ничего */ }
  box.innerHTML = defs + '<div class="vhead"><h1>' + g('h') + '</h1><p class="slogan">' + g('sub') + '</p></div>' +
    '<div class="gr-sum panel"><div class="gr-st"><span class="lbl">' + g('pool') + '</span><b class="num gr-big" id="grPool"></b><small class="num" id="grCap"></small></div>' +
    '<div class="gr-st"><span class="lbl">' + g('rate') + '</span><b class="num gr-mid" id="grRate"></b></div>' +
    '<button type="button" class="gr-btn" id="grAll" data-g="all">' + g('coll_all') + '</button></div>' +
    (can3() ? '<div class="gr-mode" role="group" aria-label="' + g('h') + '"><button type="button" class="chip' + (u3 ? ' on' : '') + '" data-g="mode" data-m="3d" aria-pressed="' + u3 + '">' + g('m3d') + '</button><button type="button" class="chip' + (u3 ? '' : ' on') + '" data-g="mode" data-m="list" aria-pressed="' + !u3 + '">' + g('mlist') + '</button></div>' : '') +
    (u3 ? '<div class="gr3" id="gr3"><div class="gr3-view" id="gr3v"></div>' + hudTop() + toolsHTML() + '<button type="button" class="gr3-build" id="gr3b" data-g="rib">' + g('build') + '</button><span class="gr3-cn num" id="gr3cnt"></span>' +
        (tip ? '<p class="gr3-tip" id="gr3tip"><span>' + g('tip') + '</span><button type="button" data-g="tipx">' + g('tip_ok') + '</button></p>' : '') + '<div class="gr3-low" id="gr3low"></div></div>'
      : listHTML(c));
  if (u3) { G3().mount($('gr3v'), api3()); hud(); } else if (G3()) G3().dispose();
  refresh();
}
function listHTML(c) {
  const mine = c.p.map(plotHTML).join(''), lv = myLvl();
  return '<h2 class="h2">' + g('mine') + '</h2><div class="gr-grid">' + (mine || '<div class="gr-plot empty" aria-hidden="true"><b class="gr-n">' + g('free') + '</b></div>') + '</div><h2 class="h2">' + g('shop') + '</h2><div class="gr-grid">' + B.map(b => typeHTML(b, lv)).join('') + '</div>';
}
function plotHTML(it) {
  const c = city(), now = H.now();
  return '<button type="button" class="gr-plot own" data-g="open" data-u="' + it.u + '">' + fig(it.id, it.l) +
    '<b class="gr-n">' + esc(bn(it.id)) + '</b><span class="gr-s num">' + (it.s ? g('stash') : g('own_step', { n: it.l }) + ' · ' + g('per_h', { x: short(rate(c, it)) })) + '</span>' +
    pips(it.l).replace('class="gr-pip"', 'class="gr-pip" style="display:inline-flex"') + '<em class="gr-pd num" data-gp="' + it.u + '">+' + short(pend(c, it, now)) + '</em></button>';
}
function typeHTML(b, lv) {
  const w = whyType(b);
  return '<button type="button" class="gr-plot ' + (w === 'level' ? 'lock' : 'can') + '" data-g="open" data-id="' + b.id + '">' + fig(b.id, 1) + (w === 'level' ? lockSvg : '') + '<b class="gr-n">' + esc(bn(b.id)) + '</b><span class="gr-s num">' +
    (w === 'level' ? g('lock_lv', { n: b.lvl, x: short(b.price) }) : g('buy_for', { x: short(b.price) }) + ' · ' + count(city(), b.id) + '/' + limOf(b, lv)) + '</span></button>';
}
function refresh() {
  if (!H) return;
  const c = city(), now = H.now(), all = pendAll(c, now), bt = $('grAll');
  if ($('grPool')) {
    $('grPool').textContent = mny(all); $('grRate').textContent = mny(rateAll(c)) + '/' + (L() === 'en' ? 'h' : 'ч');
    $('grCap').textContent = g('cap', { h: capH(c) }) + (rateAll(c) > 0 ? ' · ' + mny(poolMax(c), 0) : '');
    if (bt) { bt.disabled = !(all >= 0.01); bt.title = all >= 0.01 ? '' : g('nothing'); }
    if ($('grPool2')) { $('grPool2').textContent = mny(all); const b2 = $('grAll2'); if (b2) b2.disabled = !(all >= 0.01); }
    c.p.forEach(it => { const e = document.querySelector('[data-gp="' + it.u + '"]'); if (e) e.textContent = '+' + short(pend(c, it, now)); });
    if (G3() && G3().alive()) G3().update();
  }
  if (selU && $('grsPend')) { const it = itOf(c, selU); if (it) { const p = pend(c, it, now); $('grsPend').textContent = mny(p); const cb = $('grsCol'); if (cb) cb.disabled = !(p >= 0.01); } }
  if (openId && !$('modal').hidden && $('grmPend')) {
    const p = pend(c, openId.u ? openId.u : 0, now); $('grmPend').textContent = mny(p); const cb = $('grmCol'); if (cb) cb.disabled = !(p >= 0.01);
  }
  walletRefresh();
}

/* окно здания или типа в виде «Список» (общее окно страницы #modal) */
function modal(o) {
  openId = o; const c = city(), now = H.now(), lv = myLvl(), box = $('modalBody'), it = o.u ? itOf(c, o.u) : null, b = it ? BY[it.id] : BY[o.id];
  if (!b) return;
  let rows = '', btns = '', note = '';
  const row = (k, v, cls) => '<div class="grm-r"><span>' + k + '</span><b class="num ' + (cls || '') + '">' + v + '</b></div>', perH = L() === 'en' ? 'h' : 'ч';
  if (it) {
    const step = it.l, nxt = step < MAXL ? Math.round(b.inc[step] * bonus(c)) : 0;
    rows = (b.inc[0] > 0 ? row(g('m_rate'), mny(rate(c, it)) + '/' + perH) + (step < MAXL ? row(g('m_next'), mny(nxt, 0) + '/' + perH) : '') + '<div class="grm-r"><span>' + g('m_pend') + '</span><b class="num" id="grmPend">' + mny(pend(c, it, now)) + '</b></div>' : '') + (b.nb ? row(g('m_nb'), nbTxt(b)) : '');
    if (b.inc[0] > 0) btns = '<button type="button" class="gr-btn" id="grmCol" data-g="col" data-u="' + it.u + '">' + g('collect') + '</button>';
    if (step < MAXL) {
      const need = step + 1 >= LES_FROM && !H.lesDone(b.les);
      btns += '<button type="button" class="gr-btn alt" data-g="up" data-u="' + it.u + '"' + (need ? ' data-need="1"' : '') + '>' + g('up', { n: step + 1 }) + ' · ' + short(stepCost(it.id, step + 1)) + '</button>';
      if (need) note = '<p class="grm-note">' + g('m_need_les', { name: esc(H.lesTitle(b.les)) }) + ' <a href="#learn" data-g="close">' + g('m_les_go') + '</a></p>';
    } else btns += '<p class="grm-note">' + g('maxed') + '</p>';
    if (it.s) btns += '<button type="button" class="gr-btn alt" data-g="unst" data-u="' + it.u + '">' + g('pm_move') + '</button>';
  } else {
    rows = row(g('m_rate'), mny(b.inc[0], 0) + '/' + perH) + row(g('m_cost'), mny(b.price, 0)) + row(g('m_size'), g('size_s', { w: b.w, d: b.d })) + row(g('m_rule'), g('rule_' + b.rule)) + (b.nb ? row(g('m_nb'), nbTxt(b)) : '');
    const w = whyType(b);
    if (w === 'level') note = '<p class="grm-note">' + g('m_need_lv', { n: b.lvl, name: esc(H.levelName(b.lvl - 1)) }) + '</p>';
    else if (w === 'limit') note = '<p class="grm-note">' + whyText(b, w) + '</p>';
    else btns = '<button type="button" class="gr-btn" data-g="buy" data-id="' + b.id + '">' + g('buy') + ' · ' + short(b.price) + '</button>';
  }
  if (b.perk) note += '<p class="grm-note perk">' + g('perk_' + b.perk) + '</p>';
  box.innerHTML = '<div class="grm"><div class="grm-top">' + fig(b.id, it ? it.l : 1, true) + '<div><h2 id="modalTitle">' + esc(bn(b.id)) + '</h2><p class="grm-st num">' + (it ? g('own_step', { n: it.l }) + pips(it.l) : '') + '</p></div></div>' +
    '<div class="grm-rows">' + rows + '</div>' + note + '<p class="grm-err" id="grmErr" role="status"></p><div class="m-btns">' + btns + '<button type="button" class="btn-ghost" data-g="close">' + g('close') + '</button></div></div>';
  $('modal').hidden = false;
}
function errMsg(r, b) {
  if (r.err === 'funds') return g('e_funds', { x: mny(r.cost != null ? r.cost : b.price, 0) });
  if (r.err === 'level') return g('e_level', { n: b.lvl });
  if (r.err === 'lesson') return g('e_lesson', { name: H.lesTitle(b.les) });
  if (r.err === 'owned' || r.err === 'limit') return g('e_limit', { n: limOf(b, myLvl()) });
  return g('e_' + r.err);
}
function setFull(on) {
  const el = $('gr3'); on = !!on && !!el; if (full === on) return; full = on;
  if (el) el.classList.toggle('full', on); document.documentElement.classList.toggle('gr-lock', on);
  if (on) {
    try { const d = document.documentElement; if (d.requestFullscreen) d.requestFullscreen().catch(() => { /* слой на весь экран остаётся */ }); } catch (e) { /* ничего */ }
    try { history.pushState({ gr: 1 }, ''); fullPushed = true; } catch (e) { fullPushed = false; }
  } else {
    if (document.fullscreenElement && document.exitFullscreen) { try { document.exitFullscreen().catch(() => { /* ничего */ }); } catch (e) { /* ничего */ } }
    if (fullPushed) { fullPushed = false; try { if (history.state && history.state.gr) history.back(); } catch (e) { /* ничего */ } }
  }
  const tl = el && el.querySelector('.gr3-tools'); if (tl) tl.outerHTML = toolsHTML();
  const tp = el && el.querySelector('.gr3-top'); if (tp && !tp.querySelector('#grPool2')) tp.outerHTML = hudTop();
  refresh(); if (G3() && G3().alive()) setTimeout(() => G3().update(), 60);
}
function act(a, id, u, el) {
  const now = H.now(), S = H.S(), c = city(); let r, b = id ? BY[id] : null; u = +u || 0; const it = u ? itOf(c, u) : null; if (it) b = BY[it.id];
  switch (a) {
    case 'close': $('modal').hidden = true; openId = null; return;
    case 'open': modal(u ? { u: u } : { id: id }); H.vib(8); return;
    case 'rib': ribOpen = !ribOpen; selU = 0; selD = -1; ribWhy = ''; hud(); sync(); return;
    case 'cat': ribCat = el.getAttribute('data-k'); ribWhy = ''; hud(); return;
    case 'pick': { const w = whyType(b); if (w) { ribWhy = whyText(b, w); const e = $('grWhy'); if (e) e.textContent = ribWhy; H.vib(15); return; } startPlace(id, 0); return; }
    case 'unst': if (!it) return; if ($('modal') && !$('modal').hidden) { $('modal').hidden = true; } startPlace(it.id, it.u); return;
    case 'mv': if (!it) return; startPlace(it.id, it.u); return;
    case 'st': r = store(S, u, now); if (!r.ok) return; H.save(); H.snd(); H.vib(10); H.toast(g('t_stored', { n: bn(it.id) }), 'up', true); selU = 0; H.render(); hud(); sync(); return;
    case 'pmok': pmConfirm(); return;
    case 'pmrot': pmRot(); return;
    case 'pmx': pmCancel(); return;
    case 'sclose': selU = 0; selD = -1; hud(); sync(); return;
    case 'tag': selectItem(u); return;
    case 'dist': selD = +id; selU = 0; ribOpen = false; hud(); sync(); return;
    case 'dopen': {
      const k = +id; r = openDist(S, k, myLvl());
      if (!r.ok) { const e = $('grsErr'); if (e) e.textContent = r.err === 'level' ? g('d_lvl', { n: DIST[k].lvl }) : r.err === 'funds' ? g('e_funds', { x: mny(DIST[k].price, 0) }) : ''; H.vib(20); return; }
      H.save(); H.snd(); H.vib([10, 30, 10]); H.toast(g('t_opened', { n: dName(DIST[k]) }), 'up', true); selD = -1; H.render(); hud(); sync(); return;
    }
    case 'full': setFull(true); return;
    case 'unfull': setFull(false); return;
    case 'zin': if (G3()) G3().zoom(0.78); return;
    case 'zout': if (G3()) G3().zoom(1.28); return;
    case 'rl': if (G3()) G3().rot(-Math.PI / 4); return;
    case 'rr': if (G3()) G3().rot(Math.PI / 4); return;
    case 'home': if (G3()) G3().home(); return;
    case 'tipx': try { localStorage.setItem('dofa_gr_tip', '1'); } catch (e) { /* ничего */ } { const t = $('gr3tip'); if (t) t.remove(); } return;
    case 'all':
      r = collect(S, '', now); if (!r.ok) { H.vib(20); return; }
      H.save(); H.snd(); H.vib([10, 30, 10]); H.toast(g('t_got', { x: mny(r.got) }), 'up', true); H.render(); return;
    case 'col':
      r = collect(S, u, now); if (!r.ok) { H.vib(20); return; }
      H.save(); H.snd(); H.vib([10, 30, 10]); H.toast(g('t_got', { x: mny(r.got) }), 'up', true); H.render(); if (openId && openId.u === u) modal(openId); hud(); return;
    case 'buy': r = buy(S, id, myLvl(), now); break;
    case 'up': r = upgrade(S, u, H.lesDone, now); break;
    default: return;
  }
  if (!r.ok) { const e = $('grmErr') && !$('modal').hidden ? $('grmErr') : $('grsErr'); if (e) e.textContent = errMsg(r, b); H.vib(20); return; }
  H.save(); H.snd(); H.vib([10, 30, 10]);
  H.toast(a === 'buy' ? g('t_bought', { n: bn(id) }) : g('t_up', { n: bn(b.id), s: r.step }), 'up', true);
  H.render();
  if (!$('modal').hidden) { if (a === 'buy') { openId = { u: r.u }; } modal(openId); }
  hud(); sync();
}

/* ============ 3. КОШЕЛЁК: «Доход города» и «Мой результат» ============ */
let rcDays = 7, rcBusy = false;
const DAYS = [1, 3, 5, 7, 14, 30];
function periodData(days) {
  const S = H.S(), now = H.now(), cur = H.result(), cut = now - days * 864e5, cv = S.curve || [];
  if (!(S.deposited > 0) || cv.length < 1) return { none: true };
  let base = 0, partial = false, first = cv[0][0];
  if (first > cut) { partial = true; base = 0; } else { for (let i = 0; i < cv.length && cv[i][0] <= cut; i++) base = cv[i][1]; }
  const t0 = partial ? first : cut, pts = [[t0, base]];
  cv.forEach(p => { if (p[0] > t0) pts.push([p[0], p[1]]); }); pts.push([now, cur]);
  if (pts.length < 2 || now - t0 < 6e4) return { none: true };
  const tr = (S.trades || []).filter(x => x.t >= (partial ? 0 : cut)), wins = tr.filter(x => x.net > 0).length;
  let best = null; tr.forEach(x => { if (best == null || x.net > best) best = x.net; });
  const cutT = partial ? 0 : cut, by = {};
  tr.forEach(x => { const o = by[x.sym] || (by[x.sym] = { k: x.sym, net: 0, n: 0 }); o.net += x.net; o.n++; });
  const bh = (S.betHist || []).filter(x => x.at >= cutT); if (bh.length) by['*bets'] = { k: '', bets: true, net: bh.reduce((q, x) => q + (x.pay - x.a), 0), n: bh.length };
  const rows = Object.keys(by).map(k => { by[k].net = r2(by[k].net); return by[k]; }).sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  const opn = { n: (S.positions || []).length + (S.bets || []).filter(b => b && b.a > 0).length, amt: r2((S.positions || []).reduce((q, p) => q + (+p.margin || 0), 0) + (S.bets || []).reduce((q, b) => q + (b && b.a > 0 ? b.a : 0), 0)) };
  return { rows: rows, open: opn, none: false, res: Math.round((cur - base) * 100) / 100, pct: S.deposited > 0 ? (cur - base) / S.deposited : null, pts: pts, n: tr.length, wins: wins, best: best, partial: partial, span: now - t0 };
}
const spanTxt = ms => (ms >= 864e5 ? g('d_s', { n: Math.round(ms / 864e5 * 10) / 10 }) : ms >= HOUR ? g('h_s', { n: Math.round(ms / HOUR * 10) / 10 }) : g('m_s', { n: Math.max(1, Math.round(ms / 6e4)) }));

const sgn = v => (v > 0 ? '+' : v < 0 ? '−' : '') + '$' + Math.round(Math.abs(v)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const rowName = o => (o.bets ? g('b_bets') : o.k);
function bdHTML(d) {
  if (d.none) return '';
  const rows = d.rows || [], cap = 10, open = d.open && d.open.n > 0 ? '<div class="rc-bd-r wk"><span>' + g('b_open') + ' · ' + d.open.n + '</span><b class="num">' + mny(d.open.amt, 0) + '</b></div>' : '';
  if (!rows.length) return '<p class="rc-bd-h">' + g('b_h') + '</p><p class="rc-bd-e">' + g('b_none') + '</p>' + open;
  return '<p class="rc-bd-h">' + g('b_h') + '</p>' + rows.slice(0, cap).map(o => '<div class="rc-bd-r"><span><b>' + esc(rowName(o)) + '</b> <small>' + g('b_tr', { n: o.n }) + '</small></span><b class="num ' + (o.net > 0 ? 'up' : o.net < 0 ? 'dn' : '') + '">' + sgn(o.net) + '</b></div>').join('') +
    (rows.length > cap ? '<p class="rc-bd-e">' + g('b_more', { n: rows.length - cap }) + '</p>' : '') + open;
}
function mountWallet(box) {
  if (!H || !box) return;
  box.innerHTML = '<div class="gr-wl panel" id="grWl"></div><h2 class="h2">' + g('r_h') + '</h2><div class="panel rc">' +
    '<div class="rc-seg" role="group" aria-label="' + g('r_h') + '">' + DAYS.map(d => '<button type="button" class="chip' + (d === rcDays ? ' on' : '') + '" data-g="days" data-d="' + d + '">' + g('r_d' + d) + '</button>').join('') + '</div>' +
    '<p class="rc-msg" id="rcMsg" role="status"></p><div class="rc-bd" id="rcBd"></div><div class="rc-cv"><canvas id="rcCv" width="1080" height="1920" aria-label="' + g('r_h') + '"></canvas></div>' +
    '<div class="rc-btns"><button type="button" class="gr-btn" data-g="share" id="rcShare">' + g('r_share') + '</button><button type="button" class="gr-btn alt" data-g="save" id="rcSave">' + g('r_save') + '</button></div></div>';
  walletRefresh(); drawCard();
}
function walletRefresh() {
  const el = $('grWl'); if (!el || !H) return;
  const c = city(), now = H.now(), has = owned(c) > 0 || c['in'] > 0;
  const html = '<div class="gr-wl-h"><b>' + g('w_h') + '</b><a class="btn-ghost" href="#gorod">' + g('w_go') + '</a></div>' + (has ?
    '<div class="gr-wl-r"><span>' + g('w_got') + '</span><b class="num">' + mny(c['in']) + '</b></div><div class="gr-wl-r"><span>' + g('w_wait') + '</span><b class="num">' + mny(pendAll(c, now)) + '</b></div>' : '<p class="gr-wl-e">' + g('w_empty') + '</p>') + '<small>' + g('w_note') + '</small>';
  if (el.getAttribute('data-h') !== html) { el.setAttribute('data-h', html); el.innerHTML = html; }
}

/* --- карточка 1080×1920 --- */
function wrapText(cx, text, maxW) {
  const w = text.split(' '), out = []; let cur = '';
  w.forEach(x => { const t = cur ? cur + ' ' + x : x; if (cx.measureText(t).width > maxW && cur) { out.push(cur); cur = x; } else cur = t; });
  if (cur) out.push(cur); return out;
}
function rrect(cx, x, y, w, h, r) { cx.beginPath(); cx.moveTo(x + r, y); cx.arcTo(x + w, y, x + w, y + h, r); cx.arcTo(x + w, y + h, x, y + h, r); cx.arcTo(x, y + h, x, y, r); cx.arcTo(x, y, x + w, y, r); cx.closePath(); }
const SANS = '"IBM Plex Sans", system-ui, "Segoe UI", sans-serif', MONO = '"IBM Plex Mono", ui-monospace, Consolas, monospace';
function paintCard(cv, d, dayWord) {
  const cx = cv.getContext('2d'), W = 1080, Hh = 1920, UP = '#39F5A6', DN = '#FF5C8A', up = d.none || d.res >= 0;
  const col = d.none ? '#B8F6FF' : up ? UP : DN;
  cx.clearRect(0, 0, W, Hh);
  cx.fillStyle = '#03060C'; cx.fillRect(0, 0, W, Hh);
  let gr = cx.createRadialGradient(120, 80, 0, 120, 80, 1100); gr.addColorStop(0, 'rgba(34,227,255,.34)'); gr.addColorStop(1, 'rgba(34,227,255,0)'); cx.fillStyle = gr; cx.fillRect(0, 0, W, Hh);
  gr = cx.createRadialGradient(1000, 1800, 0, 1000, 1800, 1200); gr.addColorStop(0, 'rgba(124,92,255,.38)'); gr.addColorStop(1, 'rgba(124,92,255,0)'); cx.fillStyle = gr; cx.fillRect(0, 0, W, Hh);
  cx.strokeStyle = 'rgba(34,227,255,.07)'; cx.lineWidth = 2; cx.beginPath();
  for (let x = 0; x <= W; x += 60) { cx.moveTo(x, 0); cx.lineTo(x, Hh); } for (let y = 0; y <= Hh; y += 60) { cx.moveTo(0, y); cx.lineTo(W, y); } cx.stroke();
  cx.textAlign = 'left'; cx.textBaseline = 'alphabetic';
  cx.font = '600 40px ' + MONO; cx.fillStyle = '#B8F6FF'; cx.fillText('DOFAMART · АКЦИИ'.replace('АКЦИИ', L() === 'en' ? 'STOCKS' : 'АКЦИИ'), 90, 250);
  const lg = cx.createLinearGradient(90, 0, 990, 0); lg.addColorStop(0, '#22E3FF'); lg.addColorStop(1, '#786EFF');
  cx.fillStyle = lg; cx.fillRect(90, 276, 900, 4);
  cx.font = '700 66px ' + SANS; cx.fillStyle = '#EAF6FF'; wrapText(cx, g('c_slogan'), 900).forEach((s, i) => cx.fillText(s, 90, 380 + i * 80));
  cx.font = '600 42px ' + MONO; cx.fillStyle = 'rgba(184,246,255,.85)'; cx.fillText(g('c_for', { d: dayWord.toUpperCase() }), 90, 620);
  const big = d.none ? '—' : (d.res > 0 ? '+' : d.res < 0 ? '−' : '') + '$' + Math.abs(d.res).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/,/g, ' ');
  let fs = 170; cx.font = '700 ' + fs + 'px ' + MONO; while (cx.measureText(big).width > 900 && fs > 60) { fs -= 6; cx.font = '700 ' + fs + 'px ' + MONO; }
  cx.shadowColor = col; cx.shadowBlur = 40; cx.fillStyle = col; cx.fillText(big, 90, 790); cx.shadowBlur = 0;
  cx.font = '600 56px ' + MONO; cx.fillStyle = col;
  const pc = d.none || d.pct == null ? g('c_nodata') : (d.pct > 0 ? '+' : d.pct < 0 ? '−' : '') + Math.abs(d.pct * 100).toFixed(2) + '% ' + g('c_pct');
  cx.fillText(pc, 90, 870);
  cx.font = '500 34px ' + SANS; cx.fillStyle = 'rgba(234,246,255,.6)'; cx.fillText(g('c_play'), 90, 925);
  // график
  const px = 90, py = 975, pw = 900, ph = 330;
  rrect(cx, px, py, pw, ph, 36); cx.fillStyle = 'rgba(8,16,30,.72)'; cx.fill(); cx.strokeStyle = 'rgba(34,227,255,.35)'; cx.lineWidth = 3; cx.stroke();
  cx.font = '600 30px ' + MONO; cx.fillStyle = 'rgba(184,246,255,.7)'; cx.fillText(g('c_chart'), px + 36, py + 62);
  if (!d.none && d.pts.length > 1) {
    const ts = d.pts.map(p => p[0]), vs = d.pts.map(p => p[1]); const t0 = ts[0], t1 = ts[ts.length - 1] || t0 + 1;
    let lo = Math.min(0, ...vs), hi = Math.max(0, ...vs); if (hi - lo < 1e-9) { hi += 1; lo -= 1; }
    const ix = px + 40, iw = pw - 80, iy = py + 100, ih = ph - 160, X = t => ix + (t - t0) / (t1 - t0 || 1) * iw, Y = v => iy + (hi - v) / (hi - lo) * ih;
    cx.setLineDash([12, 12]); cx.strokeStyle = 'rgba(234,246,255,.3)'; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(ix, Y(0)); cx.lineTo(ix + iw, Y(0)); cx.stroke(); cx.setLineDash([]);
    cx.beginPath(); d.pts.forEach((p, i) => { i ? cx.lineTo(X(p[0]), Y(p[1])) : cx.moveTo(X(p[0]), Y(p[1])); });
    cx.lineTo(X(t1), Y(0)); cx.lineTo(X(t0), Y(0)); cx.closePath();
    const fg = cx.createLinearGradient(0, iy, 0, iy + ih); fg.addColorStop(0, up ? 'rgba(57,245,166,.35)' : 'rgba(255,92,138,.05)'); fg.addColorStop(1, up ? 'rgba(57,245,166,.02)' : 'rgba(255,92,138,.35)'); cx.fillStyle = fg; cx.fill();
    cx.beginPath(); d.pts.forEach((p, i) => { i ? cx.lineTo(X(p[0]), Y(p[1])) : cx.moveTo(X(p[0]), Y(p[1])); });
    cx.strokeStyle = col; cx.lineWidth = 6; cx.lineJoin = 'round'; cx.shadowColor = col; cx.shadowBlur = 18; cx.stroke(); cx.shadowBlur = 0;
    cx.fillStyle = col; cx.beginPath(); cx.arc(X(t1), Y(vs[vs.length - 1]), 11, 0, 6.2832); cx.fill();
  } else { cx.font = '500 36px ' + SANS; cx.fillStyle = 'rgba(234,246,255,.5)'; cx.textAlign = 'center'; cx.fillText(g('c_nodata'), px + pw / 2, py + ph / 2 + 10); cx.textAlign = 'left'; }
  // три цифры
  const cells = [[g('c_trades'), d.none ? '—' : String(d.n)], [g('c_win'), d.none || !d.n ? '—' : Math.round(d.wins / d.n * 100) + '%'],
    [g('c_best'), d.none || d.best == null ? '—' : (d.best > 0 ? '+' : d.best < 0 ? '−' : '') + '$' + Math.round(Math.abs(d.best)).toLocaleString('en-US').replace(/,/g, ' ')]];
  cells.forEach((c, i) => {
    const x = 90 + i * 306, w = 288; rrect(cx, x, 1325, w, 120, 28); cx.fillStyle = 'rgba(8,16,30,.72)'; cx.fill(); cx.strokeStyle = 'rgba(124,92,255,.4)'; cx.lineWidth = 3; cx.stroke();
    cx.font = '500 28px ' + SANS; cx.fillStyle = 'rgba(234,246,255,.6)'; cx.fillText(c[0], x + 26, 1371);
    let f = 46; cx.font = '700 ' + f + 'px ' + MONO; while (cx.measureText(c[1]).width > w - 40 && f > 26) { f -= 3; cx.font = '700 ' + f + 'px ' + MONO; }
    cx.fillStyle = '#EAF6FF'; cx.fillText(c[1], x + 26, 1424);
  });
  // разбивка по вложениям
  { const by0 = 1470, bh = 275; rrect(cx, 90, by0, 900, bh, 30); cx.fillStyle = 'rgba(8,16,30,.72)'; cx.fill(); cx.strokeStyle = 'rgba(34,227,255,.3)'; cx.lineWidth = 3; cx.stroke();
    cx.font = '600 28px ' + MONO; cx.fillStyle = 'rgba(184,246,255,.7)'; cx.fillText(g('b_h'), 124, by0 + 46);
    const rows = d.none ? [] : (d.rows || []), shown = rows.slice(0, 5), more = rows.length - shown.length, op = !d.none && d.open && d.open.n > 0 ? d.open : null;
    if (!shown.length) { cx.font = '500 28px ' + SANS; cx.fillStyle = 'rgba(234,246,255,.5)'; cx.fillText(d.none ? g('c_nodata') : g('b_none'), 124, by0 + 100); }
    shown.forEach((o, i) => { const y = by0 + 90 + i * 32; cx.font = '700 27px ' + MONO; cx.fillStyle = '#EAF6FF'; cx.textAlign = 'left'; cx.fillText(rowName(o), 124, y);
      cx.font = '500 22px ' + SANS; cx.fillStyle = 'rgba(234,246,255,.5)'; cx.fillText(g('b_tr', { n: o.n }), 330, y);
      cx.font = '700 27px ' + MONO; cx.fillStyle = o.net >= 0 ? UP : DN; cx.textAlign = 'right'; cx.fillText(sgn(o.net), 956, y); cx.textAlign = 'left'; });
    if (more > 0 || op) { const y = by0 + 90 + 5 * 32, t = (more > 0 ? g('b_more', { n: more }) : '') + (more > 0 && op ? ' · ' : '') + (op ? g('b_open') + ' ' + op.n + ' · ' + mny(op.amt, 0) : ''); cx.font = '500 24px ' + SANS; cx.fillStyle = 'rgba(184,246,255,.6)'; cx.fillText(t, 124, y); } }
  // уровень
  const lv = H.level() + 1, ltxt = g('c_level', { n: lv }) + ' · ' + H.levelName(lv - 1);
  cx.font = '600 40px ' + MONO; const lw = cx.measureText(ltxt).width + 80;
  rrect(cx, 90, 1770, lw, 90, 45); const bg = cx.createLinearGradient(90, 0, 90 + lw, 0); bg.addColorStop(0, 'rgba(34,227,255,.9)'); bg.addColorStop(1, 'rgba(120,110,255,.9)'); cx.fillStyle = bg; cx.fill();
  cx.fillStyle = '#03060C'; cx.fillText(ltxt, 130, 1827);
}
let fontsOk = false;
function drawCard() {
  const cv = $('rcCv'); if (!cv || !H) return;
  const d = periodData(rcDays), msg = $('rcMsg'), dw = g('d' + rcDays);
  const bd = $('rcBd'); if (bd) bd.innerHTML = bdHTML(d);
  if (msg) msg.textContent = d.none ? g('r_none') : d.partial ? g('r_part', { d: dw, s: spanTxt(d.span) }) : '';
  const go = () => { fontsOk = true; if ($('rcCv') === cv) paintCard(cv, d, dw); };
  if (fontsOk || !document.fonts || !document.fonts.load) { go(); return; }
  paintCard(cv, d, dw);
  Promise.all(['700 100px "IBM Plex Mono"', '600 40px "IBM Plex Mono"', '700 66px "IBM Plex Sans"', '500 30px "IBM Plex Sans"'].map(f => document.fonts.load(f).catch(() => null)))
    .then(() => document.fonts.ready).then(go, go);
}
function blobOf(cv) { return new Promise(res => { try { cv.toBlob(b => res(b), 'image/png'); } catch (e) { res(null); } }); }
const inTg = () => !!(root.Telegram && root.Telegram.WebApp && root.Telegram.WebApp.initData);
async function shareCard(save) {
  const cv = $('rcCv'); if (!cv || rcBusy) return; rcBusy = true;
  try {
    const b = await blobOf(cv); if (!b) throw new Error('blob');
    const file = new File([b], 'dofamart-result-' + rcDays + 'd.png', { type: 'image/png' });
    if (!save && navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
      try { await navigator.share({ files: [file], title: 'dofamart' }); } catch (e) { /* закрыл окно «Поделиться» */ }
    } else if (inTg() && !(navigator.canShare && navigator.canShare({ files: [file] }))) {   // в приложении Telegram файл не скачать: показываем картинку, её можно сохранить удержанием
      $('modalBody').innerHTML = '<div class="grm"><h2 id="modalTitle">' + g('r_h') + '</h2><p class="grm-note">' + g('r_hold') + '</p><img class="rc-img" alt="" src="' + cv.toDataURL('image/png') + '"><div class="m-btns"><button type="button" class="btn-ghost" data-g="close">' + g('close') + '</button></div></div>';
      $('modal').hidden = false;
    } else {
      const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = file.name; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); H.toast(g('r_ok'), 'up', true);
    }
  } catch (e) { H.toast(g('r_fail'), 'down', false); }
  rcBusy = false;
}

function init(host) {
  H = host;
  document.addEventListener('click', e => {
    const el = e.target.closest && e.target.closest('[data-g]'); if (!el || !H) return;
    const a = el.getAttribute('data-g');
    if (a === 'days') { rcDays = +el.getAttribute('data-d'); document.querySelectorAll('.rc-seg .chip').forEach(b => b.classList.toggle('on', +b.getAttribute('data-d') === rcDays)); drawCard(); return; }
    if (a === 'mode') { try { localStorage.setItem('dofa_gr_mode', el.getAttribute('data-m')); } catch (er) { /* ничего */ } const bx = $('gorodBox'); if (bx) { boxKey = ''; render(bx); } return; }
    if (a === 'share') { shareCard(false); return; }
    if (a === 'save') { shareCard(true); return; }
    if (el.disabled) return;
    if (el.tagName === 'A' && (a === 'close' || a === 'sclose')) { $('modal').hidden = true; openId = null; if (a === 'sclose') { selU = 0; selD = -1; hud(); sync(); } return; }
    e.preventDefault(); act(a, el.getAttribute('data-id'), el.getAttribute('data-u'), el);
  });
  document.addEventListener('fullscreenchange', () => { nativeFs = !!document.fullscreenElement; if (!nativeFs && full) setFull(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (pm) pmCancel(); else if (full) setFull(false); } });
  window.addEventListener('popstate', () => { if (full) { fullPushed = false; setFull(false); } });
  window.addEventListener('hashchange', () => { if (full) setFull(false); });
}
Object.assign(API, { init, render, refresh, mountWallet, walletRefresh, drawCard, periodData, paintCard, nav: () => g('nav'), tx: g, dbg: () => ({ pm: pm && { id: pm.id, x: pm.x, y: pm.y, r: pm.r, ok: pm.ok, err: pm.err }, selU: selU, selD: selD, full: full }) });
})(typeof window !== 'undefined' ? window : globalThis);
