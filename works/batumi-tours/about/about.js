/* Страница «О нас»: запуск видео, живой фон, свечение карточек, лента отзывов.
   Меню шапки — в ../blog/blog.js. Отзывы и свечение перенесены из index.html (тот же код). */
(function () {
  'use strict';
  var W = window, D = document, root = D.documentElement;
  var REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || D).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || D).querySelectorAll(s)); };
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* когда страница увидела элемент: один раз или туда-обратно */
  function watch(els, cb, opt, once) {
    if (!('IntersectionObserver' in W)) { els.forEach(function (el) { cb(el, true); }); return; }
    var o = new IntersectionObserver(function (es) { es.forEach(function (e) { cb(e.target, e.isIntersecting); if (e.isIntersecting && once) o.unobserve(e.target); }); }, opt || { threshold: .3 });
    els.forEach(function (el) { o.observe(el); });
  }

  /* блоки выходят по очереди */
  var up = $$('.bt-up');
  if ('IntersectionObserver' in W) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -8% 0px', threshold: .05 });
    up.forEach(function (el) { io.observe(el); });
  } else up.forEach(function (el) { el.classList.add('is-in'); });

  /* живой фон панели: вне экрана стоит */
  var hero = $('.ab-hero');
  if (hero) watch([hero], function (el, on) { el.classList.toggle('is-off', !on); }, { threshold: 0 });

  /* свечение блоков: пятно света идёт за курсором и пальцем */
  $$('[data-glow]').forEach(function (el) {
    var t = 0;
    function pos(e) { var r = el.getBoundingClientRect(); el.style.setProperty('--mx', (e.clientX - r.left).toFixed(0) + 'px'); el.style.setProperty('--my', (e.clientY - r.top).toFixed(0) + 'px'); }
    el.addEventListener('pointermove', pos, { passive: true });
    el.addEventListener('pointerdown', function (e) { pos(e); clearTimeout(t); el.classList.add('is-hot'); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (n) {
      el.addEventListener(n, function () { clearTimeout(t); t = setTimeout(function () { el.classList.remove('is-hot'); }, n === 'pointerleave' ? 0 : 800); });
    });
  });

  /* кольцо и пунктир за рамкой чуть едут за курсором (как кадры коллажа на главной) */
  var stage = $('#abStage');
  if (stage && hero && matchMedia('(hover:hover)').matches && !REDUCED) {
    hero.addEventListener('pointermove', function (e) {
      var r = stage.getBoundingClientRect();
      stage.style.setProperty('--px', clamp((e.clientX - r.left - r.width / 2) / (r.width / 2), -1.4, 1.4).toFixed(2));
      stage.style.setProperty('--py', clamp((e.clientY - r.top - r.height / 2) / (r.height / 2), -1.4, 1.4).toFixed(2));
    }, { passive: true });
    hero.addEventListener('pointerleave', function () { stage.style.setProperty('--px', 0); stage.style.setProperty('--py', 0); });
  }

  /* пунктир маршрута у рамки: точки бегут шагами около 10 раз в секунду, пока рамка на экране
     (CSS-анимация stroke-dashoffset заставляет браузер пересобирать страницу каждый кадр; тот же приём, что у коллажа на главной) */
  var dash = $('.ab-route path');
  if (dash && stage && !REDUCED) {
    var dashTimer = 0, dashSee = false;
    var dashTick = function () { dash.style.strokeDashoffset = (-(performance.now() * 0.0108 % 13)).toFixed(2); };
    var dashSync = function () {
      var run = dashSee && !D.hidden;
      if (run && !dashTimer) { dashTick(); dashTimer = setInterval(dashTick, 100); }
      else if (!run && dashTimer) { clearInterval(dashTimer); dashTimer = 0; }
    };
    watch([stage], function (el, on) { dashSee = on; dashSync(); }, { threshold: 0 });
    D.addEventListener('visibilitychange', dashSync);
  }

  /* видео: до нажатия не качается совсем (preload="none"), кадр — обложка-картинка поверх, весь кадр — кнопка запуска.
     Свою кнопку показываем только со скриптом; без него у ролика родные элементы управления */
  var vid = $('#abVideo'), box = $('#abScreen'), cover = $('#abCover');
  if (vid && box && cover) {
    var src = vid.querySelector('source'), picked = false;
    vid.controls = false;
    /* на узком экране и при включённой экономии трафика — лёгкий файл 1280×720; решаем перед первым запуском */
    var pick = function () {
      if (picked) return; picked = true;
      var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (src && (matchMedia('(max-width:700px)').matches || (conn && conn.saveData))) {
        src.src = 'o-nas-720.mp4';
        vid.load();
      }
    };
    /* обложка уходит, когда ролик пошёл (не раньше: под ней не будет чёрного кадра); не пошёл — всё равно открываем родные кнопки */
    var shown = function () {
      box.classList.remove('is-load'); box.classList.add('is-play'); vid.controls = true;
      try { vid.focus({ preventScroll: true }); } catch (e) { /* старый браузер: фокус не обязателен */ }
    };
    var go = function () {
      pick();
      box.classList.add('is-load');
      vid.muted = false;
      var p = vid.play();
      if (p && p.catch) p.catch(shown);
    };
    cover.addEventListener('click', go);
    vid.addEventListener('playing', shown);
    if (src) src.addEventListener('error', shown);   // файла нет или не открылся: убрать обложку, показать родные кнопки
  }

  /* отзывы: лента листается сама и под пальцем (код из index.html) */
  var revs = $('#btRevs'), revOn = false, revUntil = 0;
  if (revs) {
    var revStep = function (dir) {
      var card = $('.bt-rv', revs), w = card.offsetWidth + 14, max = revs.scrollWidth - revs.clientWidth;
      if (dir > 0 && revs.scrollLeft >= max - 6) revs.scrollTo({ left: 0, behavior: REDUCED ? 'auto' : 'smooth' });
      else revs.scrollBy({ left: dir * w, behavior: REDUCED ? 'auto' : 'smooth' });
    };
    var prev = $('#btRevPrev'), next = $('#btRevNext');
    if (prev) prev.addEventListener('click', function () { revUntil = Date.now() + 9000; revStep(-1); });
    if (next) next.addEventListener('click', function () { revUntil = Date.now() + 9000; revStep(1); });
    ['pointerenter', 'pointerdown', 'touchstart', 'focusin'].forEach(function (ev) { revs.addEventListener(ev, function () { revUntil = Date.now() + 9000; }, { passive: true }); });
    revs.addEventListener('wheel', function () { revUntil = Date.now() + 9000; }, { passive: true });
    watch([revs], function (el, on) { revOn = on; }, { threshold: .4 });
    if (!REDUCED) setInterval(function () { if (revOn && Date.now() > revUntil && !D.hidden) revStep(1); }, 3200);
  }
})();
