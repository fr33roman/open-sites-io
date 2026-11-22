/* dofamart · Акции — раздел «Статистика» (#stat). Игровые деньги.
   Часть 1 — чистый расчёт без страницы (его гоняет node: tools/statistika-test.mjs). Часть 2 — вид; работает через «мост» host, который отдаёт sim.js.
   Источники: S.trades (сделки), S.betHist / S.bets / S.betAgg (ставки), S.city (город), S.curve (кривая), S.log (журнал событий с 23.11, кольцо до 500).
   Новые поля сохранения: S.log (журнал), S.stc (снимок города для разницы), у ставки c / lv / at0. Старые сохранения читаются как есть: чего нет — прочерк. */
(function (root) {
'use strict';

/* ============ 1. РАСЧЁТ ============ */
const r2 = v => Math.round((+v || 0) * 100) / 100;
const num = v => (isFinite(+v) ? +v : 0);
const HOUR = 3600e3, DAY = 864e5, MIN_N = 5;
const PERS = ['day', '7d', '30d', 'all'];

function sinceOf(per, now) {
  if (per === 'day') { const d = new Date(now); d.setHours(0, 0, 0, 0); return d.getTime(); }
  if (per === '7d') return now - 7 * DAY;
  if (per === '30d') return now - 30 * DAY;
  return 0;
}
function grp() { return { n: 0, w: 0, net: 0, margin: 0 }; }
function addG(g, tr) { g.n++; if (tr.net > 0) g.w++; g.net = r2(g.net + tr.net); g.margin = r2(g.margin + num(tr.margin)); }
function bucketLev(l) { return l <= 1 ? 'l1' : l <= 5 ? 'l25' : 'l6'; }

// ctx: { INS, CAT, G (DofaGorod, можно без него), result (итог торговли сейчас, можно без него) }
function calc(S, now, per, ctx) {
  ctx = ctx || {}; const INS = ctx.INS || {}, G = ctx.G || null, since = sinceOf(per, now), all = per === 'all';
  const inP = t => num(t) >= since;
  const trs = (Array.isArray(S.trades) ? S.trades : []).filter(x => x && inP(x.t));
  const bh = (Array.isArray(S.betHist) ? S.betHist : []).filter(x => x && inP(x.at));
  const bo = Array.isArray(S.bets) ? S.bets.filter(b => b && b.a > 0) : [];
  const pos = Array.isArray(S.positions) ? S.positions : [];
  const log = Array.isArray(S.log) ? S.log : [];
  const out = { per: per, since: since, now: now };

  // --- вложено сейчас ---
  const inPos = r2(pos.reduce((s, p) => s + num(p.margin), 0)), inBets = r2(bo.reduce((s, b) => s + num(b.a), 0));
  const city = S.city && typeof S.city === 'object' ? S.city : {};
  const inCity = r2(num(city.out)), cash = r2(num(S.cash)), vault = r2(num(S.vault));
  out.inv = { pos: inPos, bets: inBets, city: inCity, cash: cash, vault: vault, total: r2(inPos + inBets + inCity), posN: pos.length, betsN: bo.length, base: r2(num(S.deposited)) };
  out.invCat = {}; pos.forEach(p => { const c = INS[p.sym] ? INS[p.sym].cat : '?'; out.invCat[c] = r2((out.invCat[c] || 0) + num(p.margin)); });

  // --- торговля ---
  const tg = { n: trs.length, w: 0, l: 0, sumW: 0, sumL: 0, net: 0, best: null, worst: null, turn: 0, hold: 0, holdN: 0, fees: 0, liq: 0, liqSum: 0, gross: 0 };
  const byCat = {}, bySym = {}, bySide = { up: grp(), down: grp() }, byLev = { l1: grp(), l25: grp(), l6: grp() }, byHold = { s: grp(), m: grp() }, byImp = { y: grp(), n: grp() };
  trs.forEach(x => {
    tg.net = r2(tg.net + x.net); tg.turn = r2(tg.turn + num(x.margin) * num(x.lev || 1)); tg.fees = r2(tg.fees + num(x.fees));
    if (x.net > 0) { tg.w++; tg.sumW += x.net; tg.gross += x.net; } else if (x.net < 0) { tg.l++; tg.sumL += x.net; }
    if (!tg.best || x.net > tg.best.net) tg.best = x;
    if (!tg.worst || x.net < tg.worst.net) tg.worst = x;
    if (x.liq) { tg.liq++; tg.liqSum = r2(tg.liqSum + x.net); }
    if (x.t0 > 0 && x.t >= x.t0) { tg.hold += x.t - x.t0; tg.holdN++; byHold[x.t - x.t0 < HOUR ? 's' : 'm'] && addG(byHold[x.t - x.t0 < HOUR ? 's' : 'm'], x); }
    const I = INS[x.sym], c = I ? I.cat : '?'; addG(byCat[c] || (byCat[c] = grp()), x); addG(bySym[x.sym] || (bySym[x.sym] = grp()), x);
    addG(x.side === -1 ? bySide.down : bySide.up, x); addG(byLev[bucketLev(x.lev || 1)], x); addG(x.imp ? byImp.y : byImp.n, x);
  });
  tg.avgW = tg.w ? r2(tg.sumW / tg.w) : null; tg.avgL = tg.l ? r2(tg.sumL / tg.l) : null; tg.rate = tg.n ? tg.w / tg.n : null; tg.avgHold = tg.holdN ? tg.hold / tg.holdN : null;
  tg.byCat = byCat; tg.bySide = bySide; tg.byLev = byLev; tg.byHold = byHold; tg.byImp = byImp;
  const symRows = Object.keys(bySym).map(k => Object.assign({ k: k }, bySym[k]));
  tg.topInv = symRows.slice().sort((a, b) => b.margin - a.margin).slice(0, 10);
  tg.topRes = symRows.slice().sort((a, b) => b.net - a.net).slice(0, 10);
  out.trade = tg;

  // --- ставки ---
  const A = S.betAgg && typeof S.betAgg === 'object' ? S.betAgg : { n: 0, won: 0, staked: 0, paid: 0 };
  const bt = { n: 0, w: 0, l: 0, v: 0, staked: 0, paid: 0, net: 0, max: 0, byC: {}, live: grp(), reg: grp(), bestRun: 0, curRun: 0, open: bo.slice(0, 10).map(b => ({ q: b.q, o: b.o, a: b.a, p: b.p, at: b.at, c: b.c, lv: b.lv })), openN: bo.length, openSum: inBets };
  bh.forEach(x => {
    const st = num(x.a), pay = num(x.pay); bt.n++; bt.staked = r2(bt.staked + st); bt.paid = r2(bt.paid + pay); if (st > bt.max) bt.max = st;
    const won = pay > st + 1e-9, lost = pay < st - 1e-9; if (won) bt.w++; else if (lost) bt.l++; else bt.v++;
    const gx = x.lv ? bt.live : bt.reg; gx.n++; if (won) gx.w++; gx.net = r2(gx.net + pay - st); gx.margin = r2(gx.margin + st);
    const c = x.c || '?'; const g = bt.byC[c] || (bt.byC[c] = grp()); g.n++; if (won) g.w++; g.net = r2(g.net + pay - st); g.margin = r2(g.margin + st);
  });
  bt.net = r2(bt.paid - bt.staked);
  // серии: по всей имеющейся истории (по времени, от старых к новым); ничья (возврат) серию не рвёт и не продлевает
  let run = 0, best = 0; const chron = (Array.isArray(S.betHist) ? S.betHist : []).filter(x => x).slice().sort((a, b) => num(a.at) - num(b.at));
  chron.forEach(x => { const d = num(x.pay) - num(x.a); if (d > 1e-9) { run++; if (run > best) best = run; } else if (d < -1e-9) run = 0; });
  bt.bestRun = best; bt.curRun = run; bt.avg = bt.n ? r2(bt.staked / bt.n) : null; bt.rate = bt.n - bt.v > 0 ? bt.w / (bt.n - bt.v) : null;
  // за всё время основной итог — по счётчикам betAgg (в истории хранится только 60 последних); в «всё время» ещё показываем сумму поставленного
  bt.agg = { n: num(A.n), won: num(A.won), staked: r2(A.staked), paid: r2(A.paid), settled: Math.max(0, num(A.n) - bo.length), net: r2(num(A.paid) - (num(A.staked) - inBets)) };
  bt.histCap = (Array.isArray(S.betHist) ? S.betHist.length : 0) >= 60;
  out.bets = bt;

  // --- город ---
  const cy = { out: r2(num(city.out)), inAll: r2(num(city['in'])), inP: 0, spentP: 0, rate: null, payback: null, top: [], n: 0, dist: 0, hasLog: false };
  log.forEach(e => { if (!e || !inP(e.t)) return; if (e.k === 'gc') cy.inP = r2(cy.inP + num(e.a)); else if (e.k === 'gb' || e.k === 'gu' || e.k === 'gd') cy.spentP = r2(cy.spentP + num(e.a)); });
  cy.hasLog = log.some(e => e && /^g/.test(e.k));
  if (all) { cy.inP = cy.inAll; cy.spentP = cy.out; }
  if (G && Array.isArray(city.p)) {
    try {
      const c = G.norm(S); cy.n = c.p.length; cy.dist = Math.max(0, (c.d || []).length - 1); cy.rate = G.rateAll(c);
      const rows = c.p.map(it => { const b = G.BY[it.id]; let spent = b.price; for (let s = 2; s <= it.l; s++) spent += G.stepCost(it.id, s); const rt = G.rate(c, it); return { id: it.id, l: it.l, spent: r2(spent), rate: rt, back: rt > 0 ? spent / rt : null, sto: !!it.s }; });
      cy.top = rows.filter(r => r.rate > 0).sort((a, b) => b.rate / b.spent - a.rate / a.spent).slice(0, 5);
      const left = Math.max(0, cy.out - cy.inAll); cy.payback = cy.out > 0 ? (left <= 0 ? 0 : cy.rate > 0 ? left / cy.rate : null) : null;
    } catch (e) { /* город не читается — оставляем прочерки */ }
  }
  out.city = cy;

  // --- результат за период ---
  out.res = { trade: tg.net, bets: all ? bt.agg.net : bt.net, city: cy.inP, spent: cy.spentP };
  out.res.total = r2(out.res.trade + out.res.bets + out.res.city);
  out.res.partial = !all && !cy.hasLog;

  // --- кривая ---
  const cv = (Array.isArray(S.curve) ? S.curve : []).filter(p => Array.isArray(p) && isFinite(p[0]) && isFinite(p[1]));
  let pts = cv.filter(p => p[0] >= since);
  if (!all) { const prev = cv.filter(p => p[0] < since).pop(); if (prev) pts.unshift([since, prev[1]]); }
  if (ctx.result != null && isFinite(ctx.result)) pts.push([now, r2(ctx.result)]);
  out.curve = pts;
  out.marks = trs.slice().sort((a, b) => Math.abs(b.net) - Math.abs(a.net)).slice(0, 5).map(x => ({ t: x.t, v: x.net, sym: x.sym, liq: !!x.liq }));

  // --- «в какой момент»: сетка по дням недели и часам ---
  const grid = { act: [], res: [], max: 0, maxR: 0, n: 0 };
  for (let d = 0; d < 7; d++) { grid.act.push(new Array(24).fill(0)); grid.res.push(new Array(24).fill(0)); }
  const hit = (t, k, v) => { if (!(t > 0) || t < since) return; const d = new Date(t), wd = (d.getDay() + 6) % 7, h = d.getHours(); if (k) { grid.act[wd][h]++; grid.n++; } if (v) grid.res[wd][h] = r2(grid.res[wd][h] + v); };
  (Array.isArray(S.trades) ? S.trades : []).forEach(x => { if (!x) return; hit(x.t0, 1, 0); hit(x.t, 0, x.net); });
  (Array.isArray(S.betHist) ? S.betHist : []).forEach(x => { if (!x) return; hit(x.at0 || x.at, 1, 0); hit(x.at, 0, num(x.pay) - num(x.a)); });
  bo.forEach(b => hit(b.at, 1, 0));
  grid.act.forEach(r => r.forEach(v => { if (v > grid.max) grid.max = v; })); grid.res.forEach(r => r.forEach(v => { if (Math.abs(v) > grid.maxR) grid.maxR = Math.abs(v); }));
  out.grid = grid;
  out.empty = !(Array.isArray(S.trades) && S.trades.length) && !num(A.n) && !pos.length && !bo.length && !(num(city.out) > 0) && !(Array.isArray(S.log) && S.log.length);
  return out;
}

/* ---------- лента событий: журнал + то, что можно восстановить из старых сделок и ставок ---------- */
function feed(S, now, per, filt, ctx) {
  const since = sinceOf(per, now), L = Array.isArray(S.log) ? S.log.filter(e => e && e.k) : [];
  const t0 = L.length ? Math.min.apply(null, L.map(e => num(e.t))) : Infinity;   // всё, что старше журнала, берём из сделок и ставок
  const ev = L.map(e => Object.assign({}, e));
  (Array.isArray(S.trades) ? S.trades : []).forEach(x => {
    if (!x) return;
    if (x.t0 > 0 && x.t0 < t0) ev.push({ k: 'o', t: x.t0, s: x.sym, d: x.side, l: x.lev, a: x.margin, old: 1 });
    if (x.t > 0 && x.t < t0) ev.push({ k: 'c', t: x.t, s: x.sym, d: x.side, l: x.lev, a: x.margin, n: x.net, x: x.liq ? 1 : 0, old: 1 });
  });
  (Array.isArray(S.betHist) ? S.betHist : []).forEach(x => {
    if (!x) return;
    if (x.at0 > 0 && x.at0 < t0) ev.push({ k: 'b', t: x.at0, a: x.a, p: x.p, q: x.q, old: 1 });
    if (x.at > 0 && x.at < t0) ev.push({ k: 'r', t: x.at, a: x.a, v: x.pay, h: x.how, q: x.q, old: 1 });
  });
  const FT = { all: null, trade: /^[oc]$/, bet: /^[br]$/, city: /^g/, money: /^d$/ };
  const re = FT[filt || 'all'];
  return ev.filter(e => e.t >= since && (!re || re.test(e.k))).sort((a, b) => b.t - a.t);
}

/* ---------- «почему»: причина результата — структура, текст собирается по языку ---------- */
function whyTrade(x) {
  const mv = x.entry > 0 ? (x.exit - x.entry) / x.entry * 100 : 0, hold = x.t0 > 0 && x.t >= x.t0 ? x.t - x.t0 : null;
  const roi = x.margin > 0 ? x.net / x.margin * 100 : null, fav = x.side * mv;   // fav — ход цены в пользу позиции, %
  const o = { mv: Math.abs(mv), up: mv >= 0, side: x.side, lev: x.lev || 1, hold: hold, roi: roi, net: x.net, fees: num(x.fees), margin: x.margin };
  o.code = x.liq ? 'liq' : (x.net > 0 ? 'win' : x.net < 0 ? (fav > 0 ? 'fee' : 'lose') : 'flat'); o.fav = fav;
  return o;
}
function whyBet(x) {
  const a = num(x.a), pay = num(x.pay), p = num(x.p);
  const o = { how: x.how, a: a, pay: pay, p: p, o: x.o, d: pay - a, k: p > 0 ? 1 / p : null };
  if (x.how === 'sold') o.p1 = a > 0 ? pay * p / a : null;
  o.code = x.how === 'win' ? 'win' : x.how === 'lose' ? 'lose' : x.how === 'void' ? 'void' : (x.how === 'sold' ? (pay >= a ? 'sold_up' : 'sold_dn') : 'void');
  return o;
}

/* ---------- выводы по истории: только если в группе не меньше MIN_N случаев ---------- */
function insights(S, ctx, now) {
  const d = calc(S, now || Date.now(), 'all', ctx), tg = d.trade, bt = d.bets, out = [];
  const pc = g => (g.margin > 0 ? g.net / g.margin * 100 : null);
  const LV = { l1: 'x1', l25: 'x25', l6: 'x6' };
  // плечо
  const lv = Object.keys(tg.byLev).filter(k => tg.byLev[k].n >= MIN_N).sort((a, b) => tg.byLev[a].net - tg.byLev[b].net);
  if (lv.length && tg.byLev[lv[0]].net < 0) out.push({ id: 'lev_bad', w: -tg.byLev[lv[0]].net, p: { g: LV[lv[0]], x: -tg.byLev[lv[0]].net, n: tg.byLev[lv[0]].n } });
  else if (lv.length && tg.byLev[lv[lv.length - 1]].net > 0) { const k = lv[lv.length - 1]; out.push({ id: 'lev_good', w: tg.byLev[k].net, p: { g: LV[k], x: tg.byLev[k].net, n: tg.byLev[k].n } }); }
  // короткие сделки
  if (tg.byHold.s.n >= MIN_N) out.push({ id: 'hold_s', w: 50 + Math.abs(tg.byHold.s.net) / 10, p: { w: tg.byHold.s.w, n: tg.byHold.s.n, x: tg.byHold.s.net } });
  // направление
  const U = tg.bySide.up, D = tg.bySide.down;
  if (U.n >= MIN_N && D.n >= MIN_N && Math.abs(U.w / U.n - D.w / D.n) >= 0.15) { const dn = D.w / D.n > U.w / U.n; out.push({ id: dn ? 'side_dn' : 'side_up', w: 40, p: { a: Math.round((dn ? D : U).w / (dn ? D : U).n * 100), b: Math.round((dn ? U : D).w / (dn ? U : D).n * 100) } }); }
  // вид рынка
  const cats = Object.keys(tg.byCat).filter(k => tg.byCat[k].n >= MIN_N && k !== '?').sort((a, b) => tg.byCat[a].net - tg.byCat[b].net);
  if (cats.length && tg.byCat[cats[0]].net < 0) out.push({ id: 'cat_bad', w: -tg.byCat[cats[0]].net, p: { c: cats[0], x: -tg.byCat[cats[0]].net, n: tg.byCat[cats[0]].n } });
  if (cats.length > 1 && tg.byCat[cats[cats.length - 1]].net > 0) out.push({ id: 'cat_good', w: tg.byCat[cats[cats.length - 1]].net, p: { c: cats[cats.length - 1], x: tg.byCat[cats[cats.length - 1]].net, n: tg.byCat[cats[cats.length - 1]].n } });
  // спешка
  if (tg.byImp.y.n >= MIN_N && tg.byImp.n.n >= MIN_N) out.push({ id: 'imp', w: 45, p: { a: Math.round(tg.byImp.y.w / tg.byImp.y.n * 100), b: Math.round(tg.byImp.n.w / tg.byImp.n.n * 100), n: tg.byImp.y.n } });
  // комиссии
  if (tg.n >= MIN_N && tg.gross > 0 && tg.fees > 0) out.push({ id: 'fees', w: 30, p: { x: tg.fees, pc: Math.round(tg.fees / tg.gross * 100) } });
  // ликвидации
  if (tg.liq >= 2 && tg.n >= MIN_N) out.push({ id: 'liq', w: -tg.liqSum, p: { n: tg.liq, x: -tg.liqSum } });
  // ставки: «Лайв» и обычные
  if (bt.live.n >= MIN_N) out.push({ id: 'bet_live', w: 55, p: { x: pc(bt.live), n: bt.live.n } });
  if (bt.reg.n >= MIN_N) out.push({ id: 'bet_reg', w: 35, p: { x: pc(bt.reg), n: bt.reg.n } });
  return out.sort((a, b) => b.w - a.w).slice(0, 5);
}

/* ---------- снимок города для журнала: сравниваем с прошлым сохранением и пишем события ---------- */
function onSave0(S, lgf, now) {
  const c = S && S.city; if (!c || typeof c !== 'object' || !Array.isArray(c.p)) return;
  now = now || Date.now();
  const cur = { i: num(c['in']), o: num(c.out), u: c.p.map(it => it.u), v: c.p.map(it => it.l), d: Array.isArray(c.d) ? c.d.length : 1 }, st = S.stc;
  if (!st || !Array.isArray(st.u)) { S.stc = cur; return; }
  const dOut = r2(cur.o - num(st.o)), dIn = r2(cur.i - num(st.i));
  if (dOut > 0) {
    let k = 'gu', ex = {};
    if (cur.d > num(st.d)) k = 'gd';
    else {
      const ni = c.p.findIndex(it => st.u.indexOf(it.u) < 0);
      if (ni >= 0) { k = 'gb'; ex = { b: c.p[ni].id, l: c.p[ni].l }; }
      else { const ui = cur.u.findIndex((u, i) => { const j = st.u.indexOf(u); return j >= 0 && cur.v[i] > num(st.v[j]); }); if (ui >= 0) ex = { b: c.p[ui].id, l: c.p[ui].l }; }
    }
    lgf(S, now, k, Object.assign({ a: dOut }, ex));
  }
  if (dIn > 0) lgf(S, now, 'gc', { a: dIn });
  if (dOut !== 0 || dIn !== 0 || cur.u.length !== st.u.length) S.stc = cur; else if (JSON.stringify(cur.v) !== JSON.stringify(st.v)) S.stc = cur;
}

/* ============ 2. СЛОВАРЬ ============ */
const DICT = {
  ru: {
    nav_stat: 'Статистика', more_stat: 'Подробно: во что вложено, ставки, когда и почему',
    st_h: 'Статистика', st_sub: 'Подробно: сколько вложено, во что, когда и почему так вышло',
    st_p_day: 'Сегодня', st_p_7d: '7 дней', st_p_30d: '30 дней', st_p_all: 'Всё время', st_per_aria: 'Период',
    st_empty_h: 'Пока считать нечего', st_empty_p: 'Сделайте первую сделку или ставку: здесь появятся вложения, результат по каждому разделу и причины.', st_empty_go: 'К рынку',
    st_inv_h: 'Куда вложены деньги', st_inv_now: 'Вложено сейчас', st_inv_note: 'Открытые сделки, ставки в игре и здания города.',
    st_inv_pos: 'Торговля (открытые сделки)', st_inv_bets: 'Прогнозы (ставки)', st_inv_city: 'Город (здания и районы)', st_inv_cash: 'Свободные деньги', st_inv_vault: 'Запас (в игре не участвует)',
    st_res_h: 'Результат за период', st_res_trade: 'Торговля', st_res_bets: 'Ставки', st_res_city: 'Доход города', st_res_total: 'Итого', st_res_of: 'от внесённого {x}',
    st_res_part: 'Доход города за этот период считается по журналу событий (он ведётся с 23.11); за всё время — точная сумма.',
    st_cv_h: 'Капитал во времени', st_cv_few: 'Мало данных: кривая появится после нескольких сделок.', st_cv_note: 'Точки на линии — самые крупные закрытые сделки периода.',
    st_tr_h: 'Торговля', st_tr_none: 'За период нет закрытых сделок.', st_tr_n: 'Сделок', st_tr_wl: 'Прибыльных / убыточных', st_tr_rate: 'Доля удачных', st_tr_avgw: 'Средняя прибыль', st_tr_avgl: 'Средний убыток',
    st_tr_best: 'Лучшая сделка', st_tr_worst: 'Худшая сделка', st_tr_turn: 'Оборот', st_tr_hold: 'Средний срок', st_tr_fees: 'Комиссии', st_tr_liq: 'Ликвидаций',
    st_g_cat: 'По видам рынка', st_g_side: 'По направлению', st_g_lev: 'По плечу', st_g_top: 'Топ активов по вложенному', st_g_topr: 'Топ активов по результату',
    st_c_n: 'Сделок', st_c_nb: 'Ставок', st_c_shareb: 'Доля угаданных', st_c_invb: 'Поставлено', st_c_share: 'Доля удачных', st_c_res: 'Результат', st_c_inv: 'Вложено', st_c_name: 'Что',
    st_side_up: 'На рост', st_side_dn: 'На падение', st_lev1: 'Без плеча ×1', st_lev25: 'Плечо ×2–5', st_lev6: 'Плечо выше ×5',
    st_bt_h: 'Ставки (прогнозы)', st_bt_none: 'За период нет сыгравших ставок.', st_bt_n: 'Сыграно', st_bt_wl: 'Выиграно / проиграно', st_bt_rate: 'Доля угаданных', st_bt_staked: 'Поставлено', st_bt_paid: 'Получено',
    st_bt_net: 'Результат', st_bt_avg: 'Средняя ставка', st_bt_max: 'Самая крупная', st_bt_run: 'Серия побед', st_bt_runv: 'лучшая {a}, сейчас {b}',
    st_bt_all: 'За всё время (по счётчикам): поставлено {s}, получено {p}, итог {n}.', st_bt_cap: 'В истории хранятся последние 60 ставок: разбивка ниже по ним.',
    st_bt_cat: 'По темам', st_bt_kind: 'Обычные и «Лайв»', st_bt_reg: 'Обычные', st_bt_live: 'Лайв', st_bt_open: 'Не сыграли', st_bt_openh: 'Под риском {x} · ставок: {n}', st_bt_openn: 'Незакрытых ставок нет.', st_bt_other: 'Без темы (старые)',
    st_ct_h: 'Город', st_ct_none: 'Здания ещё не куплены.', st_ct_out: 'Вложено в город', st_ct_in: 'Получено дохода', st_ct_rate: 'Доход в час сейчас', st_ct_back: 'Окупится', st_ct_back0: 'уже окупился', st_ct_backn: '—', st_ct_n: 'Зданий / районов',
    st_ct_top: 'Лучшие по отдаче', st_ct_row: 'ступень {l} · вложено {s} · {r}/ч', st_ct_back_h: '{x}',
    st_mo_h: 'В какой момент', st_mo_feed: 'Лента событий', st_f_all: 'Все', st_f_trade: 'Сделки', st_f_bet: 'Ставки', st_f_city: 'Город', st_f_money: 'Деньги', st_f_more: 'Показать ещё', st_f_none: 'За период событий нет.',
    st_f_old: 'Записи старше 23.11 восстановлены по сделкам и ставкам: сборы города и пополнения там не видны.',
    st_hm_h: 'Когда вы торгуете', st_hm_act: 'Активность', st_hm_res: 'Результат', st_hm_note: 'Строки — дни недели, столбцы — часы. Цвет: сколько действий / сколько заработано или потеряно.', st_hm_none: 'Мало данных для сетки.',
    st_wd: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'], st_hm_t: '{d}, {h}:00 · действий {n} · результат {r}',
    st_wy_h: 'Почему так вышло', st_wy_ins: 'Выводы по всей истории', st_wy_few: 'Мало данных: выводы появятся, когда в одной группе наберётся не меньше 5 случаев.', st_wy_list: 'Причина по каждому исходу', st_wy_none: 'Нет закрытых сделок и сыгравших ставок за период.',
    st_i_lev_bad: 'Больше всего вы теряете на сделках {g}: {x}, сделок {n}.', st_i_lev_good: 'Лучше всего получается {g}: {x}, сделок {n}.',
    st_i_hold_s: 'Сделки короче часа прибыльны в {w} из {n} случаев, итог {x}.', st_i_side_up: 'Сделки на рост удачнее: {a}% против {b}% на падение.', st_i_side_dn: 'Сделки на падение удачнее: {a}% против {b}% на рост.',
    st_i_cat_bad: 'Раздел «{c}» самый убыточный: {x} за {n} сделок.', st_i_cat_good: 'Раздел «{c}» приносит больше всего: {x} за {n} сделок.',
    st_i_imp: 'Сделки в спешке удачны в {a}% случаев, обычные — в {b}% (в спешке {n}).', st_i_fees: 'Комиссии забрали {x}, это {pc}% от всей прибыли.', st_i_liq: 'Ликвидаций {n}, они стоили {x}.',
    st_i_bet_live: 'Ставки на «Лайв» дают {x} от поставленного ({n} шт.).', st_i_bet_reg: 'Обычные ставки дают {x} от поставленного ({n} шт.).',
    st_g_l1: 'без плеча', st_g_l25: 'с плечом ×2–5', st_g_l6: 'с плечом выше ×5',
    st_w_win: 'Цена {dir} на {x}% за {dur}. Позиция {side}, плечо ×{l}: {roi} к залогу.', st_w_win1: 'Цена {dir} на {x}% за {dur}. Позиция {side}, без плеча: {roi} к залогу.',
    st_w_lose: 'Цена {dir} на {x}% за {dur}, а позиция {side}, плечо ×{l}: {roi} к залогу.', st_w_fee: 'Цена пошла в вашу сторону на {x}%, но комиссии съели прибыль: итог {roi}.',
    st_w_liq: 'Ликвидация: цена ушла на {x}% против позиции при плече ×{l}, залог потерян.', st_w_flat: 'Цена почти не сдвинулась, итог около нуля.',
    st_w_dir_up: 'выросла', st_w_dir_dn: 'упала', st_w_side_up: 'на рост', st_w_side_dn: 'на падение',
    st_b_win: 'Исход «{o}» сыграл: коэффициент ×{k}, получено {pay}.', st_b_lose: 'Не сыграл: итог не «{o}», ставка {a} потеряна.', st_b_void: 'Рынок закрыт без итога: ставка возвращена.',
    st_b_sold_up: 'Продана до итога: шанс вырос с {p0}% до {p1}%, итог {d}.', st_b_sold_dn: 'Продана до итога: шанс упал с {p0}% до {p1}%, итог {d}.',
    st_e_o: 'Сделка открыта: {s} {side}, ×{l}, залог {a}', st_e_c: 'Сделка закрыта: {s} {side}', st_e_cl: 'Ликвидация: {s} {side}',
    st_e_b: 'Ставка {a}: {q}', st_e_r: 'Ставка сыграла: {q}', st_e_rv: 'Ставка возвращена: {q}', st_e_rs: 'Ставка продана: {q}',
    st_e_gb: 'Куплено здание: {b}, {a}', st_e_gu: 'Улучшено здание: {b}, ступень {l}, {a}', st_e_gd: 'Открыт район, {a}', st_e_gc: 'Собран доход города', st_e_d: 'Пополнение из запаса',
    st_h_m: '{m} мин', st_h_h: '{h} ч {m} мин', st_h_d: '{d} д {h} ч', st_na: '—',
    tip_st_lev: 'Плечо умножает и прибыль, и убыток: при ×5 ход цены на 1% даёт 5% к залогу. Чем выше плечо, тем ближе ликвидация.',
    tip_st_turn: 'Сумма всех сделок с учётом плеча: залог × плечо. Показывает, сколько денег «прошло» через торговлю.',
    tip_st_rate: 'Доля закрытых сделок, которые принесли деньги после комиссий.', tip_st_back: 'Сколько времени нужно, чтобы здания вернули вложенное при нынешнем доходе в час.',
    tip_st_hm: 'Яркая клетка — в этот день недели и час было больше действий. В режиме «Результат» зелёный — заработано, красный — потеряно.'
  },
  en: {
    nav_stat: 'Statistics', more_stat: 'In detail: what is invested, bets, when and why',
    st_h: 'Statistics', st_sub: 'In detail: how much is invested, where, when and why it turned out so',
    st_p_day: 'Today', st_p_7d: '7 days', st_p_30d: '30 days', st_p_all: 'All time', st_per_aria: 'Period',
    st_empty_h: 'Nothing to count yet', st_empty_p: 'Make your first trade or bet: investments, results by section and reasons will appear here.', st_empty_go: 'To the market',
    st_inv_h: 'Where the money is', st_inv_now: 'Invested now', st_inv_note: 'Open trades, bets in play and city buildings.',
    st_inv_pos: 'Trading (open trades)', st_inv_bets: 'Forecasts (bets)', st_inv_city: 'City (buildings and districts)', st_inv_cash: 'Free money', st_inv_vault: 'Reserve (not in play)',
    st_res_h: 'Result for the period', st_res_trade: 'Trading', st_res_bets: 'Bets', st_res_city: 'City income', st_res_total: 'Total', st_res_of: 'of deposited {x}',
    st_res_part: 'City income for this period is counted from the event journal (kept since 23.11); for all time the sum is exact.',
    st_cv_h: 'Capital over time', st_cv_few: 'Not enough data: the curve appears after a few trades.', st_cv_note: 'Dots on the line are the largest closed trades of the period.',
    st_tr_h: 'Trading', st_tr_none: 'No closed trades in this period.', st_tr_n: 'Trades', st_tr_wl: 'Profit / loss', st_tr_rate: 'Winning share', st_tr_avgw: 'Average win', st_tr_avgl: 'Average loss',
    st_tr_best: 'Best trade', st_tr_worst: 'Worst trade', st_tr_turn: 'Turnover', st_tr_hold: 'Average hold', st_tr_fees: 'Fees', st_tr_liq: 'Liquidations',
    st_g_cat: 'By market section', st_g_side: 'By direction', st_g_lev: 'By leverage', st_g_top: 'Top assets by amount invested', st_g_topr: 'Top assets by result',
    st_c_n: 'Trades', st_c_nb: 'Bets', st_c_shareb: 'Won share', st_c_invb: 'Staked', st_c_share: 'Winning share', st_c_res: 'Result', st_c_inv: 'Invested', st_c_name: 'What',
    st_side_up: 'Long', st_side_dn: 'Short', st_lev1: 'No leverage ×1', st_lev25: 'Leverage ×2–5', st_lev6: 'Leverage above ×5',
    st_bt_h: 'Bets (forecasts)', st_bt_none: 'No settled bets in this period.', st_bt_n: 'Settled', st_bt_wl: 'Won / lost', st_bt_rate: 'Guessed share', st_bt_staked: 'Staked', st_bt_paid: 'Returned',
    st_bt_net: 'Result', st_bt_avg: 'Average bet', st_bt_max: 'Largest', st_bt_run: 'Winning streak', st_bt_runv: 'best {a}, now {b}',
    st_bt_all: 'All time (by counters): staked {s}, returned {p}, result {n}.', st_bt_cap: 'The history keeps the last 60 bets: the breakdown below uses them.',
    st_bt_cat: 'By topic', st_bt_kind: 'Regular and Live', st_bt_reg: 'Regular', st_bt_live: 'Live', st_bt_open: 'Not settled', st_bt_openh: 'At risk {x} · bets: {n}', st_bt_openn: 'No open bets.', st_bt_other: 'No topic (old)',
    st_ct_h: 'City', st_ct_none: 'No buildings bought yet.', st_ct_out: 'Put into the city', st_ct_in: 'Income received', st_ct_rate: 'Income per hour now', st_ct_back: 'Pays back in', st_ct_back0: 'already paid back', st_ct_backn: '—', st_ct_n: 'Buildings / districts',
    st_ct_top: 'Best by return', st_ct_row: 'step {l} · put in {s} · {r}/h', st_ct_back_h: '{x}',
    st_mo_h: 'At what moment', st_mo_feed: 'Event feed', st_f_all: 'All', st_f_trade: 'Trades', st_f_bet: 'Bets', st_f_city: 'City', st_f_money: 'Money', st_f_more: 'Show more', st_f_none: 'No events in this period.',
    st_f_old: 'Entries older than 23.11 are rebuilt from trades and bets: city collections and top-ups are not visible there.',
    st_hm_h: 'When you trade', st_hm_act: 'Activity', st_hm_res: 'Result', st_hm_note: 'Rows are weekdays, columns are hours. Colour: how many actions / how much was earned or lost.', st_hm_none: 'Not enough data for the grid.',
    st_wd: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], st_hm_t: '{d}, {h}:00 · actions {n} · result {r}',
    st_wy_h: 'Why it turned out so', st_wy_ins: 'Conclusions over the whole history', st_wy_few: 'Not enough data: conclusions appear once one group has at least 5 cases.', st_wy_list: 'Reason for each outcome', st_wy_none: 'No closed trades or settled bets in this period.',
    st_i_lev_bad: 'You lose the most on trades {g}: {x}, trades {n}.', st_i_lev_good: 'It works best {g}: {x}, trades {n}.',
    st_i_hold_s: 'Trades shorter than an hour made money in {w} of {n} cases, result {x}.', st_i_side_up: 'Long trades work better: {a}% against {b}% for short.', st_i_side_dn: 'Short trades work better: {a}% against {b}% for long.',
    st_i_cat_bad: '“{c}” is the most losing section: {x} over {n} trades.', st_i_cat_good: '“{c}” brings the most: {x} over {n} trades.',
    st_i_imp: 'Hurried trades win in {a}% of cases, ordinary ones in {b}% ({n} hurried).', st_i_fees: 'Fees took {x}, that is {pc}% of all profit.', st_i_liq: 'Liquidations: {n}, they cost {x}.',
    st_i_bet_live: 'Live bets return {x} of the amount staked ({n} bets).', st_i_bet_reg: 'Regular bets return {x} of the amount staked ({n} bets).',
    st_g_l1: 'without leverage', st_g_l25: 'with leverage ×2–5', st_g_l6: 'with leverage above ×5',
    st_w_win: 'Price {dir} {x}% in {dur}. Position {side}, leverage ×{l}: {roi} on the margin.', st_w_win1: 'Price {dir} {x}% in {dur}. Position {side}, no leverage: {roi} on the margin.',
    st_w_lose: 'Price {dir} {x}% in {dur}, and the position was {side}, leverage ×{l}: {roi} on the margin.', st_w_fee: 'Price moved your way by {x}%, but fees ate the profit: result {roi}.',
    st_w_liq: 'Liquidation: price went {x}% against the position at leverage ×{l}, the margin is lost.', st_w_flat: 'Price barely moved, the result is about zero.',
    st_w_dir_up: 'rose', st_w_dir_dn: 'fell', st_w_side_up: 'long', st_w_side_dn: 'short',
    st_b_win: 'Outcome “{o}” came true: odds ×{k}, received {pay}.', st_b_lose: 'Did not come true: the result was not “{o}”, the {a} stake is lost.', st_b_void: 'Market closed without a result: the stake is returned.',
    st_b_sold_up: 'Sold before the result: the chance rose from {p0}% to {p1}%, result {d}.', st_b_sold_dn: 'Sold before the result: the chance fell from {p0}% to {p1}%, result {d}.',
    st_e_o: 'Trade opened: {s} {side}, ×{l}, margin {a}', st_e_c: 'Trade closed: {s} {side}', st_e_cl: 'Liquidation: {s} {side}',
    st_e_b: 'Bet {a}: {q}', st_e_r: 'Bet settled: {q}', st_e_rv: 'Bet returned: {q}', st_e_rs: 'Bet sold: {q}',
    st_e_gb: 'Building bought: {b}, {a}', st_e_gu: 'Building upgraded: {b}, step {l}, {a}', st_e_gd: 'District opened, {a}', st_e_gc: 'City income collected', st_e_d: 'Top-up from the reserve',
    st_h_m: '{m} min', st_h_h: '{h} h {m} min', st_h_d: '{d} d {h} h', st_na: '—',
    tip_st_lev: 'Leverage multiplies both profit and loss: at ×5 a 1% price move gives 5% on the margin. The higher the leverage, the closer the liquidation.',
    tip_st_turn: 'The sum of all trades with leverage: margin × leverage. Shows how much money has passed through trading.',
    tip_st_rate: 'The share of closed trades that made money after fees.', tip_st_back: 'How long the buildings need to return what was put in at the current income per hour.',
    tip_st_hm: 'A bright cell means more actions at that weekday and hour. In “Result” mode green is earned, red is lost.'
  }
};

/* ============ 3. ЭКРАН ============ */
let H = null;
const out = { calc, feed, whyTrade, whyBet, insights, onSave: S => { if (H && H.E && H.E.lg) onSave0(S, H.E.lg, Date.now()); }, onSave0, sinceOf, MIN_N, dict: DICT };
root.DofaStat = out;
if (typeof module !== 'undefined' && module.exports) { module.exports = out; }
if (typeof document === 'undefined') return;

const U = { per: 'all', filt: 'all', fn: 30, wn: 20, hm: 'act' };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lang = () => (H && H.lang() === 'en' ? 'en' : 'ru');
const T = k => (DICT[lang()][k] != null ? DICT[lang()][k] : (DICT.ru[k] != null ? DICT.ru[k] : k));
const TF = (k, o) => String(T(k)).replace(/\{(\w+)\}/g, (m, a) => (o && o[a] != null ? o[a] : ''));
const money = (v, d) => (H ? H.money(v, d) : '$' + v);
const sgn = (v, d) => (v > 0 ? '+' : '') + money(v, d);
const pcs = v => (v == null || !isFinite(v) ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(Math.abs(v) >= 100 ? 0 : 1) + '%');
const cls = v => (v > 0 ? 'up' : v < 0 ? 'down' : '');
const p2 = n => (n < 10 ? '0' : '') + n;
const stamp = ms => { const d = new Date(ms); return p2(d.getDate()) + '.' + p2(d.getMonth() + 1) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()); };
function dur(ms) {
  if (ms == null || !isFinite(ms)) return T('st_na'); const m = Math.max(1, Math.round(ms / 6e4));
  if (m < 60) return TF('st_h_m', { m: m }); if (m < 1440) return TF('st_h_h', { h: Math.floor(m / 60), m: m % 60 }); return TF('st_h_d', { d: Math.floor(m / 1440), h: Math.floor(m % 1440 / 60) });
}
const catName = id => { const c = H && H.E.CAT && H.E.CAT[id]; return c ? c[lang()] : (id === '?' ? T('st_na') : id); };
const symName = s => { const I = H && H.INS[s]; return I ? (I[lang()] || s) : s; };
const bName = id => { const G = root.DofaGorod; return G && G.BY[id] ? G.BY[id][lang()] : (id || ''); };
const ctx = () => ({ INS: H.INS, G: root.DofaGorod, result: H.result() });
const qm = k => (H && H.qm ? H.qm(k) : '');
const betCatName = c => { if (!c || c === '?') return T('st_bt_other'); const k = /^sp_/.test(c) ? c : 'bc_' + c; return H.t(k) !== k ? H.t(k) : c; };

