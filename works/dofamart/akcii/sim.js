/* dofamart · Акции — trading simulator.
   Play money only. Quotes: real where a keyless source exists, otherwise delayed file or model.
   Nothing about the user is ever sent anywhere; state lives in localStorage. */
(function () {
'use strict';

/* =====================================================================
   1. ENGINE (pure logic, no DOM — also loaded by node for tests)
   ===================================================================== */
const KEY = 'dofa_sim_v1';
const FEE = 0.001;                 // 0.1% of position size, on open and on close
const LEVS = [1, 2, 5, 10];
const CAP_S = 86400;               // offline fast-forward cap, seconds
const FINE_N = 300, COARSE_N = 240, DAY_N = 24;   // 1 s, 1 min, 1 h history lengths
const JUMP_S = 1200;               // mean seconds between "news jumps" in model mode
const BENCH = 'SPX';
const LIVE_MS = { bn: 45e3, cg: 150e3 };          // a direct quote older than this is no longer "live"
const FX_MAX = 3 * 864e5, FILE_MAX = 4 * 864e5;   // daily rate / quotes.json older than this -> model

const CATS = [
  { id: 'crypto', ru: 'Криптовалюты', en: 'Crypto', vol: 3.5e-4, lead: 'BTC' },
  { id: 'stocks', ru: 'Акции', en: 'Stocks', vol: 1.6e-4, lead: 'NVDA' },
  { id: 'metals', ru: 'Металлы', en: 'Metals', vol: 1.2e-4, lead: 'XAU' },
  { id: 'forex', ru: 'Валюты', en: 'Forex', vol: 4e-5, lead: 'EURUSD' },
  { id: 'commod', ru: 'Сырьё', en: 'Commodities', vol: 2e-4, lead: 'BRENT' },
  { id: 'index', ru: 'Индексы и фонды', en: 'Indices & funds', vol: 1e-4, lead: 'SPX' }
];
const CAT = {}; CATS.forEach(c => { CAT[c.id] = c; });

// sym -> instrument. base = last-resort price used only until any real quote arrives.
const INS = {};
function def(cat, rows) {
  rows.forEach(r => {
    const o = r[4] || {};
    INS[r[0]] = { sym: r[0], cat: cat, ru: r[1], en: r[2], base: r[3], tk: o.tk || r[0],
      vol: CAT[cat].vol * (o.vm || 1), plain: !!o.plain, bn: o.bn || null, cg: o.cg || null, fx: o.fx || null, proxy: o.proxy || null };
  });
}
def('crypto', [
  ['BTC', 'Биткоин', 'Bitcoin', 68400, { bn: 'BTCUSDT', cg: 'bitcoin' }],
  ['ETH', 'Эфириум', 'Ethereum', 3520, { bn: 'ETHUSDT', cg: 'ethereum' }],
  ['SOL', 'Солана', 'Solana', 162, { bn: 'SOLUSDT', cg: 'solana', vm: 1.2 }],
  ['TON', 'Тонкоин', 'Toncoin', 5.4, { bn: 'TONUSDT', cg: 'the-open-network', vm: 1.2 }],
  ['BNB', 'BNB', 'BNB', 590, { bn: 'BNBUSDT', cg: 'binancecoin' }],
  ['XRP', 'XRP', 'XRP', 0.62, { bn: 'XRPUSDT', cg: 'ripple', vm: 1.2 }],
  ['DOGE', 'Догикоин', 'Dogecoin', 0.158, { bn: 'DOGEUSDT', cg: 'dogecoin', vm: 1.5 }],
  ['ADA', 'Кардано', 'Cardano', 0.46, { bn: 'ADAUSDT', cg: 'cardano', vm: 1.3 }],
  ['AVAX', 'Аваланч', 'Avalanche', 34.5, { bn: 'AVAXUSDT', cg: 'avalanche-2', vm: 1.3 }],
  ['LINK', 'Чейнлинк', 'Chainlink', 15.2, { bn: 'LINKUSDT', cg: 'chainlink', vm: 1.3 }]
]);
def('stocks', [
  ['AAPL', 'Apple', 'Apple', 228], ['NVDA', 'Nvidia', 'Nvidia', 135, { vm: 1.6 }],
  ['TSLA', 'Tesla', 'Tesla', 248, { vm: 1.8 }], ['MSFT', 'Microsoft', 'Microsoft', 428],
  ['AMZN', 'Amazon', 'Amazon', 196], ['GOOGL', 'Alphabet', 'Alphabet', 172],
  ['META', 'Meta', 'Meta', 565, { vm: 1.2 }], ['NFLX', 'Netflix', 'Netflix', 705, { vm: 1.2 }],
  ['AMD', 'AMD', 'AMD', 158, { vm: 1.6 }], ['KO', 'Coca-Cola', 'Coca-Cola', 64, { vm: 0.6 }]
]);
def('metals', [
  ['XAU', 'Золото, унция', 'Gold, oz', 2650, { bn: 'PAXGUSDT', cg: 'pax-gold', proxy: 'PAXG' }],
  ['XAG', 'Серебро, унция', 'Silver, oz', 31.2, { vm: 1.6 }],
  ['XPT', 'Платина, унция', 'Platinum, oz', 985, { vm: 1.3 }],
  ['XPD', 'Палладий, унция', 'Palladium, oz', 1040, { vm: 1.8 }],
  ['HG', 'Медь, фунт', 'Copper, lb', 4.35, { vm: 1.3 }],
  ['ALI', 'Алюминий, тонна', 'Aluminium, t', 2520],
  ['NI', 'Никель, тонна', 'Nickel, t', 16400, { vm: 1.5 }],
  ['ZN', 'Цинк, тонна', 'Zinc, t', 2950, { vm: 1.2 }]
]);
// fx: function of a "units per 1 USD" rates table
const inv = c => r => 1 / r[c], dir = c => r => r[c];
def('forex', [
  ['EURUSD', 'Евро / доллар', 'Euro / US dollar', 1.085, { tk: 'EUR/USD', plain: 1, fx: inv('EUR') }],
  ['GBPUSD', 'Фунт / доллар', 'Pound / US dollar', 1.295, { tk: 'GBP/USD', plain: 1, fx: inv('GBP') }],
  ['USDJPY', 'Доллар / иена', 'US dollar / yen', 151.4, { tk: 'USD/JPY', plain: 1, fx: dir('JPY') }],
  ['USDCHF', 'Доллар / франк', 'US dollar / franc', 0.884, { tk: 'USD/CHF', plain: 1, fx: dir('CHF') }],
  ['USDCNY', 'Доллар / юань', 'US dollar / yuan', 7.12, { tk: 'USD/CNY', plain: 1, fx: dir('CNY') }],
  ['USDTRY', 'Доллар / лира', 'US dollar / lira', 34.2, { tk: 'USD/TRY', plain: 1, fx: dir('TRY') }],
  ['USDRUB', 'Доллар / рубль', 'US dollar / rouble', 96.5, { tk: 'USD/RUB', plain: 1, vm: 2, fx: dir('RUB') }],
  ['USDKZT', 'Доллар / тенге', 'US dollar / tenge', 492, { tk: 'USD/KZT', plain: 1, fx: dir('KZT') }],
  ['USDGEL', 'Доллар / лари', 'US dollar / lari', 2.72, { tk: 'USD/GEL', plain: 1, fx: dir('GEL') }],
  ['EURGBP', 'Евро / фунт', 'Euro / pound', 0.838, { tk: 'EUR/GBP', plain: 1, fx: r => r.GBP / r.EUR }]
]);
def('commod', [
  ['BRENT', 'Нефть Brent', 'Brent crude', 74.8, { vm: 1.2 }], ['WTI', 'Нефть WTI', 'WTI crude', 70.9, { vm: 1.2 }],
  ['NG', 'Природный газ', 'Natural gas', 2.85, { vm: 2 }], ['COFFEE', 'Кофе, фунт', 'Coffee, lb', 2.62, { vm: 1.4 }],
  ['WHEAT', 'Пшеница, бушель', 'Wheat, bu', 5.85], ['CORN', 'Кукуруза, бушель', 'Corn, bu', 4.28],
  ['SUGAR', 'Сахар, фунт', 'Sugar, lb', 0.215], ['COCOA', 'Какао, тонна', 'Cocoa, t', 7850, { vm: 1.8 }],
  ['COTTON', 'Хлопок, фунт', 'Cotton, lb', 0.72]
]);
def('index', [
  ['SPX', 'S&P 500', 'S&P 500', 5830, { plain: 1 }], ['NDX', 'Nasdaq 100', 'Nasdaq 100', 20350, { plain: 1, vm: 1.3 }],
  ['DJI', 'Dow Jones', 'Dow Jones', 42800, { plain: 1 }], ['DAX', 'DAX 40', 'DAX 40', 19450, { plain: 1 }],
  ['FTSE', 'FTSE 100', 'FTSE 100', 8280, { plain: 1 }], ['N225', 'Nikkei 225', 'Nikkei 225', 38900, { plain: 1, vm: 1.2 }],
  ['HSI', 'Hang Seng', 'Hang Seng', 20600, { plain: 1, vm: 1.4 }],
  ['VOO', 'Фонд на S&P 500', 'S&P 500 fund', 535], ['QQQ', 'Фонд на Nasdaq 100', 'Nasdaq 100 fund', 495, { vm: 1.3 }]
]);
const SYMS = Object.keys(INS);

const E = { rng: Math.random };
const round2 = v => Math.round(v * 100) / 100;
function gauss() {
  let u = 0; while (u === 0) u = E.rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * E.rng());
}
// Defensive number parsing for anything that came from the network.
function num(v) { const n = typeof v === 'string' ? parseFloat(v) : v; return typeof n === 'number' && isFinite(n) ? n : NaN; }
function trim(a, n) { if (a.length > n) a.splice(0, a.length - n); }

/* ---------- market ---------- */
function newMarket(now) {
  const M = { t: now, px: {}, q: {}, fine: {}, coarse: {}, day: {}, hk: {} };
  SYMS.forEach(s => { M.px[s] = INS[s].base; });
  SYMS.forEach(s => synthHist(M, s));
  return M;
}
// 'live' | 'delayed' | 'model' — derived from where and when the last real quote came.
function status(M, sym, now) {
  const q = M.q[sym];
  if (!q || !q.src) return 'model';
  if (LIVE_MS[q.src]) return now - q.at < LIVE_MS[q.src] ? 'live' : 'model';
  if (q.src === 'fx') return now - q.qt < FX_MAX ? 'delayed' : 'model';
  if (q.src === 'file') return now - q.qt < FILE_MAX ? 'delayed' : 'model';
  return 'model';
}
const anchor = (M, sym) => (M.q[sym] && M.q[sym].a) || INS[sym].base;

// One step for every instrument. Between real updates the price only breathes around the
// last real quote (tiny noise, strong pull-back); with no real source it is a random walk
// around the last known real price with rare jumps.
function step(M, dt, fine) {
  const sq = Math.sqrt(dt);
  for (let i = 0; i < SYMS.length; i++) {
    const s = SYMS[i], I = INS[s], st = status(M, s, M.t);
    let sig, kap, jump = false;
    if (st === 'live') { sig = I.vol * 0.15; kap = 0.05; }
    else if (st === 'delayed') { sig = I.vol * 0.5; kap = 2e-3; }
    else { sig = I.vol; kap = 5e-6; jump = true; }
    let x = Math.log(M.px[s]);
    x += Math.min(1, kap * dt) * (Math.log(anchor(M, s)) - x) + sig * sq * gauss();
    if (jump && E.rng() < 1 - Math.exp(-dt / JUMP_S)) x += (E.rng() < 0.5 ? -1 : 1) * I.vol * (15 + 35 * E.rng());
    const p = Math.exp(x);
    M.px[s] = p;
    if (fine) { M.fine[s].push(p); trim(M.fine[s], FINE_N); }
  }
  const t0 = M.t; M.t += dt * 1000;
  if (fine && Math.floor(M.t / 6e4) !== Math.floor(t0 / 6e4)) SYMS.forEach(s => { M.coarse[s].push(M.px[s]); trim(M.coarse[s], COARSE_N); });
  if (fine && Math.floor(M.t / 36e5) !== Math.floor(t0 / 36e5)) SYMS.forEach(s => { M.day[s].push(M.px[s]); trim(M.day[s], DAY_N); });
}

// Brownian bridge in log space from p0 to p1.
function bridge(n, p0, p1, sig) {
  const w = [0]; for (let i = 1; i < n; i++) w.push(w[i - 1] + sig * gauss());
  const a = Math.log(p0), b = Math.log(p1), out = [];
  for (let i = 0; i < n; i++) { const f = i / (n - 1); out.push(Math.exp(a + (b - a) * f + w[i] - w[n - 1] * f)); }
  return out;
}
// Modelled chart history ending at the current price (used whenever real candles are not available).
function synthHist(M, sym) {
  const I = INS[sym], p = M.px[sym], q = M.q[sym];
  const ch = q && q.ch != null ? q.ch : I.vol * 150 * gauss();
  const b = bridge(1441, p / (1 + Math.max(-0.5, Math.min(0.5, ch))), p, I.vol * Math.sqrt(60) * 0.6);
  M.coarse[sym] = b.slice(-COARSE_N);
  M.day[sym] = b.filter((v, i) => i % 60 === 0).slice(0, DAY_N);
  M.fine[sym] = bridge(FINE_N, b[b.length - 6], p, I.vol * 0.4);
  M.hk[sym] = 'synth';
}
// Real candle closes from the exchange replace the modelled history.
function setCandles(M, sym, kind, closes) {
  const a = closes.map(num).filter(v => v > 0);
  if (a.length < 2) return false;
  if (kind === '1m') { M.coarse[sym] = a.slice(-COARSE_N); M.hk[sym] = 'real'; }
  else if (kind === '1h') M.day[sym] = a.slice(-DAY_N);
  else if (kind === '1s') M.fine[sym] = a.slice(-FINE_N);
  return true;
}

// Accept a real quote: snap the price to it. Returns false if the value looks like garbage.
function applyQuote(S, M, sym, qo, now, res) {
  const I = INS[sym], p = num(qo.p);
  if (!I || !(p > 0) || p / I.base > 200 || I.base / p > 200) return false;
  const old = M.q[sym];
  let ch = num(qo.ch); ch = isFinite(ch) && Math.abs(ch) < 0.9 ? ch : null;
  // qt = the provider's own timestamp; 0 means "real-looking seed value of unknown date" (shown as model)
  let qt = qo.qt == null ? now : (num(qo.qt) > 0 ? num(qo.qt) : 0);
  if (qt > now + 864e5) qt = 0;
  if (ch == null && old && old.src === qo.src) {          // daily sources: derive change from the previous value
    if (old.qt === qt) ch = old.ch;
    else if (qt > old.qt && qt - old.qt < 4 * 864e5) ch = p / old.a - 1;
  }
  M.q[sym] = { a: p, at: now, qt: qt, src: qo.src, ch: ch };
  M.px[sym] = p;
  if (M.fine[sym] && M.fine[sym].length) M.fine[sym][M.fine[sym].length - 1] = p;
  if (S) sweep(S, M, res || { liq: [] });
  return true;
}
// 24 h change as a fraction, or null when it is honestly unknown.
function chg24(M, sym, now) {
  const q = M.q[sym], p = M.px[sym];
  if (q && q.ch != null) return (1 + q.ch) * (p / q.a) - 1;
  if (status(M, sym, now) === 'model' && M.day[sym] && M.day[sym].length) return p / M.day[sym][0] - 1;
  return null;
}

/* ---------- account ---------- */
function newState() {
  return { v: 1, lang: 'ru', sound: true, cash: 0, deposited: 0, bench: 0, positions: [], trades: [], curve: [], curveT: 0, nextId: 1,
    agg: { n: 0, wins: 0, fees: 0, maxLoss: 0, imp: 0, opens: 0, streak: 0, lastActT: 0, lastLossT: 0, liq: 0, realized: 0 } };
}
function reset(S) { const k = { lang: S.lang, sound: S.sound }; Object.keys(S).forEach(x => delete S[x]); Object.assign(S, newState(), k); }
const pnl = (p, price) => p.side * p.qty * (price - p.entry);
const posValue = (p, price) => Math.max(0, p.margin + pnl(p, price));
const liqPrice = (entry, side, lev) => entry * (1 - side / lev);
function equity(S, M) { let v = S.cash; S.positions.forEach(p => { v += posValue(p, M.px[p.sym]); }); return v; }
function pushCurve(S, M) {
  S.curve.push([M.t, round2(equity(S, M) - S.deposited)]); S.curveT = M.t;
  if (S.curve.length > 400) S.curve = S.curve.filter((c, i) => i >= 200 || i % 2 === 0);
}
function deposit(S, M, amount) {
  amount = round2(num(amount));
  if (!(amount >= 1) || amount > 1e7 || S.deposited + amount > 1e9) return false;
  S.cash = round2(S.cash + amount); S.deposited = round2(S.deposited + amount);
  S.bench += amount / M.px[BENCH];           // "bought the index and never touched it"
  pushCurve(S, M);
  return true;
}
// Largest margin that still leaves room for the opening fee.
function maxAmount(cash, lev) {
  let a = Math.floor(cash / (1 + lev * FEE) * 100) / 100;
  while (a > 0 && a + round2(a * lev * FEE) > cash + 1e-9) a = round2(a - 0.01);
  return Math.max(0, a);
}
// side: +1 buy (profit when price rises), -1 sell (profit when it falls). amount = margin in $.
function open(S, M, sym, side, amount, lev) {
  amount = round2(num(amount));
  if (!INS[sym] || (side !== 1 && side !== -1) || LEVS.indexOf(lev) < 0) return { ok: false, err: 'bad' };
  if (!(amount >= 1)) return { ok: false, err: 'min' };
  const fee = round2(amount * lev * FEE);
  if (amount + fee > S.cash + 1e-9) return { ok: false, err: 'funds' };
  const price = M.px[sym], qty = amount * lev / price, a = S.agg, t = M.t;
  const imp = !!((a.lastActT && t - a.lastActT < 6e4) || (a.lastLossT && t - a.lastLossT < 12e4));
  let p = S.positions.find(x => x.sym === sym && x.side === side && x.lev === lev);
  if (p) {                                    // add to the same position: weighted average entry
    p.entry = (p.qty * p.entry + qty * price) / (p.qty + qty);
    p.qty += qty; p.margin = round2(p.margin + amount); p.fee = round2(p.fee + fee); p.tl = t; p.imp = p.imp || imp;
  } else {
    p = { id: S.nextId++, sym: sym, side: side, lev: lev, qty: qty, entry: price, margin: amount, fee: fee, t: t, tl: t, imp: imp };
    S.positions.push(p);
  }
  S.cash = round2(S.cash - amount - fee);
  a.fees = round2(a.fees + fee); a.opens++; if (imp) a.imp++; a.lastActT = t;
  pushCurve(S, M);
  return { ok: true, pos: p, fee: fee, imp: imp };
}
function close(S, M, id, liq) {
  const i = S.positions.findIndex(x => x.id === id); if (i < 0) return null;
  const p = S.positions[i], price = M.px[p.sym], a = S.agg;
  let g = pnl(p, price), cfee = 0, back = 0;
  if (liq || g <= -p.margin) { liq = true; g = -p.margin; }      // loss reached the margin: nothing comes back
  else { cfee = Math.min(round2(p.qty * price * FEE), round2(p.margin + g)); back = round2(p.margin + g - cfee); }
  S.positions.splice(i, 1);
  S.cash = round2(S.cash + back);
  const tr = { id: p.id, sym: p.sym, side: p.side, lev: p.lev, qty: p.qty, entry: p.entry, exit: price, margin: p.margin,
    pnl: round2(g), fees: round2(p.fee + cfee), net: round2(back - p.margin - p.fee), t0: p.t, t: M.t, liq: !!liq, imp: !!p.imp };
  a.n++; a.realized = round2(a.realized + tr.net); a.fees = round2(a.fees + cfee);
  if (tr.net > 0) { a.wins++; a.streak = 0; }
  else if (tr.net < 0) { a.streak++; a.lastLossT = M.t; if (tr.net < a.maxLoss) a.maxLoss = tr.net; }
  if (liq) a.liq++; else a.lastActT = M.t;
  S.trades.unshift(tr); if (S.trades.length > 300) S.trades.length = 300;
  pushCurve(S, M);
  return tr;
}
// Liquidate everything whose loss has reached its margin; sample the result curve once a minute.
function sweep(S, M, res) {
  for (let i = S.positions.length - 1; i >= 0; i--) {
    const p = S.positions[i];
    if (pnl(p, M.px[p.sym]) <= -p.margin) res.liq.push(close(S, M, p.id, true));
  }
  if (S.deposited > 0 && M.t - S.curveT >= 6e4) pushCurve(S, M);
}
// Real candles [{t, h, l}] show what happened while we were not looking: liquidate if the
// range crossed a position's liquidation price after it was last changed.
function sweepCandles(S, M, sym, kl, res) {
  S.positions.filter(p => p.sym === sym).forEach(p => {
    const lp = liqPrice(p.entry, p.side, p.lev);
    const hit = kl.some(k => k.t > p.tl && (p.side > 0 ? k.l <= lp : k.h >= lp));
    if (hit) res.liq.push(close(S, M, p.id, true));
  });
}
// Bring the market up to `now`. Long gaps (tab closed) are walked in 60 s steps without history.
function advance(S, M, now) {
  const res = { liq: [], big: false };
  let gap = (now - M.t) / 1000;
  if (gap < 0) { M.t = now; return res; }
  if (gap < 0.5) return res;
  if (gap > CAP_S) { M.t = now - CAP_S * 1000; gap = CAP_S; }
  while (gap > FINE_N) { step(M, 60, false); gap -= 60; res.big = true; sweep(S, M, res); }
  for (let n = Math.round(gap); n > 0; n--) { step(M, 1, !res.big); sweep(S, M, res); }
  if (res.big) SYMS.forEach(s => synthHist(M, s));
  return res;
}
function stats(S, M) {
  const a = S.agg, eq = equity(S, M), bv = S.bench * M.px[BENCH];
  return { n: a.n, wins: a.wins, winRate: a.n ? a.wins / a.n : null, fees: a.fees, maxLoss: a.maxLoss, imp: a.imp, opens: a.opens,
    liq: a.liq, streak: a.streak, realized: a.realized, equity: eq, result: round2(eq - S.deposited), bench: round2(bv - S.deposited) };
}
// Rebuild market from saved data (history is never stored — it is refetched or re-modelled).
function restore(d, now) {
  const M = newMarket(now), m = d && d.market;
  if (!d || d.v !== 1 || !d.agg || !Array.isArray(d.positions) || !m || !m.px) return { S: newState(), M: M };
  SYMS.forEach(s => {
    const p = num(m.px[s]); if (p > 0) M.px[s] = p;
    const q = m.q && m.q[s]; if (q && num(q.a) > 0 && typeof q.src === 'string') M.q[s] = { a: num(q.a), at: num(q.at) || 0, qt: num(q.qt) || 0, src: q.src, ch: q.ch == null ? null : num(q.ch) };
  });
  M.t = Math.min(now, num(m.t) || now);
  SYMS.forEach(s => synthHist(M, s));
  const S = Object.assign(newState(), d); delete S.market;
  S.agg = Object.assign(newState().agg, d.agg);
  S.positions = S.positions.filter(p => p && INS[p.sym]);
  return { S: S, M: M };
}

Object.assign(E, { KEY, FEE, LEVS, CATS, CAT, INS, SYMS, BENCH, FINE_N, newMarket, status, step, synthHist, setCandles, applyQuote, chg24,
  newState, reset, pnl, posValue, liqPrice, equity, deposit, maxAmount, open, close, sweep, sweepCandles, advance, stats, restore, num, round2, bridge, gauss });
if (typeof module !== 'undefined' && module.exports) { module.exports = E; }
if (typeof document === 'undefined') return;

/* =====================================================================
   2. UI — dictionary, formatting, sound
   ===================================================================== */
let S, M;
const ui = { view: 'money', cat: null, sym: null, tf: '5m', lev: 1, ncat: 'all', bcat: 'all', bet: null };
const $ = id => document.getElementById(id);
const RM = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const NB = ' ';   // narrow no-break space as thousands separator

const T = {
  ru: {
    nav_money: 'Деньги', nav_market: 'Рынок', nav_wallet: 'Кошелёк', nav_truth: 'Правда', nav_news: 'Новости', snd_aria: 'Звук', skin_aria: 'Стиль', skin_gold: 'Стиль: Золото', skin_sapphire: 'Стиль: Сапфир', skin_amethyst: 'Стиль: Аметист', skin_aurora: 'Стиль: Аврора', skin_platinum: 'Стиль: Платина',
    money_lbl: 'Игровой счёт', money_h: 'Деньги',
    money_sub: 'Внесите любую сумму и торгуйте как в жизни. Деньги игровые: потерять здесь нечего, а результат считается честно.',
    reset: 'Обнулить всё', reset_q: 'Стереть деньги, позиции и всю историю?', reset_yes: 'Да, обнулить', cancel: 'Отмена', reset_done: 'Счёт обнулён',
    atm_balance: 'Баланс', atm_ph: 'Своя сумма', atm_go: 'Внести', atm_card: 'Карта', atm_cash: 'Купюры',
    atm_min: 'Минимум $1', atm_max: 'За один раз — до $10 000 000',
    disclaimer: 'Криптовалюты и золото (через токен PAXG) — живые цены биржи Binance. Валюты — справочный курс, обновляется раз в сутки. Акции, индексы, сырьё и остальные металлы — с задержкой из нашего файла котировок. Если источник недоступен, цена моделируется вокруг последней известной и помечается «Модель». Это не инвестиционная рекомендация. Настоящих денег здесь нет.',
    market_lbl: 'Шесть рынков', market_h: 'Рынок', market_sub: 'Выберите класс активов. У каждой цены подписано, откуда она: живая, с задержкой или модель.',
    instr: 'инструментов', back_market: 'Рынок',
    st_live: 'Live', st_delayed: 'Задержка', st_model: 'Модель', st_near: 'около цены от', st_proxy: 'через',
    tf_1m: '1м', tf_5m: '5м', tf_1h: '1ч', tf_4h: '4ч', tf_24h: '24ч', u_s: 'с', u_m: 'м', u_h: 'ч', now: 'сейчас', ch24: 'за 24 ч',
    chart_real: 'График: реальные свечи Binance.', chart_synth: 'График смоделирован вокруг последней известной цены.',
    tr_amount: 'Сумма', tr_all: 'Всё', tr_lev: 'Плечо', tr_buy: 'Купить', tr_buy_s: 'на рост', tr_sell: 'Продать', tr_sell_s: 'на падение',
    tr_cash: 'Свободно', tr_fee: 'Комиссия 0.1%: {f} · объём позиции: {v}',
    lev_warn: 'Плечо ×{l} умножает и прибыль, и убыток. Позиция закроется принудительно, когда убыток дойдёт до залога — при движении цены на {p}% против вас: покупка — ниже {a}, продажа — выше {b}.',
    err_min: 'Минимальная сумма — $1', err_funds: 'Не хватает свободных денег с учётом комиссии', err_bad: 'Не получилось открыть позицию',
    need_money: 'Счёт пуст.', need_money_a: 'Внести деньги в банкомате',
    opened: 'Позиция открыта: {s}', imp_note: 'Отмечено: сделка открыта в спешке',
    ins_pos: 'Ваши позиции здесь', pos_none: 'По этому инструменту позиций нет.', pos_none_all: 'Открытых позиций нет.',
    p_qty: 'Количество', p_avg: 'Средняя цена', p_val: 'Сейчас стоит', p_pnl: 'Результат', p_close: 'Закрыть',
    side_up: 'Рост', side_down: 'Падение', liq_badge: 'ликвидация', liq_toast: '{s}: позиция ликвидирована, {x}', away_liq: 'Пока вас не было, ликвидировано позиций: {n}',
    wallet_lbl: 'Портфель', wallet_h: 'Кошелёк', w_real: 'Если бы это были реальные деньги', w_of_dep: 'от внесённого',
    w_total: 'Стоимость портфеля', w_cash: 'Свободные деньги', w_inpos: 'В позициях', w_dep: 'Всего внесено',
    w_curve: 'Результат во времени', curve_empty: 'Кривая появится после первых сделок', w_open: 'Открытые позиции', w_hist: 'История сделок', hist_none: 'Закрытых сделок пока нет.',
    truth_lbl: 'Честная статистика', truth_h: 'Правда',
    sum_none: 'Сделок пока нет. После первой закрытой сделки здесь появится честный итог.',
    sum_loss: 'За {n} {tr} вы потеряли {x}. В реальной жизни это были бы ваши деньги.',
    sum_win: 'За {n} {tr} вы в плюсе на {x}. Из них {f} ушло бы на комиссии.',
    sum_flat: 'За {n} {tr} вы остались при своих.',
    t_open_note: 'С учётом открытых позиций итог сейчас: {x}.',
    t_imp_line: 'В спешке — меньше чем через минуту после предыдущей сделки или сразу после убытка — открыто {i} из {o}.',
    t_trades: 'Закрытых сделок', t_winrate: 'Доля прибыльных', t_fees: 'Ушло на комиссии', t_maxloss: 'Самый большой убыток', t_imp: 'Сделок в спешке', t_liq: 'Ликвидаций',
    t_cmp: 'Что было бы иначе', cmp_you: 'Ваш результат', cmp_hold: 'Просто держали бы деньги', cmp_index: 'Купили бы индекс S&P 500 и не трогали',
    t_pause_btn: 'Сделать паузу',
    pause_lbl: 'Пауза', pause_h: 'Убыточных сделок подряд: {n}', pause_h_manual: 'Минута тишины',
    pause_p: 'Вдох на четыре счёта, выдох на четыре. Рынок никуда не денется.', inhale: 'Вдох', exhale: 'Выдох',
    pause_streak: 'Эти сделки', pause_total: 'Общий результат', pause_go: 'Продолжить', pause_nums: 'К цифрам',
    sync_ok: 'Синхронно', sync_part: 'Частично', sync_off: 'Офлайн · модель',
    src_crypto: 'Крипто', src_fx: 'Валюты', src_file: 'Файл котировок', src_no: 'нет связи',
    news_lbl: 'Проверенные источники', news_h: 'Агрегатор новостей', news_sub: 'Заголовки и короткие выдержки из лент известных изданий. Полный текст — на сайте источника.',
    nc_all: 'Все', nc_crypto: 'Криптовалюты', nc_stocks: 'Акции', nc_fintech: 'Финтех', nc_companies: 'Компании',
    news_upd: 'Обновлено: {t}', news_none: 'Лента пока не собрана: файл новостей недоступен. Загляните позже.', news_empty_cat: 'В этой рубрике пока пусто.', news_read: 'Читать в источнике',
    learn_h: 'Обучение', learn_sub: 'Здесь будут короткие разборы простым языком. Пока — анонсы.', soon: 'Скоро',
    learn: [
      ['Как работает плечо', 'Почему заёмные деньги ускоряют не только прибыль и что такое принудительное закрытие.'],
      ['Комиссии: маленькая строчка, большой счёт', 'Из чего складывается цена сделки и как она копится при частой торговле.'],
      ['Почему на ставках проигрывают', 'Как устроена маржа букмекера и что это значит на длинной дистанции.'],
      ['Диверсификация', 'Зачем раскладывать деньги по разным активам и от чего это не спасает.'],
      ['Что такое спред', 'Разница между ценой покупки и продажи и кто на ней зарабатывает.'],
      ['Импульсивные сделки', 'Как распознать решение, принятое на эмоциях, и что помогает остановиться.']
    ]
  },
  en: {
    nav_money: 'Money', nav_market: 'Market', nav_wallet: 'Wallet', nav_truth: 'Truth', nav_news: 'News', snd_aria: 'Sound', skin_aria: 'Style', skin_gold: 'Style: Gold', skin_sapphire: 'Style: Sapphire', skin_amethyst: 'Style: Amethyst', skin_aurora: 'Style: Aurora', skin_platinum: 'Style: Platinum',
    money_lbl: 'Play account', money_h: 'Money',
    money_sub: 'Deposit any amount and trade as you would in real life. The money is play money: nothing to lose, and the result is counted honestly.',
    reset: 'Reset everything', reset_q: 'Erase money, positions and all history?', reset_yes: 'Yes, reset', cancel: 'Cancel', reset_done: 'Account reset',
    atm_balance: 'Balance', atm_ph: 'Custom amount', atm_go: 'Deposit', atm_card: 'Card', atm_cash: 'Cash',
    atm_min: 'Minimum is $1', atm_max: 'Up to $10,000,000 at a time',
    disclaimer: 'Crypto and gold (via the PAXG token) are live Binance prices. Forex is a reference rate updated once a day. Stocks, indices, commodities and other metals are delayed quotes from our quotes file. When a source is unreachable the price is modelled around the last known one and marked “Model”. This is not investment advice. There is no real money here.',
    market_lbl: 'Six markets', market_h: 'Market', market_sub: 'Pick an asset class. Every price says where it comes from: live, delayed or model.',
    instr: 'instruments', back_market: 'Market',
    st_live: 'Live', st_delayed: 'Delayed', st_model: 'Model', st_near: 'around the price of', st_proxy: 'via',
    tf_1m: '1m', tf_5m: '5m', tf_1h: '1h', tf_4h: '4h', tf_24h: '24h', u_s: 's', u_m: 'm', u_h: 'h', now: 'now', ch24: '24 h',
    chart_real: 'Chart: real Binance candles.', chart_synth: 'Chart is modelled around the last known price.',
    tr_amount: 'Amount', tr_all: 'All', tr_lev: 'Leverage', tr_buy: 'Buy', tr_buy_s: 'price goes up', tr_sell: 'Sell', tr_sell_s: 'price goes down',
    tr_cash: 'Available', tr_fee: 'Fee 0.1%: {f} · position size: {v}',
    lev_warn: 'Leverage ×{l} multiplies losses as well as gains. The position is force-closed when the loss reaches your margin — a {p}% move against you: buy — below {a}, sell — above {b}.',
    err_min: 'Minimum amount is $1', err_funds: 'Not enough available cash including the fee', err_bad: 'Could not open the position',
    need_money: 'The account is empty.', need_money_a: 'Deposit at the ATM',
    opened: 'Position opened: {s}', imp_note: 'Noted: this trade was opened in a hurry',
    ins_pos: 'Your positions here', pos_none: 'No positions in this instrument.', pos_none_all: 'No open positions.',
    p_qty: 'Quantity', p_avg: 'Average price', p_val: 'Worth now', p_pnl: 'Result', p_close: 'Close',
    side_up: 'Long', side_down: 'Short', liq_badge: 'liquidated', liq_toast: '{s}: position liquidated, {x}', away_liq: 'While you were away, positions liquidated: {n}',
    wallet_lbl: 'Portfolio', wallet_h: 'Wallet', w_real: 'If this were real money', w_of_dep: 'of deposits',
    w_total: 'Portfolio value', w_cash: 'Available cash', w_inpos: 'In positions', w_dep: 'Total deposited',
    w_curve: 'Result over time', curve_empty: 'The curve appears after your first trades', w_open: 'Open positions', w_hist: 'Trade history', hist_none: 'No closed trades yet.',
    truth_lbl: 'Honest statistics', truth_h: 'Truth',
    sum_none: 'No trades yet. After the first closed trade an honest summary appears here.',
    sum_loss: 'Over {n} {tr} you lost {x}. In real life that would have been your money.',
    sum_win: 'Over {n} {tr} you are up {x}. Fees would have taken {f} of it.',
    sum_flat: 'Over {n} {tr} you broke even.',
    t_open_note: 'Including open positions the result right now is {x}.',
    t_imp_line: 'Opened in a hurry — less than a minute after the previous trade or right after a loss: {i} of {o}.',
    t_trades: 'Closed trades', t_winrate: 'Winning share', t_fees: 'Paid in fees', t_maxloss: 'Biggest loss', t_imp: 'Hurried trades', t_liq: 'Liquidations',
    t_cmp: 'What would have been different', cmp_you: 'Your result', cmp_hold: 'Just kept the money', cmp_index: 'Bought the S&P 500 index and left it',
    t_pause_btn: 'Take a pause',
    pause_lbl: 'Pause', pause_h: 'Losing trades in a row: {n}', pause_h_manual: 'A quiet minute',
    pause_p: 'Breathe in for four, out for four. The market is not going anywhere.', inhale: 'In', exhale: 'Out',
    pause_streak: 'These trades', pause_total: 'Overall result', pause_go: 'Continue', pause_nums: 'See the numbers',
    sync_ok: 'In sync', sync_part: 'Partial', sync_off: 'Offline · model',
    src_crypto: 'Crypto', src_fx: 'Forex', src_file: 'Quotes file', src_no: 'no connection',
    news_lbl: 'Trusted sources', news_h: 'News aggregator', news_sub: 'Headlines and short excerpts from well-known outlets. The full text is on the source site.',
    nc_all: 'All', nc_crypto: 'Crypto', nc_stocks: 'Stocks', nc_fintech: 'Fintech', nc_companies: 'Companies',
    news_upd: 'Updated: {t}', news_none: 'The feed is not built yet: the news file is unavailable. Please check back later.', news_empty_cat: 'Nothing in this section yet.', news_read: 'Read at the source',
    learn_h: 'Learning', learn_sub: 'Short plain-language explainers will live here. For now — previews.', soon: 'Soon',
    learn: [
      ['How leverage works', 'Why borrowed money speeds up more than profit, and what a forced close is.'],
      ['Fees: a small line, a big bill', 'What a trade really costs and how it adds up when you trade often.'],
      ['Why bettors lose', 'How the bookmaker margin works and what it means over a long run.'],
      ['Diversification', 'Why spread money across assets and what it does not protect from.'],
      ['What a spread is', 'The gap between the buy and the sell price and who earns on it.'],
      ['Impulsive trades', 'How to spot a decision made on emotion and what helps to stop.']
    ]
  }
};
function t(k) { const d = T[S.lang] || T.ru; return d[k] != null ? d[k] : (T.ru[k] != null ? T.ru[k] : k); }
function tf(k, o) { return String(t(k)).replace(/\{(\w+)\}/g, (m, a) => (o[a] != null ? o[a] : '')); }
const L = o => (S.lang === 'en' ? o.en : o.ru);
function tradesWord(n) {
  if (S.lang === 'en') return n === 1 ? 'trade' : 'trades';
  const a = n % 10, b = n % 100;
  return a === 1 && b !== 11 ? 'сделку' : (a >= 2 && a <= 4 && (b < 12 || b > 14) ? 'сделки' : 'сделок');
}

/* ---------- formatting ---------- */
const grp = s => s.replace(/\B(?=(\d{3})+(?!\d))/g, NB);
function fixed(v, d) { const a = Math.abs(v).toFixed(d).split('.'); return grp(a[0]) + (a[1] ? '.' + a[1] : ''); }
function money(v, d) { if (!isFinite(v)) v = 0; return (v < 0 ? '−' : '') + '$' + fixed(v, d == null ? 2 : d); }
function signed(v) { return (v > 0 ? '+' : '') + money(v); }
function compact(v) {
  const a = Math.abs(v), s = v < 0 ? '−$' : '$';
  if (a >= 1e9) return s + (a / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return s + (a / 1e6).toFixed(2) + 'M';
  if (a >= 1e5) return s + (a / 1e3).toFixed(1) + 'K';
  return money(v);
}
const tight = v => (Math.abs(v) >= 1e8 ? compact(v) : money(v));       // for the big hero number
const tightS = v => (v > 0 ? '+' : '') + tight(v);
function pct(v) { return v == null || !isFinite(v) ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v * 100).toFixed(2) + '%'; }
function pdec(sym, p) { return INS[sym].cat === 'forex' ? (p < 10 ? 5 : 3) : (p >= 100 ? 2 : p >= 1 ? 3 : 5); }
function price(sym, p) { return (INS[sym].plain ? '' : '$') + fixed(p, pdec(sym, p)); }
function qty(v) { return fixed(v, v >= 1000 ? 2 : v >= 1 ? 4 : 6); }
const p2 = n => (n < 10 ? '0' : '') + n;
function clock(ms) { const d = new Date(ms); return p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds()); }
function stamp(ms) { const d = new Date(ms); return p2(d.getDate()) + '.' + p2(d.getMonth() + 1) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()); }
function ago(sec) {
  if (sec <= 0) return t('now');
  if (sec < 60) return '−' + sec + t('u_s');
  if (sec < 3600) return '−' + Math.floor(sec / 60) + t('u_m') + (sec % 60 ? ' ' + (sec % 60) + t('u_s') : '');
  return '−' + Math.floor(sec / 3600) + t('u_h') + (Math.floor(sec % 3600 / 60) ? ' ' + Math.floor(sec % 3600 / 60) + t('u_m') : '');
}
function parseAmt(s) { const n = parseFloat(String(s).replace(/[\s  ]/g, '').replace(',', '.')); return isFinite(n) && n > 0 ? n : 0; }
function setTxt(el, text, v) {
  if (!el) return;
  if (el.textContent !== text) el.textContent = text;
  if (v !== undefined) { el.classList.toggle('up', v > 0); el.classList.toggle('down', v < 0); }
}
function vib(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }

/* ---------- storage ---------- */
function load() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) { d = null; }
  const r = E.restore(d, Date.now()); S = r.S; M = r.M;
  if (S.lang !== 'en') S.lang = 'ru';
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(Object.assign({}, S, { market: { t: M.t, px: M.px, q: M.q } }))); } catch (e) {}
}

/* ---------- sound (WebAudio, synthesized; starts only after a user gesture) ---------- */
const snd = (function () {
  let ctx = null, master = null, gest = false;
  function ready() {
    if (!S.sound || !gest) return false;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
      try { ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination); } catch (e) { ctx = null; return false; }
    }
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
    return true;
  }
  function burst(t0, dur, freq, q, vol, type) {          // filtered noise burst
    const n = Math.max(1, Math.floor(ctx.sampleRate * dur)), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = b; f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t0); s.stop(t0 + dur + 0.02);
  }
  function tone(t0, f0, f1, dur, vol, type) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t0); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.03);
  }
  return {
    gesture() { gest = true; },
    cash(n) {                                   // quick series of bill rustles, then the tray closing
      if (!ready()) return; const t0 = ctx.currentTime + 0.02, k = n * 2;
      for (let i = 0; i < k; i++) burst(t0 + i * 0.052, 0.05, 2400 + Math.random() * 2800, 1.1, 0.42);
      tone(t0 + k * 0.052 + 0.03, 150, 70, 0.14, 0.3);
    },
    win() {                                     // coin clinks and a soft "cha-ching"
      if (!ready()) return; const t0 = ctx.currentTime + 0.02;
      for (let i = 0; i < 4; i++) tone(t0 + i * 0.06 + Math.random() * 0.02, 3200 + Math.random() * 2200, 3000, 0.09, 0.12, 'triangle');
      tone(t0 + 0.3, 1318.5, 1318.5, 0.5, 0.2); tone(t0 + 0.42, 1975.5, 1975.5, 0.8, 0.18); tone(t0 + 0.42, 3951, 3951, 0.4, 0.05);
    },
    loss() {                                    // low soft thud
      if (!ready()) return; const t0 = ctx.currentTime + 0.02;
      tone(t0, 120, 48, 0.32, 0.5); burst(t0, 0.18, 220, 0.7, 0.25, 'lowpass');
    },
    key() { if (!ready()) return; burst(ctx.currentTime + 0.005, 0.02, 1800, 2, 0.1); }
  };
})();

