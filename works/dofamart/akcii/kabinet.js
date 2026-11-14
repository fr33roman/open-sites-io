/* dofamart · Акции — личный кабинет, «Отправить другу», чеки и долги (интерфейс, 14.11).
   ВЫКЛЮЧАТЕЛЬ: window.DOFA_KAB (в index.html) — адрес службы кабинета. Пусто — этот файл ничего не делает: ни кнопок, ни стилей, ни запросов.
   На 127.0.0.1/localhost включается параметром ?kab=http://127.0.0.1:порт. Все запросы — к /api службы (API.md сервера).
   Строки от сервера (подписи, адреса) вставляются только через esc()/textContent. */
(function () {
'use strict';

function base() {
  var b = typeof window.DOFA_KAB === 'string' ? window.DOFA_KAB.trim() : '';
  try {
    var h = location.hostname;
    if (h === '127.0.0.1' || h === 'localhost') {
      var q = new URLSearchParams(location.search).get('kab');
      if (q && /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(q)) b = q;
    }
  } catch (e) {}
  return b.replace(/\/+$/, '');
}
var BASE = base();
if (!BASE) return;

var VER = '1114c';
(function () { var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'kabinet.css?v=' + VER; document.head.appendChild(l); })();

/* ---------- small helpers ---------- */
var NB = ' ';
var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
var lang = function () { try { return window.DofaSim && window.DofaSim.lang() === 'en' ? 'en' : 'ru'; } catch (e) { return 'ru'; } };
var grp = function (s) { return String(s).replace(/\B(?=(\d{3})+(?!\d))/g, NB); };
function usd(c) { c = Math.round(c || 0); var d = Math.floor(c / 100), r = c % 100; return '$' + grp(d) + (r ? '.' + (r < 10 ? '0' : '') + r : ''); }
function toCents(s) {
  s = String(s || '').replace(/[\s  ]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return 0;
  return Math.round(parseFloat(s) * 100);
}
var DAY = 86400000;
function fmtDate(ms) { try { return new Date(ms).toLocaleDateString(lang() === 'en' ? 'en-GB' : 'ru-RU', { day: 'numeric', month: 'short' }); } catch (e) { return ''; } }
function uid() {
  try { if (crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
  var a = new Uint8Array(16); try { crypto.getRandomValues(a); } catch (e) { for (var i = 0; i < 16; i++) a[i] = Math.random() * 256; }
  return Array.prototype.map.call(a, function (b) { return (b + 256).toString(16).slice(1); }).join('');
}
function el(html) { var d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; }
function toast(m, c, ok) { try { window.DofaSim.toast(m, c, ok); } catch (e) {} }
function vib(p) { try { window.DofaSim.vib(p); } catch (e) {} }
function plural(n, a, b, c) { var x = n % 10, y = n % 100; return x === 1 && y !== 11 ? a : (x >= 2 && x <= 4 && (y < 12 || y > 14) ? b : c); }

/* ---------- text (ru / en) ---------- */
var TX = {
  ru: {
    cab: 'Кабинет', cab_aria: 'Личный кабинет', send: 'Отправить другу', send_s: 'Другу', close: 'Закрыть', back: 'Назад', cancel: 'Отмена', ok: 'Готово',
    copy: 'Копировать', copied: 'Скопировано', cp_fail: 'Не удалось скопировать',
    more_cab: 'Личный кабинет', more_cab_s: 'Адрес, долги, уведомления',
    err_set: 'Нет связи со службой кабинета. Попробуйте позже.', err_sboy: 'Сбой, попробуйте позже.', err_zapros: 'Страница не принята службой.', err_vhod: 'Неверный номер или пароль.',
    err_mnogo: 'Слишком много попыток, подождите.', err_parol_dlina: 'Пароль — от 10 знаков.', err_parol_chastyy: 'Этот пароль слишком частый, возьмите другой.',
    err_voprosy: 'Выберите три разных вопроса, один из них — с числом.', err_ne_sovpalo: 'Ответы не подошли.', err_vosst_pauza: 'Следующая попытка — {do}.',
    err_telegram: 'Вход через Telegram сейчас недоступен.', err_summa: 'Проверьте сумму.', err_procent: 'Процент — от 0 до 30.', err_podpis: 'Проверьте подпись.',
    err_ne_hvataet: 'Не хватает свободных денег кабинета.', err_limit: 'На вашем уровне можно внести ещё {mozhno}.', err_potolok: 'Достигнут потолок 13 млн $.',
    err_perevody_zakryty: 'Переводы откроются {do} (после восстановления доступа).', err_prosrochka: 'Сначала верните просроченный долг.',
    err_net: 'Не найдено.', err_sebe: 'Себе нельзя.', err_chek_used: 'Чек уже получен или недействителен.', err_mnogo_chekov: 'Открыто 20 чеков — дождитесь или отмените лишние.',
    err_nuzhen_vhod: 'Войдите в кабинет.', err_skoro: 'Скоро.', err_obshchee: 'Не получилось. Попробуйте ещё раз.',
    /* вход */
    login_h: 'Вход в кабинет', login_p: 'Номер кабинета и пароль. Кабинет нужен, чтобы отправлять деньги друзьям и брать в долг; торговля остаётся на этой странице.',
    f_adres: 'Номер кабинета', f_adres_ph: 'id1001', f_parol: 'Пароль', f_parol2: 'Пароль ещё раз', f_new_parol: 'Новый пароль', show: 'Показать', hide: 'Скрыть',
    login_go: 'Войти', to_reg: 'Создать кабинет', to_login: 'У меня уже есть кабинет', forgot: 'Забыли пароль?', tg_go: 'Войти через Telegram', g_go: 'Войти через Google', g_soon: 'скоро',
    tg_off: 'Вход через Telegram сейчас выключен на сервере.',
    reg_h: 'Новый кабинет', reg_p1: 'Шаг 1 из 2 · пароль', reg_p2: 'Шаг 2 из 2 · три контрольных вопроса',
    reg_pw_hint: 'От 10 знаков. Лучше — длинная фраза, которую легко запомнить. Браузер предложит сохранить пароль — согласитесь.',
    reg_warn_h: 'Сохраните пароль', reg_warn: 'Мы не знаем ни почты, ни телефона. Забыли пароль и ответы на вопросы, а Telegram не подключён — кабинет не вернуть.',
    reg_next: 'Дальше', reg_go: 'Создать кабинет', reg_gift: 'Вам подарок 100 000 $ за регистрацию по ссылке друга. Торговать им можно сразу, переводить — после трёх заданий.',
    pw_mismatch: 'Пароли не совпадают.', pw_short: 'Пароль — от 10 знаков.',
    q_intro: 'Выберите три разных вопроса и ответьте на них кнопками. Один вопрос — обязательно с числом (дом или день рождения мамы). Ответы нужны, если забудете пароль; запомните, какие вопросы выбрали.',
    q_pick: 'Вопросы', q_chosen: 'Выбрано {n} из 3', q_answer: 'Ваш ответ', q_need: 'Ответьте на все три вопроса.', q_num_need: 'Нужен хотя бы один вопрос с числом.',
    q_dom_ph: '0–999', q_month: 'Месяц', q_day: 'День', q_set: 'ответ задан',
    saved_h: 'Кабинет создан', saved_adres: 'Ваш номер кабинета', saved_p: 'Запишите номер и пароль. Номер нужен при каждом входе, друзья отправляют деньги на него.',
    saved_gift: 'Подарок 100 000 $ зачислен: торговать можно сразу, переводить — после трёх заданий.', saved_go: 'Открыть кабинет', saved_chek: 'Открыть чек', saved_store: 'Сохранить в браузере', saved_stored: 'Браузер получил пару номер + пароль',
    rec_h: 'Восстановление доступа', rec_p: 'Введите номер кабинета, ответьте на три вопроса, выбранных при регистрации, и задайте новый пароль.',
    rec_honest: 'Новый пароль заработает через 24 часа, и ещё сутки после этого переводы и долги будут закрыты. Весь этот день в кабинете висит предупреждение «Это не я» — владелец может отменить заявку. Старый пароль до того времени работает.',
    rec_next: 'Показать вопросы', rec_q_intro: 'Ответьте на эти три вопроса — их выбрали при регистрации.', rec_go: 'Отправить заявку', rec_ok_h: 'Заявка принята', rec_ok: 'Новый пароль заработает {t}. До тех пор входите по старому.',
    /* кабинет */
    cab_h: 'Личный кабинет', level: 'Уровень', xp: '{x} оч.', next_at: 'до следующего: {x}', your_adres: 'Ваш номер кабинета', adres_s: 'Друзья отправляют деньги на него',
    w_h: 'Деньги кабинета', w_free: 'Свободно', w_hold: 'Под чеками', w_gift: 'Подарок новичку', w_gift_net: 'нет', w_gift_zakryt: 'торговать можно, переводить — после трёх заданий', w_gift_otkryt: 'открыт, стал обычными деньгами',
    w_game: 'Игровой счёт (на этой странице)', two_h: 'Два кошелька — чем отличаются', two_btn: 'Как это устроено',
    two_game_h: 'Игровой счёт', two_game: 'Живёт в этом браузере. Им торгуют акциями, золотом и криптой на странице. Деньги игровые, поэтому он никуда не переводится и в долг не даётся.',
    two_cab_h: 'Кошелёк кабинета', two_cab: 'Живёт на сервере под вашим номером. Им отправляют деньги друзьям и берут в долг. Из торговли в кабинет деньги не попадают, из кабинета в торговлю тоже.',
    two_fill_h: 'Как пополнить кабинет', two_fill: 'Нажмите «Пополнить» в кабинете: сумма зачисляется на сервер в пределах лимита вашего уровня (как у банкомата на странице). Ещё деньги приходят подарком новичку и переводами от друзей.',
    fill: 'Пополнить кабинет', fill_h: 'Пополнение кабинета', fill_p: 'Сумма зачислится на кабинет. Предел — лимит вашего уровня.', fill_go: 'Пополнить', fill_ok: 'Кабинет пополнен',
    owe_h: 'Я должен', owed_h: 'Мне должны', none_owe: 'Долгов нет', none_owed: 'Вам никто не должен',
    left: 'Осталось', pct: 'Процент', due: 'Вернуть до', d_left: 'ещё {n} {w}', d_today: 'срок сегодня', d_over: 'просрочено на {n} {w}',
    w_den: ['день', 'дня', 'дней'], repay: 'Вернуть', repay_part: 'Вернуть часть', remind: 'Напомнить', forgive: 'Простить', forgive_q: 'Простить долг? Деньги не вернутся.', yes: 'Да',
    part_ph: 'Сумма, $', part_go: 'Вернуть', repaid: 'Долг обновлён', reminded: 'Напоминание отправлено', forgiven: 'Долг прощён',
    to_who: 'Кому: {a}', from_who: 'От кого: {a}', overdue_note: 'Просрочка больше 7 дней: новые долги брать нельзя, опыт за долги не идёт.',
    chk_h: 'Мои ссылки-чеки', chk_none: 'Открытых чеков нет', chk_cancel: 'Отменить', chk_cancelled: 'Чек отменён', chk_offer: 'Вам предлагают {p} % и {s}', chk_agree: 'Согласиться', chk_refuse: 'Отказаться',
    chk_st_sozdan: 'ждёт получателя', chk_st_predlozhen: 'ждёт вашего ответа', chk_agreed: 'Долг открыт', chk_refused: 'Отказ принят, деньги вернулись дающему',
    k_perevod: 'Перевод', k_prosba: 'Просьба в долг', k_zaym: 'Предложение долга',
    nt_h: 'Уведомления', nt_none: 'Пока тихо',
    vosst_warn: 'Кто-то восстанавливает доступ к кабинету. Если это не вы — отмените.', vosst_cancel: 'Это не я, отменить', vosst_cancelled: 'Заявка отменена',
    closed_until: 'Переводы и долги закрыты до {t} (после восстановления доступа).',
    name_h: 'Имя кошелька', name_p: 'Короткое имя вместо номера: чем короче, тем дороже. Покупается один раз, навсегда. Игровые доллары за настоящие деньги не продаются.',
    name_price: 'цена была бы {p} $', pr_korotkoe: 'Введите имя: от 4 до 24 знаков', pr_rezerv: 'Имена из 1–3 знаков в резерве', pr_dlinnoe: 'Слишком длинное: не больше 24 знаков', pr_znaki: 'Только a–z, 0–9 и дефис, не с краёв', pr_zapret: 'Такое имя нельзя',
    name_ph: 'например, neon', name_free: 'Свободно · {p} $', name_busy: 'Занято', name_buy: 'Купить — скоро', name_soon: 'Покупка имён скоро откроется.',
    logout: 'Выйти', logout_all: 'Выйти на всех устройствах', logged_out: 'Вы вышли из кабинета',
    /* отправка */
    send_h: 'Отправить другу', t_perevod: 'Отправить', t_zaym: 'Дать в долг', t_prosba: 'Попросить в долг', f_summa: 'Сумма, $', f_podpis: 'Подпись (по желанию)', f_podpis_ph: 'Например, «На кофе»',
    f_procent: 'Процент', f_srok: 'Вернуть до', srok_note: 'Срок долга — 30 дней, процент начисляется сразу и один раз.',
    prosba_note: 'Процент назначит тот, кто даёт в долг. Вы увидите его и согласитесь или откажетесь. Деньги пока не двигаются.',
    perevod_note: 'Сумма сразу замораживается. Не заберут за 7 дней — вернётся к вам.', zaym_note: 'Сумма замораживается до ответа.',
    avail: 'Свободно в кабинете: {a}', low_free: 'Не хватает свободных денег. Пополните кабинет.', make: 'Создать чек', ready_h: 'Чек готов', ready_p: 'Отправьте ссылку другу. Она сработает один раз и живёт 7 дней.',
    share: 'Поделиться', share_tg: 'Telegram', share_wa: 'WhatsApp', share_copy: 'Копировать ссылку', share_ig: 'Instagram: скопируйте ссылку и вставьте в сообщение или историю.', share_text: 'dofamart: вам чек',
    sum_ph: 'Сумма', chek_alt: 'Карточка-чек',
    /* получатель */
    inc_perevod: 'Вам отправили {s}', inc_zaym: 'Вам предлагают {s} в долг', inc_prosba: 'У вас просят {s} в долг', inc_from: 'от {a}',
    inc_pct: 'Процент', inc_due: 'Вернуть через 30 дней', inc_back: 'К возврату', inc_accept: 'Принять', inc_decline: 'Отклонить', inc_give: 'Дать в долг',
    inc_new: 'Новичку — подарок 100 000 $ за регистрацию по ссылке друга.', inc_have: 'У меня уже есть кабинет', inc_dead_h: 'Ссылка не работает', inc_dead: 'Ссылка уже использована, отменена или истекла. Попросите друга прислать новую.',
    inc_own: 'Это ваша ссылка. Отправьте её другу — сами её принять нельзя.', inc_loading: 'Открываем чек…',
    inc_p_sum: 'Сколько дать, $', inc_p_pct: 'Ваш процент (0–30 %)', inc_p_note: 'Сумма замораживается. Если процент больше нуля, ответит просивший: согласится или откажется.',
    done_perevod: 'Деньги получены', done_zaym: 'Долг открыт', done_prosba0: 'Долг открыт, деньги отправлены', done_prosba: 'Предложение отправлено. Ждём ответа просившего.', done_decline: 'Чек отклонён',
    done_cab: 'Открыть кабинет', done_close: 'На страницу',
    /* уведомления */
    n_perevod_prishel: 'Вам пришёл перевод {s} от {a}', n_chek_poluchen: '{a} получил ваш чек на {s}', n_chek_otklonen: 'Ваш чек отклонён, деньги вернулись', n_chek_istek: 'Срок чека истёк, деньги вернулись',
    n_podarok: 'Подарок новичку зачислен: {s}', n_dolg_predlozhen: '{a} даёт вам {s} под {p} %. Ответьте в «Моих ссылках»', n_dolg_otkaz: '{a} отказался от долга, деньги вернулись',
    n_dolg_vydan: 'Вы дали в долг {s} — {a}', n_dolg_poluchen: 'Вы взяли в долг {s} у {a}, к возврату {k}', n_dolg_chast: '{a} вернул часть долга: {s}', n_dolg_pogashen: '{a} полностью вернул долг',
    n_dolg_proshchen: '{a} простил вам долг', n_dolg_napomnil: '{a} напоминает о долге: осталось {s}',
    n_srok_skoro: 'Долг: срок через 3 дня, осталось {s}', n_srok_segodnya: 'Долг: срок сегодня, осталось {s}', n_srok_over: 'Долг просрочен, осталось {s}',
    n_prosrochen: 'Ваш должник просрочил долг, осталось {s}', n_vosstanovlenie: 'Заявка на восстановление доступа. Если это не вы — отмените',
    n_until: ' до {d}', a_dolg_vydan: '{a} должен вернуть вам {s}{u}', a_dolg_poluchen: 'Верните {a} {s}{u}', a_dolg_chast: '{a} вернул часть долга: {s}', a_dolg_pogashen: '{a} вернул долг полностью: {s}',
    a_dolg_proshchen: '{a} простил вам долг: {s}', a_dolg_napomnil: '{a} напоминает о долге {s}{u}', a_dolg_prosrochen: '{a} просрочил долг {s}',
    a_srok_skoro: 'Скоро срок долга {a}: {s}{u}', a_srok_segodnya: 'Сегодня срок долга {a}: {s}', a_srok_over: 'Долг {a} просрочен: {s}',
    n_other: 'Новое событие', n_read: 'Отметить прочитанным',
    /* прочее */
    tg_note: 'Напоминания о долгах в боте', soon: 'Скоро'
  },
  en: {
    cab: 'Account', cab_aria: 'Personal account', send: 'Send to a friend', send_s: 'Friend', close: 'Close', back: 'Back', cancel: 'Cancel', ok: 'Done',
    copy: 'Copy', copied: 'Copied', cp_fail: 'Could not copy',
    more_cab: 'Personal account', more_cab_s: 'Address, debts, notifications',
    err_set: 'No connection to the account service. Try again later.', err_sboy: 'Something broke, try again later.', err_zapros: 'The service rejected this page.', err_vhod: 'Wrong number or password.',
    err_mnogo: 'Too many attempts, please wait.', err_parol_dlina: 'Password: 10 characters or more.', err_parol_chastyy: 'This password is too common, pick another.',
    err_voprosy: 'Pick three different questions, at least one with a number.', err_ne_sovpalo: 'The answers did not match.', err_vosst_pauza: 'Next attempt: {do}.',
    err_telegram: 'Telegram sign-in is unavailable right now.', err_summa: 'Check the amount.', err_procent: 'Interest: 0 to 30.', err_podpis: 'Check the note.',
    err_ne_hvataet: 'Not enough free money in the account.', err_limit: 'At your level you can add {mozhno} more.', err_potolok: 'The $13M cap is reached.',
    err_perevody_zakryty: 'Transfers open {do} (after access recovery).', err_prosrochka: 'Repay the overdue debt first.',
    err_net: 'Not found.', err_sebe: 'Not to yourself.', err_chek_used: 'This cheque is already used or void.', err_mnogo_chekov: '20 open cheques: wait or cancel some.',
    err_nuzhen_vhod: 'Please sign in.', err_skoro: 'Coming soon.', err_obshchee: 'Did not work. Try again.',
    login_h: 'Sign in', login_p: 'Account number and password. The account is for sending money to friends and borrowing; trading stays on this page.',
    f_adres: 'Account number', f_adres_ph: 'id1001', f_parol: 'Password', f_parol2: 'Password again', f_new_parol: 'New password', show: 'Show', hide: 'Hide',
    login_go: 'Sign in', to_reg: 'Create an account', to_login: 'I already have an account', forgot: 'Forgot the password?', tg_go: 'Sign in with Telegram', g_go: 'Sign in with Google', g_soon: 'soon',
    tg_off: 'Telegram sign-in is switched off on the server.',
    reg_h: 'New account', reg_p1: 'Step 1 of 2 · password', reg_p2: 'Step 2 of 2 · three security questions',
    reg_pw_hint: '10+ characters. A long phrase you can remember is best. Your browser will offer to save it: accept.',
    reg_warn_h: 'Save the password', reg_warn: 'We know no email and no phone. If you lose the password and the answers, and Telegram is not linked, the account cannot be restored.',
    reg_next: 'Next', reg_go: 'Create account', reg_gift: 'A gift of $100,000 for signing up by a friend’s link. You can trade with it at once; sending opens after three quests.',
    pw_mismatch: 'Passwords do not match.', pw_short: 'Password: 10 characters or more.',
    q_intro: 'Pick three different questions and answer with buttons. One must be a number question (house or mother’s birthday). The answers are needed if you forget the password; remember which questions you chose.',
    q_pick: 'Questions', q_chosen: 'Chosen {n} of 3', q_answer: 'Your answer', q_need: 'Answer all three questions.', q_num_need: 'At least one question with a number is required.',
    q_dom_ph: '0–999', q_month: 'Month', q_day: 'Day', q_set: 'answered',
    saved_h: 'Account created', saved_adres: 'Your account number', saved_p: 'Write down the number and the password. You need the number to sign in; friends send money to it.',
    saved_gift: 'The $100,000 gift is credited: trade with it at once, send it after three quests.', saved_go: 'Open the account', saved_chek: 'Open the check', saved_store: 'Save in browser', saved_stored: 'The browser got the number + password pair',
    rec_h: 'Access recovery', rec_p: 'Enter the account number, answer the three questions chosen at sign-up and set a new password.',
    rec_honest: 'The new password starts working in 24 hours, and for a further day transfers and debts stay closed. All that time the account shows a “Not me” warning: the owner can cancel the request. The old password works until then.',
    rec_next: 'Show questions', rec_q_intro: 'Answer these three questions, they were chosen at sign-up.', rec_go: 'Send the request', rec_ok_h: 'Request accepted', rec_ok: 'The new password starts working {t}. Until then use the old one.',
    cab_h: 'Personal account', level: 'Level', xp: '{x} pts', next_at: 'next level: {x}', your_adres: 'Your account number', adres_s: 'Friends send money to it',
    w_h: 'Account money', w_free: 'Free', w_hold: 'Held in cheques', w_gift: 'Newcomer gift', w_gift_net: 'none', w_gift_zakryt: 'tradable now, sendable after three quests', w_gift_otkryt: 'open, now ordinary money',
    w_game: 'Game balance (on this page)', two_h: 'Two wallets: what differs', two_btn: 'How it works',
    two_game_h: 'Game balance', two_game: 'Lives in this browser. You trade stocks, gold and crypto with it on this page. It is play money, so it is never sent or lent.',
    two_cab_h: 'Account wallet', two_cab: 'Lives on the server under your number. You send money to friends and borrow with it. Nothing moves from trading into the account or back.',
    two_fill_h: 'How to top up the account', two_fill: 'Press “Top up” in the account: the sum is credited on the server within your level’s limit (like the ATM on the page). Money also arrives as a newcomer gift and as transfers from friends.',
    fill: 'Top up the account', fill_h: 'Top up the account', fill_p: 'The sum is credited to the account. The limit is your level’s limit.', fill_go: 'Top up', fill_ok: 'Account topped up',
    owe_h: 'I owe', owed_h: 'Owed to me', none_owe: 'No debts', none_owed: 'Nobody owes you',
    left: 'Left', pct: 'Interest', due: 'Due', d_left: '{n} {w} left', d_today: 'due today', d_over: 'overdue by {n} {w}',
    w_den: ['day', 'days', 'days'], repay: 'Repay', repay_part: 'Repay part', remind: 'Remind', forgive: 'Forgive', forgive_q: 'Forgive the debt? The money will not come back.', yes: 'Yes',
    part_ph: 'Amount, $', part_go: 'Repay', repaid: 'Debt updated', reminded: 'Reminder sent', forgiven: 'Debt forgiven',
    to_who: 'To: {a}', from_who: 'From: {a}', overdue_note: 'Overdue by more than 7 days: no new debts, no points for debts.',
    chk_h: 'My cheque links', chk_none: 'No open cheques', chk_cancel: 'Cancel', chk_cancelled: 'Cheque cancelled', chk_offer: 'Offered: {p} % and {s}', chk_agree: 'Agree', chk_refuse: 'Decline',
    chk_st_sozdan: 'waiting for the recipient', chk_st_predlozhen: 'waiting for your answer', chk_agreed: 'Debt opened', chk_refused: 'Declined, the money went back to the lender',
    k_perevod: 'Transfer', k_prosba: 'Loan request', k_zaym: 'Loan offer',
    nt_h: 'Notifications', nt_none: 'All quiet',
    vosst_warn: 'Someone is recovering access to this account. If it is not you, cancel it.', vosst_cancel: 'Not me, cancel', vosst_cancelled: 'Request cancelled',
    closed_until: 'Transfers and debts are closed until {t} (after access recovery).',
    name_h: 'Wallet name', name_p: 'A short name instead of the number: the shorter, the pricier. Bought once, forever. Play dollars are never sold for real money.',
    name_price: 'it would cost ${p}', pr_korotkoe: 'Enter a name: 4 to 24 characters', pr_rezerv: 'Names of 1–3 characters are reserved', pr_dlinnoe: 'Too long: 24 characters at most', pr_znaki: 'Only a–z, 0–9 and hyphen, not at the edges', pr_zapret: 'This name is not allowed',
    name_ph: 'e.g. neon', name_free: 'Free · ${p}', name_busy: 'Taken', name_buy: 'Buy — soon', name_soon: 'Name sales open soon.',
    logout: 'Sign out', logout_all: 'Sign out everywhere', logged_out: 'Signed out',
    send_h: 'Send to a friend', t_perevod: 'Send', t_zaym: 'Lend', t_prosba: 'Ask for a loan', f_summa: 'Amount, $', f_podpis: 'Note (optional)', f_podpis_ph: 'e.g. “For coffee”',
    f_procent: 'Interest', f_srok: 'Due', srok_note: 'A loan lasts 30 days, interest is added at once, one time.',
    prosba_note: 'The lender sets the interest. You will see it and agree or decline. No money moves yet.',
    perevod_note: 'The sum is frozen at once. If nobody takes it in 7 days it returns to you.', zaym_note: 'The sum is frozen until the answer.',
    avail: 'Free in the account: {a}', low_free: 'Not enough free money. Top up the account.', make: 'Create cheque', ready_h: 'Cheque is ready', ready_p: 'Send the link to a friend. It works once and lives 7 days.',
    share: 'Share', share_tg: 'Telegram', share_wa: 'WhatsApp', share_copy: 'Copy link', share_ig: 'Instagram: copy the link and paste it into a message or story.', share_text: 'dofamart: a cheque for you',
    sum_ph: 'Amount', chek_alt: 'Cheque card',
    inc_perevod: 'You were sent {s}', inc_zaym: 'You are offered {s} as a loan', inc_prosba: 'You are asked for {s} as a loan', inc_from: 'from {a}',
    inc_pct: 'Interest', inc_due: 'Repay in 30 days', inc_back: 'To repay', inc_accept: 'Accept', inc_decline: 'Decline', inc_give: 'Lend',
    inc_new: 'Newcomers get a $100,000 gift for signing up by a friend’s link.', inc_have: 'I already have an account', inc_dead_h: 'The link does not work', inc_dead: 'The link is used, cancelled or expired. Ask your friend for a new one.',
    inc_own: 'This is your own link. Send it to a friend: you cannot accept it yourself.', inc_loading: 'Opening the cheque…',
    inc_p_sum: 'How much to lend, $', inc_p_pct: 'Your interest (0–30 %)', inc_p_note: 'The sum is frozen. If the interest is above zero, the requester answers: agrees or declines.',
    done_perevod: 'Money received', done_zaym: 'Debt opened', done_prosba0: 'Debt opened, money sent', done_prosba: 'Offer sent. Waiting for the requester.', done_decline: 'Cheque declined',
    done_cab: 'Open the account', done_close: 'Back to the page',
    n_perevod_prishel: 'Transfer of {s} from {a}', n_chek_poluchen: '{a} took your cheque for {s}', n_chek_otklonen: 'Your cheque was declined, money returned', n_chek_istek: 'The cheque expired, money returned',
    n_podarok: 'Newcomer gift credited: {s}', n_dolg_predlozhen: '{a} lends you {s} at {p} %. Answer in “My cheque links”', n_dolg_otkaz: '{a} declined the loan, money returned',
    n_dolg_vydan: 'You lent {s} to {a}', n_dolg_poluchen: 'You borrowed {s} from {a}, to repay {k}', n_dolg_chast: '{a} repaid part of the debt: {s}', n_dolg_pogashen: '{a} repaid the debt in full',
    n_dolg_proshchen: '{a} forgave your debt', n_dolg_napomnil: '{a} reminds you about a debt: {s} left',
    n_srok_skoro: 'Debt due in 3 days, {s} left', n_srok_segodnya: 'Debt due today, {s} left', n_srok_over: 'Debt overdue, {s} left',
    n_prosrochen: 'Your borrower is overdue, {s} left', n_vosstanovlenie: 'Access recovery request. If it is not you, cancel it',
    n_until: ' by {d}', a_dolg_vydan: '{a} owes you {s}{u}', a_dolg_poluchen: 'Repay {a} {s}{u}', a_dolg_chast: '{a} repaid part of the debt: {s}', a_dolg_pogashen: '{a} repaid the debt in full: {s}',
    a_dolg_proshchen: '{a} forgave your debt: {s}', a_dolg_napomnil: '{a} reminds you about a debt of {s}{u}', a_dolg_prosrochen: '{a} is overdue on a debt of {s}',
    a_srok_skoro: 'Debt to {a} is due soon: {s}{u}', a_srok_segodnya: 'Debt to {a} is due today: {s}', a_srok_over: 'Debt to {a} is overdue: {s}',
    n_other: 'New event', n_read: 'Mark as read',
    tg_note: 'Debt reminders in the bot', soon: 'Soon'
  }
};
function x(k, o) {
  var d = TX[lang()], s = d[k] != null ? d[k] : (TX.ru[k] != null ? TX.ru[k] : k);
  if (typeof s !== 'string') return s;
  return s.replace(/\{(\w+)\}/g, function (m, a) { return o && o[a] != null ? o[a] : ''; });
}

/* ---------- security questions: numbers are the order of this list — it must never change ---------- */
var QS = {
  dom: { num: 1, ru: 'Номер дома или квартиры, где прошло детство', en: 'House or flat number of your childhood home' },
  mama: { num: 1, ru: 'День и месяц рождения мамы', en: 'Day and month of your mother’s birthday' },
  mashina: { ru: 'Первая марка машины в семье', en: 'First car brand in the family',
    o: 'не было|none;Lada (ВАЗ)|Lada;Москвич|Moskvich;Волга|Volga;УАЗ|UAZ;ЗАЗ|ZAZ;Toyota;Honda;Nissan;Mazda;Mitsubishi;Subaru;Suzuki;Daihatsu;Lexus;Hyundai;Kia;Daewoo;Chevrolet;Ford;Opel;Volkswagen;Audi;BMW;Mercedes-Benz;Renault;Peugeot;Citroën;Fiat;Škoda;Seat;Volvo;Saab;Jeep;Dodge;Chrysler;Tesla;Porsche;Land Rover;другая|other' },
  bludo: { ru: 'Любимое блюдо в детстве', en: 'Favourite dish as a child',
    o: 'борщ|borscht;пельмени|dumplings;плов|pilaf;блины|pancakes;пицца|pizza;паста|pasta;суши|sushi;хинкали|khinkali;хачапури|khachapuri;шашлык|barbecue;котлеты|cutlets;жареная картошка|fried potatoes;макароны|noodles;омлет|omelette;оладьи|fritters;сырники|cheese pancakes;гречка|buckwheat;окрошка|okroshka;солянка|solyanka;манты|manti;лагман|lagman;голубцы|cabbage rolls;рыба|fish;курица|chicken;бургер|burger;оливье|olivier salad;сладости|sweets;мороженое|ice cream;пирожки|pies;другое|other' },
  more: { ru: 'Город или курорт, где вы впервые увидели море', en: 'Where you first saw the sea',
    o: 'Сочи|Sochi;Анапа|Anapa;Геленджик|Gelendzhik;Туапсе|Tuapse;Ейск|Yeysk;Ялта|Yalta;Евпатория|Yevpatoria;Севастополь|Sevastopol;Феодосия|Feodosia;Алушта|Alushta;Судак|Sudak;Керчь|Kerch;Одесса|Odesa;Батуми|Batumi;Кобулети|Kobuleti;Поти|Poti;Сухум|Sukhumi;Гагры|Gagra;Пицунда|Pitsunda;Баку|Baku;Юрмала|Jurmala;Паланга|Palanga;Варна|Varna;Бургас|Burgas;Анталья|Antalya;Аланья|Alanya;Бодрум|Bodrum;Шарм-эш-Шейх|Sharm el-Sheikh;Хургада|Hurghada;Дубай|Dubai;Тель-Авив|Tel Aviv;Кипр|Cyprus;Барселона|Barcelona;Ницца|Nice;Римини|Rimini;не видел|not yet' },
  sport: { ru: 'Любимый вид спорта', en: 'Favourite sport',
    o: 'футбол|football;хоккей|hockey;баскетбол|basketball;волейбол|volleyball;теннис|tennis;настольный теннис|table tennis;бадминтон|badminton;бокс|boxing;борьба|wrestling;дзюдо|judo;карате|karate;самбо|sambo;плавание|swimming;лёгкая атлетика|athletics;гимнастика|gymnastics;фигурное катание|figure skating;лыжи|skiing;биатлон|biathlon;велоспорт|cycling;шахматы|chess;гандбол|handball;регби|rugby;бейсбол|baseball;гольф|golf;стрельба|shooting;тяжёлая атлетика|weightlifting;скалолазание|climbing;сёрфинг|surfing;автоспорт|motorsport;никакой|none' },
  zhivotnoe: { ru: 'Первое домашнее животное', en: 'First pet',
    o: 'кошка|cat;собака|dog;хомяк|hamster;попугай|parrot;рыбки|fish;черепаха|turtle;кролик|rabbit;морская свинка|guinea pig;крыса|rat;мышь|mouse;шиншилла|chinchilla;канарейка|canary;ёж|hedgehog;хорёк|ferret;ящерица|lizard;змея|snake;лошадь|horse;корова|cow;коза|goat;курица|hen;голубь|pigeon;паук|spider;не было|none;другое|other' },
  predmet: { ru: 'Любимый предмет в школе', en: 'Favourite school subject',
    o: 'математика|maths;алгебра|algebra;геометрия|geometry;русский язык|Russian;литература|literature;физика|physics;химия|chemistry;биология|biology;география|geography;история|history;обществознание|social studies;информатика|computer science;английский|English;другой язык|other language;физкультура|PE;музыка|music;рисование|art;труд|crafts;астрономия|astronomy;нет любимого|none' }
};
Object.keys(QS).forEach(function (k) { var q = QS[k]; if (q.o) q.l = q.o.split(';').map(function (s) { var p = s.split('|'); return { ru: p[0], en: p[1] || p[0] }; }); });
var MONTHS = {
  ru: ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
};
var CUM = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335], MDAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/* ---------- service calls ---------- */
var tgToken = null, me = null, meAt = 0;
function api(method, path, body) {
  var o = { method: method, credentials: 'include', headers: {} };
  if (tgToken) o.headers.Authorization = 'Dofa ' + tgToken;
  if (method === 'POST') { o.headers['Content-Type'] = 'application/json'; o.headers['X-Dofa'] = '1'; o.body = JSON.stringify(body || {}); }
  return fetch(BASE + '/api' + path, o).then(function (r) {
    return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status, d: d || {} }; });
  }, function () { return { ok: false, status: 0, d: { oshibka: 'set' } }; });
}
function errText(r) {
  var d = r.d || {}, c = d.oshibka || 'set', date = function (ms) { try { return new Date(ms).toLocaleString(lang() === 'en' ? 'en-GB' : 'ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };
  var m = {
    set: 'err_set', sboy: 'err_sboy', zapros: 'err_zapros', istochnik: 'err_zapros', json: 'err_zapros', bolshoe_telo: 'err_zapros', vhod: 'err_vhod', mnogo_popytok: 'err_mnogo', mnogo_zaprosov: 'err_mnogo',
    parol_dlina: 'err_parol_dlina', parol_chastyy: 'err_parol_chastyy', voprosy: 'err_voprosy', nuzhen_chislovoy: 'err_voprosy', ne_sovpalo: 'err_ne_sovpalo', vosst_pauza: 'err_vosst_pauza',
    telegram_vyklyuchen: 'err_telegram', telegram_podpis: 'err_telegram', google_vyklyuchen: 'err_telegram', summa: 'err_summa', procent: 'err_procent', podpis: 'err_podpis', podpis_dlinnaya: 'err_podpis',
    ne_hvataet: 'err_ne_hvataet', limit_urovnya: 'err_limit', potolok: 'err_potolok', perevody_zakryty: 'err_perevody_zakryty', est_prosrochka: 'err_prosrochka', net_adresa: 'err_net', net_cheka: 'err_net',
    net_dolga: 'err_net', net_kabineta: 'err_net', sebe_nelzya: 'err_sebe', svoy_chek: 'err_sebe', chek_uzhe_ispolzovan: 'err_chek_used', mnogo_chekov: 'err_mnogo_chekov', nuzhen_vhod: 'err_nuzhen_vhod', skoro: 'err_skoro'
  };
  return x(m[c] || 'err_obshchee', { do: d.do ? date(d.do) : '', mozhno: d.mozhno != null ? usd(d.mozhno) : '' });
}

/* a guest never calls /kabinet (no 401 noise in the console): the flag is set after a sign-in */
function flag(on) { try { if (on) localStorage.setItem('dofa_kab_in', '1'); else localStorage.removeItem('dofa_kab_in'); } catch (e) {} }
function flagged() { try { return localStorage.getItem('dofa_kab_in') === '1'; } catch (e) { return false; } }
function refreshMe(quiet) {
  return api('GET', '/kabinet').then(function (r) {
    if (r.ok) { me = r.d; meAt = Date.now(); flag(1); } else if (r.status === 401) { me = null; flag(0); }
    paintBadge();
    if (!quiet && ov && !ov.hidden) render();
    return r;
  });
}

/* ---------- page furniture: header button, send button, row in the "More" sheet ---------- */
var hdrBtn, hdrSend, fab, moreRow;
var ICON_USER = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.5" r="3.6"/><path d="M5 20c.6-3.8 3.4-6 7-6s6.4 2.2 7 6"/></svg>';
var ICON_SEND = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l16-7-5.5 15-3-6.2z"/><path d="M11.5 13.8L20 5"/></svg>';
function mountFurniture() {
  var r = document.querySelector('.hdr-r');
  if (r && !hdrBtn) {
    hdrSend = el('<button class="kab-hsend" type="button" data-kab="send">' + ICON_SEND + '<span></span></button>');
    hdrBtn = el('<button class="ibtn kab-hbtn" type="button" data-kab="cab">' + ICON_USER + '<i class="kab-dot" hidden></i></button>');
    var anchor = document.getElementById('lvBadge') || r.firstChild;
    r.insertBefore(hdrSend, anchor); r.insertBefore(hdrBtn, document.getElementById('skinBtn'));
  }
  if (!fab) { fab = el('<button class="kab-fab" type="button" data-kab="send">' + ICON_SEND + '<span></span></button>'); document.body.appendChild(fab); }
  var mc = document.querySelector('.more-card');
  if (mc && !moreRow) {
    moreRow = el('<button class="more-row kab-more" type="button" data-kab="cab">' + ICON_USER + '<span class="more-tx"><b></b><i></i></span><span class="more-go" aria-hidden="true">→</span></button>');
    mc.insertBefore(moreRow, mc.querySelector('.more-row'));
  }
  paintFurniture();
}
function paintFurniture() {
  if (hdrBtn) hdrBtn.setAttribute('aria-label', x('cab_aria'));
  [hdrSend, fab].forEach(function (b) { if (b) { b.querySelector('span').textContent = x('send'); b.setAttribute('aria-label', x('send')); } });
  if (moreRow) { moreRow.querySelector('b').textContent = x('more_cab'); moreRow.querySelector('i').textContent = x('more_cab_s'); }
  paintBadge();
}
function paintBadge() {
  var d = hdrBtn && hdrBtn.querySelector('.kab-dot'); if (!d) return;
  var hot = me && (me.neprochitano > 0 || me.est_prosrochka || me.vosstanovlenie);
  d.hidden = !hot; d.classList.toggle('red', !!(me && (me.est_prosrochka || me.vosstanovlenie)));
}

/* ---------- overlay ---------- */
var ov, card, scr = 'cab', st = {};
function ensureOv() {
  if (ov) return;
  ov = el('<div class="modal kab-ov" hidden><div class="modal-card kab-card" role="dialog" aria-modal="true" tabindex="-1"></div></div>');
  card = ov.firstElementChild; document.body.appendChild(ov);
  ov.addEventListener('click', function (e) {
    if (e.target === ov && !st.lock) { closeOv(); return; }
    var b = e.target.closest ? e.target.closest('[data-kb]') : null;
    if (b && !b.disabled) act(b.getAttribute('data-kb'), b, e);
  });
  ov.addEventListener('input', onInput);
  ov.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Escape' && !st.lock) closeOv(); if (e.key === 'Enter' && e.target.tagName === 'INPUT') { var f = card.querySelector('[data-enter]'); if (f && !f.disabled) { e.preventDefault(); act(f.getAttribute('data-kb'), f, e); } } });
  ov.addEventListener('keyup', function (e) { e.stopPropagation(); });
}
function openOv(name, o) {
  ensureOv(); scr = name; st = o || {}; ov.hidden = false; document.body.classList.add('kab-open'); render(true);
  try { card.focus({ preventScroll: true }); } catch (e) {}
}
function closeOv() { if (!ov) return; ov.hidden = true; document.body.classList.remove('kab-open'); pending = null; }
var pending = null;
function setBusy(b, on) { if (b) { b.disabled = !!on; b.classList.toggle('busy', !!on); } }
function showErr(msg) { var e = card && card.querySelector('.kab-err'); if (e) { e.textContent = msg || ''; e.hidden = !msg; } }

function head(title, sub, back) {
  return '<div class="kab-top">' + (back ? '<button class="kab-x" type="button" data-kb="' + back + '" aria-label="' + x('back') + '">←</button>' : '<i></i>') +
    '<h2 id="modalTitle">' + title + '</h2><button class="kab-x" type="button" data-kb="close" aria-label="' + x('close') + '">×</button></div>' + (sub ? '<p class="kab-sub">' + sub + '</p>' : '');
}
function render(fresh) {
  if (!ov || ov.hidden) return;
  var top = card.scrollTop, fn = { login: vLogin, reg: vReg, saved: vSaved, rec: vRec, recok: vRecOk, cab: vCab, send: vSend, ready: vReady, inc: vInc, done: vDone, fill: vFill, two: vTwo }[scr] || vCab;
  card.innerHTML = fn();
  card.setAttribute('aria-label', x('cab'));
  if (!fresh) card.scrollTop = top;
  var f = card.querySelector('[data-focus]'); if (f && fresh) { try { f.focus({ preventScroll: true }); } catch (e) {} }
}
var errHtml = '<p class="kab-err" role="alert" hidden></p>';

/* ---------- login / registration / recovery ---------- */
function pwField(id, label, ac, extra) {
  return '<label class="kab-f"><span>' + label + '</span><span class="kab-pw"><input id="' + id + '" type="password" autocomplete="' + ac + '" minlength="10" maxlength="128" ' + (extra || '') + ' value="' + esc(st[id] || '') + '"><button type="button" class="kab-eye" data-kb="eye" data-for="' + id + '">' + x('show') + '</button></span></label>';
}
function tgAvail() { try { return !!(window.Telegram && Telegram.WebApp && Telegram.WebApp.initData); } catch (e) { return false; } }
function vLogin() {
  return head(x('login_h'), x('login_p')) +
    '<form class="kab-form" onsubmit="return false" autocomplete="on">' +
    '<label class="kab-f"><span>' + x('f_adres') + '</span><input id="adres" name="username" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" inputmode="text" maxlength="40" placeholder="' + x('f_adres_ph') + '" value="' + esc(st.adres || '') + '" data-focus></label>' +
    pwField('parol', x('f_parol'), 'current-password') + errHtml +
    '<button class="btn-gold kab-wide" type="submit" data-kb="login" data-enter>' + x('login_go') + '</button></form>' +
    '<div class="kab-alt">' +
    (tgAvail() ? '<button class="btn-ghost kab-wide" type="button" data-kb="tg">' + x('tg_go') + '</button>' : '') +
    '<button class="btn-ghost kab-wide kab-soon" type="button" disabled>' + x('g_go') + ' <em>' + x('g_soon') + '</em></button>' +
    '<button class="btn-ghost kab-wide" type="button" data-kb="to-reg">' + x('to_reg') + '</button>' +
    '<button class="kab-link" type="button" data-kb="to-rec">' + x('forgot') + '</button></div>';
}
function qPickerHtml(s) {
  var h = '<p class="kab-note">' + x('q_intro') + '</p><div class="kab-lbl">' + x('q_pick') + ' <b>' + x('q_chosen', { n: s.sel.length }) + '</b></div><div class="kab-qs">';
  s.order.forEach(function (c) {
    var q = QS[c]; if (!q) return;
    var on = s.sel.indexOf(c) >= 0, ans = s.ans[c];
    h += '<div class="kab-q' + (on ? ' on' : '') + '"><button type="button" class="kab-qh" data-kb="qsel" data-q="' + c + '" aria-pressed="' + on + '"><i class="kab-ck">' + (on ? '✓' : '') + '</i><span>' + esc(q[lang()]) + (q.num ? ' <em>№</em>' : '') + '</span>' + (on && ans != null ? '<b class="kab-set">' + x('q_set') + '</b>' : '') + '</button>';
    if (on) h += '<div class="kab-qa">' + qAnswerHtml(c, s) + '</div>';
    h += '</div>';
  });
  return h + '</div>';
}
function qAnswerHtml(c, s) {
  var q = QS[c], a = s.ans[c], L = lang();
  if (c === 'dom') return '<input class="kab-num" type="text" inputmode="numeric" autocomplete="off" maxlength="3" data-q="dom" placeholder="' + x('q_dom_ph') + '" value="' + (a != null ? a : '') + '">';
  if (c === 'mama') {
    var m = s.mm, h = '<div class="kab-chips">';
    MONTHS[L].forEach(function (n, i) { h += '<button type="button" class="kab-chip' + (m === i ? ' on' : '') + '" data-kb="mon" data-i="' + i + '">' + n + '</button>'; });
    h += '</div>';
    if (m != null) { h += '<div class="kab-chips days">'; for (var d = 1; d <= MDAYS[m]; d++) h += '<button type="button" class="kab-chip' + (s.dd === d ? ' on' : '') + '" data-kb="day" data-i="' + d + '">' + d + '</button>'; h += '</div>'; }
    return h;
  }
  var h2 = '<div class="kab-chips opts">';
  q.l.forEach(function (o, i) { h2 += '<button type="button" class="kab-chip' + (a === i ? ' on' : '') + '" data-kb="opt" data-q="' + c + '" data-i="' + i + '">' + esc(o[L]) + '</button>'; });
  return h2 + '</div>';
}
function newQa() { return { order: Object.keys(QS), sel: [], ans: {}, mm: null, dd: null }; }
function qaPayload(s) {
  if (s.sel.length !== 3) return { err: x('q_need') };
  var out = [], num = false;
  for (var i = 0; i < 3; i++) { var c = s.sel[i], a = s.ans[c]; if (a == null || isNaN(a)) return { err: x('q_need') }; if (QS[c].num) num = true; out.push({ v: c, o: a }); }
  if (!num && !s.fixed) return { err: x('q_num_need') };
  return { otvety: out };
}
function vReg() {
  var s = st.qa, h = head(x('reg_h'), st.step === 2 ? x('reg_p2') : x('reg_p1'), st.step === 2 ? 'reg-back' : 'to-login');
  if (st.inv) h += '<p class="kab-gift">' + x('reg_gift') + '</p>';
  if (st.step === 2) {
    return h + qPickerHtml(s) + errHtml + '<button class="btn-gold kab-wide" type="button" data-kb="reg-go" data-enter>' + x('reg_go') + '</button>';
  }
  return h + '<form class="kab-form" onsubmit="return false" autocomplete="on">' +
    pwField('parol', x('f_parol'), 'new-password', 'data-focus') + pwField('parol2', x('f_parol2'), 'new-password') +
    '<p class="kab-note">' + x('reg_pw_hint') + '</p><div class="kab-warn"><b>' + x('reg_warn_h') + '.</b> ' + x('reg_warn') + '</div>' + errHtml +
    '<button class="btn-gold kab-wide" type="submit" data-kb="reg-next" data-enter>' + x('reg_next') + '</button></form>';
}
function vSaved() {
  return head(x('saved_h'), '') + '<div class="kab-adr"><span class="lbl">' + x('saved_adres') + '</span><b class="num" id="kabAdr">' + esc(st.adres) + '</b>' +
    '<button class="btn-ghost" type="button" data-kb="copy" data-v="' + esc(st.adres) + '">' + x('copy') + '</button></div><p class="kab-note">' + x('saved_p') + '</p>' +
    (st.podarok ? '<p class="kab-gift">' + x('saved_gift') + '</p>' : '') +
    (window.PasswordCredential ? '<button class="btn-ghost kab-wide" type="button" data-kb="store">' + x('saved_store') + '</button>' : '') +
    (st.tok ? '<button class="btn-gold kab-wide" type="button" data-kb="to-chek" data-enter>' + x('saved_chek') + '</button>' : '<button class="btn-gold kab-wide" type="button" data-kb="open-cab" data-enter>' + x('saved_go') + '</button>');
}
function qFixedHtml(s) {
  var h = '<p class="kab-note">' + x('rec_q_intro') + '</p><div class="kab-qs">';
  s.sel.forEach(function (c) { h += '<div class="kab-q on"><div class="kab-qh"><span>' + esc(QS[c][lang()]) + (QS[c].num ? ' <em>№</em>' : '') + '</span></div><div class="kab-qa">' + qAnswerHtml(c, s) + '</div></div>'; });
  return h + '</div>';
}
function vRec() {
  var s = st.qa, h = head(x('rec_h'), x('rec_p'), 'to-login') + '<label class="kab-f"><span>' + x('f_adres') + '</span><input id="adres" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="40" placeholder="' + x('f_adres_ph') + '" value="' + esc(st.adres || '') + '"' + (s.fixed ? ' readonly' : ' data-focus') + '></label>';
  if (!s.fixed) return h + errHtml + '<button class="btn-gold kab-wide" type="button" data-kb="rec-next" data-enter>' + x('rec_next') + '</button>';
  return h +
    qFixedHtml(s) + '<form class="kab-form" onsubmit="return false">' + pwField('parol', x('f_new_parol'), 'new-password') + '</form><div class="kab-warn">' + x('rec_honest') + '</div>' + errHtml +
    '<button class="btn-gold kab-wide" type="button" data-kb="rec-go">' + x('rec_go') + '</button>';
}
function vRecOk() {
  return head(x('rec_ok_h'), '') + '<p class="kab-note">' + x('rec_ok', { t: fmtDT(st.at) }) + '</p><button class="btn-gold kab-wide" type="button" data-kb="to-login">' + x('login_go') + '</button>';
}
function fmtDT(ms) { try { return new Date(ms).toLocaleString(lang() === 'en' ? 'en-GB' : 'ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }

/* ---------- cabinet ---------- */
function relDays(ms) {
  var n = Math.ceil((ms - Date.now()) / DAY), w = x('w_den');
  if (n > 0) return x('d_left', { n: n, w: plural(n, w[0], w[1], w[2]) });
  if (n === 0 || ms > Date.now() - DAY * 0) return x('d_today');
  n = -n; return x('d_over', { n: n, w: plural(n, w[0], w[1], w[2]) });
}
function debtRow(d, mine) {
  var late = d.prosrochen_dney > 0 || d.srok < Date.now() - DAY;
  var who = mine ? x('to_who', { a: esc(d.komu) }) : x('from_who', { a: esc(d.kto) });
  var left = d.srok > Date.now() ? relDays(d.srok) : (d.prosrochen_dney > 0 ? x('d_over', { n: d.prosrochen_dney, w: plural(d.prosrochen_dney, x('w_den')[0], x('w_den')[1], x('w_den')[2]) }) : x('d_today'));
  var h = '<div class="kab-debt' + (late ? ' late' : '') + '"><div class="kab-dh"><b class="num">' + esc(mine ? d.komu : d.kto) + '</b><span class="kab-dsum num">' + usd(d.ostatok) + '</span></div>' +
    '<div class="kab-dm"><span>' + x('pct') + ' ' + d.procent + ' %</span><span>' + x('due') + ' ' + fmtDate(d.srok) + '</span><span class="' + (late ? 'bad' : '') + '">' + left + '</span></div>';
  if (mine) {
    h += '<div class="kab-ra"><button class="btn-gold" type="button" data-kb="repay" data-d="' + d.dolg + '">' + x('repay') + '</button><button class="btn-ghost" type="button" data-kb="part" data-d="' + d.dolg + '">' + x('repay_part') + '</button></div>';
    if (st.part === d.dolg) h += '<div class="kab-inl"><input class="kab-num" id="partV" type="text" inputmode="decimal" autocomplete="off" placeholder="' + x('part_ph') + '" data-focus><button class="btn-gold" type="button" data-kb="part-go" data-d="' + d.dolg + '" data-enter>' + x('part_go') + '</button></div>';
  } else {
    h += '<div class="kab-ra"><button class="btn-ghost" type="button" data-kb="remind" data-d="' + d.dolg + '">' + x('remind') + '</button>' +
      (st.forgive === d.dolg ? '<button class="btn-ghost danger" type="button" data-kb="forgive-yes" data-d="' + d.dolg + '">' + x('yes') + ' · ' + x('forgive') + '</button>' : '<button class="btn-ghost" type="button" data-kb="forgive" data-d="' + d.dolg + '">' + x('forgive') + '</button>') + '</div>';
    if (st.forgive === d.dolg) h += '<p class="kab-note">' + x('forgive_q') + '</p>';
  }
  return h + '</div>';
}
function noteText(n) {
  var s = function (c) { return usd(c); }, a = n.kto || n.ot || n.komu || '', o = { s: s(n.summa || n.telo || n.ostatok || 0), a: esc(a), p: n.procent != null ? n.procent : '', k: s(n.k_vozvratu || 0) };
  var k = { perevod_prishel: 'n_perevod_prishel', chek_poluchen: 'n_chek_poluchen', chek_otklonen: 'n_chek_otklonen', chek_istek: 'n_chek_istek', podarok: 'n_podarok', dolg_predlozhen: 'n_dolg_predlozhen', dolg_otkaz: 'n_dolg_otkaz', dolg_vydan: 'n_dolg_vydan', dolg_poluchen: 'n_dolg_poluchen', dolg_chast: 'n_dolg_chast', dolg_pogashen: 'n_dolg_pogashen', dolg_proshchen: 'n_dolg_proshchen', dolg_napomnil: 'n_dolg_napomnil', dolg_prosrochen: 'n_prosrochen', vosstanovlenie: 'n_vosstanovlenie' }[n.vid];
  if (n.vid === 'dolg_srok') { var p = String(n.povod || ''); k = p === 'skoro' ? 'n_srok_skoro' : p === 'segodnya' ? 'n_srok_segodnya' : 'n_srok_over'; }
  if (k && n.adres && n.summa != null && /^dolg_/.test(n.vid)) {
    o.a = esc(n.adres); o.s = s(n.summa); o.u = n.srok ? x('n_until', { d: fmtDate(n.srok) }) : '';
    var ak = n.vid === 'dolg_srok' ? k.replace('n_srok_', 'a_srok_') : n.vid === 'dolg_prosrochen' ? 'a_dolg_prosrochen' : 'a_' + n.vid;
    if (TX.ru[ak]) return x(ak, o);
  }
  return x(k || 'n_other', o);
}
function vCab() {
  if (!me) return vLogin();
  var u = me.uroven || {}, w = me.koshelek || {}, game = 0, lvName = u.nazvanie;
  try { game = window.DofaSim.cash(); if (u.nomer) lvName = window.DofaSim.levelName(u.nomer - 1) || u.nazvanie; } catch (e) {}
  var h = head(x('cab_h'), '');
  if (me.vosstanovlenie) h += '<div class="kab-warn red"><span>' + x('vosst_warn') + '</span><button class="btn-ghost danger" type="button" data-kb="vosst-cancel">' + x('vosst_cancel') + '</button></div>';
  if (me.perevody_zakryty_do) h += '<div class="kab-warn">' + x('closed_until', { t: fmtDT(me.perevody_zakryty_do) }) + '</div>';
  if (me.est_prosrochka) h += '<div class="kab-warn red">' + x('overdue_note') + '</div>';
  h += '<div class="kab-adr"><span class="lbl">' + x('your_adres') + '</span><b class="num">' + esc(me.imya || me.adres) + '</b><button class="btn-ghost" type="button" data-kb="copy" data-v="' + esc(me.adres) + '">' + x('copy') + '</button></div>' +
    '<p class="kab-note">' + esc(me.imya ? me.adres + ' · ' : '') + x('adres_s') + '</p>' +
    '<div class="kab-lv"><span class="lbl">' + x('level') + '</span><b>' + (u.nomer || 1) + ' · ' + esc(lvName || '') + '</b><span class="kab-xp num">' + x('xp', { x: u.xp || 0 }) + (u.sleduyushchiy ? ' · ' + x('next_at', { x: u.sleduyushchiy }) : '') + '</span></div>';
  h += '<div class="kab-sec"><div class="kab-sh"><h3>' + x('w_h') + '</h3><button class="kab-link" type="button" data-kb="two">' + x('two_btn') + '</button></div>' +
    '<div class="kab-wal"><div><span class="lbl">' + x('w_free') + '</span><b class="num">' + usd(w.svobodno) + '</b></div><div><span class="lbl">' + x('w_hold') + '</span><b class="num">' + usd(w.uderzhano) + '</b></div>' +
    '<div><span class="lbl">' + x('w_gift') + '</span><b class="num">' + usd(w.podarok) + '</b><i>' + x(me.podarok === 'zakryt' ? 'w_gift_zakryt' : me.podarok === 'otkryt' ? 'w_gift_otkryt' : 'w_gift_net') + '</i></div></div>' +
    '<div class="kab-game"><span>' + x('w_game') + '</span><b class="num">' + usd(Math.round(game * 100)) + '</b></div>' +
    '<div class="kab-ra"><button class="btn-gold" type="button" data-kb="send">' + x('send') + '</button><button class="btn-ghost" type="button" data-kb="fill">' + x('fill') + '</button></div></div>';
  var owe = me.ya_dolzhen || [], owed = me.mne_dolzhny || [];
  h += '<div class="kab-sec"><h3>' + x('owe_h') + '</h3>' + (owe.length ? owe.map(function (d) { return debtRow(d, true); }).join('') : '<p class="kab-none">' + x('none_owe') + '</p>') + '</div>';
  h += '<div class="kab-sec"><h3>' + x('owed_h') + '</h3>' + (owed.length ? owed.map(function (d) { return debtRow(d, false); }).join('') : '<p class="kab-none">' + x('none_owed') + '</p>') + '</div>';
  var ch = me.cheki || [];
  h += '<div class="kab-sec"><h3>' + x('chk_h') + '</h3>';
  if (!ch.length) h += '<p class="kab-none">' + x('chk_none') + '</p>';
  ch.forEach(function (c) {
    var kind = x('k_' + (c.vid === 'zaym' ? 'zaym' : c.vid === 'prosba' ? 'prosba' : 'perevod'));
    h += '<div class="kab-chk"><div class="kab-dh"><b>' + kind + '</b><span class="kab-dsum num">' + usd(c.summa) + '</span></div><div class="kab-dm"><span>' + x('chk_st_' + (c.status === 'predlozhen' ? 'predlozhen' : 'sozdan')) + '</span>' + (c.istekaet ? '<span>→ ' + fmtDate(c.istekaet) + '</span>' : '') + '</div>';
    if (c.status === 'predlozhen' && c.predl_procent != null) {
      h += '<p class="kab-note">' + x('chk_offer', { p: c.predl_procent, s: usd(c.predl_summa || c.summa) }) + '</p><div class="kab-ra"><button class="btn-gold" type="button" data-kb="chk-yes" data-c="' + c.chek + '">' + x('chk_agree') + '</button><button class="btn-ghost" type="button" data-kb="chk-no" data-c="' + c.chek + '">' + x('chk_refuse') + '</button></div>';
    } else h += '<div class="kab-ra"><button class="btn-ghost" type="button" data-kb="chk-cancel" data-c="' + c.chek + '">' + x('chk_cancel') + '</button></div>';
    h += '</div>';
  });
  h += '</div>';
  var nt = me.uvedomleniya || [];
  h += '<div class="kab-sec"><div class="kab-sh"><h3>' + x('nt_h') + '</h3>' + (me.neprochitano ? '<button class="kab-link" type="button" data-kb="read">' + x('n_read') + '</button>' : '') + '</div>';
  if (!nt.length) h += '<p class="kab-none">' + x('nt_none') + '</p>';
  nt.slice(0, 12).forEach(function (n) {
    var late = n.vid === 'dolg_prosrochen' || (n.vid === 'dolg_srok' && /^prosrochen/.test(n.povod || ''));
    h += '<div class="kab-nt' + (n.novoe ? ' new' : '') + (late ? ' late' : '') + '"><span>' + noteText(n) + '</span><time>' + fmtDate(n.sozdan) + '</time></div>';
  });
  h += '</div>';
  h += '<div class="kab-sec"><h3>' + x('name_h') + '</h3><p class="kab-note">' + x('name_p') + '</p><div class="kab-inl"><input id="imya" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="24" placeholder="' + x('name_ph') + '"><button class="btn-ghost" type="button" disabled id="imyaBuy">' + x('name_buy') + '</button></div><p class="kab-note" id="imyaMsg" role="status"></p></div>';
  h += errHtml + '<div class="kab-ra end"><button class="btn-ghost" type="button" data-kb="logout">' + x('logout') + '</button><button class="kab-link" type="button" data-kb="logout-all">' + x('logout_all') + '</button></div>';
  return h;
}
function vTwo() {
  return head(x('two_h'), '', 'open-cab') + '<div class="kab-two"><div><h3>' + x('two_game_h') + '</h3><p>' + x('two_game') + '</p></div><div><h3>' + x('two_cab_h') + '</h3><p>' + x('two_cab') + '</p></div></div>' +
    '<div class="kab-sec"><h3>' + x('two_fill_h') + '</h3><p class="kab-note">' + x('two_fill') + '</p></div><button class="btn-gold kab-wide" type="button" data-kb="fill">' + x('fill') + '</button>';
}
function vFill() {
  return head(x('fill_h'), x('fill_p'), 'open-cab') + '<div class="kab-chips amts">' + [1000, 10000, 25000, 100000].map(function (a) { return '<button type="button" class="kab-chip" data-kb="fillamt" data-a="' + a + '">$' + grp(a) + '</button>'; }).join('') + '</div>' +
    '<label class="kab-f"><span>' + x('f_summa') + '</span><input id="fillV" class="kab-num" type="text" inputmode="numeric" autocomplete="off" placeholder="' + x('sum_ph') + '" data-focus></label>' + errHtml +
    '<button class="btn-gold kab-wide" type="button" data-kb="fill-go" data-enter>' + x('fill_go') + '</button>';
}

/* ---------- send to a friend ---------- */
function vSend() {
  var s = st.sf, free = me && me.koshelek ? me.koshelek.svobodno : 0, h = head(x('send_h'), '');
  h += '<div class="kab-seg" role="tablist">' + ['perevod', 'zaym', 'prosba'].map(function (v) { return '<button type="button" role="tab" aria-selected="' + (s.vid === v) + '" class="' + (s.vid === v ? 'on' : '') + '" data-kb="vid" data-v="' + v + '">' + x('t_' + v) + '</button>'; }).join('') + '</div>';
  h += '<label class="kab-f"><span>' + x('f_summa') + '</span><input id="sfSum" class="kab-num big" type="text" inputmode="numeric" autocomplete="off" maxlength="12" placeholder="' + x('sum_ph') + '" value="' + esc(s.summa) + '" data-focus></label>' +
    '<div class="kab-chips amts">' + [100, 1000, 5000, 10000].map(function (a) { return '<button type="button" class="kab-chip" data-kb="sfamt" data-a="' + a + '">$' + grp(a) + '</button>'; }).join('') + '</div>';
  if (s.vid !== 'prosba') h += '<p class="kab-note" id="sfAvail">' + x('avail', { a: usd(free) }) + '</p>';
  if (s.vid === 'zaym') {
    h += '<div class="kab-lbl">' + x('f_procent') + ' <b id="sfPctV">' + s.procent + ' %</b></div><div class="kab-chips">' + [0, 5, 10, 15, 20, 25, 30].map(function (p) { return '<button type="button" class="kab-chip' + (s.procent === p ? ' on' : '') + '" data-kb="pct" data-v="' + p + '">' + p + ' %</button>'; }).join('') + '</div>';
  }
  if (s.vid !== 'perevod') h += '<div class="kab-due"><span>' + x('f_srok') + '</span><b>' + fmtDate(Date.now() + 30 * DAY) + '</b></div><p class="kab-note">' + x(s.vid === 'prosba' ? 'prosba_note' : 'srok_note') + '</p>';
  else h += '<p class="kab-note">' + x('perevod_note') + '</p>';
  if (s.vid === 'zaym') h += '<p class="kab-note">' + x('zaym_note') + '</p>';
  h += '<label class="kab-f"><span>' + x('f_podpis') + ' <em id="sfCnt">' + s.podpis.length + '/140</em></span><input id="sfNote" type="text" maxlength="140" autocomplete="off" placeholder="' + x('f_podpis_ph') + '" value="' + esc(s.podpis) + '"></label>' + errHtml +
    '<button class="btn-gold kab-wide" type="button" data-kb="make" data-enter>' + x('make') + '</button>';
  return h;
}
function shareLinks(link) {
  var u = encodeURIComponent(link), t = encodeURIComponent(x('share_text'));
  return { tg: 'https://t.me/share/url?url=' + u + '&text=' + t, wa: 'https://wa.me/?text=' + encodeURIComponent(x('share_text') + ' ' + link) };
}
function vReady() {
  var r = st.res, l = shareLinks(r.ssylka);
  return head(x('ready_h'), x('ready_p')) +
    '<div class="kab-img"><img src="' + esc(r.ssylka) + '.png" alt="' + x('chek_alt') + '" width="1200" height="630" onerror="this.parentNode.classList.add(\'nofile\')"></div>' +
    '<div class="kab-link-box"><input readonly id="kabLink" value="' + esc(r.ssylka) + '" aria-label="link"><button class="btn-ghost" type="button" data-kb="copy" data-v="' + esc(r.ssylka) + '">' + x('copy') + '</button></div>' +
    '<button class="btn-gold kab-wide" type="button" data-kb="share" data-enter>' + x('share') + '</button>' +
    '<div class="kab-chips share"><button class="kab-chip" type="button" data-kb="open-link" data-h="' + esc(l.tg) + '">' + x('share_tg') + '</button><button class="kab-chip" type="button" data-kb="open-link" data-h="' + esc(l.wa) + '">' + x('share_wa') + '</button>' +
    '<button class="kab-chip" type="button" data-kb="copy" data-v="' + esc(r.ssylka) + '">' + x('share_copy') + '</button></div><p class="kab-note">' + x('share_ig') + '</p>';
}

/* ---------- the recipient: ?chek=<key> ---------- */
function chekKey() {
  try {
    var q = new URLSearchParams(location.search).get('chek'); if (q) return q;
    var m = /(?:^#|[#&/])chek=([A-Za-z0-9_-]{8,64})/.exec(location.hash); if (m) return m[1];
    var tg = window.Telegram && Telegram.WebApp && Telegram.WebApp.initDataUnsafe && Telegram.WebApp.initDataUnsafe.start_param; if (tg && /^[A-Za-z0-9_-]{8,64}$/.test(tg)) return tg;
  } catch (e) {}
  return null;
}
function chekCard(i) {
  var vid = i.vid, key = vid === 'perevod' ? 'inc_perevod' : vid === 'zaym' ? 'inc_zaym' : 'inc_prosba';
  var rows = '';
  if (vid !== 'perevod') {
    if (i.procent != null && vid === 'zaym') rows += '<div><span>' + x('inc_pct') + '</span><b class="num">' + i.procent + ' %</b></div><div><span>' + x('inc_back') + '</span><b class="num">' + usd(Math.round(i.summa * (1 + i.procent / 100))) + '</b></div>';
    rows += '<div><span>' + x('f_srok') + '</span><b>' + fmtDate(Date.now() + 30 * DAY) + '</b></div>';
  }
  return '<div class="kab-chek"><span class="kab-ck-l">dofamart</span><h3>' + x(key, { s: '<b class="num">' + usd(i.summa) + '</b>' }) + '</h3><div class="kab-ck-from">' + x('inc_from', { a: '<b class="num">' + esc(i.ot) + '</b>' }) + '</div>' +
    (i.podpis ? '<blockquote>' + esc(i.podpis) + '</blockquote>' : '') + (rows ? '<div class="kab-ck-rows">' + rows + '</div>' : '') + '</div>';
}
function openIncoming(tok) {
  openOv('inc', { tok: tok, info: null, loading: true, lock: false, ik: {} });
  api('GET', '/chek/' + encodeURIComponent(tok)).then(function (r) {
    if (scr !== 'inc' || st.tok !== tok) return;
    st.loading = false; st.info = r.ok ? r.d : null; st.dead = !r.ok || r.d.aktiven === false;
    if (st.info && st.info.vid === 'prosba') { st.give = st.info.summa; st.gp = 0; }
    render(true);
  });
}
function vInc() {
  var i = st.info, h = head('dofamart', '');
  if (st.loading) return h + '<p class="kab-none">' + x('inc_loading') + '</p>';
  if (!i || st.dead) return h.replace(/<h2[^>]*>.*?<\/h2>/, '<h2 id="modalTitle">' + x('inc_dead_h') + '</h2>') + '<p class="kab-note">' + x('inc_dead') + '</p><button class="btn-gold kab-wide" type="button" data-kb="close">' + x('done_close') + '</button>';
  h += chekCard(i);
  if (!me) {
    h += '<p class="kab-gift">' + x('inc_new') + '</p><button class="btn-gold kab-wide" type="button" data-kb="inc-reg" data-enter>' + x('inc_accept') + '</button><button class="btn-ghost kab-wide" type="button" data-kb="inc-login">' + x('inc_have') + '</button>';
    return h;
  }
  if (i.svoy) return h + '<p class="kab-note">' + x('inc_own') + '</p><button class="btn-ghost kab-wide" type="button" data-kb="close">' + x('close') + '</button>';
  if (i.vid === 'prosba') {
    h += '<label class="kab-f"><span>' + x('inc_p_sum') + '</span><input id="giveSum" class="kab-num" type="text" inputmode="numeric" autocomplete="off" value="' + Math.floor(st.give / 100) + '"></label>' +
      '<div class="kab-lbl">' + x('inc_p_pct') + '</div><div class="kab-chips">' + [0, 5, 10, 15, 20, 25, 30].map(function (p) { return '<button type="button" class="kab-chip' + (st.gp === p ? ' on' : '') + '" data-kb="gpct" data-v="' + p + '">' + p + ' %</button>'; }).join('') + '</div><p class="kab-note">' + x('inc_p_note') + '</p>';
  }
  h += errHtml + '<div class="kab-ra stack"><button class="btn-gold kab-wide" type="button" data-kb="inc-ok" data-enter>' + x(i.vid === 'prosba' ? 'inc_give' : 'inc_accept') + '</button><button class="btn-ghost kab-wide" type="button" data-kb="inc-no">' + x('inc_decline') + '</button></div>';
  return h;
}
function vDone() { return head(x(st.title), '') + '<div class="kab-done"><i aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9"/></svg></i>' + (st.msg ? '<p>' + x(st.msg) + '</p>' : '') + '</div><div class="kab-ra stack"><button class="btn-gold kab-wide" type="button" data-kb="open-cab" data-enter>' + x('done_cab') + '</button><button class="btn-ghost kab-wide" type="button" data-kb="close">' + x('done_close') + '</button></div>'; }

/* ---------- events ---------- */
function onInput(e) {
  var t = e.target, id = t.id;
  if (id === 'adres' || id === 'parol' || id === 'parol2') { st[id] = t.value; if (id === 'adres') st.adres = t.value.trim(); }
  else if (id === 'sfSum') { var v = t.value.replace(/\D/g, '').slice(0, 10); t.value = v ? grp(v) : ''; st.sf.summa = v; }
  else if (id === 'sfNote') { st.sf.podpis = t.value.slice(0, 140); var c = document.getElementById('sfCnt'); if (c) c.textContent = st.sf.podpis.length + '/140'; }
  else if (id === 'fillV' || id === 'giveSum') { var v2 = t.value.replace(/\D/g, '').slice(0, 10); t.value = v2 ? grp(v2) : ''; }
  else if (id === 'partV') { t.value = t.value.replace(/[^\d.,]/g, '').slice(0, 12); }
  else if (t.getAttribute && t.getAttribute('data-q') === 'dom') { var d = t.value.replace(/\D/g, '').slice(0, 3); t.value = d; st.qa.ans.dom = d === '' ? null : +d; var b = card.querySelector('[data-kb=qsel][data-q=dom] .kab-set'); if (!b && d !== '') { var h = card.querySelector('[data-kb=qsel][data-q=dom]'); if (h) h.insertAdjacentHTML('beforeend', '<b class="kab-set">' + x('q_set') + '</b>'); } else if (b && d === '') b.remove(); }
  else if (id === 'imya') nameCheck(t.value);
}
var nameT = 0, PR_KEY = { imya_korotkoe: 'pr_korotkoe', imya_rezerv: 'pr_rezerv', imya_dlinnoe: 'pr_dlinnoe', imya_znaki: 'pr_znaki', imya_zapret: 'pr_zapret', imya_zanyato: 'name_busy' };
function nameCheck(v) {
  var m = document.getElementById('imyaMsg'), b = document.getElementById('imyaBuy'); v = v.toLowerCase().replace(/[^a-z0-9-]/g, ''); clearTimeout(nameT); if (b) b.disabled = true;
  if (!m) return; if (!v) { m.textContent = ''; return; }
  nameT = setTimeout(function () {
    api('POST', '/imya/proverka', { imya: v }).then(function (r) {
      if (!m.isConnected) return;
      if (!r.ok) { m.textContent = errText(r); return; }
      var pr = r.d.prichina, price = r.d.cena_usd != null ? ' · ' + x('name_price', { p: r.d.cena_usd }) : '';
      if (!pr && r.d.svobodno !== false) m.textContent = x('name_free', { p: r.d.cena_usd != null ? r.d.cena_usd : '' }) + ' · ' + x('name_soon');
      else m.textContent = x(PR_KEY[pr] || 'name_busy') + (pr === 'imya_zanyato' || pr === 'imya_zapret' ? price : '');
    });
  }, 350);
}
function copyText(v) {
  var done = function () { toast(x('copied'), null, true); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(v).then(done, function () { fb(); }); else fb();
  function fb() { try { var t = document.createElement('textarea'); t.value = v; t.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(t); t.select(); var ok = document.execCommand('copy'); t.remove(); ok ? done() : toast(x('cp_fail')); } catch (e) { toast(x('cp_fail')); } }
}
function afterAuth() {
  var p = pending; pending = null;
  return refreshMe(true).then(function () { if (p) p(); else openOv('cab'); startPoll(); });
}
function idempotent(name) { if (!st.ik) st.ik = {}; if (!st.ik[name]) st.ik[name] = uid(); return st.ik[name]; }

function act(a, b, e) {
  var q = function (id) { return document.getElementById(id); };
  switch (a) {
    case 'close': closeOv(); return;
    case 'eye': { var i = q(b.getAttribute('data-for')); if (i) { var sh = i.type === 'password'; i.type = sh ? 'text' : 'password'; b.textContent = x(sh ? 'hide' : 'show'); } return; }
    case 'copy': copyText(b.getAttribute('data-v')); return;
    case 'to-login': st = { adres: st.adres || '' }; scr = 'login'; render(true); return;
    case 'to-reg': st = { step: 1, qa: newQa(), inv: st.inv }; scr = 'reg'; render(true); return;
    case 'to-rec': st = { adres: st.adres || '', qa: newQa() }; scr = 'rec'; render(true); return;
    case 'reg-back': st.step = 1; render(true); return;
    case 'to-chek': { var tk0 = st.tok; pending = null; openIncoming(tk0); return; }
    case 'open-cab': scr = 'cab'; st = {}; render(true); refreshMe(); return;
    case 'two': scr = 'two'; render(true); return;
    case 'fill': scr = 'fill'; st = {}; render(true); return;
    case 'eyex': return;
    case 'login': {
      var ad = (q('adres').value || '').trim(), pw = q('parol').value; st.adres = ad; showErr('');
      if (!ad || !pw) { showErr(x('err_vhod')); return; }
      setBusy(b, 1);
      api('POST', '/vhod', { adres: ad.toLowerCase(), parol: pw }).then(function (r) { setBusy(b, 0); if (r.ok) afterAuth(); else showErr(errText(r)); });
      return;
    }
    case 'tg': {
      setBusy(b, 1);
      api('POST', '/vhod/telegram', { initData: Telegram.WebApp.initData, priglasil: st.inv || undefined }).then(function (r) { setBusy(b, 0); if (r.ok) { tgToken = r.d.token || null; afterAuth(); } else showErr(errText(r)); });
      return;
    }
    case 'reg-next': {
      var p1 = q('parol').value, p2 = q('parol2').value; st.parol = p1; st.parol2 = p2;
      if (p1.length < 10) { showErr(x('pw_short')); return; }
      if (p1 !== p2) { showErr(x('pw_mismatch')); return; }
      st.step = 2; render(true); return;
    }
    case 'qsel': {
      if (st.qa.fixed) return;
      var c = b.getAttribute('data-q'), k = st.qa.sel.indexOf(c);
      if (k >= 0) st.qa.sel.splice(k, 1); else if (st.qa.sel.length < 3) st.qa.sel.push(c); else { showErr(x('q_chosen', { n: 3 })); return; }
      render(); return;
    }
    case 'opt': st.qa.ans[b.getAttribute('data-q')] = +b.getAttribute('data-i'); render(); return;
    case 'mon': st.qa.mm = +b.getAttribute('data-i'); st.qa.dd = null; delete st.qa.ans.mama; render(); return;
    case 'day': st.qa.dd = +b.getAttribute('data-i'); st.qa.ans.mama = CUM[st.qa.mm] + st.qa.dd - 1; render(); return;
    case 'reg-go': {
      var pl = qaPayload(st.qa); if (pl.err) { showErr(pl.err); return; }
      setBusy(b, 1);
      var body = { parol: st.parol, otvety: pl.otvety }; if (st.inv) body.priglasil = st.inv;
      api('POST', '/registraciya', body).then(function (r) {
        setBusy(b, 0);
        if (!r.ok) { showErr(errText(r)); return; }
        st = { adres: r.d.adres, podarok: r.d.podarok, pw: st.parol, tok: pending ? incTok : null }; /* пришёл по ссылке-чеку: с экрана «Кабинет создан» ведём обратно к чеку */
        refreshMe(true).then(function () { scr = 'saved'; render(true); startPoll(); });
      });
      return;
    }
    case 'store': try { var cr = new PasswordCredential({ id: st.adres, password: st.pw, name: st.adres }); navigator.credentials.store(cr).then(function () { toast(x('saved_stored'), null, true); }, function () {}); } catch (er) {} return;
    case 'rec-next': {
      var ad3 = (q('adres').value || '').trim().toLowerCase(); st.adres = ad3; showErr('');
      if (!ad3) { showErr(x('err_vhod')); return; }
      setBusy(b, 1);
      api('POST', '/vosstanovlenie/voprosy', { adres: ad3 }).then(function (r) {
        setBusy(b, 0);
        var v = r.ok && r.d && r.d.voprosy;
        if (!r.ok) { showErr(errText(r)); return; }
        if (!Array.isArray(v) || v.length !== 3 || v.some(function (c) { return !QS[c]; })) { showErr(x('err_sboy')); return; }
        st.qa = { order: v, sel: v.slice(), ans: {}, mm: null, dd: null, fixed: true }; render(true);
      });
      return;
    }
    case 'rec-go': {
      var ad2 = (q('adres').value || '').trim().toLowerCase(), np = q('parol').value; st.adres = ad2;
      var pr = qaPayload(st.qa); if (!ad2) { showErr(x('err_vhod')); return; } if (pr.err) { showErr(pr.err); return; } if (np.length < 10) { showErr(x('pw_short')); return; }
      setBusy(b, 1);
      api('POST', '/vosstanovlenie', { adres: ad2, otvety: pr.otvety, novyy_parol: np }).then(function (r) { setBusy(b, 0); if (r.ok) { st = { at: r.d.aktiven_s }; scr = 'recok'; render(true); } else showErr(errText(r)); });
      return;
    }
    case 'vosst-cancel': api('POST', '/vosstanovlenie/otmena', {}).then(function (r) { if (r.ok) { toast(x('vosst_cancelled'), null, true); refreshMe(); } else showErr(errText(r)); }); return;
    case 'logout': case 'logout-all':
      api('POST', a === 'logout' ? '/vyhod' : '/vyhod/vezde', {}).then(function () { me = null; tgToken = null; flag(0); paintBadge(); stopPoll(); toast(x('logged_out')); closeOv(); });
      return;
    case 'read': {
      var mx = 0; (me.uvedomleniya || []).forEach(function (n) { if (n.id > mx) mx = n.id; });
      api('POST', '/uvedomleniya/prochitano', { do: mx }).then(function () { refreshMe(); }); return;
    }
    case 'repay': case 'part-go': {
      var d = +b.getAttribute('data-d'), body2 = { klyuch: idempotent('r' + d + (a === 'part-go' ? ':' + (q('partV') ? q('partV').value : '') : '')) };
      if (a === 'part-go') { var c2 = toCents(q('partV').value); if (!c2) { showErr(x('err_summa')); return; } body2.summa = c2; }
      setBusy(b, 1);
      api('POST', '/dolg/' + d + '/vernut', body2).then(function (r) { setBusy(b, 0); st.ik = {}; if (r.ok) { st.part = null; toast(x('repaid'), 'up', true); vib(12); refreshMe(); } else showErr(errText(r)); });
      return;
    }
    case 'part': st.part = st.part === +b.getAttribute('data-d') ? null : +b.getAttribute('data-d'); render(); return;
    case 'remind': api('POST', '/dolg/' + b.getAttribute('data-d') + '/napomnit', {}).then(function (r) { if (r.ok) toast(x('reminded'), null, true); else if (r.d.oshibka === 'uzhe_napomnili') toast(lang() === 'en' ? 'Already reminded today' : 'Сегодня уже напоминали'); else showErr(errText(r)); }); return;
    case 'forgive': st.forgive = +b.getAttribute('data-d'); render(); return;
    case 'forgive-yes': api('POST', '/dolg/' + b.getAttribute('data-d') + '/prostit', {}).then(function (r) { st.forgive = null; if (r.ok) { toast(x('forgiven'), null, true); refreshMe(); } else showErr(errText(r)); }); return;
    case 'chk-cancel': api('POST', '/moi-cheki/' + b.getAttribute('data-c') + '/otmenit', {}).then(function (r) { if (r.ok) { toast(x('chk_cancelled'), null, true); refreshMe(); } else showErr(errText(r)); }); return;
    case 'chk-yes': case 'chk-no': {
      var cn = b.getAttribute('data-c');
      api('POST', '/moi-cheki/' + cn + '/otvet', { soglasen: a === 'chk-yes', klyuch: idempotent('o' + cn) }).then(function (r) { st.ik = {}; if (r.ok) { toast(x(a === 'chk-yes' ? 'chk_agreed' : 'chk_refused'), a === 'chk-yes' ? 'up' : null, true); refreshMe(); } else showErr(errText(r)); });
      return;
    }
    case 'fillamt': { var f = q('fillV'); if (f) { f.value = grp(b.getAttribute('data-a')); f.focus(); } return; }
    case 'fill-go': {
      var amt = toCents(q('fillV').value); if (!amt) { showErr(x('err_summa')); return; } setBusy(b, 1);
      api('POST', '/bankomat', { summa: amt, klyuch: idempotent('fill' + amt) }).then(function (r) { setBusy(b, 0); if (r.ok) { st.ik = {}; toast(x('fill_ok'), 'up', true); me = null; refreshMe(true).then(function () { scr = 'cab'; st = {}; render(true); }); } else showErr(errText(r)); });
      return;
    }
    case 'send': openSend(); return;
    case 'cab': openCab(); return;
    case 'vid': st.sf.vid = b.getAttribute('data-v'); st.ik = {}; render(); return;
    case 'sfamt': { st.sf.summa = b.getAttribute('data-a'); var s2 = q('sfSum'); if (s2) s2.value = grp(st.sf.summa); return; }
    case 'pct': st.sf.procent = +b.getAttribute('data-v'); render(); return;
    case 'make': {
      var sf = st.sf, cents = (+sf.summa || 0) * 100; if (cents < 100) { showErr(x('err_summa')); return; }
      var body3 = { vid: sf.vid, summa: cents, podpis: sf.podpis.trim() };
      if (sf.vid === 'zaym') body3.procent = sf.procent;
      body3.klyuch = idempotent('mk:' + sf.vid + ':' + cents + ':' + sf.procent + ':' + body3.podpis);
      if (!body3.podpis) delete body3.podpis;
      setBusy(b, 1);
      api('POST', '/chek', body3).then(function (r) {
        setBusy(b, 0);
        if (r.ok) { st = { res: r.d }; scr = 'ready'; render(true); refreshMe(true); }
        else if (r.d.oshibka === 'ne_hvataet') showErr(x('low_free')); else showErr(errText(r));
      });
      return;
    }
    case 'share': {
      var link = st.res.ssylka;
      try { if (navigator.share) { navigator.share({ url: link, title: 'dofamart', text: x('share_text') }).catch(function () {}); return; } } catch (er2) {}
      copyText(link); return;
    }
    case 'open-link': {
      var hh = b.getAttribute('data-h');
      try { if (window.Telegram && Telegram.WebApp && Telegram.WebApp.initData && /^https:\/\/t\.me\//.test(hh)) { Telegram.WebApp.openTelegramLink(hh); return; } } catch (er3) {}
      window.open(hh, '_blank', 'noopener'); return;
    }
    case 'inc-reg': { pending = function () { openIncoming(st.tok || incTok); }; var keepTok = st.tok; incTok = keepTok; st = { step: 1, qa: newQa(), inv: st.info && st.info.ot }; scr = 'reg'; render(true); return; }
    case 'inc-login': { incTok = st.tok; pending = function () { openIncoming(incTok); }; st = { inv: st.info && st.info.ot }; scr = 'login'; render(true); return; }
    case 'gpct': st.gp = +b.getAttribute('data-v'); st.give = (toCents(q('giveSum').value) || st.give); render(); return;
    case 'inc-ok': case 'inc-no': {
      var i2 = st.info, tk = st.tok, path = '/chek/' + encodeURIComponent(tk) + (a === 'inc-ok' ? '/prinyat' : '/otklonit'), body4 = {};
      if (a === 'inc-ok') {
        body4.klyuch = idempotent('in:' + tk);
        if (i2.vid === 'prosba') { var gs = toCents(q('giveSum').value); if (!gs) { showErr(x('err_summa')); return; } body4.summa = Math.min(gs, i2.summa); body4.procent = st.gp; body4.klyuch = idempotent('in:' + tk + ':' + body4.summa + ':' + body4.procent); }
      }
      setBusy(b, 1); var other = card.querySelectorAll('[data-kb^=inc-]'); other.forEach(function (o) { o.disabled = true; });
      api('POST', path, body4).then(function (r) {
        other.forEach(function (o) { o.disabled = false; }); setBusy(b, 0);
        if (!r.ok) { showErr(errText(r)); return; }
        try { var u = new URL(location.href); u.searchParams.delete('chek'); history.replaceState(null, '', u.pathname + u.search + u.hash); } catch (er4) {}
        var t = a === 'inc-no' ? 'done_decline' : (i2.vid === 'perevod' ? 'done_perevod' : i2.vid === 'zaym' ? 'done_zaym' : (r.d.status === 'prinyat' ? 'done_prosba0' : 'done_prosba'));
        refreshMe(true).then(function () { st = { title: t, msg: null }; scr = 'done'; render(true); vib([12, 40, 12]); });
      });
      return;
    }
  }
}
var incTok = null;

function openCab() { if (me) { openOv('cab'); refreshMe(); } else openOv('login'); }
function openSend(vid) {
  var go = function () { openOv('send', { sf: { vid: vid || 'perevod', summa: '', podpis: '', procent: 10 }, ik: {} }); refreshMe(true).then(function () { var a = document.getElementById('sfAvail'); if (a && me) a.textContent = x('avail', { a: usd(me.koshelek.svobodno) }); }); };
  if (me) go(); else { pending = go; openOv('login'); }
}

/* ---------- background: unread dot, quests for the server ---------- */
var pollT = 0;
function startPoll() { stopPoll(); pollT = setInterval(function () { if (document.hidden) return; refreshMe(true); sendQuests(); }, 45000); sendQuests(); }
function stopPoll() { clearInterval(pollT); pollT = 0; }
var QKEY = 'dofa_kab_zad';
function sendQuests() {
  if (!me) return;
  try {
    var sent = JSON.parse(localStorage.getItem(QKEY) || '{}'), all = window.DofaSim.quests(), todo = all.filter(function (q) { return !sent[me.adres + ':' + q]; });
    (function next() {
      var q = todo.shift(); if (!q) return;
      api('POST', '/zadanie', { kod: q }).then(function (r) {
        if (r.ok || r.d.oshibka === 'net_zadaniya') { sent[me.adres + ':' + q] = 1; localStorage.setItem(QKEY, JSON.stringify(sent)); }
        if (r.ok) refreshMe(true);
        if (r.ok || r.d.oshibka === 'net_zadaniya') next();
      });
    })();
  } catch (e) {}
}

/* ---------- public hook for the "low money" plaque ---------- */
window.DofaKab = {
  on: true,
  loan: function () { openSend('prosba'); return true; }
};

/* ---------- start ---------- */
function start() {
  mountFurniture();
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-kab]') : null;
    if (!b || (ov && ov.contains(b))) return;
    var a = b.getAttribute('data-kab'); if (a === 'send') openSend(); else if (a === 'cab') openCab();
  });
  document.addEventListener('dofa-lang', function () { paintFurniture(); if (ov && !ov.hidden) render(); });
  (flagged() ? api('GET', '/kabinet') : Promise.resolve({ ok: false })).then(function (r) {
    if (r.ok) { me = r.d; startPoll(); } else if (r.status === 401) flag(0);
    paintBadge();
    var k = chekKey(); if (k) openIncoming(k);
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
