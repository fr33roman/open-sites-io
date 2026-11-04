/* ANTA EVENTS · DMC GEORGIA — версия А. Без библиотек. Всё, что движется, стоит вне экрана и на скрытой вкладке. */
(function () {
  'use strict';
  var d = document, root = d.documentElement;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var driven = !!navigator.webdriver;

  function $(s, c) { return (c || d).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || d).querySelectorAll(s)); }

  // скрытая вкладка — все анимации на паузе
  d.addEventListener('visibilitychange', function () { root.classList.toggle('is-hidden', d.hidden); });

  // шапка: над тёмным первым экраном прозрачная, дальше сливочная
  var hd = $('.tna-hd--dark');
  if (hd) {
    var onScroll = function () { hd.classList.toggle('is-solid', window.scrollY > 40); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // меню на телефоне
  var burger = $('.tna-burger'), menu = $('#tna-menu');
  function setMenu(open) {
    if (!burger || !menu) return;
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    menu.hidden = !open;
    d.body.style.overflow = open ? 'hidden' : '';
    if (hd && open) hd.classList.add('is-solid');
    else if (hd) hd.classList.toggle('is-solid', window.scrollY > 40);
  }
  if (burger) {
    burger.addEventListener('click', function () { setMenu(burger.getAttribute('aria-expanded') !== 'true'); });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
    window.addEventListener('resize', function () { if (window.innerWidth > 960) setMenu(false); });
  }

  // бегущая строка: копия набора для бесшовного круга
  var mq = $('.tna-marq');
  if (mq) {
    var tr = $('.tna-marq__track', mq), kids = $$('li', tr);
    kids.forEach(function (li) { tr.appendChild(li.cloneNode(true)); });
  }

  // живые зоны запускаются, пока их видно
  var live = $$('.tna-hero, .tna-marq');
  if ('IntersectionObserver' in window) {
    var lio = new IntersectionObserver(function (es) {
      es.forEach(function (e) { e.target.classList.toggle('is-live', e.isIntersecting && !reduce); });
    }, { threshold: 0.05 });
    live.forEach(function (el) { lio.observe(el); });
  }

  // видео первого экрана: файлы кладёт клиентка; нет файла — работает обложка
  var vid = $('.tna-hero__vid');
  if (vid && !driven && !reduce) {
    var mobile = window.matchMedia('(max-width: 760px)').matches;
    var src = mobile ? vid.getAttribute('data-v') : vid.getAttribute('data-h');
    var heroEl = $('.tna-hero');
    var armed = false;
    var vio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting && !d.hidden) {
          if (!armed) {
            armed = true;
            vid.src = src;
            vid.addEventListener('playing', function () { vid.classList.add('is-on'); }, { once: true });
          }
          var p = vid.play(); if (p && p.catch) p.catch(function () {});
        } else { vid.pause(); }
      });
    }, { threshold: 0.1 });
    vio.observe(heroEl);
    d.addEventListener('visibilitychange', function () { if (d.hidden) vid.pause(); });
  }

  // время в Тбилиси
  var clock = $('.tna-clock');
  if (clock && window.Intl && Intl.DateTimeFormat) {
    var fmt = new Intl.DateTimeFormat('ru-RU', { timeZone: clock.getAttribute('data-tz'), hour: '2-digit', minute: '2-digit', hour12: false });
    var tick = function () { if (!d.hidden) clock.textContent = fmt.format(new Date()); };
    tick();
    setInterval(tick, 20000);
    d.addEventListener('visibilitychange', tick);
  }

  // появление по очереди
  var targets = $$('.tna-head, .tna-about__body > *, .tna-tours__lead, .tna-cat, .tna-mice__p, .tna-mice__tx .tna-btn, .tna-rev, .tna-contact__tx > *, .tna-voucher, .tna-adv li, .tna-fmt li, .tna-row, .tna-days li, .tna-list, .tna-morelist li, .tna-prose, .tna-band > *');
  var curt = $$('[data-curtain]');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    targets.forEach(function (el, i) {
      el.classList.add('tna-rv');
      el.style.setProperty('--d', (i % 4) * 0.07 + 's');
      io.observe(el);
    });
    curt.forEach(function (el) { io.observe(el); });
  } else {
    curt.forEach(function (el) { el.classList.add('is-in'); });
  }

  // цифры досчитываются
  var counters = $$('[data-count]');
  if (counters.length && 'IntersectionObserver' in window && !reduce) {
    var cio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        cio.unobserve(e.target);
        var el = e.target, to = +el.getAttribute('data-count'), t0 = null, dur = 1400;
        el.textContent = '0';
        (function step(ts) {
          if (t0 === null) t0 = ts;
          var k = Math.min(1, (ts - t0) / dur), v = 1 - Math.pow(1 - k, 3);
          el.textContent = String(Math.round(to * v));
          if (k < 1) requestAnimationFrame(step); else el.textContent = String(to);
        })(performance.now());
      });
    }, { threshold: 0.5 });
    counters.forEach(function (el) { cio.observe(el); });
  }

  // свет под курсором на карточках (только где есть мышь)
  if (window.matchMedia && matchMedia('(hover: hover)').matches) {
    $$('[data-spot]').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        el.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
  }

  // форма: собирает сообщение и открывает WhatsApp
  $$('.tna-form').forEach(function (f) {
    var agree = f.elements.ok, send = $('button[type=submit]', f);
    if (agree && send) agree.addEventListener('change', function () { send.disabled = !agree.checked; });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if (agree && !agree.checked) return;
      var ok = $('.tna-form__ok', f), bad = null;
      ['name', 'way', 'msg'].forEach(function (n) {
        var el = f.elements[n];
        if (!el.value.trim()) { el.style.borderColor = '#B3261E'; bad = bad || el; } else { el.style.borderColor = ''; }
      });
      if (bad) { bad.focus(); return; }
      var text = f.getAttribute('data-hello') + '\n\nИмя — ' + f.elements.name.value.trim() +
        '\nСвязь — ' + f.elements.way.value.trim() + '\n\n' + f.elements.msg.value.trim();
      var url = 'https://wa.me/' + f.getAttribute('data-wa') + '?text=' + encodeURIComponent(text);
      ok.textContent = f.getAttribute('data-ok');
      window.open(url, '_blank', 'noopener');
    });
  });
})();
