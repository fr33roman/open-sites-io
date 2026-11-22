// statistika-test.mjs — проверка расчётов раздела «Статистика» без браузера: node tools/statistika-test.mjs
// Заодно отдаёт makeSave() — заполненное подставное сохранение (его же берёт скрипт снимков).
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const req = createRequire(import.meta.url);
const E = req('../sim.js'), G = req('../gorod.js'), ST = req('../statistika.js');
const H = 3600e3, D = 864e5;
const NOW = Date.UTC(2026, 10, 23, 12, 30, 0);

// Заполненное сохранение: 46 сделок за 35 дней, 18 ставок, город из 4 зданий, журнал событий за последние дни.
export function makeSave(now = NOW, withLog = true) {
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const S = E.newState(); S.deposited = 20000; S.cash = 6400; S.vault = 9980000; S.lang = 'ru';
  const syms = ['BTC', 'ETH', 'SOL', 'NVDA', 'AAPL', 'XAU', 'BRENT', 'SPX', 'DOGE', 'TSLA'].filter(s => E.INS[s]);
  const levs = [1, 1, 2, 3, 5, 5, 10, 20].filter(l => E.LEVS.indexOf(l) >= 0);
  let eq = 0; S.curve = [];
  for (let i = 0; i < 46; i++) {
    const t0 = now - (35 * D) + i * (35 * D / 46) + rnd() * 5 * H, hold = (0.2 + rnd() * rnd() * 30) * H, t = Math.min(now - 600e3, t0 + hold);
    const sym = syms[Math.floor(rnd() * syms.length)], side = rnd() < 0.62 ? 1 : -1, lev = levs[Math.floor(rnd() * levs.length)], margin = Math.round(150 + rnd() * 1200);
    const entry = 100 + rnd() * 400, mv = (rnd() - 0.46) * 0.05 / Math.sqrt(1 + 0 * lev) * (hold < H ? 0.5 : 1.4);
    let exit = entry * (1 + mv), pnl = side * margin * lev * mv; let liq = false;
    if (pnl <= -margin) { liq = true; pnl = -margin; exit = entry * (1 - side / lev); }
    const fees = Math.round(margin * lev * 0.002 * 100) / 100, net = Math.round((pnl - fees) * 100) / 100;
    S.trades.unshift({ id: i + 1, sym, side, lev, qty: margin * lev / entry, entry, exit, margin, pnl: Math.round(pnl * 100) / 100, fees, net: liq ? -margin - fees : net, t0, t, liq, imp: rnd() < 0.2 });
    eq += S.trades[0].net; S.curve.push([t, Math.round(eq * 100) / 100]);
  }
  S.trades.sort((a, b) => b.t - a.t); S.curve.sort((a, b) => a[0] - b[0]);
  S.agg.n = 46; S.nextId = 100;
  // ставки: 18 сыгравших (часть старых — без новых полей c / lv / at0) и 2 открытые
  const cats = ['sp_mma', 'crypto', 'politics', 'sp_soc', 'live', 'economy'], qs = ['Fight night: main event', 'Bitcoin above 100k by Friday?', 'Election: who leads on Dec 1?', 'Derby: home win', 'Fed cuts rates in December?', 'Tennis final: favourite wins'];
  S.betHist = []; let paid = 0, staked = 0, won = 0;
  for (let i = 0; i < 18; i++) {
    const a = Math.round(20 + rnd() * 380), p = 0.2 + rnd() * 0.6, how = ['win', 'lose', 'lose', 'sold', 'win', 'void'][Math.floor(rnd() * 6)];
    const pay = how === 'win' ? a / p : how === 'lose' ? 0 : how === 'void' ? a : a * (0.6 + rnd() * 0.9), at = now - (30 - i * 1.6) * D, k = Math.floor(rnd() * cats.length), isNew = i > 5;
    const x = { q: qs[k], o: k % 2 ? 'Yes' : 'No', p, a, pay: Math.round(pay * 100) / 100, how, at }; if (isNew) { x.c = cats[k]; x.lv = cats[k] === 'live' ? 1 : 0; x.at0 = at - 3 * H; }
    S.betHist.unshift(x); staked += a; paid += x.pay; if (x.pay > a) won++;
  }
  S.bets = [{ id: 90, mk: 1, q: 'Next champion', o: 'Team A', oi: 0, p: 0.35, cur: 0.4, a: 250, at: now - 2 * D, end: now + 3 * D, c: 'sp_soc', lv: 0 }, { id: 91, mk: 2, q: 'Live: first goal before 30 min', o: 'Yes', oi: 0, p: 0.5, cur: 0.5, a: 100, at: now - 3 * H, end: now + H, c: 'live', lv: 1 }];
  S.betAgg = { n: 20, won, staked: Math.round((staked + 350) * 100) / 100, paid: Math.round(paid * 100) / 100 };
  const e0 = E.INS[syms[0]].base, e3 = E.INS[syms[3]].base;   // входы считаем от базовых цен рынка, чтобы открытые сделки не давали выдуманных миллионов
  S.positions = [{ id: 120, sym: syms[0], side: 1, lev: 2, qty: 1800 * 2 / e0, entry: e0 * 0.99, margin: 1800, fee: 3.6, t: now - 5 * H, tl: now - 5 * H, imp: false }, { id: 121, sym: syms[3], side: -1, lev: 5, qty: 700 * 5 / e3, entry: e3 * 1.01, margin: 700, fee: 7, t: now - D, tl: now - D, imp: false }];
  // город
  S.cash = 1e7; const buy = (id, lvl) => G.buy(S, id, lvl, now - 6 * D);
  buy('kiosk', 6); buy('exch', 6); buy('vend', 6); buy('dc', 6);
  G.collect(S, 0, now - 2 * H); G.upgrade(S, 1, () => true, now - D);
  S.cash = 6400; S.city['in'] = 5200;
  S.gift = 0;
  if (withLog) {
    const L = (t, k, o) => E.lg(S, t, k, o);
    L(now - 9 * D, 'd', { a: 5000 }); L(now - 8 * D, 'gb', { a: 500, b: 'kiosk', l: 1 }); L(now - 6 * D, 'gb', { a: 2000, b: 'exch', l: 1 }); L(now - 5 * D, 'gc', { a: 340 }); L(now - 4 * D, 'gu', { a: 400, b: 'kiosk', l: 2 });
    S.trades.slice(0, 8).reverse().forEach(x => { L(x.t0, 'o', { s: x.sym, d: x.side, l: x.lev, a: x.margin, f: 1 }); L(x.t, 'c', { s: x.sym, d: x.side, l: x.lev, a: x.margin, n: x.net, x: x.liq ? 1 : 0 }); });
    L(now - 2 * D, 'b', { a: 250, p: 0.35, c: 'sp_soc', lv: 0, q: 'Next champion' }); L(now - 3 * H, 'b', { a: 100, p: 0.5, c: 'live', lv: 1, q: 'Live: first goal before 30 min' }); L(now - 2 * H, 'gc', { a: 120 });
  }
  return S;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('ПРОВАЛ: ' + m); } else console.log('ok: ' + m); };
  const ctx = { INS: E.INS, G, result: 1234 };
  const S = makeSave();
  const t0 = process.hrtime.bigint(); const d = ST.calc(S, NOW, 'all', ctx); const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  ok(d.trade.n === 46 && d.trade.w + d.trade.l <= 46, 'торговля: 46 сделок, прибыльных ' + d.trade.w + ', убыточных ' + d.trade.l);
  ok(Math.abs(d.trade.net - S.trades.reduce((s, x) => s + x.net, 0)) < 0.01, 'результат торговли равен сумме сделок: ' + d.trade.net);
  ok(d.inv.pos === 2500 && d.inv.bets === 350 && d.inv.city === S.city.out, 'вложено: сделки 2500, ставки 350, город ' + d.inv.city);
  ok(Object.values(d.trade.byLev).reduce((s, g) => s + g.n, 0) === 46 && Object.values(d.trade.byCat).reduce((s, g) => s + g.n, 0) === 46, 'разбивки по плечу и видам дают в сумме 46');
  ok(d.trade.topInv.length <= 10 && d.trade.topInv.length > 3, 'топ активов не длиннее 10: ' + d.trade.topInv.length);
  ok(d.bets.n === 18 && d.bets.openN === 2 && d.bets.openSum === 350 && d.bets.w + d.bets.l + d.bets.v === 18, 'ставки: сыграно 18, открыто 2 на 350, выиграно ' + d.bets.w);
  ok(d.bets.bestRun >= d.bets.curRun && d.bets.bestRun >= 1, 'серии побед: лучшая ' + d.bets.bestRun + ', сейчас ' + d.bets.curRun);
  ok(d.bets.byC['?'] && d.bets.byC['?'].n >= 5, 'старые ставки без темы собраны в одну строку «без темы»: ' + (d.bets.byC['?'] || {}).n);
  ok(d.city.n === 4 && d.city.dist === 0 && d.city.rate > 0 && d.city.top.length > 0 && d.city.payback != null, 'город: 4 здания, доход в час ' + d.city.rate + ', окупаемость ' + (d.city.payback && d.city.payback.toFixed(1)) + ' ч');
  ok(d.curve.length > 10 && d.curve[d.curve.length - 1][1] === 1234, 'кривая: ' + d.curve.length + ' точек, последняя — итог сейчас');
  ok(ms < 30, 'пересчёт всего раздела за ' + ms.toFixed(1) + ' мс (потолок 30)');
  // периоды
  const dd = ST.calc(S, NOW, 'day', ctx), d7 = ST.calc(S, NOW, '7d', ctx), d30 = ST.calc(S, NOW, '30d', ctx);
  ok(dd.trade.n <= d7.trade.n && d7.trade.n <= d30.trade.n && d30.trade.n <= d.trade.n, 'периоды вложены друг в друга: ' + [dd.trade.n, d7.trade.n, d30.trade.n, d.trade.n].join(' ≤ '));
  ok(d7.trade.n === S.trades.filter(x => x.t >= NOW - 7 * D).length, 'за 7 дней считаются сделки по времени закрытия');
  ok(d7.res.city === 120 + 340 + 0 || d7.res.city >= 120, 'доход города за 7 дней — по журналу: ' + d7.res.city + ', за всё время — точная сумма ' + d.res.city);
  // лента
  const f = ST.feed(S, NOW, 'all', 'all', ctx), ft = ST.feed(S, NOW, 'all', 'trade', ctx), fc = ST.feed(S, NOW, 'all', 'city', ctx);
  ok(f.length > 60 && f.every((e, i) => !i || f[i - 1].t >= e.t), 'лента по убыванию времени, записей ' + f.length);
  ok(ft.every(e => e.k === 'o' || e.k === 'c') && fc.every(e => /^g/.test(e.k)) && fc.length >= 4, 'фильтры: сделки и город (' + fc.length + ' событий города)');
  ok(f.some(e => e.old) && f.some(e => !e.old), 'старые сделки и ставки восстановлены в ленту рядом с журналом');
  // «почему»
  const w = S.trades.map(ST.whyTrade);
  ok(w.every(x => ['win', 'lose', 'fee', 'liq', 'flat'].indexOf(x.code) >= 0), 'у каждой сделки есть причина');
  ok(w.filter(x => x.code === 'liq').length === S.trades.filter(x => x.liq).length, 'ликвидации помечены');
  const wb = S.betHist.map(ST.whyBet); ok(wb.every(x => x.code), 'у каждой ставки есть причина: ' + [...new Set(wb.map(x => x.code))].join(','));
  const ins = ST.insights(S, ctx, NOW); ok(ins.length >= 1 && ins.length <= 5, 'выводов по истории: ' + ins.length + ' (' + ins.map(x => x.id).join(', ') + ')');
  // выводы только при ≥ 5 случаев
  const small = E.newState(); small.trades = S.trades.slice(0, 4); ok(ST.insights(small, ctx, NOW).length === 0, 'на 4 сделках выводов нет: мало данных');
  // пустое
  const e0 = E.newState(); const de = ST.calc(e0, NOW, 'all', ctx); ok(de.empty === true && de.trade.n === 0 && de.bets.n === 0, 'пустое сохранение: пустой экран, без ошибок');
  ST.feed(e0, NOW, 'all', 'all', ctx); ST.insights(e0, ctx, NOW);
  // старое сохранение без новых полей
  const old = JSON.parse(JSON.stringify(makeSave(NOW, false))); delete old.log; delete old.stc; old.betHist.forEach(x => { delete x.c; delete x.lv; delete x.at0; }); old.bets.forEach(b => { delete b.c; delete b.lv; });
  let thrown = null; try { ['day', '7d', '30d', 'all'].forEach(p => { ST.calc(old, NOW, p, ctx); ['all', 'trade', 'bet', 'city', 'money'].forEach(k => ST.feed(old, NOW, p, k, ctx)); }); ST.insights(old, ctx, NOW); } catch (e) { thrown = e; }
  ok(!thrown, 'старое сохранение (без журнала и новых полей) считается без ошибок' + (thrown ? ': ' + thrown.message : ''));
  const od = ST.calc(old, NOW, 'all', ctx), of = ST.feed(old, NOW, 'all', 'all', ctx);
  ok(od.trade.n === 46 && of.length > 60 && of.every(e => e.old), 'в старом сохранении лента собрана из сделок и ставок (' + of.length + ')');
  ok(od.res.partial === true || od.res.city === od.city.inAll, 'доход города по старому сохранению: за всё время точный');
  // повреждённое: мусор вместо массивов и чисел
  const junk = E.newState(); junk.trades = [null, { t: 'x', net: 'y' }]; junk.betHist = [null, {}]; junk.bets = [null]; junk.log = [null, { k: 'zz' }]; junk.city = 5; junk.curve = [null, ['a', 'b']];
  thrown = null; try { ST.calc(junk, NOW, 'all', ctx); ST.feed(junk, NOW, 'all', 'all', ctx); } catch (e) { thrown = e; }
  ok(!thrown, 'мусор в сохранении не роняет расчёт' + (thrown ? ': ' + thrown.message : ''));
  // снимок города → события
  const S2 = E.newState(); S2.cash = 1e6; ST.onSave0(S2, E.lg, NOW); ok(!S2.stc, 'без города снимок не пишется');
  G.norm(S2); ST.onSave0(S2, E.lg, NOW); ok(S2.stc && !(S2.log || []).length, 'первый снимок не создаёт событий');
  G.place(S2, 'kiosk', 1, NOW, 10, 8, 0); ST.onSave0(S2, E.lg, NOW + 1); G.upgrade(S2, 1, () => true, NOW + 2); ST.onSave0(S2, E.lg, NOW + 3);
  G.collect(S2, 0, NOW + 5 * H); ST.onSave0(S2, E.lg, NOW + 5 * H); G.openDist(S2, 1, 5); ST.onSave0(S2, E.lg, NOW + 5 * H + 1);
  ok((S2.log || []).map(e => e.k).join() === 'gb,gu,gc,gd', 'журнал города: купил, улучшил, собрал, открыл район → ' + (S2.log || []).map(e => e.k).join());
  ST.onSave0(S2, E.lg, NOW + 6 * H); ok(S2.log.length === 4, 'повторное сохранение без изменений не дублирует события');
  // кольцо журнала
  const S3 = E.newState(); for (let i = 0; i < 620; i++) E.lg(S3, i, 'd', { a: 1 }); ok(S3.log.length === 500 && S3.log[0].t === 120, 'журнал — кольцо до 500 записей');
  // запись событий движком
  const M = E.newMarket(NOW), S4 = E.newState(); S4.cash = 5000; S4.deposited = 5000; S4.vault = 1e6; E.deposit(S4, M, 100); const o = E.open(S4, M, 'BTC', 1, 200, 2); E.close(S4, M, o.pos.id, false);
  ok(S4.log.map(e => e.k).join() === 'd,o,c', 'движок пишет события: пополнение, открытие, закрытие → ' + S4.log.map(e => e.k).join());
  console.log(bad ? 'ПРОВАЛОВ: ' + bad : 'всё зелёное');
  process.exit(bad ? 1 : 0);
}