const dc = v => (lang() === 'ru' ? String(v).replace('.', ',') : String(v));
function whyText(w) {
  const dir = T(w.up ? 'st_w_dir_up' : 'st_w_dir_dn'), side = T(w.side === -1 ? 'st_w_side_dn' : 'st_w_side_up'), x = dc(w.mv.toFixed(w.mv >= 10 ? 1 : 2)), d = dur(w.hold), roi = pcs(w.roi);
  switch (w.code) {
    case 'liq': return TF('st_w_liq', { x: dc(Math.abs(w.fav).toFixed(1)), l: w.lev });
    case 'win': case 'lose': return TF(w.lev > 1 ? (w.code === 'win' ? 'st_w_win' : 'st_w_lose') : (w.code === 'win' ? 'st_w_win1' : 'st_w_lose'), { dir: dir, x: x, dur: d, side: side, l: w.lev, roi: roi });
    case 'fee': return TF('st_w_fee', { x: dc(Math.abs(w.fav).toFixed(2)), roi: roi });
    default: return T('st_w_flat');
  }
}
function whyBetText(w) {
  const o = w.o || '', k = w.k ? (w.k >= 10 ? w.k.toFixed(1) : w.k.toFixed(2)) : '—';
  switch (w.code) {
    case 'win': return TF('st_b_win', { o: esc(o), k: k, pay: money(w.pay) });
    case 'lose': return TF('st_b_lose', { o: esc(o), a: money(w.a) });
    case 'sold_up': case 'sold_dn': return TF(w.code === 'sold_up' ? 'st_b_sold_up' : 'st_b_sold_dn', { p0: Math.round(w.p * 100), p1: w.p1 != null ? Math.round(w.p1 * 100) : '—', d: sgn(w.d) });
    default: return T('st_b_void');
  }
}
function evText(e) {
  const side = e.d === -1 ? T('st_w_side_dn') : T('st_w_side_up');
  switch (e.k) {
    case 'o': return TF('st_e_o', { s: esc(symName(e.s)), side: side, l: e.l, a: money(e.a) });
    case 'c': return TF(e.x ? 'st_e_cl' : 'st_e_c', { s: esc(symName(e.s)), side: side, n: sgn(e.n) });
    case 'b': return TF('st_e_b', { a: money(e.a), q: esc(e.q) });
    case 'r': { const d = num(e.v) - num(e.a); return TF(e.h === 'void' ? 'st_e_rv' : e.h === 'sold' ? 'st_e_rs' : 'st_e_r', { q: esc(e.q), d: sgn(r2(d)) }); }
    case 'gb': return TF('st_e_gb', { b: esc(bName(e.b)), a: money(e.a) });
    case 'gu': return TF('st_e_gu', { b: esc(bName(e.b)), l: e.l || '', a: money(e.a) });
    case 'gd': return TF('st_e_gd', { a: money(e.a) });
    case 'gc': return TF('st_e_gc', { a: sgn(e.a) });
    case 'd': return TF('st_e_d', { a: sgn(e.a) });
    default: return '';
  }
}
const evVal = e => (e.k === 'c' ? e.n : e.k === 'r' ? num(e.v) - num(e.a) : e.k === 'gc' || e.k === 'd' ? e.a : null);
const evTone = e => (e.k === 'c' || e.k === 'r' ? 'trade' : e.k === 'b' || e.k === 'o' ? 'open' : e.k === 'd' ? 'money' : 'city');