/* =====================================================================
   3. QUOTES ADAPTER — real prices where a keyless CORS source exists.
   Every response is untrusted data: numbers go through num()/applyQuote(),
   only our own symbol keys are read, nothing from the network reaches innerHTML.
   ===================================================================== */
const BN = ['https://data-api.binance.vision', 'https://api.binance.com'];
const FXC = ['EUR', 'GBP', 'JPY', 'CHF', 'CNY', 'TRY', 'RUB', 'KZT', 'GEL'];
const ECB = ['EUR', 'GBP', 'JPY', 'CHF', 'CNY', 'TRY'];           // what the frankfurter (ECB) source covers
let bnHost = 0, bnLive = false, cgAt = 0, seeded = false;
const fileHist = {};                                               // sym -> daily history from quotes.json

async function getJSON(url, ms) {
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), ms || 8000);
  try {
    const r = await fetch(url, { signal: ac.signal, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!r.ok) throw new Error('http ' + r.status);
    return await r.json();
  } finally { clearTimeout(to); }
}
const BNS = SYMS.filter(s => INS[s].bn);

async function runCrypto() {
  const list = encodeURIComponent(JSON.stringify(BNS.map(s => INS[s].bn)));
  for (let k = 0; k < BN.length; k++) {
    const h = (bnHost + k) % BN.length;
    try {
      const a = await getJSON(BN[h] + '/api/v3/ticker/24hr?symbols=' + list);
      if (!Array.isArray(a)) throw new Error('shape');
      const by = {}; a.forEach(o => { if (o && typeof o.symbol === 'string') by[o.symbol] = o; });
      const now = Date.now(), res = { liq: [] }; let n = 0;
      BNS.forEach(s => {
        const o = by[INS[s].bn];
        if (o && E.applyQuote(S, M, s, { p: o.lastPrice, ch: E.num(o.priceChangePercent) / 100, qt: now, src: 'bn' }, now, res)) n++;
      });
      if (!n) throw new Error('empty');
      bnHost = h; bnLive = true; onLiq(res.liq);
      if (!seeded) { seeded = true; seedCandles(); }
      return;
    } catch (e) { /* try the next host */ }
  }
  bnLive = false;
  if (Date.now() - cgAt < 6e4) throw new Error('wait');             // CoinGecko fallback, at most once a minute
  cgAt = Date.now();
  const d = await getJSON('https://api.coingecko.com/api/v3/simple/price?ids=' + BNS.map(s => INS[s].cg).join(',') +
    '&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true');
  const now = Date.now(), res = { liq: [] }; let n = 0;
  BNS.forEach(s => {
    const o = d && d[INS[s].cg];
    if (o && E.applyQuote(S, M, s, { p: o.usd, ch: E.num(o.usd_24h_change) / 100, qt: now, src: 'cg' }, now, res)) n++;
  });
  if (!n) throw new Error('empty');
  onLiq(res.liq);
}

function applyRates(rates, qt) {
  const r = {}; FXC.forEach(c => { r[c] = E.num(rates && rates[c]); });
  const now = Date.now(), res = { liq: [] }; let n = 0;
  SYMS.forEach(s => {
    const f = INS[s].fx; if (!f) return;
    if (E.applyQuote(S, M, s, { p: f(r), qt: qt, src: 'fx' }, now, res)) n++;
  });
  onLiq(res.liq);
  return n;
}
async function runFx() {
  try {
    const d = await getJSON('https://open.er-api.com/v6/latest/USD');
    if (!d || d.result !== 'success' || !applyRates(d.rates, E.num(d.time_last_update_unix) * 1000)) throw new Error('shape');
  } catch (e) {
    const d = await getJSON('https://api.frankfurter.app/latest?from=USD');
    const qt = Date.parse(String(d && d.date).slice(0, 10) + 'T15:00:00Z');
    if (!d || !applyRates(d.rates, qt)) throw new Error('shape');
  }
}

// Same-origin quotes.json: { ts, q: { SYM: { p, ch, history } } } — refreshed by a server job.
const fileJob = { stale: true };
async function runFile() {
  const d = await getJSON('quotes.json');
  if (!d || typeof d.q !== 'object' || !d.q) throw new Error('shape');
  const now = Date.now(), ts = E.num(d.ts) > 0 ? E.num(d.ts) : 0, res = { liq: [] };
  fileJob.stale = !(ts > 0 && now - ts < 4 * 864e5);
  SYMS.forEach(s => {
    const o = d.q[s], I = INS[s]; if (!o || typeof o !== 'object') return;
    if (Array.isArray(o.history)) fileHist[s] = { ts: ts, a: o.history.slice(-400) };
    // direct sources win; the file only fills them in when they are unreachable
    if ((I.bn || I.fx) && (E.status(M, s, now) !== 'model' || (M.q[s] && M.q[s].qt >= ts))) return;
    if (M.q[s] && M.q[s].src === 'file' && M.q[s].qt === ts) return;       // same file as before: keep our price
    const ch = E.num(o.ch);
    E.applyQuote(S, M, s, { p: o.p, ch: isFinite(ch) ? ch / 100 : null, qt: ts, src: 'file' }, now, res);
    E.synthHist(M, s);
  });
  onLiq(res.liq);
}

const jobs = [
  { id: 'crypto', every: 12e3, cap: 12e4, run: runCrypto },
  { id: 'fx', every: 6e5, cap: 6e5, run: runFx },
  { id: 'file', every: 3e5, cap: 6e5, run: runFile }
];
jobs.forEach(j => { j.next = 0; j.fails = 0; j.okAt = 0; j.busy = false; });
// Called once a second (never while the tab is hidden). Failed sources back off exponentially.
function pump(now) {
  jobs.forEach(j => {
    if (j.busy || now < j.next) return;
    j.busy = true;
    j.run().then(() => { j.fails = 0; j.okAt = Date.now(); j.next = j.okAt + j.every; },
      () => { j.fails++; j.next = Date.now() + Math.min(j.cap, 15e3 * Math.pow(2, j.fails - 1)); })
      .then(() => { j.busy = false; drawSync(); refresh(); });
  });
}
function jobOk(j, now) { return j.okAt > 0 && now - j.okAt < j.every * 3 && !(j.id === 'file' && fileJob.stale); }
function drawSync() {
  const now = Date.now(), ok = jobs.filter(j => jobOk(j, now)), el = $('sync'); if (!el) return;
  const st = ok.length === jobs.length ? 'ok' : ok.length ? 'part' : 'off';
  el.setAttribute('data-st', st);
  const last = Math.max.apply(null, jobs.map(j => j.okAt));
  setTxt($('syncTxt'), st === 'off' ? t('sync_off') : t('sync_' + st) + ' · ' + clock(last));
  el.title = jobs.map(j => t('src_' + j.id) + ': ' + (jobOk(j, now) ? clock(j.okAt) : t('src_no'))).join('\n');
}

/* ---------- real candles from the exchange ---------- */
async function candles(sym, kind, limit) {
  const a = await getJSON(BN[bnHost] + '/api/v3/klines?symbol=' + INS[sym].bn + '&interval=' + kind + '&limit=' + limit);
  if (!Array.isArray(a)) throw new Error('shape');
  return a.filter(Array.isArray).map(k => ({ t: E.num(k[0]), h: E.num(k[2]), l: E.num(k[3]), c: E.num(k[4]) })).filter(k => k.c > 0 && k.t > 0);
}
async function loadCandles(sym, kind, limit) {
  if (!INS[sym].bn || !bnLive) return;
  try {
    const kl = await candles(sym, kind, limit);
    if (!E.setCandles(M, sym, kind, kl.map(k => k.c))) return;
    if (kind === '1m') {                       // also tells us what happened while the tab was closed
      const res = { liq: [] };
      E.sweepCandles(S, M, sym, kl.filter(k => k.h > 0 && k.l > 0), res); onLiq(res.liq);
    }
    if (ui.sym === sym || ui.view === 'market') refresh();
  } catch (e) { /* modelled history stays */ }
}
async function seedCandles() {
  for (let i = 0; i < BNS.length; i++) { await loadCandles(BNS[i], '1m', 240); await new Promise(r => setTimeout(r, 120)); }
}

