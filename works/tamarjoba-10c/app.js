(function () {
  'use strict';
  var D = document;
  function $(id) { return D.getElementById(id); }
  function all(s, r) { return [].slice.call((r || D).querySelectorAll(s)); }
  var calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* появление блоков */
  var rev = all('.reveal');
  function show(el) { el.classList.add('in'); }
  if ('IntersectionObserver' in window && !calm) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { show(e.target); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -7% 0px', threshold: .05 });
    rev.forEach(function (el) { io.observe(el); });
    setTimeout(function () { rev.forEach(function (el) { if (!el.classList.contains('in') && el.getBoundingClientRect().top < innerHeight) show(el); }); }, 1800);
  } else rev.forEach(show);

  /* меню на телефоне */
  var burger = $('burger'), menu = $('menu');
  function setMenu(on) {
    if (!burger || !menu) return;
    menu.hidden = !on; burger.setAttribute('aria-expanded', String(on));
    D.documentElement.classList.toggle('tqc-menu-on', on);
  }
  if (burger) {
    burger.addEventListener('click', function () { setMenu(menu.hidden); });
    all('a', menu).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
    menu.addEventListener('click', function (e) { if (e.target === menu) setMenu(false); });
    D.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
  }

  /* ---------- конструктор ---------- */
  var RU = { goal: { live: 'Жить в Грузии', citizen: 'Гражданство', kids: 'Ребёнку', self: 'Для себя' },
    fmt: { tbilisi: 'Тбилиси', batumi: 'Батуми', online: 'Онлайн', video: 'Видеокурс' },
    lvl: { zero: 'С нуля', a1: 'Знаю A1', a2: 'Знаю A2' } };
  var S = { goal: 'live', fmt: 'online', mode: 'group', lvl: 'zero' };

  function resolve(s) {
    var r, city = s.fmt === 'tbilisi' ? 'Тбилиси' : s.fmt === 'batumi' ? 'Батуми' : 'Онлайн';
    if (s.goal === 'kids') {
      r = { course: 'Детский грузинский', where: 'Пособие', level: 'С нуля', scope: '16 уроков, все 33 буквы', price: '50 ₾', alt: 'печатная версия', extra: 'Аудио по кодам и прописи', page: 'kurs-deti.html' };
    } else if (s.fmt === 'video') {
      if (s.goal === 'citizen') r = { course: 'Тренажёр экзамена', where: 'Онлайн', level: 'Любой', scope: 'Тесты с переводами и тренажёр', price: 'Цену назовёт школа', alt: '', extra: '', page: 'kurs-grazhdanstvo.html' };
      else if (s.lvl === 'zero') r = { course: 'Gamarjoba Start', where: 'Видеокурс', level: 'С нуля до A1', scope: 'Уроки по 15 минут', price: '160 ₾', alt: '60 $ · 3 980 ₽ за модуль', extra: 'Алфавит со скидкой −50%', page: 'kurs-video.html' };
      else r = { course: 'Gamarjoba Plus', where: 'Видеокурс', level: 'A1–B2', scope: 'Уроки по 15 минут', price: '160 ₾', alt: '60 $ · 3 980 ₽ за модуль', extra: 'Можно купить один модуль', page: 'kurs-video.html' };
    } else if (s.mode === 'solo') {
      r = { course: 'Индивидуальные уроки', where: city, level: 'Любой', scope: '8 уроков по 60 минут', price: '560 ₾', alt: '16 800 ₽', extra: 'Пробный урок 20 минут бесплатно', page: 'kurs-individualno.html' };
    } else if (s.fmt === 'online') {
      var g = { zero: ['A1', '40 уроков по 60 минут', '1 200 ₾', '40 500 ₽ · 8 уроков 280 ₾', '4 часа практики бесплатно'],
        a1: ['A2', '32 урока по 60 минут', '960 ₾', '32 000 ₽ · 8 уроков 280 ₾', '3 часа практики бесплатно'],
        a2: ['A2+', '40 уроков по 60 минут', '1 200 ₾', '8 уроков 280 ₾', 'Группа до 6 человек'] }[s.lvl];
      r = { course: 'Онлайн-группа ' + g[0], where: 'Онлайн', level: RU.lvl[s.lvl], scope: g[1], price: g[2], alt: g[3], extra: g[4], page: 'kurs-gruppy.html' };
    } else {
      r = { course: 'Группа в классе', where: city, level: RU.lvl[s.lvl], scope: '2 занятия в неделю по 60 минут', price: 'Цену назовёт школа', alt: '', extra: 'Небольшие группы', page: 'kurs-gruppy.html' };
    }
    if (s.goal === 'citizen') r.extra = 'Встреча «Кава с Tamarjoba» бесплатно';
    return r;
  }

  var card = $('card');
  if (card) {
    var q = new URLSearchParams(location.search);
    ['goal', 'fmt', 'mode', 'lvl'].forEach(function (k) {
      var v = q.get(k), ok = all('[data-k="' + k + '"] [data-v="' + v + '"]').length || (k === 'mode' && (v === 'group' || v === 'solo'));
      if (v && ok) S[k] = v;
    });
    var first = true;
    var render = function () {
      var kids = S.goal === 'kids', vid = S.fmt === 'video';
      card.classList.toggle('is-kids', kids);
      all('[data-k] [data-v]').forEach(function (b) {
        var k = b.parentNode.getAttribute('data-k');
        if (!k) k = b.closest('[data-k]').getAttribute('data-k');
        b.setAttribute('aria-checked', String(S[k] === b.getAttribute('data-v')));
      });
      $('st-fmt').classList.toggle('is-off', kids);
      $('st-lvl').classList.toggle('is-off', kids || S.mode === 'solo');
      $('modebox').hidden = kids || vid;
      var r = resolve(S);
      var set = function (id, v) { var e = $(id); if (e) e.textContent = v; };
      set('c-goal', RU.goal[S.goal]); set('c-where', r.where); set('c-lvl', r.level);
      set('c-course', r.course); set('c-scope', r.scope); set('c-price', r.price);
      set('c-alt', r.alt); set('c-extra', r.extra);
      $('c-more').href = r.page;
      var fr = ['goal=' + S.goal, 'fmt=' + S.fmt, 'mode=' + S.mode, 'lvl=' + S.lvl].join('&');
      $('c-more').setAttribute('data-q', fr);
      var f = $('f-sum'); if (f) f.textContent = r.course + ' · ' + r.where + ' · ' + r.price;
      var fk = $('f-kurs'); if (fk) fk.value = r.course + ', ' + r.where + ', ' + r.scope + ', ' + r.price;
      var fg = $('f-goal'); if (fg) fg.value = RU.goal[S.goal] + ', ' + r.level;
      if (!first && !calm) {
        card.classList.remove('is-new'); void card.offsetWidth; card.classList.add('is-new');
      } else card.classList.add('is-new');
      first = false;
    };
    all('[data-k]').forEach(function (g) {
      g.addEventListener('click', function (e) {
        var b = e.target.closest('[data-v]'); if (!b || b.getAttribute('aria-disabled') === 'true') return;
        var k = g.getAttribute('data-k'); S[k] = b.getAttribute('data-v');
        if (k === 'goal' && S.goal === 'kids') { /* детям один вариант */ }
        render();
      });
    });
    render();
    if (q.get('goal') && location.hash === '#sbor') setTimeout(function () { var e = $('sbor'); if (e) e.scrollIntoView(); }, 0);
  }

  /* на страницах курсов: «Собрать курс» несёт выбор в конструктор */
  all('[data-build]').forEach(function (a) { a.href = 'index.html?' + a.getAttribute('data-build') + '#sbor'; });

  /* ---------- карта: два адреса ---------- */
  var MAPQ = { tbilisi: 'Тбилиси, Сабуртало, ул. Медеи Чахава, 9', batumi: 'Батуми, ул. Зураба Горгиладзе, 95' };
  var tabs = all('[data-map]');
  tabs.forEach(function (t) {
    t.addEventListener('click', function () {
      var a = MAPQ[t.getAttribute('data-map')];
      $('map-f').src = 'https://www.google.com/maps?q=' + encodeURIComponent(a) + '&z=16&output=embed';
      $('map-go').href = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(a);
      tabs.forEach(function (x) { x.setAttribute('aria-pressed', String(x === t)); });
    });
  });

  /* ---------- заявка: сообщение уходит в WhatsApp школы ---------- */
  var form = $('form');
  if (form) {
    var done = $('done'), ok = $('f-ok'), send = $('f-send'), nm = $('f-name');
    var SAY = { title: 'Сообщение готово', wa: 'Отправить в WhatsApp', back: 'Изменить', hello: 'Здравствуйте! Хочу записаться на пробный урок. Пишу с сайта Tamarjoba.' };
    $('done-title').textContent = SAY.title; $('done-wa').textContent = SAY.wa; $('done-back').textContent = SAY.back;
    ok.addEventListener('change', function () { send.disabled = !ok.checked; });
    all('input,select', form).forEach(function (el) { el.addEventListener('input', function () { el.removeAttribute('aria-invalid'); }); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var bad = null;
      all('[required]', form).forEach(function (el) {
        var v = el.value.trim(), no = el.type === 'tel' ? v.replace(/\D/g, '').length < 8 : v.length < 2;
        el.setAttribute('aria-invalid', no ? 'true' : 'false');
        if (no && !bad) bad = el;
      });
      if (bad) { bad.focus(); return; }
      var lines = [SAY.hello];
      all('[data-label]', form).forEach(function (el) {
        var v = el.tagName === 'SELECT' ? el.options[el.selectedIndex].textContent : el.value; v = (v || '').trim();
        if (v) lines.push(el.getAttribute('data-label') + ' ' + v);
      });
      var text = lines.join('\n');
      $('done-text').textContent = text;
      $('done-wa').href = 'https://wa.me/995551160580?text=' + encodeURIComponent(text);
      form.hidden = true; done.hidden = false; done.focus();
    });
    $('done-back').addEventListener('click', function () { done.hidden = true; form.hidden = false; nm.focus(); });
  }

  /* ---------- игра «Кодовый замок» ---------- */
  var lock = $('lock');
  if (lock) {
    var WORDS = [
      { ru: 'Язык', ka: ['ე', 'ნ', 'ა'], snd: ['э', 'н', 'а'], read: 'ენა читается «эна»' },
      { ru: 'Мама', ka: ['დ', 'ე', 'დ', 'ა'], snd: ['д', 'э', 'д', 'а'], read: 'დედა читается «деда»' },
      { ru: 'Солнце', ka: ['მ', 'ზ', 'ე'], snd: ['м', 'з', 'э'], read: 'მზე читается «мзе»' },
      { ru: 'Дом', ka: ['ს', 'ა', 'ხ', 'ლ', 'ი'], snd: ['с', 'а', 'х', 'л', 'и'], read: 'სახლი читается «сахли»' },
      { ru: 'Персик', ka: ['ა', 'ტ', 'ა', 'მ', 'ი'], snd: ['а', 'т', 'а', 'м', 'и'], read: 'ატამი читается «атами»' }
    ];
    var POOL = 'ა ბ გ დ ე ვ ზ თ ი კ ლ მ ნ ო პ რ ს ტ უ ფ ქ ღ შ ჩ ც ხ ჯ'.split(' ');
    var H = 52, wi = 0, drums = [], won = false;
    var box = $('drums');
    function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
    function setX(d, anim) {
      d.rail.style.transition = anim && !calm ? 'transform 240ms var(--ease-out-expo)' : 'none';
      d.rail.style.transform = 'translateY(' + (-(d.n + d.i - 1) * H) + 'px)';
    }
    function norm(d) {
      if (d.i < 0 || d.i >= d.n) { d.i = (d.i % d.n + d.n) % d.n; setX(d, false); }
    }
    function step(d, dir) {
      if (won) return;
      d.i += dir; setX(d, true);
      clearTimeout(d.t); d.t = setTimeout(function () { norm(d); check(); }, calm ? 0 : 260);
    }
    function cur(d) { return d.ring[((d.i % d.n) + d.n) % d.n]; }
    function check() {
      var w = WORDS[wi];
      if (won) return;
      var okAll = drums.every(function (d, k) { return cur(d) === w.ka[k]; });
      drums.forEach(function (d, k) { d.el.classList.toggle('is-right', cur(d) === w.ka[k]); });
      if (okAll) {
        won = true; lock.classList.add('is-open');
        $('lk-read').textContent = w.read;
        $('lk-state').textContent = 'Замок открыт';
        $('lk-next').hidden = false; $('lk-hint').hidden = true; $('lk-go').hidden = false;
      }
    }
    function build() {
      var w = WORDS[wi]; won = false; drums = [];
      lock.classList.remove('is-open'); box.innerHTML = '';
      $('lk-word').textContent = w.ru; $('lk-read').textContent = ''; $('lk-state').textContent = 'Замок закрыт';
      $('lk-next').hidden = true; $('lk-hint').hidden = false; $('lk-go').hidden = true;
      w.ka.forEach(function (L, k) {
        var others = shuffle(POOL.filter(function (x) { return x !== L; })).slice(0, 6);
        var ring = shuffle(others.concat([L]));
        var n = ring.length, start = ring.indexOf(L);
        var i0 = (start + 1 + Math.floor(Math.random() * (n - 1))) % n;
        var el = D.createElement('div'); el.className = 'tqc-drum';
        var items = ring.concat(ring, ring).map(function (c) { return '<span lang="ka">' + c + '</span>'; }).join('');
        el.innerHTML = '<button type="button" class="tqc-drum__b" aria-label="Буква выше">▲</button>' +
          '<div class="tqc-drum__win" tabindex="0" role="spinbutton" aria-label="Барабан ' + (k + 1) + '"><div class="tqc-drum__rail">' + items + '</div></div>' +
          '<button type="button" class="tqc-drum__b" aria-label="Буква ниже">▼</button><b class="tqc-drum__s">' + w.snd[k] + '</b>';
        box.appendChild(el);
        var d = { el: el, ring: ring, n: n, i: i0, rail: el.querySelector('.tqc-drum__rail'), t: 0 };
        drums.push(d); setX(d, false);
        var bs = el.querySelectorAll('.tqc-drum__b');
        bs[0].addEventListener('click', function () { step(d, -1); });
        bs[1].addEventListener('click', function () { step(d, 1); });
        var win = el.querySelector('.tqc-drum__win'), y0 = null;
        win.addEventListener('keydown', function (e) {
          if (e.key === 'ArrowUp') { e.preventDefault(); step(d, -1); }
          if (e.key === 'ArrowDown') { e.preventDefault(); step(d, 1); }
        });
        win.addEventListener('pointerdown', function (e) { y0 = e.clientY; try { win.setPointerCapture(e.pointerId); } catch (x) {} });
        win.addEventListener('pointermove', function (e) {
          if (y0 === null) return;
          var dy = e.clientY - y0;
          if (Math.abs(dy) > 24) { step(d, dy < 0 ? 1 : -1); y0 = e.clientY; }
        });
        win.addEventListener('pointerup', function () { y0 = null; });
        win.addEventListener('pointercancel', function () { y0 = null; });
      });
      check();
    }
    $('lk-next').addEventListener('click', function () { wi = (wi + 1) % WORDS.length; build(); });
    $('lk-hint').addEventListener('click', function () {
      var w = WORDS[wi];
      for (var k = 0; k < drums.length; k++) {
        if (cur(drums[k]) !== w.ka[k]) {
          var e = drums[k].el; e.classList.remove('is-ask'); void e.offsetWidth; e.classList.add('is-ask'); return;
        }
      }
    });
    build();
  }
})();
