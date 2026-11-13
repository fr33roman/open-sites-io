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
const ui = { view: 'money', cat: null, sym: null, tf: '5m', lev: 1, ncat: 'all', bcat: 'all', bet: null, btab: 'sport', sport: 'mma', mineAll: false, histOpen: false, ct: 'candle', cmpOff: {} };
try { if (localStorage.getItem('dofa_sim_ct') === 'line') ui.ct = 'line'; } catch (e) {}
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
const numOf = s => parseFloat(String(s).replace(/[^\d.\-\u2212]/g, '').replace('\u2212', '-'));
function setTxt(el, text, v) {
  if (!el) return;
  if (el.textContent !== text) {
    const o = el.textContent; el.textContent = text;
    if (o && el.classList.contains('num') && /^[\u2212+$\d]/.test(o) && /^[\u2212+$\d]/.test(text) && el.closest('.ins-px,.hero,.pos,.stat')) {
      const x = numOf(o), y = numOf(text);
      if (isFinite(x) && isFinite(y) && x !== y) { el.classList.remove('nflash-up', 'nflash-dn'); void el.offsetWidth; el.classList.add(y > x ? 'nflash-up' : 'nflash-dn'); }
    }
  }
  if (v !== undefined) { el.classList.toggle('up', v > 0); el.classList.toggle('down', v < 0); }
}
// 13.11: numbers roll to the new value (one shared rAF loop, stops by itself) and flash up/down.
const RL = new Map(); let rlOn = false;
function rlStep(now) {
  RL.forEach((r, el) => {
    const k = Math.min(1, (now - r.t0) / r.d), e = 1 - Math.pow(1 - k, 3);
    r.cur = r.a + (r.to - r.a) * e; el.textContent = r.fmt(k >= 1 ? r.to : r.cur);
    if (k >= 1) RL.delete(el);
  });
  if (RL.size && !document.hidden) requestAnimationFrame(rlStep);
  else { RL.forEach((r, el) => { el.textContent = r.fmt(r.to); }); RL.clear(); rlOn = false; }
}
function rollTo(el, v, fmt, sgn) {
  if (!el) return;
  if (sgn !== undefined) { el.classList.toggle('up', sgn > 0); el.classList.toggle('down', sgn < 0); }
  const from = el._rv, txt = fmt(v);
  el._rv = v;
  if (RM || from == null || !isFinite(from) || document.hidden || !el.isConnected) { RL.delete(el); if (el.textContent !== txt) el.textContent = txt; return; }
  if (from === v || el.textContent === txt && !RL.has(el)) return;
  const r = RL.get(el), a = r ? r.cur : from;
  RL.set(el, { a: a, to: v, cur: a, t0: performance.now(), d: 650, fmt: fmt });
  el.classList.remove('nflash-up', 'nflash-dn'); void el.offsetWidth; el.classList.add(v > from ? 'nflash-up' : 'nflash-dn');
  if (!rlOn) { rlOn = true; requestAnimationFrame(rlStep); }
}
function pulse(el) { if (!el || RM) return; el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); }
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
    cash(n, lead, st, d) {                      // 13.11 (2): one rustle per bill as it goes into the slot, then the slot closing
      if (!ready()) return; const t0 = ctx.currentTime + 0.02 + (lead || 0); st = st || 0.052; d = d || 0;
      for (let i = 0; i < n; i++) { const tb = t0 + i * st + d * 0.45; burst(tb, 0.05, 2400 + Math.random() * 2800, 1.1, 0.4); burst(tb + 0.03, 0.04, 3200 + Math.random() * 2000, 1.2, 0.22); }
      tone(t0 + (n - 1) * st + d + 0.04, 150, 70, 0.14, 0.3);
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
function toast(msg, cls, ok) {
  const el = $('toast'); if (!el) return;
  el.textContent = msg; el.className = 'toast on' + (cls ? ' ' + cls : '') + (ok ? ' ok' : '');
  if (ok) {                                   // 13.11: a short "done" mark next to the amount
    const k = document.createElement('i'); k.className = 'okfx'; k.setAttribute('aria-hidden', 'true');
    k.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9"/></svg>'; el.insertBefore(k, el.firstChild);
  }
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
function cvIn(el) { let cv = el.querySelector('canvas'); if (!cv) { cv = document.createElement('canvas'); cv.className = 'chart'; el.appendChild(cv); } return cv; }

/* ---------- 13.11 · charts on TradingView Lightweight Charts 4.2.3 (vendor/, Apache 2.0) ----------
   The library draws only when data changes or the user touches the chart. Times go in as local
   wall-clock seconds so the axis shows the user's own clock. The TradingView logo stays (licence). */
Object.assign(T.ru, {
  ct_candle: 'Свечи', ct_line: 'Линия', lg_o: 'Откр', lg_h: 'Макс', lg_l: 'Мин', lg_c: 'Закр', lg_act: 'Активность',
  bar_2: 'свеча 2 с', bar_10: 'свеча 10 с', bar_120: 'свеча 2 мин', bar_480: 'свеча 8 мин', bar_3600: 'свеча 1 ч',
  mk_buy: 'Покупка', mk_sell: 'Продажа', mk_exit: 'Выход', mk_liq: 'Ликвидация', pl_entry: 'Вход', pl_liq: 'Ликвидация',
  pos_line: 'Вход {e} · ликвидация {l}, до неё {d}', pos_line1: 'Вход {e} · без плеча',
  tip_act: 'Столбики внизу — насколько активно двигалась цена внутри свечи. Настоящего объёма торгов у нас нет, поэтому это оценка по самой цене.',
  p_size: 'Размер', p_entry: 'Цена входа', p_mark: 'Текущая цена', p_margin: 'Залог', p_lev: 'Плечо', p_fee: 'Комиссия',
  p_liq: 'Цена ликвидации', p_liq_far: 'запас до ликвидации {p}', p_noliq: 'нет: без плеча',
  tip_size: 'Сколько актива вы держите в долларах по текущей цене: залог × плечо плюс результат.',
  tip_entry: 'Цена, по которой вы вошли. Если докупали, это средняя цена всех покупок.',
  tip_mark: 'Цена сейчас. По ней считается результат.',
  tip_pnl: 'Результат, если закрыть сейчас, до комиссии за закрытие. Процент — от вашего залога.',
  tip_margin: 'Ваши деньги в сделке. Больше этой суммы по позиции потерять нельзя.',
  tip_liq: 'При этой цене убыток съест весь залог и позицию закроет принудительно. Полоска — сколько запаса осталось.',
  tip_fee: 'Комиссия 0.1% от размера: взятая при открытии плюс та, что возьмут при закрытии.',
  w_alloc: 'Из чего состоит портфель', al_cash: 'Свободные деньги', al_total: 'всего', al_empty: 'Внесите деньги в банкомате — здесь появится раскладка по классам активов.',
  w_sum: 'Итоги сделок', a_n: 'Всего сделок', a_win: 'Доля прибыльных', a_avgw: 'Средняя прибыль', a_avgl: 'Средний убыток', a_best: 'Лучшая сделка',
  a_worst: 'Худшая сделка', a_fees: 'Комиссии всего', a_dd: 'Макс. просадка', a_wl: 'в плюс {w} · в минус {l}', a_none_l: 'убыточных не было', a_none_w: 'прибыльных не было',
  a_empty: 'Сделок пока нет — откройте первую', a_empty_p: 'После первой закрытой сделки здесь появятся доля прибыльных, средний результат и просадка.', a_go: 'На рынок',
  tip_win: 'Сколько закрытых сделок принесли деньги после всех комиссий.',
  tip_avg: 'Средний итог одной прибыльной и одной убыточной сделки после комиссий.',
  tip_dd: 'Самое большое падение результата от лучшего значения до худшего после него.',
  tip_fees_all: 'Все комиссии за открытие и закрытие, включая открытые сейчас позиции.',
  cmp_tap: 'Нажмите на строку, чтобы скрыть или показать линию.', foot_lw: 'Графики — TradingView Lightweight Charts.'
});
Object.assign(T.en, {
  ct_candle: 'Candles', ct_line: 'Line', lg_o: 'O', lg_h: 'H', lg_l: 'L', lg_c: 'C', lg_act: 'Activity',
  bar_2: '2 s candle', bar_10: '10 s candle', bar_120: '2 min candle', bar_480: '8 min candle', bar_3600: '1 h candle',
  mk_buy: 'Buy', mk_sell: 'Sell', mk_exit: 'Exit', mk_liq: 'Liquidated', pl_entry: 'Entry', pl_liq: 'Liquidation',
  pos_line: 'Entry {e} · liquidation {l}, {d} away', pos_line1: 'Entry {e} · no leverage',
  tip_act: 'The bars at the bottom show how actively the price moved inside each candle. We have no real trading volume, so this is an estimate from the price itself.',
  p_size: 'Size', p_entry: 'Entry price', p_mark: 'Mark price', p_margin: 'Margin', p_lev: 'Leverage', p_fee: 'Fees',
  p_liq: 'Liquidation price', p_liq_far: '{p} left before liquidation', p_noliq: 'none: no leverage',
  tip_size: 'How much of the asset you hold in dollars at the current price: margin × leverage plus the result.',
  tip_entry: 'The price you got in at. If you added to the position, it is the average of all buys.',
  tip_mark: 'The price right now. The result is counted from it.',
  tip_pnl: 'What you get if you close now, before the closing fee. The percentage is of your margin.',
  tip_margin: 'Your money in the trade. You cannot lose more than this on the position.',
  tip_liq: 'At this price the loss eats the whole margin and the position is force-closed. The bar shows how much room is left.',
  tip_fee: 'A 0.1% fee of the size: the one taken on opening plus the one taken on closing.',
  w_alloc: 'What the portfolio is made of', al_cash: 'Available cash', al_total: 'total', al_empty: 'Deposit at the ATM and the split by asset class appears here.',
  w_sum: 'Trade summary', a_n: 'Total trades', a_win: 'Win rate', a_avgw: 'Average win', a_avgl: 'Average loss', a_best: 'Best trade',
  a_worst: 'Worst trade', a_fees: 'Total fees', a_dd: 'Max drawdown', a_wl: '{w} in profit · {l} in loss', a_none_l: 'no losing trades', a_none_w: 'no winning trades',
  a_empty: 'No trades yet — open your first one', a_empty_p: 'After the first closed trade you will see the win rate, the average result and the drawdown here.', a_go: 'To the market',
  tip_win: 'How many closed trades made money after all fees.',
  tip_avg: 'The average result of one winning and one losing trade after fees.',
  tip_dd: 'The largest fall of the result from its best value to the worst one after it.',
  tip_fees_all: 'All opening and closing fees, including positions open right now.',
  cmp_tap: 'Tap a row to hide or show its line.', foot_lw: 'Charts: TradingView Lightweight Charts.'
});
const LWC = () => window.LightweightCharts || null;
const SH = -new Date().getTimezoneOffset() * 60;
const lt = ms => Math.floor(ms / 1000) + SH;
const CH = {};
function chartKill(k) { const c = CH[k]; if (c) { try { c.chart.remove(); } catch (e) {} delete CH[k]; } }
function chartsKill() { Object.keys(CH).forEach(chartKill); }
function u2(tm) { const d = new Date(tm * 1000); return { d: p2(d.getUTCDate()) + '.' + p2(d.getUTCMonth() + 1), h: p2(d.getUTCHours()) + ':' + p2(d.getUTCMinutes()), s: p2(d.getUTCSeconds()) }; }
function lwChart(el, o) {
  o = o || {};
  const soft = a => rgba(COL.txt, a), ch = { color: rgba(COL.gold, 0.5), width: 1, style: 3, labelBackgroundColor: COL.gold };
  const base = {
    autoSize: true,
    layout: { background: { type: 'solid', color: 'rgba(0,0,0,0)' }, textColor: COL.mut, fontSize: 11, fontFamily: '"JetBrains Mono", ui-monospace, Consolas, monospace', attributionLogo: true },
    grid: { vertLines: { color: soft(0.035) }, horzLines: { color: soft(0.05) } },
    rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.12, bottom: 0.1 } },
    timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false, rightOffset: 2, lockVisibleTimeRangeOnResize: true },
    crosshair: { mode: 0, vertLine: ch, horzLine: ch },
    handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
    handleScale: { mouseWheel: false, pinch: true, axisPressedMouseMove: true, axisDoubleClickReset: true },
    localization: { locale: S.lang === 'en' ? 'en-US' : 'ru-RU', timeFormatter: tm => { const x = u2(tm); return x.d + ' ' + x.h + (o.sec ? ':' + x.s : ''); } }
  };
  if (o.time === false) { base.timeScale.timeVisible = false; base.localization.timeFormatter = tm => u2(tm).d + '.' + new Date(tm * 1000).getUTCFullYear(); }
  return LWC().createChart(el, base);
}
const pctFmt = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2) + '%';

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
    const pr = M.px[p.sym], g = E.pnl(p, pr), f = k => el.querySelector('[data-f="' + k + '"]'), size = p.qty * pr;
    rollTo(f('pnl'), g, signed, g);
    setTxt(f('roe'), pct(g / p.margin), g);
    setTxt(f('size'), money(size)); setTxt(f('mark'), price(p.sym, pr)); setTxt(f('fee'), money(p.fee + size * E.FEE));
    const bar = f('lbar');
    if (bar) {
      const lq = E.liqPrice(p.entry, p.side, p.lev), dist = Math.max(0, p.side > 0 ? (pr - lq) / pr : (lq - pr) / pr), k = Math.max(0, Math.min(1, dist * p.lev));
      bar.style.transform = 'scaleX(' + k.toFixed(3) + ')'; bar.className = k > 0.5 ? 'ok' : k > 0.2 ? 'mid' : 'low';
      setTxt(f('ldist'), tf('p_liq_far', { p: (dist * 100).toFixed(2) + '%' }));
    }
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
// 13.11: the position card reads like an exchange position panel — result first, then size, prices, liquidation room.
function posHTML(p) {
  const I = INS[p.sym], noLiq = p.side > 0 && p.lev === 1;
  const cell = (k, tip, f, v) => '<div class="pc"><span class="lbl qrow">' + t(k) + (tip ? qm(tip) : '') + '</span><span class="num"' + (f ? ' data-f="' + f + '"' : '') + '>' + (v || '') + '</span></div>';
  return '<div class="pos" data-pos="' + p.id + '"><div class="pos-top"><a href="#market/' + I.cat + '/' + p.sym + '"><b>' + esc(tk(p.sym)) + '</b>' +
    '<span class="badge ' + (p.side > 0 ? 'up' : 'down') + '">' + t(p.side > 0 ? 'side_up' : 'side_down') + ' ×' + p.lev + '</span></a>' +
    '<div class="pos-pnl"><span class="lbl qrow">' + t('p_pnl') + qm('tip_pnl') + '</span><b class="num" data-f="pnl"></b><span class="num roe" data-f="roe"></span></div></div>' +
    '<div class="pos-grid">' + cell('p_size', 'tip_size', 'size') + cell('p_entry', 'tip_entry', '', price(p.sym, p.entry)) + cell('p_mark', 'tip_mark', 'mark') +
    cell('p_margin', 'tip_margin', '', money(p.margin)) + cell('p_lev', 'tip_lev', '', '×' + p.lev) + cell('p_fee', 'tip_fee', 'fee') + '</div>' +
    '<div class="pos-liq"><div class="pl-top"><span class="lbl qrow">' + t('p_liq') + qm('tip_liq') + '</span><span class="num">' + (noLiq ? t('p_noliq') : price(p.sym, E.liqPrice(p.entry, p.side, p.lev))) + '</span></div>' +
    (noLiq ? '' : '<div class="pl-bar"><i data-f="lbar"></i></div><span class="pl-d num" data-f="ldist"></span>') + '</div>' +
    '<button class="btn-ghost pos-close" type="button" data-close="' + p.id + '">' + t('p_close') + '</button></div>';
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
  box.innerHTML = '<div class="vhead"><h1>' + t('market_h') + '</h1></div><div class="cats">' +
    E.CATS.map(c => {
      const n = SYMS.filter(s => INS[s].cat === c.id).length;
      return '<a class="cat" href="#market/' + c.id + '"><i class="cat-glow" aria-hidden="true"></i><span class="cat-ico"><svg viewBox="0 0 24 24" aria-hidden="true">' + ICO[c.id] + '</svg></span>' +
        '<span class="cat-name">' + esc(L(c)) + '</span><span class="cat-meta lbl">' + n + ' ' + t('instr') + '</span>' +
        '<svg class="cat-spark" viewBox="0 0 100 36" preserveAspectRatio="none" aria-hidden="true"><polyline class="s1" data-spark="' + c.lead + '"/><polyline class="s2" pathLength="1" data-spark="' + c.lead + '"/></svg>' +
        '<span class="cat-lead"><b>' + esc(tk(c.lead)) + '</b><em class="num" data-ch="' + c.lead + '"></em></span></a>';
    }).join('') + '</div>';
}