/* ---------- daily history for the comparison chart ---------- */
const dayCache = {};                           // sym -> { at, pts: [[ms, value]], real }
let fxSeries = null;
function modelDaily(sym) {
  const I = INS[sym], p = M.px[sym], sig = I.vol * Math.sqrt(86400) * 0.3, now = Date.now();
  const b = E.bridge(91, p * Math.exp(sig * Math.sqrt(90) * 0.5 * E.gauss()), p, sig);
  return { at: now, real: false, pts: b.map((v, i) => [now - (90 - i) * 864e5, v]) };
}
async function histDaily(sym) {
  const c = dayCache[sym], now = Date.now(), I = INS[sym];
  if (c && (now - c.at < 6e5 || !c.real && now - c.at < 6e4)) return c;
  let out = null;
  try {
    if (I.bn) {
      let kl = null;
      for (let k = 0; k < BN.length && !kl; k++) {
        try { bnHost = (bnHost + k) % BN.length; kl = await candles(sym, '1d', 92); } catch (e) { kl = null; }
      }
      if (kl && kl.length > 5) out = { real: true, pts: kl.map(k => [k.t, k.c]) };
    } else if (I.fx) {
      if (!fxSeries || now - fxSeries.at > 36e5) {
        const from = new Date(now - 95 * 864e5).toISOString().slice(0, 10);
        const d = await getJSON('https://api.frankfurter.app/' + from + '..?from=USD&to=' + ECB.join(','));
        fxSeries = { at: now, rates: d && typeof d.rates === 'object' && d.rates ? d.rates : {} };
      }
      const pts = [];
      Object.keys(fxSeries.rates).sort().forEach(day => {
        const tms = Date.parse(day + 'T15:00:00Z'), row = fxSeries.rates[day], r = {};
        if (!isFinite(tms) || !row) return;
        FXC.forEach(x => { r[x] = E.num(row[x]); });
        const v = I.fx(r); if (v > 0 && isFinite(v)) pts.push([tms, v]);
      });
      if (pts.length > 5) out = { real: true, pts: pts };
    } else if (fileHist[sym] && fileHist[sym].ts > 0) {
      // numbers = closes of consecutive trading days ending at ts; [ms, close] pairs are accepted too
      const a = fileHist[sym].a, pts = []; let d = new Date(fileHist[sym].ts);
      for (let i = a.length - 1; i >= 0; i--) {
        if (Array.isArray(a[i])) { const v = E.num(a[i][1]), tm = E.num(a[i][0]); if (v > 0 && tm > 0) pts.unshift([tm, v]); continue; }
        const v = E.num(a[i]); if (v > 0) pts.unshift([d.getTime(), v]);
        do { d = new Date(d.getTime() - 864e5); } while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
      }
      if (pts.length > 5 && now - pts[pts.length - 1][0] < 6 * 864e5) out = { real: true, pts: pts };
    }
  } catch (e) { out = null; }
  if (!out) out = c && !c.real ? c : modelDaily(sym);       // keep one modelled line per session, do not reshuffle it
  out.at = now; dayCache[sym] = out;
  return out;
}

/* =====================================================================
   4. UI HELPERS, CHARTS
   innerHTML is used only with our own strings (dictionary, instrument table, numbers).
   Anything that came from the network is inserted with textContent.
   ===================================================================== */
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tk = sym => INS[sym].tk || sym;
let toastTo = 0;
function toast(msg, cls) {
  const el = $('toast'); if (!el) return;
  el.textContent = msg; el.className = 'toast on' + (cls ? ' ' + cls : '');
  clearTimeout(toastTo); toastTo = setTimeout(() => { el.className = 'toast'; }, 3200);
}
function stInfo(sym, big) {
  const now = Date.now(), st = E.status(M, sym, now), q = M.q[sym], I = INS[sym];
  let s = t('st_' + st);
  if (big) {
    if (st === 'live') s += ' · ' + clock(q.at) + (I.proxy ? ' · ' + t('st_proxy') + ' ' + I.proxy : '');
    else if (st === 'delayed') s += ' · ' + stamp(q.qt);
    else if (q && q.qt > 0) s += ' · ' + t('st_near') + ' ' + stamp(q.qt);
  }
  return [st, s];
}

const COL = { gold: '#C8A96A', up: '#7FBF9A', down: '#D98A7E', mut: '#A69F93', grid: 'rgba(255,255,255,.06)', txt: '#F3EEE6', bg: '#0E0D0C' };
const LINES = ['#C8A96A', '#7FBF9A', '#D98A7E', '#9DB4C8'];
// Skins: the palette lives in sim.css (html[data-skin]); canvases read it from there.
const SKINS = ['gold', 'sapphire', 'amethyst', 'aurora', 'platinum'];
function readSkin() {
  const cs = getComputedStyle(document.documentElement), v = n => (cs.getPropertyValue(n) || '').trim();
  const hex = (n, d) => /^#[0-9a-f]{6}$/i.test(v(n)) ? v(n) : d;
  COL.gold = hex('--gold', COL.gold); COL.up = hex('--up', COL.up); COL.down = hex('--down', COL.down);
  COL.mut = hex('--mut', COL.mut); COL.txt = hex('--txt', COL.txt); COL.bg = hex('--bg', COL.bg);
  LINES[0] = COL.gold; LINES[1] = COL.up; LINES[2] = COL.down; LINES[3] = hex('--l4', LINES[3]);
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', COL.bg);
}
function curSkin() { const k = document.documentElement.getAttribute('data-skin'); return SKINS.indexOf(k) < 0 ? 'gold' : k; }
function nextSkin() {
  const k = SKINS[(SKINS.indexOf(curSkin()) + 1) % SKINS.length];
  document.documentElement.setAttribute('data-skin', k);
  try { localStorage.setItem('dofa_sim_skin', k); } catch (e) {}
  readSkin(); render(); toast(t('skin_' + k));
}
function rgba(hex, a) { const n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; }

// Line chart on canvas. series: [{ pts: [[x, y]], color, name, dash }]
// o: { fx, fy, base, area, smooth, glow, empty, tip(series, point) }
function drawChart(cv, series, o) {
  if (!cv || !cv.getContext) return;
  const w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const g = cv.getContext('2d'); if (!g) return;
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  g.font = '10px "JetBrains Mono", monospace'; g.textBaseline = 'middle';
  series = series.filter(s => s.pts && s.pts.length > 1);
  if (!series.length) {
    g.fillStyle = COL.mut; g.textAlign = 'center'; g.font = '13px Onest, sans-serif'; g.fillText(o.empty || '', w / 2, h / 2); return;
  }
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  series.forEach(s => s.pts.forEach(p => { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }));
  if (o.base != null) { y0 = Math.min(y0, o.base); y1 = Math.max(y1, o.base); }
  if (y1 - y0 < Math.abs(y1) * 1e-6 + 1e-9) { const d = Math.abs(y1) * 0.001 || 1; y0 -= d; y1 += d; }
  const pad = (y1 - y0) * 0.1; y0 -= pad; y1 += pad;
  if (x1 === x0) x1 = x0 + 1;
  const L = 4, R = 62, T = 10, B = 22, pw = w - L - R, ph = h - T - B;
  const X = x => L + (x - x0) / (x1 - x0) * pw, Y = y => T + (y1 - y) / (y1 - y0) * ph;
  // grid + labels
  g.lineWidth = 1; g.textAlign = 'left';
  for (let i = 0; i <= 3; i++) {
    const v = y0 + (y1 - y0) * (i + 0.5) / 4, y = Math.round(Y(v)) + 0.5;
    g.strokeStyle = COL.grid; g.beginPath(); g.moveTo(L, y); g.lineTo(L + pw, y); g.stroke();
    g.fillStyle = COL.mut; g.fillText(o.fy(v), L + pw + 8, y);
  }
  if (o.fx) {
    g.fillStyle = COL.mut;
    g.textAlign = 'left'; g.fillText(o.fx(x0), L, h - 9);
    g.textAlign = 'center'; g.fillText(o.fx((x0 + x1) / 2), L + pw / 2, h - 9);
    g.textAlign = 'right'; g.fillText(o.fx(x1), L + pw, h - 9);
  }
  if (o.base != null) {
    const y = Math.round(Y(o.base)) + 0.5;
    g.strokeStyle = 'rgba(255,255,255,.22)'; g.setLineDash([3, 4]); g.beginPath(); g.moveTo(L, y); g.lineTo(L + pw, y); g.stroke(); g.setLineDash([]);
  }
  // lines
  series.forEach(s => {
    const p = s.pts; g.beginPath(); g.moveTo(X(p[0][0]), Y(p[0][1]));
    if (o.smooth && p.length > 2) {
      for (let i = 1; i < p.length - 1; i++) {
        const ax = X(p[i][0]), ay = Y(p[i][1]), bx = X(p[i + 1][0]), by = Y(p[i + 1][1]);
        g.quadraticCurveTo(ax, ay, (ax + bx) / 2, (ay + by) / 2);
      }
      g.lineTo(X(p[p.length - 1][0]), Y(p[p.length - 1][1]));
    } else for (let i = 1; i < p.length; i++) g.lineTo(X(p[i][0]), Y(p[i][1]));
    g.lineJoin = 'round'; g.lineCap = 'round'; g.lineWidth = 1.6; g.strokeStyle = s.color;
    if (s.dash) g.setLineDash([5, 5]);
    if (o.glow) { g.shadowColor = rgba(s.color, 0.55); g.shadowBlur = 12; }
    g.stroke(); g.shadowBlur = 0; g.setLineDash([]);
    if (o.area) {
      const yb = T + ph, gr = g.createLinearGradient(0, T, 0, yb);
      gr.addColorStop(0, rgba(s.color, 0.18)); gr.addColorStop(1, rgba(s.color, 0));
      g.lineTo(X(p[p.length - 1][0]), yb); g.lineTo(X(p[0][0]), yb); g.closePath(); g.fillStyle = gr; g.fill();
    }
    const e = p[p.length - 1];
    g.fillStyle = s.color; g.beginPath(); g.arc(X(e[0]), Y(e[1]), 2.6, 0, 6.3); g.fill();
  });
  // crosshair + tooltip
  if (cv._hx == null) return;
  const hx = Math.max(L, Math.min(L + pw, cv._hx)), xv = x0 + (hx - L) / pw * (x1 - x0);
  const rows = [];
  series.forEach(s => {
    let b = s.pts[0], bd = Infinity;
    for (let i = 0; i < s.pts.length; i++) { const d = Math.abs(s.pts[i][0] - xv); if (d < bd) { bd = d; b = s.pts[i]; } }
    rows.push({ s: s, p: b });
  });
  const px = X(rows[0].p[0]);
  g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1; g.beginPath(); g.moveTo(Math.round(px) + 0.5, T); g.lineTo(Math.round(px) + 0.5, T + ph); g.stroke();
  rows.forEach(r => {
    g.fillStyle = COL.bg; g.beginPath(); g.arc(X(r.p[0]), Y(r.p[1]), 4.5, 0, 6.3); g.fill();
    g.strokeStyle = r.s.color; g.lineWidth = 1.6; g.beginPath(); g.arc(X(r.p[0]), Y(r.p[1]), 4.5, 0, 6.3); g.stroke();
  });
  const head = o.fx ? o.fx(rows[0].p[0], true) : '';
  const txt = rows.map(r => (r.s.name ? r.s.name + '  ' : '') + (o.tip ? o.tip(r.s, r.p) : o.fy(r.p[1])));
  g.font = '11px "JetBrains Mono", monospace';
  let bw = g.measureText(head).width; txt.forEach(s => { bw = Math.max(bw, g.measureText(s).width + (rows.length > 1 ? 12 : 0)); });
  bw += 20; const bh = 12 + 16 * (txt.length + (head ? 1 : 0));
  let bx = px + 12; if (bx + bw > w - 4) bx = px - 12 - bw; if (bx < 4) bx = 4;
  const by = T + 4;
  g.fillStyle = 'rgba(24,22,20,.94)'; g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 1;
  g.beginPath();
  if (g.roundRect) g.roundRect(bx + 0.5, by + 0.5, bw, bh, 8); else g.rect(bx + 0.5, by + 0.5, bw, bh);
  g.fill(); g.stroke();
  g.textAlign = 'left'; let ty = by + 14;
  if (head) { g.fillStyle = COL.mut; g.fillText(head, bx + 10, ty); ty += 16; }
  txt.forEach((s, i) => {
    let tx = bx + 10;
    if (rows.length > 1) { g.fillStyle = rows[i].s.color; g.beginPath(); g.arc(tx + 3, ty, 3, 0, 6.3); g.fill(); tx += 12; }
    g.fillStyle = COL.txt; g.fillText(s, tx, ty); ty += 16;
  });
}
function bindHover(cv, redraw) {
  if (!cv || cv._bound || !cv.addEventListener) return; cv._bound = true;
  const mv = e => { const r = cv.getBoundingClientRect(); cv._hx = e.clientX - r.left; redraw(); };
  const out = () => { cv._hx = null; redraw(); };
  cv.addEventListener('pointerdown', mv); cv.addEventListener('pointermove', mv);
  cv.addEventListener('pointerleave', out); cv.addEventListener('pointercancel', out);
  cv.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') setTimeout(out, 1800); });
}
function sparkPts(a, w, h) {
  if (!a || a.length < 2) return '';
  const n = Math.min(40, a.length), st = (a.length - 1) / (n - 1); let lo = Infinity, hi = -Infinity; const v = [];
  for (let i = 0; i < n; i++) { const y = a[Math.round(i * st)]; v.push(y); if (y < lo) lo = y; if (y > hi) hi = y; }
  const d = hi - lo || 1;
  return v.map((y, i) => (i / (n - 1) * w).toFixed(1) + ',' + (2 + (hi - y) / d * (h - 4)).toFixed(1)).join(' ');
}
function sparkData(sym) { return (M.coarse[sym] || []).concat([M.px[sym]]); }

/* ---------- generic in-place updater (no re-render on tick, so taps are never lost) ---------- */
let sparkN = 0;
function upd(force) {
  const now = Date.now(), q = s => document.querySelectorAll(s);
  q('[data-px]').forEach(el => { const s = el.getAttribute('data-px'); if (INS[s]) setTxt(el, price(s, M.px[s])); });
  q('[data-ch]').forEach(el => { const s = el.getAttribute('data-ch'); if (INS[s]) { const c = E.chg24(M, s, now); setTxt(el, pct(c), c || 0); } });
  q('[data-stt]').forEach(el => {
    const s = el.getAttribute('data-stt'); if (!INS[s]) return;
    const a = stInfo(s, el.classList.contains('big')); el.setAttribute('data-st', a[0]); setTxt(el, a[1]);
  });
  q('[data-pos]').forEach(el => {
    const p = S.positions.find(x => String(x.id) === el.getAttribute('data-pos')); if (!p) return;
    const pr = M.px[p.sym], g = E.pnl(p, pr);
    setTxt(el.querySelector('[data-f="val"]'), money(E.posValue(p, pr)));
    setTxt(el.querySelector('[data-f="pnl"]'), signed(g) + ' · ' + pct(g / p.margin), g);
  });
  if (force || sparkN++ % 5 === 0) q('[data-spark]').forEach(el => {
    const s = el.getAttribute('data-spark'); if (!INS[s]) return;
    const sv = el.parentNode, vb = (sv.getAttribute('viewBox') || '0 0 60 26').split(' ');
    el.setAttribute('points', sparkPts(sparkData(s), +vb[2], +vb[3]));
    if (sv.classList.contains('r-spark')) { const c = E.chg24(M, s, now); sv.classList.toggle('up', c > 0); sv.classList.toggle('down', c < 0); }
  });
}

/* =====================================================================
   5. MARKET
   ===================================================================== */
const ICO = {
  crypto: '<circle cx="12" cy="12" r="8.5"/><path d="M12 6.5v11M9 9.5h4.2a1.6 1.6 0 010 3.2H9.6M9.6 12.7h4a1.6 1.6 0 010 3.2H9"/>',
  stocks: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6M20 16V6"/>',
  metals: '<path d="M7.5 9h9l2.5 6h-14z"/><path d="M3 20l1.5-4h6L12 20zM12 20l1.5-4h6L21 20z"/>',
  forex: '<path d="M4 9h14l-3-3M20 15H6l3 3"/>',
  commod: '<path d="M12 3.5c3 4 5.5 6.8 5.5 10a5.5 5.5 0 01-11 0c0-3.200 2.500-6 5.500-10z"/><path d="M9.5 14a2.5 2.5 0 002.5 2.5"/>',
  index: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.500V12l6 6"/><path d="M12 12H3.500"/>'
};
function posHTML(p) {
  const I = INS[p.sym];
  return '<div class="pos" data-pos="' + p.id + '"><div class="pos-top"><a href="#market/' + I.cat + '/' + p.sym + '"><b>' + esc(tk(p.sym)) + '</b>' +
    '<span class="badge ' + (p.side > 0 ? 'up' : 'down') + '">' + t(p.side > 0 ? 'side_up' : 'side_down') + ' ×' + p.lev + '</span></a>' +
    '<button class="btn-ghost" type="button" data-close="' + p.id + '">' + t('p_close') + '</button></div>' +
    '<div class="pos-grid"><div><span class="lbl">' + t('p_qty') + '</span><span class="num">' + qty(p.qty) + '</span></div>' +
    '<div><span class="lbl">' + t('p_avg') + '</span><span class="num">' + price(p.sym, p.entry) + '</span></div>' +
    '<div><span class="lbl">' + t('p_val') + '</span><span class="num" data-f="val"></span></div>' +
    '<div><span class="lbl">' + t('p_pnl') + '</span><span class="num" data-f="pnl"></span></div></div></div>';
}
const posSig = () => S.positions.map(p => p.id + ':' + p.qty.toPrecision(8)).join('|') + '#' + S.trades.length + '#' + (S.cash > 0);
function posList(el, list, emptyKey) {
  if (!el) return;
  el.innerHTML = list.length ? list.map(posHTML).join('') : '<p class="empty">' + t(emptyKey) + '</p>';
}

