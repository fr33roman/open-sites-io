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
  ['BTC', 'Биткоин', 'Bitcoin', 69250, { bn: 'BTCUSDT', cg: 'bitcoin' }],
  ['ETH', 'Эфириум', 'Ethereum', 1963, { bn: 'ETHUSDT', cg: 'ethereum' }],
  ['SOL', 'Солана', 'Solana', 81.4, { bn: 'SOLUSDT', cg: 'solana', vm: 1.2 }],
  ['TON', 'Тонкоин', 'Toncoin', 1.6, { bn: 'TONUSDT', cg: 'the-open-network', vm: 1.2 }],
  ['BNB', 'BNB', 'BNB', 641, { bn: 'BNBUSDT', cg: 'binancecoin' }],
  ['XRP', 'XRP', 'XRP', 1.03, { bn: 'XRPUSDT', cg: 'ripple', vm: 1.2 }],
  ['DOGE', 'Догикоин', 'Dogecoin', 0.066, { bn: 'DOGEUSDT', cg: 'dogecoin', vm: 1.5 }],
  ['ADA', 'Кардано', 'Cardano', 0.1735, { bn: 'ADAUSDT', cg: 'cardano', vm: 1.3 }],
  ['AVAX', 'Аваланч', 'Avalanche', 8.5, { bn: 'AVAXUSDT', cg: 'avalanche-2', vm: 1.3 }],
  ['LINK', 'Чейнлинк', 'Chainlink', 10.1, { bn: 'LINKUSDT', cg: 'chainlink', vm: 1.3 }],
  ['DOT', 'Полкадот', 'Polkadot', 0.84, { bn: 'DOTUSDT', cg: 'polkadot', vm: 1.3 }],
  ['LTC', 'Лайткоин', 'Litecoin', 49.8, { bn: 'LTCUSDT', cg: 'litecoin' }],
  ['TRX', 'Трон', 'TRON', 0.3137, { bn: 'TRXUSDT', cg: 'tron' }],
  ['SHIB', 'Шиба-ину', 'Shiba Inu', 0.00000434, { bn: 'SHIBUSDT', cg: 'shiba-inu', vm: 1.6 }],
  ['BCH', 'Биткоин-кэш', 'Bitcoin Cash', 227, { bn: 'BCHUSDT', cg: 'bitcoin-cash', vm: 1.2 }],
  ['UNI', 'Юнисвап', 'Uniswap', 5.92, { bn: 'UNIUSDT', cg: 'uniswap', vm: 1.4 }],
  ['ATOM', 'Космос', 'Cosmos', 1.42, { bn: 'ATOMUSDT', cg: 'cosmos', vm: 1.3 }],
  ['NEAR', 'Near', 'NEAR Protocol', 3.57, { bn: 'NEARUSDT', cg: 'near', vm: 1.4 }],
  ['APT', 'Аптос', 'Aptos', 0.555, { bn: 'APTUSDT', cg: 'aptos', vm: 1.4 }],
  ['ARB', 'Арбитрум', 'Arbitrum', 0.1488, { bn: 'ARBUSDT', cg: 'arbitrum', vm: 1.5 }],
  ['OP', 'Оптимизм', 'Optimism', 0.0957, { bn: 'OPUSDT', cg: 'optimism', vm: 1.5 }],
  ['FIL', 'Файлкоин', 'Filecoin', 0.741, { bn: 'FILUSDT', cg: 'filecoin', vm: 1.4 }],
  ['ETC', 'Эфириум классик', 'Ethereum Classic', 6.6, { bn: 'ETCUSDT', cg: 'ethereum-classic', vm: 1.2 }],
  ['XLM', 'Стеллар', 'Stellar', 0.15, { bn: 'XLMUSDT', cg: 'stellar', vm: 1.2 }],
  ['SUI', 'Суй', 'Sui', 0.82, { bn: 'SUIUSDT', cg: 'sui', vm: 1.5 }],
  ['PEPE', 'Пепе', 'Pepe', 0.00000456, { bn: 'PEPEUSDT', cg: 'pepe', vm: 1.8 }],
  ['AAVE', 'Ааве', 'Aave', 114, { bn: 'AAVEUSDT', cg: 'aave', vm: 1.4 }],
  ['INJ', 'Инджектив', 'Injective', 8.19, { bn: 'INJUSDT', cg: 'injective-protocol', vm: 1.5 }],
  ['HBAR', 'Хедера', 'Hedera', 0.064, { bn: 'HBARUSDT', cg: 'hedera-hashgraph', vm: 1.4 }],
  ['ICP', 'Интернет-компьютер', 'Internet Computer', 2.64, { bn: 'ICPUSDT', cg: 'internet-computer', vm: 1.4 }]
]);
def('stocks', [
  ['AAPL', 'Apple', 'Apple', 228], ['NVDA', 'Nvidia', 'Nvidia', 135, { vm: 1.6 }],
  ['TSLA', 'Tesla', 'Tesla', 248, { vm: 1.8 }], ['MSFT', 'Microsoft', 'Microsoft', 428],
  ['AMZN', 'Amazon', 'Amazon', 196], ['GOOGL', 'Alphabet', 'Alphabet', 172],
  ['META', 'Meta', 'Meta', 565, { vm: 1.2 }], ['NFLX', 'Netflix', 'Netflix', 705, { vm: 1.2 }],
  ['AMD', 'AMD', 'AMD', 158, { vm: 1.6 }], ['KO', 'Coca-Cola', 'Coca-Cola', 64, { vm: 0.6 }],
  ['JPM', 'JPMorgan', 'JPMorgan', 235, { vm: 0.8 }], ['V', 'Visa', 'Visa', 305, { vm: 0.7 }],
  ['WMT', 'Walmart', 'Walmart', 88, { vm: 0.6 }], ['DIS', 'Disney', 'Disney', 98],
  ['NKE', 'Nike', 'Nike', 76], ['INTC', 'Intel', 'Intel', 24, { vm: 1.4 }],
  ['ORCL', 'Oracle', 'Oracle', 175, { vm: 1.1 }], ['ADBE', 'Adobe', 'Adobe', 480],
  ['CRM', 'Salesforce', 'Salesforce', 300], ['BA', 'Boeing', 'Boeing', 160, { vm: 1.2 }],
  ['PFE', 'Pfizer', 'Pfizer', 27, { vm: 0.7 }], ['XOM', 'ExxonMobil', 'ExxonMobil', 115, { vm: 0.8 }],
  ['MCD', "McDonald's", "McDonald's", 295, { vm: 0.6 }], ['PYPL', 'PayPal', 'PayPal', 78, { vm: 1.3 }],
  ['UBER', 'Uber', 'Uber', 75, { vm: 1.3 }], ['SBUX', 'Starbucks', 'Starbucks', 95],
  ['COST', 'Costco', 'Costco', 900, { vm: 0.8 }]
]);
def('metals', [
  ['XAU', 'Золото, унция', 'Gold, oz', 3875, { bn: 'PAXGUSDT', cg: 'pax-gold', proxy: 'PAXG' }],
  ['XAG', 'Серебро, унция', 'Silver, oz', 31.2, { vm: 1.6 }],
  ['XPT', 'Платина, унция', 'Platinum, oz', 985, { vm: 1.3 }],
  ['XPD', 'Палладий, унция', 'Palladium, oz', 1040, { vm: 1.8 }],
  ['RH', 'Родий, унция', 'Rhodium, oz', 4800, { vm: 1.6 }],
  ['HG', 'Медь, фунт', 'Copper, lb', 4.35, { vm: 1.3 }],
  ['ALI', 'Алюминий, тонна', 'Aluminium, t', 2520],
  ['NI', 'Никель, тонна', 'Nickel, t', 16400, { vm: 1.5 }],
  ['ZN', 'Цинк, тонна', 'Zinc, t', 2950, { vm: 1.2 }],
  ['PB', 'Свинец, тонна', 'Lead, t', 2050],
  ['SN', 'Олово, тонна', 'Tin, t', 31500, { vm: 1.4 }],
  ['CO', 'Кобальт, тонна', 'Cobalt, t', 24500, { vm: 1.2 }],
  ['LI', 'Литий, тонна', 'Lithium, t', 9800, { vm: 1.6 }],
  ['FE', 'Железная руда, тонна', 'Iron ore, t', 104, { vm: 1.2 }],
  ['UR', 'Уран, фунт', 'Uranium, lb', 74, { vm: 1.3 }]
]);
// fx: function of a "units per 1 USD" rates table
const inv = c => r => 1 / r[c], dir = c => r => r[c];
const fxp = (id, ru, en, base, tk, f, vm) => [id, ru, en, base, { tk: tk, plain: 1, fx: f, vm: vm }];
def('forex', [
  fxp('EURUSD', 'Евро / доллар', 'Euro / US dollar', 1.108, 'EUR/USD', inv('EUR')),
  fxp('GBPUSD', 'Фунт / доллар', 'Pound / US dollar', 1.325, 'GBP/USD', inv('GBP')),
  fxp('AUDUSD', 'Австралийский доллар', 'Australian dollar', 0.682, 'AUD/USD', inv('AUD')),
  fxp('NZDUSD', 'Новозеландский доллар', 'New Zealand dollar', 0.556, 'NZD/USD', inv('NZD')),
  fxp('USDJPY', 'Доллар / иена', 'US dollar / yen', 159.7, 'USD/JPY', dir('JPY')),
  fxp('USDCHF', 'Доллар / франк', 'US dollar / franc', 0.833, 'USD/CHF', dir('CHF')),
  fxp('USDCAD', 'Доллар / канадский доллар', 'US dollar / Canadian dollar', 1.425, 'USD/CAD', dir('CAD')),
  fxp('USDCNY', 'Доллар / юань', 'US dollar / yuan', 6.67, 'USD/CNY', dir('CNY')),
  fxp('USDHKD', 'Доллар / гонконгский доллар', 'US dollar / HK dollar', 7.845, 'USD/HKD', dir('HKD'), 0.3),
  fxp('USDSGD', 'Доллар / сингапурский доллар', 'US dollar / Singapore dollar', 1.286, 'USD/SGD', dir('SGD')),
  fxp('USDINR', 'Доллар / рупия', 'US dollar / rupee', 94, 'USD/INR', dir('INR')),
  fxp('USDKRW', 'Доллар / вона', 'US dollar / won', 1334, 'USD/KRW', dir('KRW')),
  fxp('USDTRY', 'Доллар / лира', 'US dollar / lira', 50.3, 'USD/TRY', dir('TRY')),
  fxp('USDMXN', 'Доллар / песо', 'US dollar / peso', 18.7, 'USD/MXN', dir('MXN'), 1.3),
  fxp('USDBRL', 'Доллар / реал', 'US dollar / real', 5.62, 'USD/BRL', dir('BRL'), 1.3),
  fxp('USDZAR', 'Доллар / рэнд', 'US dollar / rand', 16.7, 'USD/ZAR', dir('ZAR'), 1.4),
  fxp('USDSEK', 'Доллар / шведская крона', 'US dollar / Swedish krona', 9.98, 'USD/SEK', dir('SEK')),
  fxp('USDNOK', 'Доллар / норвежская крона', 'US dollar / Norwegian krone', 9.53, 'USD/NOK', dir('NOK')),
  fxp('USDDKK', 'Доллар / датская крона', 'US dollar / Danish krone', 6.75, 'USD/DKK', dir('DKK')),
  fxp('USDPLN', 'Доллар / злотый', 'US dollar / zloty', 3.98, 'USD/PLN', dir('PLN')),
  fxp('USDCZK', 'Доллар / чешская крона', 'US dollar / Czech koruna', 22, 'USD/CZK', dir('CZK')),
  fxp('USDHUF', 'Доллар / форинт', 'US dollar / forint', 329, 'USD/HUF', dir('HUF')),
  fxp('USDILS', 'Доллар / шекель', 'US dollar / shekel', 3.2, 'USD/ILS', dir('ILS')),
  fxp('USDTHB', 'Доллар / бат', 'US dollar / baht', 33.8, 'USD/THB', dir('THB')),
  fxp('USDRUB', 'Доллар / рубль', 'US dollar / rouble', 96.5, 'USD/RUB', dir('RUB'), 2),
  fxp('USDKZT', 'Доллар / тенге', 'US dollar / tenge', 492, 'USD/KZT', dir('KZT')),
  fxp('USDGEL', 'Доллар / лари', 'US dollar / lari', 2.72, 'USD/GEL', dir('GEL')),
  fxp('EURGBP', 'Евро / фунт', 'Euro / pound', 0.838, 'EUR/GBP', r => r.GBP / r.EUR),
  fxp('EURJPY', 'Евро / иена', 'Euro / yen', 177, 'EUR/JPY', r => r.JPY / r.EUR),
  fxp('GBPJPY', 'Фунт / иена', 'Pound / yen', 211.7, 'GBP/JPY', r => r.JPY / r.GBP),
  fxp('EURCHF', 'Евро / франк', 'Euro / franc', 0.923, 'EUR/CHF', r => r.CHF / r.EUR)
]);
def('commod', [
  ['BRENT', 'Нефть Brent', 'Brent crude', 74.8, { vm: 1.2 }], ['WTI', 'Нефть WTI', 'WTI crude', 70.9, { vm: 1.2 }],
  ['NG', 'Природный газ', 'Natural gas', 2.85, { vm: 2 }], ['COFFEE', 'Кофе, фунт', 'Coffee, lb', 2.62, { vm: 1.4 }],
  ['WHEAT', 'Пшеница, бушель', 'Wheat, bu', 5.85], ['CORN', 'Кукуруза, бушель', 'Corn, bu', 4.28],
  ['SUGAR', 'Сахар, фунт', 'Sugar, lb', 0.215], ['COCOA', 'Какао, тонна', 'Cocoa, t', 7850, { vm: 1.8 }],
  ['COTTON', 'Хлопок, фунт', 'Cotton, lb', 0.72],
  ['HEAT', 'Мазут, галлон', 'Heating oil, gal', 2.35, { vm: 1.2 }], ['GASO', 'Бензин, галлон', 'Gasoline, gal', 2.1, { vm: 1.3 }],
  ['SOY', 'Соя, бушель', 'Soybeans, bu', 10.4], ['SOYOIL', 'Соевое масло, фунт', 'Soybean oil, lb', 0.42, { vm: 1.2 }],
  ['OATS', 'Овёс, бушель', 'Oats, bu', 3.6], ['RICE', 'Рис, центнер', 'Rice, cwt', 13.2],
  ['CATTLE', 'Скот живой, фунт', 'Live cattle, lb', 2.3, { vm: 0.7 }], ['HOGS', 'Свинина, фунт', 'Lean hogs, lb', 0.84, { vm: 1.1 }],
  ['OJ', 'Апельсиновый сок, фунт', 'Orange juice, lb', 2.2, { vm: 1.8 }], ['LUMBER', 'Лес, тыс. досковых футов', 'Lumber, mbf', 560, { vm: 1.3 }],
  ['PALM', 'Пальмовое масло, тонна', 'Palm oil, t', 1050, { vm: 1.2 }]
]);
def('index', [
  ['SPX', 'S&P 500', 'S&P 500', 5830, { plain: 1 }], ['NDX', 'Nasdaq 100', 'Nasdaq 100', 20350, { plain: 1, vm: 1.3 }],
  ['DJI', 'Dow Jones', 'Dow Jones', 42800, { plain: 1 }], ['DAX', 'DAX 40', 'DAX 40', 19450, { plain: 1 }],
  ['FTSE', 'FTSE 100', 'FTSE 100', 8280, { plain: 1 }], ['N225', 'Nikkei 225', 'Nikkei 225', 38900, { plain: 1, vm: 1.2 }],
  ['HSI', 'Hang Seng', 'Hang Seng', 20600, { plain: 1, vm: 1.4 }],
  ['CAC', 'CAC 40', 'CAC 40', 7600, { plain: 1 }], ['STOXX', 'Euro Stoxx 50', 'Euro Stoxx 50', 4950, { plain: 1 }],
  ['RUT', 'Russell 2000', 'Russell 2000', 2250, { plain: 1, vm: 1.2 }], ['KOSPI', 'KOSPI', 'KOSPI', 2600, { plain: 1, vm: 1.2 }],
  ['SSEC', 'Shanghai Composite', 'Shanghai Composite', 3300, { plain: 1, vm: 1.1 }],
  ['VOO', 'Фонд на S&P 500', 'S&P 500 fund', 535], ['QQQ', 'Фонд на Nasdaq 100', 'Nasdaq 100 fund', 495, { vm: 1.3 }],
  ['SPY', 'Фонд SPDR S&P 500', 'SPDR S&P 500 fund', 583], ['VTI', 'Фонд на весь рынок США', 'Total US market fund', 285],
  ['IWM', 'Фонд на малые компании', 'Small-cap fund', 225, { vm: 1.2 }], ['GLD', 'Фонд на золото', 'Gold fund', 245, { vm: 0.9 }],
  ['TLT', 'Фонд на длинные облигации', 'Long bond fund', 92, { vm: 0.9 }], ['EEM', 'Фонд на развивающиеся рынки', 'Emerging markets fund', 43, { vm: 1.1 }]
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
    gift: 0, xp: 0, nm: { b: 0, mx: 0 }, qd: {}, les: {}, qx: { cmp: 0, wal: 0, cats: {} }, inv: 0,
    agg: { n: 0, wins: 0, fees: 0, maxLoss: 0, imp: 0, opens: 0, streak: 0, lastActT: 0, lastLossT: 0, liq: 0, realized: 0 } };
}
function reset(S) { const k = { lang: S.lang, sound: S.sound }; Object.keys(S).forEach(x => delete S[x]); Object.assign(S, newState(), k); }
const pnl = (p, price) => p.side * p.qty * (price - p.entry);
const posValue = (p, price) => Math.max(0, p.margin + pnl(p, price));
const liqPrice = (entry, side, lev) => entry * (1 - side / lev);
// Open bets are money in play: stake x (current price / price at the bet), i.e. what a sale would pay now.
const betValue = b => round2(b.a / b.p * (b.cur >= 0 ? b.cur : b.p));
function betsValue(S) { let v = 0; (S.bets || []).forEach(b => { if (b && b.p > 0 && b.a > 0) v += betValue(b); }); return round2(v); }
function equity(S, M) { let v = S.cash + betsValue(S); S.positions.forEach(p => { v += posValue(p, M.px[p.sym]); }); return v; }
function pushCurve(S, M) {
  S.curve.push([M.t, round2(equity(S, M) - S.deposited)]); S.curveT = M.t;
  if (S.curve.length > 400) S.curve = S.curve.filter((c, i) => i >= 200 || i % 2 === 0);
}
// 14.11: deposit limits by level. Rewards are put on the account as "gift": they raise cash and deposited (the result is not touched)
// but do not eat the limit. Old players keep what they already put in: the level is never lower than what covers their own deposits.
// Ten levels; the level grows with experience points (xp): quests and lessons now, friends and debts later (server, stage 2).
// xp = quests and lessons (S.xp) + points for earned money (profitXp of the best net result reached). `net` — a mandatory net profit for the level.
const LEVELS = [
  { lim: 1e4, xp: 0, net: 0, ru: 'Ученик', en: 'Apprentice' }, { lim: 25e3, xp: 100, net: 0, ru: 'Счетовод', en: 'Bookkeeper' }, { lim: 5e4, xp: 250, net: 0, ru: 'Купец', en: 'Merchant' },
  { lim: 1e5, xp: 450, net: 0, ru: 'Стратег', en: 'Strategist' }, { lim: 25e4, xp: 800, net: 0, ru: 'Инвестор', en: 'Investor' }, { lim: 5e5, xp: 1050, net: 0, ru: 'Банкир', en: 'Banker' },
  { lim: 1e6, xp: 1300, net: 0, ru: 'Финансист', en: 'Financier' }, { lim: 3e6, xp: 1800, net: 1e5, ru: 'Магнат', en: 'Magnate' }, { lim: 7e6, xp: 2500, net: 5e5, ru: 'Мудрец', en: 'Sage' },
  { lim: 13e6, xp: 3500, net: 2e6, ru: 'Оракул', en: 'Oracle' }];
