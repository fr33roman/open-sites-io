// gorod-test.mjs — проверка расчёта «Города» (большая карта, свободная расстановка): node tools/gorod-test.mjs
import { createRequire } from 'node:module';
const G = createRequire(import.meta.url)('../gorod.js');
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('ПРОВАЛ: ' + m); } else console.log('ok: ' + m); };
const H = 3600e3, T0 = Date.UTC(2026, 10, 18, 12, 0, 0), S = { cash: 1000, city: null };
const c0 = G.norm(S);
ok(G.B.length === 22 && G.CATS.length === 4, 'в таблице 22 типа построек');
ok(G.MAP.W * G.MAP.D >= 5 * 221 * 0.9, 'карта ' + G.MAP.W + '×' + G.MAP.D + ' = ' + G.MAP.W * G.MAP.D + ' клеток: около ×5 от прежних 221');
const at = (id, lvl, x, y, r) => G.place(S, id, lvl, T0, x, y, r);
// --- места на карте ---
ok(G.MAP.T[7 * 36 + 5] === 1 && G.MAP.T[28 * 36 + 5] === 2, 'есть дорога (z=7) и вода (z=28)');
ok(G.place(S, 'dc', 1, T0, 2, 9, 0).err === 'level', 'здание уровня 3 закрыто игроку уровня 1');
S.cash = 100; ok(G.place(S, 'kiosk', 1, T0, 2, 8, 0).err === 'funds' && S.cash === 100, 'нехватка денег: отказ, деньги целы');
S.cash = 1000;
ok(G.place(S, 'kiosk', 1, T0, 2, 10, 0).err === 'road', 'киоск вдали от дороги не ставится (правило «у дороги»)');
ok(G.place(S, 'kiosk', 1, T0, 11, 10, 0).err === 'blocked', 'на дорогу ставить нельзя');
ok(G.place(S, 'kiosk', 1, T0, 40, 10, 0).err === 'bounds', 'за краем карты нельзя');
ok(G.place(S, 'kiosk', 1, T0, 2, 2, 0).err === 'closed', 'в закрытом районе нельзя');
let r = at('kiosk', 1, 2, 8, 0);
ok(r.ok && S.cash === 500 && S.city.out === 500 && S.city.p.length === 1, 'киоск у дороги: −$500, учтено в расходах города');
ok(G.place(S, 'kiosk', 4, T0, 2, 8, 0).err === 'taken', 'на занятые клетки нельзя');
// предел числа: на уровне 1 — одна штука; растёт с уровнем игрока
S.cash = 1e6; ok(G.place(S, 'kiosk', 1, T0, 3, 8, 0).err === 'limit', 'предел числа на уровне 1: один киоск');
ok(G.place(S, 'kiosk', 2, T0, 3, 8, 0).ok && G.place(S, 'kiosk', 3, T0, 4, 8, 0).ok && G.place(S, 'kiosk', 4, T0, 5, 8, 0).ok && G.place(S, 'kiosk', 10, T0, 6, 8, 0).err === 'limit', 'предел растёт с уровнем игрока, потолок 4 штуки');
// особые места
S.cash = 1e9; ok(G.place(S, 'hall', 4, T0, 2, 9, 0).err === 'plaza', 'биржевой зал — только на площади');
ok(G.place(S, 'hall', 4, T0, 12, 8, 0).ok, 'биржевой зал на площади поставлен');
ok(G.place(S, 'obs', 10, T0, 12, 11, 0).err === 'hill', 'обсерватория не на площади');
ok(G.place(S, 'obs', 10, T0, 28, 1, 0).err === 'closed', 'обсерватория на холме, но район закрыт');
ok(G.openDist(S, 4, 5).err === 'level' && G.openDist(S, 4, 6).ok && S.city.d.indexOf(4) >= 0, 'район «Холм» открывается за уровень 6 и деньги');
ok(G.openDist(S, 4, 6).err === 'open', 'второй раз район не открыть');
ok(G.place(S, 'obs', 10, T0, 28, 1, 0).ok, 'обсерватория на холме (3×3) поставлена');
ok(G.place(S, 'park', 10, T0, 16, 12, 0).ok, 'парк можно поставить на площади');
ok(G.openDist(S, 3, 5).ok, 'район «Набережная» открыт');
ok(G.place(S, 'port', 5, T0, 5, 25, 0).ok, 'порт 3×2 у воды поставлен');
ok(G.place(S, 'port', 6, T0, 5, 9, 0).err === 'water', 'порт вдали от воды нельзя');
ok(G.place(S, 'park', 10, T0, 8, 10, 0).ok, 'парк дороги не требует (1×1 в глубине квартала)');
// поворот: 3×2 → 2×3
const S5 = { cash: 1e9, city: null }; G.norm(S5);
ok(G.place(S5, 'bank', 5, T0, 7, 8, 0).ok, 'банк 3×2 лёг поперёк');
ok(G.place(S5, 'fund', 7, T0, 12, 13, 1).err !== undefined, 'поворот учитывается');
ok(G.check(S5.city, G.BY.bank, 0, 12, 1, G.occOf(S5.city, 0)) === '' , 'банк 2×3 в повороте помещается у дороги');
// --- доход, копилка, сбор ---
const K = S.city.p.find(it => it.id === 'kiosk');
ok(G.pend(S.city, K.u, T0) === 0 && G.pend(S.city, K.u, T0 + 2 * H) >= 10, 'копилка киоска растёт со временем');
const S1 = { cash: 1000, city: null }; G.norm(S1); G.place(S1, 'kiosk', 1, T0, 2, 8, 0); const u1 = S1.city.p[0].u;
ok(G.pend(S1.city, u1, T0 + 2 * H) === 10, '2 часа × $5 = $10');
ok(G.pend(S1.city, u1, T0 + 8 * H) === 40 && G.pend(S1.city, u1, T0 + 30 * H) === 40, 'копилка упирается в 8 часов = $40');
ok(G.pend(S1.city, u1, T0 - 5 * H) === 0, 'время назад не даёт отрицательного дохода');
r = G.collect(S1, '', T0 + 10 * H);
ok(r.ok && r.got === 40 && S1.cash === 540 && S1.city.in === 40, 'сбор: +$40 на счёт, учтён отдельно от торговли');
ok(G.collect(S1, '', T0 + 10 * H).err === 'empty', 'повторный сбор в ту же секунду пуст');
// --- улучшение ---
S1.cash = 100000; r = G.upgrade(S1, u1, () => false, T0 + 10 * H); ok(r.ok && r.step === 2 && r.cost === 400, 'ступень 2 стоит $400');
G.upgrade(S1, u1, () => false, T0 + 10 * H); r = G.upgrade(S1, u1, () => false, T0 + 10 * H);
ok(r.err === 'lesson' && S1.city.p[0].l === 3, 'ступень 4 без урока закрыта');
r = G.upgrade(S1, u1, i => i === 0, T0 + 10 * H); ok(r.ok && S1.city.p[0].l === 4, 'ступень 4 после урока открыта');
S1.cash = 1; ok(G.upgrade(S1, u1, () => true, T0 + 10 * H).err === 'funds', 'улучшение без денег отказано');
S1.cash = 1e6; const cc = S1.cash; G.upgrade(S1, u1, () => true, T0 + 12 * H);
ok(S1.city.p[0].l === 5 && S1.cash === cc - G.stepCost('kiosk', 5) + 2 * 24, 'при улучшении накопленное ($48 по ставке ступени 4) уходит в кошелёк');
ok(G.upgrade(S1, u1, () => true, T0 + 12 * H).err === 'max', 'выше 5-й ступени нельзя');
// --- перенос и склад ---
const S6 = { cash: 1e6, city: null }; G.norm(S6);
G.place(S6, 'kiosk', 1, T0, 2, 8, 0); const k6 = S6.city.p[0];
ok(G.move(S6, k6.u, 3, 10, 0, T0).err === 'road', 'перенос на клетку без дороги отказан');
ok(G.move(S6, k6.u, 6, 8, 0, T0 + H).ok && k6.x === 6 && S6.cash === 1e6 - 500, 'перенос на другое место бесплатный');
G.upgrade(S6, k6.u, () => true, T0); const lv = k6.l;
r = G.store(S6, k6.u, T0 + 3 * H);
ok(r.ok && k6.s === 1 && k6.l === lv && r.got > 0, 'склад: здание ушло с поля, ступень сохранена, накопленное забрано');
ok(G.rate(S6.city, k6.u) === 0 && G.pend(S6.city, k6.u, T0 + 99 * H) === 0, 'на складе доход не идёт');
ok(G.cellsUsed(S6.city) === 0, 'клетки освободились');
ok(G.move(S6, k6.u, 7, 8, 1, T0 + 5 * H).ok && k6.s === 0 && k6.l === lv && k6.t === T0 + 5 * H, 'со склада ставится снова, ступень цела, копилка с нуля');
ok(G.buy(S6, 'kiosk', 2, T0).ok && G.placed(S6.city).length === 2, 'покупка без выбора места ставит на первое подходящее (вид «Список»)');
// --- особенности и соседство ---
const S2 = { cash: 1e8, city: null }; G.norm(S2);
G.place(S2, 'kiosk', 10, T0, 2, 8, 0); const kk = S2.city.p[0];
ok(G.capH(S2.city) === 8, 'копилка 8 ч без банка');
G.place(S2, 'bank', 10, T0, 0, 13, 0); ok(G.capH(S2.city) === 12, 'с банком копилка 12 ч');
ok(G.pend(S2.city, kk.u, T0 + 12 * H) === 60, 'с банком киоск копит 12 ч × $5 = $60');
G.place(S2, 'hall', 10, T0, 12, 8, 0); ok(G.rate(S2.city, kk.u) === 5.25, 'биржевой зал: +5 % → $5.25 в час');
const S7 = { cash: 1e8, city: null }; G.norm(S7);
G.place(S7, 'exch', 10, T0, 2, 8, 0); const ex = S7.city.p[0]; const base = G.rate(S7.city, ex.u);
G.place(S7, 'park', 10, T0, 4, 9, 0); const pk = S7.city.p[1];
ok(G.rate(S7.city, ex.u) > base, 'парк рядом: прибавка к доходу обменного пункта (' + base + ' → ' + G.rate(S7.city, ex.u) + ')');
ok(Math.abs(G.rate(S7.city, ex.u) - base * 1.04) < 0.02, 'прибавка сквера на ступени 1 — +4 %');
G.move(S7, pk.u, 12, 9, 0, T0);
ok(G.rate(S7.city, ex.u) === base, 'парк унесли далеко — прибавки нет');
G.move(S7, pk.u, 4, 9, 0, T0); G.upgrade(S7, pk.u, () => true, T0); ok(G.rate(S7.city, ex.u) > base * 1.04 + 0.005, 'ступень парка усиливает прибавку (+4 % × 1,2)');
for (let i = 0; i < 6; i++) G.place(S7, 'home', 10, T0, 0, 8 + 0, 0);                    // много соседей — потолок +50 %
const S8 = { cash: 1e9, city: null }; G.norm(S8); G.place(S8, 'exch', 10, T0, 2, 8, 0); const e8 = S8.city.p[0];
for (let i = 0; i < 12; i++) { const sp = G.findSpot(S8.city, G.BY.park, { x: 3, z: 10 }); if (!sp) break; G.place(S8, 'park', 10, T0, sp.x, sp.y, sp.r); }
ok(G.rate(S8.city, e8.u) <= G.BY.exch.inc[0] * 1.5 + 0.01 && G.nbOf(S8.city, e8) <= G.NB_CAP, 'прибавка соседства не больше +50 % (' + G.rate(S8.city, e8.u) + ' из ' + G.BY.exch.inc[0] + ')');
// маглев — всему району
const S9 = { cash: 1e9, city: null }; G.norm(S9); G.place(S9, 'exch', 10, T0, 2, 8, 0); const e9 = S9.city.p[0], b9 = G.rate(S9.city, e9.u);
ok(G.place(S9, 'maglev', 10, T0, 6, 13, 0).ok && Math.abs(G.rate(S9.city, e9.u) - b9 * 1.1) < 0.02, 'маглев-станция: +10 % всему району');
// окупаемость: 3–6 суток для доходных
const slow = G.B.filter(b => b.inc[0] > 20 && (b.cat === 'inc' || b.cat === 'spec')).map(b => [b.id, +(b.price / b.inc[0] / 24).toFixed(1)]).filter(x => x[1] > 7.5 || x[1] < 2.5);
ok(slow.length === 0, 'окупаемость доходных зданий 2,5–7,5 суток на ступени 1' + (slow.length ? ' (вне: ' + JSON.stringify(slow) + ')' : ''));
// --- старое сохранение переносится ---
const OLD = { cash: 777, city: { b: { kiosk: { l: 3, t: T0 - 5 * H }, hall: { l: 2, t: T0 - 2 * H }, bank: { l: 5, t: T0 }, obs: { l: 4, t: T0 - H }, inst: { l: 1, t: T0 } }, 'in': 123.45, out: 999, streak: 2, last: 4000 } };
const oc = G.norm(OLD);
ok(oc.v === 2 && !oc.b && oc.p.length === 5, 'старое сохранение: 5 зданий перенесены, старый ключ убран');
ok(oc.p.every(it => !it.s), 'все здания старого города сразу стоят на карте');
ok(oc.p.find(it => it.id === 'kiosk').l === 3 && oc.p.find(it => it.id === 'bank').l === 5 && oc.p.find(it => it.id === 'obs').l === 4, 'ступени сохранены');
ok(oc.p.find(it => it.id === 'kiosk').t === T0 - 5 * H && G.pend(oc, oc.p.find(it => it.id === 'kiosk').u, T0) === Math.round(5 * G.rate(oc, oc.p.find(it => it.id === 'kiosk').u) * 100) / 100, 'копилка сохранена: 5 ч × $14');
ok(OLD.cash === 777 && oc['in'] === 123.45 && oc.out === 999 && oc.streak === 2 && oc.last === 4000, 'деньги, счётчики и серия дней не тронуты');
const occ = G.occOf(oc, 0), anyBad = oc.p.some(it => G.check(oc, G.BY[it.id], it.x, it.y, it.r, G.occOf(oc, it.u)) !== '');
ok(!anyBad, 'каждое перенесённое здание стоит на допустимом месте (ничего не наложено)');
ok(oc.d.indexOf(4) >= 0 && G.BY.obs && oc.p.find(it => it.id === 'obs').x >= 28, 'обсерватория старого города стоит на холме, район «Холм» открыт бесплатно');
const again = JSON.stringify(G.norm(OLD)); ok(again === JSON.stringify(oc), 'повторный вход ничего не меняет');
const OLD2 = JSON.parse(JSON.stringify({ cash: 5, city: { b: { kiosk: { l: 1, t: 0 } }, 'in': 0, out: 500, streak: 0, last: -1 } }));
G.norm(OLD2); ok(OLD2.city.p.length === 1 && OLD2.city.v === 2, 'старый город с одним киоском переносится');
// --- серия дней, пустые ---
const S3 = { cash: 1e6, city: null }; G.norm(S3); G.place(S3, 'kiosk', 1, T0, 2, 8, 0);
G.collect(S3, '', T0 + 20 * H); const s1 = S3.city.streak; G.collect(S3, '', T0 + 20 * H + 24 * H); G.collect(S3, '', T0 + 20 * H + 48 * H);
ok(s1 === 1 && S3.city.streak === 3 && G.streakNow(S3.city, T0 + 20 * H + 48 * H) === 3, 'три дня подряд — серия 3');
ok(G.streakNow(S3.city, T0 + 20 * H + 120 * H) === 0, 'пропуск дней — серия сгорает');
const S4 = { cash: 5 }; G.norm(S4); ok(G.owned(S4.city) === 0 && G.rateAll(S4.city) === 0 && S4.city.v === 2, 'игрок без города: всё по нулям');
// --- общий доход расставленного города (потолок ×1,5 к прежнему) ---
const SF = { cash: 1e12, city: null }; G.norm(SF);
['kiosk', 'exch', 'dc', 'hall', 'bank', 'lab', 'fund', 'tower', 'inst', 'obs'].forEach(id => { const b = G.BY[id]; G.norm(SF); [0, 1, 2, 3, 4, 5].forEach(k => { if (SF.city.d.indexOf(k) < 0) SF.city.d.push(k); }); const sp = G.findSpot(SF.city, b); if (sp) { G.place(SF, id, 10, T0, sp.x, sp.y, sp.r); SF.city.p[SF.city.p.length - 1].l = 5; } });
const was = ['kiosk', 'exch', 'dc', 'hall', 'bank', 'lab', 'fund', 'tower', 'inst', 'obs'].reduce((s, id) => s + G.BY[id].inc[4] * 1.05, 0);
const old10 = G.rateAll(SF.city);
ok(SF.city.p.length === 10, 'все десять прежних зданий поставлены на карту');
['vend', 'atm', 'pay', 'broker', 'vc', 'home', 'cowork', 'mall', 'park', 'fountain', 'port', 'maglev'].forEach(id => { for (let n = 0; n < 6; n++) { const sp = G.findSpot(SF.city, G.BY[id]); if (!sp) break; const r0 = G.place(SF, id, 10, T0, sp.x, sp.y, sp.r); if (r0.ok) SF.city.p[SF.city.p.length - 1].l = 5; } });
console.log('  справка: прежний город (10 зданий, ступень 5, без соседства) = $' + Math.round(was) + '/ч; десять зданий на карте = $' + Math.round(old10) + '/ч; весь город ' + SF.city.p.length + ' построек = $' + Math.round(G.rateAll(SF.city)) + '/ч');
ok(old10 <= was * 1.5 + 1, 'десять прежних зданий с соседством дают не больше ×1,5 прежнего дохода (' + (old10 / was).toFixed(2) + '×)');
// --- этап 3 (19.11): прилипание призрака и старое сохранение ---
{ const Sn = { cash: 1e9, city: null }; const cn = G.norm(Sn), b = G.BY.kiosk, o = G.occOf(cn, 0);
  const a1 = G.snapAt(cn, b, 0, o, 5, 10);
  ok(a1 && !G.check(cn, b, a1.x, a1.y, a1.r, o) && Math.abs(a1.y - 10) <= 3, 'прилипание: клик в глубине квартала → ближайшее место у дороги (' + (a1 && a1.x + ',' + a1.y) + ')');
  ok(G.snapAt(cn, b, 0, o, 5, 3) === null, 'прилипание: в закрытом районе подходящего места рядом нет → красный призрак');
  const a2 = G.snapAt(cn, b, 0, o, 5, 8); ok(a2 && a2.x === 5 && a2.y === 8, 'прилипание: клик по подходящей клетке остаётся на ней');
  const r0 = G.place(Sn, 'kiosk', 10, T0, 5, 8, 0); const o2 = G.occOf(Sn.city, 0), a3 = G.snapAt(Sn.city, b, 0, o2, 5, 8);
  ok(r0.ok && a3 && !(a3.x === 5 && a3.y === 8), 'прилипание: занятая клетка → призрак сдвигается на соседнюю свободную');
  const old = { cash: 10, city: { b: { kiosk: { l: 3, t: T0 }, tower: { l: 5, t: T0 } }, 'in': 12, out: 40, streak: 2, last: 5 } }; const co = G.norm(old);
  ok(co.v === 2 && co.p.length === 2 && co.p.every(it => !it.s && it.x >= 0) && co['in'] === 12 && co.out === 40, 'старое сохранение города (по одному зданию каждого вида) открывается: 2 здания расставлены, счета целы'); }
console.log(bad ? 'ИТОГО: провалов ' + bad : 'ИТОГО: всё зелёное'); process.exit(bad ? 1 : 0);
