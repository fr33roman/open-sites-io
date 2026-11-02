/* Tamarjoba · вариант А. Карточки на месте (FLIP), игра с буквами, запись. Без внешних скриптов. */
(function () {
  'use strict';
  var D = document, W = window;
  function $(id) { return D.getElementById(id); }
  function all(s, r) { return [].slice.call((r || D).querySelectorAll(s)); }
  var calm = W.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* появление блоков */
  var rv = all('.tqa-head, .tqa-card, .tqa-board, .tqa-quote, .tqa-where, .tqa-links');
  rv.forEach(function (el, i) { el.classList.add('rv'); el.style.setProperty('--d', ((i % 3) * 0.07) + 's'); });
  function show(el) { el.classList.add('in'); }
  if ('IntersectionObserver' in W && !calm) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { show(e.target); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.04 });
    rv.forEach(function (el) { io.observe(el); });
    setTimeout(function () { rv.forEach(function (el) { if (el.getBoundingClientRect().top < innerHeight) show(el); }); }, 1800);
  } else rv.forEach(show);

  /* меню на телефоне */
  var burger = D.querySelector('.tqa-burger'), menu = $('menu');
  function setMenu(on) {
    menu.hidden = !on;
    burger.setAttribute('aria-expanded', String(on));
  }
  burger.addEventListener('click', function () { setMenu(menu.hidden); });
  menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
  D.addEventListener('click', function (e) { if (!menu.hidden && !e.target.closest('#menu, .tqa-burger')) setMenu(false); });

  /* карточки: одна открыта за раз, FLIP по высоте, соседи съезжают */
  var cards = all('[data-card]'), openCard = null;
  function rects(list) { return list.map(function (c) { return c.getBoundingClientRect(); }); }
  function setState(c, on) {
    c.classList.toggle('is-open', on);
    var b = c.querySelector('.tqa-bar');
    if (b) b.setAttribute('aria-expanded', String(on));
  }
  function swap(next) {
    var prev = openCard;
    if (prev === next) return;
    var grids = [];
    [prev, next].forEach(function (c) { var g = c && c.closest('[data-flip]'); if (g && grids.indexOf(g) < 0) grids.push(g); });
    var list = [];
    grids.forEach(function (g) { list = list.concat(all('[data-card]', g)); });
    if (next && next.id === 'book') list.push(next);
    if (prev && prev.id === 'book' && list.indexOf(prev) < 0) list.push(prev);
    var first = rects(list), st = W.scrollY;
    if (prev) setState(prev, false);
    if (next) setState(next, true);
    openCard = next;
    if (calm || !list[0].animate) return;
    var last = rects(list);
    list.forEach(function (c, i) {
      var a = first[i], b = last[i], dx = a.left - b.left, dy = a.top - b.top, grow = c === next || c === prev;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && !(grow && Math.abs(a.height - b.height) > 1)) return;
      var f0 = { transform: 'translate(' + dx + 'px,' + dy + 'px)' }, f1 = { transform: 'none' };
      if (grow) { f0.height = a.height + 'px'; f1.height = b.height + 'px'; c.style.overflow = 'hidden'; }
      var an = c.animate([f0, f1], { duration: 620, easing: 'cubic-bezier(0.16,1,0.3,1)' });
      an.onfinish = an.oncancel = function () { c.style.overflow = ''; };
    });
    if (next) {
      var r = next.getBoundingClientRect();
      if (r.top < 70 || r.top > innerHeight * 0.55) W.scrollTo({ top: st + r.top - 80, behavior: calm ? 'auto' : 'smooth' });
    }
  }
  cards.forEach(function (c) {
    var bar = c.querySelector('.tqa-bar'), x = c.querySelector('.tqa-x');
    bar.addEventListener('click', function () { swap(c.classList.contains('is-open') ? null : c); });
    if (x) x.addEventListener('click', function () { var t = bar; swap(null); t.focus({ preventScroll: true }); });
  });
  D.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { if (!menu.hidden) setMenu(false); else if (openCard) { var b = openCard.querySelector('.tqa-bar'); swap(null); b.focus({ preventScroll: true }); } }
  });

  /* запись: любая кнопка записи открывает карточку формы */
  var book = $('book'), topic = $('f-topic'), nm = $('f-name');
  function openBook(t) {
    topic.value = t || '';
    if (!book.classList.contains('is-open')) swap(book);
    else book.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'center' });
    setTimeout(function () { try { nm.focus({ preventScroll: true }); } catch (e) { } }, 650);
  }
  all('[data-book]').forEach(function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); setMenu(false); openBook(a.getAttribute('data-book')); });
  });
  if (!D.documentElement.classList.contains('tqa-js')) book.classList.add('is-open');

  all('[data-go]').forEach(function (b) {
    b.addEventListener('click', function () { var g = D.querySelector(b.getAttribute('data-go')); if (g) g.scrollIntoView({ behavior: calm ? 'auto' : 'smooth' }); });
  });

  /* карта: два адреса */
  var maps = {
    bat: { q: 'Батуми, ул. Зураба Горгиладзе, 95' },
    tbs: { q: 'Тбилиси, Сабуртало, ул. Медеи Чахава, 9' }
  };
  all('.tqa-tabs button').forEach(function (b) {
    b.addEventListener('click', function () {
      var m = maps[b.getAttribute('data-city')], q = encodeURIComponent(m.q).replace(/%20/g, '+');
      all('.tqa-tabs button').forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); });
      $('map').src = 'https://www.google.com/maps?q=' + q + '&z=16&output=embed';
      $('route').href = 'https://www.google.com/maps/dir/?api=1&destination=' + q;
    });
  });

  /* игра «Расставь буквы» */
  var WORDS = [
    { w: 'გამარჯობა', s: ['г', 'а', 'м', 'а', 'р', 'дж', 'о', 'б', 'а'], tr: 'гамарджоба', ru: 'здравствуйте' },
    { w: 'მადლობა', s: ['м', 'а', 'д', 'л', 'о', 'б', 'а'], tr: 'мадлоба', ru: 'спасибо' },
    { w: 'საქართველო', s: ['с', 'а', 'к', 'а', 'р', 'т', 'в', 'е', 'л', 'о'], tr: 'сакартвело', ru: 'Грузия' }
  ];
  var gi = 0, letters, filled, slotsEl = $('g-slots'), tilesEl = $('g-tiles'), endEl = $('g-end');
  var nextBtn = $('g-next'), againBtn = $('g-again'), gcta = $('g-cta');

  function shuffle(a) {
    var o = a.slice(), i, j, t;
    for (i = o.length - 1; i > 0; i--) { j = Math.floor(Math.random() * (i + 1)); t = o[i]; o[i] = o[j]; o[j] = t; }
    return o;
  }
  function nextIndex() { for (var i = 0; i < filled.length; i++) if (!filled[i]) return i; return -1; }
  function mark() {
    var n = nextIndex();
    all('.tqa-slot', slotsEl).forEach(function (s, i) { s.classList.toggle('is-next', i === n); });
  }
  function start(n) {
    gi = n;
    var d = WORDS[n];
    letters = Array.from(d.w);
    filled = letters.map(function () { return false; });
    $('g-step').textContent = (n + 1) + ' / ' + WORDS.length;
    $('g-mean').textContent = d.ru;
    $('g-read').textContent = '';
    slotsEl.innerHTML = ''; tilesEl.innerHTML = '';
    letters.forEach(function (l, i) {
      var s = D.createElement('div'); s.className = 'tqa-slot'; s.setAttribute('data-i', i); slotsEl.appendChild(s);
    });
    var order = shuffle(letters.map(function (l, i) { return i; }));
    if (order.join() === letters.map(function (l, i) { return i; }).join()) order.reverse();
    order.forEach(function (i) {
      var t = D.createElement('button'); t.type = 'button'; t.className = 'tqa-tile';
      t.textContent = letters[i]; t.setAttribute('data-l', letters[i]); t.setAttribute('aria-label', 'Буква ' + letters[i]);
      tilesEl.appendChild(t); bindTile(t);
    });
    endEl.hidden = true; nextBtn.hidden = false; againBtn.hidden = true; gcta.hidden = true;
    mark();
  }
  function place(tile, idx) {
    var d = WORDS[gi], slot = slotsEl.children[idx];
    if (filled[idx] || tile.getAttribute('data-l') !== letters[idx]) { bad(tile, slot); return false; }
    filled[idx] = true;
    tile.classList.remove('is-drag'); tile.style.transform = ''; tile.classList.add('is-used'); tile.disabled = true;
    slot.innerHTML = '<span>' + letters[idx] + '</span><small>' + d.s[idx] + '</small>';
    slot.classList.add('is-set');
    $('g-read').textContent = d.s.slice(0, idx + 1).join('') + '…';
    mark();
    if (nextIndex() < 0) finish();
    return true;
  }
  function bad(tile, slot) {
    tile.style.transform = '';
    [tile, slot].forEach(function (el) { if (!el) return; el.classList.remove('is-bad'); void el.offsetWidth; el.classList.add('is-bad'); });
    setTimeout(function () { tile.classList.remove('is-bad'); if (slot) slot.classList.remove('is-bad'); }, 420);
  }
  function finish() {
    var d = WORDS[gi], last = gi === WORDS.length - 1;
    $('g-read').textContent = d.tr + ' · ' + d.ru;
    endEl.hidden = false;
    nextBtn.hidden = last; againBtn.hidden = !last; gcta.hidden = !last;
    if (last) $('g-mean').textContent = 'Три слова собраны. Дальше проще.';
  }
  function bindTile(t) {
    var sx, sy, drag = false, pid = null;
    t.addEventListener('pointerdown', function (e) {
      if (t.disabled) return;
      sx = e.clientX; sy = e.clientY; drag = false; pid = e.pointerId;
      try { t.setPointerCapture(pid); } catch (er) { }
    });
    t.addEventListener('pointermove', function (e) {
      if (pid === null) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (!drag && Math.abs(dx) + Math.abs(dy) > 8) { drag = true; t.classList.add('is-drag'); }
      if (drag) t.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(1.1)';
    });
    function up(e) {
      if (pid === null) return;
      pid = null;
      try { t.releasePointerCapture(e.pointerId); } catch (er) { }
      if (!drag) { var n = nextIndex(); if (n >= 0) place(t, n); return; }
      drag = false;
      t.style.visibility = 'hidden';
      var el = D.elementFromPoint(e.clientX, e.clientY);
      t.style.visibility = '';
      t.classList.remove('is-drag');
      var s = el && el.closest ? el.closest('.tqa-slot') : null;
      if (s) place(t, +s.getAttribute('data-i')); else t.style.transform = '';
    }
    t.addEventListener('pointerup', up);
    t.addEventListener('pointercancel', function () { pid = null; drag = false; t.classList.remove('is-drag'); t.style.transform = ''; });
    t.addEventListener('click', function (e) { if (e.detail === 0) { var n = nextIndex(); if (n >= 0) place(t, n); } });
  }
  nextBtn.addEventListener('click', function () { start(gi + 1); });
  againBtn.addEventListener('click', function () { start(0); });
  start(0);

  /* заявка: на сервер ничего не уходит, сообщение отправляет человек в WhatsApp */
  var SAY = { title: 'Заявка собрана', wa: 'Отправить в WhatsApp', back: 'Изменить', hello: 'Здравствуйте! Пишу с сайта Tamarjoba.' };
  $('done-title').textContent = SAY.title; $('done-wa').textContent = SAY.wa; $('done-back').textContent = SAY.back;
  var form = $('form'), done = $('done'), ok = $('f-ok'), send = $('f-send');
  ok.addEventListener('change', function () { send.disabled = !ok.checked; });
  all('input,select', form).forEach(function (el) { el.addEventListener('input', function () { el.removeAttribute('aria-invalid'); }); });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var bad = null;
    all('[required]', form).forEach(function (el) {
      var no = el.value.trim().length < 2;
      el.setAttribute('aria-invalid', no ? 'true' : 'false');
      if (no && !bad) bad = el;
    });
    if (bad) { bad.focus(); return; }
    var lines = [SAY.hello];
    all('[data-label]', form).forEach(function (el) {
      var v = (el.tagName === 'SELECT' ? el.options[el.selectedIndex].textContent : el.value).trim();
      if (v) lines.push(el.getAttribute('data-label') + ': ' + v);
    });
    var text = lines.join('\n');
    $('done-text').textContent = text;
    $('done-wa').href = 'https://wa.me/995551160580?text=' + encodeURIComponent(text);
    form.hidden = true; done.hidden = false; done.focus();
  });
  $('done-back').addEventListener('click', function () { done.hidden = true; form.hidden = false; nm.focus(); });
})();
