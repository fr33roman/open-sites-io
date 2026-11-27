/* DOFAMART · Atelier Wealth (Вариант 2 — Светлая Нео-Классика Financial Times) */
(function () {
  'use strict';

  const fmt = (n, dec = 0) => {
    const sign = n < 0 ? '−' : '';
    const v = Math.abs(n).toFixed(dec);
    const [a, b] = v.split('.');
    return sign + '$' + a.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (b ? '.' + b : '');
  };
  const fmtSigned = (n, dec = 0) => (n > 0 ? '+' : '') + fmt(n, dec);

  const ASSETS = [
    { sym: 'BTC', name: 'Bitcoin', cat: 'crypto', src: 'LIVE · BINANCE', price: 94280.4, chg: 2.84 },
    { sym: 'ETH', name: 'Ethereum', cat: 'crypto', src: 'LIVE · BINANCE', price: 3425.1, chg: 1.92 },
    { sym: 'SOL', name: 'Solana', cat: 'crypto', src: 'LIVE · BINANCE', price: 218.6, chg: 4.15 },
    { sym: 'TON', name: 'Toncoin', cat: 'crypto', src: 'LIVE · BINANCE', price: 6.14, chg: -1.18 },
    { sym: 'NVDA', name: 'NVIDIA Corp.', cat: 'stocks', src: 'NASDAQ · МОДЕЛЬ', price: 141.85, chg: 3.12 },
    { sym: 'AAPL', name: 'Apple Inc.', cat: 'stocks', src: 'NASDAQ · МОДЕЛЬ', price: 234.2, chg: 0.76 },
    { sym: 'TSLA', name: 'Tesla Inc.', cat: 'stocks', src: 'NASDAQ · МОДЕЛЬ', price: 338.5, chg: -1.64 },
    { sym: 'PLTR', name: 'Palantir Tech', cat: 'stocks', src: 'NYSE · МОДЕЛЬ', price: 64.9, chg: 5.42 },
    { sym: 'XAU', name: 'Золото (PAXG)', cat: 'metals', src: 'LIVE · PAXG', price: 2684.5, chg: 0.62 },
    { sym: 'XAG', name: 'Серебро Spot', cat: 'metals', src: 'МОДЕЛЬ', price: 31.42, chg: 1.05 },
    { sym: 'EUR/USD', name: 'Евро / Доллар', cat: 'fx', src: 'ЕЦБ · ЗАДЕРЖКА', price: 1.0584, chg: -0.22 },
    { sym: 'GBP/USD', name: 'Фунт / Доллар', cat: 'fx', src: 'ЕЦБ · ЗАДЕРЖКА', price: 1.2692, chg: 0.14 },
    { sym: 'SPX', name: 'S&P 500 Index', cat: 'indices', src: 'МОДЕЛЬ', price: 5998.4, chg: 0.54 },
    { sym: 'NDX', name: 'Nasdaq 100', cat: 'indices', src: 'МОДЕЛЬ', price: 20940.0, chg: 0.91 }
  ];

  const EVENTS = [
    { id: 'e1', type: 'sport', sport: 'football', meta: 'ЛИГА ЧЕМПИОНОВ · СЕГОДНЯ 22:00', title: 'Реал Мадрид — Ливерпуль', outcomes: [{ k: 'П1 · Реал', o: 2.18 }, { k: 'Х · Ничья', o: 3.45 }, { k: 'П2 · Ливерпуль', o: 3.20 }] },
    { id: 'e2', type: 'sport', sport: 'mma', meta: 'UFC MAIN EVENT · СУББОТА', title: 'Илия Топурия vs Александр Волкановски', outcomes: [{ k: 'Топурия', o: 1.54 }, { k: 'Волкановски', o: 2.62 }] },
    { id: 'e3', type: 'sport', sport: 'nba', meta: 'NBA · ЗАВТРА 04:00', title: 'Boston Celtics — Denver Nuggets', outcomes: [{ k: 'Celtics', o: 1.72 }, { k: 'Nuggets', o: 2.24 }] },
    { id: 'e4', type: 'sport', sport: 'tennis', meta: 'ATP MASTERS · ПОЛУФИНАЛ', title: 'Янник Синнер — Карлос Алькарас', outcomes: [{ k: 'Синнер', o: 1.86 }, { k: 'Алькарас', o: 2.02 }] },
    { id: 'p1', type: 'poly', sport: 'all', meta: 'POLYMARKET · КРИПТА · $18.4M', title: 'Bitcoin выше $105 000 до конца квартала?', outcomes: [{ k: 'Да · 61%', o: 1.64 }, { k: 'Нет · 39%', o: 2.56 }] },
    { id: 'p2', type: 'poly', sport: 'all', meta: 'POLYMARKET · ЭКОНОМИКА · $9.2M', title: 'Снижение ставки ФРС на 25 б.п.?', outcomes: [{ k: 'Да · 68%', o: 1.47 }, { k: 'Нет · 32%', o: 3.12 }] },
    { id: 'p3', type: 'poly', sport: 'all', meta: 'POLYMARKET · ТЕХНОЛОГИИ · $6.7M', title: 'NVIDIA сохранит #1 капитализацию мира?', outcomes: [{ k: 'Да · 57%', o: 1.75 }, { k: 'Нет · 43%', o: 2.32 }] }
  ];

  const RANKS = [
    { lvl: 1, name: 'Ученик', req: '0 XP' },
    { lvl: 2, name: 'Счетовод', req: '300 XP' },
    { lvl: 3, name: 'Купец', req: '700 XP' },
    { lvl: 4, name: 'Стратег', req: '1 150 XP' },
    { lvl: 5, name: 'Инвестор', req: '1 480 XP · Текущий' },
    { lvl: 6, name: 'Банкир', req: '2 200 XP' },
    { lvl: 7, name: 'Финансист', req: '3 100 XP' },
    { lvl: 8, name: 'Магнат', req: '+$100K чистой прибыли' },
    { lvl: 9, name: 'Мудрец', req: '+$500K чистой прибыли' },
    { lvl: 10, name: 'Оракул', req: '+$2M чистой прибыли' }
  ];

  const state = {
    view: 'stat', demoMode: true, period: '30d', benchSp: true, benchCash: false,
    hmMode: 'res', feedFilter: 'all',
    cash: 118420, vault: 9700000, cityVal: 31700, deposited: 300000,
    realizedTrade: 34890, realizedBets: 9430, loanIncome: 4300, fees: 1420,
    mktCat: 'crypto', sym: 'BTC', tf: '1h', chartStyle: 'candle', orderSide: 1, orderLev: 2,
    betTab: 'sport', betSport: 'all', slip: null, chequeType: 'transfer',
    positions: [
      { id: 1, sym: 'BTC', side: 1, lev: 2, margin: 45000, entry: 91150 },
      { id: 2, sym: 'NVDA', side: 1, lev: 2, margin: 38000, entry: 136.4 }
    ],
    activeBets: [
      { id: 'b1', event: 'Реал Мадрид — Ливерпуль', outcome: 'П1 · Реал', odds: 2.18, stake: 12000, curMult: 1.14 },
      { id: 'b2', event: 'Bitcoin выше $105 000?', outcome: 'Да · 61%', odds: 1.64, stake: 25000, curMult: 1.08 }
    ],
    owedToMe: [
      { id: 'l1', who: '@alex_fx · id1104', principal: 25000, rate: 12, total: 28000, paid: 10500, daysLeft: 14 },
      { id: 'l2', who: '@maria_inv · id1298', principal: 20000, rate: 15, total: 23000, paid: 0, daysLeft: 22 }
    ],
    iOwe: [
      { id: 'l3', who: '@dmitry_pro · id0812', principal: 10000, rate: 20, total: 12000, paid: 0, daysLeft: 9 }
    ],
    cheques: [
      { id: 'c1', kind: 'Подарок другу', amt: 15000, note: 'На первую сделку +$100K новичку', link: 'open-sites.io/c/df8492a' },
      { id: 'c2', kind: 'Заём под 10%', amt: 20000, note: 'На 30 дней под 10%', link: 'open-sites.io/c/df9104b' }
    ],
    friends: [
      { name: '@alex_fx', status: 'Активен · 3+ дня', quests: '6 / 3', bonus: '+180 XP' },
      { name: '@maria_inv', status: 'Активна · 3+ дня', quests: '4 / 3', bonus: '+180 XP' },
      { name: '@timur_k', status: 'Активен · 3+ дня', quests: '5 / 3', bonus: '+180 XP' },
      { name: '@elena_v', status: 'В процессе', quests: '2 / 3', bonus: 'ждёт 1 задание' },
      { name: '@sergey_m', status: 'Новый ($100K)', quests: '1 / 3', bonus: 'ждёт 2 задания' }
    ],
    feed: [
      { type: 'trade', time: '14:22', text: 'Закрыта ETH Лонг ×2 · доходность +14.8%', amt: '+$8 420', cls: 'dfb-up' },
      { type: 'loan', time: '12:05', text: '@alex_fx внёс платёж по займу вовремя', amt: '+$10 500', cls: 'dfb-up' },
      { type: 'bet', time: 'Вчера', text: 'Сыграл прогноз UFC: Топурия (×1.62)', amt: '+$6 200', cls: 'dfb-up' },
      { type: 'trade', time: 'Вчера', text: 'Ликвидация TSLA Шорт ×10 (в спешке)', amt: '−$4 100', cls: 'dfb-down' },
      { type: 'loan', time: '24 ноя', text: 'Выписан реферальный чек (+$100K другу)', amt: '−$15 000', cls: 'dfb-cobalt' }
    ],
    candles: {}
  };

  ASSETS.forEach((a, idx) => {
    const arr = [];
    let p = a.price * (1 - a.chg / 100);
    let seed = (idx + 3) * 113;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    for (let i = 0; i < 42; i++) {
      const o = p;
      const drift = (a.price - o) * 0.08;
      const vol = a.price * 0.008;
      const c = Math.max(a.price * 0.7, o + drift + (rnd() - 0.48) * vol);
      const h = Math.max(o, c) + rnd() * vol * 0.55;
      const l = Math.min(o, c) - rnd() * vol * 0.55;
      arr.push({ o, h, l, c });
      p = c;
    }
    arr[arr.length - 1].c = a.price;
    state.candles[a.sym] = arr;
  });

  const HEAT = [];
  for (let d = 0; d < 7; d++) {
    const row = [];
    for (let h = 0; h < 24; h++) {
      const active = (h >= 9 && h <= 23) ? ((d * 7 + h * 13) % 7) : ((h + d) % 5 === 0 ? 1 : 0);
      const res = active === 0 ? 0 : (h >= 21 || d === 5 ? -((h * 190 + d * 340) % 2400) : ((h * 310 + d * 520) % 4200) - 600);
      row.push({ act: active, res });
    }
    HEAT.push(row);
  }

  const $ = id => document.getElementById(id);
  const toast = msg => {
    const el = $('dfbToast');
    el.textContent = msg;
    el.classList.add('is-show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('is-show'), 2800);
  };

  function calcTotals() {
    let posVal = 0;
    state.positions.forEach(p => {
      const a = ASSETS.find(x => x.sym === p.sym);
      const pnl = p.margin * p.lev * p.side * ((a.price - p.entry) / p.entry);
      posVal += Math.max(0, p.margin + pnl);
    });
    const betsVal = state.activeBets.reduce((s, b) => s + b.stake * b.curMult, 0);
    const owedNet = state.owedToMe.reduce((s, l) => s + (l.total - l.paid), 0);
    const oweNet = state.iOwe.reduce((s, l) => s + (l.total - l.paid), 0);
    const equity = state.cash + posVal + betsVal + state.cityVal + owedNet - oweNet;
    const netProfit = equity - state.deposited;
    const roi = state.deposited > 0 ? (netProfit / state.deposited) * 100 : 0;
    return { posVal, betsVal, owedNet, oweNet, equity, netProfit, roi };
  }

  function renderStrip() {
    $('dfbStripQuotes').innerHTML = ASSETS.slice(0, 7).map(a =>
      `<span class="dfb-sq"><b>${a.sym}</b>${a.price < 10 ? a.price.toFixed(4) : fmt(a.price, a.price < 500 ? 2 : 0)} <span class="${a.chg >= 0 ? 'u' : 'd'}">${a.chg >= 0 ? '+' : ''}${a.chg.toFixed(2)}%</span></span>`
    ).join('');
  }

  function renderHeaderNums() {
    const t = calcTotals();
    $('dfbTopEquity').textContent = fmt(t.equity, 2);
    $('dfbTopCash').textContent = fmt(state.cash);
    $('dfbLoanCnt').textContent = state.owedToMe.length + state.iOwe.length;
    $('dfbOrderFree').textContent = fmt(state.cash);
    $('dfbSlipFree').textContent = fmt(state.cash);
    $('dfbVaultCash').textContent = fmt(state.cash, 2);
    $('dfbVaultTop').textContent = fmt(state.vault);
    $('dfbVaultRes').textContent = fmt(state.vault);
  }

  function renderStat() {
    $('dfbEmptyBox').hidden = state.demoMode;
    $('dfbStatDesk').hidden = !state.demoMode;
    if (!state.demoMode) return;

    const t = calcTotals();
    const mult = { day: 0.14, '7d': 0.42, '30d': 1, all: 1.38 }[state.period];
    $('dfbStatEquity').textContent = fmt(t.equity, 2);
    $('dfbStatDelta').textContent = `${fmtSigned(t.netProfit * mult, 2)} · ${t.roi >= 0 ? '+' : ''}${(t.roi * mult).toFixed(1)}% к внесённому`;
    $('dfbStatTrade').textContent = fmtSigned(state.realizedTrade * mult);
    $('dfbStatBets').textContent = fmtSigned(state.realizedBets * mult);
    $('dfbStatLoan').textContent = fmtSigned(state.loanIncome * mult);
    $('dfbStatVault').textContent = fmt(state.vault);
    $('dfbSideOwed').textContent = fmt(t.owedNet);
    $('dfbSideOwe').textContent = fmt(t.oweNet);

    const parts = [
      { label: 'Свободно', val: state.cash, color: '#126B48' },
      { label: 'Позиции', val: t.posVal, color: '#1A4B8C' },
      { label: 'Прогнозы', val: t.betsVal, color: '#8C2338' },
      { label: 'Выданные займы', val: t.owedNet, color: '#B08438' },
      { label: 'Город', val: state.cityVal, color: '#7A808D' }
    ];
    const sum = parts.reduce((s, x) => s + x.val, 0) || 1;
    $('dfbAllocBar').innerHTML = parts.map(p => `<i style="width:${(p.val / sum * 100).toFixed(1)}%;background:${p.color}"></i>`).join('');
    $('dfbAllocLegend').innerHTML = parts.map(p => `<li><span class="dfb-dot" style="background:${p.color}"></span>${p.label} <b class="num">${fmt(p.val)}</b></li>`).join('');

    $('dfbBenchRow').innerHTML = `
      <div><small>Ваш результат (${state.period})</small><strong class="num dfb-up">${fmtSigned(t.netProfit * mult)} (+${(t.roi * mult).toFixed(1)}%)</strong></div>
      <div><small>Индекс S&amp;P 500 за период</small><strong class="num dfb-cobalt">${fmtSigned(16400 * mult)} (+${(5.4 * mult).toFixed(1)}%)</strong></div>
      <div><small>Просто держали бы деньги</small><strong class="num">$0.00 (0.0%)</strong></div>
    `;

    $('dfbAuditList').innerHTML = `
      <li class="good"><b>ОПТИМАЛЬНОЕ ПЛЕЧО ×1–×2</b>Принесли <strong>+$41 200</strong> (винрейт 71% на 28 закрытых сделках).</li>
      <li class="warn"><b>ГЛАВНАЯ УТЕЧКА · ПЛЕЧО ×10</b>Убыток <strong>−$9 850</strong> и 2 ликвидации после 21:00 по времени браузера.</li>
      <li class="good"><b>НАПРАВЛЕНИЕ · ЛОНГ vs ШОРТ</b>Сделки на рост точнее падения: <strong>68%</strong> против <strong>41%</strong>.</li>
      <li><b>КОМИССИОННАЯ НАГРУЗКА</b>Комиссии составили 4.1% от прибыли. Держать позицию > 2 ч выгоднее в 2.4 раза.</li>
    `;

    const rows = [
      ['Без плеча ×1', 14, '79%', '+$18 400', true],
      ['Плечо ×2–×5', 20, '65%', '+$26 340', true],
      ['Плечо ×10', 8, '25%', '−$9 850', false],
      ['Криптовалюты', 24, '67%', '+$22 150', true],
      ['Акции США', 12, '58%', '+$12 740', true],
      ['Спорт и Polymarket', 15, '60%', '+$9 430', true]
    ];
    $('dfbBreakdownBody').innerHTML = rows.map(r => `
      <tr><td>${r[0]}</td><td class="r num">${r[1]}</td><td class="r num">${r[2]}</td><td class="r num ${r[4] ? 'dfb-up' : 'dfb-down'}">${r[3]}</td></tr>
    `).join('');

    renderHeatmap();
    renderFeed();
    drawEquityChart();
  }

  function renderHeatmap() {
    const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    let html = '<em></em>';
    for (let h = 0; h < 24; h++) html += `<em>${h % 3 === 0 ? h : ''}</em>`;
    HEAT.forEach((row, d) => {
      html += `<b>${days[d]}</b>`;
      row.forEach((cell, h) => {
        let bg = '#EFEAE0';
        if (state.hmMode === 'res' && cell.res !== 0) {
          const a = Math.min(0.88, 0.22 + Math.abs(cell.res) / 3800);
          bg = cell.res > 0 ? `rgba(18,107,72,${a.toFixed(2)})` : `rgba(140,35,56,${a.toFixed(2)})`;
        } else if (state.hmMode === 'act' && cell.act > 0) {
          const a = Math.min(0.9, 0.18 + cell.act * 0.12);
          bg = `rgba(26,75,140,${a.toFixed(2)})`;
        }
        html += `<i style="background:${bg}" data-d="${days[d]}" data-h="${h}" data-act="${cell.act}" data-res="${cell.res}"></i>`;
      });
    });
    $('dfbHeatmap').innerHTML = html;
  }

  function renderFeed() {
    const list = state.feed.filter(f => state.feedFilter === 'all' || f.type === state.feedFilter);
    $('dfbFeedList').innerHTML = list.map(f => `
      <li class="${f.type}"><time>${f.time}</time><span>${f.text}</span><b class="num ${f.cls}">${f.amt}</b></li>
    `).join('');
  }

  const EQ_SERIES = {
    day: [341200, 342800, 341900, 344100, 345900, 344700, 347300, 348620],
    '7d': [322000, 326400, 324100, 331500, 338900, 335200, 343100, 348620],
    '30d': [300000, 304500, 302100, 309800, 316400, 312900, 321500, 329400, 325100, 334800, 342100, 348620],
    all: [250000, 268000, 261000, 284000, 295000, 302000, 318000, 311000, 328000, 339000, 344000, 348620]
  };
  let hoverIdx = -1;

  function drawEquityChart() {
    const cv = $('dfbEquityCanvas');
    if (!cv || cv.offsetParent === null) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = cv.clientWidth, H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);

    const t = calcTotals();
    const vals = EQ_SERIES[state.period].slice();
    vals[vals.length - 1] = Math.round(t.equity);
    const base = vals[0];
    const sp = vals.map((_, i) => base * (1 + 0.054 * (i / (vals.length - 1))));
    const allV = vals.concat(state.benchSp ? sp : [], state.benchCash ? [base] : []);
    const min = Math.min(...allV) * 0.992, max = Math.max(...allV) * 1.008;
    const pad = { l: 10, r: 58, t: 16, b: 22 };
    const xOf = i => pad.l + (i / (vals.length - 1)) * (W - pad.l - pad.r);
    const yOf = v => pad.t + (1 - (v - min) / (max - min || 1)) * (H - pad.t - pad.b);

    ctx.strokeStyle = '#E5DEC9'; ctx.lineWidth = 1;
    ctx.font = '11px "IBM Plex Mono", monospace'; ctx.fillStyle = '#7A808D';
    for (let g = 0; g <= 3; g++) {
      const y = pad.t + (g / 3) * (H - pad.t - pad.b);
      const val = max - (g / 3) * (max - min);
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
      ctx.fillText('$' + Math.round(val / 1000) + 'K', W - pad.r + 8, y + 4);
    }

    if (state.benchCash) {
      ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = '#9BA0AA';
      ctx.beginPath(); ctx.moveTo(pad.l, yOf(base)); ctx.lineTo(W - pad.r, yOf(base)); ctx.stroke(); ctx.restore();
    }
    if (state.benchSp) {
      ctx.save(); ctx.setLineDash([5, 4]); ctx.strokeStyle = '#8C2338'; ctx.lineWidth = 1.6;
      ctx.beginPath(); sp.forEach((v, i) => i ? ctx.lineTo(xOf(i), yOf(v)) : ctx.moveTo(xOf(i), yOf(v))); ctx.stroke(); ctx.restore();
    }

    const grad = ctx.createLinearGradient(0, pad.t, 0, H - pad.b);
    grad.addColorStop(0, 'rgba(26, 75, 140, 0.16)');
    grad.addColorStop(1, 'rgba(26, 75, 140, 0.0)');
    ctx.beginPath();
    vals.forEach((v, i) => i ? ctx.lineTo(xOf(i), yOf(v)) : ctx.moveTo(xOf(i), yOf(v)));
    ctx.lineTo(xOf(vals.length - 1), H - pad.b); ctx.lineTo(xOf(0), H - pad.b); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();

    ctx.beginPath(); ctx.strokeStyle = '#1A4B8C'; ctx.lineWidth = 2.2;
    vals.forEach((v, i) => i ? ctx.lineTo(xOf(i), yOf(v)) : ctx.moveTo(xOf(i), yOf(v)));
    ctx.stroke();

    const hi = hoverIdx >= 0 ? hoverIdx : vals.length - 1;
    const hx = xOf(hi), hy = yOf(vals[hi]);
    ctx.strokeStyle = 'rgba(20,23,29,0.22)';
    ctx.beginPath(); ctx.moveTo(hx, pad.t); ctx.lineTo(hx, H - pad.b); ctx.stroke();
    ctx.beginPath(); ctx.arc(hx, hy, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#1A4B8C'; ctx.fill(); ctx.strokeStyle = '#FFFDF9'; ctx.lineWidth = 2; ctx.stroke();

    if (hoverIdx >= 0) {
      $('dfbEqReadout').textContent = `Точка #${hi + 1}: капитал ${fmt(vals[hi])} (${fmtSigned(vals[hi] - base)} · S&P 500: ${fmt(sp[hi])})`;
    }
  }

  function renderMarket() {
    const list = ASSETS.filter(a => a.cat === state.mktCat);
    if (!list.find(a => a.sym === state.sym)) state.sym = list[0].sym;
    $('dfbWatchList').innerHTML = list.map(a => `
      <button type="button" class="dfb-wrow ${a.sym === state.sym ? 'is-on' : ''}" data-sym="${a.sym}">
        <div><strong>${a.sym}</strong><small>${a.name}</small></div>
        <div class="num" style="text-align:right">
          <strong>${a.price < 10 ? a.price.toFixed(4) : fmt(a.price, a.price < 500 ? 2 : 0)}</strong>
          <small class="${a.chg >= 0 ? 'dfb-up' : 'dfb-down'}">${a.chg >= 0 ? '+' : ''}${a.chg.toFixed(2)}%</small>
        </div>
      </button>
    `).join('');

    const cur = ASSETS.find(a => a.sym === state.sym);
    $('dfbSymCode').textContent = cur.sym + (cur.cat === 'crypto' ? ' / USDT' : '');
    $('dfbSymName').textContent = cur.name;
    $('dfbSymSrc').textContent = cur.src;
    $('dfbSymPrice').textContent = cur.price < 10 ? cur.price.toFixed(4) : fmt(cur.price, 2);
    $('dfbSymChg').textContent = (cur.chg >= 0 ? '+' : '') + cur.chg.toFixed(2) + '%';
    $('dfbSymChg').className = 'num ' + (cur.chg >= 0 ? 'dfb-up' : 'dfb-down');

    const last = state.candles[cur.sym][state.candles[cur.sym].length - 1];
    $('dfbOhlc').textContent = `O ${last.o.toFixed(2)} · H ${last.h.toFixed(2)} · L ${last.l.toFixed(2)} · C ${last.c.toFixed(2)}`;
    updateOrderTicket();
    renderPositions();
    drawMarketChart();
  }

  function updateOrderTicket() {
    const cur = ASSETS.find(a => a.sym === state.sym);
    const margin = Math.max(0, parseFloat($('dfbOrderAmt').value) || 0);
    const vol = margin * state.orderLev;
    const fee = vol * 0.001;
    const liq = state.orderSide === 1 ? cur.price * (1 - 0.92 / state.orderLev) : cur.price * (1 + 0.92 / state.orderLev);
    $('dfbOrderMeta').innerHTML = `
      <div><dt>Объём сделки</dt><dd>${fmt(vol, 2)}</dd></div>
      <div><dt>Комиссия (0.1%)</dt><dd>${fmt(fee, 2)}</dd></div>
      <div><dt>Ликвидация</dt><dd class="dfb-down">${state.orderLev === 1 ? 'Нет (×1)' : fmt(liq, cur.price < 10 ? 4 : 2)}</dd></div>
    `;
    const btn = $('dfbPlaceOrder');
    btn.className = 'dfb-btn-trade ' + (state.orderSide === 1 ? 'buy' : 'sell');
    btn.textContent = (state.orderSide === 1 ? 'Открыть Лонг ' : 'Открыть Шорт ') + cur.sym;
  }

  function renderPositions() {
    $('dfbPosCnt').textContent = `${state.positions.length} позиции`;
    $('dfbPosList').innerHTML = state.positions.map(p => {
      const a = ASSETS.find(x => x.sym === p.sym);
      const pnl = p.margin * p.lev * p.side * ((a.price - p.entry) / p.entry);
      const roi = (pnl / p.margin) * 100;
      return `
        <div class="dfb-pos-row">
          <div><strong class="num">${p.sym} · ${p.side === 1 ? 'ЛОНГ' : 'ШОРТ'} ×${p.lev}</strong><small class="num">Вход ${fmt(p.entry, 2)} → ${fmt(a.price, 2)}</small></div>
          <div class="num"><small>Залог</small><b>${fmt(p.margin)}</b></div>
          <div class="num ${pnl >= 0 ? 'dfb-up' : 'dfb-down'}"><small>Результат</small><b>${fmtSigned(pnl, 2)} (${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%)</b></div>
          <button type="button" class="dfb-btn-line xs" data-close-pos="${p.id}">Закрыть</button>
        </div>
      `;
    }).join('') || '<p class="dfb-fine">Открытых позиций пока нет.</p>';
  }

  function drawMarketChart() {
    const cv = $('dfbMarketCanvas');
    if (!cv || cv.offsetParent === null) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = cv.clientWidth, H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);

    const cs = state.candles[state.sym];
    const min = Math.min(...cs.map(c => c.l)) * 0.996, max = Math.max(...cs.map(c => c.h)) * 1.004;
    const pad = { l: 8, r: 64, t: 14, b: 20 };
    const cw = (W - pad.l - pad.r) / cs.length;
    const yOf = v => pad.t + (1 - (v - min) / (max - min || 1)) * (H - pad.t - pad.b);

    ctx.strokeStyle = '#E5DEC9'; ctx.font = '10.5px "IBM Plex Mono", monospace'; ctx.fillStyle = '#7A808D';
    for (let g = 0; g <= 4; g++) {
      const y = pad.t + (g / 4) * (H - pad.t - pad.b);
      const v = max - (g / 4) * (max - min);
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
      ctx.fillText(v < 10 ? v.toFixed(3) : Math.round(v).toString(), W - pad.r + 8, y + 4);
    }

    if (state.chartStyle === 'line') {
      ctx.beginPath();
      cs.forEach((c, i) => {
        const x = pad.l + i * cw + cw / 2;
        i ? ctx.lineTo(x, yOf(c.c)) : ctx.moveTo(x, yOf(c.c));
      });
      ctx.strokeStyle = '#1A4B8C'; ctx.lineWidth = 2; ctx.stroke();
    } else {
      cs.forEach((c, i) => {
        const x = pad.l + i * cw + cw / 2;
        const col = c.c >= c.o ? '#126B48' : '#8C2338';
        ctx.strokeStyle = col; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(x, yOf(c.h)); ctx.lineTo(x, yOf(c.l)); ctx.stroke();
        const y1 = yOf(Math.max(c.o, c.c)), y2 = yOf(Math.min(c.o, c.c));
        ctx.fillStyle = col;
        ctx.fillRect(x - cw * 0.32, y1, Math.max(3, cw * 0.64), Math.max(2, y2 - y1));
      });
    }
    const openP = state.positions.find(p => p.sym === state.sym);
    if (openP && openP.entry >= min && openP.entry <= max) {
      const ey = yOf(openP.entry);
      ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = '#1A4B8C';
      ctx.beginPath(); ctx.moveTo(pad.l, ey); ctx.lineTo(W - pad.r, ey); ctx.stroke();
      ctx.fillStyle = '#1A4B8C'; ctx.fillRect(W - pad.r + 2, ey - 9, 58, 18);
      ctx.fillStyle = '#FFF'; ctx.fillText('ВХОД', W - pad.r + 12, ey + 4);
      ctx.restore();
    }
  }

  function renderBets() {
    $('dfbSportFilt').hidden = state.betTab !== 'sport';
    const evs = EVENTS.filter(e => e.type === state.betTab && (state.betTab === 'poly' || state.betSport === 'all' || e.sport === state.betSport));
    $('dfbEventsList').innerHTML = evs.map(e => `
      <article class="dfb-ev-row">
        <div><div class="dfb-ev-meta">${e.meta}</div><div class="dfb-ev-title">${e.title}</div></div>
        <div class="dfb-odds-row">
          ${e.outcomes.map((o, i) => `
            <button type="button" class="dfb-odd ${state.slip && state.slip.id === e.id && state.slip.oi === i ? 'is-on' : ''}" data-pick="${e.id}" data-oi="${i}">
              <span>${o.k}</span><b>×${o.o.toFixed(2)}</b>
            </button>
          `).join('')}
        </div>
      </article>
    `).join('');

    $('dfbBetsCnt').textContent = `${state.activeBets.length} в игре`;
    $('dfbActiveBets').innerHTML = state.activeBets.map(b => {
      const pay = Math.round(b.stake * b.curMult);
      return `
        <div class="dfb-pos-row">
          <div><strong>${b.event}</strong><small>${b.outcome} · ×${b.odds.toFixed(2)}</small></div>
          <div class="num"><small>Ставка</small><b>${fmt(b.stake)}</b></div>
          <div class="num dfb-up"><small>Cashout</small><b>${fmt(pay)}</b></div>
          <button type="button" class="dfb-btn-line xs" data-cashout="${b.id}">Продать</button>
        </div>
      `;
    }).join('');
    renderSlip();
  }

  function renderSlip() {
    $('dfbSlipEmpty').hidden = !!state.slip;
    $('dfbSlipForm').hidden = !state.slip;
    if (!state.slip) return;
    $('dfbSlipEv').textContent = state.slip.title;
    $('dfbSlipOut').textContent = state.slip.outcome;
    $('dfbSlipOdds').textContent = '×' + state.slip.odds.toFixed(2);
    const amt = Math.max(0, parseFloat($('dfbSlipAmt').value) || 0);
    $('dfbSlipPay').textContent = fmt(amt * state.slip.odds, 2);
  }

  function renderLoans() {
    const amt = Math.max(0, parseFloat($('dfbChAmt').value) || 0);
    const rate = parseInt($('dfbRateInp').value, 10) || 0;
    const note = $('dfbChNote').value.trim() || 'Банковский чек DOFA';
    $('dfbRateWrap').hidden = state.chequeType !== 'lend';
    $('dfbRateVal').textContent = rate + '%';
    const repay = Math.round(amt * (1 + rate / 100));
    $('dfbRateCalc').textContent = `К возврату через 30 дней: ${fmt(repay)}`;

    const kinds = {
      transfer: 'ПЕРСОНАЛЬНЫЙ ПЕРЕВОД · +$100 000 НОВИЧКУ',
      lend: `ПРЕДЛОЖЕНИЕ ЗАЙМА ПОД ${rate}% · 30 ДНЕЙ`,
      borrow: 'ЗАПРОС ЗАЙМА У ДРУГА · СТАВКУ ЗАДАЁТ КРЕДИТОР'
    };
    $('dfbPchKind').textContent = kinds[state.chequeType];
    $('dfbPchAmt').textContent = fmt(amt, 2);
    $('dfbPchNote').textContent = `«${note}»`;
    $('dfbPchTerms').textContent = state.chequeType === 'lend' ? `${rate}% · ${fmt(repay)}` : '0% · 7 дней';

    $('dfbOwedTot').textContent = fmt(state.owedToMe.reduce((s, l) => s + (l.total - l.paid), 0));
    $('dfbOweTot').textContent = fmt(state.iOwe.reduce((s, l) => s + (l.total - l.paid), 0));

    $('dfbOwedList').innerHTML = state.owedToMe.map(l => `
      <div class="dfb-loan-card">
        <div class="dfb-loan-top"><strong class="num">${l.who}</strong><strong class="num dfb-up">${fmt(l.total - l.paid)}</strong></div>
        <div class="dfb-loan-meta num"><span>Тело ${fmt(l.principal)}</span><span>${l.rate}%</span><span>Осталось ${l.daysLeft} дн.</span></div>
        <div class="dfb-loan-bar"><i style="width:${Math.round(l.paid / l.total * 100)}%"></i></div>
        <div class="dfb-loan-btns">
          <button type="button" class="dfb-btn-line xs" data-remind="${l.who}">Напомнить в TG</button>
          <button type="button" class="dfb-btn-line xs" data-forgive="${l.id}">Простить</button>
        </div>
      </div>
    `).join('') || '<p class="dfb-fine">Выданных займов нет.</p>';

    $('dfbOweList').innerHTML = state.iOwe.map(l => `
      <div class="dfb-loan-card">
        <div class="dfb-loan-top"><strong class="num">${l.who}</strong><strong class="num dfb-down">${fmt(l.total - l.paid)}</strong></div>
        <div class="dfb-loan-meta num"><span>Тело ${fmt(l.principal)}</span><span>${l.rate}%</span><span>Срок: ${l.daysLeft} дн.</span></div>
        <div class="dfb-loan-bar"><i style="width:${Math.round(l.paid / l.total * 100)}%"></i></div>
        <div class="dfb-loan-btns">
          <button type="button" class="dfb-btn-cobalt xs" data-repay="${l.id}">Погасить всё</button>
          <button type="button" class="dfb-btn-line xs" data-repay-part="${l.id}">Вернуть 50%</button>
        </div>
      </div>
    `).join('') || '<p class="dfb-fine">Долгов нет — безупречная репутация.</p>';

    $('dfbChList').innerHTML = state.cheques.map(c => `
      <div class="dfb-loan-card">
        <div class="dfb-loan-top"><strong>${c.kind}</strong><strong class="num dfb-cobalt">${fmt(c.amt)}</strong></div>
        <div class="dfb-loan-meta"><span>${c.note}</span><span class="num">${c.link}</span></div>
        <div class="dfb-loan-btns">
          <button type="button" class="dfb-btn-line xs" data-copy-link="${c.link}">Копировать</button>
          <button type="button" class="dfb-btn-line xs" data-cancel-ch="${c.id}">Отменить</button>
        </div>
      </div>
    `).join('') || '<p class="dfb-fine">Открытых чеков нет.</p>';

    $('dfbFriendsBody').innerHTML = state.friends.map(f => `
      <tr><td class="num"><b>${f.name}</b></td><td>${f.status}</td><td class="r num">${f.quests}</td><td class="r num dfb-cobalt">${f.bonus}</td></tr>
    `).join('');
  }

  function updateVanity() {
    const v = ($('dfbVanityInp').value || '').toLowerCase().replace(/[^a-z0-9_]/g, '');
    const out = $('dfbVanityRes');
    if (v.length < 3) { out.textContent = 'Минимум 3 латинских символа'; return; }
    if (['admin', 'bank', 'dofamart'].includes(v)) { out.textContent = 'Зарезервировано'; return; }
    const stars = v.length === 3 ? '9 500 ★' : v.length === 4 ? '4 200 ★' : v.length <= 6 ? '1 900 ★' : '750 ★';
    out.textContent = `@${v} свободно · ${stars}`;
  }

  function renderBank() {
    $('dfbRanksList').innerHTML = RANKS.map(r => `
      <div class="dfb-rank ${r.lvl === 5 ? 'is-cur' : ''}">
        <div><strong class="num">${r.lvl}. ${r.name}</strong><small>${r.req}</small></div>
        <span class="num ${r.lvl <= 5 ? 'dfb-cobalt' : ''}">${r.lvl < 5 ? '✓' : r.lvl === 5 ? 'ТЕКУЩИЙ' : '🔒'}</span>
      </div>
    `).join('');
  }

  function go(view) {
    if (!['stat', 'market', 'bets', 'loans', 'bank'].includes(view)) view = 'stat';
    state.view = view;
    document.querySelectorAll('.dfb-view').forEach(s => { s.hidden = s.id !== 'view-' + view; });
    document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('is-active', a.dataset.nav === view));
    renderHeaderNums();
    if (view === 'stat') renderStat();
    if (view === 'market') renderMarket();
    if (view === 'bets') renderBets();
    if (view === 'loans') { renderLoans(); updateVanity(); }
    if (view === 'bank') renderBank();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  document.addEventListener('click', e => {
    const nav = e.target.closest('[data-nav]');
    if (nav) { e.preventDefault(); location.hash = nav.dataset.nav; go(nav.dataset.nav); return; }

    const per = e.target.closest('#dfbPeriodSeg button');
    if (per) { state.period = per.dataset.per; document.querySelectorAll('#dfbPeriodSeg button').forEach(b => b.classList.toggle('is-on', b === per)); renderStat(); return; }

    const bench = e.target.closest('[data-bench]');
    if (bench) {
      if (bench.dataset.bench === 'sp500') state.benchSp = !state.benchSp;
      if (bench.dataset.bench === 'cash') state.benchCash = !state.benchCash;
      bench.classList.toggle('is-on'); drawEquityChart(); return;
    }

    const hm = e.target.closest('#dfbHmSeg button');
    if (hm) { state.hmMode = hm.dataset.hm; document.querySelectorAll('#dfbHmSeg button').forEach(b => b.classList.toggle('is-on', b === hm)); renderHeatmap(); return; }

    const ff = e.target.closest('#dfbFeedFilt button');
    if (ff) { state.feedFilter = ff.dataset.f; document.querySelectorAll('#dfbFeedFilt button').forEach(b => b.classList.toggle('is-on', b === ff)); renderFeed(); return; }

    const mc = e.target.closest('#dfbMktCats button');
    if (mc) { state.mktCat = mc.dataset.cat; document.querySelectorAll('#dfbMktCats button').forEach(b => b.classList.toggle('is-on', b === mc)); renderMarket(); return; }

    const sym = e.target.closest('[data-sym]');
    if (sym) { state.sym = sym.dataset.sym; renderMarket(); return; }

    const tf = e.target.closest('#dfbTfSeg button');
    if (tf) { state.tf = tf.dataset.tf; document.querySelectorAll('#dfbTfSeg button').forEach(b => b.classList.toggle('is-on', b === tf)); drawMarketChart(); return; }

    const cs = e.target.closest('#dfbCsSeg button');
    if (cs) { state.chartStyle = cs.dataset.cs; document.querySelectorAll('#dfbCsSeg button').forEach(b => b.classList.toggle('is-on', b === cs)); drawMarketChart(); return; }

    const side = e.target.closest('#dfbSideSeg button');
    if (side) { state.orderSide = parseInt(side.dataset.side, 10); document.querySelectorAll('#dfbSideSeg button').forEach(b => b.classList.toggle('is-on', b === side)); updateOrderTicket(); return; }

    const pct = e.target.closest('#dfbOrderPct button');
    if (pct) { $('dfbOrderAmt').value = Math.max(50, Math.floor(state.cash * parseFloat(pct.dataset.pct))); updateOrderTicket(); return; }

    const lev = e.target.closest('#dfbLevSeg button');
    if (lev) { state.orderLev = parseInt(lev.dataset.lev, 10); document.querySelectorAll('#dfbLevSeg button').forEach(b => b.classList.toggle('is-on', b === lev)); updateOrderTicket(); return; }

    if (e.target.id === 'dfbPlaceOrder') {
      const m = parseFloat($('dfbOrderAmt').value) || 0;
      const cur = ASSETS.find(a => a.sym === state.sym);
      const fee = m * state.orderLev * 0.001;
      if (m < 50 || m + fee > state.cash) { toast('Недостаточно свободных средств'); return; }
      state.cash -= (m + fee); state.fees += fee;
      state.positions.unshift({ id: Date.now(), sym: cur.sym, side: state.orderSide, lev: state.orderLev, margin: m, entry: cur.price });
      state.feed.unshift({ type: 'trade', time: 'Сейчас', text: `Открыта ${cur.sym} ${state.orderSide === 1 ? 'Лонг' : 'Шорт'} ×${state.orderLev}`, amt: fmt(-m), cls: 'dfb-cobalt' });
      renderHeaderNums(); renderMarket(); toast(`Сделка ${cur.sym} ×${state.orderLev} открыта`); return;
    }

    const cp = e.target.closest('[data-close-pos]');
    if (cp) {
      const idx = state.positions.findIndex(p => String(p.id) === cp.dataset.closePos);
      if (idx >= 0) {
        const p = state.positions.splice(idx, 1)[0];
        const a = ASSETS.find(x => x.sym === p.sym);
        const pnl = p.margin * p.lev * p.side * ((a.price - p.entry) / p.entry);
        state.cash += Math.max(0, p.margin + pnl); state.realizedTrade += pnl;
        renderHeaderNums(); renderMarket(); toast(`Позиция ${p.sym} закрыта: ${fmtSigned(pnl, 2)}`);
      }
      return;
    }

    const bt = e.target.closest('#dfbBetTab button');
    if (bt) { state.betTab = bt.dataset.bt; document.querySelectorAll('#dfbBetTab button').forEach(b => b.classList.toggle('is-on', b === bt)); renderBets(); return; }

    const sp = e.target.closest('#dfbSportFilt button');
    if (sp) { state.betSport = sp.dataset.sp; document.querySelectorAll('#dfbSportFilt button').forEach(b => b.classList.toggle('is-on', b === sp)); renderBets(); return; }

    const pk = e.target.closest('[data-pick]');
    if (pk) {
      const ev = EVENTS.find(x => x.id === pk.dataset.pick);
      const oi = parseInt(pk.dataset.oi, 10);
      state.slip = { id: ev.id, oi, title: ev.title, outcome: ev.outcomes[oi].k, odds: ev.outcomes[oi].o };
      renderBets(); return;
    }

    const sa = e.target.closest('#dfbSlipPre button');
    if (sa) { $('dfbSlipAmt').value = sa.dataset.sa === 'max' ? Math.floor(state.cash * 0.1) : sa.dataset.sa; renderSlip(); return; }

    if (e.target.id === 'dfbConfirmBet' && state.slip) {
      const stake = parseFloat($('dfbSlipAmt').value) || 0;
      if (stake < 10 || stake > state.cash) { toast('Проверьте сумму прогноза'); return; }
      state.cash -= stake;
      state.activeBets.unshift({ id: 'b' + Date.now(), event: state.slip.title, outcome: state.slip.outcome, odds: state.slip.odds, stake, curMult: 1.0 });
      state.slip = null; renderHeaderNums(); renderBets(); toast('Прогноз размещён'); return;
    }

    const co = e.target.closest('[data-cashout]');
    if (co) {
      const idx = state.activeBets.findIndex(b => b.id === co.dataset.cashout);
      if (idx >= 0) {
        const b = state.activeBets.splice(idx, 1)[0];
        const pay = Math.round(b.stake * b.curMult);
        state.cash += pay; state.realizedBets += (pay - b.stake);
        renderHeaderNums(); renderBets(); toast(`Купон продан за ${fmt(pay)}`);
      }
      return;
    }

    const ct = e.target.closest('#dfbChType button');
    if (ct) { state.chequeType = ct.dataset.ct; document.querySelectorAll('#dfbChType button').forEach(b => b.classList.toggle('is-on', b === ct)); renderLoans(); return; }

    const ca = e.target.closest('#dfbChPre button');
    if (ca) { $('dfbChAmt').value = ca.dataset.ca; document.querySelectorAll('#dfbChPre button').forEach(b => b.classList.toggle('is-on', b === ca)); renderLoans(); return; }

    if (e.target.id === 'dfbMakeCheque') {
      const amt = parseFloat($('dfbChAmt').value) || 0;
      if (amt < 100 || (state.chequeType !== 'borrow' && amt > state.cash)) { toast('Проверьте сумму чека'); return; }
      if (state.chequeType !== 'borrow') state.cash -= amt;
      const code = 'df' + Math.floor(1000 + Math.random() * 9000);
      const kind = state.chequeType === 'transfer' ? 'Подарок другу' : state.chequeType === 'lend' ? `Заём под ${$('dfbRateInp').value}%` : 'Запрос займа';
      state.cheques.unshift({ id: 'c' + Date.now(), kind, amt, note: $('dfbChNote').value || 'Чек DOFA', link: 'open-sites.io/c/' + code });
      renderHeaderNums(); renderLoans(); toast(`Чек open-sites.io/c/${code} создан и скопирован`); return;
    }

    if (e.target.id === 'dfbQuickCopy' || e.target.id === 'dfbCopyInvite') {
      try { navigator.clipboard.writeText('https://open-sites.io/c/id1042'); } catch (_) {}
      toast('Ссылка open-sites.io/c/id1042 скопирована в буфер'); return;
    }
    const copyEl = e.target.closest('[data-copy-link]');
    if (copyEl) {
      try { navigator.clipboard.writeText('https://' + copyEl.dataset.copyLink); } catch (_) {}
      toast('Ссылка ' + copyEl.dataset.copyLink + ' скопирована'); return;
    }
    if (e.target.closest('[data-remind]')) { toast('Напоминание отправлено в Telegram-бот'); return; }

    const forg = e.target.closest('[data-forgive]');
    if (forg) { state.owedToMe = state.owedToMe.filter(l => l.id !== forg.dataset.forgive); renderHeaderNums(); renderLoans(); toast('Остаток долга прощён'); return; }

    const rep = e.target.closest('[data-repay]');
    if (rep) {
      const idx = state.iOwe.findIndex(l => l.id === rep.dataset.repay);
      if (idx >= 0) {
        const left = state.iOwe[idx].total - state.iOwe[idx].paid;
        if (left > state.cash) { toast('Недостаточно свободных средств'); return; }
        state.cash -= left; state.iOwe.splice(idx, 1); renderHeaderNums(); renderLoans(); toast(`Долг ${fmt(left)} погашен`);
      }
      return;
    }

    const repP = e.target.closest('[data-repay-part]');
    if (repP) {
      const l = state.iOwe.find(x => x.id === repP.dataset.repayPart);
      if (l) {
        const part = Math.round((l.total - l.paid) / 2);
        if (part > state.cash) { toast('Недостаточно средств'); return; }
        state.cash -= part; l.paid += part; renderHeaderNums(); renderLoans(); toast(`Частичный платёж ${fmt(part)} внесён`);
      }
      return;
    }

    const can = e.target.closest('[data-cancel-ch]');
    if (can) {
      const idx = state.cheques.findIndex(c => c.id === can.dataset.cancelCh);
      if (idx >= 0) { const c = state.cheques.splice(idx, 1)[0]; state.cash += c.amt; renderHeaderNums(); renderLoans(); toast(`Чек отменён, ${fmt(c.amt)} возвращены`); }
      return;
    }

    const dep = e.target.closest('#dfbDepBtns button');
    if (dep) {
      const add = parseInt(dep.dataset.dep, 10);
      if (add > state.vault) { toast('Резерв исчерпан'); return; }
      state.vault -= add; state.cash += add; state.deposited += add; renderHeaderNums(); toast(`Зачислено ${fmt(add)} из сейфа`); return;
    }

    if (e.target.id === 'dfbModeBtn' || e.target.id === 'dfbDemoRestore') {
      state.demoMode = !state.demoMode;
      $('dfbModeBtn').textContent = state.demoMode ? 'Демо-счёт' : 'Чистый счёт';
      go('stat'); return;
    }

    if (e.target.id === 'dfbPauseBtn' || e.target.id === 'dfbPauseSide') { $('dfbPauseModal').hidden = false; return; }
    if (e.target.id === 'dfbClosePause' || e.target.id === 'dfbEndPause' || e.target.id === 'dfbPauseModal') { $('dfbPauseModal').hidden = true; return; }
  });

  $('dfbOrderAmt').addEventListener('input', updateOrderTicket);
  $('dfbSlipAmt').addEventListener('input', renderSlip);
  $('dfbChAmt').addEventListener('input', renderLoans);
  $('dfbRateInp').addEventListener('input', renderLoans);
  $('dfbChNote').addEventListener('input', renderLoans);
  $('dfbVanityInp').addEventListener('input', updateVanity);

  $('dfbHeatmap').addEventListener('mouseover', e => {
    const c = e.target.closest('i[data-d]');
    if (!c) return;
    $('dfbHmTip').textContent = `${c.dataset.d}, ${c.dataset.h}:00 · сделок: ${c.dataset.act} · итог: ${fmtSigned(parseInt(c.dataset.res, 10))}`;
  });

  $('dfbEquityCanvas').addEventListener('mousemove', e => {
    const r = e.target.getBoundingClientRect();
    const vals = EQ_SERIES[state.period];
    hoverIdx = Math.round(Math.max(0, Math.min(1, (e.clientX - r.left - 10) / (r.width - 68))) * (vals.length - 1));
    drawEquityChart();
  });
  $('dfbEquityCanvas').addEventListener('mouseleave', () => { hoverIdx = -1; drawEquityChart(); });

  let phase = 0;
  setInterval(() => {
    phase = (phase + 1) % 2;
    const el = $('dfbBreathText');
    if (el) el.textContent = phase === 0 ? 'Вдох · 4 сек' : 'Выдох · 4 сек';
  }, 4000);

  setInterval(() => {
    ASSETS.forEach(a => {
      a.price = Math.max(0.01, a.price + (Math.random() - 0.495) * a.price * 0.0018);
      const last = state.candles[a.sym][state.candles[a.sym].length - 1];
      last.c = a.price;
      if (a.price > last.h) last.h = a.price;
      if (a.price < last.l) last.l = a.price;
    });
    renderHeaderNums();
    if (state.view === 'market') renderMarket();
    if (state.view === 'stat' && state.demoMode) drawEquityChart();
  }, 2200);

  window.addEventListener('resize', () => {
    if (state.view === 'stat') drawEquityChart();
    if (state.view === 'market') drawMarketChart();
  });

  window.addEventListener('hashchange', () => {
    const next = (location.hash || '#stat').replace('#', '');
    if (next !== state.view) go(next);
  });

  renderStrip();
  go((location.hash || '#stat').replace('#', ''));
})();
