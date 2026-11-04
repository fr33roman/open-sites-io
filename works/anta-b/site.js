/* ANTA EVENTS · версия Б. Без библиотек. Всё, что движется, стоит вне экрана, на скрытой вкладке и при «уменьшить движение». */
(function () {
  'use strict';
  var D = document, W = window;
  var calm = W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var bot = !!navigator.webdriver;
  function $(s, r) { return (r || D).querySelector(s); }
  function $$(s, r) { return [].slice.call((r || D).querySelectorAll(s)); }

  /* вкладка ушла в фон — все циклы встают */
  D.addEventListener('visibilitychange', function () {
    D.documentElement.classList.toggle('tnb-hidden', D.hidden);
  });

  /* вне экрана — пауза (бегущая строка, дыхание фото, видео) */
  var watch = 'IntersectionObserver' in W ? new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      e.target.classList.toggle('is-off', !e.isIntersecting);
      var v = $('video', e.target);
      if (v && !calm && !bot) { if (e.isIntersecting) v.play().catch(function () {}); else v.pause(); }
    });
  }, { threshold: 0 }) : null;
  $$('.tnb-run, .tnb-arch').forEach(function (el) { if (watch) watch.observe(el); });

  /* бегущая строка: второй набор делаем тут, в вёрстке текст один раз */
  $$('.tnb-run__track').forEach(function (tr) {
    var set = $('.tnb-run__set', tr);
    if (!set) return;
    var n = Math.max(1, Math.ceil(W.innerWidth * 1.1 / Math.max(1, set.offsetWidth)));
    for (var i = 0; i < n * 2 - 1; i++) {
      var c = set.cloneNode(true);
      c.setAttribute('aria-hidden', 'true');
      tr.appendChild(c);
    }
  });

  /* меню на телефоне */
  var burger = $('.tnb-burger'), nav = $('.tnb-nav');
  if (burger && nav) {
    var setMenu = function (open) {
      nav.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    };
    burger.addEventListener('click', function () { setMenu(!nav.classList.contains('is-open')); });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    D.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
    D.addEventListener('click', function (e) { if (nav.classList.contains('is-open') && !e.target.closest('.tnb-bar')) setMenu(false); });
  }

  /* появление блоков */
  var rv = $$('.tnb-rv');
  function show(el) { el.classList.add('in'); }
  if ('IntersectionObserver' in W && !calm) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { show(e.target); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -6% 0px', threshold: .04 });
    rv.forEach(function (el) { io.observe(el); });
    setTimeout(function () { rv.forEach(function (el) { if (!el.classList.contains('in') && el.getBoundingClientRect().top < W.innerHeight) show(el); }); }, 1400);
  } else { rv.forEach(show); }

  /* цифры досчитываются один раз */
  $$('[data-count]').forEach(function (el) {
    var to = parseInt(el.getAttribute('data-count'), 10);
    if (!to || calm || !('IntersectionObserver' in W)) return;
    var done = false;
    var o = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting || done) return;
      done = true; o.disconnect();
      var t0 = performance.now(), dur = 1300;
      (function step(t) {
        var k = Math.min(1, (t - t0) / dur);
        el.firstChild.nodeValue = String(Math.round(to * (1 - Math.pow(1 - k, 3))));
        if (k < 1) requestAnimationFrame(step);
      })(t0);
    }, { threshold: .6 });
    o.observe(el);
  });

  /* листание: дорожка со снапом, кнопки и полоска */
  $$('[data-flip]').forEach(function (box) {
    var track = $('[data-track]', box), prev = $('[data-prev]', box), next = $('[data-next]', box), bar = $('[data-bar]', box);
    if (!track) return;
    function step() { var c = track.children[0]; return c ? c.getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap || 0) : 300; }
    function upd() {
      var max = track.scrollWidth - track.clientWidth;
      if (prev) prev.disabled = track.scrollLeft < 4;
      if (next) next.disabled = track.scrollLeft > max - 4;
      if (bar) { var k = max > 0 ? track.scrollLeft / max : 0; var w = Math.max(.14, track.clientWidth / track.scrollWidth); bar.style.width = (w * 100) + '%'; bar.style.transform = 'translateX(' + (k * (1 / w - 1) * 100) + '%)'; }
    }
    if (prev) prev.addEventListener('click', function () { track.scrollBy({ left: -step(), behavior: calm ? 'auto' : 'smooth' }); });
    if (next) next.addEventListener('click', function () { track.scrollBy({ left: step(), behavior: calm ? 'auto' : 'smooth' }); });
    track.addEventListener('scroll', function () { W.requestAnimationFrame(upd); }, { passive: true });
    W.addEventListener('resize', upd);
    upd();
  });

  /* пятно света под курсором у карточек категорий (на телефоне курсора нет — не нужно) */
  if (!calm && W.matchMedia('(hover:hover)').matches) {
    $$('.tnb-cat').forEach(function (c) {
      c.addEventListener('pointermove', function (e) {
        var r = c.getBoundingClientRect();
        c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        c.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
  }

  /* видео первого экрана: только у живого посетителя */
  $$('video[data-hero]').forEach(function (v) {
    if (calm || bot) { v.removeAttribute('autoplay'); v.pause(); return; }
    v.play().catch(function () {});
  });

  /* маршрут: линия рисуется по точкам */
  $$('[data-route]').forEach(function (ol) {
    var dots = $$('.tnb-route__dot', ol);
    if (dots.length < 2) return;
    var NS = 'http://www.w3.org/2000/svg';
    var svg = D.createElementNS(NS, 'svg'); svg.setAttribute('class', 'tnb-route__line'); svg.setAttribute('aria-hidden', 'true');
    var path = D.createElementNS(NS, 'path'); path.setAttribute('class', 'tnb-route__path'); svg.appendChild(path);
    ol.insertBefore(svg, ol.firstChild);
    var pts = [], len = 0, drawn = false, started = false, fr = [];
    function layout() {
      var o = ol.getBoundingClientRect(), vertical = W.innerWidth <= 640;
      pts = dots.map(function (d) { var r = d.getBoundingClientRect(); return [r.left - o.left + r.width / 2, r.top - o.top + r.height / 2]; });
      var d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
      for (var i = 1; i < pts.length; i++) {
        var a = pts[i - 1], b = pts[i];
        d += vertical
          ? ' C' + (a[0] + 26) + ' ' + (a[1] + (b[1] - a[1]) * .5) + ' ' + (b[0] - 26) + ' ' + (a[1] + (b[1] - a[1]) * .5) + ' ' + b[0].toFixed(1) + ' ' + b[1].toFixed(1)
          : ' C' + (a[0] + (b[0] - a[0]) * .5).toFixed(1) + ' ' + a[1].toFixed(1) + ' ' + (a[0] + (b[0] - a[0]) * .5).toFixed(1) + ' ' + b[1].toFixed(1) + ' ' + b[0].toFixed(1) + ' ' + b[1].toFixed(1);
      }
      path.setAttribute('d', d);
      len = path.getTotalLength();
      var acc = 0, tot = 0, seg = [];
      for (var j = 1; j < pts.length; j++) { var l = Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]); seg.push(l); tot += l; }
      fr = [0]; for (var k = 0; k < seg.length; k++) { acc += seg[k]; fr.push(acc / tot); }
      path.style.strokeDasharray = len;
      path.style.strokeDashoffset = (drawn || calm) ? 0 : len;
    }
    function play() {
      if (started) return; started = true;
      var dur = Math.min(2600, 700 + dots.length * 280);
      if (calm) { dots.forEach(function (d) { d.classList.add('is-on'); }); drawn = true; path.style.strokeDashoffset = 0; return; }
      path.style.transition = 'stroke-dashoffset ' + dur + 'ms cubic-bezier(.45,.05,.3,1)';
      requestAnimationFrame(function () { path.style.strokeDashoffset = 0; });
      dots.forEach(function (d, i) { setTimeout(function () { d.classList.add('is-on'); }, fr[i] * dur * .92); });
      setTimeout(function () { drawn = true; }, dur);
    }
    layout();
    (D.fonts && D.fonts.ready ? D.fonts.ready : Promise.resolve()).then(layout);
    var t; W.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(function () { path.style.transition = 'none'; layout(); }, 120); });
    if ('IntersectionObserver' in W) {
      var o2 = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { layout(); play(); o2.disconnect(); } }, { threshold: .35 });
      o2.observe(ol);
    } else { play(); }
  });

  /* форма: собираем текст и открываем WhatsApp */
  var form = $('#form');
  if (form) {
    var ok = $('#f-ok'), send = $('#f-send'), done = $('#done');
    var WA = form.getAttribute('data-wa');
    function sync() { send.disabled = !ok.checked; }
    ok.addEventListener('change', sync); sync();
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var bad = false;
      $$('[data-need]', form).forEach(function (f) {
        var v = !f.value.trim(); f.setAttribute('aria-invalid', v ? 'true' : 'false'); if (v) bad = true;
      });
      if (bad || !ok.checked) { var first = $('[aria-invalid="true"]', form); if (first) first.focus(); return; }
      var name = $('#f-name').value.trim(), how = $('#f-how').value.trim(), msg = $('#f-msg').value.trim();
      var text = 'Здравствуйте! Меня зовут ' + name + '. Связь: ' + how + '.' + (msg ? ' ' + msg : '');
      var url = WA + '?text=' + encodeURIComponent(text);
      $('#done-wa').setAttribute('href', url);
      form.hidden = true; done.hidden = false; done.focus();
      try { W.open(url, '_blank', 'noopener'); } catch (err) { /* кнопка в окне «Сообщение готово» остаётся */ }
    });
    var back = $('#done-back');
    if (back) back.addEventListener('click', function () { done.hidden = true; form.hidden = false; });
  }
})();