// period -> [history array, points, candle seconds]. Candles are grouped from the points we already keep.
const TFS = { '1m': ['fine', 60, 2], '5m': ['fine', 300, 10], '1h': ['coarse', 60, 120], '4h': ['coarse', 240, 480], '24h': ['day', 24, 3600] };
const STEP = { fine: 1e3, coarse: 6e4, day: 36e5 };
function insPts() {
  const s = ui.sym, d = TFS[ui.tf] || TFS['5m'], a = (M[d[0]][s] || []).slice(-d[1]), st = STEP[d[0]];
  const end = d[0] === 'fine' ? M.t : Math.floor(M.t / st) * st, n = a.length, out = a.map((v, i) => [end - (n - 1 - i) * st, v]);
  if (d[0] !== 'fine') out.push([M.t, M.px[s]]);
  return out;
}
// Open = previous close, so the candles join up; a = how much the price travelled inside (our "activity").
function toBars(pts, B) {
  const out = []; let cur = null, prev = pts.length ? pts[0][1] : 0;
  for (let i = 0; i < pts.length; i++) {
    const v = pts[i][1], b = Math.floor(pts[i][0] / 1000 / B) * B + SH;
    if (!cur || b !== cur.time) { if (cur) out.push(cur); cur = { time: b, open: prev, high: Math.max(prev, v), low: Math.min(prev, v), close: v, a: 0 }; }
    else { if (v > cur.high) cur.high = v; if (v < cur.low) cur.low = v; cur.close = v; }
    cur.a += Math.abs(v - prev) / (prev || 1); prev = v;
  }
  if (cur) out.push(cur);
  return out;
}
const volBar = b => ({ time: b.time, value: b.a * 1e4, color: rgba(b.close >= b.open ? COL.up : COL.down, 0.32) });
function insSeriesMake(c) {
  const ch = c.chart, s = ui.sym, dec = pdec(s, M.px[s]);
  if (c.main) { try { ch.removeSeries(c.main); } catch (e) {} }
  if (c.vol) { try { ch.removeSeries(c.vol); } catch (e) {} }
  const fmt = { type: 'price', precision: dec, minMove: Math.pow(10, -dec) };
  const auto = orig => { const r = orig(); if (r && c.inc && c.inc.length) { c.inc.forEach(v => { r.priceRange.minValue = Math.min(r.priceRange.minValue, v); r.priceRange.maxValue = Math.max(r.priceRange.maxValue, v); }); } return r; };
  c.vol = ch.addHistogramSeries({ priceScaleId: 'act', priceFormat: { type: 'custom', formatter: v => v.toFixed(0) }, lastValueVisible: false, priceLineVisible: false });
  ch.priceScale('act').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 }, visible: false });
  c.main = ui.ct === 'line'
    ? ch.addAreaSeries({ lineColor: COL.gold, topColor: rgba(COL.gold, 0.22), bottomColor: rgba(COL.gold, 0), lineWidth: 2, priceFormat: fmt, autoscaleInfoProvider: auto, priceLineColor: rgba(COL.gold, 0.6), crosshairMarkerBackgroundColor: COL.gold })
    : ch.addCandlestickSeries({ upColor: COL.up, downColor: COL.down, borderUpColor: COL.up, borderDownColor: COL.down, wickUpColor: rgba(COL.up, 0.85), wickDownColor: rgba(COL.down, 0.85), priceFormat: fmt, autoscaleInfoProvider: auto, priceLineColor: rgba(COL.gold, 0.6) });
  c.main.priceScale().applyOptions({ scaleMargins: { top: 0.1, bottom: 0.24 } });
  c.ct = ui.ct; c.lines = []; c.msig = '';
}
// Player's trades on the chart: arrows where they went in and out, lines for the open position.
function insMarks(c) {
  const s = ui.sym, B = TFS[ui.tf][2], bt = ms => Math.floor(ms / 1000 / B) * B + SH, lo = c.t0, hi = c.last.time;
  const ps = S.positions.filter(p => p.sym === s), msig = posSig() + '|' + c.key + '|' + lo;
  c.inc = ps.map(p => p.entry);
  if (msig === c.msig) return; c.msig = msig;
  const mk = [], add = (ms, m) => { const tm = bt(ms); if (tm >= lo && tm <= hi) mk.push(Object.assign({ time: tm }, m)); };
  const openM = (side, lev) => side > 0 ? { position: 'belowBar', color: COL.up, shape: 'arrowUp', text: t('mk_buy') + ' ×' + lev } : { position: 'aboveBar', color: COL.down, shape: 'arrowDown', text: t('mk_sell') + ' ×' + lev };
  S.trades.forEach(tr => {
    if (tr.sym !== s) return;
    add(tr.t0, openM(tr.side, tr.lev));
    add(tr.t, tr.liq ? { position: tr.side > 0 ? 'belowBar' : 'aboveBar', color: COL.down, shape: 'circle', text: t('mk_liq') }
      : { position: tr.side > 0 ? 'aboveBar' : 'belowBar', color: tr.net >= 0 ? COL.up : COL.down, shape: tr.side > 0 ? 'arrowDown' : 'arrowUp', text: t('mk_exit') + ' ' + signed(tr.net) });
  });
  ps.forEach(p => add(p.t, openM(p.side, p.lev)));
  mk.sort((a, b) => a.time - b.time);
  try { c.main.setMarkers(mk); } catch (e) {}
  c.lines.forEach(l => { try { c.main.removePriceLine(l); } catch (e) {} }); c.lines = [];
  ps.forEach(p => {
    c.lines.push(c.main.createPriceLine({ price: p.entry, color: COL.gold, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: t('pl_entry') + ' ×' + p.lev }));
    if (!(p.side > 0 && p.lev === 1)) c.lines.push(c.main.createPriceLine({ price: E.liqPrice(p.entry, p.side, p.lev), color: COL.down, lineWidth: 1, lineStyle: 1, axisLabelVisible: true, title: t('pl_liq') }));
  });
}
function insLegend(p) {
  const c = CH.ins, el = $('cvLeg'); if (!c || !el || !c.last) return;
  let b = null;
  if (p && p.time != null && p.seriesData) {
    const v = p.seriesData.get(c.main);
    if (v) b = c.bars.find(x => x.time === p.time) || (v.open != null ? v : { time: p.time, open: v.value, high: v.value, low: v.value, close: v.value });
  }
  c.hover = !!b; if (!b) b = c.last;
  const s = ui.sym, x = u2(b.time), fine = TFS[ui.tf][0] === 'fine', ch = b.open ? b.close / b.open - 1 : 0;
  const it = (k, v) => '<span><i>' + t(k) + '</i>' + price(s, v) + '</span>';
  el.innerHTML = '<span class="lg-t">' + x.d + ' ' + x.h + (fine ? ':' + x.s : '') + '</span>' +
    (ui.ct === 'line' ? it('lg_c', b.close) : it('lg_o', b.open) + it('lg_h', b.high) + it('lg_l', b.low) + it('lg_c', b.close)) +
    '<b class="' + (ch > 0 ? 'up' : ch < 0 ? 'down' : '') + '">' + pct(ch) + '</b>';
}
function insPosLine() {
  const el = $('cvPos'); if (!el) return;
  const s = ui.sym, pr = M.px[s];
  setTxt(el, S.positions.filter(p => p.sym === s).map(p => {
    if (p.side > 0 && p.lev === 1) return tf('pos_line1', { e: price(s, p.entry) });
    const lq = E.liqPrice(p.entry, p.side, p.lev);
    return tf('pos_line', { e: price(s, p.entry), l: price(s, lq), d: (Math.abs(lq - pr) / pr * 100).toFixed(2) + '%' });
  }).join('  ·  '));
}
function drawIns(full) {
  const el = $('cv'); if (!el || !ui.sym) return;
  const s = ui.sym, d = TFS[ui.tf] || TFS['5m'];
  const real = M.hk[s] === 'real' && d[0] !== 'fine' || E.status(M, s, Date.now()) === 'live' && d[0] === 'fine';
  setTxt($('cvNote'), t('bar_' + d[2]) + ' · ' + t(real ? 'chart_real' : 'chart_synth'));
  insPosLine();
  const bars = toBars(insPts(), d[2]); if (!bars.length) return;
  if (!LWC()) {                               // library did not load: the old canvas line
    const pts = bars.map(b => [b.time, b.close]), up = bars[bars.length - 1].close >= bars[0].open;
    drawChart(cvIn(el), [{ pts: pts, color: up ? COL.up : COL.down }], { area: true, fy: v => price(s, v), fx: x => { const u = u2(x); return u.h; } });
    return;
  }
  let c = CH.ins;
  if (!c || c.el !== el) { chartKill('ins'); c = CH.ins = { el: el, chart: lwChart(el, { sec: true }) }; c.chart.subscribeCrosshairMove(insLegend); full = true; }
  const key = s + '|' + ui.tf + '|' + ui.ct, src = M[d[0]][s];
  if (c.key !== key || c.src !== src || !c.last) full = true;
  const row = b => (ui.ct === 'line' ? { time: b.time, value: b.close } : b);
  if (full) {
    if (!c.main || c.ct !== ui.ct || c.sym !== s) { insSeriesMake(c); c.sym = s; }
    c.chart.applyOptions({ timeScale: { secondsVisible: d[0] === 'fine' } });
    c.main.setData(bars.map(row)); c.vol.setData(bars.map(volBar));
    c.chart.timeScale().fitContent();
    c.key = key; c.src = src; c.t0 = bars[0].time; c.msig = '';
  } else {
    bars.slice(-2).forEach(b => { if (b.time >= c.last.time) { try { c.main.update(row(b)); c.vol.update(volBar(b)); } catch (e) {} } });
  }
  c.last = bars[bars.length - 1]; c.bars = bars;
  insMarks(c);
  if (!c.hover) insLegend();
}
function renderIns(box) {
  const s = ui.sym, I = INS[s], c = E.CAT[I.cat];
  box.innerHTML = '<a class="crumb" href="#market/' + I.cat + '"><span aria-hidden="true">←</span> ' + esc(L(c)) + '</a>' +
    '<div class="ins-head"><div><p class="lbl">' + esc(tk(s)) + '</p><h1>' + esc(L(I)) + '</h1><span class="st big" data-stt="' + s + '"></span></div>' +
    '<div class="ins-px"><b class="num" data-px="' + s + '"></b><em><span class="num" data-ch="' + s + '"></span> ' + t('ch24') + '</em></div></div>' +
    '<div class="ins-grid"><div class="panel ch-panel"><div class="ch-bar"><div class="chips tfs">' +
    Object.keys(TFS).map(k => '<button class="chip' + (k === ui.tf ? ' on' : '') + '" type="button" data-tf="' + k + '">' + t('tf_' + k) + '</button>').join('') +
    '</div><div class="seg ctype" role="tablist">' + ['candle', 'line'].map(k => '<button type="button" role="tab" data-ct="' + k + '" class="' + (ui.ct === k ? 'on' : '') + '" aria-selected="' + (ui.ct === k) + '">' + t('ct_' + k) + '</button>').join('') + '</div></div>' +
    '<div class="ch-leg num" id="cvLeg"></div><div class="chart lw" id="cv"></div>' +
    '<p class="ch-pos num" id="cvPos"></p><p class="chart-note qrow" id="cvNoteRow"><span id="cvNote"></span>' + qm('tip_act') + '</p></div>' +
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
  chartKill('ins'); if (!LWC()) bindHover(cvIn($('cv')), drawIns);
  tradeInfo(); drawIns(true);
  loadCandles(s, '1h', 24); loadCandles(s, '1s', 300);
}
function tradeInfo() {
  const inp = $('amt'); if (!inp) return;
  const a = parseAmt(inp.value), l = ui.lev;
  setTxt($('trCash'), money(S.cash));
  setTxt($('feeLine'), tf('tr_fee', { f: money(E.round2(a * l * E.FEE)), v: money(a * l) }));
  const w = $('levWarn');
  if (w) { w.hidden = l === 1; if (l > 1) { const pr = M.px[ui.sym]; setTxt(w, tf('lev_warn', { l: l, p: (100 / l).toFixed(0), a: price(ui.sym, pr * (1 - 1 / l)), b: price(ui.sym, pr * (1 + 1 / l)) })); } }
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
  toast(tf('opened', { s: tk(ui.sym) + ' ×' + ui.lev }) + (r.imp ? '. ' + t('imp_note') : ''), 'up', true);
  pulse($('trCash'));
  save(); sig = ''; refresh();
}
function doClose(id) {
  const tr = E.close(S, M, id, false); if (!tr) return;
  if (tr.net > 0) { snd.win(); vib([12, 40, 12]); } else { snd.loss(); vib(40); }
  toast(tk(tr.sym) + ': ' + signed(tr.net), tr.net > 0 ? 'up' : tr.net < 0 ? 'down' : '', true);
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
function refreshMoney() { if (!cashQ.busy && !cashQ.pend) rollTo($('atmBal'), S.cash, money); }
// 13.11 (2): deposit = a stack of bills lies in the tray and goes INTO the slot, top bill first.
// Bigger amount -> thicker stack and longer animation. A new deposit during the animation waits and runs right after.
const cashQ = { busy: false, pend: 0 };
const billsFor = a => (a >= 1e6 ? 24 : a >= 1e5 ? 16 : a >= 1e4 ? 10 : a >= 1e3 ? 6 : 3);
function cashAnim(a) {
  if (cashQ.busy) { cashQ.pend += a; return; }
  const lane = $('cashLane'), n = billsFor(a), T = 0.9 + (n - 3) / 21 * 1.5, D = 0.5, st = (T - D) / Math.max(1, n - 1), lead = RM ? 0 : 0.35;
  snd.cash(n, lead, st, D);
  if (!lane || RM) { refreshMoney(); return; }
  cashQ.busy = true; lane.textContent = ''; lane.classList.remove('in'); void lane.offsetWidth; lane.classList.add('in');
  for (let i = 0; i < n; i++) {                // i = 0 is the bottom of the stack; the top one (last) goes in first
    const b = document.createElement('div'); b.className = 'bill';
    b.style.setProperty('--x', ((Math.random() - 0.5) * 8).toFixed(1) + 'px'); b.style.setProperty('--y', (26 - i * 1.15).toFixed(1) + 'px');
    b.style.setProperty('--r', ((Math.random() - 0.5) * 5).toFixed(1) + 'deg');
    b.style.animationDelay = (lead + (n - 1 - i) * st).toFixed(3) + 's'; b.style.animationDuration = D + 's';
    lane.appendChild(b);
  }
  setTimeout(() => {
    lane.textContent = ''; lane.classList.remove('in'); cashQ.busy = false;
    if (cashQ.pend) { const p = cashQ.pend; cashQ.pend = 0; cashAnim(p); } else refreshMoney();
  }, Math.round((lead + T) * 1000) + 80);
}
function atmMsg(s, err) { const m = $('atmMsg'); if (m) { m.className = 'scr-msg num' + (err ? ' err' : ''); m.textContent = s; } }
function doDeposit(a) {
  if (!(a >= 1)) { atmMsg(t('atm_min'), true); vib(20); return; }
  if (a > 1e7 || !E.deposit(S, M, a)) { atmMsg(t('atm_max'), true); vib(20); return; }
  save(); atmMsg('+' + money(a)); const inp = $('atmInp'); if (inp) inp.value = '';
  vib([10, 30, 10, 30, 10]);
  cashAnim(a);                          // the ATM balance rolls up when the last bill has gone in
  hdrBal();
}

// 13.11: the ATM leans a little toward the mouse (or the phone's tilt, only where no permission prompt is needed).
// 13.11 (5): масштаб банкомата под окно — на телефоне целиком в один экран (между шапкой и нижней панелью), на компьютере крупно, но не выше окна.
function fitAtm() {
  const box = $('atm'), body = $('atmBody'); if (!box || !body) return;
  const fit = () => {
    let h = 0; for (const k of body.children) if (getComputedStyle(k).position !== 'absolute') h += k.offsetHeight;   // высота корпуса по частям (у .atm-body своя высота 0)
    const w = body.offsetWidth; if (!h || !w) return;
    const mob = innerWidth < 900;
    const hdr = document.querySelector('.hdr'), tab = document.querySelector('.tabbar');
    const top = (hdr ? hdr.offsetHeight : 60), bot = mob && tab && tab.offsetParent ? tab.offsetHeight : 0;
    const padTop = mob ? 12 : 30, padBot = mob ? 16 : 30;
    const availH = innerHeight - top - bot - padTop - padBot - (mob ? 8 : 40);
    const availW = (mob ? box.clientWidth - 30 : box.clientWidth - 50) / (w * 1.16);
    const sc = Math.max(0.4, Math.min(mob ? 1 : 0.92, availH / h * (mob ? 0.9 : 1), availW));   // 0,9 — запас на перспективу и выступающие полку и цоколь
    const hh = Math.round(padTop + h * sc + padBot) + 'px';
    box.style.setProperty('--sc', sc.toFixed(3)); box.style.paddingTop = padTop + 'px';
    if (box.style.height !== hh) box.style.height = hh;
  };
  fit();
  if (window.ResizeObserver) new ResizeObserver(() => requestAnimationFrame(fit)).observe(box);
  window.addEventListener('resize', () => requestAnimationFrame(fit), { passive: true });
}
function atmTilt() {
  const el = $('atmBody'); if (!el || RM) return;
  let tx = 0, ty = 0, raf = 0;
  const apply = () => { raf = 0; el.style.setProperty('--tx', tx.toFixed(3)); el.style.setProperty('--ty', ty.toFixed(3)); };
  const set = (x, y) => {
    x = Math.max(-1, Math.min(1, x)); y = Math.max(-1, Math.min(1, y));
    if (Math.abs(x - tx) < 0.01 && Math.abs(y - ty) < 0.01) return;
    tx = x; ty = y; if (!raf) raf = requestAnimationFrame(apply);
  };
  window.addEventListener('pointermove', e => { if (ui.view !== 'money' || e.pointerType !== 'mouse' || document.hidden) return; set(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1); }, { passive: true });
  if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission !== 'function') {
    window.addEventListener('deviceorientation', e => { if (ui.view !== 'money' || e.gamma == null || document.hidden) return; set(e.gamma / 35, ((e.beta || 45) - 45) / 35); }, { passive: true });
  }
}
function renderWallet() {
  const st = (id, k) => '<div class="stat"><span class="lbl">' + t(k) + '</span><span class="num" id="' + id + '"></span></div>';
  $('walletBox').innerHTML = '<div class="vhead"><h1>' + t('wallet_h') + '</h1></div>' +
    '<div class="panel hero"><p class="lbl">' + t('w_real') + '</p><div class="hero-num num" id="wRes"></div><p class="hero-sub"><span class="num" id="wPct"></span> ' + t('w_of_dep') + '</p></div>' +
    '<div class="stats">' + st('wEq', 'w_total') + st('wCash', 'w_cash') + st('wPos', 'w_inpos') + st('wDep', 'w_dep') + '</div>' +
    '<h2 class="h2">' + t('w_curve') + '</h2><div class="panel ch-panel"><div class="chart sm lw" id="cvEq"></div><p class="ch-empty" id="cvEqE" hidden>' + t('curve_empty') + '</p></div>' +
    '<div class="w-ana"><section class="w-al"><h2 class="h2">' + t('w_alloc') + '</h2><div class="panel alloc" id="wAlloc"></div></section>' +
    '<section class="w-sum"><h2 class="h2">' + t('w_sum') + '</h2><div class="acards" id="aCards"></div></section></div>' +
    '<h2 class="h2">' + t('w_open') + '</h2><div class="poslist" id="wPosList"></div>' +
    '<h2 class="h2">' + t('w_hist') + '</h2><div id="wHist"></div>';
  chartKill('eq'); if (!LWC()) bindHover(cvIn($('cvEq')), drawEq);
  ui.alSig = ''; ui.aSig = '';
  renderDyn();
}
// Portfolio split by asset class: open positions at their value now, plus free cash.
const CATC = { crypto: 'var(--gold)', stocks: 'var(--l4)', metals: 'var(--gold-l)', forex: 'rgb(var(--acc2))', commod: 'color-mix(in srgb,var(--gold) 45%,var(--l4))', index: 'color-mix(in srgb,rgb(var(--acc2)) 50%,var(--txt))' };
function fillAlloc() {
  const box = $('wAlloc'); if (!box) return;
  const by = {}; let tot = Math.max(0, S.cash);
  S.positions.forEach(p => { const v = E.posValue(p, M.px[p.sym]), c = INS[p.sym].cat; by[c] = (by[c] || 0) + v; tot += v; });
  const seg = E.CATS.filter(c => by[c.id] > 0).map(c => ({ n: L(c), v: by[c.id], col: CATC[c.id] }));
  if (S.cash > 0) seg.push({ n: t('al_cash'), v: S.cash, col: 'rgba(var(--accl),.3)' });
  const sig = S.lang + seg.map(x => x.n + (x.v / tot).toFixed(3)).join('|') + compact(tot);
  if (sig === ui.alSig) return; ui.alSig = sig;
  if (!(tot > 0)) { box.innerHTML = '<p class="al-empty">' + t('al_empty') + '</p>'; return; }
  const intro = !box.firstChild || box.querySelector('.al-empty'); box.classList.toggle('intro', !!intro);
  const R = 46, C = 2 * Math.PI * R, gap = seg.length > 1 ? 1.6 : 0; let off = 0;
  const arcs = seg.map((x, i) => {
    const len = Math.max(0.6, x.v / tot * C - gap), a = '<circle r="' + R + '" cx="60" cy="60" style="stroke:' + x.col + ';--i:' + i + '" stroke-dasharray="' + len.toFixed(2) + ' ' + (C - len).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '"/>';
    off += x.v / tot * C; return a;
  }).join('');
  box.innerHTML = '<div class="donut"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="d-bg" r="' + R + '" cx="60" cy="60"/><g class="d-arcs">' + arcs + '</g></svg>' +
    '<div class="d-mid"><b class="num">' + compact(tot) + '</b><span>' + t('al_total') + '</span></div></div>' +
    '<div class="al-leg">' + seg.map(x => '<div class="al-row"><i style="background:' + x.col + '"></i><span>' + esc(x.n) + '</span><b class="num">' + (x.v / tot * 100).toFixed(1) + '%</b><small class="num">' + compact(x.v) + '</small></div>').join('') + '</div>';
}
// Trade summary cards from the trades we already store; drawdown from the stored result curve.
function anaStats() {
  const tr = S.trades.filter(x => INS[x.sym]), w = tr.filter(x => x.net > 0), l = tr.filter(x => x.net < 0), sum = a => a.reduce((s, x) => s + x.net, 0);
  let best = null, worst = null; tr.forEach(x => { if (!best || x.net > best.net) best = x; if (!worst || x.net < worst.net) worst = x; });
  const pts = S.curve.map(c => c[1]).concat([E.round2(E.equity(S, M) - S.deposited)]); let pk = -Infinity, dd = 0;
  pts.forEach(v => { if (v > pk) pk = v; if (pk - v > dd) dd = pk - v; });
  return { n: S.agg.n, wins: S.agg.wins, loss: S.agg.n - S.agg.wins, wr: S.agg.n ? S.agg.wins / S.agg.n : 0, aw: w.length ? sum(w) / w.length : null, al: l.length ? sum(l) / l.length : null, best: best, worst: worst, fees: S.agg.fees, dd: E.round2(dd) };
}
function fillCards() {
  const box = $('aCards'); if (!box) return;
  const a = anaStats(), sig = S.lang + a.n + '|' + a.fees + '|' + Math.round(a.dd) + '|' + S.trades.length;
  if (sig === ui.aSig) return; ui.aSig = sig;
  if (!a.n) { box.innerHTML = '<div class="acard a-empty"><b>' + t('a_empty') + '</b><p>' + t('a_empty_p') + '</p><a class="btn-gold" href="#market">' + t('a_go') + '</a></div>'; return; }
  const cls = v => (v > 0 ? 'up' : v < 0 ? 'down' : '');
  const card = (k, tip, v, sub, c, x) => '<div class="acard' + (x || '') + '"><span class="lbl qrow">' + t(k) + (tip ? qm(tip) : '') + '</span><b class="num ' + (c || '') + '">' + v + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>';
  const tw = x => x ? esc(tk(x.sym)) + ' ×' + x.lev + ' · ' + stamp(x.t) : '';
  box.innerHTML =
    card('a_n', '', String(a.n), tf('a_wl', { w: a.wins, l: a.loss })) +
    '<div class="acard a-wr"><span class="lbl qrow">' + t('a_win') + qm('tip_win') + '</span><b class="num">' + Math.round(a.wr * 100) + '%</b><div class="wr-bar"><i style="transform:scaleX(' + a.wr.toFixed(3) + ')"></i></div></div>' +
    card('a_avgw', 'tip_avg', a.aw == null ? '—' : signed(E.round2(a.aw)), a.aw == null ? t('a_none_w') : '', a.aw == null ? '' : 'up') +
    card('a_avgl', '', a.al == null ? '—' : signed(E.round2(a.al)), a.al == null ? t('a_none_l') : '', a.al == null ? '' : 'down') +
    card('a_best', '', a.best ? signed(a.best.net) : '—', tw(a.best), a.best ? cls(a.best.net) : '') +
    card('a_worst', '', a.worst ? signed(a.worst.net) : '—', tw(a.worst), a.worst ? cls(a.worst.net) : '') +
    card('a_fees', 'tip_fees_all', money(a.fees), '') +
    card('a_dd', 'tip_dd', a.dd > 0 ? '−' + money(a.dd) : money(0), '', a.dd > 0 ? 'down' : '');
}
function histHTML() {
  if (!S.trades.length) return '<p class="empty">' + t('hist_none') + '</p>';
  return '<div class="hist">' + S.trades.slice(0, 60).map(tr => INS[tr.sym] ?
    '<div class="hrow"><div><b>' + esc(tk(tr.sym)) + '</b><span class="badge ' + (tr.side > 0 ? 'up' : 'down') + '">' + t(tr.side > 0 ? 'side_up' : 'side_down') + ' ×' + tr.lev + '</span>' +
    '<small>' + stamp(tr.t) + ' · ' + price(tr.sym, tr.entry) + ' → ' + price(tr.sym, tr.exit) + (tr.liq ? ' · ' + t('liq_badge') : '') + '</small></div>' +
    '<span class="num ' + (tr.net > 0 ? 'up' : tr.net < 0 ? 'down' : '') + '">' + signed(tr.net) + '</span></div>' : '').join('') + '</div>';
}
function renderDyn() {
  if (ui.view === 'wallet') { posList($('wPosList'), S.positions, 'pos_none_all'); const h = $('wHist'); if (h) h.innerHTML = histHTML(); fillCards(); fillAlloc(); }
  if (ui.view === 'market' && ui.sym) posList($('insPos'), S.positions.filter(p => p.sym === ui.sym), 'pos_none');
}
// Result curve: a baseline area — green above zero, red below, like the PnL chart on an exchange.
function eqPts() {
  const out = [], put = (tm, v) => { const n = out.length; if (n && tm < out[n - 1].time) return; if (n && tm === out[n - 1].time) out[n - 1].value = v; else out.push({ time: tm, value: v }); };
  S.curve.forEach(c => put(lt(c[0]), c[1]));
  if (out.length) put(lt(M.t), E.round2(E.equity(S, M) - S.deposited));
  return out;
}
function drawEq() {
  const el = $('cvEq'); if (!el) return;
  const pts = eqPts(), emp = $('cvEqE');
  if (emp) emp.hidden = pts.length > 1;
  if (!LWC()) { drawChart(cvIn(el), [{ pts: pts.map(p => [p.time, p.value]), color: COL.up }], { base: 0, fy: v => compact(v), fx: x => u2(x).d, empty: '' }); return; }
  let c = CH.eq;
  if (!c || c.el !== el) {
    chartKill('eq'); c = CH.eq = { el: el, chart: lwChart(el), n: -1 };
    c.s = c.chart.addBaselineSeries({ baseValue: { type: 'price', price: 0 }, lineWidth: 2,
      topLineColor: COL.up, topFillColor1: rgba(COL.up, 0.3), topFillColor2: rgba(COL.up, 0.02),
      bottomLineColor: COL.down, bottomFillColor1: rgba(COL.down, 0.02), bottomFillColor2: rgba(COL.down, 0.3),
      priceFormat: { type: 'custom', formatter: v => compact(v), minMove: 0.01 }, priceLineVisible: false,
      autoscaleInfoProvider: orig => { const r = orig(); if (r) { r.priceRange.minValue = Math.min(r.priceRange.minValue, 0); r.priceRange.maxValue = Math.max(r.priceRange.maxValue, 0); } return r; } });
    c.s.createPriceLine({ price: 0, color: rgba(COL.txt, 0.25), lineWidth: 1, lineStyle: 2, axisLabelVisible: false });
  }
  if (pts.length < 2) { if (c.n !== 0) { c.s.setData([]); c.n = 0; } return; }
  if (c.n !== S.curve.length) { c.chart.applyOptions({ timeScale: { secondsVisible: pts[pts.length - 1].time - pts[0].time < 900 } }); c.s.setData(pts); c.n = S.curve.length; c.chart.timeScale().fitContent(); }
  else { try { c.s.update(pts[pts.length - 1]); } catch (e) { c.n = -1; } }
}
function refreshWallet() {
  const st = E.stats(S, M);
  rollTo($('wRes'), st.result, tightS, st.result);
  setTxt($('wPct'), pct(S.deposited > 0 ? st.result / S.deposited : null), st.result);
  rollTo($('wEq'), st.equity, money); rollTo($('wCash'), S.cash, money);
  rollTo($('wPos'), st.equity - S.cash, money); rollTo($('wDep'), S.deposited, money);
  drawEq();
  if (tickN % 5 === 0 || !ui.alSig) fillAlloc();
  fillCards();
}