function renderMarket() {
  const box = $('marketBox'); if (!box) return;
  if (ui.sym) return renderIns(box);
  if (ui.cat) {
    const c = E.CAT[ui.cat];
    box.innerHTML = '<a class="crumb" href="#market"><span aria-hidden="true">←</span> ' + t('back_market') + '</a>' +
      '<div class="vhead"><h1>' + esc(L(c)) + '</h1></div><div class="rows">' +
      SYMS.filter(s => INS[s].cat === ui.cat).map(s =>
        '<a class="row" href="#market/' + ui.cat + '/' + s + '"><span class="r-id"><b>' + esc(tk(s)) + ' <i class="st" data-stt="' + s + '"></i></b><small>' + esc(L(INS[s])) + '</small></span>' +
        '<svg class="r-spark" viewBox="0 0 60 26" preserveAspectRatio="none" aria-hidden="true"><polyline data-spark="' + s + '"/></svg>' +
        '<span class="r-px"><b class="num" data-px="' + s + '"></b><em class="num" data-ch="' + s + '"></em></span></a>').join('') + '</div>';
    return;
  }
  box.innerHTML = '<div class="vhead"><p class="lbl">' + t('market_lbl') + '</p><h1>' + t('market_h') + '</h1><p class="sub">' + t('market_sub') + '</p></div><div class="cats">' +
    E.CATS.map(c => {
      const n = SYMS.filter(s => INS[s].cat === c.id).length;
      return '<a class="cat" href="#market/' + c.id + '"><i class="cat-glow" aria-hidden="true"></i><span class="cat-ico"><svg viewBox="0 0 24 24" aria-hidden="true">' + ICO[c.id] + '</svg></span>' +
        '<span class="cat-name">' + esc(L(c)) + '</span><span class="cat-meta lbl">' + n + ' ' + t('instr') + '</span>' +
        '<svg class="cat-spark" viewBox="0 0 100 36" preserveAspectRatio="none" aria-hidden="true"><polyline class="s1" data-spark="' + c.lead + '"/><polyline class="s2" pathLength="1" data-spark="' + c.lead + '"/></svg>' +
        '<span class="cat-lead"><b>' + esc(tk(c.lead)) + '</b><em class="num" data-ch="' + c.lead + '"></em></span></a>';
    }).join('') + '</div>';
}

const TFS = { '1m': ['fine', 60, 1], '5m': ['fine', 300, 1], '1h': ['coarse', 60, 60], '4h': ['coarse', 240, 60], '24h': ['day', 24, 3600] };
function insSeries() {
  const s = ui.sym, d = TFS[ui.tf] || TFS['5m'];
  let a = (M[d[0]][s] || []).slice(-d[1]);
  if (d[0] !== 'fine') a = a.concat([M.px[s]]);
  const n = a.length;
  return a.map((v, i) => [-(n - 1 - i) * d[2], v]);
}
function drawIns() {
  const cv = $('cv'); if (!cv || !ui.sym) return;
  const pts = insSeries(), up = pts.length > 1 && pts[pts.length - 1][1] >= pts[0][1], s = ui.sym;
  drawChart(cv, [{ pts: pts, color: up ? COL.up : COL.down }], { area: true, fy: v => price(s, v), fx: x => ago(Math.round(-x)) });
  const real = M.hk[s] === 'real' && TFS[ui.tf][0] !== 'fine' || E.status(M, s, Date.now()) === 'live' && TFS[ui.tf][0] === 'fine';
  setTxt($('cvNote'), t(real ? 'chart_real' : 'chart_synth'));
}
function renderIns(box) {
  const s = ui.sym, I = INS[s], c = E.CAT[I.cat];
  box.innerHTML = '<a class="crumb" href="#market/' + I.cat + '"><span aria-hidden="true">←</span> ' + esc(L(c)) + '</a>' +
    '<div class="ins-head"><div><p class="lbl">' + esc(tk(s)) + '</p><h1>' + esc(L(I)) + '</h1><span class="st big" data-stt="' + s + '"></span></div>' +
    '<div class="ins-px"><b class="num" data-px="' + s + '"></b><em><span class="num" data-ch="' + s + '"></span> ' + t('ch24') + '</em></div></div>' +
    '<div class="ins-grid"><div class="panel"><div class="chips">' +
    Object.keys(TFS).map(k => '<button class="chip' + (k === ui.tf ? ' on' : '') + '" type="button" data-tf="' + k + '">' + t('tf_' + k) + '</button>').join('') +
    '</div><canvas class="chart" id="cv"></canvas><p class="chart-note" id="cvNote"></p></div>' +
    '<div class="panel trade"><p class="lbl">' + t('tr_amount') + '</p>' +
    '<label class="field"><span>$</span><input id="amt" type="text" inputmode="decimal" autocomplete="off" maxlength="12" aria-label="' + t('tr_amount') + '"></label>' +
    '<div class="chips eq">' + [10, 25, 50, 100].map(p => '<button class="chip" type="button" data-pre="' + p + '">' + (p === 100 ? t('tr_all') : p + '%') + '</button>').join('') + '</div>' +
    '<p class="free"><span>' + t('tr_cash') + '</span><b class="num" id="trCash"></b></p>' +
    '<p class="lbl mt qrow">' + t('tr_lev') + qm('tip_lev') + '</p><div class="chips eq">' +
    E.LEVS.map(l => '<button class="chip' + (l === ui.lev ? ' on' : '') + '" type="button" data-lev="' + l + '">×' + l + '</button>').join('') + '</div>' +
    '<div class="warn" id="levWarn" hidden></div><p class="fee num" id="feeLine"></p>' +
    '<div class="sides"><button class="side buy" type="button" data-side="1"><b>' + t('tr_buy') + '</b><small>' + t('tr_buy_s') + '</small></button>' +
    '<button class="side sell" type="button" data-side="-1"><b>' + t('tr_sell') + '</b><small>' + t('tr_sell_s') + '</small></button></div>' +
    '<p class="msg" id="trMsg" role="status" aria-live="polite"></p></div></div>' +
    '<h2 class="h2">' + t('ins_pos') + '</h2><div class="poslist" id="insPos"></div>';
  posList($('insPos'), S.positions.filter(p => p.sym === s), 'pos_none');
  const inp = $('amt'); if (inp && inp.addEventListener) inp.addEventListener('input', tradeInfo);
  bindHover($('cv'), drawIns);
  tradeInfo(); drawIns();
  loadCandles(s, '1h', 24); loadCandles(s, '1s', 300);
}
function tradeInfo() {
  const inp = $('amt'); if (!inp) return;
  const a = parseAmt(inp.value), l = ui.lev;
  setTxt($('trCash'), money(S.cash));
  setTxt($('feeLine'), tf('tr_fee', { f: money(E.round2(a * l * E.FEE)), v: money(a * l) }));
  const w = $('levWarn');
  if (w) { w.hidden = l === 1; if (l > 1) setTxt(w, tf('lev_warn', { l: l, p: (100 / l).toFixed(0) })); }
  const m = $('trMsg');
  if (m && S.cash < 1 && !m.querySelector('.topup')) {
    needMoney(m);
  }
}
function doTrade(side) {
  const inp = $('amt'), m = $('trMsg'); if (!inp) return;
  const r = E.open(S, M, ui.sym, side, parseAmt(inp.value), ui.lev);
  if (!r.ok) { if (m) { if (r.err === 'funds' || S.cash < 1) needMoney(m, S.cash < 1 ? 'need_money' : 'err_funds'); else m.textContent = t('err_' + r.err); } vib(20); return; }
  if (m) m.textContent = '';
  inp.value = ''; snd.key(); vib(12);
  toast(tf('opened', { s: tk(ui.sym) + ' ×' + ui.lev }) + (r.imp ? '. ' + t('imp_note') : ''));
  save(); sig = ''; refresh();
}
function doClose(id) {
  const tr = E.close(S, M, id, false); if (!tr) return;
  if (tr.net > 0) { snd.win(); vib([12, 40, 12]); } else { snd.loss(); vib(40); }
  toast(tk(tr.sym) + ': ' + signed(tr.net), tr.net > 0 ? 'up' : tr.net < 0 ? 'down' : '');
  save(); sig = ''; refresh(); checkPause();
}
function onLiq(list) {
  if (!list || !list.length) return;
  list = list.filter(Boolean); if (!list.length) return;
  if (list.length === 1) toast(tf('liq_toast', { s: tk(list[0].sym), x: signed(list[0].net) }), 'down');
  else toast(tf('away_liq', { n: list.length }), 'down');
  snd.loss(); vib([30, 50, 30]); save(); sig = ''; checkPause();
}

/* =====================================================================
   6. MONEY (ATM), WALLET, TRUTH, PAUSE
   ===================================================================== */
Object.assign(T.ru, {
  nav_compare: 'Сравнить', nav_top: 'Топ',
  cmp_lbl: 'Два — четыре актива', cmp_h: 'Сравнение',
  cmp_sub: 'Выберите от двух до четырёх активов из любых разделов. Все линии начинаются со 100% — видно, кто вырос, а кто упал за период.',
  cmp_sel: 'Выбрано', cmp_add: 'Добавить из раздела', cmp_none: 'Ничего не выбрано', cmp_need: 'Выберите хотя бы два актива',
  cmp_max: 'Не больше четырёх активов', cmp_load: 'Загружаю историю…',
  per_7: '7 дней', per_30: 'Месяц', per_90: '3 месяца',
  cmp_real: 'Реальная история', cmp_model: 'Модель: настоящей истории нет',
  cmp_best: 'Лучший', cmp_worst: 'Худший', cmp_1000: 'Что стало бы с $1 000', cmp_res: 'За период',
  cmp_note: 'Криптовалюты и золото — дневные свечи Binance. Валюты — курсы ЕЦБ (frankfurter.app). Акции, индексы, сырьё — из нашего файла котировок. Пунктир и метка «Модель» — настоящей истории нет, линия смоделирована и ничего не доказывает.',
  top_lbl: 'Рейтинг месяца', top_h: 'Топ игроков',
  top_demo: 'Демо-рейтинг: игроки и результаты вымышлены, настоящий рейтинг появится позже.',
  top_you: 'Вы', top_you_note: 'Ваша строка настоящая: это результат вашего кошелька за всё время.',
  top_you_empty: 'Внесите игровые деньги — и ваша строка оживёт.', top_fav: 'любит', top_month: 'за месяц', top_all: 'за всё время', top_place: 'Ваше место: {n} из {m}'
});
Object.assign(T.en, {
  nav_compare: 'Compare', nav_top: 'Top',
  cmp_lbl: 'Two to four assets', cmp_h: 'Compare',
  cmp_sub: 'Pick two to four assets from any section. Every line starts at 100%, so you can see what rose and what fell over the period.',
  cmp_sel: 'Selected', cmp_add: 'Add from section', cmp_none: 'Nothing selected', cmp_need: 'Pick at least two assets',
  cmp_max: 'Four assets at most', cmp_load: 'Loading history…',
  per_7: '7 days', per_30: 'Month', per_90: '3 months',
  cmp_real: 'Real history', cmp_model: 'Model: no real history',
  cmp_best: 'Best', cmp_worst: 'Worst', cmp_1000: 'What $1,000 would have become', cmp_res: 'Over the period',
  cmp_note: 'Crypto and gold: Binance daily candles. Currencies: ECB rates (frankfurter.app). Stocks, indices, commodities: our quotes file. A dashed line with the “Model” label means there is no real history; the line is simulated and proves nothing.',
  top_lbl: 'Monthly ranking', top_h: 'Top players',
  top_demo: 'Demo ranking: players and results are fictional, a real ranking will come later.',
  top_you: 'You', top_you_note: 'Your row is real: it is your wallet result for all time.',
  top_you_empty: 'Deposit play money and your row comes alive.', top_fav: 'likes', top_month: 'this month', top_all: 'all time', top_place: 'Your place: {n} of {m}'
});

let sig = '', rollEnd = 0, tickN = 0;
function refreshMoney() { if (Date.now() >= rollEnd) setTxt($('atmBal'), money(S.cash)); }
function atmMsg(s, err) { const m = $('atmMsg'); if (m) { m.className = 'scr-msg num' + (err ? ' err' : ''); m.textContent = s; } }
function doDeposit(a) {
  if (!(a >= 1)) { atmMsg(t('atm_min'), true); vib(20); return; }
  const before = S.cash;
  if (a > 1e7 || !E.deposit(S, M, a)) { atmMsg(t('atm_max'), true); vib(20); return; }
  save(); atmMsg('+' + money(a)); const inp = $('atmInp'); if (inp) inp.value = '';
  const n = a >= 5e5 ? 8 : a >= 5e4 ? 6 : a >= 5e3 ? 5 : a >= 500 ? 4 : 3, lane = $('cashLane');
  snd.cash(n); vib([10, 30, 10, 30, 10]);
  if (lane && !RM) {
    lane.textContent = '';
    for (let i = 0; i < n; i++) { const b = document.createElement('div'); b.className = 'bill'; b.style.animationDelay = (i * 0.104) + 's'; lane.appendChild(b); }
    setTimeout(() => { lane.textContent = ''; }, n * 104 + 700);
  }
  const el = $('atmBal'), to = S.cash, t0 = Date.now(), dur = RM ? 0 : 900;
  rollEnd = t0 + dur;
  (function fr() {                      // balance counter rolls up
    const k = dur ? Math.min(1, (Date.now() - t0) / dur) : 1, e = 1 - Math.pow(1 - k, 3);
    setTxt(el, money(before + (to - before) * e));
    if (k < 1 && !document.hidden) requestAnimationFrame(fr);
  })();
}

function renderWallet() {
  const st = (id, k) => '<div class="stat"><span class="lbl">' + t(k) + '</span><span class="num" id="' + id + '"></span></div>';
  $('walletBox').innerHTML = '<div class="vhead"><p class="lbl">' + t('wallet_lbl') + '</p><h1>' + t('wallet_h') + '</h1></div>' +
    '<div class="panel hero"><p class="lbl">' + t('w_real') + '</p><div class="hero-num num" id="wRes"></div><p class="hero-sub"><span class="num" id="wPct"></span> ' + t('w_of_dep') + '</p></div>' +
    '<div class="stats">' + st('wEq', 'w_total') + st('wCash', 'w_cash') + st('wPos', 'w_inpos') + st('wDep', 'w_dep') + '</div>' +
    '<h2 class="h2">' + t('w_curve') + '</h2><div class="panel"><canvas class="chart sm" id="cvEq"></canvas></div>' +
    '<h2 class="h2">' + t('w_open') + '</h2><div class="poslist" id="wPosList"></div>' +
    '<h2 class="h2">' + t('w_hist') + '</h2><div id="wHist"></div>';
  bindHover($('cvEq'), drawEq);
  renderDyn();
}
function histHTML() {
  if (!S.trades.length) return '<p class="empty">' + t('hist_none') + '</p>';
  return '<div class="hist">' + S.trades.slice(0, 60).map(tr => INS[tr.sym] ?
    '<div class="hrow"><div><b>' + esc(tk(tr.sym)) + '</b><span class="badge ' + (tr.side > 0 ? 'up' : 'down') + '">' + t(tr.side > 0 ? 'side_up' : 'side_down') + ' ×' + tr.lev + '</span>' +
    '<small>' + stamp(tr.t) + ' · ' + price(tr.sym, tr.entry) + ' → ' + price(tr.sym, tr.exit) + (tr.liq ? ' · ' + t('liq_badge') : '') + '</small></div>' +
    '<span class="num ' + (tr.net > 0 ? 'up' : tr.net < 0 ? 'down' : '') + '">' + signed(tr.net) + '</span></div>' : '').join('') + '</div>';
}
function renderDyn() {
  if (ui.view === 'wallet') { posList($('wPosList'), S.positions, 'pos_none_all'); const h = $('wHist'); if (h) h.innerHTML = histHTML(); }
  if (ui.view === 'market' && ui.sym) posList($('insPos'), S.positions.filter(p => p.sym === ui.sym), 'pos_none');
}
function drawEq() {
  const cv = $('cvEq'); if (!cv) return;
  const pts = S.curve.map(c => [c[0], c[1]]);
  if (pts.length) pts.push([M.t, E.round2(E.equity(S, M) - S.deposited)]);
  const last = pts.length ? pts[pts.length - 1][1] : 0;
  drawChart(cv, [{ pts: pts, color: last >= 0 ? COL.up : COL.down }], { base: 0, area: false, glow: true, fy: v => compact(v), fx: x => stamp(x), tip: (s, p) => signed(p[1]), empty: t('curve_empty') });
}
function refreshWallet() {
  const st = E.stats(S, M);
  setTxt($('wRes'), tightS(st.result), st.result);
  setTxt($('wPct'), pct(S.deposited > 0 ? st.result / S.deposited : null), st.result);
  setTxt($('wEq'), money(st.equity)); setTxt($('wCash'), money(S.cash));
  setTxt($('wPos'), money(st.equity - S.cash)); setTxt($('wDep'), money(S.deposited));
  drawEq();
}

