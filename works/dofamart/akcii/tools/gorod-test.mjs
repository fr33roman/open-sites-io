// gorod-test.mjs — проверка расчёта «Города»: node tools/gorod-test.mjs
import { createRequire } from 'node:module';
const G = createRequire(import.meta.url)('../gorod.js');
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('ПРОВАЛ: ' + m); } else console.log('ok: ' + m); };
const H = 3600e3, T0 = Date.UTC(2026, 10, 18, 12, 0, 0), S = { cash: 1000, city: null };
G.norm(S);
// закрытый уровень и нехватка денег
ok(G.buy(S, 'dc', 1, T0).err === 'level', 'здание уровня 3 закрыто игроку уровня 1');
S.cash = 100; ok(G.buy(S, 'kiosk', 1, T0).err === 'funds' && S.cash === 100, 'нехватка денег: покупка отказана, деньги целы');
S.cash = 1000; let r = G.buy(S, 'kiosk', 1, T0);
ok(r.ok && S.cash === 500 && S.city.out === 500, 'покупка киоска: −$500, учтено в расходах города');
ok(G.buy(S, 'kiosk', 1, T0).err === 'owned', 'второй раз купить нельзя');
// время
ok(G.pend(S.city, 'kiosk', T0) === 0, 'сразу после покупки в копилке 0');
ok(G.pend(S.city, 'kiosk', T0 + 2 * H) === 10, '2 часа × $5 = $10');
ok(G.pend(S.city, 'kiosk', T0 + 8 * H) === 40 && G.pend(S.city, 'kiosk', T0 + 30 * H) === 40, 'копилка упирается в 8 часов = $40');
ok(G.pend(S.city, 'kiosk', T0 - 5 * H) === 0, 'время назад не даёт отрицательного дохода');
// сбор
r = G.collect(S, '', T0 + 10 * H);
ok(r.ok && r.got === 40 && S.cash === 540 && S.city.in === 40, 'сбор: +$40 на счёт, учтён отдельно от торговли');
ok(G.collect(S, '', T0 + 10 * H).err === 'empty', 'повторный сбор в ту же секунду пуст');
// улучшение и урок
S.cash = 100000; r = G.upgrade(S, 'kiosk', () => false, T0 + 10 * H); ok(r.ok && r.step === 2 && r.cost === 400, 'ступень 2 стоит $400');
G.upgrade(S, 'kiosk', () => false, T0 + 10 * H); r = G.upgrade(S, 'kiosk', () => false, T0 + 10 * H);
ok(r.err === 'lesson' && S.city.b.kiosk.l === 3, 'ступень 4 без урока закрыта');
r = G.upgrade(S, 'kiosk', i => i === 0, T0 + 10 * H); ok(r.ok && S.city.b.kiosk.l === 4, 'ступень 4 после урока открыта');
S.cash = 1; ok(G.upgrade(S, 'kiosk', () => true, T0 + 10 * H).err === 'funds', 'улучшение без денег отказано');
// улучшение забирает накопленное по старой ставке
S.cash = 1e6; const c0 = S.cash; G.upgrade(S, 'kiosk', () => true, T0 + 12 * H);
ok(S.city.b.kiosk.l === 5 && S.cash === c0 - G.stepCost('kiosk', 5) + 2 * 24, 'при улучшении накопленное ($48 по ставке ступени 4) уходит в кошелёк');
ok(G.upgrade(S, 'kiosk', () => true, T0 + 12 * H).err === 'max', 'выше 5-й ступени нельзя');
// особенности
const S2 = { cash: 1e7, city: null }; G.norm(S2);
G.buy(S2, 'kiosk', 10, T0); ok(G.capH(S2.city) === 8, 'копилка 8 ч без банка');
G.buy(S2, 'bank', 10, T0); ok(G.capH(S2.city) === 12, 'с банком копилка 12 ч');
ok(G.pend(S2.city, 'kiosk', T0 + 12 * H) === 60, 'с банком киоск копит 12 ч × $5 = $60');
G.buy(S2, 'hall', 10, T0); ok(G.rate(S2.city, 'kiosk') === 5.25, 'биржевой зал: +5 % → $5.25 в час');
// серия дней
const S3 = { cash: 1e6, city: null }; G.norm(S3); G.buy(S3, 'kiosk', 1, T0);
G.collect(S3, '', T0 + 20 * H); const s1 = S3.city.streak; G.collect(S3, '', T0 + 20 * H + 24 * H); G.collect(S3, '', T0 + 20 * H + 48 * H);
ok(s1 === 1 && S3.city.streak === 3 && G.streakNow(S3.city, T0 + 20 * H + 48 * H) === 3, 'три дня подряд — серия 3');
ok(G.streakNow(S3.city, T0 + 20 * H + 120 * H) === 0, 'пропуск дней — серия сгорает');
// старый игрок без города
const S4 = { cash: 5 }; G.norm(S4); ok(G.owned(S4.city) === 0 && G.rateAll(S4.city) === 0, 'игрок без города: всё по нулям');
console.log(bad ? 'ИТОГО: провалов ' + bad : 'ИТОГО: всё зелёное'); process.exit(bad ? 1 : 0);
