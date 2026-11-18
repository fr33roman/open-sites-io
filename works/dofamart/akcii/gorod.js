/* dofamart · Акции — «Город» (здания дают доход в час) и карточка «Мой результат».
   Игровые деньги. Часть 1 — чистый расчёт без страницы (его же гоняет node: tools/gorod-test.mjs).
   Часть 2 — экран и карточка; работает через небольшой «мост» host, который отдаёт sim.js. Ничего никуда не отправляется. */
(function (root) {
'use strict';

/* ============ 1. ДАННЫЕ И РАСЧЁТ ============ */
const HOUR = 3600e3, CAP_H = 8, CAP_BANK_H = 12, HALL_BONUS = 1.05, MAXL = 5, LES_FROM = 4;
const UPK = [1, 0.8, 1.4, 2.2, 3.2];   // цена ступени k = цена здания × UPK[k-1]
// lvl — уровень игрока (1…10), с которого здание открыто; inc — доход в час по ступеням 1…5;
// les — урок (0…10), который надо пройти для ступеней 4 и 5; perk — особенность (hall: +5 % ко всему доходу, bank: копилка 12 ч).
const B = [
  { id: 'kiosk', lvl: 1, price: 500, inc: [5, 8, 14, 24, 40], les: 0, ru: 'Киоск данных', en: 'Data Kiosk' },
  { id: 'exch', lvl: 2, price: 2000, inc: [18, 30, 50, 84, 140], les: 1, ru: 'Обменный пункт', en: 'Exchange Office' },
  { id: 'dc', lvl: 3, price: 6000, inc: [50, 83, 140, 230, 380], les: 2, ru: 'Дата-центр', en: 'Data Center' },
  { id: 'hall', lvl: 4, price: 15000, inc: [110, 180, 310, 510, 850], les: 3, perk: 'hall', ru: 'Биржевой зал', en: 'Trading Floor' },
  { id: 'bank', lvl: 5, price: 40000, inc: [280, 460, 770, 1300, 2100], les: 8, perk: 'bank', ru: 'Банк', en: 'Bank' },
  { id: 'lab', lvl: 6, price: 90000, inc: [600, 990, 1600, 2700, 4500], les: 6, ru: 'Аналитический центр', en: 'Analytics Center' },
  { id: 'fund', lvl: 7, price: 200000, inc: [1300, 2200, 3600, 5900, 9800], les: 5, ru: 'Фонд', en: 'Fund' },
  { id: 'tower', lvl: 8, price: 500000, inc: [3200, 5300, 8800, 15000, 24000], les: 4, ru: 'Башня «Магнат»', en: '“Magnate” Tower' },
  { id: 'inst', lvl: 9, price: 1500000, inc: [9000, 15000, 25000, 41000, 68000], les: 9, ru: 'Институт «Мудрец»', en: '“Sage” Institute' },
  { id: 'obs', lvl: 10, price: 5000000, inc: [28000, 46000, 77000, 130000, 210000], les: 10, ru: 'Обсерватория «Оракул»', en: '“Oracle” Observatory' }
];
const BY = {}; B.forEach(b => { BY[b.id] = b; });
const r2 = v => Math.round(v * 100) / 100;

function norm(S) {                                   // привести состояние к форме города; старые игроки получают пустой город
  const c = S.city && typeof S.city === 'object' ? S.city : (S.city = {});
  if (!c.b || typeof c.b !== 'object') c.b = {};
  Object.keys(c.b).forEach(id => { const x = c.b[id]; if (!BY[id] || !x || !(x.l >= 1)) delete c.b[id]; else { x.l = Math.min(MAXL, Math.floor(x.l)); x.t = +x.t || 0; } });
  c['in'] = +c['in'] || 0; c.out = +c.out || 0; c.streak = +c.streak || 0; c.last = c.last == null ? -1 : +c.last;
  return c;
}
const owned = c => Object.keys(c.b).length;
const capH = c => (c.b.bank ? CAP_BANK_H : CAP_H);
const bonus = c => (c.b.hall ? HALL_BONUS : 1);
const rate = (c, id) => (c.b[id] ? r2(BY[id].inc[c.b[id].l - 1] * bonus(c)) : 0);           // $ в час
const rateAll = c => r2(Object.keys(c.b).reduce((s, id) => s + rate(c, id), 0));
const hoursOf = (c, id, now) => (c.b[id] ? Math.min(capH(c), Math.max(0, now - c.b[id].t) / HOUR) : 0);
const pend = (c, id, now) => r2(hoursOf(c, id, now) * rate(c, id));                          // накоплено в копилке здания
const pendAll = (c, now) => r2(Object.keys(c.b).reduce((s, id) => s + pend(c, id, now), 0));
const poolMax = c => r2(rateAll(c) * capH(c));                                                // сколько вместит копилка всего
const stepCost = (id, step) => Math.round(BY[id].price * UPK[step - 1]);
const maxStep = c => Object.keys(c.b).reduce((m, id) => Math.max(m, c.b[id].l), 0);
const dayOf = now => Math.floor((now - new Date(now).getTimezoneOffset() * 6e4) / 864e5);     // номер дня по местному времени
const streakNow = (c, now) => (c.last >= dayOf(now) - 1 ? c.streak : 0);

// lvl — уровень игрока 1…10; les(i) — пройден ли урок i. Деньги — тот же S.cash. Доход города в результат торговли не входит (S.city.in / S.city.out).
function buy(S, id, lvl, now) {
  const c = norm(S), b = BY[id];
  if (!b) return { ok: false, err: 'unknown' };
  if (c.b[id]) return { ok: false, err: 'owned' };
  if (lvl < b.lvl) return { ok: false, err: 'level' };
  if (S.cash + 1e-9 < b.price) return { ok: false, err: 'funds' };
  S.cash = r2(S.cash - b.price); c.out = r2(c.out + b.price); c.b[id] = { l: 1, t: now };
  return { ok: true, cost: b.price };
}
function settle(S, id, now) {                         // забрать копилку одного здания в деньги (без учёта серии дней)
  const c = norm(S), g = pend(c, id, now);
  if (g > 0) { S.cash = r2(S.cash + g); c['in'] = r2(c['in'] + g); }
  if (c.b[id]) c.b[id].t = now;
  return g;
}
function upgrade(S, id, lesDone, now) {
  const c = norm(S), b = BY[id], x = c.b[id];
  if (!b || !x) return { ok: false, err: 'none' };
  if (x.l >= MAXL) return { ok: false, err: 'max' };
  const step = x.l + 1, cost = stepCost(id, step);
  if (step >= LES_FROM && !(lesDone && lesDone(b.les))) return { ok: false, err: 'lesson', les: b.les };
  if (S.cash + 1e-9 < cost) return { ok: false, err: 'funds', cost: cost };
  const got = settle(S, id, now);                     // накопленное по старой ставке — в кошелёк, дальше считается по новой
  S.cash = r2(S.cash - cost); c.out = r2(c.out + cost); x.l = step;
  return { ok: true, cost: cost, step: step, got: got };
}
function collect(S, id, now) {                        // id пусто — «Собрать всё»
  const c = norm(S); let got = 0;
  (id ? [id] : Object.keys(c.b)).forEach(k => { got += settle(S, k, now); });
  got = r2(got);
  if (got > 0) {
    const d = dayOf(now);
    if (c.last !== d) { c.streak = c.last === d - 1 ? c.streak + 1 : 1; c.last = d; }
  }
  return { ok: got > 0, got: got, err: got > 0 ? '' : 'empty' };
}

const API = { B, BY, UPK, CAP_H, CAP_BANK_H, HALL_BONUS, MAXL, LES_FROM, norm, owned, capH, bonus, rate, rateAll, hoursOf, pend, pendAll, poolMax, stepCost, maxStep, dayOf, streakNow, buy, settle, upgrade, collect };
root.DofaGorod = API;
if (typeof module !== 'undefined' && module.exports) { module.exports = API; }
if (typeof document === 'undefined') return;

/* ============ 2. ЭКРАН «ГОРОД» ============ */
const D = {
  ru: {
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
    r_h: 'Мой результат', r_d1: '1 д', r_d3: '3 д', r_d5: '5 д', r_d7: '7 д', r_d14: '14 д', r_d30: '30 д',
    r_share: 'Поделиться', r_save: 'Скачать картинку', r_none: 'Нет данных за срок: кривая результата появится после первых вложений и сделок.',
    r_part: 'Игре меньше {d}: показан весь срок — {s}', r_hold: 'Нажмите на картинку и удерживайте, чтобы сохранить', r_ok: 'Картинка сохранена', r_fail: 'Не вышло сохранить картинку',
    c_slogan: 'Твоя виртуальная экономическая вселенная', c_for: 'РЕЗУЛЬТАТ ЗА {d}', c_pct: 'к внесённому', c_play: 'игровые деньги',
    c_trades: 'Сделок', c_win: 'В плюс', c_best: 'Лучшая сделка', c_level: 'Уровень {n}', c_nodata: 'нет данных', c_chart: 'Результат во времени',
    d1: '1 день', d3: '3 дня', d5: '5 дней', d7: '7 дней', d14: '14 дней', d30: '30 дней', h_s: '{n} ч', d_s: '{n} д', m_s: '{n} мин'
  },
  en: {
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

let openId = null, gSig = '';
function plotHTML(b) {
  const c = city(), x = c.b[b.id], lv = myLvl(), now = H.now();
  if (x) {
    return '<button type="button" class="gr-plot own" data-g="open" data-id="' + b.id + '">' + fig(b.id, x.l) +
      '<b class="gr-n">' + esc(bn(b.id)) + '</b><span class="gr-s num">' + g('own_step', { n: x.l }) + ' · ' + g('per_h', { x: short(rate(c, b.id)) }) + '</span>' +
      '<i class="gr-pip" aria-hidden="true">' + [1, 2, 3, 4, 5].map(n => '<u' + (n <= x.l ? ' class="on"' : '') + '></u>').join('') + '</i>' +
      '<em class="gr-pd num" data-gp="' + b.id + '">+' + short(pend(c, b.id, now)) + '</em></button>';
  }
  if (lv < b.lvl) return '<button type="button" class="gr-plot lock" data-g="open" data-id="' + b.id + '">' + fig(b.id, 1) + lockSvg + '<b class="gr-n">' + esc(bn(b.id)) + '</b><span class="gr-s num">' + g('lock_lv', { n: b.lvl, x: short(b.price) }) + '</span></button>';
  return '<button type="button" class="gr-plot can" data-g="open" data-id="' + b.id + '">' + fig(b.id, 1) + '<b class="gr-n">' + esc(bn(b.id)) + '</b><span class="gr-s num">' + g('buy_for', { x: short(b.price) }) + '</span></button>';
}
function render(box) {
  if (!H || !box) return;
  const c = city(), now = H.now();
  box.innerHTML = defs + '<div class="vhead"><h1>' + g('h') + '</h1><p class="slogan">' + g('sub') + '</p></div>' +
    '<div class="gr-sum panel"><div class="gr-st"><span class="lbl">' + g('pool') + '</span><b class="num gr-big" id="grPool"></b><small class="num" id="grCap"></small></div>' +
    '<div class="gr-st"><span class="lbl">' + g('rate') + '</span><b class="num gr-mid" id="grRate"></b></div>' +
    '<button type="button" class="gr-btn" id="grAll" data-g="all">' + g('coll_all') + '</button></div>' +
    '<div class="gr-grid">' + B.map(plotHTML).join('') + '<div class="gr-plot empty" aria-hidden="true"><b class="gr-n">' + g('free') + '</b><span class="gr-s">' + g('soon') + '</span></div>' +
    '<div class="gr-plot empty" aria-hidden="true"><b class="gr-n">' + g('free') + '</b><span class="gr-s">' + g('soon') + '</span></div></div>';
  refresh();
}
function refresh() {
  if (!H) return;
  const c = city(), now = H.now(), all = pendAll(c, now), bt = $('grAll');
  if ($('grPool')) {
    $('grPool').textContent = mny(all); $('grRate').textContent = mny(rateAll(c)) + '/' + (L() === 'en' ? 'h' : 'ч');
    $('grCap').textContent = g('cap', { h: capH(c) }) + (rateAll(c) > 0 ? ' · ' + mny(poolMax(c), 0) : '');
    if (bt) { bt.disabled = !(all >= 0.01); bt.title = all >= 0.01 ? '' : g('nothing'); }
    Object.keys(c.b).forEach(id => { const e = document.querySelector('[data-gp="' + id + '"]'); if (e) e.textContent = '+' + short(pend(c, id, now)); });
  }
  if (openId && !$('modal').hidden && $('grmPend')) {
    const p = pend(c, openId, now); $('grmPend').textContent = mny(p); const cb = $('grmCol'); if (cb) cb.disabled = !(p >= 0.01);
  }
  walletRefresh();
}

/* окно здания (общее окно страницы #modal) */
function modal(id) {
  openId = id; const b = BY[id], c = city(), x = c.b[id], now = H.now(), lv = myLvl(), box = $('modalBody');
  let rows = '', btns = '', note = '';
  const row = (k, v, cls) => '<div class="grm-r"><span>' + k + '</span><b class="num ' + (cls || '') + '">' + v + '</b></div>';
  if (x) {
    const step = x.l, nxt = step < MAXL ? Math.round(b.inc[step] * bonus(c)) : 0;
    rows = row(g('m_rate'), mny(rate(c, id)) + '/' + (L() === 'en' ? 'h' : 'ч')) + (step < MAXL ? row(g('m_next'), mny(nxt, 0) + '/' + (L() === 'en' ? 'h' : 'ч')) : '') +
      '<div class="grm-r"><span>' + g('m_pend') + '</span><b class="num" id="grmPend">' + mny(pend(c, id, now)) + '</b></div>';
    btns = '<button type="button" class="gr-btn" id="grmCol" data-g="col" data-id="' + id + '">' + g('collect') + '</button>';
    if (step < MAXL) {
      const need = step + 1 >= LES_FROM && !H.lesDone(b.les);
      btns += '<button type="button" class="gr-btn alt" data-g="up" data-id="' + id + '"' + (need ? ' data-need="1"' : '') + '>' + g('up', { n: step + 1 }) + ' · ' + short(stepCost(id, step + 1)) + '</button>';
      if (need) note = '<p class="grm-note">' + g('m_need_les', { name: esc(H.lesTitle(b.les)) }) + ' <a href="#learn" data-g="close">' + g('m_les_go') + '</a></p>';
    } else btns += '<p class="grm-note">' + g('maxed') + '</p>';
  } else {
    rows = row(g('m_rate'), mny(b.inc[0], 0) + '/' + (L() === 'en' ? 'h' : 'ч')) + row(g('m_cost'), mny(b.price, 0));
    if (lv < b.lvl) note = '<p class="grm-note">' + g('m_need_lv', { n: b.lvl, name: esc(H.levelName(b.lvl - 1)) }) + '</p>';
    else btns = '<button type="button" class="gr-btn" data-g="buy" data-id="' + id + '">' + g('buy') + ' · ' + short(b.price) + '</button>';
  }
  if (b.perk) note += '<p class="grm-note perk">' + g('perk_' + b.perk) + '</p>';
  box.innerHTML = '<div class="grm"><div class="grm-top">' + fig(id, x ? x.l : 1, true) + '<div><h2 id="modalTitle">' + esc(bn(id)) + '</h2><p class="grm-st num">' + (x ? g('own_step', { n: x.l }) : '') +
    '<span class="gr-pip" aria-hidden="true">' + [1, 2, 3, 4, 5].map(n => '<u' + (x && n <= x.l ? ' class="on"' : '') + '></u>').join('') + '</span></p></div></div>' +
    '<div class="grm-rows">' + rows + '</div>' + note + '<p class="grm-err" id="grmErr" role="status"></p><div class="m-btns">' + btns + '<button type="button" class="btn-ghost" data-g="close">' + g('close') + '</button></div></div>';
  $('modal').hidden = false;
}
function errMsg(r, b) {
  if (r.err === 'funds') return g('e_funds', { x: mny(r.cost != null ? r.cost : b.price, 0) });
  if (r.err === 'level') return g('e_level', { n: b.lvl });
  if (r.err === 'lesson') return g('e_lesson', { name: H.lesTitle(b.les) });
  return '';
}
function act(a, id) {
  const now = H.now(), b = id ? BY[id] : null; let r;
  if (a === 'close') { $('modal').hidden = true; openId = null; return; }
  if (a === 'open') { modal(id); H.vib(8); return; }
  if (a === 'all') {
    r = collect(H.S(), '', now); if (!r.ok) { H.vib(20); return; }
    H.save(); H.snd(); H.vib([10, 30, 10]); H.toast(g('t_got', { x: mny(r.got) }), 'up', true); H.render(); return;
  }
  if (a === 'col') {
    r = collect(H.S(), id, now); if (!r.ok) { H.vib(20); return; }
    H.save(); H.snd(); H.vib([10, 30, 10]); H.toast(g('t_got', { x: mny(r.got) }), 'up', true); H.render(); modal(id); return;
  }
  if (a === 'buy') r = buy(H.S(), id, myLvl(), now);
  else if (a === 'up') r = upgrade(H.S(), id, H.lesDone, now);
  else return;
  if (!r.ok) { const e = $('grmErr'); if (e) e.textContent = errMsg(r, b); H.vib(20); return; }
  H.save(); H.snd(); H.vib([10, 30, 10]);
  H.toast(a === 'buy' ? g('t_bought', { n: bn(id) }) : g('t_up', { n: bn(id), s: r.step }), 'up', true);
  H.render(); modal(id);
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
  return { none: false, res: Math.round((cur - base) * 100) / 100, pct: S.deposited > 0 ? (cur - base) / S.deposited : null, pts: pts, n: tr.length, wins: wins, best: best, partial: partial, span: now - t0 };
}
const spanTxt = ms => (ms >= 864e5 ? g('d_s', { n: Math.round(ms / 864e5 * 10) / 10 }) : ms >= HOUR ? g('h_s', { n: Math.round(ms / HOUR * 10) / 10 }) : g('m_s', { n: Math.max(1, Math.round(ms / 6e4)) }));

function mountWallet(box) {
  if (!H || !box) return;
  box.innerHTML = '<div class="gr-wl panel" id="grWl"></div><h2 class="h2">' + g('r_h') + '</h2><div class="panel rc">' +
    '<div class="rc-seg" role="group" aria-label="' + g('r_h') + '">' + DAYS.map(d => '<button type="button" class="chip' + (d === rcDays ? ' on' : '') + '" data-g="days" data-d="' + d + '">' + g('r_d' + d) + '</button>').join('') + '</div>' +
    '<p class="rc-msg" id="rcMsg" role="status"></p><div class="rc-cv"><canvas id="rcCv" width="1080" height="1920" aria-label="' + g('r_h') + '"></canvas></div>' +
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
  const px = 90, py = 990, pw = 900, ph = 470;
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
    const x = 90 + i * 306, w = 288; rrect(cx, x, 1500, w, 150, 28); cx.fillStyle = 'rgba(8,16,30,.72)'; cx.fill(); cx.strokeStyle = 'rgba(124,92,255,.4)'; cx.lineWidth = 3; cx.stroke();
    cx.font = '500 28px ' + SANS; cx.fillStyle = 'rgba(234,246,255,.6)'; cx.fillText(c[0], x + 26, 1550);
    let f = 52; cx.font = '700 ' + f + 'px ' + MONO; while (cx.measureText(c[1]).width > w - 40 && f > 26) { f -= 3; cx.font = '700 ' + f + 'px ' + MONO; }
    cx.fillStyle = '#EAF6FF'; cx.fillText(c[1], x + 26, 1618);
  });
  // уровень
  const lv = H.level() + 1, ltxt = g('c_level', { n: lv }) + ' · ' + H.levelName(lv - 1);
  cx.font = '600 40px ' + MONO; const lw = cx.measureText(ltxt).width + 80;
  rrect(cx, 90, 1710, lw, 96, 48); const bg = cx.createLinearGradient(90, 0, 90 + lw, 0); bg.addColorStop(0, 'rgba(34,227,255,.9)'); bg.addColorStop(1, 'rgba(120,110,255,.9)'); cx.fillStyle = bg; cx.fill();
  cx.fillStyle = '#03060C'; cx.fillText(ltxt, 130, 1773);
}
let fontsOk = false;
function drawCard() {
  const cv = $('rcCv'); if (!cv || !H) return;
  const d = periodData(rcDays), msg = $('rcMsg'), dw = g('d' + rcDays);
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
    if (a === 'share') { shareCard(false); return; }
    if (a === 'save') { shareCard(true); return; }
    if (el.disabled) return;
    if (el.tagName === 'A' && a === 'close') { $('modal').hidden = true; openId = null; return; }
    e.preventDefault(); act(a, el.getAttribute('data-id'));
  });
}
Object.assign(API, { init, render, refresh, mountWallet, walletRefresh, drawCard, periodData, paintCard, nav: () => g('nav'), tx: g });
})(typeof window !== 'undefined' ? window : globalThis);
