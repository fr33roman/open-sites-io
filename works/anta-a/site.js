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

  // шапка: над тёмным первым экраном прозрачная, дальше сливочная; линия прогресса чтения
  var hd = $('.tna-hd');
  var hdDark = $('.tna-hd--dark');
  var par = $$('[data-par]'), parOn = par.length && 'IntersectionObserver' in window && !reduce;
  var ticking = false;
  function frame() {
    ticking = false;
    var y = window.scrollY, vh = window.innerHeight;
    if (hdDark) hdDark.classList.toggle('is-solid', y > 40);
    if (hd) {
      var max = d.documentElement.scrollHeight - vh;
      hd.style.setProperty('--sp', max > 0 ? Math.min(1, y / max).toFixed(4) : 0);
    }
    if (parOn && !d.hidden) par.forEach(function (el) {
      if (!el.__vis) return;
      var kind = el.getAttribute('data-par'), py;
      if (kind === 'hero') {
        py = Math.min(1, y / vh) * 44;
      } else {
        var r = el.parentElement.getBoundingClientRect();
        var p = Math.max(0, Math.min(1, (vh - r.top) / (vh + r.height)));
        py = kind === 'arch' ? -20 + 20 * p : (p - 0.5) * 32;
      }
      el.style.setProperty('--py', py.toFixed(1) + 'px');
    });
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  frame();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  if (parOn) {
    var pio = new IntersectionObserver(function (es) {
      es.forEach(function (e) { e.target.__vis = e.isIntersecting; });
      onScroll();
    }, { rootMargin: '12% 0px' });
    par.forEach(function (el) { pio.observe(el); });
  }

  // тема оформления: три образца, выбор запоминается
  var TC = { wine: '#17141A', cypress: '#0E1A16', graphite: '#0C0D10' };
  var sws = $$('.tna-sw'), metaTC = $('meta[name=theme-color]');
  function applyTheme(t, save) {
    if (!TC[t]) t = 'wine';
    if (t === 'wine') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', t);
    sws.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-theme-set') === t ? 'true' : 'false'); });
    if (metaTC) metaTC.setAttribute('content', TC[t]);
    if (save) { try { localStorage.setItem('tna-theme', t); } catch (e) {} }
  }
  applyTheme(root.getAttribute('data-theme') || 'wine', false);
  sws.forEach(function (b) {
    b.addEventListener('click', function () {
      root.classList.add('is-theming');
      applyTheme(b.getAttribute('data-theme-set'), true);
      setTimeout(function () { root.classList.remove('is-theming'); }, 700);
    });
  });

  // меню на телефоне
  var burger = $('.tna-burger'), menu = $('#tna-menu');
  function setMenu(open) {
    if (!burger || !menu) return;
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    menu.hidden = !open;
    d.body.style.overflow = open ? 'hidden' : '';
    if (hdDark && open) hdDark.classList.add('is-solid');
    else if (hdDark) hdDark.classList.toggle('is-solid', window.scrollY > 40);
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

  // заголовки появляются строками: слова в обёртках, задержка по номеру строки
  function splitLines(h) {
    if (h.__split) return; h.__split = true;
    var parts = h.textContent.split(/( +)/), frag = d.createDocumentFragment();
    parts.forEach(function (w) {
      if (!w) return;
      if (/^ +$/.test(w)) { frag.appendChild(d.createTextNode(' ')); return; }
      var o = d.createElement('b'), i = d.createElement('b');
      o.className = 'tna-wd'; i.textContent = w; o.appendChild(i); frag.appendChild(o);
    });
    h.textContent = ''; h.appendChild(frag);
    var tops = [], cnt = {};
    $$('.tna-wd', h).forEach(function (o) {
      var t = o.offsetTop, li = tops.indexOf(t);
      if (li < 0) { tops.push(t); li = tops.length - 1; }
      cnt[li] = (cnt[li] || 0);
      o.style.setProperty('--wl', li); o.style.setProperty('--wi', cnt[li]++);
    });
  }
  var heads = $$('.tna-hero h1, .tna-phero h1, .tna-thero h1, .tna-head h2, .tna-band h2, .tna-band__q');
  var canAnim = 'IntersectionObserver' in window && !reduce;

  // появление по очереди
  var targets = $$('.tna-head, .tna-about__body > *, .tna-tours__lead, .tna-cat, .tna-mice__p, .tna-mice__tx .tna-btn, .tna-rev, .tna-contact__tx > *, .tna-voucher, .tna-adv li, .tna-fmt li, .tna-row, .tna-days li, .tna-list, .tna-morelist li, .tna-prose, .tna-band > *, .tna-facts__row li');
  var curt = $$('[data-curtain]');
  if (canAnim) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    var order = new Map();
    targets.forEach(function (el) {
      var par = el.parentElement, n = order.get(par) || 0;
      order.set(par, n + 1);
      el.classList.add('tna-rv');
      el.style.setProperty('--d', Math.min(n, 6) * 0.09 + 's');
      io.observe(el);
    });
    curt.forEach(function (el) { io.observe(el); });
    var go = function () {
      heads.forEach(splitLines);
      // первый экран и шапки страниц: строки идут сразу
      $$('.tna-hero h1, .tna-phero h1, .tna-thero h1').forEach(function (h) {
        h.style.setProperty('--w0', '.15s');
        requestAnimationFrame(function () { requestAnimationFrame(function () { h.classList.add('is-lines'); }); });
      });
    };
    var done = false, once = function () { if (!done) { done = true; go(); } };
    if (d.fonts && d.fonts.ready) { d.fonts.ready.then(once); setTimeout(once, 1200); } else once();
  } else {
    curt.forEach(function (el) { el.classList.add('is-curtain'); el.classList.add('is-in'); });
  }

  // цифры досчитываются
  var counters = $$('[data-count]');
  if (counters.length && 'IntersectionObserver' in window && !reduce) {
    counters.forEach(function (el) { el.textContent = '0'; });
    var cio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        cio.unobserve(e.target);
        var el = e.target, to = +el.getAttribute('data-count'), t0 = null, dur = 1400;
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
    ['name', 'way', 'msg'].forEach(function (n) { f.elements[n].addEventListener('input', function () { this.classList.remove('is-bad'); }); });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if (agree && !agree.checked) return;
      var ok = $('.tna-form__ok', f), bad = null;
      ['name', 'way', 'msg'].forEach(function (n) {
        var el = f.elements[n];
        if (!el.value.trim()) { el.classList.add('is-bad'); bad = bad || el; } else { el.classList.remove('is-bad'); }
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