function renderTruth() {
  const st = (id, k) => '<div class="stat"><span class="lbl">' + t(k) + '</span><span class="num" id="' + id + '"></span></div>';
  const row = (id, k) => '<div class="cmp-row"><div class="cmp-top"><span>' + t(k) + '</span><span class="num" id="' + id + '"></span></div><div class="bar"><i id="' + id + 'B"></i></div></div>';
  $('truthBox').innerHTML = '<div class="vhead"><h1>' + t('truth_h') + '</h1></div>' +
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
  $('modalBody').innerHTML = '<h2 id="modalTitle">' + (manual || k < 1 ? t('pause_h_manual') : tf('pause_h', { n: k })) + '</h2><p>' + t('pause_p') + '</p>' +
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
  $('newsBox').innerHTML = '<div class="vhead"><h1>' + t('news_h') + '</h1></div>' +
    '<div class="chips">' + ['all'].concat(NCATS).map(c => '<button class="chip' + (c === ui.ncat ? ' on' : '') + '" type="button" data-ncat="' + c + '">' + t('nc_' + c) + '</button>').join('') + '</div>' +
    '<p class="news-meta num" id="newsMeta"></p><div class="news" id="newsList"></div>' +
    '<h2 class="h2">' + t('learn_h') + '</h2><div class="learn">' +
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
  $('topBox').innerHTML = '<div class="vhead"><h1>' + t('top_h') + '</h1></div>' +
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
// Lines start at 0% (the first day of the period); a tap on a legend row hides or shows its line.
function drawCmp() {
  const el = $('cvCmp'); if (!el) return;
  const n = S.cmp.syms.length, ser = n >= 2 ? cmpSeries() : [], emp = $('cvCmpE');
  if (emp) { emp.hidden = ser.length >= 2; emp.textContent = t(n >= 2 && cmpBusy ? 'cmp_load' : 'cmp_need'); }
  if (!LWC()) { drawChart(cvIn(el), ser, { base: 100, smooth: true, fy: v => v.toFixed(1) + '%', fx: dm, empty: '' }); return; }
  let c = CH.cmp;
  if (!c || c.el !== el) { chartKill('cmp'); c = CH.cmp = { el: el, chart: lwChart(el, { time: false }), ls: {}, sig: '' }; c.chart.subscribeCrosshairMove(cmpLegend); }
  const sig = ser.map(s => s.sym + ':' + s.pts.length + ':' + s.pts[0][0] + ':' + s.pts[s.pts.length - 1][1].toFixed(4) + ':' + (s.real ? 1 : 0)).join('|') + '|' + S.cmp.per;
  if (sig !== c.sig) {
    Object.keys(c.ls).forEach(k => { try { c.chart.removeSeries(c.ls[k]); } catch (e) {} }); c.ls = {}; c.sig = sig;
    ser.forEach((s, i) => {
      const l = c.chart.addLineSeries({ color: s.color, lineWidth: 2, lineStyle: s.real ? 0 : 2, priceFormat: { type: 'custom', formatter: pctFmt, minMove: 0.01 },
        priceLineVisible: false, lastValueVisible: true, crosshairMarkerRadius: 4, crosshairMarkerBorderColor: COL.bg, crosshairMarkerBackgroundColor: s.color });
      const d = []; s.pts.forEach(p => { const tm = lt(p[0]), v = p[1] - 100; if (d.length && tm <= d[d.length - 1].time) { if (tm === d[d.length - 1].time) d[d.length - 1].value = v; return; } d.push({ time: tm, value: v }); });
      l.setData(d);
      if (!i) l.createPriceLine({ price: 0, color: rgba(COL.txt, 0.28), lineWidth: 1, lineStyle: 2, axisLabelVisible: false });
      c.ls[s.sym] = l;
    });
    c.chart.timeScale().fitContent();
  }
  Object.keys(c.ls).forEach(k => c.ls[k].applyOptions({ visible: !ui.cmpOff[k] }));
}
function cmpLegend(p) {
  const c = CH.cmp; if (!c) return;
  document.querySelectorAll('[data-lgv]').forEach(el => {
    const k = el.getAttribute('data-lgv'), l = c.ls[k]; let v = null;
    if (p && p.time != null && p.seriesData && l) { const d = p.seriesData.get(l); if (d && d.value != null) v = d.value; }
    if (v == null) v = +el.getAttribute('data-res') * 100;
    setTxt(el, pct(v / 100), v);
  });
}
function fillCmp() {
  const ser = S.cmp.syms.length >= 2 ? cmpSeries() : [], lg = $('cmpLegend'), tb = $('cmpTable');
  if (lg) lg.innerHTML = ser.map(s => '<button type="button" class="lg-row' + (ui.cmpOff[s.sym] ? ' off' : '') + '" data-cl="' + s.sym + '" aria-pressed="' + !ui.cmpOff[s.sym] + '"><i class="dot" style="background:' + s.color + '"></i><span class="lg-name"><b class="num">' + esc(s.name) + '</b><small>' + esc(L(INS[s.sym])) + '</small>' +
    '<span class="st" data-st="' + (s.real ? 'delayed' : 'model') + '">' + t(s.real ? 'cmp_real' : 'cmp_model') + '</span></span>' +
    '<b class="num ' + (s.res > 0 ? 'up' : s.res < 0 ? 'down' : '') + '" data-lgv="' + s.sym + '" data-res="' + s.res + '">' + pct(s.res) + '</b></button>').join('') + (ser.length ? '<p class="lg-tap">' + t('cmp_tap') + '</p>' : '');
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
  $('compareBox').innerHTML = '<div class="vhead"><h1>' + t('cmp_h') + '</h1></div>' +
    '<p class="lbl">' + t('cmp_sel') + '</p><div class="chips cmp-sel">' + (c.syms.length ? c.syms.map((s, i) =>
      '<button class="chip on" type="button" data-csym="' + s + '" aria-pressed="true"><i class="dot" style="background:' + LINES[i % 4] + '"></i>' + esc(tk(s)) + '<span class="x" aria-hidden="true">×</span></button>').join('') :
      '<span class="hint">' + t('cmp_none') + '</span>') + '</div>' +
    '<div class="chips per">' + [7, 30, 90].map(p => '<button class="chip' + (p === c.per ? ' on' : '') + '" type="button" data-per="' + p + '">' + t('per_' + p) + '</button>').join('') + '</div>' +
    '<div class="panel cmp-panel ch-panel"><div class="chart lw" id="cvCmp"></div><p class="ch-empty" id="cvCmpE" hidden></p><div class="legend" id="cmpLegend"></div></div>' +
    '<div id="cmpTable" class="cmp-table"></div>' +
    '<h2 class="h2">' + t('cmp_add') + '</h2><div class="chips">' + E.CATS.map(k => '<button class="chip' + (k.id === cat ? ' on' : '') + '" type="button" data-ccat="' + k.id + '">' + esc(L(k)) + '</button>').join('') + '</div>' +
    '<div class="chips cmp-pick">' + SYMS.filter(s => INS[s].cat === cat).map(s => '<button class="chip' + (c.syms.indexOf(s) >= 0 ? ' on' : '') + '" type="button" data-csym="' + s + '" title="' + esc(L(INS[s])) + '">' + esc(tk(s)) + '</button>').join('') + '</div>' +
    '<p class="chart-note">' + t('cmp_note') + '</p>';
  chartKill('cmp'); if (!LWC()) bindHover(cvIn($('cvCmp')), drawCmp);
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
  nav_bets: 'Ставки', bet_h: 'Ставки', bt_sport: 'Спорт', bt_pred: 'Прогнозы',
  bc_all: 'Все', bc_sports: 'Спорт', bc_esports: 'Киберспорт', bc_politics: 'Политика', bc_world: 'Мир', bc_crypto: 'Крипта', bc_economy: 'Экономика', bc_finance: 'Финансы', bc_tech: 'Технологии', bc_culture: 'Культура',
  sp_mma: 'MMA', sp_box: 'Бокс', sp_soc: 'Футбол', sp_ten: 'Теннис', sp_bsk: 'Баскетбол',
  sp_none: 'Сейчас событий нет.', d_today: 'Сегодня', d_tom: 'Завтра', bet_draw: 'Ничья', x_1: 'П1', x_0: 'Х', x_2: 'П2',
  bet_upd: 'Обновлено {t}', bet_load: 'Загружаем…', bet_err: 'Источник коэффициентов сейчас не отвечает. Попробуйте обновить через минуту.',
  bet_none: 'В этой рубрике сейчас нет открытых событий.', bet_more: 'Показать ещё', bet_refresh: 'Обновить', bet_until: 'до {t}', bet_vol: 'оборот {v}',
  bet_yes: 'Да', bet_no: 'Нет', bet_rest: 'ещё {n}', bet_fold: 'Свернуть',
  slip_h: 'Купон', slip_empty: 'Купон пуст. Нажмите на коэффициент.', slip_x: 'Закрыть',
  bet_amt: 'Сумма, $', bet_cash: 'В кошельке', bet_win: 'Выплата', bet_go: 'Поставить', bet_max: 'Всё',
  bet_min: 'Минимальная ставка — $1.', bet_closed: 'Приём ставок на этот исход закрыт.', bet_many: 'Открыто слишком много ставок. Дождитесь расчёта или продайте часть.',
  bet_done: 'Ставка принята, коэффициент {k}', bet_my: 'Мои ставки', bet_all: 'Показать все · {n}',
  bet_stake: 'ставка', bet_sell: 'Продать', bet_sold: 'Ставка продана: {v}', bet_settled: 'Ставки рассчитаны: {v}',
  bet_hist: 'История', how_win: 'сыграла', how_lose: 'не сыграла', how_sold: 'продана', how_void: 'возврат',
  bs_n: 'Ставок сделано', bs_won: 'Из них в плюс', bs_staked: 'Поставлено', bs_paid: 'Вернулось', bs_open: 'Сейчас в игре', bs_net: 'Итог по ставкам',
  tip_bets: 'Источник — рынок прогнозов Polymarket. Коэффициент = 1 / цена исхода, доли букмекера в нём нет: у настоящих букмекеров он ниже. Названия событий на английском, как в источнике. Деньги игровые, вывести их нельзя.'
});
Object.assign(T.en, {
  nav_bets: 'Bets', bet_h: 'Bets', bt_sport: 'Sport', bt_pred: 'Predictions',
  bc_all: 'All', bc_sports: 'Sports', bc_esports: 'Esports', bc_politics: 'Politics', bc_world: 'World', bc_crypto: 'Crypto', bc_economy: 'Economy', bc_finance: 'Finance', bc_tech: 'Tech', bc_culture: 'Culture',
  sp_mma: 'MMA', sp_box: 'Boxing', sp_soc: 'Football', sp_ten: 'Tennis', sp_bsk: 'Basketball',
  sp_none: 'No events right now.', d_today: 'Today', d_tom: 'Tomorrow', bet_draw: 'Draw', x_1: '1', x_0: 'X', x_2: '2',
  bet_upd: 'Updated {t}', bet_load: 'Loading…', bet_err: 'The odds source is not responding right now. Try refreshing in a minute.',
  bet_none: 'No open events in this section right now.', bet_more: 'Show more', bet_refresh: 'Refresh', bet_until: 'until {t}', bet_vol: 'volume {v}',
  bet_yes: 'Yes', bet_no: 'No', bet_rest: '{n} more', bet_fold: 'Collapse',
  slip_h: 'Bet slip', slip_empty: 'The slip is empty. Tap any odds.', slip_x: 'Close',
  bet_amt: 'Amount, $', bet_cash: 'In wallet', bet_win: 'Payout', bet_go: 'Place bet', bet_max: 'All',
  bet_min: 'The minimum bet is $1.', bet_closed: 'Betting on this outcome is closed.', bet_many: 'Too many open bets. Wait for settlement or sell some.',
  bet_done: 'Bet placed, odds {k}', bet_my: 'My bets', bet_all: 'Show all · {n}',
  bet_stake: 'stake', bet_sell: 'Sell', bet_sold: 'Bet sold: {v}', bet_settled: 'Bets settled: {v}',
  bet_hist: 'History', how_win: 'won', how_lose: 'lost', how_sold: 'sold', how_void: 'refund',
  bs_n: 'Bets placed', bs_won: 'Ended in profit', bs_staked: 'Staked', bs_paid: 'Returned', bs_open: 'In play now', bs_net: 'Betting result',
  tip_bets: 'Source: the Polymarket prediction market. Odds = 1 / outcome price, with no bookmaker margin: real bookmakers pay less. Event names come in English, as in the source. This is play money and cannot be withdrawn.'
});
const PM = 'https://gamma-api.polymarket.com/markets';
const BCATS = [['all', 0], ['sports', 1], ['esports', 64], ['politics', 2], ['world', 100265], ['crypto', 21], ['economy', 100328], ['finance', 120], ['tech', 1401], ['culture', 596]];
// Sport lines: the same open Polymarket API, only "who wins" (moneyline) markets with a start time. k = 2 two-way, k = 3 home / draw / away.
const SPORTS = [{ id: 'mma', tag: 279, k: 2 }, { id: 'box', tag: 683, k: 2, x: 1 }, { id: 'soc', tag: 100350, k: 3 }, { id: 'ten', tag: 864, k: 2 }, { id: 'bsk', tag: 745, k: 2 }];
const BPAGE = 60, SPAGE = 100, BLO = 0.02, BHI = 0.98;
let betEv = [], betMk = {}, betAt = 0, betCat = '', betBusy = false, betErr = false, betOff = 0, betMore = false, betChk = false, betChkAt = 0;
const SP = {}, bOpen = {};
const sps = id => SP[id] || (SP[id] = { list: [], at: 0, err: false, busy: false, off: 0, more: false, map: {} });
function bst() {
  if (!Array.isArray(S.bets)) S.bets = [];
  if (!Array.isArray(S.betHist)) S.betHist = [];
  if (!S.betAgg || typeof S.betAgg !== 'object') S.betAgg = { n: 0, won: 0, staked: 0, paid: 0 };
  return S;
}
// Pictures: only from Polymarket's own image store, nothing else is ever put into src.
const bimg = u => (typeof u === 'string' && /^https:\/\/polymarket-upload\.s3\.us-east-2\.amazonaws\.com\/[\w.\-\/%+]{1,200}\.(png|jpe?g|webp)$/i.test(u) ? u : '');
const pgs = s => { if (typeof s !== 'string') return 0; const d = Date.parse(s.replace(' ', 'T').replace(/\+00(:00)?$/, 'Z')); return d > 0 ? d : 0; };
function cleanMk(o) {
  if (!o || !/^\d{1,12}$/.test(String(o.id)) || typeof o.question !== 'string') return null;
  let out, pr;
  try { out = JSON.parse(o.outcomes); pr = JSON.parse(o.outcomePrices).map(Number); } catch (e) { return null; }
  if (!Array.isArray(out) || out.length !== 2 || !Array.isArray(pr) || pr.length !== 2 || !pr.every(p => p >= 0 && p <= 1)) return null;
  const ev = Array.isArray(o.events) && o.events[0] ? o.events[0] : {}, sr = Array.isArray(ev.series) && ev.series[0] && typeof ev.series[0].title === 'string' ? ev.series[0].title.trim().slice(0, 50) : '';
  return { id: String(o.id), q: o.question.trim().slice(0, 200), g: typeof o.groupItemTitle === 'string' ? o.groupItemTitle.trim().slice(0, 80) : '',
    out: out.map(x => String(x).trim().slice(0, 40)), pr: pr, end: Date.parse(o.endDate) || 0, gs: pgs(o.gameStartTime), typ: typeof o.sportsMarketType === 'string' ? o.sportsMarketType : '',
    closed: o.closed === true, vol: +o.volume24hr > 0 ? +o.volume24hr : 0,
    img: bimg(ev.icon) || bimg(ev.image) || bimg(o.icon) || bimg(o.image), sr: sr, ss: typeof ev.seriesSlug === 'string' ? ev.seriesSlug.slice(0, 40) : '',
    ev: /^\d{1,12}$/.test(String(ev.id)) ? String(ev.id) : 'm' + o.id, et: typeof ev.title === 'string' ? ev.title.trim().slice(0, 160) : '' };
}
// Remember the last price, so an odd that moved can flash for a moment.
function putMk(m) { const o = betMk[m.id]; m.dp = o && o.pr[0] !== m.pr[0] ? (m.pr[0] > o.pr[0] ? 1 : -1) : 0; betMk[m.id] = m; return m; }
const coef = p => { const k = 1 / p; return fixed(k, k >= 10 ? 1 : 2); };
const okp = p => p >= BLO && p <= BHI;
const bvol = v => '$' + (v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? Math.round(v / 1e3) + 'K' : Math.round(v));
function bdate(ms) { const d = new Date(ms); return ms - Date.now() > 2.6e10 ? p2(d.getDate()) + '.' + p2(d.getMonth() + 1) + '.' + d.getFullYear() : stamp(ms); }
const hhmm = ms => { const d = new Date(ms); return p2(d.getHours()) + ':' + p2(d.getMinutes()); };
function dayLabel(ms) {
  const d = new Date(ms), n = new Date(), k = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(n.getFullYear(), n.getMonth(), n.getDate())) / 864e5);
  if (k <= 0) return t('d_today');
  if (k === 1) return t('d_tom');
  return d.toLocaleDateString(S.lang === 'en' ? 'en-GB' : 'ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
}
const oname = s => (s === 'Yes' ? t('bet_yes') : s === 'No' ? t('bet_no') : s);
const mkEl = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

