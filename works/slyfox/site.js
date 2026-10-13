/* Sly Fox School — общий скрипт всех страниц (третья версия, 14.10.2026).
   На сервер ничего не уходит: форма собирает текст и открывает Telegram тренера. */
(function () {
  'use strict';
  var D = document, W = window, H = D.documentElement;
  function $(id) { return D.getElementById(id); }
  function all(s, root) { return [].slice.call((root || D).querySelectorAll(s)); }
  var calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var touch = matchMedia('(hover: none)').matches;
  var hasIO = 'IntersectionObserver' in W;
  var ROOT = H.getAttribute('data-root') || '';

  /* шапка: подсветка после прокрутки, меню по кнопке на телефоне */
  var bar = $('bar'), burger = $('burger');
  if (bar) {
    var stuck = function () { bar.classList.toggle('is-stuck', W.scrollY > 24); };
    W.addEventListener('scroll', stuck, { passive: true }); stuck();
  }
  if (bar && burger) {
    burger.addEventListener('click', function () {
      var open = bar.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', String(open));
    });
    D.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && bar.classList.contains('is-open')) { bar.classList.remove('is-open'); burger.setAttribute('aria-expanded', 'false'); burger.focus(); }
    });
  }

  /* цифры досчитываются, когда блок показан */
  function count(el) {
    var to = parseInt(el.textContent, 10), t0 = 0;
    if (!to || el.sfDone) return; el.sfDone = 1;
    function step(t) {
      if (!t0) t0 = t;
      var p = Math.min(1, (t - t0) / 1100), e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(to * e);
      if (p < 1) requestAnimationFrame(step); else el.textContent = to;
    }
    el.textContent = '0'; requestAnimationFrame(step);
  }

  /* появление блоков при прокрутке; запасной таймер для вкладки, открытой в фоне */
  var rev = all('.reveal');
  function show(el) {
    if (el.sfIn) return; el.sfIn = 1;
    el.classList.add('in'); if (!calm) all('[data-count]', el).forEach(count);
    /* после появления классы снимаются, чтобы отклик на наведение шёл без задержки появления */
    var d = parseFloat(getComputedStyle(el).getPropertyValue('--d')) || 0;
    setTimeout(function () { el.classList.remove('reveal', 'in'); }, calm ? 0 : 1700 + d * 1000);
  }
  if (hasIO && !calm) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { show(e.target); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -7% 0px', threshold: .05 });
    rev.forEach(function (el) { io.observe(el); });
    setTimeout(function () {
      rev.forEach(function (el) { if (!el.sfIn && el.getBoundingClientRect().top < innerHeight) show(el); });
    }, 2200);
    setTimeout(function () { all('.sf-facts [data-count]').forEach(count); }, 900);
  } else rev.forEach(show);

  /* свет прожектора: пятно идёт за курсором и пальцем по первому экрану (только transform) */
  var hero = $('hero'), spot = $('spot');
  if (hero && spot && !calm) {
    var sp = null, spT = 0;
    var move = function (e) {
      var r = hero.getBoundingClientRect(); sp = [e.clientX - r.left, e.clientY - r.top];
      if (!spT) spT = requestAnimationFrame(function () { spT = 0; spot.style.transform = 'translate3d(' + sp[0].toFixed(0) + 'px,' + sp[1].toFixed(0) + 'px,0)'; });
    };
    hero.addEventListener('pointermove', move, { passive: true });
    hero.addEventListener('pointerdown', move, { passive: true });
  }

  /* подсветка: кромка каждой карточки и кнопки светится там, где курсор или палец */
  if (!calm) {
    var lit = [], pt = null, raf = 0, offT = 0;
    var paint = function () {
      raf = 0;
      var now = [], n = D.elementFromPoint(pt[0], pt[1]);
      while (n && n !== D.body) {
        if (n.classList && (n.classList.contains('sf-card') || n.classList.contains('sf-btn'))) {
          var r = n.getBoundingClientRect();
          n.style.setProperty('--mx', (pt[0] - r.left).toFixed(0) + 'px');
          n.style.setProperty('--my', (pt[1] - r.top).toFixed(0) + 'px');
          n.classList.add('is-lit'); now.push(n);
        }
        n = n.parentElement;
      }
      lit.forEach(function (el) { if (now.indexOf(el) < 0) dim(el); });
      lit = now;
    };
    var dim = function (el) { el.classList.remove('is-lit'); el.style.removeProperty('--mx'); el.style.removeProperty('--my'); };
    var clear = function () { lit.forEach(dim); lit = []; };
    var on = function (e) { clearTimeout(offT); pt = [e.clientX, e.clientY]; if (!raf) raf = requestAnimationFrame(paint); };
    D.addEventListener('pointermove', on, { passive: true });
    D.addEventListener('pointerdown', on, { passive: true });
    D.addEventListener('pointerup', function (e) { if (e.pointerType !== 'mouse') offT = setTimeout(clear, 1400); }, { passive: true });
    D.addEventListener('pointercancel', function () { offT = setTimeout(clear, 900); }, { passive: true });
    H.addEventListener('pointerleave', clear);
  }

  /* на телефоне наведения нет: карточки на экране подсвечиваются сами по очереди, волной */
  if (!calm && touch && hasIO) {
    var seenCards = [], wi = 0;
    var cio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var i = seenCards.indexOf(e.target);
        if (e.isIntersecting && i < 0) seenCards.push(e.target);
        if (!e.isIntersecting && i >= 0) seenCards.splice(i, 1);
      });
    }, { threshold: .35 });
    var watchCards = function () { all('.sf-card:not(.sf-shot)').forEach(function (c) { if (!c.sfW) { c.sfW = 1; cio.observe(c); } }); };
    watchCards(); W.sfWatchCards = watchCards;
    var wave = function () {
      if (D.hidden || !seenCards.length) { setTimeout(wave, 1200); return; }
      var list = seenCards.slice().sort(function (a, b) { return a.getBoundingClientRect().top - b.getBoundingClientRect().top || a.getBoundingClientRect().left - b.getBoundingClientRect().left; });
      if (wi >= list.length) { wi = 0; setTimeout(wave, 2600); return; }
      var c = list[wi++]; c.classList.add('is-wave');
      setTimeout(function () { c.classList.remove('is-wave'); }, 1500);
      setTimeout(wave, 650);
    };
    setTimeout(wave, 1800);
  }

  /* клубные карты наклоняются в объёме, по ним идёт блик */
  if (!calm) all('[data-tilt]').forEach(function (box) {
    var glare = box.querySelector('.sf-club__glare'), traf = 0, p = null, off = 0;
    function tilt() {
      traf = 0;
      var r = box.getBoundingClientRect(), x = p[0] - r.left, y = p[1] - r.top;
      var px = Math.max(0, Math.min(1, x / r.width)) - .5, py = Math.max(0, Math.min(1, y / r.height)) - .5;
      box.style.transform = 'rotateX(' + (-py * 9).toFixed(2) + 'deg) rotateY(' + (px * 11).toFixed(2) + 'deg) translateZ(8px)';
      if (glare) glare.style.transform = 'translate3d(' + x.toFixed(0) + 'px,' + y.toFixed(0) + 'px,0)';
    }
    function go(e) {
      clearTimeout(off); p = [e.clientX, e.clientY];
      if (box.classList.contains('is-live')) { if (!traf) traf = requestAnimationFrame(tilt); }
      else { tilt(); setTimeout(function () { box.classList.add('is-live'); }, 300); }
    }
    function out() { box.classList.remove('is-live'); box.style.transform = ''; }
    box.addEventListener('pointermove', go, { passive: true });
    box.addEventListener('pointerdown', go, { passive: true });
    box.addEventListener('pointerleave', out);
    box.addEventListener('pointercancel', function () { off = setTimeout(out, 900); });
    box.addEventListener('pointerup', function (e) { if (e.pointerType !== 'mouse') off = setTimeout(out, 1400); });
  });

  /* карусель «Тренировка»: сама едет по кругу, шаг раз в 2,5 с (таймер); палец и курсор останавливают,
     через 3 с после отпускания едет дальше; вне экрана стоит */
  var lane = $('track');
  if (lane) (function () {
    var row = lane.firstElementChild, real = [].slice.call(row.children), n = real.length;
    if (n < 2) return;
    var cnt = $('cnt'), cntBar = $('cnt-bar'), dots = all('#dots i');
    function copy(c) {
      var k = c.cloneNode(true); k.setAttribute('aria-hidden', 'true'); k.classList.remove('reveal', 'in');
      all('img', k).forEach(function (im) { im.loading = 'eager'; });
      return k;
    }
    real.forEach(function (c) { c.classList.remove('reveal', 'in'); });
    var before = D.createDocumentFragment(), after = D.createDocumentFragment();
    real.forEach(function (c) { before.appendChild(copy(c)); after.appendChild(copy(c)); });
    row.insertBefore(before, row.firstChild); row.appendChild(after);
    var cards = [].slice.call(row.children), idx = n, STEP = 2500, HOLD = 3000, nextAt = Date.now() + STEP, seen = true, hover = false, drag = null, x0 = 0, fixT = 0;
    lane.classList.add('is-live');

    function base(i) { var c = cards[i]; return lane.clientWidth / 2 - (c.offsetLeft + c.offsetWidth / 2); }
    function place(i, extra) { x0 = base(i); row.style.transform = 'translate3d(' + (x0 + (extra || 0)).toFixed(1) + 'px,0,0)'; }
    function mark() {
      cards.forEach(function (c, i) { c.classList.toggle('is-on', i === idx); });
      var k = ((idx % n) + n) % n;
      if (cnt) cnt.textContent = '0' + (k + 1);
      if (cntBar) cntBar.style.transform = 'scaleX(' + ((k + 1) / n) + ')';
      dots.forEach(function (d, i) { d.classList.toggle('is-on', i === k); });
    }
    function jump(fn) { lane.classList.add('is-jump'); fn(); void row.offsetWidth; lane.classList.remove('is-jump'); }
    /* после шага возвращаемся в средний набор карточек: скачок без перехода, глазу не виден */
    function settle() {
      if (idx >= n && idx < 2 * n) return;
      jump(function () { idx = n + (((idx - n) % n) + n) % n; place(idx); mark(); });
    }
    function go(i) {
      idx = Math.max(0, Math.min(cards.length - 1, i)); place(idx); mark();
      clearTimeout(fixT); fixT = setTimeout(settle, calm ? 0 : 960);
    }
    jump(function () { place(idx); mark(); });
    W.addEventListener('resize', function () { jump(function () { place(idx); }); });
    W.addEventListener('load', function () { jump(function () { place(idx); }); });

    if (hasIO) new IntersectionObserver(function (es) { seen = es[0].isIntersecting; if (seen) nextAt = Date.now() + 1200; }).observe(lane);
    function hold() { nextAt = Date.now() + HOLD; }
    if (!calm) setInterval(function () {
      if (!seen || D.hidden || hover || drag || Date.now() < nextAt) return;
      nextAt = Date.now() + STEP; settle(); go(idx + 1);
    }, 250);
    lane.addEventListener('mouseenter', function () { hover = true; });
    lane.addEventListener('mouseleave', function () { hover = false; hold(); });
    lane.addEventListener('focusin', hold);

    lane.addEventListener('pointerdown', function (e) {
      if (e.button) return;
      clearTimeout(fixT); settle();
      drag = { x: e.clientX, dx: 0, id: e.pointerId, moved: false };
    });
    lane.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      drag.dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(drag.dx) > 6) { drag.moved = true; lane.classList.add('is-drag'); try { lane.setPointerCapture(e.pointerId); } catch (err) { /* нет захвата — тянем и так */ } }
      if (drag.moved) row.style.transform = 'translate3d(' + (x0 + drag.dx).toFixed(1) + 'px,0,0)';
    });
    function drop(e) {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      var d = drag; drag = null; lane.classList.remove('is-drag'); hold();
      if (!d.moved) return;
      var w = cards[1].offsetLeft - cards[0].offsetLeft, k = Math.round(-d.dx / w);
      if (!k && Math.abs(d.dx) > 40) k = d.dx < 0 ? 1 : -1;
      go(idx + k);
    }
    lane.addEventListener('pointerup', drop);
    lane.addEventListener('pointercancel', drop);
    lane.addEventListener('click', function (e) {
      var c = e.target.closest('.sf-shot'), i = cards.indexOf(c);
      if (i >= 0 && i !== idx) { hold(); settle(); go(i); }
    });
    var prev = $('lane-prev'), next = $('lane-next');
    if (prev) { prev.hidden = false; prev.addEventListener('click', function () { hold(); settle(); go(idx - 1); }); }
    if (next) { next.hidden = false; next.addEventListener('click', function () { hold(); settle(); go(idx + 1); }); }
    lane.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { hold(); settle(); go(idx + 1); }
      if (e.key === 'ArrowLeft') { hold(); settle(); go(idx - 1); }
    });
  })();

  /* расписание: дни недели, под ними занятия дня карточками; выбранное уходит на страницу записи через адрес */
  var week = $('week'), daysBox = $('days'), lessons = $('lessons'), dayname = $('dayname');
  if (week && daysBox && lessons) (function () {
    var NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт'], FULL = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница'];
    var say = lessons.getAttribute('data-say') || '';
    var rows = all('tbody tr', week).map(function (r) {
      var c = r.children;
      return { days: r.getAttribute('data-days').split(',').map(Number), time: c[1].textContent.trim(), group: c[2].textContent.trim(), min: c[3].textContent.trim() };
    });
    var today = new Date().getDay(), cur = (today >= 1 && today <= 5) ? today : 1, dayBar = D.createElement('i');
    dayBar.className = 'sf-days__bar';
    function draw() {
      all('.sf-day', daysBox).forEach(function (b, i) { b.setAttribute('aria-pressed', String(i + 1 === cur)); });
      dayBar.style.setProperty('--i', cur - 1); dayname.textContent = FULL[cur - 1];
      lessons.innerHTML = '';
      rows.filter(function (r) { return r.days.indexOf(cur) >= 0; }).sort(function (a, b) { return a.time < b.time ? -1 : 1; }).forEach(function (r, k) {
        var a = D.createElement('a'); a.className = 'sf-card sf-slot'; a.style.setProperty('--k', k);
        a.href = ROOT + 'zapis/index.html?gruppa=' + encodeURIComponent(r.group) + '&den=' + encodeURIComponent(FULL[cur - 1]);
        a.innerHTML = '<span class="sf-slot__in"><span class="sf-slot__t">' + r.time + '</span><span class="sf-slot__g"><b>' + r.group + '</b><span class="sf-tag">' + r.min + ' минут</span></span><span class="sf-slot__go">' + say + '<span class="sf-go"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-arrow"/></svg></span></span></span>';
        lessons.appendChild(a);
      });
      if (W.sfWatchCards) W.sfWatchCards();
    }
    NAMES.forEach(function (nm, i) {
      var b = D.createElement('button'); b.type = 'button'; b.className = 'sf-day' + (i + 1 === today ? ' is-today' : ''); b.textContent = nm; b.setAttribute('aria-pressed', 'false'); b.setAttribute('aria-label', FULL[i]);
      b.addEventListener('click', function () { cur = i + 1; draw(); }); daysBox.appendChild(b);
    });
    daysBox.insertBefore(dayBar, daysBox.firstChild); daysBox.hidden = false; dayname.hidden = false; draw();
  })();

  /* заявка: группа и день приходят из адреса (?gruppa=…&den=…); форма собирает текст и открывает Telegram */
  var form = $('form');
  if (form) (function () {
    var SAY = { title: 'Заявка готова. Осталось отправить её в Telegram.', tg: 'Написать в Telegram', back: 'Изменить', hello: 'Здравствуйте! Хочу записаться на пробную тренировку.' };
    var done = $('done'), ok = $('f-ok'), send = $('f-send'), nm = $('f-name');
    $('done-title').textContent = SAY.title; $('done-tg').textContent = SAY.tg; $('done-back').textContent = SAY.back;
    var q; try { q = new URLSearchParams(location.search); } catch (e) { q = null; }
    function preset(el, v) {
      if (!el || !v) return false;
      var hit = [].some.call(el.options, function (o) { return o.text === v; });
      if (hit) { el.value = v; el.classList.add('is-set'); }
      return hit;
    }
    if (q) {
      var a = preset($('f-group'), q.get('gruppa')), b = preset($('f-day'), q.get('den'));
      if (a || b) setTimeout(function () { nm.focus({ preventScroll: true }); }, 900);
    }
    ok.addEventListener('change', function () { send.disabled = !ok.checked; });
    all('input,select', form).forEach(function (el) {
      el.addEventListener('input', function () { el.removeAttribute('aria-invalid'); el.classList.remove('is-set'); });
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (nm.value.trim().length < 2) { nm.setAttribute('aria-invalid', 'true'); nm.focus(); return; }
      var lines = [SAY.hello];
      all('[data-label]', form).forEach(function (el) {
        var v = (el.value || '').trim();
        if (v) lines.push(el.getAttribute('data-label') + ': ' + v);
      });
      var text = lines.join('\n'), url = 'https://t.me/koba19910?text=' + encodeURIComponent(text);
      $('done-text').textContent = text; $('done-tg').href = url;
      form.hidden = true; done.hidden = false; done.focus();
      W.open(url, '_blank', 'noopener');
    });
    $('done-back').addEventListener('click', function () { done.hidden = true; form.hidden = false; nm.focus(); });
  })();
})();