function renderTruth() {
  const st = (id, k) => '<div class="stat"><span class="lbl">' + t(k) + '</span><span class="num" id="' + id + '"></span></div>';
  const row = (id, k) => '<div class="cmp-row"><div class="cmp-top"><span>' + t(k) + '</span><span class="num" id="' + id + '"></span></div><div class="bar"><i id="' + id + 'B"></i></div></div>';
  $('truthBox').innerHTML = '<div class="vhead"><p class="lbl">' + t('truth_lbl') + '</p><h1>' + t('truth_h') + '</h1></div>' +
    '<p class="quote" id="tSum"></p><p class="tnote" id="tOpen"></p><p class="tnote" id="tImp"></p>' +
    '<div class="stats truth-stats">' + st('tN', 't_trades') + st('tWin', 't_winrate') + st('tFees', 't_fees') + st('tMax', 't_maxloss') + st('tImpN', 't_imp') + st('tLiq', 't_liq') + '</div>' +
    '<h2 class="h2">' + t('t_cmp') + '</h2><div class="panel cmp">' + row('cYou', 'cmp_you') + row('cHold', 'cmp_hold') + row('cIdx', 'cmp_index') + '</div>' +
    '<div class="truth-act"><button class="btn-ghost" type="button" data-act="pause">' + t('t_pause_btn') + '</button>' + qm('tip_pause') + '</div>';
}
function refreshTruth() {
  const st = E.stats(S, M), n = st.n; let s;
  if (!n) s = t('sum_none');
  else if (st.realized < 0) s = tf('sum_loss', { n: n, tr: tradesWord(n), x: money(-st.realized) });
  else if (st.realized > 0) s = tf('sum_win', { n: n, tr: tradesWord(n), x: money(st.realized), f: money(st.fees) });
  else s = tf('sum_flat', { n: n, tr: tradesWord(n) });
  setTxt($('tSum'), s);
  setTxt($('tOpen'), S.positions.length ? tf('t_open_note', { x: signed(st.result) }) : '');
  setTxt($('tImp'), st.opens ? tf('t_imp_line', { i: st.imp, o: st.opens }) : '');
  setTxt($('tN'), String(n)); setTxt($('tWin'), st.winRate == null ? '—' : Math.round(st.winRate * 100) + '%');
  setTxt($('tFees'), money(st.fees)); setTxt($('tMax'), money(st.maxLoss), st.maxLoss);
  setTxt($('tImpN'), st.imp + ' / ' + st.opens); setTxt($('tLiq'), String(st.liq));
  const mx = Math.max(Math.abs(st.result), Math.abs(st.bench), 1e-9);
  [['cYou', st.result], ['cHold', 0], ['cIdx', st.bench]].forEach(a => {
    setTxt($(a[0]), signed(a[1]), a[1]);
    const b = $(a[0] + 'B'); if (b) { b.style.width = (a[1] ? Math.max(2, Math.abs(a[1]) / mx * 100) : 0) + '%'; b.className = a[1] > 0 ? 'up' : a[1] < 0 ? 'down' : ''; }
  });
}

function showPause(manual) {
  const st = E.stats(S, M), k = S.agg.streak; let sum = 0;
  for (let i = 0; i < k && i < S.trades.length; i++) sum += S.trades[i].net;
  const cls = v => (v > 0 ? ' up' : v < 0 ? ' down' : '');
  $('modalBody').innerHTML = '<p class="lbl">' + t('pause_lbl') + '</p><h2 id="modalTitle">' + (manual || k < 1 ? t('pause_h_manual') : tf('pause_h', { n: k })) + '</h2><p>' + t('pause_p') + '</p>' +
    '<div class="breath" aria-hidden="true"><i></i><span>' + t('inhale') + '</span><span>' + t('exhale') + '</span></div><div class="m-nums">' +
    (k > 0 ? '<div><span>' + t('pause_streak') + '</span><span class="num' + cls(sum) + '">' + signed(E.round2(sum)) + '</span></div>' : '') +
    '<div><span>' + t('pause_total') + '</span><span class="num' + cls(st.result) + '">' + signed(st.result) + '</span></div></div>' +
    '<div class="m-btns"><button class="btn-gold" type="button" data-act="modal-close">' + t('pause_go') + '</button><a class="btn-ghost" href="#truth" data-act="modal-close">' + t('pause_nums') + '</a></div>';
  $('modal').hidden = false;
}
function checkPause() {
  const k = S.agg.streak;
  if (k >= 3 && k % 3 === 0 && ui.pauseAt !== k) { ui.pauseAt = k; showPause(false); }
  if (k === 0) ui.pauseAt = 0;
}

/* =====================================================================
   7. NEWS + LEARNING. Feed text is foreign: textContent only, https links only.
   ===================================================================== */