// Money is missing or not enough: the same message with a top-up button everywhere.
Object.assign(T.ru, { hbal_aria: 'Кошелёк: стоимость портфеля', topup: 'Пополнить кошелёк', need_more: 'В кошельке не хватает денег.', tip_aria: 'Что это?',
  tip_pause: 'Откроет минуту тишины: дыхание на четыре счёта и ваш общий итог. Сделки не закрывает и торговать не запрещает. Сама появляется после трёх убыточных сделок подряд.',
  tip_lev: 'Плечо умножает и прибыль, и убыток. При ×10 цена, ушедшая против вас на 10%, съедает всю сумму сделки — позицию закроет автоматически.',
  tip_sell: 'Забрать деньги до исхода события по текущему коэффициенту: шанс вырос — вернётся больше ставки, упал — меньше.' });
Object.assign(T.en, { hbal_aria: 'Wallet: portfolio value', topup: 'Top up the wallet', need_more: 'Not enough money in the wallet.', tip_aria: 'What is this?',
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

/* ---------- loading: predictions (by section) ---------- */
async function loadBets(more) {
  if (betBusy) return;
  betBusy = true;
  const cat = ui.bcat, tag = (BCATS.filter(c => c[0] === cat)[0] || BCATS[0])[1], off = more ? betOff : 0;
  if (cat !== betCat) { betEv = []; betAt = 0; betErr = false; if (ui.btab === 'pred') fillBets(); }
  try {
    const d = await getJSON(PM + '?closed=false&active=true&order=volume24hr&ascending=false&limit=' + BPAGE + '&offset=' + off + (tag ? '&tag_id=' + tag + '&related_tags=true' : ''), 15000);
    if (cat !== ui.bcat) { betBusy = false; return loadBets(); }
    const now = Date.now(), raw = Array.isArray(d) ? d : [];
    const ev = more ? betEv : [];
    raw.map(cleanMk).filter(m => m && !m.closed && m.end > now && m.pr[0] >= BLO && m.pr[0] <= BHI).forEach(m => {
      putMk(m);
      let e = ev.filter(x => x.id === m.ev)[0];
      if (!e) { e = { id: m.ev, t: m.et || m.q, end: m.end, vol: 0, m: [] }; ev.push(e); }
      if (!e.m.some(x => x.id === m.id)) { e.m.push(m); e.vol += m.vol; if (m.end < e.end) e.end = m.end; }
    });
    betEv = ev; betCat = cat; betOff = off + BPAGE; betMore = raw.length >= BPAGE && betOff < 600; betErr = false; betAt = now;
  } catch (e) { betErr = true; betCat = cat; }
  betBusy = false;
  if (ui.view === 'bets' && ui.btab === 'pred') { fillBets(); slipPrices(); }
}

/* ---------- loading: sport lines ---------- */
const LEAGUES = { epl: 'Premier League', lal: 'LaLiga', bun: 'Bundesliga', sea: 'Serie A', fl1: 'Ligue 1', ucl: 'Champions League', uel: 'Europa League', uecl: 'Conference League', mls: 'MLS', 'fifa-friendly': 'Friendly', cwc: 'Club World Cup', fifwc: 'World Cup', euc: 'Euro' };
function leagueOf(m) {
  if (m.sr) return m.sr;
  if (LEAGUES[m.ss]) return LEAGUES[m.ss];
  const w = String(m.ss || '').replace(/-games?$/, '').replace(/-/g, ' ').trim();
  return w.length > 5 ? w.replace(/\b\w/g, c => c.toUpperCase()) : w.toUpperCase();
}
function addSport(sp, m, map) {
  const t0 = m.gs || m.end;
  if (m.closed || !t0 || t0 <= Date.now()) return;
  const yn = m.out[0] === 'Yes' && m.out[1] === 'No', ttl = m.et || m.q;
  if (m.typ && m.typ !== 'moneyline') return;
  if (sp.k === 3) {
    if (!yn || !m.et) return;
    const tm = m.et.split(/\s+vs\.?\s+/i); if (tm.length !== 2) return;
    const h = tm[0].trim(), a = tm[1].trim(), g = m.g.toLowerCase(), q = m.q.toLowerCase();
    const role = /^draw/i.test(m.g) || /end in a draw/i.test(m.q) ? 'x' : (g === h.toLowerCase() || q.indexOf('will ' + h.toLowerCase() + ' win') === 0 ? '1' : (g === a.toLowerCase() || q.indexOf('will ' + a.toLowerCase() + ' win') === 0 ? '2' : ''));
    if (!role) return;
    const e = map[m.ev] || (map[m.ev] = { id: m.ev, k: 3, t0: t0, home: h, away: a, lg: leagueOf(m), r: {} });
    e.r[role] = putMk(m); m.sl = { k: 3, title: h + ' — ' + a, role: role, name: role === '1' ? h : a };
  } else {
    if (yn || !/\svs\.?\s/i.test(ttl)) return;
    const c = /^([^:]{2,40}):/.exec(m.q), w = /\(([^)]{2,60})\)\s*$/.exec(m.q);
    map[m.id] = { id: m.id, k: 2, t0: t0, m: [putMk(m)], meta: [c ? c[1] : leagueOf(m), w ? w[1] : ''].filter(Boolean).join(' · ') };
    m.sl = { k: 2, title: ttl.replace(/^[^:]{2,40}:\s*/, '').replace(/\s*\([^)]*\)\s*$/, '') };
  }
}
async function loadSport(more) {
  const id = ui.sport, sp = SPORTS.filter(x => x.id === id)[0], st = sps(id);
  if (!sp || st.busy) return;
  st.busy = true;
  const off = more ? st.off : 0;
  try {
    const url = PM + '?closed=false&active=true&limit=' + SPAGE + '&offset=' + off + '&order=endDate&ascending=true&sports_market_types=moneyline&end_date_min=' + encodeURIComponent(new Date().toISOString()) + '&tag_id=' + sp.tag;
    const reqs = [getJSON(url, 15000)];
    if (sp.x && !more) reqs.push(getJSON(PM + '?closed=false&active=true&limit=100&order=volume24hr&ascending=false&tag_id=' + sp.tag, 15000).catch(() => []));
    const r = await Promise.all(reqs), map = more ? st.map : {};
    r.forEach(a => (Array.isArray(a) ? a : []).map(cleanMk).filter(Boolean).forEach(m => addSport(sp, m, map)));
    const raw = Array.isArray(r[0]) ? r[0] : [];
    st.map = map; st.list = Object.keys(map).map(k => map[k]).filter(e => e.k === 2 || (e.r['1'] && e.r['2'])).sort((a, b) => a.t0 - b.t0);
    st.off = off + SPAGE; st.more = raw.length >= SPAGE && st.off < 500; st.err = false; st.at = Date.now();
  } catch (e) { st.err = true; }
  st.busy = false;
  if (ui.view === 'bets' && ui.btab === 'sport' && ui.sport === id) { fillBets(); slipPrices(); }
}

