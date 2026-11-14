/* dofamart · Акции — интерактивные уроки (14.11). Один движок шагов + таблица данных на урок (LB).
   Песочница на настоящей разметке панели сделки, но со своим учебным состоянием: в сделки, задания, очки и деньги
   игрока она не пишет. Наружу — только api.pass(урок) по окончании практики. Новый урок = новая запись в LB. */
(function () {
'use strict';
const RM = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const H = (ru, en) => ({ ru: ru, en: en });
const TX = {
  ru: { title: 'Попробуйте сами', tag: 'Учебный счёт', intro: 'Короткая практика на учебных деньгах: нужная кнопка подсвечена, остальное затенено. Нажмите сами, потом появится объяснение. Пока практика не пройдена, вопрос закрыт.',
    start: 'Начать практику', again: 'Пройти ещё раз', round: 'Раунд {n} из {m}', step: 'Шаг {n} из {m}', next: 'Дальше', ok: 'Понятно', retry: 'Ещё раз', show: 'Показать, как',
    w1: 'Сейчас нужна подсвеченная кнопка', w2: 'Нажмите на «{x}»', watch: 'Смотрим', exit: 'Закрыть практику', done: 'Практика пройдена', doneNote: 'Теперь ответьте на вопрос ниже: за верный ответ придёт награда.',
    lock: 'Вопрос откроется после практики выше.', pos: 'Позиции', none: 'Позиций нет', last: 'Закрыто', liqd: 'Ликвидирована', liqLine: 'Ликвидация', stopLine: 'Мой стоп', planStop: 'Мой план: терять не больше {x}',
    free: 'Свободно', feeOpen: 'Комиссия за открытие', feeRate: 'Комиссия: 0,1 % при открытии и при закрытии', feeOf: 'позиция', warn: 'При ×{l} позиция закроется сама, если цена уйдёт на {p} % против вас: ниже {a} при покупке или выше {b} при продаже.',
    tabM: 'Рынок', tabC: 'Сравнить', best: 'Лучший', worst: 'Худший', wk: 'за неделю', evt: 'Событие', yes: 'Да', no: 'Нет', pay: 'Выплата', cash: 'На счёте', go: 'Поставить', wait: 'Ждём исхода…', won: 'Сбылось', lost: 'Не сбылось',
    o: 'Открытие', c: 'Закрытие', hi: 'Максимум', lo: 'Минимум', res: 'Результат', all: 'Всё', pick: 'Выбрано', entry: 'Вход', ex: 'Закрыть практику' },
  en: { title: 'Try it yourself', tag: 'Practice account', intro: 'A short practice on practice money: the right button is lit, the rest is dimmed. Press it yourself, then the explanation appears. The question stays closed until you finish.',
    start: 'Start practice', again: 'Practice again', round: 'Round {n} of {m}', step: 'Step {n} of {m}', next: 'Next', ok: 'Got it', retry: 'Try again', show: 'Show me how',
    w1: 'The lit button is needed now', w2: 'Press “{x}”', watch: 'Watching', exit: 'Close practice', done: 'Practice done', doneNote: 'Now answer the question below: a correct answer brings the reward.',
    lock: 'The question opens after the practice above.', pos: 'Positions', none: 'No positions', last: 'Closed', liqd: 'Liquidated', liqLine: 'Liquidation', stopLine: 'My stop', planStop: 'My plan: lose {x} at most',
    free: 'Free', feeOpen: 'Opening fee', feeRate: 'Fee: 0.1% on opening and on closing', feeOf: 'position', warn: 'At ×{l} the position closes by itself if the price moves {p}% against you: below {a} on a buy or above {b} on a sell.',
    tabM: 'Market', tabC: 'Compare', best: 'Best', worst: 'Worst', wk: 'for the week', evt: 'Event', yes: 'Yes', no: 'No', pay: 'Payout', cash: 'Balance', go: 'Place bet', wait: 'Waiting for the result…', won: 'It happened', lost: 'It did not happen',
    o: 'Open', c: 'Close', hi: 'High', lo: 'Low', res: 'Result', all: 'All', pick: 'Selected', entry: 'Entry', ex: 'Close practice' }
};
const AS = { UM: [['УМ', 'Учебная монета'], ['TC', 'Training coin']], UZ: [['УЗ', 'Учебное золото'], ['TG', 'Training gold']], UA: [['УА', 'Учебная акция'], ['TS', 'Training stock']] };
const H0 = [99, 100, 98.6, 99.4, 100.6, 99.6, 100.2, 101, 100.2, 99.4, 100.4, 100.8, 100, 99.6, 100.4, 100];
const CANDLES = [[100, 101, 97, 98], [98, 100, 97, 99], [99, 100, 95, 96], [96, 102, 95, 101], [101, 104, 100, 103], [103, 104, 99, 100], [100, 103, 99, 102], [102, 105, 101, 104], [104, 105, 98, 99], [99, 103, 98, 102], [102, 105, 101, 104], [104, 105, 97, 98]];
const WK = { UM: [100, 96, 90, 82, 74, 66, 58, 50], UZ: [100, 100, 100, 100, 100, 100, 100, 100], UA: [100, 100.8, 101.5, 102, 102.8, 103.2, 103.6, 104] };

/* ---------------- ТАБЛИЦА УРОКОВ (порядок = LESSONS в sim.js) ----------------
   mode: chart | trade | bet. Раунд: init (cash, px, lev, ct, fee, closeFeeOn, view, as), steps, pl (плашки, первая подошедшая w), skip, preAmt.
   Шаг: tg (имя места или список), k (next | watch | пусто = нажать), h (подсказка), run (цена после шага), bad (имя или префикс -> текст),
   tmo/tmoRun/h2 (решение с паузой), set (цены на старте шага).
   Плашка: числа из действия игрока: {m} вложено {sz} позиция {lev} {from} {to} {pct} {pnl} {apnl} {gross} {fo} {fc} {fee} {val} {cash} {eq} {fees} {p0} {p1} */
const LB = [
  /* 1. Цена и график */
  { mode: 'chart', rounds: [{ init: { ct: 'line' }, steps: [
    { tg: 'price', k: 'next', run: [{ to: 101, ms: 900 }], h: H('Это цена одной штуки сейчас', 'This is the price of one unit right now') },
    { tg: 'ct', h: H('Включите свечи', 'Switch to candles') },
    { tg: 'c11', h: H('Коснитесь красной свечи', 'Tap the red candle'), bad: { c: H('Свеча — это столбик на графике. Нужна красная, последняя', 'A candle is a bar on the chart. The red, last one is needed') } },
    { tg: 'c3', h: H('Теперь зелёной', 'Now the green one'), bad: { c: H('Нужна зелёная свеча слева', 'The green candle on the left is needed') } }],
    pl: [{ ru: 'Красная свеча: цена началась с $104 и закончилась на $98, упала на $6. Зелёная: началась с $96, закончилась на $101, выросла на $5.', en: 'The red candle: the price started at $104 and ended at $98, it fell by $6. The green one: started at $96, ended at $101, it rose by $5.' }] }] },
  /* 2. Купить и продать */
  { mode: 'trade', rounds: [
    { t: H('Рост', 'A rise'), steps: [
      { tg: 'pre10', h: H('Берём десятую часть: $100', 'Take a tenth: $100') },
      { tg: 'buy', run: [{ to: 110, ms: 4200 }], h: H('Вы ждёте, что цена вырастет', 'You expect the price to rise'), bad: { sell: H('Сейчас ждём роста: нужна «Купить»', 'We expect a rise now: “Buy” is needed') } },
      { tg: 'posRes', k: 'watch', h: H('Смотрим, как растёт результат', 'Watch the result grow') },
      { tg: 'close', h: H('Закройте: заберите прибыль', 'Close it: take the profit') }],
      pl: [{ ru: 'Вы купили на {m}. Цена выросла на {pct}, с {from} до {to}. Ваши {m} стали {val}: прибыль {pnl}. Закрыть сделку значит забрать результат.', en: 'You bought {m} worth. The price rose {pct}, from {from} to {to}. Your {m} became {val}: profit {pnl}. To close a trade is to take the result.' }] },
    { t: H('Падение', 'A fall'), steps: [
      { tg: 'pre10', h: H('Снова десятая часть: $100', 'A tenth again: $100') },
      { tg: 'sell', run: [{ to: 90, ms: 4200 }], h: H('Вы ждёте, что цена упадёт', 'You expect the price to fall'), bad: { buy: H('Сейчас ждём падения: нужна «Продать»', 'We expect a fall now: “Sell” is needed') } },
      { tg: 'posRes', k: 'watch', h: H('Смотрим, как растёт результат', 'Watch the result grow') },
      { tg: 'close', h: H('Закройте: заберите прибыль', 'Close it: take the profit') }],
      pl: [{ ru: 'Вы продали на {m}. Цена упала на {pct}, с {from} до {to}. На падении вы заработали {pnl}.', en: 'You sold {m} worth. The price fell {pct}, from {from} to {to}. On the fall you earned {pnl}.' }] }] },
  /* 3. Прибыль и убыток (комиссия включена) */
  { mode: 'trade', rounds: [
    { t: H('Прибыль', 'Profit'), init: { fee: 0.001 }, steps: [
      { tg: 'pre50', h: H('Берём половину: $500', 'Take half: $500') },
      { tg: 'lev2', h: H('Плечо ×2: позиция $1 000', 'Leverage ×2: a $1,000 position') },
      { tg: 'fee', k: 'next', h: H('Комиссия — плата за сделку', 'A fee is the price of a trade') },
      { tg: 'buy', run: [{ to: 110, ms: 4000 }], h: H('Открываем на рост', 'Open on a rise'), bad: { sell: H('Сейчас ждём роста: нужна «Купить»', 'We expect a rise now: “Buy” is needed') } },
      { tg: 'posRes', k: 'watch', h: H('Смотрим на результат', 'Watch the result') },
      { tg: 'close', h: H('Закройте и посмотрите', 'Close and look') }],
      pl: [{ ru: 'Вы вложили {m} с плечом ×{lev}, позиция {sz}. Цена выросла на {pct}: {gross}. Комиссия за открытие и закрытие — {fee}. Чистая прибыль {pnl}.', en: 'You put in {m} with ×{lev} leverage, a {sz} position. The price rose {pct}: {gross}. The fee for opening and closing is {fee}. Net profit {pnl}.' }] },
    { t: H('Убыток', 'Loss'), init: { fee: 0.001 }, steps: [
      { tg: 'pre50', h: H('Снова половина: $500', 'Half again: $500') },
      { tg: 'lev2', h: H('Плечо ×2', 'Leverage ×2') },
      { tg: 'buy', run: [{ to: 95, ms: 3000 }], h: H('Теперь цена пойдёт вниз', 'Now the price will go down'), bad: { sell: H('Нужна «Купить», как в прошлый раз', '“Buy” is needed, like last time') } },
      { tg: 'posRes', k: 'watch', h: H('Смотрим на результат', 'Watch the result') },
      { tg: 'close', h: H('Закройте и посмотрите', 'Close and look') }],
      pl: [{ ru: 'Цена упала на {pct}: {gross}. С комиссией {fee} получилось {pnl}. Это убыток: забрали меньше, чем вложили.', en: 'The price fell {pct}: {gross}. With the {fee} fee it came to {pnl}. That is a loss: you took out less than you put in.' }] }] },
  /* 4. Плечо */
  { mode: 'trade', rounds: [
    { t: H('Без плеча', 'No leverage'), steps: [
      { tg: 'pre10', h: H('Десятая часть: $100', 'A tenth: $100') },
      { tg: 'lev1', h: H('Плечо ×1: без множителя', 'Leverage ×1: no multiplier') },
      { tg: 'buy', run: [{ to: 110, ms: 3200 }], h: H('Покупаем', 'Buy') },
      { tg: 'posRes', k: 'watch', h: H('Цена +10 %', 'The price is +10%') },
      { tg: 'close', h: H('Закройте', 'Close it') }] },
    { t: H('С плечом ×5', 'Leverage ×5'), steps: [
      { tg: 'pre10', h: H('Те же $100', 'The same $100') },
      { tg: 'lev5', h: H('×5: $100 работают как $500', '×5: $100 works like $500'), bad: { lev: H('Здесь нужно ×5, чтобы сравнить', '×5 is needed here to compare') } },
      { tg: 'buy', run: [{ to: 110, ms: 3200 }], h: H('Покупаем, цена та же', 'Buy, the same price') },
      { tg: 'posRes', k: 'watch', h: H('Цена та же: +10 %', 'The same price: +10%') },
      { tg: 'close', h: H('Закройте', 'Close it') }],
      pl: [{ ru: 'Одна и та же цена, +10 %. Без плеча вы заработали {p0}, с плечом ×5 — {pnl}. Плечо умножило результат на 5. При падении цены на 10 % оно так же умножило бы убыток: −$50.', en: 'The same price, +10%. Without leverage you earned {p0}, with ×5 leverage — {pnl}. Leverage multiplied the result by 5. If the price fell 10% it would multiply the loss the same way: −$50.' }] }] },
  /* 5. Ликвидация */
  { mode: 'trade', rounds: [
    { t: H('Выйти или ждать', 'Leave or wait'), steps: [
      { tg: 'pre10', h: H('Десятая часть: $100', 'A tenth: $100') },
      { tg: 'lev10', h: H('Плечо ×10: $100 работают как $1 000', 'Leverage ×10: $100 works like $1,000') },
      { tg: 'levWarn', k: 'next', h: H('Ниже $90 позиция закроется сама', 'Below $90 the position closes by itself') },
      { tg: 'buy', run: [{ to: 95, ms: 2400 }], h: H('Открываем на рост', 'Open on a rise'), bad: { sell: H('Здесь нужна «Купить»', '“Buy” is needed here') } },
      { tg: 'close', tmo: 4000, tmoRun: [{ to: 90, ms: 2000 }], h: H('Хотите выйти сейчас или ждать?', 'Leave now or wait?'), h2: H('Цена идёт к красной линии. Можно ещё закрыть', 'The price heads to the red line. You can still close') }],
      pl: [{ w: r => r.liq, ru: 'Цена упала на 10 % — и {m} сгорели. При ×10 хватило падения на 10 %. Закрыть вручную можно было раньше: на $95 вы потеряли бы $50, а не $100.', en: 'The price fell 10% and {m} burned. At ×10 a 10% fall was enough. You could have closed by hand earlier: at $95 you would have lost $50, not $100.' },
        { ru: 'Вы вышли на {to} и потеряли {apnl}, а не все {m}. Плечо ×10: каждые −5 % цены — минус половина залога.', en: 'You left at {to} and lost {apnl}, not all {m}. Leverage ×10: every −5% of price is minus half of the margin.' }] },
    { t: H('До конца', 'To the end'), skip: f => f.liq, steps: [
      { tg: 'pre10', h: H('Десятая часть: $100', 'A tenth: $100') },
      { tg: 'lev10', h: H('Плечо ×10', 'Leverage ×10') },
      { tg: 'buy', run: [{ to: 90, ms: 4200 }], h: H('Откроем и посмотрим до конца', 'Open it and watch to the end'), bad: { sell: H('Здесь нужна «Купить»', '“Buy” is needed here') } },
      { tg: 'price', k: 'watch', h: H('Кнопка «Закрыть» затенена: смотрим', 'The Close button is dimmed: just watch') }],
      pl: [{ ru: 'Цена упала на 10 % — и {m} сгорели. При ×10 хватило падения на 10 %. Закрыть вручную можно было раньше: на $95 вы потеряли бы $50, а не $100.', en: 'The price fell 10% and {m} burned. At ×10 a 10% fall was enough. You could have closed by hand earlier: at $95 you would have lost $50, not $100.' }] }] },
  /* 6. Стоп */
  { mode: 'trade', rounds: [
    { t: H('План на $20', 'A $20 plan'), init: { stop: 20 }, steps: [
      { tg: 'pre10', h: H('Десятая часть: $100', 'A tenth: $100') },
      { tg: 'lev2', h: H('Плечо ×2: позиция $200', 'Leverage ×2: a $200 position') },
      { tg: 'stop', k: 'next', h: H('Решаем заранее: не больше −$20', 'Decide in advance: no more than −$20') },
      { tg: 'buy', run: [{ to: 90, ms: 3600 }], h: H('Открываем на рост', 'Open on a rise'), bad: { sell: H('Здесь нужна «Купить»', '“Buy” is needed here') } },
      { tg: 'posRes', k: 'watch', h: H('Результат ползёт вниз', 'The result creeps down') },
      { tg: 'close', tmo: 4000, tmoRun: [{ to: 80, ms: 3000 }], h: H('Порог достигнут. Выходите', 'The threshold is reached. Leave'), h2: H('Цена идёт дальше вниз. Закройте сейчас', 'The price keeps falling. Close now') }],
      pl: [{ w: r => r.pnl <= -19.99 && r.pnl >= -30, ru: 'Вы решили терять не больше $20 и вышли ровно на пороге. Цена потом упала ещё: до $80. Ждали бы — потеряли $40.', en: 'You decided to lose $20 at most and left exactly at the threshold. The price then fell further, to $80. Had you waited you would have lost $40.' },
        { retry: true, ru: 'План был −$20, вы вышли на {pnl}. Порог нужен, чтобы убыток не вырос: решаем заранее, пока спокойно. Попробуйте ещё раз.', en: 'The plan was −$20, you left at {pnl}. A threshold keeps the loss from growing: decide in advance, while calm. Try once more.' }] }] },
  /* 7. Разные активы */
  { mode: 'trade', as: ['UM', 'UZ', 'UA'], rounds: [
    { t: H('Сравнить', 'Compare'), init: { view: 'mkt' }, steps: [
      { tg: 'tabcmp', h: H('Откройте «Сравнить»', 'Open “Compare”') },
      { tg: 'csUM', h: H('Выберите два актива: сначала монету', 'Pick two assets: the coin first') },
      { tg: 'csUZ', h: H('Теперь золото', 'Now the gold') },
      { tg: 'best', k: 'next', h: H('Лучший и худший за неделю', 'Best and worst over the week') }],
      pl: [{ ru: 'Все линии начинаются со 100 %. Учебная монета за неделю упала до 50 %, золото осталось на 100 %. Видно, кто сильнее колеблется.', en: 'All lines start at 100%. The training coin fell to 50% over the week, the gold stayed at 100%. You can see who swings more.' }] },
    { t: H('Разделить деньги', 'Split the money'), steps: [
      { tg: 'pre50', h: H('Половина: $500', 'Half: $500') },
      { tg: 'buy', h: H('Покупаем учебную монету', 'Buy the training coin'), bad: { sell: H('Здесь нужна «Купить»', '“Buy” is needed here') } },
      { tg: 'asUZ', h: H('Теперь другой актив: золото', 'Now another asset: the gold') },
      { tg: 'pre100', h: H('Остаток $500 — во второй актив', 'The remaining $500 goes to the second asset') },
      { tg: 'buy', run: [{ to: { UM: 50, UZ: 100, UA: 104 }, ms: 3600 }], h: H('Покупаем золото', 'Buy the gold'), bad: { sell: H('Здесь нужна «Купить»', '“Buy” is needed here') } },
      { tg: 'posRes', k: 'watch', h: H('Неделя прошла: смотрим итог', 'The week has passed: look at the result') }],
      pl: [{ ru: 'Вы вложили по $500 в два актива. Монета упала на 50 %, это $250. Золото не изменилось, $500. Вместе {eq}. Если бы всё лежало в монете — $500.', en: 'You put $500 into each of two assets. The coin fell 50%, that is $250. The gold did not change, $500. Together {eq}. Had everything been in the coin — $500.' }] }] },
  /* 8. Ставки */
  { mode: 'bet', rounds: [
    { t: H('Сбылось', 'It happens'), bet: { q: H('Учебный матч: победит команда Синих?', 'Practice match: will the Blue team win?'), k: [2.5, 1.6], pick: 1, win: true }, steps: [
      { tg: 'bet1', h: H('Коэффициент 2,5: берём «Да»', 'Odds 2.5: take “Yes”') },
      { tg: 'bpre10', h: H('Ставка $10', 'A $10 stake'), bad: { bpre: H('Нужна ставка $10', 'A $10 stake is needed') } },
      { tg: 'bwin', k: 'next', h: H('Выплата: $10 × 2,5 = $25', 'Payout: $10 × 2.5 = $25') },
      { tg: 'bok', run: [{ wait: 2800 }], h: H('Ставим', 'Place it') },
      { tg: 'bwin', k: 'watch', h: H('Ждём исхода', 'Waiting for the result') }],
      pl: [{ ru: 'Вы поставили {bet} при коэффициенте 2,5. Исход сбылся: выплата $25, прибыль $15.', en: 'You staked {bet} at odds 2.5. The outcome happened: payout $25, profit $15.' }] },
    { t: H('Не сбылось', 'It does not'), bet: { q: H('Учебный матч: победит команда Красных?', 'Practice match: will the Red team win?'), k: [2.4, 1.6], pick: 0, win: false }, steps: [
      { tg: 'bet0', h: H('Коэффициент 1,6: берём «Нет»', 'Odds 1.6: take “No”'), bad: { bet: H('Нужна ставка на «Нет»', 'A bet on “No” is needed') } },
      { tg: 'bpre10', h: H('Ставка $10', 'A $10 stake'), bad: { bpre: H('Нужна ставка $10', 'A $10 stake is needed') } },
      { tg: 'bok', run: [{ wait: 2800 }], h: H('Ставим', 'Place it') },
      { tg: 'bwin', k: 'watch', h: H('Ждём исхода', 'Waiting for the result') }],
      pl: [{ ru: 'Ставка $10 не сыграла: $10 пропали. Коэффициент 1,6 соответствует шансу 62,5 % (единица, делённая на 1,6): шанс большой, но не гарантия.', en: 'The $10 stake did not win: $10 is gone. Odds 1.6 mean a 62.5% chance (one divided by 1.6): a big chance, but no guarantee.' }] }] },
  /* 9. Главное правило */
  { mode: 'trade', rounds: [
    { t: H('Всё и сразу', 'All at once'), steps: [
      { tg: 'pre100', h: H('Весь счёт в одной сделке', 'The whole account in one trade') },
      { tg: 'lev5', h: H('Плечо ×5', 'Leverage ×5'), bad: { lev: H('Здесь нужно ×5', '×5 is needed here') } },
      { tg: 'buy', run: [{ to: 80, ms: 4200 }], h: H('Открываем на рост', 'Open on a rise'), bad: { sell: H('Здесь нужна «Купить»', '“Buy” is needed here') } },
      { tg: 'price', k: 'watch', h: H('Смотрим, что будет', 'Watch what happens') }],
      pl: [{ ru: 'Вы вложили весь счёт, {m}, с плечом ×5. Цена упала на 20 %: этого хватило, чтобы потерять всё. Дальше играть нечем.', en: 'You put in the whole account, {m}, with ×5 leverage. The price fell 20%: that was enough to lose everything. There is nothing left to play with.' }] },
    { t: H('Малая доля', 'A small share'), preAmt: { 10: 100 }, steps: [
      { tg: 'pre10', h: H('Десятая часть: $100', 'A tenth: $100'), bad: { pre: H('Здесь берём десятую часть', 'Take a tenth here') } },
      { tg: 'lev2', h: H('Плечо ×2', 'Leverage ×2') },
      { tg: 'buy', run: [{ to: 90, ms: 3000 }], h: H('Открываем на рост', 'Open on a rise'), bad: { sell: H('Здесь нужна «Купить»', '“Buy” is needed here') } },
      { tg: 'free', k: 'next', h: H('Оставляйте запас', 'Keep a reserve') },
      { tg: 'close', h: H('Закройте: ошибка стоила $20', 'Close it: the mistake cost $20') }] },
    { t: H('Вторая сделка', 'A second trade'), init: { cash: 980 }, preAmt: { 10: 100 }, steps: [
      { tg: 'pre10', h: H('Снова $100', '$100 again'), bad: { pre: H('Здесь берём десятую часть', 'Take a tenth here') } },
      { tg: 'lev2', h: H('Плечо ×2', 'Leverage ×2') },
      { tg: 'buy', run: [{ to: 110, ms: 3000 }], h: H('Открываем на рост', 'Open on a rise'), bad: { sell: H('Здесь нужна «Купить»', '“Buy” is needed here') } },
      { tg: 'close', h: H('Закройте и посмотрите на счёт', 'Close it and look at the balance') }],
      pl: [{ ru: 'Первая ошибка стоила $20 — не катастрофа. Вторая сделка вернула их: счёт {cash}. Малая доля счёта не даёт одной ошибке закончить игру. Очки уровня даёт чистый заработок, а не число сделок.', en: 'The first mistake cost $20, not a catastrophe. The second trade got it back: the balance is {cash}. A small share of the account keeps one mistake from ending the game. Level points come from net earnings, not the number of trades.' }] }] },
  /* 10. Цель */
  { mode: 'trade', rounds: [
    { t: H('Цель +$10', 'A +$10 target'), init: { target: 10 }, steps: [
      { tg: 'pre10', h: H('Десятая часть: $100', 'A tenth: $100') },
      { tg: 'buy', run: [{ to: 110, ms: 3000 }], h: H('Открываем на рост', 'Open on a rise'), bad: { sell: H('Здесь нужна «Купить»', '“Buy” is needed here') } },
      { tg: 'close', tmo: 3500, tmoRun: [{ to: 95, ms: 2400 }], h: H('Цель +$10 достигнута. Забирайте', 'The +$10 target is reached. Take it'), h2: H('Цена пошла вниз. Можно ещё закрыть', 'The price turned down. You can still close') }],
      pl: [{ w: r => r.pnl >= 9.99, ru: 'Цель была +$10. Вы закрыли на {pnl}. Цену на пике не поймать: забрать по плану лучше, чем ждать большего.', en: 'The target was +$10. You closed at {pnl}. You cannot catch the peak: taking it by plan beats waiting for more.' },
        { retry: true, ru: 'Ждали — вышли на {pnl}. Цель была достигнута, а плюс превратился в минус. Попробуйте ещё раз.', en: 'You waited and left at {pnl}. The target was reached, and the plus turned into a minus. Try once more.' }] }] },
  /* 11. Комиссия и частые сделки */
  { mode: 'trade', rounds: [
    { t: H('Пять сделок', 'Five trades'), init: { fee: 0.001, closeFeeOn: 'entry' }, steps: [].concat([0, 1, 2, 3, 4].map(n => [
      { tg: 'pre50', set: { UM: 100 }, h: n ? H('Сделка ' + (n + 1) + ' из 5: половина', 'Trade ' + (n + 1) + ' of 5: half') : H('Половина: $500', 'Half: $500') }]
      .concat(n ? [] : [{ tg: 'lev2', h: H('Плечо ×2: позиция $1 000', 'Leverage ×2: a $1,000 position') }]).concat([
      { tg: 'buy', run: [{ to: 100.2, ms: 1500 }], h: n ? H('Покупаем', 'Buy') : H('Цена вырастет всего на 0,2 %', 'The price will rise just 0.2%'), bad: { sell: H('Здесь нужна «Купить»', '“Buy” is needed here') } },
      { tg: 'close', h: n ? H('Закрываем', 'Close it') : H('Закройте: посмотрите на результат', 'Close it: look at the result') }])).reduce((a, b) => a.concat(b), [])),
      pl: [{ ru: 'Пять сделок, цена каждый раз выросла на 0,2 %, а результат каждой — 0: комиссия за открытие и закрытие съела весь рост. Всего комиссии: {fees} при позиции $1 000. Счёт: {cash}.', en: 'Five trades, the price rose 0.2% each time, and the result of each is 0: the opening and closing fees ate the whole rise. Fees in total: {fees} on a $1,000 position. Balance: {cash}.' }] }] }
];

/* ---------------- ДВИЖОК ---------------- */
let cur = null;
const $q = (r, s) => r.querySelector(s);
const $a = (r, s) => Array.prototype.slice.call(r.querySelectorAll(s));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function Inst(host, li, api) {
  const D = LB[li], lang = api.lang() === 'en' ? 'en' : 'ru', X = TX[lang], at = api.t;
  const assets = D.as || ['UM'];
  const fm = v => (Math.abs(v - Math.round(v)) < 1e-9 ? api.money(Math.round(v), 0) : api.money(v, 2));
  const sg = v => (v > 0.0049 ? '+' : '') + fm(Math.abs(v) < 0.005 ? 0 : v);
  const fp = v => { const a = Math.abs(v); return (Math.abs(a - Math.round(a)) < 0.05 ? String(Math.round(a)) : a.toFixed(1)) + (lang === 'en' ? '%' : ' %'); };
  const tk = id => AS[id][lang === 'en' ? 1 : 0][0];
  const nm = id => AS[id][lang === 'en' ? 1 : 0][1];
  let sb = null, ri = -1, si = 0, step = null, q = [], seg = null, raf = 0, last = 0, tmoT = 0, dead = false, wrong = 0, token = 0, results = [], flags = {}, passedNow = api.passed(li);
  let doneRounds = {}, histAcc = 0, cols = null, W = 0, finT = 0, fhold = null;
  const timers = [];
  const later = (fn, ms) => { const id = setTimeout(() => { if (!dead) fn(); }, ms); timers.push(id); return id; };

  host.innerHTML = '';
  const root = document.createElement('section'); root.className = 'obu panel'; host.appendChild(root);

  /* ----- экран-вступление и экран «пройдено» ----- */
  function intro() {
    stopLoop(); step = null; q = []; seg = null; clearTimeout(tmoT);
    root.className = 'obu panel obu-idle';
    root.innerHTML = '<div class="obu-top"><span class="lbl">' + X.title + '</span><span class="obu-tag">' + X.tag + '</span></div>' +
      (passedNow ? '<p class="obu-ok"><i aria-hidden="true">✓</i> ' + X.done + '</p><p class="obu-p">' + X.doneNote + '</p>' : '<p class="obu-p">' + X.intro + '</p>') +
      '<button type="button" class="btn-gold obu-go" data-obu="start">' + (passedNow ? X.again : X.start) + '</button>';
  }
  function finish() {
    if (!passedNow) { passedNow = true; api.pass(li); }
    stopLoop(); step = null; intro();
    const b = $q(root, '.obu-ok'); if (b) { b.classList.add('obu-pop'); }
    scrollTo(root);
  }

  /* ----- состояние раунда ----- */
  function newSb(r) {
    const i = r.init || {}; const o = {
      cash: i.cash != null ? i.cash : 1000, lev: 1, amt: 0, fee: i.fee != null ? i.fee : 0, feeOn: i.closeFeeOn || 'exit', ct: i.ct || 'candle', as: 'UM', view: i.view || 'mkt',
      px: {}, hist: {}, pos: [], nid: 1, last: null, sel: [], tt: null, stop: i.stop || 0, target: i.target || 0, cs: [], bet: null, bamt: 0, bres: null, preAmt: r.preAmt || {}, fees: 0, closed: []
    };
    assets.forEach(a => { o.px[a] = 100; o.hist[a] = H0.slice(); });
    if (D.mode === 'chart') { o.px.UM = 100; }
    if (r.bet) { o.bet = { q: r.bet.q, k: r.bet.k, pick: -1, cfg: r.bet }; }
    return o;
  }
  const pnlOf = p => { const px = sb.px[p.as]; return p.side * p.sz * (px / p.entry - 1); };
  const feeClose = (p, px) => sb.fee * (sb.feeOn === 'entry' ? p.sz : p.sz * px / p.entry);
  function startRound(n) {
    ri = n; const r = D.rounds[ri];
    if (r.skip && r.skip(flags)) { return nextRound(); }
    sb = newSb(r); si = 0; wrong = 0; q = []; seg = null; token++;
    root.className = 'obu panel obu-run';
    build(); beginStep();
  }
  function nextRound() { if (ri + 1 < D.rounds.length) startRound(ri + 1); else finish(); }

  /* ----- разметка (настоящие классы панели сделки) ----- */
  function head() {
    const a = sb.as;
    return '<div class="ins-head obu-head"><div data-od><p class="lbl">' + esc(tk(a)) + '</p><h1>' + esc(nm(a)) + '</h1></div><div class="ins-px" data-o="price" data-od><b class="num obu-px"></b></div></div>';
  }
  function chartBlock(bar) {
    return '<div class="panel ch-panel obu-chp">' + (bar ? '<div class="ch-bar" data-od><div class="chips tfs">' + ['1m', '5m', '1h', '4h', '24h'].map(k => '<button class="chip' + (k === '5m' ? ' on' : '') + '" type="button" tabindex="-1" aria-disabled="true">' + at('tf_' + k) + '</button>').join('') +
      '</div><div class="seg ctype"><button type="button" data-o="ctl" class="' + (sb.ct === 'line' ? 'on' : '') + '">' + at('ct_line') + '</button><button type="button" data-o="ct" class="' + (sb.ct === 'candle' ? 'on' : '') + '">' + at('ct_candle') + '</button></div></div>' : '') +
      '<div class="obu-cvw"><canvas class="obu-cv" aria-hidden="true"></canvas><div class="obu-hits"></div><div class="obu-tt" hidden></div></div></div>';
  }
  function tradePanel() {
    const lv = [1, 2, 5, 10];
    return '<div class="panel trade obu-trade">' +
      (assets.length > 1 ? '<div class="chips obu-as">' + assets.map(a => '<button type="button" class="chip' + (a === sb.as ? ' on' : '') + '" data-o="as' + a + '">' + esc(tk(a)) + '</button>').join('') + '</div>' : '') +
      '<p class="lbl mt" data-od>' + at('tr_amount') + '</p><div class="field" data-od><span>$</span><input class="obu-amt" type="text" readonly tabindex="-1" inputmode="none" aria-label="' + esc(at('tr_amount')) + '"></div>' +
      '<div class="chips eq">' + [10, 25, 50, 100].map(p => '<button class="chip" type="button" data-o="pre' + p + '">' + (p === 100 ? at('tr_all') : p + '%') + '</button>').join('') + '</div>' +
      '<p class="free" data-o="free" data-od><span>' + at('tr_cash') + '</span><b class="num obu-cash"></b></p>' +
      (sb.stop ? '<p class="obu-plan" data-o="stop" data-od>' + X.planStop.replace('{x}', fm(sb.stop)) + '</p>' : '') +
      '<p class="lbl mt" data-od>' + at('tr_lev') + '</p><div class="chips eq">' + lv.map(l => '<button class="chip' + (l === sb.lev ? ' on' : '') + '" type="button" data-o="lev' + l + '">×' + l + '</button>').join('') + '</div>' +
      '<div class="warn obu-warn" data-o="levWarn" data-od hidden></div>' + (sb.fee ? '<p class="fee num obu-fee" data-o="fee" data-od></p>' : '') +
      '<div class="sides"><button class="side buy" type="button" data-o="buy"><b>' + at('tr_buy') + '</b><small>' + at('tr_buy_s') + '</small></button>' +
      '<button class="side sell" type="button" data-o="sell"><b>' + at('tr_sell') + '</b><small>' + at('tr_sell_s') + '</small></button></div></div>';
  }
  function cmpBlock() {
    return '<div class="panel obu-cmp"><div class="cs-top" data-od><span class="lbl">' + X.pick + '</span><span class="cs-n num obu-csn"></span></div><div class="cs-list">' +
      ['UM', 'UZ', 'UA'].map(a => '<button class="cp-item" type="button" data-o="cs' + a + '"><i class="dot"></i><span class="cp-t"><b class="num">' + esc(tk(a)) + '</b><small>' + esc(nm(a)) + '</small></span><span class="cp-m" aria-hidden="true">+</span></button>').join('') + '</div>' +
      '<div class="obu-best" data-o="best" data-od hidden></div></div>';
  }
  function betBlock() {
    const b = sb.bet;
    return '<div class="panel obu-ev" data-od><span class="lbl">' + X.evt + '</span><p class="slip-q obu-q">' + esc(b.q[lang]) + '</p><div class="sbtns"><button class="od" type="button" data-o="bet1"><span class="od-n">' + X.yes + '</span><b class="num">' + String(b.k[0]).replace('.', lang === 'ru' ? ',' : '.') + '</b></button>' +
      '<button class="od r" type="button" data-o="bet0"><span class="od-n">' + X.no + '</span><b class="num">' + String(b.k[1]).replace('.', lang === 'ru' ? ',' : '.') + '</b></button></div></div>' +
      '<div class="panel obu-slip" hidden><div class="slip-pick" data-od><span class="obu-pk"></span><b class="num obu-bk"></b></div><div class="field" data-od><span>$</span><input class="obu-bamt" type="text" readonly tabindex="-1" inputmode="none"></div>' +
      '<div class="chips eq">' + [10, 50, 100].map(v => '<button class="chip" type="button" data-o="bpre' + v + '">' + v + '</button>').join('') + '<button class="chip" type="button" data-o="bpreall">' + at('bet_max') + '</button></div>' +
      '<div class="slip-nums"><div data-o="bwin" data-od><span>' + X.pay + '</span><span class="num up obu-bw">—</span></div><div data-od><span>' + X.cash + '</span><span class="num obu-bc"></span></div></div>' +
      '<button class="btn-gold slip-go" type="button" data-o="bok">' + X.go + '</button><p class="obu-res" hidden></p></div>';
  }
  function build() {
    const m = D.mode; let h = '';
    if (m === 'bet') h = betBlock();
    else if (m === 'chart') h = head() + chartBlock(true);
    else {
      const tabs = D.as && D.as.length > 1 && D.rounds[ri].init && D.rounds[ri].init.view ? '<div class="seg obu-tabs"><button type="button" data-o="tabmkt" class="' + (sb.view === 'mkt' ? 'on' : '') + '">' + X.tabM + '</button><button type="button" data-o="tabcmp" class="' + (sb.view === 'cmp' ? 'on' : '') + '">' + X.tabC + '</button></div>' : '';
      if (sb.view === 'cmp') h = tabs + chartBlock(false) + cmpBlock();
      else if (tabs) h = tabs + head() + chartBlock(false);
      else h = head() + chartBlock(false) + tradePanel() + '<h2 class="h2 obu-h2" data-od>' + at('ins_pos') + '</h2><div class="poslist obu-pos"></div>';
    }
    const r = D.rounds[ri], rn = D.rounds.filter(x => !(x.skip && x.skip(flags))).length;
    root.innerHTML = '<div class="obu-top"><span class="lbl">' + X.title + '</span><span class="obu-tag">' + X.tag + '</span><button type="button" class="obu-x" data-obu="exit" aria-label="' + X.exit + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
      '<p class="obu-meta num" data-od></p><div class="obu-stage m-' + m + '">' + h + '<div class="obu-tip" role="status" aria-live="polite"><span class="obu-tt1"></span><span class="obu-btns"></span></div><i class="obu-fin" hidden></i></div><div class="obu-pl" hidden></div>';
    const cv = $q(root, '.obu-cv'); if (cv) { sb.cv = cv; sb.ctx = cv.getContext('2d'); buildHits(); }
    colors(); sizeCanvas(); renderPos(); upd(); draw();
    root.className = 'obu panel obu-run';
  }
  function colors() {
    const cs = getComputedStyle(document.documentElement), g = n => (cs.getPropertyValue(n) || '').trim();
    cols = { up: g('--up') || '#7FBF9A', dn: g('--down') || '#D98A7E', gold: g('--gold') || '#C8A96A', mut: g('--mut') || '#A69F93', txt: g('--txt') || '#F3EEE6', line: 'rgba(255,255,255,.08)' };
  }
  function buildHits() {
    const hits = $q(root, '.obu-hits'); if (!hits || D.mode !== 'chart') return;
    hits.innerHTML = CANDLES.map((c, k) => '<i data-o="c' + k + '" data-k="' + k + '" aria-label="' + (k + 1) + '"></i>').join('');
    layoutHits();
  }
  function layoutHits() {
    const hits = $q(root, '.obu-hits'); if (!hits || !W) return; const n = CANDLES.length, sw = W / n;
    $a(hits, 'i').forEach((e, k) => { const w = Math.max(sw, 44); e.style.left = (k * sw + sw / 2 - w / 2) + 'px'; e.style.width = w + 'px'; e.style.display = sb.ct === 'candle' ? '' : 'none'; });
  }
  function sizeCanvas() {
    const cv = sb && sb.cv; if (!cv) return; const w = cv.parentNode.clientWidth || 300, h = cv.parentNode.clientHeight || 150, d = Math.min(2, window.devicePixelRatio || 1);
    W = w; cv.width = Math.round(w * d); cv.height = Math.round(h * d); sb.d = d; sb.cw = w; sb.chh = h; layoutHits();
  }

  /* ----- обновление чисел ----- */
  function setT(sel, v) { const e = $q(root, sel); if (e && e.textContent !== v) e.textContent = v; return e; }
  function curPx() { return sb.px[sb.as]; }
  function upd() {
    if (!sb) return;
    const px = curPx(), pf = v => '$' + (Math.abs(v - Math.round(v)) < 0.005 ? Math.round(v) : v.toFixed(2).replace(/0$/, ''));
    setT('.obu-px', pf(px));
    const am = $q(root, '.obu-amt'); if (am) am.value = sb.amt ? String(sb.amt) : '';
    setT('.obu-cash', fm(sb.cash));
    const fe = $q(root, '.obu-fee'); if (fe) fe.textContent = !sb.amt ? X.feeRate : X.feeOpen + ': ' + fm(Math.round(sb.amt * sb.lev * sb.fee * 100) / 100) + ' · ' + X.feeOf + ' ' + fm(sb.amt * sb.lev);
    const w = $q(root, '.obu-warn'); if (w) { w.hidden = sb.lev === 1; if (sb.lev > 1) { const l = sb.lev, p = 100 / l; w.textContent = X.warn.replace('{l}', l).replace('{p}', p).replace('{a}', pf(100 * (1 - 1 / l))).replace('{b}', pf(100 * (1 + 1 / l))); } }
    $a(root, '[data-o^="lev"]').forEach(b => b.classList.toggle('on', +b.getAttribute('data-o').slice(3) === sb.lev));
    $a(root, '[data-o^="as"]').forEach(b => b.classList.toggle('on', b.getAttribute('data-o').slice(2) === sb.as));
    $a(root, '[data-o="ct"],[data-o="ctl"]').forEach(b => b.classList.toggle('on', (b.getAttribute('data-o') === 'ct') === (sb.ct === 'candle')));
    sb.pos.forEach(p => {
      const card = $q(root, '[data-pid="' + p.id + '"]'); if (!card) return; const pn = pnlOf(p) - p.fo, mk = sb.px[p.as];
      const e1 = $q(card, '[data-f="pnl"]'); if (e1) { e1.textContent = sg(pn); e1.className = 'num ' + (pn > 0.004 ? 'up' : pn < -0.004 ? 'down' : ''); }
      const e2 = $q(card, '[data-f="roe"]'); if (e2) e2.textContent = (pn >= 0 ? '+' : '−') + Math.abs(pn / p.m * 100).toFixed(1) + (lang === 'en' ? '%' : ' %');
      const e3 = $q(card, '[data-f="mark"]'); if (e3) e3.textContent = '$' + mk.toFixed(2);
      const e4 = $q(card, '[data-f="size"]'); if (e4) e4.textContent = fm(p.sz + pnlOf(p));
      const bar = $q(card, '[data-f="lbar"]'); if (bar && p.lev > 1) { const liq = liqPx(p), k = Math.max(0, Math.min(1, p.side > 0 ? (mk - liq) / (p.entry - liq) : (liq - mk) / (liq - p.entry))); bar.style.transform = 'scaleX(' + k.toFixed(3) + ')'; bar.className = k > 0.5 ? '' : k > 0.25 ? 'mid' : 'low'; }
    });
    const csn = $q(root, '.obu-csn'); if (csn) csn.textContent = sb.cs.length + ' / 3';
    $a(root, '[data-o^="cs"]').forEach(b => { const a = b.getAttribute('data-o').slice(2), on = sb.cs.indexOf(a) >= 0; b.classList.toggle('on', on); const m = $q(b, '.cp-m'); if (m) m.textContent = on ? '✓' : '+'; });
    const bs = $q(root, '.obu-best'); if (bs) { const two = sb.cs.length >= 2; bs.hidden = !two; if (two) { const v = sb.cs.map(a => [a, WK[a][7] - 100]).sort((a, b) => b[1] - a[1]); bs.innerHTML = '<span>' + X.best + ' (' + X.wk + '): <b class="up">' + esc(tk(v[0][0])) + ' ' + (v[0][1] >= 0 ? '+' : '−') + fp(v[0][1]) + '</b></span><span>' + X.worst + ': <b class="down">' + esc(tk(v[v.length - 1][0])) + ' ' + (v[v.length - 1][1] >= 0 ? '+' : '−') + fp(v[v.length - 1][1]) + '</b></span>'; } }
    const mt = $q(root, '.obu-meta'); if (mt) {
      const rr = D.rounds.filter(x => !(x.skip && x.skip(flags))), r = D.rounds[ri], idx = rr.indexOf(r) + 1, ts = r.steps.length;
      mt.textContent = (rr.length > 1 ? X.round.replace('{n}', idx).replace('{m}', rr.length) + (r.t ? ' · ' + r.t[lang] : '') + ' · ' : '') + X.step.replace('{n}', Math.min(si + 1, ts)).replace('{m}', ts);
    }
    betUpd();
  }
  function betUpd() {
    const b = sb.bet; if (!b) return; const sl = $q(root, '.obu-slip'); if (!sl) return;
    sl.hidden = b.pick < 0;
    if (b.pick >= 0) {
      const k = b.k[b.pick === 1 ? 0 : 1], f = v => String(v).replace('.', lang === 'ru' ? ',' : '.');
      setT('.obu-pk', b.pick === 1 ? X.yes : X.no); setT('.obu-bk', f(k));
      const ba = $q(root, '.obu-bamt'); if (ba) ba.value = sb.bamt ? String(sb.bamt) : '';
      setT('.obu-bw', sb.bamt ? fm(Math.round(sb.bamt * k * 100) / 100) : '—'); setT('.obu-bc', fm(sb.cash));
    }
    const rs = $q(root, '.obu-res'); if (rs) { rs.hidden = !sb.bres; if (sb.bres) { rs.className = 'obu-res num ' + (sb.bres.win ? 'up' : 'down'); rs.textContent = (sb.bres.win ? X.won + ': ' : X.lost + ': ') + sg(sb.bres.pnl); } }
    $a(root, '[data-o="bet1"],[data-o="bet0"]').forEach(e => e.classList.toggle('on', b.pick >= 0 && e.getAttribute('data-o') === 'bet' + b.pick));
  }
  const liqPx = p => p.side > 0 ? p.entry * (1 - 1 / p.lev) : p.entry * (1 + 1 / p.lev);
  function renderPos() {
    const box = $q(root, '.obu-pos'); if (!box) return;
    if (!sb.pos.length) { box.innerHTML = '<p class="empty">' + X.none + '</p>' + lastHTML(); upd(); return; }
    box.innerHTML = sb.pos.map(p => {
      const noLiq = p.side > 0 && p.lev === 1;
      const cell = (k, f, v) => '<div class="pc"><span class="lbl">' + at(k) + '</span><span class="num"' + (f ? ' data-f="' + f + '"' : '') + '>' + (v || '') + '</span></div>';
      return '<div class="pos" data-pid="' + p.id + '"><div class="pos-top"><b class="num">' + esc(tk(p.as)) + '</b><span class="badge ' + (p.side > 0 ? 'up' : 'down') + '">' + at(p.side > 0 ? 'side_up' : 'side_down') + ' ×' + p.lev + '</span>' +
        '<div class="pos-pnl" data-o="posRes" data-od><span class="lbl">' + at('p_pnl') + '</span><b class="num" data-f="pnl"></b><span class="num roe" data-f="roe"></span></div></div>' +
        '<div class="pos-grid" data-od>' + cell('p_size', 'size') + cell('p_entry', '', '$' + p.entry.toFixed(2)) + cell('p_mark', 'mark') + cell('p_margin', '', fm(p.m)) + cell('p_lev', '', '×' + p.lev) + cell('p_fee', '', fm(p.fo)) + '</div>' +
        '<div class="pos-liq" data-od><div class="pl-top"><span class="lbl">' + at('p_liq') + '</span><span class="num">' + (noLiq ? at('p_noliq') : '$' + liqPx(p).toFixed(2)) + '</span></div>' + (noLiq ? '' : '<div class="pl-bar"><i data-f="lbar"></i></div>') + '</div>' +
        '<button class="btn-ghost pos-close" type="button" data-o="close" data-id="' + p.id + '">' + at('p_close') + '</button></div>';
    }).join('') + lastHTML();
    upd();
  }
  function lastHTML() {
    const l = sb.last; if (!l) return '';
    return '<p class="obu-last num ' + (l.liq ? 'down' : l.pnl > 0.004 ? 'up' : l.pnl < -0.004 ? 'down' : '') + '" data-od>' + (l.liq ? X.liqd + ': ' : X.last + ': ') + sg(l.pnl) + ' · ' + at('tr_cash') + ' ' + fm(sb.cash) + '</p>';
  }

  /* ----- график (canvas 2D, без второй библиотеки) ----- */
  function draw() {
    if (!sb || !sb.ctx) return; const c = sb.ctx, d = sb.d || 1, w = sb.cw, h = sb.chh; if (!w) return;
    c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, w, h);
    const pad = 8, hl = sb.hl || [];
    const lines = []; let lo = 1e9, hi = -1e9; const ext = v => { if (v < lo) lo = v; if (v > hi) hi = v; };
    let kind = 'line', series = null, cs = null;
    if (D.mode === 'chart' && sb.ct === 'candle') { kind = 'candle'; CANDLES.forEach(k => { ext(k[1]); ext(k[2]); }); }
    else if (D.mode === 'chart') { series = CANDLES.map(k => k[3]).concat([sb.px.UM]); series.forEach(ext); }
    else if (sb.view === 'cmp') { kind = 'multi'; cs = sb.cs; ext(45); ext(110); }
    else { series = sb.hist[sb.as]; series.forEach(ext); }
    const lk = [];
    sb.pos.forEach(p => { if (p.as !== sb.as) return; lk.push({ v: p.entry, c: cols.mut, l: X.entry }); if (p.lev > 1 && !(p.side > 0 && p.lev === 1)) { const lq = liqPx(p); lk.push({ v: lq, c: cols.dn, l: X.liqLine + ' $' + lq.toFixed(0) }); } if (sb.stop) { const sp = p.entry * (1 - sb.stop / p.sz); lk.push({ v: sp, c: cols.gold, l: X.stopLine + ' −$' + sb.stop }); } if (sb.target) { const tp = p.entry * (1 + sb.target / p.sz); lk.push({ v: tp, c: cols.up, l: '+$' + sb.target }); } });
    lk.forEach(x => ext(x.v));
    if (!(hi > lo)) { hi = lo + 1; } const rg = (hi - lo) || 1; lo -= rg * 0.1; hi += rg * 0.1;
    const Y = v => pad + (hi - v) / (hi - lo) * (h - pad * 2);
    c.lineWidth = 1; c.strokeStyle = cols.line; for (let i = 1; i < 4; i++) { const y = Math.round(h * i / 4) + 0.5; c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    if (kind === 'candle') {
      const n = CANDLES.length, sw = w / n, bw = Math.max(5, sw * 0.5);
      CANDLES.forEach((k, i) => {
        const x = i * sw + sw / 2, up = k[3] >= k[0], col = up ? cols.up : cols.dn;
        c.globalAlpha = hl.length && hl.indexOf('c' + i) < 0 ? 0.35 : 1; c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(x, Y(k[1])); c.lineTo(x, Y(k[2])); c.stroke();
        const y1 = Y(Math.max(k[0], k[3])), y2 = Y(Math.min(k[0], k[3])); c.fillRect(x - bw / 2, y1, bw, Math.max(2, y2 - y1));
      }); c.globalAlpha = 1;
      (sb.sel || []).forEach(k => { const sw = w / n; c.strokeStyle = cols.gold; c.lineWidth = 1; c.strokeRect(k * sw + 2, 2, sw - 4, h - 4); });
    } else if (kind === 'multi') {
      const colr = { UM: cols.dn, UZ: cols.gold, UA: cols.up };
      cs.forEach(a => { const s = WK[a], n = s.length; c.strokeStyle = colr[a]; c.lineWidth = 2; c.beginPath(); s.forEach((v, i) => { const x = pad + i * (w - pad * 2) / (n - 1), y = Y(v); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke(); });
      c.fillStyle = cols.mut; c.font = '11px ' + '"IBM Plex Mono", monospace'; c.fillText('100 %', 6, Y(100) - 4);
    } else {
      const n = series.length, st = (w - pad * 2) / Math.max(1, n - 1), up = series[n - 1] >= series[0];
      c.strokeStyle = up ? cols.up : cols.dn; c.lineWidth = 2; c.lineJoin = 'round'; c.beginPath();
      series.forEach((v, i) => { const x = pad + i * st, y = Y(v); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke();
      const lx = pad + (n - 1) * st, ly = Y(series[n - 1]); c.fillStyle = up ? cols.up : cols.dn; c.beginPath(); c.arc(lx, ly, 3.5, 0, 6.3); c.fill();
    }
    c.font = '11px "IBM Plex Mono", monospace';
    lk.forEach(x => { const y = Y(x.v); c.strokeStyle = x.c; c.lineWidth = 1.2; c.setLineDash([5, 4]); c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); c.setLineDash([]); c.fillStyle = x.c; c.fillText(x.l, 6, Math.max(11, y - 4)); });
  }

  /* ----- цена идёт по записанному сценарию ----- */
  function startLoop() { if (!raf && !dead) { last = 0; raf = requestAnimationFrame(frame); } }
  function stopLoop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
  const ease = k => k * k * (3 - 2 * k);
  function frame(ts) {
    raf = 0; if (dead || !sb) return;
    const dt = last ? Math.min(100, ts - last) : 16; last = ts;
    if (!seg && q.length) { seg = q.shift(); seg.el = 0; seg.from = Object.assign({}, sb.px); seg.to = typeof seg.to === 'number' ? { [sb.as]: seg.to } : seg.to; }
    if (seg) {
      seg.el += dt; const k = RM ? 1 : Math.min(1, seg.el / (seg.ms || seg.wait || 1));
      if (seg.to) Object.keys(seg.to).forEach(a => { sb.px[a] = seg.from[a] + (seg.to[a] - seg.from[a]) * ease(k); });
      histAcc += dt; if (seg.to && (histAcc > 110 || k >= 1)) { histAcc = 0; assets.forEach(a => { const hh = sb.hist[a]; hh.push(sb.px[a]); if (hh.length > 56) hh.shift(); }); }
      liqCheck(); upd(); draw();
      if (k >= 1 && seg) { seg = null; if (!q.length) { onQueueEnd(); } }
    }
    if (seg || q.length) raf = requestAnimationFrame(frame);
  }
  function drain() {
    clearTimeout(tmoT);
    const all = (seg ? [seg] : []).concat(q); seg = null; q = [];
    all.forEach(s => { if (s.to) { const to = typeof s.to === 'number' ? { [sb.as]: s.to } : s.to; Object.keys(to).forEach(a => { sb.px[a] = to[a]; sb.hist[a].push(to[a]); }); } });
    liqCheck(); upd(); draw(); onQueueEnd();
  }
  function liqCheck() {
    for (let i = sb.pos.length - 1; i >= 0; i--) {
      const p = sb.pos[i], px = sb.px[p.as]; if (p.lev === 1 && p.side > 0) { if (px <= 0) {} continue; }
      if (p.side > 0 ? px <= liqPx(p) + 1e-9 : px >= liqPx(p) - 1e-9) {
        sb.pos.splice(i, 1); sb.last = { pnl: -p.m, liq: true, m: p.m }; flags.liq = true; sb.fees += p.fo; rec(Object.assign(recOf(p, liqPx(p)), { liq: true, pnl: -p.m - p.fo, gross: -p.m }));
        seg = null; q = []; renderPos(); draw();
        if (step) { const t0 = token; later(() => { if (t0 === token) advance('liq'); }, 650); }
        return;
      }
    }
  }
  function recOf(p, px) {
    const gross = p.side * p.sz * (px / p.entry - 1), fc = feeClose(p, px);
    return { m: p.m, sz: p.sz, lev: p.lev, side: p.side, from: p.entry, to: px, pct: (px / p.entry - 1) * 100, gross: gross, fo: p.fo, fc: fc, pnl: gross - p.fo - fc, as: p.as };
  }
  function rec(r) { sb.closed.push(r); (results[ri] = results[ri] || []).push(r); sb.lastRec = r; }

  /* ----- действия песочницы ----- */
  function act(name, el) {
    if (/^pre\d+$/.test(name)) { const n = +name.slice(3); sb.amt = sb.preAmt[n] != null ? sb.preAmt[n] : Math.floor(sb.cash * n) / 100; upd(); return true; }
    if (/^lev\d+$/.test(name)) { sb.lev = +name.slice(3); upd(); draw(); return true; }
    if (name === 'buy' || name === 'sell') {
      const side = name === 'buy' ? 1 : -1, sz = sb.amt * sb.lev, fo = Math.round(sz * sb.fee * 100) / 100;
      if (!(sb.amt > 0) || sb.amt + fo > sb.cash + 1e-9) return false;
      sb.cash = Math.round((sb.cash - sb.amt - fo) * 100) / 100; sb.fees += fo; sb.pos.push({ id: sb.nid++, as: sb.as, side: side, m: sb.amt, lev: sb.lev, sz: sz, entry: sb.px[sb.as], fo: fo });
      sb.amt = 0; sb.last = null; renderPos(); draw(); return true;
    }
    if (name === 'close') {
      const id = +el.getAttribute('data-id'), i = sb.pos.findIndex(p => p.id === id); if (i < 0) return false;
      const p = sb.pos[i], r = recOf(p, sb.px[p.as]); sb.pos.splice(i, 1); sb.cash = Math.round((sb.cash + p.m + r.gross - r.fc) * 100) / 100; sb.fees += r.fc; sb.last = r; rec(r);
      if (sb.preAmt && D.mode === 'trade' && !sb.pos.length) { /* цена для следующей сделки не меняется */ }
      renderPos(); draw(); return true;
    }
    if (name === 'ct') { sb.ct = 'candle'; layoutHits(); upd(); draw(); return true; }
    if (name === 'ctl') { sb.ct = 'line'; layoutHits(); upd(); draw(); return true; }
    if (/^c\d+$/.test(name)) { showTT(+name.slice(1)); return true; }
    if (name === 'tabcmp') { sb.view = 'cmp'; build(); return true; }
    if (name === 'tabmkt') { sb.view = 'mkt'; build(); return true; }
    if (/^cs[A-Z]{2}$/.test(name)) { const a = name.slice(2), i = sb.cs.indexOf(a); if (i >= 0) sb.cs.splice(i, 1); else sb.cs.push(a); upd(); draw(); return true; }
    if (/^as[A-Z]{2}$/.test(name)) { sb.as = name.slice(2); upd(); draw(); return true; }
    if (name === 'bet1' || name === 'bet0') { sb.bet.pick = name === 'bet1' ? 1 : 0; betUpd(); return true; }
    if (/^bpre/.test(name)) { sb.bamt = name === 'bpreall' ? Math.floor(sb.cash) : +name.slice(4); betUpd(); return true; }
    if (name === 'bok') {
      const b = sb.bet; if (!(sb.bamt > 0)) return false; const k = b.k[b.pick === 1 ? 0 : 1];
      sb.cash = Math.round((sb.cash - sb.bamt) * 100) / 100; b.placed = true; b.stake = sb.bamt; b.kk = k; betUpd(); return true;
    }
    return false;
  }
  function showTT(k) {
    const tt = $q(root, '.obu-tt'), c = CANDLES[k]; if (!tt) return;
    tt.innerHTML = '<span>' + X.o + '</span><b class="num">' + c[0] + '</b><span>' + X.c + '</span><b class="num">' + c[3] + '</b><span>' + X.hi + '</span><b class="num">' + c[1] + '</b><span>' + X.lo + '</span><b class="num">' + c[2] + '</b>';
    tt.hidden = false; const sw = W / CANDLES.length, x = k * sw + sw / 2; tt.style.left = (x > W / 2 ? Math.max(4, x - 160) : Math.min(W - 156, x + 16)) + 'px';
    sb.sel = [k]; draw();
  }

  /* ----- шаги ----- */
  const tgList = s => (Array.isArray(s.tg) ? s.tg : [s.tg]);
  const gated = () => !!(seg || q.length);
  function beginStep() {
    const r = D.rounds[ri]; step = r.steps[si]; clearTimeout(tmoT);
    if (!step) return endRound();
    if (step.set) { Object.keys(step.set).forEach(a => { sb.px[a] = step.set[a]; sb.hist[a] = H0.slice(); }); draw(); }
    upd(); wrong = 0; token++;
    if (step.tmo) armTmo();
    focus(); if (step.k === 'watch' && !gated()) { const t0 = token; later(() => { if (t0 === token) advance(); }, 500); }
  }
  function armTmo() {
    const t0 = token;
    const go = () => { if (t0 !== token || !step) return; if (gated()) { tmoT = setTimeout(go, 120); return; } tmoT = setTimeout(() => { if (t0 !== token || dead) return; step.live = true; q = q.concat(step.tmoRun.map(s => Object.assign({}, s))); startLoop(); focus(); }, step.tmo); };
    go();
  }
  function onQueueEnd() {
    betWatch();
    if (!step) return;
    if (step.k === 'watch') { const t0 = token; later(() => { if (t0 === token) advance(); }, 600); }
    focus();
  }
  function advance(why) {
    if (!step) return; const s = step; clearTimeout(tmoT);
    if (why !== 'liq' && s.run) { q = q.concat(s.run.map(x => Object.assign({}, x))); }
    if (why === 'liq') { si = D.rounds[ri].steps.length; } else si++;
    step = null; token++; hideTip(); stopFin();
    if (si >= D.rounds[ri].steps.length) { const t0 = token; if (q.length) { startLoop(); const wait = () => { if (t0 !== token || dead) return; if (gated()) { later(wait, 120); } else later(endRound, 450); }; later(wait, 120); } else later(endRound, 450); return; }
    beginStep(); if (q.length) startLoop();
  }
  function focus() {
    const stage = $q(root, '.obu-stage'); if (!stage || !step) return;
    const names = gated() && step.k !== 'watch' && !step.live ? ['price', 'posRes'] : tgList(step);
    sb.hl = names; stage.classList.add('obu-on');
    $a(stage, '.obu-t').forEach(e => e.classList.remove('obu-t'));
    const els = [];
    names.forEach(n => { $a(stage, '[data-o="' + n + '"]').forEach(e => { e.classList.add('obu-t'); els.push(e); }); });
    $a(stage, '[data-o]').forEach(e => { const on = e.classList.contains('obu-t'); if (e.tagName === 'BUTTON' || e.tagName === 'I') { e.tabIndex = on ? 0 : -1; e.setAttribute('aria-disabled', on ? 'false' : 'true'); } });
    $a(stage, '.obu-t.obu-p2').forEach(e => e.classList.remove('obu-p2'));
    draw(); layoutHits(); showTip(els);
  }
  function showTip(els) {
    const tip = $q(root, '.obu-tip'), stage = $q(root, '.obu-stage'); if (!tip || !stage || !step) return;
    const isG = gated() && step.k !== 'watch' && !step.live;
    const txt = isG ? X.watch : (step.live && step.h2 ? step.h2[lang] : step.h[lang]);
    $q(tip, '.obu-tt1').textContent = txt;
    const bt = $q(tip, '.obu-btns'); bt.innerHTML = '';
    if (step.k === 'next' || step.k === 'watch') { const b = document.createElement('button'); b.type = 'button'; b.className = 'obu-nx'; b.setAttribute('data-obu', 'next'); b.textContent = X.next; bt.appendChild(b); }
    if (wrong >= 3 && !isG && step.k !== 'next' && step.k !== 'watch') { const b = document.createElement('button'); b.type = 'button'; b.className = 'obu-nx'; b.setAttribute('data-obu', 'show'); b.textContent = X.show; bt.appendChild(b); }
    tip.classList.remove('in'); tip.style.visibility = 'hidden'; tip.hidden = false;
    const t0 = token; requestAnimationFrame(() => { if (dead || t0 !== token && false) return; place(els, tip, stage); tip.style.visibility = ''; tip.classList.add('in'); });
  }
  function place(els, tip, stage) {
    const sr = stage.getBoundingClientRect(); if (!els.length) { tip.style.top = '4px'; tip.style.left = '4px'; return; }
    let t = 1e9, b = -1e9, l = 1e9, rr = -1e9; els.forEach(e => { const r = e.getBoundingClientRect(); t = Math.min(t, r.top); b = Math.max(b, r.bottom); l = Math.min(l, r.left); rr = Math.max(rr, r.right); });
    const tw = Math.min(280, sr.width - 12), th = tip.offsetHeight || 54; tip.style.width = tw + 'px';
    let left = (l + rr) / 2 - sr.left - tw / 2; left = Math.max(6, Math.min(sr.width - tw - 6, left));
    const below = b - sr.top + 12, above = t - sr.top - th - 12, placeBelow = below + th <= sr.height + 4 || above < 0;
    const cp = $q(stage, '.obu-chp'), onPx = els.every(e => e.getAttribute('data-o') === 'price') && !!cp;   // у цены подсказка ложится под график, а не на него
    let topPx = placeBelow ? below : above; if (onPx) topPx = cp.getBoundingClientRect().bottom - sr.top + 10;
    tip.style.left = left + 'px'; tip.style.top = topPx + 'px'; tip.classList.toggle('up', !placeBelow && !onPx); tip.classList.toggle('noarrow', onPx);
    const ax = Math.max(14, Math.min(tw - 14, (l + rr) / 2 - sr.left - left)); tip.style.setProperty('--ax', ax + 'px');
    const tr = tip.getBoundingClientRect(); scrollTo(null, Math.min(t, tr.top), Math.max(b, tr.bottom));
  }
  function scrollTo(el, top, bottom) {
    try {
      let t, b; if (el) { const r = el.getBoundingClientRect(); t = r.top; b = r.bottom; } else { t = top; b = bottom; }
      const vh = window.innerHeight, mT = 72, mB = 96; let dy = 0;
      if (b - t > vh - mT - mB) dy = t - mT; else if (t < mT) dy = t - mT; else if (b > vh - mB) dy = b - (vh - mB);
      if (Math.abs(dy) > 4) window.scrollBy({ top: dy, behavior: RM ? 'auto' : 'smooth' });
    } catch (e) {}
  }
  function hideTip() { const tip = $q(root, '.obu-tip'); if (tip) { tip.classList.remove('in'); tip.hidden = true; } const st = $q(root, '.obu-stage'); if (st) { st.classList.remove('obu-on'); $a(st, '.obu-t').forEach(e => e.classList.remove('obu-t')); } if (sb) { sb.hl = []; draw(); } }
  function softHint(msg) {
    const tip = $q(root, '.obu-tip'); if (!tip) return; $q(tip, '.obu-tt1').textContent = msg; tip.classList.add('soft'); clearTimeout(softHint.t);
    const t0 = token; softHint.t = setTimeout(() => { if (dead || t0 !== token) return; tip.classList.remove('soft'); showTip($a(root, '.obu-t')); }, 2000);
    const bt = $q(tip, '.obu-btns'); if (wrong >= 3 && bt && !$q(bt, '[data-obu="show"]') && step && !step.k) { const b = document.createElement('button'); b.type = 'button'; b.className = 'obu-nx'; b.setAttribute('data-obu', 'show'); b.textContent = X.show; bt.appendChild(b); }
  }
  function stopFin() { const f = $q(root, '.obu-fin'); if (f) f.hidden = true; clearTimeout(finT); }
  function showFin() {
    const f = $q(root, '.obu-fin'), e = $q(root, '.obu-t'), st = $q(root, '.obu-stage'); if (!f || !e || !st) return;
    const sr = st.getBoundingClientRect(), r = e.getBoundingClientRect(); f.hidden = false; f.style.transition = 'none'; f.style.transform = 'translate(' + (sr.width / 2) + 'px,' + (r.top - sr.top + r.height + 40) + 'px)';
    void f.offsetWidth; f.style.transition = RM ? 'none' : 'transform .9s cubic-bezier(.2,.7,.2,1)'; f.style.transform = 'translate(' + (r.left - sr.left + r.width / 2 - 14) + 'px,' + (r.top - sr.top + r.height / 2 - 14) + 'px)';
    finT = setTimeout(() => { f.hidden = true; }, 2600);
  }

  /* ----- нажатия ----- */
  function nameAt(x, y, ev) {
    if (ev && ev.detail === 0 && ev.target.closest) { const e = ev.target.closest('[data-o]'); return e; }
    const all = $a(root, '[data-o]').filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && x >= r.left - 2 && x <= r.right + 2 && y >= r.top - 2 && y <= r.bottom + 2; });
    if (!all.length) return null;
    all.sort((a, b) => { const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return ra.width * ra.height - rb.width * rb.height; });
    const t = all.find(e => e.classList.contains('obu-t')); return t || all[0];
  }
  function onTap(ev) {
    if (dead || !step || !sb) return;
    const el = nameAt(ev.clientX, ev.clientY, ev); if (!el) return;
    const name = el.getAttribute('data-o'), isT = tgList(step).indexOf(name) >= 0;
    if (isT && (step.k === 'next' || step.k === 'watch')) return;
    if (isT && (!gated() || step.live)) {
      if (act(name, el)) { clearTimeout(softHint.t); advance(); return; }
      return;
    }
    if (isT) return;
    if (['price', 'fee', 'levWarn', 'posRes', 'stop', 'best', 'bwin', 'free'].indexOf(name) >= 0) return;
    if (gated() && !step.live) return;
    wrong++;
    const tg0 = $q(root, '.obu-t'), lab = tg0 ? (($q(tg0, 'b') || tg0).textContent || '').trim() : '';
    let msg = X.w1; const bad = step.bad;
    if (bad) { const k = bad[name] ? name : Object.keys(bad).filter(p => name.indexOf(p) === 0)[0]; if (k) msg = bad[k][lang]; }
    if (wrong === 2 && lab) msg = X.w2.replace('{x}', lab);
    softHint(msg);
  }
  function onRoot(ev) {
    const b = ev.target.closest ? ev.target.closest('[data-obu]') : null;
    if (b) {
      const k = b.getAttribute('data-obu');
      if (k === 'start') return startRound(0);
      if (k === 'exit') { token++; clearTimeout(softHint.t); intro(); return; }
      if (k === 'next') { if (!step) return; if (gated()) { const s = step; drain(); if (s.k === 'watch') return; } advance(); return; }
      if (k === 'show') { showFin(); return; }
      if (k === 'ok') { plDone(false); return; }
      if (k === 'retry') { plDone(true); return; }
      return;
    }
    onTap(ev);
  }
  root.addEventListener('click', onRoot);

  /* ----- плашка-объяснение ----- */
  function endRound() {
    if (root.className.indexOf('obu-run') < 0) return;
    step = null; hideTip(); const r = D.rounds[ri], list = results[ri] || [], lr = list[list.length - 1] || {};
    const f = r.pl ? r.pl.filter(p => !p.w || p.w(lr))[0] : null;
    if (!f) { doneRounds[ri] = 1; return nextRound(); }
    const bet = sb.bet && sb.bet.placed; let txt = f[lang];
    const eq = sb.cash + sb.pos.reduce((s, p) => s + p.m + pnlOf(p), 0);
    const v = { m: fm(lr.m || 0), sz: fm(lr.sz || 0), lev: lr.lev || 1, from: '$' + (lr.from || 0), to: '$' + (lr.to != null ? (Math.abs(lr.to - Math.round(lr.to)) < 0.005 ? Math.round(lr.to) : lr.to.toFixed(2)) : 0), pct: fp(lr.pct || 0),
      pnl: sg(lr.pnl || 0), apnl: fm(Math.abs(lr.pnl || 0)), gross: sg(lr.gross || 0), fo: fm(lr.fo || 0), fc: fm(lr.fc || 0), fee: fm((lr.fo || 0) + (lr.fc || 0)), val: fm((lr.m || 0) + (lr.gross || 0)), cash: fm(sb.cash), eq: fm(eq),
      fees: fm(Math.round(sb.fees * 100) / 100), p0: sg(((results[0] || [])[0] || {}).pnl || 0), bet: fm(sb.bet && sb.bet.stake || 0) };
    txt = txt.replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? v[k] : ''));
    if (sb.bet && sb.bet.placed && sb.bres) { /* результат уже показан */ }
    const pl = $q(root, '.obu-pl'); pl.innerHTML = '<p>' + esc(txt) + '</p><button type="button" class="btn-gold obu-okb" data-obu="' + (f.retry ? 'retry' : 'ok') + '">' + (f.retry ? X.retry : X.ok) + '</button>';
    pl.hidden = false; pl.classList.remove('in'); void pl.offsetWidth; pl.classList.add('in'); pl.setAttribute('role', 'status'); pl.dataset.retry = f.retry ? '1' : '';
    scrollTo(pl); const b = $q(pl, 'button'); if (b && !RM) { try { b.focus({ preventScroll: true }); } catch (e) {} }
  }
  function plDone(retry) {
    const pl = $q(root, '.obu-pl'); if (pl) { pl.hidden = true; pl.classList.remove('in'); }
    if (retry) { results[ri] = []; return startRound(ri); }
    doneRounds[ri] = 1; nextRound();
  }

  /* ставки: исход через паузу */
  const betWatch = () => { if (!sb || !sb.bet || !sb.bet.placed || sb.bres) return; const b = sb.bet, win = b.cfg.win, pnl = win ? b.stake * (b.kk - 1) : -b.stake; if (win) sb.cash = Math.round((sb.cash + b.stake * b.kk) * 100) / 100; sb.bres = { win: win, pnl: Math.round(pnl * 100) / 100 }; rec({ pnl: sb.bres.pnl, m: b.stake }); betUpd(); };

  function onResize() { if (!sb || dead) return; sizeCanvas(); draw(); const els = $a(root, '.obu-t'); if (step && els.length) showTip(els); }
  window.addEventListener('resize', onResize);
  function onVis() { if (document.hidden) stopLoop(); else if (seg || q.length) startLoop(); }
  document.addEventListener('visibilitychange', onVis);

  intro();
  return {
    li: li, lang: lang, host: host, root: root, active: () => root.classList.contains('obu-run'),
    destroy() { dead = true; stopLoop(); clearTimeout(tmoT); clearTimeout(softHint.t); clearTimeout(finT); timers.forEach(clearTimeout); window.removeEventListener('resize', onResize); document.removeEventListener('visibilitychange', onVis); root.removeEventListener('click', onRoot); }
  };
}
function mount(host, li, api) {
  if (!host || !LB[li]) return;
  const lang = api.lang() === 'en' ? 'en' : 'ru';
  if (cur && cur.li === li && cur.lang === lang && cur.root && cur.active()) { host.innerHTML = ''; host.appendChild(cur.root); return; }   // повторная отрисовка карточки посреди шагов: не сбрасываем
  stop(); cur = Inst(host, li, api);
}
function stop() { if (cur) { cur.destroy(); cur = null; } }
function text(k, lang) { return (TX[lang === 'en' ? 'en' : 'ru'])[k] || ''; }
window.DofaObu = { mount: mount, stop: stop, count: LB.length, text: text, has: li => !!LB[li] };
})();