const NCATS = ['crypto', 'stocks', 'fintech', 'companies'];
let newsData = null, newsAt = 0, newsBusy = false;
function cleanNews(o) {
  if (!o || typeof o.title !== 'string' || typeof o.url !== 'string' || NCATS.indexOf(o.cat) < 0) return null;
  if (!/^https:\/\/[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(\/|$)/i.test(o.url)) return null;
  const title = o.title.trim().slice(0, 220); if (!title) return null;
  return { cat: o.cat, src: String(o.src || '').slice(0, 40), title: title, sum: typeof o.sum === 'string' ? o.sum.slice(0, 640) : '',
    url: o.url.slice(0, 600), ts: E.num(o.ts) > 0 ? E.num(o.ts) : 0 };
}
async function loadNews() {
  if (newsBusy || newsData && Date.now() - newsAt < 3e5) return;
  newsBusy = true;
  try {
    const d = await getJSON('news.json');
    newsData = { ts: E.num(d && d.ts) > 0 ? E.num(d.ts) : 0, items: (d && Array.isArray(d.items) ? d.items : []).map(cleanNews).filter(Boolean).slice(0, 120) };
  } catch (e) { if (!newsData) newsData = { ts: 0, items: [] }; }
  newsAt = Date.now(); newsBusy = false;
  if (ui.view === 'news') fillNews();
}
function renderNews() {
  $('newsBox').innerHTML = '<div class="vhead"><p class="lbl">' + t('news_lbl') + '</p><h1>' + t('news_h') + '</h1><p class="sub">' + t('news_sub') + '</p></div>' +
    '<div class="chips">' + ['all'].concat(NCATS).map(c => '<button class="chip' + (c === ui.ncat ? ' on' : '') + '" type="button" data-ncat="' + c + '">' + t('nc_' + c) + '</button>').join('') + '</div>' +
    '<p class="news-meta num" id="newsMeta"></p><div class="news" id="newsList"></div>' +
    '<h2 class="h2">' + t('learn_h') + '</h2><p class="sub">' + t('learn_sub') + '</p><div class="learn" style="margin-top:16px">' +
    t('learn').map(a => '<div class="lcard"><span class="soon">' + t('soon') + '</span><h3>' + esc(a[0]) + '</h3><p>' + esc(a[1]) + '</p></div>').join('') + '</div>';
  fillNews(); loadNews();
}
function fillNews() {
  const box = $('newsList'), meta = $('newsMeta'); if (!box) return;
  box.textContent = '';
  const mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  if (!newsData) { setTxt(meta, '…'); return; }
  if (!newsData.items.length) { setTxt(meta, ''); box.appendChild(mk('p', 'empty', t('news_none'))); return; }
  setTxt(meta, newsData.ts ? tf('news_upd', { t: stamp(newsData.ts) }) : '');
  const list = newsData.items.filter(n => ui.ncat === 'all' || n.cat === ui.ncat);
  if (!list.length) { box.appendChild(mk('p', 'empty', t('news_empty_cat'))); return; }
  list.forEach(n => {
    const a = mk('a', 'ncard'); a.href = n.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    const top = mk('div', 'ncard-top'); top.appendChild(mk('span', 'lbl', n.src + ' · ' + t('nc_' + n.cat)));
    if (n.ts) top.appendChild(mk('time', '', stamp(n.ts)));
    a.appendChild(top); a.appendChild(mk('h3', '', n.title));
    if (n.sum) a.appendChild(mk('p', '', n.sum));
    a.appendChild(mk('span', 'go', t('news_read') + ' →'));
    box.appendChild(a);
  });
}

/* =====================================================================
   8. TOP PLAYERS — a demo leaderboard. Every player except "You" is fictional,
   and the page says so in plain sight.
   ===================================================================== */
const PLAYERS = [
  ['Тихий Кит', 'Quiet Whale', 18.4, 250000, 'crypto'], ['Агент 47%', 'Agent 47%', 14.9, 40000, 'stocks'],
  ['Мистер Стоп-Лосс', 'Mister Stop-Loss', 11.2, 75000, 'index'], ['Золотая Пауза', 'Golden Pause', 8.7, 120000, 'metals'],
  ['Капитан Диверсификация', 'Captain Diversify', 6.3, 60000, 'index'], ['Барон Спред', 'Baron Spread', 4.8, 30000, 'forex'],
  ['Леди Хедж', 'Lady Hedge', 3.9, 90000, 'metals'], ['Доктор Усреднение', 'Doctor Average-Down', 2.1, 15000, 'stocks'],
  ['Медленный Бык', 'Slow Bull', 1.4, 50000, 'index'], ['Сэр Комиссия', 'Sir Fee', 0.6, 20000, 'forex'],
  ['Нефтяной Философ', 'Oil Philosopher', -0.9, 35000, 'commod'], ['Профессор Откат', 'Professor Pullback', -2.4, 25000, 'stocks'],
  ['Граф Маржин-Колл', 'Count Margin Call', -5.8, 80000, 'crypto'], ['Ночной Скальпер', 'Night Scalper', -8.3, 10000, 'crypto'],
  ['Плечо Десять', 'Leverage Ten', -14.6, 45000, 'crypto'], ['Мадам FOMO', 'Madame FOMO', -19.2, 18000, 'crypto'],
  ['Последний Шанс', 'Last Chance', -27.5, 12000, 'commod'], ['Всё На Красное', 'All On Red', -41.0, 5000, 'forex']
];
let topHTML = '';
function favCat() {                      // the user's favourite asset class, by number of trades and positions
  const n = {}; S.trades.forEach(x => { const I = INS[x.sym]; if (I) n[I.cat] = (n[I.cat] || 0) + 1; });
  S.positions.forEach(x => { const I = INS[x.sym]; if (I) n[I.cat] = (n[I.cat] || 0) + 1; });
  const k = Object.keys(n).sort((a, b) => n[b] - n[a]); return k.length ? k[0] : null;
}
function renderTop() {
  $('topBox').innerHTML = '<div class="vhead"><p class="lbl">' + t('top_lbl') + '</p><h1>' + t('top_h') + '</h1></div>' +
    '<p class="demo-note">' + t('top_demo') + '</p><p class="tnote" id="topMe"></p><div class="lb" id="lbList"></div>';
  topHTML = ''; refreshTop();
}
function refreshTop() {
  const box = $('lbList'); if (!box) return;
  const st = E.stats(S, M), has = S.deposited > 0, mine = has ? st.result / S.deposited * 100 : 0;
  const rows = PLAYERS.map(p => ({ name: S.lang === 'en' ? p[1] : p[0], pc: p[2], usd: E.round2(p[3] * p[2] / 100), cat: p[4] }));
  rows.push({ name: t('top_you'), pc: mine, usd: has ? st.result : 0, cat: favCat(), me: true });
  rows.sort((a, b) => b.pc - a.pc);
  const place = rows.findIndex(r => r.me) + 1;
  const h = rows.map((r, i) => '<div class="lrow' + (i < 3 ? ' top t' + (i + 1) : '') + (r.me ? ' me' : '') + '"><span class="l-rank num">' + (i + 1) + '</span>' +
    '<span class="l-name"><b>' + esc(r.name) + '</b><small>' + (r.cat ? t('top_fav') + ' ' + esc(L(E.CAT[r.cat]).toLowerCase()) + ' · ' : '') + t(r.me ? 'top_all' : 'top_month') + '</small></span>' +
    '<span class="l-res"><b class="num ' + (r.pc > 0 ? 'up' : r.pc < 0 ? 'down' : '') + '">' + pct(r.pc / 100) + '</b><small class="num">' + (r.usd > 0 ? '+' : '') + compact(r.usd) + '</small></span></div>').join('');
  if (h !== topHTML) { topHTML = h; box.innerHTML = h; }
  setTxt($('topMe'), (has ? tf('top_place', { n: place, m: rows.length }) + '. ' : t('top_you_empty') + ' ') + t('top_you_note'));
}

/* =====================================================================
   9. COMPARE — 2–4 assets normalised to 100% at the start of the period
   ===================================================================== */
let cmpData = {}, cmpTok = 0, cmpBusy = false;
function cmpSeries() {
  const cut = Date.now() - S.cmp.per * 864e5;
  return S.cmp.syms.map((s, i) => {
    const h = cmpData[s]; if (!h) return null;
    let k = 0; for (let j = 0; j < h.pts.length; j++) if (h.pts[j][0] <= cut) k = j;
    const a = h.pts.slice(k); if (a.length < 2) return null;
    const b = a[0][1];
    return { sym: s, real: h.real, color: LINES[i % 4], dash: !h.real, name: tk(s), pts: a.map(p => [p[0], p[1] / b * 100]), res: a[a.length - 1][1] / b - 1 };
  }).filter(Boolean);
}
const dm = x => { const d = new Date(x); return p2(d.getDate()) + '.' + p2(d.getMonth() + 1); };
function drawCmp() {
  const cv = $('cvCmp'); if (!cv) return;
  const n = S.cmp.syms.length;
  drawChart(cv, n >= 2 ? cmpSeries() : [], { base: 100, smooth: true, glow: true, fy: v => v.toFixed(v >= 1000 ? 0 : 1) + '%', fx: dm,
    tip: (s, p) => pct(p[1] / 100 - 1), empty: t(n < 2 ? 'cmp_need' : cmpBusy ? 'cmp_load' : 'cmp_need') });
}
function fillCmp() {
  const ser = S.cmp.syms.length >= 2 ? cmpSeries() : [], lg = $('cmpLegend'), tb = $('cmpTable');
  if (lg) lg.innerHTML = ser.map(s => '<div class="lg-row"><i class="dot" style="background:' + s.color + '"></i><span class="lg-name"><b class="num">' + esc(s.name) + '</b><small>' + esc(L(INS[s.sym])) + '</small>' +
    '<span class="st" data-st="' + (s.real ? 'delayed' : 'model') + '">' + t(s.real ? 'cmp_real' : 'cmp_model') + '</span></span>' +
    '<b class="num ' + (s.res > 0 ? 'up' : s.res < 0 ? 'down' : '') + '">' + pct(s.res) + '</b></div>').join('');
  if (!tb) return;
  if (ser.length < 2) { tb.innerHTML = ''; return; }
  const so = ser.slice().sort((a, b) => b.res - a.res), best = so[0], worst = so[so.length - 1];
  const r = (k, s) => '<div class="hrow"><div><b>' + t(k) + '</b><small>' + esc(s.name) + ' · ' + esc(L(INS[s.sym])) + (s.real ? '' : ' · ' + t('st_model')) + '</small></div><span class="num ' + (s.res > 0 ? 'up' : s.res < 0 ? 'down' : '') + '">' + pct(s.res) + '</span></div>';
  tb.innerHTML = '<div class="hist">' + r('cmp_best', best) + r('cmp_worst', worst) + '</div><h2 class="h2">' + t('cmp_1000') + '</h2><div class="hist">' +
    so.map(s => '<div class="hrow"><div><b>' + esc(s.name) + '</b><small>$1' + NB + '000 →' + (s.real ? '' : ' · ' + t('st_model')) + '</small></div><span class="num ' + (s.res > 0 ? 'up' : s.res < 0 ? 'down' : '') + '">' + money(1000 * (1 + s.res)) + '</span></div>').join('') + '</div>';
}
async function cmpLoad() {
  const tok = ++cmpTok, syms = S.cmp.syms.slice();
  cmpBusy = true; drawCmp();
  const out = {};
  for (let i = 0; i < syms.length; i++) { try { out[syms[i]] = await histDaily(syms[i]); } catch (e) { out[syms[i]] = modelDaily(syms[i]); } }
  if (tok !== cmpTok) return;
  cmpData = out; cmpBusy = false;
  if (ui.view === 'compare') { drawCmp(); fillCmp(); }
}
function renderCompare() {
  const c = S.cmp, cat = E.CAT[ui.ccat] ? ui.ccat : (ui.ccat = 'crypto');
  $('compareBox').innerHTML = '<div class="vhead"><p class="lbl">' + t('cmp_lbl') + '</p><h1>' + t('cmp_h') + '</h1><p class="sub">' + t('cmp_sub') + '</p></div>' +
    '<p class="lbl">' + t('cmp_sel') + '</p><div class="chips cmp-sel">' + (c.syms.length ? c.syms.map((s, i) =>
      '<button class="chip on" type="button" data-csym="' + s + '" aria-pressed="true"><i class="dot" style="background:' + LINES[i % 4] + '"></i>' + esc(tk(s)) + '<span class="x" aria-hidden="true">×</span></button>').join('') :
      '<span class="hint">' + t('cmp_none') + '</span>') + '</div>' +
    '<div class="chips per">' + [7, 30, 90].map(p => '<button class="chip' + (p === c.per ? ' on' : '') + '" type="button" data-per="' + p + '">' + t('per_' + p) + '</button>').join('') + '</div>' +
    '<div class="panel cmp-panel"><canvas class="chart" id="cvCmp"></canvas><div class="legend" id="cmpLegend"></div></div>' +
    '<div id="cmpTable" class="cmp-table"></div>' +
    '<h2 class="h2">' + t('cmp_add') + '</h2><div class="chips">' + E.CATS.map(k => '<button class="chip' + (k.id === cat ? ' on' : '') + '" type="button" data-ccat="' + k.id + '">' + esc(L(k)) + '</button>').join('') + '</div>' +
    '<div class="chips cmp-pick">' + SYMS.filter(s => INS[s].cat === cat).map(s => '<button class="chip' + (c.syms.indexOf(s) >= 0 ? ' on' : '') + '" type="button" data-csym="' + s + '" title="' + esc(L(INS[s])) + '">' + esc(tk(s)) + '</button>').join('') + '</div>' +
    '<p class="chart-note">' + t('cmp_note') + '</p>';
  bindHover($('cvCmp'), drawCmp);
  drawCmp(); fillCmp();
}
function cmpToggle(s) {
  const a = S.cmp.syms, i = a.indexOf(s);
  if (i >= 0) a.splice(i, 1); else if (a.length >= 4) { toast(t('cmp_max')); return; } else a.push(s);
  save(); renderCompare(); cmpLoad();
}

/* =====================================================================
   9b. BETS — live odds from the public Polymarket API (a prediction market: the price of an
   outcome is its chance, odds = 1 / price). Play money only. Every string that comes from the
   API is foreign data and reaches the page through textContent only.
   ===================================================================== */
Object.assign(T.ru, {
  nav_bets: 'Ставки', bet_lbl: 'Живые коэффициенты', bet_h: 'Ставки',
  bet_sub: 'Будущие события со всего мира: спорт, политика, крипта, экономика. Коэффициент считается из живой цены рынка прогнозов Polymarket: 1 / цена исхода. Ставите игровые деньги из того же кошелька.',
  bc_all: 'Все', bc_sports: 'Спорт', bc_esports: 'Киберспорт', bc_politics: 'Политика', bc_world: 'Мир', bc_crypto: 'Крипта', bc_economy: 'Экономика', bc_finance: 'Финансы', bc_tech: 'Технологии', bc_culture: 'Культура',
  bet_upd: 'Коэффициенты на {t} · источник Polymarket', bet_load: 'Загружаем коэффициенты…', bet_err: 'Источник коэффициентов сейчас не отвечает. Попробуйте обновить через минуту.',
  bet_none: 'В этой рубрике сейчас нет открытых событий.', bet_more: 'Показать ещё', bet_refresh: 'Обновить', bet_until: 'до {t}', bet_vol: 'оборот за сутки {v}',
  bet_yes: 'Да', bet_no: 'Нет', bet_rest: 'ещё исходов: {n}',
  bet_slip: 'Ваша ставка', bet_amt: 'Сумма, $', bet_cash: 'В кошельке', bet_win: 'Выплата, если сыграет', bet_chance: 'Шанс по рынку', bet_go: 'Поставить', bet_cancel: 'Отмена', bet_max: 'Всё',
  bet_min: 'Минимальная ставка — $1.', bet_funds: 'В кошельке не хватает денег. Пополнить можно в разделе «Деньги».', bet_closed: 'Приём ставок на этот исход закрыт.', bet_many: 'Открыто слишком много ставок. Дождитесь расчёта или продайте часть.',
  bet_done: 'Ставка принята, коэффициент {k}', bet_my: 'Мои ставки', bet_my_none: 'Ставок пока нет. Нажмите на коэффициент у любого события.',
  bet_stake: 'ставка', bet_now: 'сейчас', bet_sell: 'Продать', bet_sold: 'Ставка продана: {v}', bet_settled: 'Ставки рассчитаны: {v}',
  bet_hist: 'Рассчитанные', how_win: 'сыграла', how_lose: 'не сыграла', how_sold: 'продана', how_void: 'возврат',
  bs_n: 'Ставок сделано', bs_won: 'Из них в плюс', bs_staked: 'Поставлено', bs_paid: 'Вернулось', bs_open: 'Сейчас в игре', bs_net: 'Итог по ставкам',
  bet_note: 'Коэффициент здесь честный: в нём нет доли букмекера. У настоящих букмекеров он ниже — в каждую ставку заложена их прибыль, поэтому на длинной дистанции игрок там в минусе. Названия событий приходят на английском, как в источнике. Деньги игровые, вывести их нельзя.'
});
Object.assign(T.en, {
  nav_bets: 'Bets', bet_lbl: 'Live odds', bet_h: 'Bets',
  bet_sub: 'Upcoming events from around the world: sports, politics, crypto, the economy. Odds come from the live price on the Polymarket prediction market: 1 / outcome price. You bet play money from the same wallet.',
  bc_all: 'All', bc_sports: 'Sports', bc_esports: 'Esports', bc_politics: 'Politics', bc_world: 'World', bc_crypto: 'Crypto', bc_economy: 'Economy', bc_finance: 'Finance', bc_tech: 'Tech', bc_culture: 'Culture',
  bet_upd: 'Odds as of {t} · source: Polymarket', bet_load: 'Loading odds…', bet_err: 'The odds source is not responding right now. Try refreshing in a minute.',
  bet_none: 'No open events in this section right now.', bet_more: 'Show more', bet_refresh: 'Refresh', bet_until: 'until {t}', bet_vol: '24h volume {v}',
  bet_yes: 'Yes', bet_no: 'No', bet_rest: 'more outcomes: {n}',
  bet_slip: 'Your bet', bet_amt: 'Amount, $', bet_cash: 'In wallet', bet_win: 'Payout if it wins', bet_chance: 'Market chance', bet_go: 'Place bet', bet_cancel: 'Cancel', bet_max: 'All',
  bet_min: 'The minimum bet is $1.', bet_funds: 'Not enough money in the wallet. Top up in the Money section.', bet_closed: 'Betting on this outcome is closed.', bet_many: 'Too many open bets. Wait for settlement or sell some.',
  bet_done: 'Bet placed, odds {k}', bet_my: 'My bets', bet_my_none: 'No bets yet. Tap the odds on any event.',
  bet_stake: 'stake', bet_now: 'now', bet_sell: 'Sell', bet_sold: 'Bet sold: {v}', bet_settled: 'Bets settled: {v}',
  bet_hist: 'Settled', how_win: 'won', how_lose: 'lost', how_sold: 'sold', how_void: 'refund',
  bs_n: 'Bets placed', bs_won: 'Ended in profit', bs_staked: 'Staked', bs_paid: 'Returned', bs_open: 'In play now', bs_net: 'Betting result',
  bet_note: 'The odds here are fair: there is no bookmaker margin in them. Real bookmakers pay less — their profit is built into every bet, so over a long run the player loses there. Event names come in English, as in the source. This is play money and cannot be withdrawn.'
});
const PM = 'https://gamma-api.polymarket.com/markets';
const BCATS = [['all', 0], ['sports', 1], ['esports', 64], ['politics', 2], ['world', 100265], ['crypto', 21], ['economy', 100328], ['finance', 120], ['tech', 1401], ['culture', 596]];
const BPAGE = 60, BLO = 0.02, BHI = 0.98;
let betEv = [], betMk = {}, betAt = 0, betCat = '', betBusy = false, betErr = false, betOff = 0, betMore = false, betChk = false, betChkAt = 0;
function bst() {
  if (!Array.isArray(S.bets)) S.bets = [];
  if (!Array.isArray(S.betHist)) S.betHist = [];
  if (!S.betAgg || typeof S.betAgg !== 'object') S.betAgg = { n: 0, won: 0, staked: 0, paid: 0 };
  return S;
}
// Pictures: only from Polymarket's own image store, nothing else is ever put into src.
const bimg = u => (typeof u === 'string' && /^https:\/\/polymarket-upload\.s3\.us-east-2\.amazonaws\.com\/[\w.\-\/%+]{1,200}\.(png|jpe?g|webp)$/i.test(u) ? u : '');
function badge(name) {
  const w = String(name).replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  const ini = (w.length > 1 ? w[0][0] + w[1][0] : (w[0] || '?').slice(0, 2)).toUpperCase();
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  const s = mkEl('span', 'tbadge', ini); s.style.setProperty('--h', h); s.setAttribute('aria-hidden', 'true'); return s;
}
function cleanMk(o) {
  if (!o || !/^\d{1,12}$/.test(String(o.id)) || typeof o.question !== 'string') return null;
  let out, pr;
  try { out = JSON.parse(o.outcomes); pr = JSON.parse(o.outcomePrices).map(Number); } catch (e) { return null; }
  if (!Array.isArray(out) || out.length !== 2 || !Array.isArray(pr) || pr.length !== 2 || !pr.every(p => p >= 0 && p <= 1)) return null;
  const ev = Array.isArray(o.events) && o.events[0] ? o.events[0] : {};
  return { id: String(o.id), q: o.question.trim().slice(0, 200), g: typeof o.groupItemTitle === 'string' ? o.groupItemTitle.trim().slice(0, 80) : '',
    out: out.map(x => String(x).trim().slice(0, 40)), pr: pr, end: Date.parse(o.endDate) || 0, closed: o.closed === true, vol: +o.volume24hr > 0 ? +o.volume24hr : 0,
    img: bimg(ev.icon) || bimg(ev.image) || bimg(o.icon) || bimg(o.image),
    ev: /^\d{1,12}$/.test(String(ev.id)) ? String(ev.id) : 'm' + o.id, et: typeof ev.title === 'string' ? ev.title.trim().slice(0, 160) : '' };
}
const coef = p => { const k = 1 / p; return fixed(k, k >= 10 ? 1 : 2); };
const chance = p => (p < 0.1 ? (p * 100).toFixed(1) : Math.round(p * 100)) + '%';
const bvol = v => '$' + (v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? Math.round(v / 1e3) + 'K' : Math.round(v));
function bdate(ms) { const d = new Date(ms); return ms - Date.now() > 2.6e10 ? p2(d.getDate()) + '.' + p2(d.getMonth() + 1) + '.' + d.getFullYear() : stamp(ms); }
const oname = s => (s === 'Yes' ? t('bet_yes') : s === 'No' ? t('bet_no') : s);
const mkEl = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

// Money is missing or not enough: the same message with a top-up button everywhere.
Object.assign(T.ru, { topup: 'Пополнить кошелёк', need_more: 'В кошельке не хватает денег.', tip_aria: 'Что это?',
  tip_pause: 'Откроет минуту тишины: дыхание на четыре счёта и ваш общий итог. Сделки не закрывает и торговать не запрещает. Сама появляется после трёх убыточных сделок подряд.',
  tip_lev: 'Плечо умножает и прибыль, и убыток. При ×10 цена, ушедшая против вас на 10%, съедает всю сумму сделки — позицию закроет автоматически.',
  tip_sell: 'Забрать деньги до исхода события по текущему коэффициенту: шанс вырос — вернётся больше ставки, упал — меньше.' });
Object.assign(T.en, { topup: 'Top up the wallet', need_more: 'Not enough money in the wallet.', tip_aria: 'What is this?',
  tip_pause: 'Opens a quiet minute: four-count breathing and your overall result. It does not close trades or block trading. It also appears by itself after three losing trades in a row.',
  tip_lev: 'Leverage multiplies both profit and loss. At ×10 a 10% move against you wipes out the whole amount and the position is closed automatically.',
  tip_sell: 'Take the money back before the event ends at the current odds: more than the stake if the chance went up, less if it went down.' });
function needMoney(el, key) {
  if (!el) return;
  el.textContent = '';
  el.appendChild(mkEl('span', 'need-t', t(key || (S.cash < 1 ? 'need_money' : 'need_more'))));
  const a = mkEl('a', 'btn-gold topup', t('topup')); a.href = '#money'; a.setAttribute('data-act', 'modal-close'); el.appendChild(a);
}
const qm = k => '<button class="qm" type="button" data-tip="' + k + '" aria-label="' + t('tip_aria') + '">?</button>';
function showTip(el) {
  const old = document.querySelector('.tipbox'), mine = old && old.previousElementSibling === el;
  if (old) old.remove();
  if (mine) return;
  const b = mkEl('span', 'tipbox', t(el.getAttribute('data-tip'))); b.setAttribute('role', 'note');
  el.insertAdjacentElement('afterend', b);
}

// Bottom bar: four main sections and "More" with a slide-up sheet for the rest.
const MORE = ['news', 'truth', 'compare', 'top'];
Object.assign(T.ru, { nav_more: 'Ещё', more_title: 'Ещё разделы', more_news: 'Что пишут о рынках за сутки', more_truth: 'Честный итог ваших сделок',
  more_compare: 'Два графика на одном экране', more_top: 'Лучшие результаты' });
Object.assign(T.en, { nav_more: 'More', more_title: 'More sections', more_news: 'What the press says today', more_truth: 'The honest result of your trades',
  more_compare: 'Two charts on one screen', more_top: 'Best results' });
function moreSheet(open) {
  const m = $('more'), b = $('moreBtn'); if (!m) return;
  m.hidden = !open; if (b) b.setAttribute('aria-expanded', open ? 'true' : 'false');
}

async function loadBets(more) {
  if (betBusy) return;
  betBusy = true;
  const cat = ui.bcat, tag = (BCATS.filter(c => c[0] === cat)[0] || BCATS[0])[1], off = more ? betOff : 0;
  if (cat !== betCat) { betEv = []; betAt = 0; betErr = false; fillBets(); }
  try {
    const d = await getJSON(PM + '?closed=false&active=true&order=volume24hr&ascending=false&limit=' + BPAGE + '&offset=' + off + (tag ? '&tag_id=' + tag + '&related_tags=true' : ''), 15000);
    if (cat !== ui.bcat) { betBusy = false; return loadBets(); }
    const now = Date.now(), raw = Array.isArray(d) ? d : [];
    const ev = more ? betEv : [];
    raw.map(cleanMk).filter(m => m && !m.closed && m.end > now && m.pr[0] >= BLO && m.pr[0] <= BHI).forEach(m => {
      betMk[m.id] = m;
      let e = ev.filter(x => x.id === m.ev)[0];
      if (!e) { e = { id: m.ev, t: m.et || m.q, end: m.end, vol: 0, m: [] }; ev.push(e); }
      if (!e.m.some(x => x.id === m.id)) { e.m.push(m); e.vol += m.vol; if (m.end < e.end) e.end = m.end; }
    });
    betEv = ev; betCat = cat; betOff = off + BPAGE; betMore = raw.length >= BPAGE && betOff < 600; betErr = false; betAt = now;
  } catch (e) { betErr = true; betCat = cat; }
  betBusy = false;
  if (ui.view === 'bets') fillBets();
}
function renderBets() {
  bst();
  $('betsBox').innerHTML = '<div class="vhead"><p class="lbl">' + t('bet_lbl') + '</p><h1>' + t('bet_h') + '</h1><p class="sub">' + t('bet_sub') + '</p></div>' +
    '<div id="betMine"></div>' +
    '<div class="chips bcats">' + BCATS.map(c => '<button class="chip' + (c[0] === ui.bcat ? ' on' : '') + '" type="button" data-bcat="' + c[0] + '">' + t('bc_' + c[0]) + '</button>').join('') + '</div>' +
    '<div class="bet-bar"><p class="news-meta num" id="betMeta"></p><button class="btn-ghost" type="button" data-act="bet-refresh">' + t('bet_refresh') + '</button></div>' +
    '<div class="bets" id="betList"></div><div class="bet-more" id="betMoreBox"></div>' +
    '<p class="chart-note">' + t('bet_note') + '</p>';
  fillMine(); fillBets();
  if (betCat !== ui.bcat || Date.now() - betAt > 6e4) loadBets();
  checkBets();
}
function fillBets() {
  const box = $('betList'), meta = $('betMeta'), mb = $('betMoreBox'); if (!box) return;
  box.textContent = ''; if (mb) mb.textContent = '';
  if (betCat !== ui.bcat || (!betAt && !betErr)) { setTxt(meta, t('bet_load')); return; }
  if (betErr && !betEv.length) { setTxt(meta, ''); box.appendChild(mkEl('p', 'empty', t('bet_err'))); return; }
  setTxt(meta, tf('bet_upd', { t: clock(betAt) }));
  if (!betEv.length) { box.appendChild(mkEl('p', 'empty', t('bet_none'))); }
  betEv.forEach(e => {
    const card = mkEl('article', 'bcard'), top = mkEl('div', 'ncard-top');
    top.appendChild(mkEl('span', 'lbl', tf('bet_until', { t: bdate(e.end) })));
    if (e.vol >= 1000) top.appendChild(mkEl('time', '', tf('bet_vol', { v: bvol(e.vol) })));
    card.appendChild(top);
    const hd = mkEl('div', 'bhead'), pic = e.m[0] && e.m[0].img;
    if (pic) { const im = mkEl('img', 'bpic'); im.alt = ''; im.loading = 'lazy'; im.decoding = 'async'; im.referrerPolicy = 'no-referrer'; im.width = 48; im.height = 48; im.onerror = () => im.remove(); im.src = pic; hd.appendChild(im); }
    hd.appendChild(mkEl('h3', '', e.t)); card.appendChild(hd);
    e.m.slice(0, 6).forEach(m => {
      const row = mkEl('div', 'brow'), lab = m.g || (m.q !== e.t ? m.q : '');
      if (lab) row.appendChild(mkEl('p', 'bq', lab));
      const od = mkEl('div', 'bodds');
      m.out.forEach((o, i) => {
        const b = mkEl('button', 'odd'); b.type = 'button'; b.setAttribute('data-bet', m.id); b.setAttribute('data-oi', i);
        const yn = o === 'Yes' || o === 'No'; b.appendChild(yn ? mkEl('span', 'tbadge ' + (o === 'Yes' ? 'yes' : 'no'), o === 'Yes' ? '\u2713' : '\u2715') : badge(o)); b.appendChild(mkEl('span', 'odd-n', oname(o))); b.appendChild(mkEl('b', 'num', coef(m.pr[i]))); b.appendChild(mkEl('i', 'num', chance(m.pr[i])));
        od.appendChild(b);
      });
      row.appendChild(od); card.appendChild(row);
    });
    if (e.m.length > 6) card.appendChild(mkEl('p', 'hint', tf('bet_rest', { n: e.m.length - 6 })));
    box.appendChild(card);
  });
  if (mb && betMore) { const b = mkEl('button', 'btn-ghost', t('bet_more')); b.type = 'button'; b.setAttribute('data-act', 'bet-more'); mb.appendChild(b); }
}
function fillMine() {
  const box = $('betMine'); if (!box) return;
  bst(); box.textContent = '';
  if (!S.bets.length && !S.betHist.length) return;
  box.appendChild(mkEl('h2', 'h2 bet-h2', t('bet_my')));
  const list = mkEl('div', 'bmine');
  S.bets.forEach(b => {
    const val = E.round2(b.a / b.p * (b.cur >= 0 ? b.cur : b.p)), row = mkEl('div', 'bm'), l = mkEl('div', 'bm-l'), r = mkEl('div', 'bm-r');
    l.appendChild(mkEl('p', 'bm-q', b.q));
    l.appendChild(mkEl('p', 'bm-s num', oname(b.o) + ' · ' + coef(b.p) + ' · ' + t('bet_stake') + ' ' + money(b.a) + ' · ' + tf('bet_until', { t: bdate(b.end) })));
    r.appendChild(mkEl('span', 'num' + (val > b.a ? ' up' : val < b.a ? ' down' : ''), t('bet_now') + ' ' + money(val)));
    const s = mkEl('button', 'btn-ghost bm-sell', t('bet_sell')); s.type = 'button'; s.setAttribute('data-bsell', b.id); const sw = mkEl('span', 'qrow'); sw.appendChild(s); sw.insertAdjacentHTML('beforeend', qm('tip_sell')); r.appendChild(sw);
    row.appendChild(l); row.appendChild(r); list.appendChild(row);
  });
  if (!S.bets.length) list.appendChild(mkEl('p', 'empty', t('bet_my_none')));
  box.appendChild(list);
  if (S.betHist.length) {
    box.appendChild(mkEl('p', 'lbl bet-hl', t('bet_hist')));
    const h = mkEl('div', 'bmine');
    S.betHist.slice(0, 8).forEach(x => {
      const row = mkEl('div', 'bm done'), l = mkEl('div', 'bm-l'), net = E.round2(x.pay - x.a);
      l.appendChild(mkEl('p', 'bm-q', x.q));
      l.appendChild(mkEl('p', 'bm-s num', oname(x.o) + ' · ' + coef(x.p) + ' · ' + t('bet_stake') + ' ' + money(x.a) + ' · ' + t('how_' + x.how)));
      row.appendChild(l); row.appendChild(mkEl('span', 'num bm-net' + (net > 0 ? ' up' : net < 0 ? ' down' : ''), signed(net)));
      h.appendChild(row);
    });
    box.appendChild(h);
  }
  const A = S.betAgg, open = E.round2(S.bets.reduce((s, b) => s + b.a, 0)), net = E.round2(A.paid - (A.staked - open));
  const sum = mkEl('div', 'panel m-nums bet-sum');
  [[t('bs_n'), String(A.n), ''], [t('bs_won'), String(A.won), ''], [t('bs_staked'), money(A.staked), ''], [t('bs_paid'), money(A.paid), ''], [t('bs_open'), money(open), ''],
    [t('bs_net'), signed(net), net > 0 ? ' up' : net < 0 ? ' down' : '']].forEach(a => {
    const d = mkEl('div'); d.appendChild(mkEl('span', '', a[0])); d.appendChild(mkEl('span', 'num' + a[2], a[1])); sum.appendChild(d);
  });
  box.appendChild(sum);
}
function betInfo() {
  const b = ui.bet, m = b && betMk[b.id]; if (!m) return;
  const a = parseAmt(($('betAmt') || {}).value), p = m.pr[b.oi];
  setTxt($('betWin'), a > 0 ? money(E.round2(a / p)) : '—');
  const msg = $('betMsg'); if (!msg) return;
  if (S.cash < 1 || a > S.cash + 1e-9) needMoney(msg); else msg.textContent = '';
}
function openBet(id, oi) {
  const m = betMk[id]; if (!m || !(oi === 0 || oi === 1)) return;
  ui.bet = { id: id, oi: oi };
  const mx = Math.floor(S.cash * 100) / 100;
  $('modalBody').innerHTML = '<p class="lbl">' + t('bet_slip') + '</p><h2 class="bet-q" id="modalTitle"></h2><p class="bet-pick"><span id="betPick"></span><b class="num" id="betK"></b></p>' +
    '<input class="bet-inp num" id="betAmt" type="text" inputmode="decimal" autocomplete="off" maxlength="10" placeholder="' + t('bet_amt') + '" aria-label="' + t('bet_amt') + '">' +
    '<div class="chips eq">' + [10, 50, 100].map(v => '<button class="chip" type="button" data-bpre="' + v + '">$' + v + '</button>').join('') + '<button class="chip" type="button" data-bpre="' + mx + '">' + t('bet_max') + '</button></div>' +
    '<div class="m-nums"><div><span>' + t('bet_cash') + '</span><span class="num">' + money(S.cash) + '</span></div><div><span>' + t('bet_chance') + '</span><span class="num" id="betCh"></span></div>' +
    '<div><span>' + t('bet_win') + '</span><span class="num up" id="betWin">—</span></div></div><p class="bet-msg" id="betMsg" role="alert"></p>' +
    '<div class="m-btns"><button class="btn-gold" type="button" data-act="bet-ok">' + t('bet_go') + '</button><button class="btn-ghost" type="button" data-act="modal-close">' + t('bet_cancel') + '</button></div>';
  setTxt($('modalTitle'), m.et && m.et !== m.q ? m.et + ' — ' + (m.g || m.q) : m.q);
  setTxt($('betPick'), oname(m.out[oi])); setTxt($('betK'), coef(m.pr[oi])); setTxt($('betCh'), chance(m.pr[oi]));
  const inp = $('betAmt'); if (inp && inp.addEventListener) inp.addEventListener('input', betInfo);
  betInfo();
  $('modal').hidden = false;
}
function doBet() {
  const b = ui.bet, m = b && betMk[b.id], msg = $('betMsg'); if (!m) return;
  bst();
  const a = E.round2(parseAmt(($('betAmt') || {}).value)), p = m.pr[b.oi];
  if (S.cash < 1 || a > S.cash + 1e-9) { needMoney(msg); vib(20); return; }
  if (!(a >= 1)) { setTxt(msg, t('bet_min')); return; }
  if (!(p >= BLO && p <= BHI) || m.end <= Date.now()) { setTxt(msg, t('bet_closed')); return; }
  if (S.bets.length >= 40) { setTxt(msg, t('bet_many')); return; }
  S.cash = E.round2(S.cash - a);
  S.bets.unshift({ id: S.nextId++, mk: m.id, q: m.et && m.et !== m.q ? m.et + ' — ' + (m.g || m.q) : m.q, o: m.out[b.oi], oi: b.oi, p: p, cur: p, a: a, at: Date.now(), end: m.end });
  S.betAgg.n++; S.betAgg.staked = E.round2(S.betAgg.staked + a);
  save(); $('modal').hidden = true; ui.bet = null; if (S.sound) snd.key(); vib(12);
  toast(tf('bet_done', { k: coef(p) })); render();
}
function closeBet(b, price, how) {
  const pay = E.round2(b.a / b.p * Math.max(0, Math.min(1, price)));
  S.cash = E.round2(S.cash + pay); S.betAgg.paid = E.round2(S.betAgg.paid + pay); if (pay > b.a) S.betAgg.won++;
  S.bets = S.bets.filter(x => x !== b);
  S.betHist.unshift({ q: b.q, o: b.o, p: b.p, a: b.a, pay: pay, how: how, at: Date.now() });
  if (S.betHist.length > 60) S.betHist.length = 60;
  return pay;
}
async function checkBets(force) {
  bst();
  if (!S.bets.length || betChk || (!force && Date.now() - betChkAt < 6e4)) return;
  betChk = true; betChkAt = Date.now();
  const ids = S.bets.map(b => b.mk).filter((x, i, a) => /^\d{1,12}$/.test(x) && a.indexOf(x) === i).slice(0, 40), q = ids.map(i => 'id=' + i).join('&');
  try {
    const r = await Promise.all([getJSON(PM + '?' + q + '&limit=100', 15000), getJSON(PM + '?closed=true&' + q + '&limit=100', 15000)]);
    const got = {}; let total = 0, n = 0;
    r.forEach(a => (Array.isArray(a) ? a : []).map(cleanMk).filter(Boolean).forEach(m => { got[m.id] = m; }));
    S.bets.slice().forEach(b => {
      const m = got[b.mk]; if (!m) return;
      b.cur = m.pr[b.oi]; if (m.end) b.end = m.end;
      if (m.closed) { total += closeBet(b, b.cur, b.cur >= 0.99 ? 'win' : b.cur <= 0.01 ? 'lose' : 'void'); n++; }
    });
    save();
    if (n) { toast(tf('bet_settled', { v: money(E.round2(total)) })); sig = ''; }
    if (ui.view === 'bets') fillMine();
  } catch (e) {}
  betChk = false;
}
async function sellBet(id) {
  bst();
  await checkBets(true);
  const b = S.bets.filter(x => x.id === id)[0]; if (!b) { if (ui.view === 'bets') fillMine(); return; }
  const pay = closeBet(b, b.cur >= 0 ? b.cur : b.p, 'sold');
  save(); toast(tf('bet_sold', { v: money(pay) })); render();
}
function betTick() {
  if (S.bets && S.bets.length) checkBets();
  if (ui.view === 'bets' && $('modal').hidden && betOff <= BPAGE && Date.now() - betAt > 6e4) loadBets();
}

/* =====================================================================
   10. ROUTING, EVENTS, TICK
   ===================================================================== */
const VIEWS = ['money', 'market', 'compare', 'wallet', 'truth', 'news', 'bets', 'top'];
function render() {
  sig = posSig();
  if (ui.view === 'market') renderMarket();
  else if (ui.view === 'wallet') renderWallet();
  else if (ui.view === 'truth') renderTruth();
  else if (ui.view === 'news') renderNews();
  else if (ui.view === 'bets') renderBets();
  else if (ui.view === 'top') renderTop();
  else if (ui.view === 'compare') { renderCompare(); cmpLoad(); }
  upd(true); refreshView();
}
function refreshView() {
  if (ui.view === 'money') refreshMoney();
  else if (ui.view === 'market' && ui.sym) { setTxt($('trCash'), money(S.cash)); drawIns(); }
  else if (ui.view === 'wallet') refreshWallet();
  else if (ui.view === 'truth') refreshTruth();
  else if (ui.view === 'top') refreshTop();
}
function refresh() {
  if (!S || document.hidden) return;
  const s = posSig();
  if (s !== sig) { sig = s; renderDyn(); }
  upd(); refreshView();
}
function route() {
  const a = String(location.hash || '').replace(/^#/, '').split('/');
  ui.view = VIEWS.indexOf(a[0]) >= 0 ? a[0] : 'money'; ui.cat = null; ui.sym = null;
  if (ui.view === 'market') {
    if (E.CAT[a[1]]) ui.cat = a[1];
    if (ui.cat && INS[a[2]] && INS[a[2]].cat === ui.cat) ui.sym = a[2];
  }
  VIEWS.forEach(v => { const el = $('v-' + v); if (el) el.hidden = v !== ui.view; });
  document.querySelectorAll('[data-nav]').forEach(el => {
    const on = el.getAttribute('data-nav') === ui.view; el.classList.toggle('on', on);
    if (on) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
  });
  { const mb = $('moreBtn'); if (mb) mb.classList.toggle('on', MORE.indexOf(ui.view) >= 0); moreSheet(false); }
  render();
  try { window.scrollTo(0, 0); } catch (e) {}
}
function applyLang() {
  document.documentElement.lang = S.lang;
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.getAttribute('data-i18n')); });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph'))); });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria'))); });
  setTxt($('langBtn'), S.lang === 'en' ? 'RU' : 'EN');
  const sb = $('sndBtn'); if (sb) { sb.classList.toggle('off', !S.sound); sb.setAttribute('aria-pressed', S.sound ? 'true' : 'false'); }
  drawSync();
}
function onClick(e) {
  snd.gesture();
  const el = e.target && e.target.closest ? e.target.closest('[data-tf],[data-lev],[data-pre],[data-side],[data-close],[data-amt],[data-key],[data-act],[data-ncat],[data-ccat],[data-csym],[data-per],[data-bcat],[data-bet],[data-bsell],[data-bpre],[data-tip],#langBtn,#sndBtn,#skinBtn,#modal,#more,.more-row') : null;
  if (!el) return;
  const A = k => el.getAttribute(k), has = k => el.hasAttribute(k);
  if (has('data-tip')) { showTip(el); return; }
  if (A('data-act') === 'more') { moreSheet($('more').hidden); vib(8); return; }
  if (el.id === 'more') { if (e.target === el) moreSheet(false); return; }
  if (el.classList.contains('more-row')) { moreSheet(false); return; }
  { const tb = document.querySelector('.tipbox'); if (tb) tb.remove(); }
  if (el.id === 'modal') { if (e.target === el) el.hidden = true; return; }
  if (el.id === 'skinBtn') { nextSkin(); if (S.sound) snd.key(); return; }
  if (el.id === 'langBtn') { S.lang = S.lang === 'en' ? 'ru' : 'en'; save(); applyLang(); render(); return; }
  if (el.id === 'sndBtn') { S.sound = !S.sound; save(); applyLang(); if (S.sound) snd.key(); return; }
  if (has('data-tf')) {
    ui.tf = A('data-tf'); document.querySelectorAll('[data-tf]').forEach(b => b.classList.toggle('on', b === el)); drawIns();
  } else if (has('data-lev')) {
    ui.lev = +A('data-lev'); document.querySelectorAll('[data-lev]').forEach(b => b.classList.toggle('on', b === el)); tradeInfo();
  } else if (has('data-pre')) {
    const inp = $('amt'), p = +A('data-pre'), mx = E.maxAmount(S.cash, ui.lev);
    if (inp) { inp.value = mx > 0 ? String(p >= 100 ? mx : Math.floor(mx * p) / 100) : ''; const m = $('trMsg'); if (m && S.cash >= 1) m.textContent = ''; tradeInfo(); }
  } else if (has('data-side')) doTrade(+A('data-side'));
  else if (has('data-close')) doClose(+A('data-close'));
  else if (has('data-amt')) doDeposit(+A('data-amt'));
  else if (has('data-key')) {
    const k = A('data-key'), inp = $('atmInp'); snd.key(); vib(8); if (!inp) return;
    if (k === 'c') { inp.value = ''; atmMsg(''); } else if (k === 'ok') doDeposit(parseAmt(inp.value)); else if (inp.value.length < 10) inp.value += k;
  } else if (has('data-ncat')) {
    ui.ncat = A('data-ncat'); document.querySelectorAll('[data-ncat]').forEach(b => b.classList.toggle('on', b === el)); fillNews();
  } else if (has('data-ccat')) { ui.ccat = A('data-ccat'); renderCompare(); }
  else if (has('data-csym')) { if (INS[A('data-csym')]) cmpToggle(A('data-csym')); }
  else if (has('data-bcat')) {
    ui.bcat = A('data-bcat'); document.querySelectorAll('[data-bcat]').forEach(b => b.classList.toggle('on', b === el)); fillBets(); loadBets();
  } else if (has('data-bet')) openBet(A('data-bet'), +A('data-oi'));
  else if (has('data-bsell')) sellBet(+A('data-bsell'));
  else if (has('data-bpre')) { const inp = $('betAmt'); if (inp) { inp.value = String(Math.min(+A('data-bpre'), Math.floor(S.cash * 100) / 100) || ''); betInfo(); } }
  else if (has('data-per')) { S.cmp.per = +A('data-per') === 7 ? 7 : +A('data-per') === 90 ? 90 : 30; save(); renderCompare(); }
  else if (has('data-act')) {
    const a = A('data-act'), rc = $('resetConfirm');
    if (a === 'deposit') doDeposit(parseAmt($('atmInp').value));
    else if (a === 'reset-ask') { if (rc) rc.hidden = false; }
    else if (a === 'reset-no') { if (rc) rc.hidden = true; }
    else if (a === 'reset-yes') { const cm = S.cmp; E.reset(S); S.cmp = cm; save(); if (rc) rc.hidden = true; atmMsg(''); toast(t('reset_done')); ui.pauseAt = 0; render(); }
    else if (a === 'pause') showPause(true);
    else if (a === 'modal-close') $('modal').hidden = true;
    else if (a === 'bet-ok') doBet();
    else if (a === 'bet-more') loadBets(true);
    else if (a === 'bet-refresh') { betAt = 0; betOff = 0; loadBets(); checkBets(true); }
  }
}
function tick() {
  if (document.hidden) return;
  const now = Date.now(), r = E.advance(S, M, now);
  if (r.liq.length) onLiq(r.liq);
  pump(now); refresh();
  if (++tickN % 5 === 0) { save(); drawSync(); }
  if (tickN % 20 === 0) betTick();
}
function redrawCharts() { if (ui.view === 'market' && ui.sym) drawIns(); else if (ui.view === 'wallet') drawEq(); else if (ui.view === 'compare') drawCmp(); }
function init() {
  load();
  if (!S.cmp || !Array.isArray(S.cmp.syms)) S.cmp = { syms: ['BTC', 'SPX'], per: 30 };
  S.cmp.syms = S.cmp.syms.filter((s, i, a) => INS[s] && a.indexOf(s) === i).slice(0, 4);
  if ([7, 30, 90].indexOf(S.cmp.per) < 0) S.cmp.per = 30;
  const r = E.advance(S, M, Date.now());          // time kept going while the tab was closed
  readSkin(); applyLang(); route();
  if (r.liq.length) onLiq(r.liq);
  document.addEventListener('click', onClick);
  document.addEventListener('pointerdown', () => snd.gesture(), { passive: true });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { const m = $('modal'); if (m) m.hidden = true; }
    if (e.key === 'Enter' && e.target && e.target.id === 'atmInp') doDeposit(parseAmt(e.target.value));
  });
  window.addEventListener('hashchange', route);
  let rz = 0; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(redrawCharts, 150); });
  document.addEventListener('visibilitychange', () => {
    document.body.classList.toggle('paused', document.hidden);
    if (document.hidden) save(); else tick();
  });
  window.addEventListener('pagehide', save);
  if (document.fonts && document.fonts.ready && document.fonts.ready.then) document.fonts.ready.then(redrawCharts);
  setInterval(tick, 1000);
  pump(Date.now());
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

})();