/* ---------- screen ---------- */
function renderBets() {
  bst();
  $('betsBox').innerHTML = '<div class="bt-top"><h1>' + t('bet_h') + '</h1><div class="seg" role="tablist">' +
    [['sport', 'bt_sport'], ['pred', 'bt_pred']].map(a => '<button type="button" role="tab" class="' + (ui.btab === a[0] ? 'on' : '') + '" aria-selected="' + (ui.btab === a[0]) + '" data-btab="' + a[0] + '">' + t(a[1]) + '</button>').join('') + '</div></div>' +
    '<div class="bgrid"><div class="bcol"><div id="betMine"></div><div class="chips bcats" id="betChips"></div>' +
    '<div class="bet-bar"><p class="news-meta num" id="betMeta"></p><span class="qrow">' + qm('tip_bets') + '<button class="btn-ghost" type="button" data-act="bet-refresh">' + t('bet_refresh') + '</button></span></div>' +
    '<div class="bets" id="betList"></div><div class="bet-more" id="betMoreBox"></div></div>' +
    '<aside class="slip" id="slip"><div class="slip-card" id="slipBody"></div></aside></div>';
  fillChips(); fillMine(); fillBets(); fillSlip();
  if (ui.btab === 'sport') { const st = sps(ui.sport); if (!st.at || Date.now() - st.at > 6e4) loadSport(); }
  else if (betCat !== ui.bcat || Date.now() - betAt > 6e4) loadBets();
  checkBets();
}
function fillChips() {
  const box = $('betChips'); if (!box) return;
  box.innerHTML = ui.btab === 'sport'
    ? SPORTS.map(s => '<button class="chip' + (s.id === ui.sport ? ' on' : '') + '" type="button" data-sp="' + s.id + '">' + t('sp_' + s.id) + '</button>').join('')
    : BCATS.map(c => '<button class="chip' + (c[0] === ui.bcat ? ' on' : '') + '" type="button" data-bcat="' + c[0] + '">' + t('bc_' + c[0]) + '</button>').join('');
}
function fillBets(fresh) { if (ui.btab === 'sport') fillSport(fresh); else fillPred(fresh); }
function flashCls(m, oi) { const d = (m.dp || 0) * (oi === 0 ? -1 : 1); return d > 0 ? ' fl-up' : d < 0 ? ' fl-dn' : ''; }
function selOdd(b, m, oi, lab) {
  b.type = 'button';
  if (okp(m.pr[oi])) { b.setAttribute('data-bet', m.id); b.setAttribute('data-oi', oi); if (lab) b.setAttribute('aria-label', lab + ' ' + coef(m.pr[oi])); if (ui.bet && ui.bet.id === m.id && ui.bet.oi === oi) b.classList.add('on'); } else b.disabled = true;
  return okp(m.pr[oi]) ? coef(m.pr[oi]) : '—';
}
function fightRow(e) {
  const m = e.m[0], row = mkEl('div', 'srow two'), bt = mkEl('div', 'sbtns');
  [0, 1].forEach(i => {
    const b = mkEl('button', 'od' + (i ? ' r' : '') + flashCls(m, i)), k = mkEl('b', 'num', selOdd(b, m, i, m.out[i])), n = mkEl('span', 'od-n', m.out[i]);
    if (i) { b.appendChild(k); b.appendChild(n); } else { b.appendChild(n); b.appendChild(k); }
    bt.appendChild(b);
  });
  row.appendChild(bt);
  const me = mkEl('p', 'smeta'); me.appendChild(mkEl('span', '', e.meta)); me.appendChild(mkEl('time', 'num', hhmm(e.t0))); row.appendChild(me);
  return row;
}
function matchRow(e) {
  const row = mkEl('div', 'srow three'), tm = mkEl('div', 'steams');
  tm.appendChild(mkEl('p', 'tm', e.home)); tm.appendChild(mkEl('p', 'tm', e.away));
  const me = mkEl('p', 'smeta'); me.appendChild(mkEl('time', 'num', hhmm(e.t0))); if (e.lg) me.appendChild(mkEl('span', '', e.lg)); tm.appendChild(me);
  const bt = mkEl('div', 's3');
  [['1', '1'], ['x', '0'], ['2', '2']].forEach(a => {
    const m = e.r[a[0]], b = mkEl('button', 'od3' + (m ? flashCls(m, 0) : '')); b.type = 'button'; b.appendChild(mkEl('i', '', t('x_' + a[1])));
    b.appendChild(mkEl('b', 'num', m ? selOdd(b, m, 0, t('x_' + a[1])) : (b.disabled = true, '—')));
    bt.appendChild(b);
  });
  row.appendChild(tm); row.appendChild(bt);
  return row;
}
function fillSport(fresh) {
  const box = $('betList'), meta = $('betMeta'), mb = $('betMoreBox'); if (!box) return;
  const st = sps(ui.sport);
  box.textContent = ''; mb.textContent = ''; box.className = 'bets sp' + (fresh ? ' fresh' : '');
  if (!st.at && !st.err) { setTxt(meta, t('bet_load')); return; }
  if (st.err && !st.list.length) { setTxt(meta, ''); box.appendChild(mkEl('p', 'empty', t('bet_err'))); return; }
  setTxt(meta, tf('bet_upd', { t: clock(st.at) }));
  if (!st.list.length) { box.appendChild(mkEl('p', 'empty', t('sp_none'))); return; }
  let key = '', grp = null, gi = 0;
  st.list.forEach(e => {
    const d = new Date(e.t0), k = d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
    if (k !== key) { key = k; grp = mkEl('section', 'sgroup'); grp.style.setProperty('--i', Math.min(gi++, 6)); grp.appendChild(mkEl('h3', 'sday', dayLabel(e.t0))); box.appendChild(grp); }
    grp.appendChild(e.k === 3 ? matchRow(e) : fightRow(e));
  });
  if (st.more) { const b = mkEl('button', 'btn-ghost', t('bet_more')); b.type = 'button'; b.setAttribute('data-act', 'bet-more'); mb.appendChild(b); }
}
function predBtn(m, oi, lab) {
  const b = mkEl('button', 'po' + flashCls(m, oi) + (lab === 'Yes' ? ' yes' : lab === 'No' ? ' no' : '')), k = selOdd(b, m, oi, lab);
  b.appendChild(mkEl('span', 'po-n', oname(lab))); b.appendChild(mkEl('b', 'num', k));
  return b;
}
function fillPred(fresh) {
  const box = $('betList'), meta = $('betMeta'), mb = $('betMoreBox'); if (!box) return;
  box.textContent = ''; mb.textContent = ''; box.className = 'bets pred' + (fresh ? ' fresh' : '');
  if (betCat !== ui.bcat || (!betAt && !betErr)) { setTxt(meta, t('bet_load')); return; }
  if (betErr && !betEv.length) { setTxt(meta, ''); box.appendChild(mkEl('p', 'empty', t('bet_err'))); return; }
  setTxt(meta, tf('bet_upd', { t: clock(betAt) }));
  if (!betEv.length) box.appendChild(mkEl('p', 'empty', t('bet_none')));
  betEv.forEach((e, n) => {
    const card = mkEl('article', 'pcard' + (bOpen[e.id] ? ' open' : '')), hd = mkEl('div', 'phd'), pic = e.m[0] && e.m[0].img;
    card.style.setProperty('--i', Math.min(n, 8));
    if (pic) { const im = mkEl('img', 'bpic'); im.alt = ''; im.loading = 'lazy'; im.decoding = 'async'; im.referrerPolicy = 'no-referrer'; im.width = 40; im.height = 40; im.onerror = () => im.remove(); im.src = pic; hd.appendChild(im); }
    const tx = mkEl('div', 'pt'), mt = mkEl('p', 'pm');
    tx.appendChild(mkEl('h3', '', e.m.length === 1 ? e.m[0].q : e.t));
    mt.appendChild(mkEl('span', '', tf('bet_until', { t: bdate(e.end) }))); if (e.vol >= 1000) mt.appendChild(mkEl('span', 'num', bvol(e.vol)));
    tx.appendChild(mt); hd.appendChild(tx); card.appendChild(hd);
    const one = e.m.length === 1, od = mkEl('div', 'pod' + (one ? ' p2' : ''));
    if (one) e.m[0].out.forEach((o, i) => od.appendChild(predBtn(e.m[0], i, o)));
    else {
      const ms = e.m.slice().sort((a, b) => b.pr[0] - a.pr[0]).slice(0, 30);
      ms.forEach((m, i) => {
        const b = predBtn(m, 0, m.g || m.q); b.firstChild.textContent = m.g || m.q; if (i >= 3) b.classList.add('xtra'); od.appendChild(b);
      });
      if (ms.length > 3) {
        const x = mkEl('button', 'pmore', tf('bet_rest', { n: ms.length - 3 })); x.type = 'button'; x.setAttribute('data-bx', e.id); x.setAttribute('data-more', tf('bet_rest', { n: ms.length - 3 })); x.setAttribute('data-less', t('bet_fold'));
        if (bOpen[e.id]) x.textContent = t('bet_fold');
        card.appendChild(od); card.appendChild(x); box.appendChild(card); return;
      }
    }
    card.appendChild(od); box.appendChild(card);
  });
  if (betMore) { const b = mkEl('button', 'btn-ghost', t('bet_more')); b.type = 'button'; b.setAttribute('data-act', 'bet-more'); mb.appendChild(b); }
}