/* ---------- куски разметки ---------- */
function tile(l, v, c, sub) { return '<div class="st-tile"><span class="lbl">' + l + '</span><b class="num ' + (c || '') + '">' + v + '</b>' + (sub ? '<small class="num">' + sub + '</small>' : '') + '</div>'; }
function table(rows, head) {
  return '<div class="st-scroll"><table class="st-tb"><thead><tr>' + head.map((h, i) => '<th' + (i ? ' class="r"' : '') + '>' + h + '</th>').join('') + '</tr></thead><tbody>' +
    rows.map(r => '<tr>' + r.map((c, i) => '<td' + (i ? ' class="r num ' + (c && c.c ? c.c : '') + '"' : '') + '>' + (c && c.v != null ? c.v : c) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
}
const rate = g => (g.n ? Math.round(g.w / g.n * 100) + '%' : '—');
function gTable(map, nameOf, withInv, nKey) {
  const keys = Object.keys(map).filter(k => map[k].n > 0).sort((a, b) => map[b].margin - map[a].margin); if (!keys.length) return '';
  return table(keys.map(k => [esc(nameOf(k)), String(map[k].n), rate(map[k]), { v: sgn(map[k].net), c: cls(map[k].net) }].concat(withInv ? [money(map[k].margin, 0)] : [])),
    [T('st_c_name'), T(nKey || 'st_c_n'), T('st_c_share'), T(nKey ? 'st_c_shareb' : 'st_c_share'), T('st_c_res')].filter((v, i) => i !== (nKey ? 2 : 3)).concat(withInv ? [T(nKey ? 'st_c_invb' : 'st_c_inv')] : []));
}
function card(id, h, body, extra) { return '<section class="st-card" id="' + id + '"><div class="st-hd"><h2 class="st-h2">' + h + '</h2>' + (extra || '') + '</div>' + body + '</section>'; }

function secSummary(d) {
  const v = d.inv, tot = v.total + v.cash || 1, seg = (x, c) => (x > 0 ? '<i class="' + c + '" style="flex:' + (x / tot).toFixed(4) + '"></i>' : '');
  const row = (c, l, x, ex) => '<li><i class="st-dot ' + c + '"></i><span>' + l + (ex ? ' <em class="num">' + ex + '</em>' : '') + '</span><b class="num">' + money(x) + '</b></li>';
  const R = d.res, base = v.base, pc = x => (base > 0 ? pcs(x / base * 100) : '—');
  const rt = (l, x) => '<div class="st-rt"><span>' + l + '</span><b class="num ' + cls(x) + '">' + sgn(x) + '</b><small class="num ' + cls(x) + '">' + pc(x) + '</small></div>';
  return card('stSum', T('st_inv_h'),
    '<div class="st-big"><span class="lbl">' + T('st_inv_now') + '</span><b class="num">' + money(v.total) + '</b><small>' + T('st_inv_note') + '</small></div>' +
    '<div class="st-bar" aria-hidden="true">' + seg(v.pos, 'c1') + seg(v.bets, 'c2') + seg(v.city, 'c3') + seg(v.cash, 'c4') + '</div>' +
    '<ul class="st-ls">' + row('c1', T('st_inv_pos'), v.pos, v.posN ? v.posN + '' : '') + row('c2', T('st_inv_bets'), v.bets, v.betsN ? v.betsN + '' : '') + row('c3', T('st_inv_city'), v.city) + row('c4', T('st_inv_cash'), v.cash) + row('c5', T('st_inv_vault'), v.vault) + '</ul>' +
    '<h3 class="st-h3">' + T('st_res_h') + (base > 0 ? ' <span class="st-of num">' + TF('st_res_of', { x: money(base, 0) }) + '</span>' : '') + '</h3>' +
    '<div class="st-rts">' + rt(T('st_res_trade'), R.trade) + rt(T('st_res_bets'), R.bets) + rt(T('st_res_city'), R.city) + '<div class="st-rt tot"><span>' + T('st_res_total') + '</span><b class="num ' + cls(R.total) + '">' + sgn(R.total) + '</b><small class="num ' + cls(R.total) + '">' + pc(R.total) + '</small></div></div>' +
    (R.partial ? '<p class="st-note">' + T('st_res_part') + '</p>' : ''));
}
function chart(d) {
  const p = d.curve; if (p.length < 2) return '<p class="st-note">' + T('st_cv_few') + '</p>';
  const W = 640, Hh = 210, pd = 10, t0 = p[0][0], t1 = p[p.length - 1][0] || t0 + 1; let lo = Infinity, hi = -Infinity; p.forEach(q => { lo = Math.min(lo, q[1]); hi = Math.max(hi, q[1]); }); lo = Math.min(lo, 0); hi = Math.max(hi, 0); if (hi - lo < 1) { hi += 1; lo -= 1; }
  const X = t => pd + (t1 > t0 ? (t - t0) / (t1 - t0) : 0) * (W - 2 * pd), Y = v => pd + (hi - v) / (hi - lo) * (Hh - 2 * pd), z = Y(0);
  const pts = p.map(q => X(q[0]).toFixed(1) + ',' + Y(q[1]).toFixed(1)), last = p[p.length - 1][1];
  const area = 'M' + X(t0).toFixed(1) + ',' + z.toFixed(1) + ' L' + pts.join(' L') + ' L' + X(t1).toFixed(1) + ',' + z.toFixed(1) + ' Z';
  const dots = d.marks.filter(m => m.t >= t0 && m.t <= t1).map(m => { let y = p[0][1]; for (let i = 0; i < p.length; i++) { if (p[i][0] <= m.t) y = p[i][1]; } return '<circle cx="' + X(m.t).toFixed(1) + '" cy="' + Y(y).toFixed(1) + '" r="4.5" class="' + (m.v >= 0 ? 'mu' : 'md') + '"><title>' + esc(symName(m.sym)) + ' ' + sgn(m.v) + ' · ' + stamp(m.t) + '</title></circle>'; }).join('');
  const col = last >= 0 ? 'u' : 'd';
  return '<div class="st-chart"><svg viewBox="0 0 ' + W + ' ' + Hh + '" preserveAspectRatio="none" role="img" aria-label="' + T('st_cv_h') + '"><line x1="0" x2="' + W + '" y1="' + z.toFixed(1) + '" y2="' + z.toFixed(1) + '" class="z"/><path d="' + area + '" class="a ' + col + '"/><polyline points="' + pts.join(' ') + '" class="l ' + col + '"/>' + dots + '</svg>' +
    '<div class="st-ax num"><span>' + stamp(t0) + '</span><span class="' + cls(last) + '">' + sgn(last) + '</span><span>' + stamp(t1) + '</span></div></div><p class="st-note">' + T('st_cv_note') + '</p>';
}
function secTrade(d) {
  const g = d.trade; if (!g.n) return card('stTr', T('st_tr_h'), '<p class="st-note">' + T('st_tr_none') + '</p>');
  const nm = x => (x ? esc(symName(x.sym)) + ' ' + sgn(x.net) : '—');
  const sideMap = { up: g.bySide.up, down: g.bySide.down }, levMap = g.byLev;
  return card('stTr', T('st_tr_h'),
    '<div class="st-tiles">' + tile(T('st_tr_n'), g.n) + tile(T('st_tr_wl'), g.w + ' / ' + g.l) + tile(T('st_tr_rate') + qm('tip_st_rate'), g.rate == null ? '—' : Math.round(g.rate * 100) + '%') +
    tile(T('st_tr_avgw'), g.avgW == null ? '—' : sgn(g.avgW), 'up') + tile(T('st_tr_avgl'), g.avgL == null ? '—' : sgn(g.avgL), 'down') + tile(T('st_tr_best'), nm(g.best), 'up') + tile(T('st_tr_worst'), nm(g.worst), 'down') +
    tile(T('st_tr_turn') + qm('tip_st_turn'), money(g.turn, 0)) + tile(T('st_tr_hold'), g.avgHold == null ? '—' : dur(g.avgHold)) + tile(T('st_tr_fees'), money(g.fees)) + tile(T('st_tr_liq'), g.liq) + tile(T('st_res_trade'), sgn(g.net), cls(g.net)) + '</div>' +
    '<h3 class="st-h3">' + T('st_g_cat') + '</h3>' + gTable(g.byCat, catName, true) +
    '<h3 class="st-h3">' + T('st_g_side') + '</h3>' + gTable({ up: sideMap.up, dn: sideMap.down }, k => T(k === 'up' ? 'st_side_up' : 'st_side_dn'), true) +
    '<h3 class="st-h3">' + T('st_g_lev') + qm('tip_st_lev') + '</h3>' + gTable(levMap, k => T('st_lev' + k.slice(1)), true) +
    '<h3 class="st-h3">' + T('st_g_top') + '</h3>' + table(g.topInv.map(r => [esc(symName(r.k)), String(r.n), rate(r), { v: sgn(r.net), c: cls(r.net) }, money(r.margin, 0)]), [T('st_c_name'), T('st_c_n'), T('st_c_share'), T('st_c_res'), T('st_c_inv')]) +
    '<h3 class="st-h3">' + T('st_g_topr') + '</h3>' + table(g.topRes.map(r => [esc(symName(r.k)), String(r.n), rate(r), { v: sgn(r.net), c: cls(r.net) }, money(r.margin, 0)]), [T('st_c_name'), T('st_c_n'), T('st_c_share'), T('st_c_res'), T('st_c_inv')]));
}
function secBets(d) {
  const b = d.bets, hasAny = b.n || b.openN || b.agg.n;
  let body = '';
  if (!b.n) body += '<p class="st-note">' + T('st_bt_none') + '</p>';
  else body += '<div class="st-tiles">' + tile(T('st_bt_n'), b.n) + tile(T('st_bt_wl'), b.w + ' / ' + b.l) + tile(T('st_bt_rate'), b.rate == null ? '—' : Math.round(b.rate * 100) + '%') + tile(T('st_bt_staked'), money(b.staked)) + tile(T('st_bt_paid'), money(b.paid)) +
    tile(T('st_bt_net'), sgn(b.net), cls(b.net)) + tile(T('st_bt_avg'), b.avg == null ? '—' : money(b.avg)) + tile(T('st_bt_max'), money(b.max)) + tile(T('st_bt_run'), TF('st_bt_runv', { a: b.bestRun, b: b.curRun })) + '</div>' +
    '<h3 class="st-h3">' + T('st_bt_cat') + '</h3>' + gTable(b.byC, betCatName, true, 'st_c_nb') +
    '<h3 class="st-h3">' + T('st_bt_kind') + '</h3>' + gTable({ reg: b.reg, live: b.live }, k => T(k === 'live' ? 'st_bt_live' : 'st_bt_reg'), true, 'st_c_nb');
  if (d.per === 'all' && b.agg.n) body += '<p class="st-note">' + TF('st_bt_all', { s: money(b.agg.staked), p: money(b.agg.paid), n: sgn(b.agg.net) }) + (b.histCap ? ' ' + T('st_bt_cap') : '') + '</p>';
  body += '<h3 class="st-h3">' + T('st_bt_open') + '</h3>';
  body += b.openN ? '<p class="st-note num">' + TF('st_bt_openh', { x: money(b.openSum), n: b.openN }) + '</p><ul class="st-open">' + b.open.map(o => '<li><span>' + esc(o.q) + '<em>' + esc(o.o) + ' · ' + stamp(o.at) + '</em></span><b class="num">' + money(o.a) + '</b></li>').join('') + '</ul>' : '<p class="st-note">' + T('st_bt_openn') + '</p>';
  return card('stBt', T('st_bt_h'), hasAny ? body : '<p class="st-note">' + T('st_bt_none') + '</p>');
}
function secCity(d) {
  const c = d.city; if (!(c.out > 0) && !(c.inAll > 0)) return card('stCt', T('st_ct_h'), '<p class="st-note">' + T('st_ct_none') + '</p>');
  const back = c.payback == null ? T('st_ct_backn') : c.payback <= 0 ? T('st_ct_back0') : dur(c.payback * HOUR);
  return card('stCt', T('st_ct_h'),
    '<div class="st-tiles">' + tile(T('st_ct_out'), money(c.out, 0)) + tile(T('st_ct_in'), money(d.per === 'all' ? c.inAll : c.inP, 0), 'up') + tile(T('st_ct_rate'), c.rate == null ? '—' : money(c.rate, 0)) + tile(T('st_ct_back') + qm('tip_st_back'), back) + tile(T('st_ct_n'), c.n + ' / ' + c.dist) + '</div>' +
    (c.top.length ? '<h3 class="st-h3">' + T('st_ct_top') + '</h3><ul class="st-open">' + c.top.map(r => '<li><span>' + esc(bName(r.id)) + '<em class="num">' + TF('st_ct_row', { l: r.l, s: money(r.spent, 0), r: money(r.rate, 0) }) + '</em></span><b class="num">' + dur(r.back * HOUR) + '</b></li>').join('') + '</ul>' : ''));
}
function feedHtml(d) {
  const all = out.feed(H.S(), H.now(), U.per, U.filt), list = all.slice(0, U.fn); if (!list.length) return '<p class="st-note">' + T('st_f_none') + '</p>';
  const hasOld = all.some(e => e.old);
  return '<ul class="st-feed">' + list.map(e => { const v = evVal(e); return '<li class="' + evTone(e) + '"><time class="num">' + stamp(e.t) + '</time><span>' + evText(e) + '</span>' + (v != null ? '<b class="num ' + cls(v) + '">' + sgn(v) + '</b>' : '') + '</li>'; }).join('') + '</ul>' +
    (all.length > list.length ? '<button class="btn-ghost st-more" type="button" data-stf="more">' + T('st_f_more') + ' · ' + (all.length - list.length) + '</button>' : '') + (hasOld ? '<p class="st-note">' + T('st_f_old') + '</p>' : '');
}
function heatHtml(d) {
  const g = d.grid; if (!g.n) return '<p class="st-note">' + T('st_hm_none') + '</p>';
  const A = U.hm === 'act'; let h = '<div class="st-scroll"><div class="st-hm" role="img" aria-label="' + T('st_hm_h') + '"><span></span>';
  for (let i = 0; i < 24; i++) h += '<em class="num">' + (i % 3 === 0 ? i : '') + '</em>';
  for (let w = 0; w < 7; w++) {
    h += '<b>' + T('st_wd')[w] + '</b>';
    for (let i = 0; i < 24; i++) {
      const a = g.act[w][i], r = g.res[w][i]; let st = '';
      if (A) { if (a) st = 'background:rgba(var(--acc),' + (0.18 + 0.82 * a / g.max).toFixed(2) + ')'; }
      else if (r) st = 'background:rgba(var(' + (r > 0 ? '--upc' : '--dnc') + '),' + (0.2 + 0.8 * Math.abs(r) / (g.maxR || 1)).toFixed(2) + ')';
      h += '<i style="' + st + '" title="' + esc(TF('st_hm_t', { d: T('st_wd')[w], h: i, n: a, r: sgn(r) })) + '"></i>';
    }
  }
  return h + '</div></div><p class="st-note">' + T('st_hm_note') + '</p>';
}
function secMoment(d) {
  const F = ['all', 'trade', 'bet', 'city', 'money'];
  return card('stMo', T('st_mo_h'),
    '<h3 class="st-h3">' + T('st_mo_feed') + '</h3><div class="st-chips" role="group">' + F.map(f => '<button type="button" class="chip' + (U.filt === f ? ' on' : '') + '" data-stf="' + f + '">' + T('st_f_' + f) + '</button>').join('') + '</div><div id="stFeed">' + feedHtml(d) + '</div>' +
    '<h3 class="st-h3">' + T('st_hm_h') + qm('tip_st_hm') + '</h3><div class="st-chips" role="group">' + ['act', 'res'].map(f => '<button type="button" class="chip' + (U.hm === f ? ' on' : '') + '" data-sth="' + f + '">' + T('st_hm_' + f) + '</button>').join('') + '</div><div id="stHeat">' + heatHtml(d) + '</div>');
}
function insText(i) {
  const p = Object.assign({}, i.p);
  if (p.g) p.g = T('st_g_' + (p.g === 'x1' ? 'l1' : p.g === 'x25' ? 'l25' : 'l6'));
  if (p.c) p.c = catName(p.c);
  ['x'].forEach(k => { if (p[k] != null) p[k] = /^(bet_)/.test(i.id) ? pcs(p[k]) : money(p[k]); });
  if (i.id === 'hold_s') p.x = sgn(i.p.x);
  return TF('st_i_' + i.id, p);
}
function whyHtml() {
  const S = H.S(), since = out.sinceOf(U.per, H.now()), items = [];
  (S.trades || []).forEach(x => { if (x && x.t >= since) items.push({ t: x.t, tr: x }); });
  (S.betHist || []).forEach(x => { if (x && x.at >= since) items.push({ t: x.at, bt: x }); });
  items.sort((a, b) => b.t - a.t); if (!items.length) return '<p class="st-note">' + T('st_wy_none') + '</p>';
  const list = items.slice(0, U.wn);
  return '<ul class="st-why">' + list.map(it => {
    if (it.tr) { const x = it.tr, w = out.whyTrade(x); return '<li class="' + (x.net > 0 ? 'win' : x.net < 0 ? 'lose' : '') + '"><div class="h"><b>' + esc(symName(x.sym)) + '</b> <span>' + T(x.side === -1 ? 'st_w_side_dn' : 'st_w_side_up') + ' ×' + (x.lev || 1) + '</span><time class="num">' + stamp(x.t) + '</time><b class="num ' + cls(x.net) + '">' + sgn(x.net) + '</b></div><p>' + whyText(w) + '</p></li>'; }
    const x = it.bt, w = out.whyBet(x); return '<li class="' + (w.d > 0 ? 'win' : w.d < 0 ? 'lose' : '') + '"><div class="h"><b>' + esc(x.q) + '</b><time class="num">' + stamp(x.at) + '</time><b class="num ' + cls(w.d) + '">' + sgn(r2(w.d)) + '</b></div><p>' + whyBetText(w) + '</p></li>';
  }).join('') + '</ul>' + (items.length > list.length ? '<button class="btn-ghost st-more" type="button" data-stw="more">' + T('st_f_more') + ' · ' + (items.length - list.length) + '</button>' : '');
}
function secWhy() {
  const ins = out.insights(H.S(), ctx(), H.now());
  return card('stWy', T('st_wy_h'),
    '<h3 class="st-h3">' + T('st_wy_ins') + '</h3>' + (ins.length ? '<ul class="st-ins">' + ins.map(i => '<li>' + insText(i) + '</li>').join('') + '</ul>' : '<p class="st-note">' + T('st_wy_few') + '</p>') +
    '<h3 class="st-h3">' + T('st_wy_list') + '</h3><div id="stWhy">' + whyHtml() + '</div>');
}

function render(box) {
  if (!box || !H) return; U.box = box;
  const d = out.calc(H.S(), H.now(), U.per, ctx());
  const head = '<div class="vhead"><h1>' + T('st_h') + '</h1><p class="st-sub">' + T('st_sub') + '</p></div>';
  if (d.empty) { box.innerHTML = head + '<div class="st-card st-empty"><h2 class="st-h2">' + T('st_empty_h') + '</h2><p>' + T('st_empty_p') + '</p><a class="btn-gold" href="#market">' + T('st_empty_go') + '</a></div>'; bind(box); return; }
  const per = '<div class="st-per" role="group" aria-label="' + T('st_per_aria') + '">' + PERS.map(p => '<button type="button" class="chip' + (U.per === p ? ' on' : '') + '" data-stp="' + p + '" aria-pressed="' + (U.per === p) + '">' + T('st_p_' + p) + '</button>').join('') + '</div>';
  box.innerHTML = head + per + secSummary(d) + card('stCv', T('st_cv_h'), chart(d)) + secTrade(d) + secBets(d) + secCity(d) + secMoment(d) + secWhy();
  bind(box);
}
function bind(box) {
  if (box.__st) return; box.__st = 1;
  box.addEventListener('click', e => {
    const b = e.target && e.target.closest ? e.target.closest('[data-stp],[data-stf],[data-sth],[data-stw]') : null; if (!b) return;
    if (b.hasAttribute('data-stp')) { U.per = b.getAttribute('data-stp'); U.fn = 30; U.wn = 20; render(box); return; }
    if (b.hasAttribute('data-stf')) { const v = b.getAttribute('data-stf'); if (v === 'more') U.fn += 30; else { U.filt = v; U.fn = 30; } renderPart(); box.querySelectorAll('[data-stf]').forEach(x => { if (x.classList.contains('chip')) x.classList.toggle('on', x.getAttribute('data-stf') === U.filt); }); return; }
    if (b.hasAttribute('data-sth')) { U.hm = b.getAttribute('data-sth'); renderPart(); box.querySelectorAll('[data-sth]').forEach(x => x.classList.toggle('on', x.getAttribute('data-sth') === U.hm)); return; }
    if (b.hasAttribute('data-stw')) { U.wn += 20; renderPart(); }
  });
}
function renderPart() {
  const box = U.box; if (!box || !H) return; const d = out.calc(H.S(), H.now(), U.per, ctx());
  const a = box.querySelector('#stFeed'), b = box.querySelector('#stHeat'), c = box.querySelector('#stWhy');
  if (a) a.innerHTML = feedHtml(d); if (b) b.innerHTML = heatHtml(d); if (c) c.innerHTML = whyHtml();
}
function init(h) { H = h; H.t = H.t || (k => k); }
out.init = init; out.render = render;
document.addEventListener('dofa-lang', () => { if (U.box && H && !U.box.closest('[hidden]')) render(U.box); });
})(typeof window !== 'undefined' ? window : globalThis);