// Points for net profit: [net $, points], linear between; 2 300 points at $2M = about 65% of the 3 500 needed for level 10.
const PROFIT_XP = [[0, 0], [1e3, 60], [5e3, 180], [2e4, 380], [5e4, 600], [1e5, 850], [3e5, 1300], [5e5, 1550], [1e6, 1950], [2e6, 2300]];
function profitXp(n) {
  if (!(n > 0)) return 0; const T = PROFIT_XP;
  for (let i = 1; i < T.length; i++) if (n <= T[i][0]) return T[i - 1][1] + (T[i][1] - T[i - 1][1]) * (n - T[i - 1][0]) / (T[i][0] - T[i - 1][0]);
  return T[T.length - 1][1];
}
// Net result "earned by mind": closed trades (profit minus loss, fees included) + settled bets (payouts minus stakes). Counted from the update:
// S.nm.b is the starting point, S.nm.mx the best net reached — points go by the best, so a loss must be won back first.
function earned(S) {
  const a = S.betAgg, open = (S.bets || []).reduce((x, b) => x + (b && b.a > 0 ? b.a : 0), 0);
  return round2((S.agg ? S.agg.realized : 0) + (a ? a.paid - a.staked + open : 0));
}
function netNow(S) { return round2(earned(S) - (S.nm ? S.nm.b : 0)); }
function trackNet(S) { if (!S.nm) S.nm = { b: 0, mx: 0 }; const n = netNow(S); if (n > S.nm.mx) S.nm.mx = n; return S.nm.mx; }
const xpTotal = S => { trackNet(S); return Math.floor((num(S.xp) || 0) + profitXp(S.nm.mx)); };
const LIMITS = LEVELS.map(l => l.lim);
const own = S => Math.max(0, round2(S.deposited - (S.gift || 0)));
// Level = by xp, but never lower than the one whose limit covers what the player has already put in (old players lose nothing).
function levelOf(S) {
  let l = 0; const xp = xpTotal(S), o = own(S), mx = S.nm.mx;
  while (l < LEVELS.length - 1 && LEVELS[l + 1].xp <= xp && LEVELS[l + 1].net <= mx) l++;
  while (l < LEVELS.length - 1 && o > LEVELS[l].lim + 1e-9) l++;
  return l;
}
const room = S => Math.max(0, round2(LIMITS[levelOf(S)] - own(S)));
function deposit(S, M, amount) {
  amount = round2(num(amount));
  if (!(amount >= 1) || amount > room(S) + 1e-9) return false;
  S.cash = round2(S.cash + amount); S.deposited = round2(S.deposited + amount);
  S.bench += amount / M.px[BENCH];           // "bought the index and never touched it"
  pushCurve(S, M);
  return true;
}
function grant(S, M, amount) {
  amount = round2(num(amount)); if (!(amount > 0)) return;
  S.cash = round2(S.cash + amount); S.deposited = round2(S.deposited + amount); S.gift = round2((S.gift || 0) + amount);
  S.bench += amount / M.px[BENCH];
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
  S.qx = Object.assign(newState().qx, d.qx || {}); if (!S.qx.cats) S.qx.cats = {};
  S.nm = d.nm && typeof d.nm === 'object' ? { b: num(d.nm.b) || 0, mx: num(d.nm.mx) || 0 } : { b: earned(S), mx: 0 };   // old players: count from the update
  if (!S.qd || typeof S.qd !== 'object') S.qd = {}; if (!S.les || typeof S.les !== 'object') S.les = {};
  S.positions = S.positions.filter(p => p && INS[p.sym]);
  return { S: S, M: M };
}