/* ---------- my bets: a short list, history folded ---------- */
function fillMine() {
  const box = $('betMine'); if (!box) return;
  bst(); box.textContent = '';
  if (!S.bets.length && !S.betHist.length) return;
  const wrap = mkEl('section', 'mine');
  if (S.bets.length) {
    const hd = mkEl('div', 'mine-h'); hd.appendChild(mkEl('h2', 'mine-t', t('bet_my'))); hd.appendChild(mkEl('span', 'mine-n num', String(S.bets.length))); hd.insertAdjacentHTML('beforeend', qm('tip_sell'));
    wrap.appendChild(hd);
    const list = mkEl('div', 'bmine');
    S.bets.slice(0, ui.mineAll ? 40 : 3).forEach(b => {
      const val = E.round2(b.a / b.p * (b.cur >= 0 ? b.cur : b.p)), row = mkEl('div', 'bm'), l = mkEl('div', 'bm-l');
      l.appendChild(mkEl('p', 'bm-q', b.q));
      l.appendChild(mkEl('p', 'bm-s num', oname(b.o) + ' · ' + coef(b.p) + ' · ' + money(b.a)));
      row.appendChild(l);
      row.appendChild(mkEl('span', 'bm-v num' + (val > b.a ? ' up' : val < b.a ? ' down' : ''), money(val)));
      const s = mkEl('button', 'btn-ghost bm-sell', t('bet_sell')); s.type = 'button'; s.setAttribute('data-bsell', b.id); row.appendChild(s);
      list.appendChild(row);
    });
    wrap.appendChild(list);
    if (S.bets.length > 3) { const m = mkEl('button', 'mine-all', ui.mineAll ? t('bet_fold') : tf('bet_all', { n: S.bets.length })); m.type = 'button'; m.setAttribute('data-bmine', '1'); wrap.appendChild(m); }
  }
  if (S.betHist.length) {
    const h = mkEl('button', 'mine-hist' + (ui.histOpen ? ' open' : ''), t('bet_hist') + ' · ' + S.betHist.length); h.type = 'button'; h.setAttribute('data-bhist', '1'); h.setAttribute('aria-expanded', ui.histOpen ? 'true' : 'false'); wrap.appendChild(h);
    if (ui.histOpen) {
      const hl = mkEl('div', 'bmine');
      S.betHist.slice(0, 8).forEach(x => {
        const row = mkEl('div', 'bm done'), l = mkEl('div', 'bm-l'), net = E.round2(x.pay - x.a);
        l.appendChild(mkEl('p', 'bm-q', x.q));
        l.appendChild(mkEl('p', 'bm-s num', oname(x.o) + ' · ' + coef(x.p) + ' · ' + money(x.a) + ' · ' + t('how_' + x.how)));
        row.appendChild(l); row.appendChild(mkEl('span', 'num bm-net' + (net > 0 ? ' up' : net < 0 ? ' down' : ''), signed(net)));
        hl.appendChild(row);
      });
      wrap.appendChild(hl);
      const A = S.betAgg, open = E.round2(S.bets.reduce((s, b) => s + b.a, 0)), net = E.round2(A.paid - (A.staked - open));
      const sum = mkEl('div', 'm-nums bet-sum');
      [[t('bs_n'), String(A.n), ''], [t('bs_won'), String(A.won), ''], [t('bs_staked'), money(A.staked), ''], [t('bs_paid'), money(A.paid), ''], [t('bs_open'), money(open), ''],
        [t('bs_net'), signed(net), net > 0 ? ' up' : net < 0 ? ' down' : '']].forEach(a => {
        const d = mkEl('div'); d.appendChild(mkEl('span', '', a[0])); d.appendChild(mkEl('span', 'num' + a[2], a[1])); sum.appendChild(d);
      });
      wrap.appendChild(sum);
    }
  }
  box.appendChild(wrap);
}