Object.assign(E, { KEY, FEE, LEVS, CATS, CAT, INS, SYMS, BENCH, FINE_N, newMarket, status, step, synthHist, setCandles, applyQuote, chg24,
  newState, reset, pnl, posValue, betValue, betsValue, liqPrice, equity, deposit, grant, LEVELS, LIMITS, PROFIT_XP, profitXp, earned, netNow, trackNet, xpTotal, own, levelOf, room, maxAmount, open, close, sweep, sweepCandles, advance, stats, restore, num, round2, bridge, gauss });
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
    nav_money: 'Деньги', nav_market: 'Рынок', nav_wallet: 'Кошелёк', nav_truth: 'Правда', nav_news: 'Новости', snd_aria: 'Звук', skin_aria: 'Стиль', skin_quantum: 'Стиль: Квант', slogan: 'Твоя виртуальная экономическая вселенная', skin_gold: 'Стиль: Золото', skin_sapphire: 'Стиль: Сапфир', skin_amethyst: 'Стиль: Аметист', skin_aurora: 'Стиль: Аврора', skin_platinum: 'Стиль: Платина',
    money_lbl: 'Игровой счёт', money_h: 'Деньги',
    money_sub: 'Внесите любую сумму и торгуйте как в жизни. Деньги игровые: потерять здесь нечего, а результат считается честно.',
    reset: 'Обнулить всё', reset_q: 'Стереть деньги, позиции и всю историю?', reset_yes: 'Да, обнулить', cancel: 'Отмена', reset_done: 'Счёт обнулён',
    atm_balance: 'Баланс', atm_ph: 'Своя сумма', atm_go: 'Внести', atm_card: 'Карта', atm_cash: 'Купюры',
    atm_min: 'Минимум $1', atm_max: 'Сумма не принимается',
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
    w_total: 'Стоимость портфеля', w_cash: 'Свободные деньги', w_inpos: 'В позициях', w_inbets: 'В ставках', w_dep: 'Всего внесено',
    w_bets: 'Ставки', w_bets_go: 'К ставкам', w_bets_none: 'Ставок пока нет. Поставьте первую — она появится здесь.', w_bet_coef: 'коэф.', w_bet_win: 'выплата', w_bets_more: 'Ещё ставок: {n}. Все — в разделе «Ставки».', al_bets: 'В ставках',
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
    nav_money: 'Money', nav_market: 'Market', nav_wallet: 'Wallet', nav_truth: 'Truth', nav_news: 'News', snd_aria: 'Sound', skin_aria: 'Style', skin_quantum: 'Style: Quantum', slogan: 'Your virtual economic universe', skin_gold: 'Style: Gold', skin_sapphire: 'Style: Sapphire', skin_amethyst: 'Style: Amethyst', skin_aurora: 'Style: Aurora', skin_platinum: 'Style: Platinum',
    money_lbl: 'Play account', money_h: 'Money',
    money_sub: 'Deposit any amount and trade as you would in real life. The money is play money: nothing to lose, and the result is counted honestly.',
    reset: 'Reset everything', reset_q: 'Erase money, positions and all history?', reset_yes: 'Yes, reset', cancel: 'Cancel', reset_done: 'Account reset',
    atm_balance: 'Balance', atm_ph: 'Custom amount', atm_go: 'Deposit', atm_card: 'Card', atm_cash: 'Cash',
    atm_min: 'Minimum is $1', atm_max: 'This amount is not accepted',
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
    w_total: 'Portfolio value', w_cash: 'Available cash', w_inpos: 'In positions', w_inbets: 'In bets', w_dep: 'Total deposited',
    w_bets: 'Bets', w_bets_go: 'To bets', w_bets_none: 'No bets yet. Place the first one and it will show up here.', w_bet_coef: 'odds', w_bet_win: 'payout', w_bets_more: '{n} more bets. All of them are in the Bets section.', al_bets: 'In bets',
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
function pdec(sym, p) { return INS[sym].cat === 'forex' ? (p < 10 ? 5 : 3) : (p >= 100 ? 2 : p >= 1 ? 3 : p >= 0.01 ? 5 : 8); }
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
const ECB = ['AUD', 'BGN', 'BRL', 'CAD', 'CHF', 'CNY', 'CZK', 'DKK', 'EUR', 'GBP', 'HKD', 'HUF', 'IDR', 'ILS', 'INR', 'ISK', 'JPY', 'KRW', 'MXN', 'MYR', 'NOK', 'NZD', 'PHP', 'PLN', 'RON', 'SEK', 'SGD', 'THB', 'TRY', 'ZAR'];   // what the frankfurter (ECB) source covers
const FXC = ECB.concat(['RUB', 'KZT', 'GEL']);                    // ...plus three currencies only the daily-rate source has (no ECB history for them)
const FRANK = 'https://api.frankfurter.dev/v1/';                    // ECB reference rates, open, no key
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
    const d = await getJSON(FRANK + 'latest?from=USD');
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
        const d = await getJSON(FRANK + from + '..?from=USD&to=' + ECB.join(','));
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
const SKINS = ['gold', 'sapphire', 'amethyst', 'aurora', 'platinum', 'quantum'];
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
  g.font = '10px "IBM Plex Mono", monospace'; g.textBaseline = 'middle';
  series = series.filter(s => s.pts && s.pts.length > 1);
  if (!series.length) {
    g.fillStyle = COL.mut; g.textAlign = 'center'; g.font = '13px "IBM Plex Sans", sans-serif'; g.fillText(o.empty || '', w / 2, h / 2); return;
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
  g.font = '11px "IBM Plex Mono", monospace';
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
    layout: { background: { type: 'solid', color: 'rgba(0,0,0,0)' }, textColor: COL.mut, fontSize: 11, fontFamily: '"IBM Plex Mono", ui-monospace, Consolas, monospace', attributionLogo: true },
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
  inp.value = ''; snd.key(); vib(12); if (INS[ui.sym]) S.qx.cats[INS[ui.sym].cat] = 1;
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
  per_1h: '1 час', per_1d: '1 день', per_3d: '3 дня', per_7d: '7 дней', per_30d: 'Месяц', per_90d: '3 месяца',
  cmp_real: 'Реальная история', cmp_model: 'Модель: настоящей истории нет', cmp_daily: 'Реальные данные только по дням', cmp_nointra: 'Модель: внутри дня данных нет',
  cmp_search: 'Найти: BTC, Apple, евро', cmp_nofound: 'Ничего не найдено', cmp_pick: 'Что сравнить',
  cmp_best: 'Лучший', cmp_worst: 'Худший', cmp_1000: 'Что стало бы с $1 000', cmp_res: 'За период',
  cmp_note: 'Криптовалюты и золото — свечи Binance: за час минутные, за день 5-минутные, за 3 дня 15-минутные, за неделю часовые, за месяц 4-часовые, дальше дневные. Валюты — курсы ЕЦБ по дням (рубль, тенге и лари в ЕЦБ нет). Акции, индексы, сырьё — из нашего файла котировок, тоже по дням. Внутри дня у них источника нет. Пунктир и метка «Модель» — настоящей истории нет, линия смоделирована и ничего не доказывает.',
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
  per_1h: '1 hour', per_1d: '1 day', per_3d: '3 days', per_7d: '7 days', per_30d: 'Month', per_90d: '3 months',
  cmp_real: 'Real history', cmp_model: 'Model: no real history', cmp_daily: 'Real data, daily only', cmp_nointra: 'Model: no intraday data',
  cmp_search: 'Search: BTC, Apple, euro', cmp_nofound: 'Nothing found', cmp_pick: 'What to compare',
  cmp_best: 'Best', cmp_worst: 'Worst', cmp_1000: 'What $1,000 would have become', cmp_res: 'Over the period',
  cmp_note: 'Crypto and gold: Binance candles, 1-minute for an hour, 5-minute for a day, 15-minute for 3 days, hourly for a week, 4-hour for a month, daily beyond that. Currencies: ECB daily rates (the ruble, tenge and lari are not in the ECB set). Stocks, indices, commodities: our quotes file, also daily. They have no intraday source. A dashed line with the “Model” label means there is no real history; the line is simulated and proves nothing.',
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
  const lv = E.levelOf(S), cap = E.LIMITS[lv], rm = E.room(S);
  if (a > rm + 1e-9) {
    if (lv >= E.LIMITS.length - 1 && rm < 1) atmMsg(tf('full_top', { c: money(cap, 0) }), true);
    else if (a > cap) atmMsg(openHint(levelFor(a)), true);
    else if (rm < 1) atmMsg(tf('limit_used', { c: money(cap, 0) }) + ' ' + openHint(lv + 1), true);
    else atmMsg(tf('room_msg', { x: money(rm, 0) }), true);
    vib(20); return;
  }
  if (!E.deposit(S, M, a)) { atmMsg(t('atm_max'), true); vib(20); return; }
  save(); atmMsg('+' + money(a)); atmSet('');
  vib([10, 30, 10, 30, 10]);
  cashAnim(a);                          // the ATM balance rolls up when the last bill has gone in
  hdrBal(); ui.atmSig = ''; fillAtm(); fillNotes();
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
    const availW = (mob ? box.clientWidth - 4 : box.clientWidth - 50) / (w * 1.04);
    // телефон (14.11): сжимаем только ширину; по высоте сейф и цоколь сокращены в CSS, экран и клавиши — полного размера в первом экране
    const sc = mob ? Math.max(0.5, Math.min(1, availW)) : Math.max(0.4, Math.min(0.92, availH / h, availW));
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
    '<div class="stats w5">' + st('wEq', 'w_total') + st('wCash', 'w_cash') + st('wPos', 'w_inpos') + st('wBetV', 'w_inbets') + st('wDep', 'w_dep') + '</div>' +
    '<h2 class="h2">' + t('w_curve') + '</h2><div class="panel ch-panel"><div class="chart sm lw" id="cvEq"></div><p class="ch-empty" id="cvEqE" hidden>' + t('curve_empty') + '</p></div>' +
    '<div class="w-ana"><section class="w-al"><h2 class="h2">' + t('w_alloc') + '</h2><div class="panel alloc" id="wAlloc"></div></section>' +
    '<section class="w-sum"><h2 class="h2">' + t('w_sum') + '</h2><div class="acards" id="aCards"></div></section></div>' +
    '<h2 class="h2">' + t('w_open') + '</h2><div class="poslist" id="wPosList"></div>' +
    '<section class="wb" id="wBets"></section>' +
    '<h2 class="h2">' + t('w_hist') + '</h2><div id="wHist"></div>';
  chartKill('eq'); if (!LWC()) bindHover(cvIn($('cvEq')), drawEq);
  ui.alSig = ''; ui.aSig = ''; ui.wbSig = '';
  renderDyn();
}
// Portfolio split by asset class: open positions at their value now, plus free cash.
const CATC = { crypto: 'var(--gold)', stocks: 'var(--l4)', metals: 'var(--gold-l)', forex: 'rgb(var(--acc2))', commod: 'color-mix(in srgb,var(--gold) 45%,var(--l4))', index: 'color-mix(in srgb,rgb(var(--acc2)) 50%,var(--txt))' };
function fillAlloc() {
  const box = $('wAlloc'); if (!box) return;
  const by = {}, bv = E.betsValue(S); let tot = Math.max(0, S.cash) + bv;
  S.positions.forEach(p => { const v = E.posValue(p, M.px[p.sym]), c = INS[p.sym].cat; by[c] = (by[c] || 0) + v; tot += v; });
  const seg = E.CATS.filter(c => by[c.id] > 0).map(c => ({ n: L(c), v: by[c.id], col: CATC[c.id] }));
  if (bv > 0) seg.push({ n: t('al_bets'), v: bv, col: 'color-mix(in srgb,rgb(var(--acc2)) 70%,var(--gold))' });
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
  if (ui.view === 'wallet') { posList($('wPosList'), S.positions, 'pos_none_all'); const h = $('wHist'); if (h) h.innerHTML = histHTML(); fillCards(); fillAlloc(); fillWBets(); }
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
// 13.11: open bets in the wallet as their own block: what is in play, what it is worth now, what it pays if it wins.
function fillWBets() {
  const box = $('wBets'); if (!box) return;
  bst();
  const A = S.betAgg, open = E.betsValue(S), net = E.round2(A.paid + open - A.staked);
  const sig = S.lang + '|' + S.bets.map(b => b.id + ':' + (b.cur >= 0 ? b.cur : b.p)).join(',') + '|' + S.betHist.length + '|' + A.paid + '|' + A.staked;
  if (sig === ui.wbSig) return; ui.wbSig = sig;
  box.textContent = '';
  const cls = v => (v > 0 ? ' up' : v < 0 ? ' down' : '');
  const hd = mkEl('div', 'wb-h'); hd.appendChild(mkEl('h2', 'h2', t('w_bets')));
  const go = mkEl('a', 'btn-ghost wb-go', t('w_bets_go')); go.href = '#bets'; hd.appendChild(go); box.appendChild(hd);
  if (!S.bets.length && !S.betHist.length) { box.appendChild(mkEl('p', 'empty', t('w_bets_none'))); return; }
  const sum = mkEl('div', 'stats wb-sum');
  [[t('bs_open'), money(open), ''], [t('bs_staked'), money(A.staked), ''], [t('bs_paid'), money(A.paid), ''], [t('bs_net'), signed(net), cls(net)]].forEach(a => {
    const d = mkEl('div', 'stat'); d.appendChild(mkEl('span', 'lbl', a[0])); d.appendChild(mkEl('span', 'num' + a[2], a[1])); sum.appendChild(d);
  });
  box.appendChild(sum);
  if (S.bets.length) {
    const list = mkEl('div', 'wb-list');
    S.bets.slice(0, 12).forEach(b => {
      const val = E.betValue(b), win = E.round2(b.a / b.p), row = mkEl('div', 'wb-row'), l = mkEl('div', 'wb-l');
      l.appendChild(mkEl('p', 'bm-q', b.q));
      l.appendChild(mkEl('p', 'bm-s num', oname(b.o) + ' · ×' + coef(b.p) + ' · ' + money(b.a)));
      const r = mkEl('div', 'wb-r'); r.appendChild(mkEl('b', 'num' + (val > b.a ? ' up' : val < b.a ? ' down' : ''), money(val)));
      r.appendChild(mkEl('small', 'num', t('w_bet_win') + ' ' + money(win)));
      row.appendChild(l); row.appendChild(r); list.appendChild(row);
    });
    box.appendChild(list);
    if (S.bets.length > 12) box.appendChild(mkEl('p', 'empty', tf('w_bets_more', { n: S.bets.length - 12 })));
  }
  if (S.betHist.length) {
    box.appendChild(mkEl('p', 'lbl wb-hl', t('bet_hist')));
    const hl = mkEl('div', 'wb-list done');
    S.betHist.slice(0, 5).forEach(x => {
      const row = mkEl('div', 'wb-row'), l = mkEl('div', 'wb-l'), d = E.round2(x.pay - x.a);
      l.appendChild(mkEl('p', 'bm-q', x.q));
      l.appendChild(mkEl('p', 'bm-s num', oname(x.o) + ' · ' + coef(x.p) + ' · ' + money(x.a) + ' · ' + t('how_' + x.how)));
      const r = mkEl('div', 'wb-r'); r.appendChild(mkEl('b', 'num' + cls(d), signed(d))); row.appendChild(l); row.appendChild(r); hl.appendChild(row);
    });
    box.appendChild(hl);
  }
}
function refreshWallet() {
  const st = E.stats(S, M);
  rollTo($('wRes'), st.result, tightS, st.result);
  setTxt($('wPct'), pct(S.deposited > 0 ? st.result / S.deposited : null), st.result);
  rollTo($('wEq'), st.equity, money); rollTo($('wCash'), S.cash, money);
  const bv = E.betsValue(S);
  rollTo($('wPos'), E.round2(st.equity - S.cash - bv), money); rollTo($('wBetV'), bv, money); rollTo($('wDep'), S.deposited, money);
  drawEq();
  if (tickN % 5 === 0 || !ui.alSig) fillAlloc();
  fillCards(); fillWBets();
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
/* 13.11: periods. Inside a day the candles are Binance's (1m / 5m / 15m / 1h / 4h by period). Where there is no intraday source
   (everything except crypto and gold) the line is either the real daily history, or an honest model with a label. */
const PERS = {
  '1h': { ms: 36e5, iv: '1m', n: 61 }, '1d': { ms: 864e5, iv: '5m', n: 289 }, '3d': { ms: 3 * 864e5, iv: '15m', n: 289 },
  '7d': { ms: 7 * 864e5, iv: '1h', n: 169 }, '30d': { ms: 30 * 864e5, iv: '4h', n: 181 }, '90d': { ms: 90 * 864e5, iv: '1d', n: 92 }
};
const PER_KEYS = Object.keys(PERS);
const perKey = v => (PERS[v] ? v : v === 7 ? '7d' : v === 90 ? '90d' : '30d');
const kcache = {};                                // sym|period -> { at, out }
async function klinesTry(sym, iv, n) {
  for (let k = 0; k < BN.length; k++) {
    try { const h = (bnHost + k) % BN.length, a = await getJSON(BN[h] + '/api/v3/klines?symbol=' + INS[sym].bn + '&interval=' + iv + '&limit=' + n); bnHost = h; return a; } catch (e) { /* next host */ }
  }
  return null;
}
function modelIntra(sym, P) {
  const I = INS[sym], p = M.px[sym], now = Date.now(), st = P.ms / (P.n - 1), sig = I.vol * Math.sqrt(st / 1000) * 0.6;
  const b = E.bridge(P.n, p * Math.exp(I.vol * Math.sqrt(P.ms / 1000) * 0.3 * E.gauss()), p, sig);
  return { at: now, real: false, kind: 'nointra', pts: b.map((v, i) => [now - (P.n - 1 - i) * st, v]) };
}
// One series for one instrument and period: { real, kind: 'real' | 'daily' | 'model' | 'nointra', intra, pts: [[ms, value]] }.
async function histFor(sym, pk) {
  const P = PERS[pk], I = INS[sym], now = Date.now(), key = sym + '|' + pk, c = kcache[key];
  if (I.bn && P.iv !== '1d') {
    if (c && now - c.at < (P.ms <= 864e5 ? 3e4 : 3e5)) return c.out;
    const a = await klinesTry(sym, P.iv, P.n);
    const pts = Array.isArray(a) ? a.filter(Array.isArray).map(k => [E.num(k[0]), E.num(k[4])]).filter(k => k[0] > 0 && k[1] > 0) : [];
    const out = pts.length > 5 ? { at: now, real: true, kind: 'real', intra: true, pts: pts } : (c ? c.out : modelIntra(sym, P));
    kcache[key] = { at: now, out: out }; return out;
  }
  if (!I.bn && P.ms < 3 * 864e5) {                // no intraday source for stocks, currencies, commodities, indices
    if (c && now - c.at < 3e5) return c.out;
    const out = modelIntra(sym, P); kcache[key] = { at: now, out: out }; return out;
  }
  const d = await histDaily(sym);
  return Object.assign({}, d, { kind: d.real ? (I.bn || P.ms >= 30 * 864e5 ? 'real' : 'daily') : 'model' });
}
function cmpSeries() {
  const P = PERS[perKey(S.cmp.per)], cut = Date.now() - P.ms;
  return S.cmp.syms.map((s, i) => {
    const h = cmpData[s]; if (!h) return null;
    let k = 0; for (let j = 0; j < h.pts.length; j++) if (h.pts[j][0] <= cut) k = j;
    const a = h.pts.slice(k); if (a.length < 2) return null;
    const b = a[0][1];
    return { sym: s, real: h.real, kind: h.kind || (h.real ? 'real' : 'model'), intra: !!h.intra, color: LINES[i % 4], dash: !h.real, name: tk(s), pts: a.map(p => [p[0], p[1] / b * 100]), res: a[a.length - 1][1] / b - 1 };
  }).filter(Boolean);
}
const dm = x => { const d = new Date(x); return p2(d.getDate()) + '.' + p2(d.getMonth() + 1); };
const hm = x => { const d = new Date(x); return p2(d.getHours()) + ':' + p2(d.getMinutes()); };
// Lines start at 0% (the first point of the period); a tap on a legend row hides or shows its line.
function drawCmp() {
  const el = $('cvCmp'); if (!el) return;
  const n = S.cmp.syms.length, ser = n >= 2 ? cmpSeries() : [], emp = $('cvCmpE'), intra = ser.some(s => s.intra);
  if (emp) { emp.hidden = ser.length >= 2; emp.textContent = t(n >= 2 && cmpBusy ? 'cmp_load' : 'cmp_need'); }
  if (!LWC()) { drawChart(cvIn(el), ser, { base: 100, smooth: true, fy: v => v.toFixed(1) + '%', fx: intra ? hm : dm, empty: '' }); return; }
  let c = CH.cmp;
  if (c && (c.el !== el || (ser.length && c.intra !== intra))) { chartKill('cmp'); c = null; }
  if (!c) { c = CH.cmp = { el: el, chart: lwChart(el, { time: intra }), ls: {}, sig: '', intra: intra }; c.chart.subscribeCrosshairMove(cmpLegend); }
  const sig = ser.map(s => s.sym + ':' + s.pts.length + ':' + s.pts[0][0] + ':' + s.pts[s.pts.length - 1][1].toFixed(4) + ':' + s.kind).join('|') + '|' + perKey(S.cmp.per);
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
const KIND_TXT = { real: 'cmp_real', daily: 'cmp_daily', model: 'cmp_model', nointra: 'cmp_nointra' };
function fillCmp() {
  const ser = S.cmp.syms.length >= 2 ? cmpSeries() : [], lg = $('cmpLegend'), tb = $('cmpTable');
  if (lg) lg.innerHTML = ser.map(s => '<button type="button" class="lg-row' + (ui.cmpOff[s.sym] ? ' off' : '') + '" data-cl="' + s.sym + '" aria-pressed="' + !ui.cmpOff[s.sym] + '"><i class="dot" style="background:' + s.color + '"></i><span class="lg-name"><b class="num">' + esc(s.name) + '</b><small>' + esc(L(INS[s.sym])) + '</small>' +
    '<span class="st" data-st="' + (s.real ? 'delayed' : 'model') + '">' + t(KIND_TXT[s.kind] || 'cmp_model') + '</span></span>' +
    '<b class="num ' + (s.res > 0 ? 'up' : s.res < 0 ? 'down' : '') + '" data-lgv="' + s.sym + '" data-res="' + s.res + '">' + pct(s.res) + '</b></button>').join('') + (ser.length ? '<p class="lg-tap">' + t('cmp_tap') + '</p>' : '');
  if (!tb) return;
  if (ser.length < 2) { tb.innerHTML = ''; return; }
  const so = ser.slice().sort((a, b) => b.res - a.res), best = so[0], worst = so[so.length - 1];
  const r = (k, s) => '<div class="hrow"><div><b>' + t(k) + '</b><small>' + esc(s.name) + ' · ' + esc(L(INS[s.sym])) + (s.real ? '' : ' · ' + t('st_model')) + '</small></div><span class="num ' + (s.res > 0 ? 'up' : s.res < 0 ? 'down' : '') + '">' + pct(s.res) + '</span></div>';
  tb.innerHTML = '<div class="hist">' + r('cmp_best', best) + r('cmp_worst', worst) + '</div><h2 class="h2">' + t('cmp_1000') + '</h2><div class="hist">' +
    so.map(s => '<div class="hrow"><div><b>' + esc(s.name) + '</b><small>$1' + NB + '000 →' + (s.real ? '' : ' · ' + t('st_model')) + '</small></div><span class="num ' + (s.res > 0 ? 'up' : s.res < 0 ? 'down' : '') + '">' + money(1000 * (1 + s.res)) + '</span></div>').join('') + '</div>';
}
async function cmpLoad() {
  const tok = ++cmpTok, syms = S.cmp.syms.slice(), pk = perKey(S.cmp.per);
  cmpBusy = true; drawCmp();
  const out = {};
  await Promise.all(syms.map(async s => { try { out[s] = await histFor(s, pk); } catch (e) { out[s] = PERS[pk].ms < 3 * 864e5 ? modelIntra(s, PERS[pk]) : modelDaily(s); } }));
  if (tok !== cmpTok) return;
  cmpData = out; cmpBusy = false;
  if (ui.view === 'compare') { drawCmp(); fillCmp(); }
}
// The picker beside the chart: chosen ones on top (one tap removes), search, section tabs, a scrolling list.
function cmpSelHTML() {
  const c = S.cmp;
  return c.syms.length ? c.syms.map((s, i) => '<button class="chip on" type="button" data-csym="' + s + '" aria-pressed="true" title="' + esc(L(INS[s])) + '"><i class="dot" style="background:' + LINES[i % 4] + '"></i>' + esc(tk(s)) + '<span class="x" aria-hidden="true">×</span></button>').join('') :
    '<span class="hint">' + t('cmp_none') + '</span>';
}
function cmpListHTML() {
  const q = (ui.cq || '').trim().toLowerCase(), cat = E.CAT[ui.ccat] ? ui.ccat : 'crypto', c = S.cmp;
  const list = SYMS.filter(s => {
    const I = INS[s]; if (!q) return I.cat === cat;
    return s.toLowerCase().indexOf(q) >= 0 || I.tk.toLowerCase().indexOf(q) >= 0 || I.ru.toLowerCase().indexOf(q) >= 0 || I.en.toLowerCase().indexOf(q) >= 0;
  });
  if (!list.length) return '<p class="empty">' + t('cmp_nofound') + '</p>';
  return list.map(s => {
    const i = c.syms.indexOf(s), on = i >= 0, I = INS[s];
    return '<button class="cp-item' + (on ? ' on' : '') + '" type="button" data-csym="' + s + '" aria-pressed="' + on + '"><i class="dot" style="' + (on ? 'background:' + LINES[i % 4] : '') + '"></i>' +
      '<span class="cp-t"><b class="num">' + esc(tk(s)) + '</b><small>' + esc(L(I)) + (q ? ' · ' + esc(L(E.CAT[I.cat])) : '') + '</small></span>' +
      '<span class="cp-m" aria-hidden="true">' + (on ? '✓' : '+') + '</span></button>';
  }).join('');
}
function cmpTabsHTML() {
  const q = (ui.cq || '').trim(), cat = E.CAT[ui.ccat] ? ui.ccat : 'crypto';
  return E.CATS.map(k => '<button class="chip' + (!q && k.id === cat ? ' on' : '') + '" type="button" data-ccat="' + k.id + '">' + esc(L(k)) + ' <small class="num">' + SYMS.filter(s => INS[s].cat === k.id).length + '</small></button>').join('');
}
function fillCmpPick(keepScroll) {
  const sel = $('cmpSel'), ls = $('cmpList'), tabs = $('cmpTabs'); if (!ls) return;
  if (sel) sel.innerHTML = cmpSelHTML();
  if (tabs) tabs.innerHTML = cmpTabsHTML();
  const y = ls.scrollTop; ls.innerHTML = cmpListHTML(); ls.scrollTop = keepScroll ? y : 0;
  setTxt($('cmpCount'), S.cmp.syms.length + ' / 4');
}
function renderCompare() {
  const c = S.cmp, cat = E.CAT[ui.ccat] ? ui.ccat : (ui.ccat = 'crypto');
  $('compareBox').innerHTML = '<div class="vhead"><h1>' + t('cmp_h') + '</h1></div>' +
    '<div class="chips per" role="group">' + PER_KEYS.map(p => '<button class="chip' + (p === perKey(c.per) ? ' on' : '') + '" type="button" data-per="' + p + '">' + t('per_' + p) + '</button>').join('') + '</div>' +
    '<div class="panel cmp-block">' +
      '<div class="cmp-main"><div class="ch-panel"><div class="chart lw" id="cvCmp"></div><p class="ch-empty" id="cvCmpE" hidden></p></div><div class="legend" id="cmpLegend"></div></div>' +
      '<div class="cmp-side"><div class="cs-top"><span class="lbl">' + t('cmp_sel') + '</span><span class="cs-n num" id="cmpCount"></span></div>' +
        '<div class="chips cmp-sel" id="cmpSel"></div>' +
        '<label class="cs-q"><span class="sr">' + t('cmp_search') + '</span><input id="cmpQ" type="search" inputmode="search" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="24" placeholder="' + esc(t('cmp_search')) + '" value="' + esc(ui.cq || '') + '"></label>' +
        '<div class="cs-tabs" id="cmpTabs"></div>' +
        '<div class="cs-list" id="cmpList"></div></div>' +
    '</div>' +
    '<div id="cmpTable" class="cmp-table"></div>' +
    '<p class="chart-note">' + t('cmp_note') + '</p>';
  chartKill('cmp'); if (!LWC()) bindHover(cvIn($('cvCmp')), drawCmp);
  fillCmpPick(false); drawCmp(); fillCmp();
}
function cmpToggle(s) {
  const a = S.cmp.syms, i = a.indexOf(s);
  if (i >= 0) a.splice(i, 1); else if (a.length >= 4) { toast(t('cmp_max')); return; } else a.push(s);
  save(); fillCmpPick(true); cmpLoad();
}
function cmpSetPer(pk) {
  if (!PERS[pk]) return;
  S.cmp.per = pk; save(); cmpData = {};
  document.querySelectorAll('.per [data-per]').forEach(el => el.classList.toggle('on', el.getAttribute('data-per') === pk));
  chartKill('cmp'); fillCmp(); cmpLoad();
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
const MORE = ['news', 'truth', 'compare', 'top', 'quests', 'learn'];
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
    if (ui.view === 'wallet') fillWBets();
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
   9c. LEVELS, QUESTS, LEARNING (14.11). Everything is local (localStorage); friends and debts come with the server (stage 2).
   ===================================================================== */
const LESSON_XP = 40;
const LESSONS = [
  { r: 500, ru: { t: 'Цена и график', p: ['Цена — сколько стоит одна штука актива сегодня. Биткоин стоит $60 000: столько нужно заплатить за один целый биткоин.', 'График — история цены. Слева старое, справа новое, выше — дороже. Одна свеча показывает за выбранный отрезок времени четыре цены: с какой цена началась, чем закончилась, самую высокую и самую низкую.', 'Зелёная свеча — за отрезок цена выросла. Красная — упала.'], q: 'Свеча красная. Что случилось с ценой за этот отрезок?', o: ['Упала', 'Выросла', 'Не изменилась'], ok: 0, e: 'Красная свеча значит, что цена закончила отрезок ниже, чем начала.' },
    en: { t: 'Price and chart', p: ['Price is what one unit of an asset costs today. Bitcoin costs $60,000: that is what you pay for one whole bitcoin.', 'A chart is the history of the price. Older on the left, newer on the right, higher means more expensive. One candle shows four prices for the chosen period: where the price started, where it ended, the highest and the lowest.', 'A green candle means the price rose over the period. A red one means it fell.'], q: 'The candle is red. What happened to the price over this period?', o: ['It fell', 'It rose', 'It did not change'], ok: 0, e: 'A red candle means the price ended the period lower than it started.' } },
  { r: 500, ru: { t: 'Купить и продать', p: ['Купить — открыть сделку на рост: вы ждёте, что цена поднимется. Вы купили биткоин на $100 по цене $50 000. Цена стала $55 000, это на 10 % больше. Ваши $100 стали $110.', 'Продать в тренажёре — сделка на падение: вы зарабатываете, когда цена снижается. Закрыть сделку — забрать результат, плюс или минус.'], q: 'Вы купили на $200. Цена выросла на 5 %. Сколько стоит ваша позиция без комиссии?', o: ['$210', '$205', '$190'], ok: 0, e: '5 % от $200 — это $10. Было $200, стало $210.' },
    en: { t: 'Buy and sell', p: ['To buy is to open a trade on a rise: you expect the price to go up. You bought $100 of bitcoin at $50,000. The price became $55,000, which is 10% more. Your $100 became $110.', 'To sell in the simulator is a trade on a fall: you earn when the price goes down. To close a trade is to take the result, plus or minus.'], q: 'You bought $200 worth. The price rose 5%. What is your position worth before fees?', o: ['$210', '$205', '$190'], ok: 0, e: '5% of $200 is $10. It was $200, now $210.' } },
  { r: 750, ru: { t: 'Прибыль и убыток', p: ['Прибыль — вы закрыли сделку и забрали больше, чем вложили. Убыток — забрали меньше. Вложили $100, закрыли с $110: прибыль $10. Закрыли с $85: убыток $15.', 'Комиссия — небольшая плата за открытие и закрытие сделки. Пока сделка открыта, результат не зафиксирован: цена ещё может вернуться или уйти дальше.'], q: 'Вы вложили $300 и закрыли сделку с $270. Что получилось?', o: ['Убыток $30', 'Прибыль $30', 'Убыток $270'], ok: 0, e: '$300 минус $270 — вы потеряли $30.' },
    en: { t: 'Profit and loss', p: ['Profit is when you closed a trade and took out more than you put in. Loss is when you took out less. You put in $100 and closed with $110: profit $10. Closed with $85: loss $15.', 'A fee is a small charge for opening and closing a trade. While the trade is open the result is not fixed: the price can still come back or go further.'], q: 'You put in $300 and closed the trade with $270. What happened?', o: ['A loss of $30', 'A profit of $30', 'A loss of $270'], ok: 0, e: '$300 minus $270: you lost $30.' } },
  { r: 750, ru: { t: 'Плечо', p: ['Плечо — множитель сделки. При плече ×5 ваши $100 работают как $500. Цена выросла на 10 % — прибыль считается с $500, это $50, половина ваших $100.', 'Убыток растёт так же. Цена упала на 10 % — минус $50. Плечо делает и выигрыш, и проигрыш больше.'], q: 'Плечо ×10, вы вложили $100. Цена упала на 5 %. Сколько вы потеряли?', o: ['$50', '$5', '$100'], ok: 0, e: 'При ×10 ваши $100 работают как $1 000. 5 % от $1 000 — это $50.' },
    en: { t: 'Leverage', p: ['Leverage multiplies a trade. With ×5 your $100 works like $500. The price rose 10%: profit is counted on $500, that is $50, half of your $100.', 'Loss grows the same way. The price fell 10%: minus $50. Leverage makes both the win and the loss bigger.'], q: 'Leverage ×10, you put in $100. The price fell 5%. How much did you lose?', o: ['$50', '$5', '$100'], ok: 0, e: 'At ×10 your $100 works like $1,000. 5% of $1,000 is $50.' } },
  { r: 1000, ru: { t: 'Ликвидация', p: ['Ликвидация — принудительное закрытие, когда убыток съел весь ваш залог. Плечо ×10: цена идёт против вас на 10 %, убыток $100 из вложенных $100. Сделка закрывается сама, деньги сгорают.', 'Чем больше плечо, тем ближе цена ликвидации к цене входа. На ×2 цена должна упасть на 50 %, на ×10 хватит 10 %. На графике рынка линия ликвидации красная.'], q: 'При каком плече цена ликвидации ближе всего к цене входа?', o: ['×10', '×2', '×1'], ok: 0, e: 'При ×10 хватит движения на 10 %, при ×2 нужно 50 %, при ×1 сделку почти не ликвидирует.' },
    en: { t: 'Liquidation', p: ['Liquidation is a forced close when the loss has eaten your whole margin. Leverage ×10: the price goes against you by 10%, the loss is $100 of your $100. The trade closes by itself and the money is gone.', 'The higher the leverage, the closer the liquidation price is to the entry price. At ×2 the price must fall 50%, at ×10 just 10%. On the market chart the liquidation line is red.'], q: 'At which leverage is the liquidation price closest to the entry price?', o: ['×10', '×2', '×1'], ok: 0, e: 'At ×10 a 10% move is enough, at ×2 it takes 50%, at ×1 a trade is almost never liquidated.' } },
  { r: 1000, ru: { t: 'Стоп: выход по плану', p: ['Стоп — убыток, при котором вы заранее решили выйти. Вложили $100 и сказали себе: теряю не больше $20. Цена идёт против вас, на минусе $20 вы закрываете сделку и не ждёте ликвидации.', 'Решение принимается до сделки, пока вы спокойны. Когда деньги уже в минусе, хочется ждать, и убыток растёт.', 'Сейчас стоп делается руками: следите за позицией и закройте её на своём пороге.'], q: 'Вы решили терять не больше $30 со сделки в $150. Сейчас минус $30. Что делаете?', o: ['Закрываю сделку', 'Жду, вдруг вернётся', 'Докупаю ещё'], ok: 0, e: 'План на то и план: порог достигнут — выходите.' },
    en: { t: 'Stop: leave by plan', p: ['A stop is the loss at which you decided in advance to leave. You put in $100 and told yourself: I lose $20 at most. The price goes against you, at minus $20 you close the trade and do not wait for liquidation.', 'You decide before the trade, while you are calm. When the money is already down you want to wait, and the loss grows.', 'For now a stop is done by hand: watch the position and close it at your threshold.'], q: 'You decided to lose $30 at most on a $150 trade. It is now minus $30. What do you do?', o: ['Close the trade', 'Wait, it may come back', 'Add more'], ok: 0, e: 'A plan is a plan: the threshold is reached, so you leave.' } },
  { r: 1000, ru: { t: 'Разные активы', p: ['В тренажёре шесть разделов: криптовалюты, акции, валюты, металлы, сырьё, индексы. Они ведут себя по-разному. За день биткоин может уйти на 5 %, золото обычно на 1 %.', 'Раздел «Сравнить» накладывает графики, все линии начинаются со 100 %, и видно, кто вырос сильнее. Если разделить деньги между активами, неудача в одном не съест всё: $1 000 поровну на два актива, один упал на 50 %, второй не изменился — осталось $750.'], q: 'Вы разделили $1 000 поровну на два актива. Один упал на 50 %, второй не изменился. Сколько всего?', o: ['$750', '$500', '$1 000'], ok: 0, e: 'Упавшая половина стала $250, вторая осталась $500: вместе $750.' },
    en: { t: 'Different assets', p: ['The simulator has six sections: crypto, stocks, currencies, metals, commodities, indices. They behave differently. In a day bitcoin can move 5%, gold usually 1%.', 'The “Compare” section lays the charts on top of each other, every line starts at 100%, and you see which grew more. If you split money between assets, a failure in one does not eat everything: $1,000 split in two, one fell 50%, the other did not change: $750 left.'], q: 'You split $1,000 equally between two assets. One fell 50%, the other did not change. How much in total?', o: ['$750', '$500', '$1,000'], ok: 0, e: 'The fallen half became $250, the other stayed $500: $750 together.' } },
  { r: 1500, ru: { t: 'Ставки и коэффициент', p: ['Коэффициент показывает, сколько вы получите за каждый доллар ставки, если исход сбудется. Коэффициент 2,5 и ставка $10: при победе выплата $25, прибыль $15. Не сбылось — $10 пропали.', 'Коэффициент связан с шансом: единица, делённая на коэффициент. Коэффициент 2,5 — это шанс 40 % по оценке рынка.'], q: 'Ставка $20 при коэффициенте 3. Исход сбылся. Какая выплата?', o: ['$60', '$23', '$40'], ok: 0, e: '$20 умножить на 3 — выплата $60, из них $40 прибыли.' },
    en: { t: 'Bets and odds', p: ['Odds show how much you get for each dollar of the stake if the outcome happens. Odds 2.5 and a $10 stake: if you win the payout is $25, profit $15. If not, the $10 is gone.', 'Odds are tied to chance: one divided by the odds. Odds 2.5 mean a 40% chance by the market’s estimate.'], q: 'A $20 stake at odds 3. The outcome happened. What is the payout?', o: ['$60', '$23', '$40'], ok: 0, e: '$20 times 3 is a $60 payout, $40 of it profit.' } },
  { r: 2000, ru: { t: 'Главное правило', p: ['Вкладывайте только ту часть денег, потерю которой переживёте. Если в одной сделке весь счёт, одна ошибка заканчивает игру. Если в сделке десятая часть, нужно десять ошибок подряд.', 'Свободные деньги держите про запас: с ними можно спокойно закрыть убыточную сделку и открыть новую, когда появится возможность.', 'Когда свободных денег меньше 10 % от внесённого, тренажёр подсказывает остановиться и подумать.', 'Очки уровня больше всего дают за чистый заработок: прибыль закрытых сделок и выигрыши по ставкам минус убытки. Заработали $500, потеряли $300 — чистый итог $200. Проигрыш съедает заработанное, а за ставки наугад очков нет. Выгоднее разобраться, чем гадать.'], q: 'На счёте $1 000. Какая сделка разумнее?', o: ['$100 с плечом ×2', '$1 000 с плечом ×10', '$900 с плечом ×5'], ok: 0, e: 'Малая доля счёта и небольшое плечо: ошибка стоит дорого, но игру не заканчивает.' },
    en: { t: 'The main rule', p: ['Put in only the part of your money whose loss you can live with. If one trade holds the whole account, one mistake ends the game. If a trade holds a tenth, it takes ten mistakes in a row.', 'Keep free money in reserve: with it you can calmly close a losing trade and open a new one when a chance appears.', 'When free money drops below 10% of what you put in, the simulator suggests you stop and think.', 'Level points come mostly for net earnings: profit of closed trades and won bets minus losses. You earned $500 and lost $300: the net result is $200. A loss eats what you earned, and guessing bets give no points. Understanding pays better than guessing.'], q: 'The account holds $1,000. Which trade is more sensible?', o: ['$100 at ×2', '$1,000 at ×10', '$900 at ×5'], ok: 0, e: 'A small share of the account and a low leverage: a mistake hurts but does not end the game.' } },
  { r: 1000, ru: { t: 'Цель: когда забрать прибыль', p: ['Цель — прибыль, при которой вы заранее решили закрыть сделку. Вложили $100 и решили: хватит $10. Цена дошла, вы закрыли и забрали $10.', 'Жадность превращает плюс в минус. Цена на пике не стоит: пока вы ждёте ещё, она может развернуться и вернуть всё. Цель, как и стоп, решается заранее, пока вы спокойны.', 'Цель не значит, что цена обязательно пойдёт дальше или упадёт. Это правило для вас: достигли — забрали.'], q: 'Вы поставили цель +$10, и цена её достигла. Что разумнее?', o: ['Закрыть сделку и забрать $10', 'Ждать ещё большего роста', 'Докупить ещё'], ok: 0, e: 'Цель задана заранее: достигли — забираем. Ждать большего значит рисковать уже заработанным.' },
    en: { t: 'Target: when to take profit', p: ['A target is the profit at which you decided in advance to close a trade. You put in $100 and decided: $10 is enough. The price got there, you closed and took $10.', 'Greed turns a plus into a minus. The price does not stand at its peak: while you wait for more it can turn and give everything back. A target, like a stop, is decided in advance while you are calm.', 'A target does not mean the price must go further or fall. It is a rule for you: reached it, took it.'], q: 'You set a target of +$10 and the price reached it. What is more sensible?', o: ['Close the trade and take $10', 'Wait for an even bigger rise', 'Add more'], ok: 0, e: 'The target was set in advance: reached it, take it. Waiting for more means risking what you already earned.' } },
  { r: 1000, ru: { t: 'Комиссия и частые сделки', p: ['Комиссия — плата за каждую сделку: за открытие и за закрытие. В тренажёре это 0,1 % от размера позиции с каждой стороны, всего 0,2 %.', 'Если цена выросла всего на 0,2 %, весь рост уходит на комиссию, и результат сделки — ноль. Десять коротких сделок с маленьким плюсом могут закончиться минусом.', 'Поэтому сделки открывают с причиной, а не ради самого действия: каждая лишняя сделка стоит денег.'], q: 'Позиция $1 000, комиссия 0,1 % при открытии и при закрытии. Сколько комиссии за одну сделку?', o: ['$2', '$1', '$0,10'], ok: 0, e: '0,1 % от $1 000 — это $1 при открытии и ещё $1 при закрытии: всего $2.' },
    en: { t: 'Fees and frequent trades', p: ['A fee is a charge for every trade: for opening and for closing. In the simulator it is 0.1% of the position size on each side, 0.2% in total.', 'If the price rose just 0.2%, the whole rise goes to fees and the result of the trade is zero. Ten short trades with a small plus can end in a minus.', 'So trades are opened for a reason, not for the action itself: every extra trade costs money.'], q: 'A $1,000 position, a fee of 0.1% on opening and on closing. How much is the fee for one trade?', o: ['$2', '$1', '$0.10'], ok: 0, e: '0.1% of $1,000 is $1 on opening and another $1 on closing: $2 in total.' } }
];
const lesN = () => Object.keys(S.les || {}).length;
const hasCat = c => (S.qx.cats && S.qx.cats[c]) || S.positions.some(p => INS[p.sym] && INS[p.sym].cat === c);
const holdMin = () => { let m = 0; S.positions.forEach(p => { m = Math.max(m, M.t - p.t); }); S.trades.forEach(x => { m = Math.max(m, x.t - x.t0); }); return Math.floor(m / 6e4); };
// One table: id, xp (level points), r (reward in $), n (target), p (progress now). Names and hints — T.ru/T.en keys q_<id>, q_<id>_d.
const QUESTS = [
  { id: 'les1', xp: 30, r: 500, n: 1, p: () => Math.min(1, lesN()) },
  { id: 'buy', xp: 40, r: 1000, n: 1, p: () => Math.min(1, S.agg.opens) },
  { id: 'close', xp: 50, r: 1500, n: 1, p: () => Math.min(1, S.agg.n) },
  { id: 'early', xp: 60, r: 2000, n: 1, p: () => Math.min(1, S.trades.filter(x => !x.liq && x.net < 0 && -x.net <= x.margin * 0.5).length) },
  { id: 'cmp', xp: 40, r: 1500, n: 1, p: () => (S.qx.cmp ? 1 : 0) },
  { id: 'wal', xp: 30, r: 1000, n: 1, p: () => (S.qx.wal ? 1 : 0) },
  { id: 'win', xp: 80, r: 5000, n: 1, p: () => Math.min(1, S.agg.wins) },
  { id: 'bet', xp: 60, r: 5000, n: 1, p: () => Math.min(1, (S.bets || []).length + (S.betHist || []).length) },
  { id: 'hold', xp: 120, r: 10000, n: 60, p: () => Math.min(60, holdMin()) },
  { id: 'course', xp: 150, r: 15000, n: LESSONS.length, p: () => Math.min(LESSONS.length, lesN()) },
  { id: 'wins3', xp: 150, r: 50000, n: 3, p: () => Math.min(3, S.agg.wins) },
  { id: 'mix', xp: 180, r: 100000, n: 3, p: () => Math.min(3, E.CATS.filter(c => hasCat(c.id)).length) }
];
const FUTURE = ['fut_friends', 'fut_debt_back', 'fut_debt_give'];
Object.assign(T.ru, {
  nav_quests: 'Задания', nav_learn: 'Обучение', quests_h: 'Задания', learn_h2: 'Обучение',
  q_les1: 'Урок 1', q_les1_d: 'Пройдите первый урок обучения', q_buy: 'Первая покупка', q_buy_d: 'Откройте любую сделку на рынке',
  q_close: 'Закрыть сделку', q_close_d: 'Закройте любую открытую позицию', q_early: 'Выйти вовремя', q_early_d: 'Закройте сделку, пока убыток не больше половины залога',
  q_cmp: 'Сравнить два актива', q_cmp_d: 'Откройте «Сравнить» с двумя активами', q_wal: 'Заглянуть в кошелёк', q_wal_d: 'Откройте раздел «Кошелёк»',
  q_win: 'Сделка в плюс', q_win_d: 'Закройте сделку с прибылью', q_bet: 'Сделать ставку', q_bet_d: 'Поставьте игровые деньги в разделе «Ставки»',
  q_hold: 'Держать позицию час', q_hold_d: 'Одна позиция остаётся открытой 60 минут', q_course: 'Пройти всё обучение', q_course_d: 'Ответьте верно во всех уроках',
  q_wins3: 'Три сделки в плюс', q_wins3_d: 'Закройте в плюс три сделки', q_mix: 'Портфель из трёх разделов', q_mix_d: 'Торгуйте активами из трёх разных разделов рынка',
  lvl_of: 'Уровень {n} из {m}', lvl_limit: 'Можно вносить всего до {x}', lvl_next: 'До уровня «{name}» ещё {x} очков', lvl_next_open: 'Откроет лимит {x}', lvl_max: 'Высший уровень. Потолок — {x}.',
  xp_short: 'оч.', xp_h: 'Как растёт уровень', xp_quests: 'Задания и уроки', xp_now: 'сейчас', xp_soon: 'скоро',
  fut_friends: 'Приглашённые друзья', fut_debt_back: 'Долг, возвращённый вовремя', fut_debt_give: 'Выданный долг',
  xp_profit: 'Чистая прибыль: сделки и ставки', xp_main: 'основная часть', net_h: 'Заработано умом', net_now: 'Чистый итог сейчас', net_best: 'Лучший итог', net_need: 'Нужно заработать ещё {x} чистой прибыли', net_note: 'Прибыль закрытых сделок и выигрыши по ставкам минус убытки, считается с момента обновления. Очки дают за лучший достигнутый итог: убытки сначала нужно отыграть.',
  fut_note: 'Друзья и долги между игроками тоже дадут очки, когда появится сервер. Для уровней «Магнат», «Мудрец» и «Оракул» нужна чистая прибыль.',
  q_done: 'Готово', q_next: 'Следующее задание', q_all_done: 'Все задания выполнены',
  q_toast: 'Задание «{n}»: +{r} и {x} оч.', q_toast_many: 'Выполнено заданий: {k}. +{r} и {x} оч.', lvl_up: 'Новый уровень: «{name}». Лимит пополнения {x}',
  lock_msg: 'Откроется на уровне «{name}». Ближайшее задание: «{q}» (+{x} оч.)', lock_msg2: 'Откроется на уровне «{name}»',
  room_msg: 'Сейчас можно внести ещё до {x}', full_msg: 'Лимит {c} внесён. Откроется на уровне «{name}». Ближайшее задание: «{q}»', full_top: 'Достигнут потолок {c}',
  lim_line: 'Лимит {c} · осталось {r}', limit_used: 'Лимит {c} внесён.',
  les_n: 'Урок {n} из {m}', les_done: 'Пройден', les_back: 'К урокам', les_next: 'Следующий урок', les_ok: 'Верно', les_bad: 'Не совсем. Выберите другой ответ.',
  les_reward: 'За верный ответ: +{r} и {x} оч.', les_got: 'Награда получена: +{r} и {x} оч.', les_q: 'Вопрос', les_again: 'Награда за этот урок уже получена',
  inv_h: 'Начните с урока 1', inv_p: 'Короткие уроки простыми словами, с примерами на деньгах. За каждый — игровые деньги и очки уровня.', inv_go: 'Начать', inv_later: 'Позже',
  inv_note: 'Начните с урока 1: за него +$500', low_t: 'Свободных денег меньше 10 % от внесённого. Можно попросить в долг у друга.', low_btn: 'Попросить у друга',
  soon_h: 'Скоро', soon_p: 'Переводы и долги между игроками появятся вместе с сервером. Друг сможет одолжить игровые деньги, а вы вернёте их позже. Пока деньги приносят задания.', soon_ok: 'Понятно',
  close_aria: 'Закрыть', lvbadge_aria: 'Уровень и задания', atm_key_bk: 'Стереть цифру'
});
Object.assign(T.en, {
  nav_quests: 'Quests', nav_learn: 'Learn', quests_h: 'Quests', learn_h2: 'Learning',
  q_les1: 'Lesson 1', q_les1_d: 'Pass the first lesson', q_buy: 'First buy', q_buy_d: 'Open any trade on the market',
  q_close: 'Close a trade', q_close_d: 'Close any open position', q_early: 'Leave in time', q_early_d: 'Close a trade while the loss is at most half the margin',
  q_cmp: 'Compare two assets', q_cmp_d: 'Open “Compare” with two assets', q_wal: 'Look into the wallet', q_wal_d: 'Open the Wallet',
  q_win: 'A winning trade', q_win_d: 'Close a trade with a profit', q_bet: 'Place a bet', q_bet_d: 'Stake play money in “Bets”',
  q_hold: 'Hold a position for an hour', q_hold_d: 'One position stays open for 60 minutes', q_course: 'Finish all lessons', q_course_d: 'Answer correctly in every lesson',
  q_wins3: 'Three winning trades', q_wins3_d: 'Close three trades with a profit', q_mix: 'A portfolio of three sections', q_mix_d: 'Trade assets from three different market sections',
  lvl_of: 'Level {n} of {m}', lvl_limit: 'You can deposit up to {x} in total', lvl_next: 'To level “{name}”: {x} more xp', lvl_next_open: 'Opens the limit {x}', lvl_max: 'Top level. The ceiling is {x}.',
  xp_short: 'xp', xp_h: 'How the level grows', xp_quests: 'Quests and lessons', xp_now: 'now', xp_soon: 'soon',
  fut_friends: 'Invited friends', fut_debt_back: 'A debt returned on time', fut_debt_give: 'A debt you lent',
  xp_profit: 'Net profit: trades and bets', xp_main: 'the main part', net_h: 'Earned by mind', net_now: 'Net result now', net_best: 'Best result', net_need: 'Earn {x} more of net profit', net_note: 'Profit of closed trades and won bets minus losses, counted from the update. Points go by the best result reached: losses must be won back first.',
  fut_note: 'Friends and debts between players will also give points once the server arrives. The levels Magnate, Sage and Oracle need net profit.',
  q_done: 'Done', q_next: 'Next quest', q_all_done: 'All quests done',
  q_toast: 'Quest “{n}”: +{r} and {x} xp', q_toast_many: 'Quests done: {k}. +{r} and {x} xp', lvl_up: 'New level: “{name}”. Deposit limit {x}',
  lock_msg: 'Opens at level “{name}”. Nearest quest: “{q}” (+{x} xp)', lock_msg2: 'Opens at level “{name}”',
  room_msg: 'You can deposit up to {x} more right now', full_msg: 'The {c} limit is used. Opens at level “{name}”. Nearest quest: “{q}”', full_top: 'The {c} ceiling is reached',
  lim_line: 'Limit {c} · {r} left', limit_used: 'The {c} limit is used.',
  les_n: 'Lesson {n} of {m}', les_done: 'Passed', les_back: 'To lessons', les_next: 'Next lesson', les_ok: 'Correct', les_bad: 'Not quite. Pick another answer.',
  les_reward: 'For a correct answer: +{r} and {x} xp', les_got: 'Reward received: +{r} and {x} xp', les_q: 'Question', les_again: 'The reward for this lesson is already received',
  inv_h: 'Start with lesson 1', inv_p: 'Short lessons in plain words, with examples in money. Each gives play money and level points.', inv_go: 'Start', inv_later: 'Later',
  inv_note: 'Start with lesson 1: it pays +$500', low_t: 'Free money is below 10% of what you put in. You can ask a friend for a loan.', low_btn: 'Ask a friend',
  soon_h: 'Soon', soon_p: 'Transfers and debts between players arrive with the server. A friend will be able to lend play money and you will return it later. For now quests bring money.', soon_ok: 'Got it',
  close_aria: 'Close', lvbadge_aria: 'Level and quests', atm_key_bk: 'Delete a digit'
});
const lvName = i => E.LEVELS[i][S.lang === 'en' ? 'en' : 'ru'];
const xpNow = () => E.xpTotal(S);
const qName = q => t('q_' + q.id);
const qDone = q => !!S.qd[q.id];
const nextQuest = () => QUESTS.filter(q => !qDone(q))[0] || null;
function addXp(n) { S.xp = (E.num(S.xp) || 0) + n; }
function levelFor(a) { let l = 0; while (l < E.LEVELS.length - 1 && E.LEVELS[l].lim < a) l++; return l; }
function openHint(l) {
  const q = nextQuest(), L = E.LEVELS[l], need = L.net > S.nm.mx ? ' ' + tf('net_need', { x: money(L.net - S.nm.mx, 0) }) + '.' : '';
  return (q && L.xp > xpNow() ? tf('lock_msg', { name: lvName(l), q: qName(q), x: q.xp }) : tf('lock_msg2', { name: lvName(l) })) + need;
}
function checkQuests() {
  if (!S || !S.qd) return;
  const lv0 = E.levelOf(S); let got = 0, sum = 0, xp = 0, last = null;
  QUESTS.forEach(q => {
    if (qDone(q) || q.p() < q.n) return;
    S.qd[q.id] = 1; E.grant(S, M, q.r); addXp(q.xp); got++; sum += q.r; xp += q.xp; last = q;
  });
  if (!got) return;
  save(); snd.win(); vib([12, 40, 12]);
  toast(got === 1 ? tf('q_toast', { n: qName(last), r: money(sum, 0), x: xp }) : tf('q_toast_many', { k: got, r: money(sum, 0), x: xp }), 'up', true);
  afterXp(lv0);
}
function afterXp(lv0) {
  const lv = E.levelOf(S);
  if (lv > lv0) setTimeout(() => toast(tf('lvl_up', { name: lvName(lv), x: money(E.LIMITS[lv], 0) }), 'up', true), 3400);
  ui.atmSig = ''; fillAtm(); fillNotes(true); fillBadge(); hdrBal();
  if (ui.view === 'quests') fillQuests(true);
  if (ui.view === 'learn') renderLearn();
}
// ---------- ATM input as a line of the screen (no system keyboard) ----------
const atmVal = () => { const el = $('atmInp'); return el ? el.getAttribute('data-v') || '' : ''; };
function atmSet(v) {
  const el = $('atmInp'); if (!el) return false;
  v = String(v).replace(/\D/g, '').replace(/^0+/, '').slice(0, 8);
  if (+v > E.LIMITS[E.LIMITS.length - 1]) return false;
  el.setAttribute('data-v', v); el.textContent = v ? grp(v) : ''; el.classList.toggle('nul', !v); return true;
}
function atmKey(k) {
  if (k === 'c') { atmSet(''); atmMsg(''); } else if (k === 'bk') { atmSet(atmVal().slice(0, -1)); atmMsg(''); }
  else if (k === 'ok') doDeposit(+atmVal() || 0);
  else { const v = atmVal(); if (!(v === '' && k === '0')) { if (!atmSet(v + k)) vib(20); else atmMsg(''); } }
}
const PRE = [1e3, 1e4, 25e3, 1e5, 5e5, 1e6, 3e6, 13e6];
const preTxt = a => (a >= 1e6 ? a / 1e6 + 'M' : a / 1e3 + 'K');
const LOCK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>';
function fillAtm() {
  const box = $('atmPre'); if (!box) return;
  const lv = E.levelOf(S), cap = E.LIMITS[lv], rm = E.room(S), key = lv + '|' + rm + '|' + S.lang;
  const ph = $('atmInp'); if (ph) ph.setAttribute('data-ph', t('atm_ph'));
  if (ui.atmSig === key) return; ui.atmSig = key;
  box.textContent = '';
  PRE.forEach(a => {
    const b = mkEl('button', a > cap ? 'lock' : a > rm ? 'dim' : '', ''); b.type = 'button';
    if (a > cap) { b.setAttribute('data-lock', String(a)); b.setAttribute('aria-disabled', 'true'); b.innerHTML = LOCK_SVG; b.appendChild(document.createTextNode(preTxt(a))); }
    else { b.setAttribute('data-amt', String(a)); b.textContent = preTxt(a); }
    box.appendChild(b);
  });
  setTxt($('atmLim'), tf('lim_line', { c: money(cap, 0), r: money(rm, 0) }));
}
function fillBadge() {
  if (!$('lvBadge') || !S) return; const lv = E.levelOf(S);
  setTxt($('lvNum'), String(lv + 1)); setTxt($('lvName'), lvName(lv));
}
function soonModal() {
  $('modalBody').innerHTML = '<h2 id="modalTitle">' + t('soon_h') + '</h2><p>' + t('soon_p') + '</p><div class="m-btns"><button class="btn-gold" type="button" data-act="modal-close">' + t('soon_ok') + '</button></div>';
  $('modal').hidden = false;
}
function inviteModal() {
  $('modalBody').innerHTML = '<h2 id="modalTitle">' + t('inv_h') + '</h2><p>' + t('inv_p') + '</p><div class="m-btns"><a class="btn-gold" href="#learn" data-act="modal-close">' + t('inv_go') + '</a><button class="btn-ghost" type="button" data-act="modal-close">' + t('inv_later') + '</button></div>';
  $('modal').hidden = false;
}
// ---------- notes: low money (all views) and the plaque on the money page ----------
const lowMoney = () => S.deposited > 0 && S.cash < S.deposited * 0.1;
function fillNotes(force) {
  const low = lowMoney(), q = nextQuest(), lv = E.levelOf(S);
  if (!low) ui.loanOff = false;
  const sig = [low && !ui.loanOff, lesN() > 0, q ? q.id + ':' + q.p() : 'x', lv, S.lang].join('|');
  if (!force && sig === ui.noteSig) return; ui.noteSig = sig;
  const n = $('note');
  if (n) {
    n.hidden = !(low && !ui.loanOff);
    if (!n.hidden) n.innerHTML = '<span class="note-t">' + t('low_t') + '</span><button class="btn-gold" type="button" data-loan="1">' + t('low_btn') + '</button><button class="note-x" type="button" data-noteoff="1" aria-label="' + t('close_aria') + '">×</button>';
  }
  const mn = $('moneyNotes');
  if (mn) {
    let h = '';
    if (lesN() === 0) h += '<a class="panel qn qn-inv" href="#learn"><b>' + t('inv_note') + '</b><span class="qn-go">' + t('inv_go') + ' →</span></a>';
    if (q) {
      const w = Math.round(q.p() / q.n * 100);
      h += '<a class="panel qn" href="#quests"><span class="lbl">' + t('q_next') + '</span><b>' + qName(q) + '</b><span class="qn-d">' + t('q_' + q.id + '_d') + '</span>' +
        '<span class="bar"><i style="width:' + w + '%"></i></span><span class="qn-r num">+' + money(q.r, 0) + ' · ' + q.xp + ' ' + t('xp_short') + '</span></a>';
    } else h += '<a class="panel qn" href="#quests"><b>' + t('q_all_done') + '</b></a>';
    mn.innerHTML = h;
  }
}
// ---------- Quests view: level, bar to the next level, quests, future sources of xp ----------
function renderQuests() { ui.qsSig = ''; fillQuests(true); }
function fillQuests(force) {
  const box = $('questsBox'); if (!box) return;
  const lv = E.levelOf(S), xp = xpNow(), L = E.LEVELS;
  const sig = [lv, xp, E.netNow(S), S.lang, Object.keys(S.qd).length, QUESTS.map(q => q.p()).join(','), E.room(S)].join('|');
  if (!force && sig === ui.qsSig) return; ui.qsSig = sig;
  const nxt = L[lv + 1], ln = S.lang === 'en' ? 'en' : 'ru', mx = S.nm.mx, nn = E.netNow(S);
  const pct = nxt ? Math.max(0, Math.min(100, (xp - L[lv].xp) / (nxt.xp - L[lv].xp) * 100)) : 100;
  const short = v => (v >= 1e6 ? v / 1e6 + 'M' : v / 1e3 + 'K');
  box.innerHTML = '<div class="vhead"><h1>' + t('quests_h') + '</h1></div>' +
    '<div class="panel lvcard"><div class="lv-top"><span class="lv-ic num">' + (lv + 1) + '</span><div><span class="lbl">' + tf('lvl_of', { n: lv + 1, m: L.length }) + '</span><b class="lv-name">' + L[lv][ln] + '</b></div>' +
    '<span class="lv-xp num">' + xp + ' ' + t('xp_short') + '</span></div>' +
    '<p class="lv-lim">' + tf('lvl_limit', { x: '<b class="num">' + money(L[lv].lim, 0) + '</b>' }) + '</p>' +
    '<div class="bar lv-bar"><i style="width:' + pct.toFixed(1) + '%"></i></div>' +
    '<p class="lv-next">' + (nxt ? (nxt.xp > xp ? tf('lvl_next', { name: nxt[ln], x: nxt.xp - xp }) + ' · ' : '') + tf('lvl_next_open', { x: '<b class="num">' + money(nxt.lim, 0) + '</b>' }) : tf('lvl_max', { x: money(L[lv].lim, 0) })) + '</p>' +
    (nxt && nxt.net > mx ? '<p class="lv-need">' + tf('net_need', { x: '<b class="num">' + money(nxt.net - mx, 0) + '</b>' }) + '</p>' : '') +
    '<ol class="lv-steps">' + L.map((l, i) => '<li class="' + (i < lv ? 'past' : i === lv ? 'now' : '') + '"><i class="num">' + (i + 1) + '</i><span>' + l[ln] + '</span><em class="num">' + short(l.lim) + '</em></li>').join('') + '</ol></div>' +
    '<div class="qgrid">' + QUESTS.map(q => {
      const d = qDone(q), pr = q.p(), w = Math.round(pr / q.n * 100);
      return '<div class="panel qc' + (d ? ' done' : '') + '"><div class="qc-t"><b>' + qName(q) + '</b>' + (d ? '<span class="qc-ok">' + t('q_done') + '</span>' : '') + '</div>' +
        '<p>' + t('q_' + q.id + '_d') + '</p><div class="bar"><i style="width:' + w + '%"></i></div>' +
        '<div class="qc-f"><span class="num">' + pr + ' / ' + q.n + '</span><span class="num">+' + money(q.r, 0) + ' · ' + q.xp + ' ' + t('xp_short') + '</span></div></div>';
    }).join('') + '</div>' +
    '<h2 class="h2">' + t('net_h') + '</h2><div class="panel xps"><div class="xp-r"><span>' + t('net_now') + '</span><span class="num ' + (nn > 0 ? 'up' : nn < 0 ? 'down' : '') + '">' + signed(nn) + '</span></div>' +
    '<div class="xp-r"><span>' + t('net_best') + '</span><span class="num">' + money(mx, 0) + '</span></div><p class="xp-note">' + t('net_note') + '</p></div>' +
    '<h2 class="h2">' + t('xp_h') + '</h2><div class="panel xps"><div class="xp-r"><span>' + t('xp_quests') + '</span><span class="num">' + t('xp_now') + '</span></div>' +
    '<div class="xp-r"><span>' + t('xp_profit') + '</span><span class="num">' + t('xp_main') + '</span></div>' +
    FUTURE.map(k => '<div class="xp-r soon"><span>' + t(k) + '</span><span>' + t('xp_soon') + '</span></div>').join('') + '<p class="xp-note">' + t('fut_note') + '</p></div>';
}
// ---------- Learning view ----------
const lesText = i => LESSONS[i][S.lang === 'en' ? 'en' : 'ru'];
function renderLearn() {
  const box = $('learnBox'); if (!box) return;
  if (ui.les == null) {
    if (window.DofaObu) DofaObu.stop();
    const nxt = LESSONS.findIndex((L1, j) => !S.les[j + 1]);
    box.innerHTML = '<div class="vhead"><h1>' + t('learn_h2') + '</h1></div><div class="lgrid">' + LESSONS.map((L0, i) => {
      const d = !!S.les[i + 1], x = lesText(i);
      return '<button type="button" class="panel lcc' + (d ? ' done' : '') + (i === nxt ? ' nxt' : '') + '" data-les="' + i + '"><span class="lc-n num">' + (i + 1) + '</span><span class="lc-t"><b>' + x.t + '</b><small class="num">' + (d ? t('les_done') : '+' + money(L0.r, 0) + ' · ' + LESSON_XP + ' ' + t('xp_short')) + '</small></span><span class="lc-go" aria-hidden="true">' + (d ? '✓' : '→') + '</span></button>';
    }).join('') + '</div>';
    return;
  }
  const i = ui.les, L0 = LESSONS[i], x = lesText(i), a = ui.ans, done = !!S.les[i + 1];
  const obuOn = !!(window.DofaObu && DofaObu.has(i)), locked = obuOn && !done && !(ui.obu && ui.obu[i]);
  let h = '<div class="vhead"><button type="button" class="link-btn" data-lback="1">← ' + t('les_back') + '</button><span class="lbl les-n">' + tf('les_n', { n: i + 1, m: LESSONS.length }) + '</span><h1>' + x.t + '</h1></div>' +
    '<div class="panel les-body">' + x.p.map(s => '<p>' + s + '</p>').join('') + '</div>' +
    (obuOn ? '<div class="obu-host" id="obuHost"></div>' : '') +
    '<div class="panel les-q' + (locked ? ' les-lock' : '') + '"><span class="lbl">' + t('les_q') + '</span><p class="les-qt">' + x.q + '</p><div class="les-opts">' +
    (locked ? '<p class="les-lk">' + DofaObu.text('lock', S.lang) + '</p>' : '') + x.o.map((o, k) => '<button type="button" class="opt' + (a && a.i === k ? (a.ok ? ' ok' : ' bad') : '') + '" data-ans="' + k + '">' + o + '</button>').join('') + '</div>';
  if (a && a.ok) h += '<p class="les-fb ok"><b>' + t('les_ok') + '.</b> ' + x.e + '</p><p class="les-rw num">' + (a.fresh ? tf('les_got', { r: money(L0.r, 0), x: LESSON_XP }) : t('les_again')) + '</p>' +
    '<div class="m-btns">' + (i + 1 < LESSONS.length ? '<button class="btn-gold" type="button" data-les="' + (i + 1) + '">' + t('les_next') + '</button>' : '') + '<button class="btn-ghost" type="button" data-lback="1">' + t('les_back') + '</button></div>';
  else if (a) h += '<p class="les-fb bad">' + t('les_bad') + '</p>';
  else h += '<p class="les-rw num">' + (done ? t('les_again') : tf('les_reward', { r: money(L0.r, 0), x: LESSON_XP })) + '</p>';
  box.innerHTML = h + '</div>';
  if (obuOn) DofaObu.mount($('obuHost'), i, obuApi());
}
// 14.11: interactive practice (obuchenie.js). It never writes trades, quests, points or money: only "practice passed" for this session.
function obuApi() {
  return { lang: () => S.lang, t: k => t(k), money: (v, d) => money(v, d), passed: i => !!(S.les[i + 1] || (ui.obu && ui.obu[i])),
    pass: i => { ui.obu = ui.obu || {}; ui.obu[i] = 1; const q = document.querySelector('.les-q'); if (q) { q.classList.remove('les-lock'); const lk = q.querySelector('.les-lk'); if (lk) lk.remove(); } try { snd.win(); vib([12, 40, 12]); } catch (e) {} } };
}
function answer(k) {
  const i = ui.les; if (i == null) return; if (window.DofaObu && DofaObu.has(i) && !S.les[i + 1] && !(ui.obu && ui.obu[i])) return; const ok = k === LESSONS[i].ru.ok;
  if (ok && !S.les[i + 1]) {
    const lv0 = E.levelOf(S); S.les[i + 1] = 1; E.grant(S, M, LESSONS[i].r); addXp(LESSON_XP); save(); snd.win(); vib([12, 40, 12]);
    ui.ans = { i: k, ok: true, fresh: true }; renderLearn(); checkQuests(); afterXp(lv0); return;
  }
  if (ok) snd.win();
  ui.ans = { i: k, ok: ok, fresh: false }; renderLearn();
}

/* =====================================================================
   10. ROUTING, EVENTS, TICK
   ===================================================================== */
const VIEWS = ['money', 'market', 'compare', 'wallet', 'truth', 'news', 'bets', 'top', 'quests', 'learn'];
function render() {
  sig = posSig(); chartsKill();
  if (ui.view !== 'learn' && window.DofaObu) DofaObu.stop();
  if (ui.view === 'market') renderMarket();
  else if (ui.view === 'wallet') renderWallet();
  else if (ui.view === 'truth') renderTruth();
  else if (ui.view === 'news') renderNews();
  else if (ui.view === 'bets') renderBets();
  else if (ui.view === 'top') renderTop();
  else if (ui.view === 'quests') renderQuests();
  else if (ui.view === 'learn') renderLearn();
  else if (ui.view === 'compare') { renderCompare(); cmpLoad(); }
  if (ui.view === 'wallet') S.qx.wal = 1;
  if (ui.view === 'compare' && S.cmp.syms.length >= 2) S.qx.cmp = 1;
  upd(true); refreshView(); hdrBal(); ui.atmSig = ''; fillAtm(); fillBadge(); fillNotes(true); checkQuests();
}
function refreshView() {
  if (ui.view === 'money') refreshMoney();
  else if (ui.view === 'market' && ui.sym) { setTxt($('trCash'), money(S.cash)); drawIns(); }
  else if (ui.view === 'wallet') refreshWallet();
  else if (ui.view === 'truth') refreshTruth();
  else if (ui.view === 'top') refreshTop();
  else if (ui.view === 'quests') fillQuests();
}
// 13.11 (2): header shows the wallet — total portfolio value (cash + positions); tap opens the Wallet.
function hdrBal() { const el = $('hBalV'); if (el && S) rollTo(el, E.equity(S, M), tight); }
function refresh() {
  if (!S || document.hidden) return;
  hdrBal();
  const s = posSig();
  if (s !== sig) { sig = s; renderDyn(); }
  upd(); refreshView(); fillNotes(); checkQuests();
}
function route() {
  const a = String(location.hash || '').replace(/^#/, '').split('/');
  ui.view = VIEWS.indexOf(a[0]) >= 0 ? a[0] : 'money'; ui.cat = null; ui.sym = null; if (ui.view === 'learn') { ui.les = null; ui.ans = null; }
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
  try { document.dispatchEvent(new Event('dofa-lang')); } catch (e) {}
  const sb = $('sndBtn'); if (sb) { sb.classList.toggle('off', !S.sound); sb.setAttribute('aria-pressed', S.sound ? 'true' : 'false'); }
  drawSync();
}
function onClick(e) {
  snd.gesture();
  let el = e.target && e.target.closest ? e.target.closest('[data-tf],[data-lev],[data-pre],[data-side],[data-close],[data-amt],[data-key],[data-lock],[data-les],[data-ans],[data-lback],[data-loan],[data-noteoff],[data-act],[data-ncat],[data-ccat],[data-csym],[data-per],[data-bcat],[data-bet],[data-bsell],[data-bpre],[data-btab],[data-sp],[data-bx],[data-bmine],[data-bhist],[data-tip],[data-ct],[data-cl],#langBtn,#sndBtn,#skinBtn,#modal,#more,#slip,.more-row') : null;
  // 3D quirk: a pressed ATM button shifts and the click lands on its parent — find the button under the finger by its box.
  if (!el && e.target && e.target.closest && e.target.closest('#atm') && e.clientX != null) {
    const bs = document.querySelectorAll('#atm button');
    for (let i = 0; i < bs.length; i++) { const r = bs[i].getBoundingClientRect(); if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) { el = bs[i]; break; } }
  }
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
    if (performance.now() - (ui.keyAt || 0) < 700) return;   // already handled on pointerdown
    snd.key(); vib(8); atmKey(A('data-key'));
  } else if (has('data-lock')) { atmMsg(openHint(levelFor(+A('data-lock'))), true); vib(20);
  } else if (has('data-les')) { ui.les = +A('data-les'); ui.ans = null; renderLearn(); try { window.scrollTo(0, 0); } catch (e) {}
  } else if (has('data-ans')) { answer(+A('data-ans'));
  } else if (has('data-lback')) { ui.les = null; ui.ans = null; renderLearn(); try { window.scrollTo(0, 0); } catch (e) {}
  } else if (has('data-loan')) { if (!(window.DofaKab && window.DofaKab.loan && window.DofaKab.loan())) soonModal();
  } else if (has('data-noteoff')) { ui.loanOff = true; fillNotes(true);
  } else if (has('data-ncat')) {
    ui.ncat = A('data-ncat'); document.querySelectorAll('[data-ncat]').forEach(b => b.classList.toggle('on', b === el)); fillNews();
  } else if (has('data-ccat')) { ui.ccat = A('data-ccat'); ui.cq = ''; const qi = $('cmpQ'); if (qi) qi.value = ''; fillCmpPick(false); }
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
  else if (has('data-per')) { cmpSetPer(A('data-per')); }
  else if (has('data-act')) {
    const a = A('data-act'), rc = $('resetConfirm');
    if (a === 'deposit') doDeposit(+atmVal() || 0);
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
  if (!S.cmp || !Array.isArray(S.cmp.syms)) S.cmp = { syms: ['BTC', 'SPX'], per: '30d' };
  S.cmp.syms = S.cmp.syms.filter((s, i, a) => INS[s] && a.indexOf(s) === i).slice(0, 4);
  S.cmp.per = perKey(S.cmp.per);
  const r = E.advance(S, M, Date.now());          // time kept going while the tab was closed
  readSkin(); applyLang(); route();
  if (r.liq.length) onLiq(r.liq);
  document.addEventListener('click', onClick);
  // ATM keys fire on press: a pressed key shifts in 3D and the browser then sends the click to its parent, so the digit was lost on phones.
  document.addEventListener('pointerdown', e => {
    const k = e.target && e.target.closest ? e.target.closest('#atm [data-key]') : null; if (!k) return;
    ui.keyAt = performance.now(); snd.gesture(); snd.key(); vib(8); atmKey(k.getAttribute('data-key')); ui.keyAt = performance.now();   // 14.11: stamp again after the slow first sound start, so the following click is still skipped
  });
  document.addEventListener('input', e => { if (e.target && e.target.id === 'cmpQ') { ui.cq = e.target.value.slice(0, 24); fillCmpPick(false); } });
  fitAtm(); atmTilt();
  document.addEventListener('pointerdown', () => snd.gesture(), { passive: true });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { const m = $('modal'); if (m) m.hidden = true; if (ui.bet) closeSlip(); }
    // 14.11: digits, Backspace, Delete and Enter of a real keyboard work like the ATM keys
    const m = $('modal'), tg = e.target, tag = tg && tg.tagName;
    if (ui.view !== 'money' || (m && !m.hidden) || e.ctrlKey || e.metaKey || e.altKey || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (/^\d$/.test(e.key)) { e.preventDefault(); snd.key(); atmKey(e.key); }
    else if (e.key === 'Backspace') { e.preventDefault(); atmKey('bk'); }
    else if (e.key === 'Delete') { e.preventDefault(); atmKey('c'); }
    else if (e.key === 'Enter' && tag !== 'BUTTON' && tag !== 'A') { e.preventDefault(); atmKey('ok'); }
  });
  window.addEventListener('hashchange', route);
  if (!S.inv && lesN() === 0 && S.deposited === 0) { S.inv = 1; save(); setTimeout(() => { if (ui.view === 'money') inviteModal(); }, 900); }
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
// 14.11 (kabinet.js): a read-only window for the cabinet code; nothing here runs unless the cabinet script asks.
window.DofaSim = {
  lang: () => (S ? S.lang : 'ru'), cash: () => (S ? S.cash : 0), level: () => (S ? E.levelOf(S) : 0), levelName: i => lvName(i),
  quests: () => (S && S.qd ? QUESTS.filter(q => S.qd[q.id]).map(q => q.id) : []), toast: (m, c, ok) => toast(m, c, ok), vib: p => vib(p)
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

})();