/* ---------- the slip: bottom sheet on a phone, a sticky column on a computer ---------- */
function pickOf(m, oi) {
  if (m.sl && m.sl.k === 3) return { title: m.sl.title, lab: m.sl.role === 'x' ? t('bet_draw') : m.sl.name };
  if (m.sl) return { title: m.sl.title, lab: m.out[oi] };
  return { title: m.et && m.et !== m.q ? m.et + ' — ' + (m.g || m.q) : m.q, lab: oname(m.out[oi]) };
}
function markPick() {
  document.querySelectorAll('[data-bet]').forEach(b => b.classList.toggle('on', !!ui.bet && b.getAttribute('data-bet') === ui.bet.id && +b.getAttribute('data-oi') === ui.bet.oi));
}
function fillSlip() {
  const slip = $('slip'), box = $('slipBody'); if (!slip || !box) return;
  const b = ui.bet, m = b && betMk[b.id], keep = ($('betAmt') || {}).value || '';
  slip.classList.toggle('open', !!m);
  if (!m) { box.innerHTML = '<div class="slip-h"><h2 class="slip-t">' + t('slip_h') + '</h2></div><p class="slip-empty">' + t('slip_empty') + '</p>'; return; }
  box.innerHTML = '<div class="slip-h"><h2 class="slip-t">' + t('slip_h') + '</h2><button class="slip-x" type="button" data-act="slip-close" aria-label="' + t('slip_x') + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
    '<p class="slip-q" id="slipQ"></p><div class="slip-pick"><span id="betPick"></span><b class="num" id="betK"></b></div>' +
    '<input class="bet-inp num" id="betAmt" type="text" inputmode="decimal" autocomplete="off" maxlength="10" placeholder="' + t('bet_amt') + '" aria-label="' + t('bet_amt') + '">' +
    '<div class="chips eq">' + [10, 50, 100].map(v => '<button class="chip" type="button" data-bpre="' + v + '">' + v + '</button>').join('') + '<button class="chip" type="button" data-bpre="all">' + t('bet_max') + '</button></div>' +
    '<div class="slip-nums"><div><span>' + t('bet_win') + '</span><span class="num up" id="betWin">—</span></div><div><span>' + t('bet_cash') + '</span><span class="num" id="slipCash"></span></div></div>' +
    '<p class="bet-msg" id="betMsg" role="alert"></p><button class="btn-gold slip-go" type="button" data-act="bet-ok">' + t('bet_go') + '</button>';
  const pk = pickOf(m, b.oi);
  setTxt($('slipQ'), pk.title); setTxt($('betPick'), pk.lab);
  const inp = $('betAmt'); if (inp) { inp.value = keep; if (inp.addEventListener) inp.addEventListener('input', betInfo); }
  betInfo();
}
function slipPrices() { if (ui.bet && $('betAmt')) betInfo(); }
function betInfo() {
  const b = ui.bet, m = b && betMk[b.id]; if (!m) return;
  const a = parseAmt(($('betAmt') || {}).value), p = m.pr[b.oi];
  setTxt($('betK'), okp(p) ? coef(p) : '—'); setTxt($('slipCash'), money(S.cash));
  setTxt($('betWin'), a > 0 && okp(p) ? money(E.round2(a / p)) : '—');
  const msg = $('betMsg'); if (!msg) return;
  if (S.cash < 1 || a > S.cash + 1e-9) needMoney(msg); else msg.textContent = '';
}
function openBet(id, oi) {
  const m = betMk[id]; if (!m || !(oi === 0 || oi === 1)) return;
  ui.bet = { id: id, oi: oi };
  fillSlip(); markPick();
}
function closeSlip() { ui.bet = null; fillSlip(); markPick(); }
function doBet() {
  const b = ui.bet, m = b && betMk[b.id], msg = $('betMsg'); if (!m) return;
  bst();
  const a = E.round2(parseAmt(($('betAmt') || {}).value)), p = m.pr[b.oi], pk = pickOf(m, b.oi);
  if (S.cash < 1 || a > S.cash + 1e-9) { needMoney(msg); vib(20); return; }
  if (!(a >= 1)) { setTxt(msg, t('bet_min')); return; }
  if (!(p >= BLO && p <= BHI) || (m.gs || m.end) <= Date.now()) { setTxt(msg, t('bet_closed')); return; }
  if (S.bets.length >= 40) { setTxt(msg, t('bet_many')); return; }
  S.cash = E.round2(S.cash - a);
  S.bets.unshift({ id: S.nextId++, mk: m.id, q: pk.title, o: pk.lab, oi: b.oi, p: p, cur: p, a: a, at: Date.now(), end: m.gs || m.end });
  S.betAgg.n++; S.betAgg.staked = E.round2(S.betAgg.staked + a);
  save(); ui.bet = null; if (S.sound) snd.key(); vib(12);
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
      b.cur = m.pr[b.oi]; if (m.end) b.end = m.gs || m.end;
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
  if (ui.view !== 'bets') return;
  if (ui.btab === 'sport') { const st = sps(ui.sport); if (st.off <= SPAGE && Date.now() - st.at > 6e4) loadSport(); }
  else if (betOff <= BPAGE && Date.now() - betAt > 6e4) loadBets();
}

/* =====================================================================
   10. ROUTING, EVENTS, TICK
   ===================================================================== */
const VIEWS = ['money', 'market', 'compare', 'wallet', 'truth', 'news', 'bets', 'top'];
function render() {
  sig = posSig(); chartsKill();
  if (ui.view === 'market') renderMarket();
  else if (ui.view === 'wallet') renderWallet();
  else if (ui.view === 'truth') renderTruth();
  else if (ui.view === 'news') renderNews();
  else if (ui.view === 'bets') renderBets();
  else if (ui.view === 'top') renderTop();
  else if (ui.view === 'compare') { renderCompare(); cmpLoad(); }
  upd(true); refreshView(); hdrBal();
}
function refreshView() {
  if (ui.view === 'money') refreshMoney();
  else if (ui.view === 'market' && ui.sym) { setTxt($('trCash'), money(S.cash)); drawIns(); }
  else if (ui.view === 'wallet') refreshWallet();
  else if (ui.view === 'truth') refreshTruth();
  else if (ui.view === 'top') refreshTop();
}
// 13.11 (2): header shows the wallet — total portfolio value (cash + positions); tap opens the Wallet.
function hdrBal() { const el = $('hBalV'); if (el && S) rollTo(el, E.equity(S, M), tight); }
function refresh() {
  if (!S || document.hidden) return;
  hdrBal();
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
  const el = e.target && e.target.closest ? e.target.closest('[data-tf],[data-lev],[data-pre],[data-side],[data-close],[data-amt],[data-key],[data-act],[data-ncat],[data-ccat],[data-csym],[data-per],[data-bcat],[data-bet],[data-bsell],[data-bpre],[data-btab],[data-sp],[data-bx],[data-bmine],[data-bhist],[data-tip],[data-ct],[data-cl],#langBtn,#sndBtn,#skinBtn,#modal,#more,#slip,.more-row') : null;
  if (!el) return;
  const A = k => el.getAttribute(k), has = k => el.hasAttribute(k);
  if (has('data-tip')) { showTip(el); return; }
  if (A('data-act') === 'more') { moreSheet($('more').hidden); vib(8); return; }
  if (el.id === 'more') { if (e.target === el) moreSheet(false); return; }
  if (el.classList.contains('more-row')) { moreSheet(false); return; }
  { const tb = document.querySelector('.tipbox'); if (tb) tb.remove(); }
  if (el.id === 'modal') { if (e.target === el) el.hidden = true; return; }
  if (el.id === 'slip') { if (e.target === el && getComputedStyle(el).position === 'fixed') closeSlip(); return; }
  if (el.id === 'skinBtn') { nextSkin(); if (S.sound) snd.key(); return; }
  if (el.id === 'langBtn') { S.lang = S.lang === 'en' ? 'ru' : 'en'; save(); applyLang(); render(); return; }
  if (el.id === 'sndBtn') { S.sound = !S.sound; save(); applyLang(); if (S.sound) snd.key(); return; }
  if (has('data-ct')) {
    ui.ct = A('data-ct') === 'line' ? 'line' : 'candle'; try { localStorage.setItem('dofa_sim_ct', ui.ct); } catch (e) {}
    document.querySelectorAll('[data-ct]').forEach(b => { const on = b === el; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); }); drawIns(true); vib(8);
  } else if (has('data-cl')) {
    const k = A('data-cl'); ui.cmpOff[k] = !ui.cmpOff[k]; el.classList.toggle('off', !!ui.cmpOff[k]); el.setAttribute('aria-pressed', String(!ui.cmpOff[k]));
    const c = CH.cmp; if (c && c.ls[k]) c.ls[k].applyOptions({ visible: !ui.cmpOff[k] }); vib(8);
  } else if (has('data-tf')) {
    ui.tf = A('data-tf'); document.querySelectorAll('[data-tf]').forEach(b => b.classList.toggle('on', b === el)); drawIns(true);
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
  else if (has('data-btab')) {
    ui.btab = A('data-btab') === 'pred' ? 'pred' : 'sport';
    document.querySelectorAll('[data-btab]').forEach(b => { const on = b === el; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
    fillChips(); fillBets(true);
    if (ui.btab === 'sport') { const st = sps(ui.sport); if (!st.at || Date.now() - st.at > 6e4) loadSport(); } else if (betCat !== ui.bcat || Date.now() - betAt > 6e4) loadBets();
  } else if (has('data-sp')) {
    ui.sport = A('data-sp'); document.querySelectorAll('[data-sp]').forEach(b => b.classList.toggle('on', b === el)); fillBets(true);
    { const st = sps(ui.sport); if (!st.at || Date.now() - st.at > 6e4) loadSport(); }
  } else if (has('data-bcat')) {
    ui.bcat = A('data-bcat'); document.querySelectorAll('[data-bcat]').forEach(b => b.classList.toggle('on', b === el)); fillBets(true); loadBets();
  } else if (has('data-bx')) {
    const id = A('data-bx'), card = el.closest('.pcard'); bOpen[id] = !bOpen[id]; if (card) card.classList.toggle('open', !!bOpen[id]); el.textContent = bOpen[id] ? A('data-less') : A('data-more');
  } else if (has('data-bmine')) { ui.mineAll = !ui.mineAll; fillMine(); }
  else if (has('data-bhist')) { ui.histOpen = !ui.histOpen; fillMine(); }
  else if (has('data-bet')) openBet(A('data-bet'), +A('data-oi'));
  else if (has('data-bsell')) sellBet(+A('data-bsell'));
  else if (has('data-bpre')) { const inp = $('betAmt'), cash = Math.floor(S.cash * 100) / 100, v = A('data-bpre') === 'all' ? cash : Math.min(+A('data-bpre'), cash); if (inp) { inp.value = v > 0 ? String(v) : ''; betInfo(); } }
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
    else if (a === 'bet-more') { if (ui.btab === 'sport') loadSport(true); else loadBets(true); }
    else if (a === 'slip-close') closeSlip();
    else if (a === 'bet-refresh') { if (ui.btab === 'sport') { const st = sps(ui.sport); st.off = 0; loadSport(); } else { betAt = 0; betOff = 0; loadBets(); } checkBets(true); }
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
  fitAtm(); atmTilt();
  document.addEventListener('pointerdown', () => snd.gesture(), { passive: true });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { const m = $('modal'); if (m) m.hidden = true; if (ui.bet) closeSlip(); }
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
