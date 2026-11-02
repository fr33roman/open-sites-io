/* Tamarjoba · вариант Б · общий скрипт: меню, сцена глав, игра в буквы, форма, карта */
(function () {
  'use strict';
  var D = document, W = window;
  function $(s, r) { return (r || D).querySelector(s); }
  function $$(s, r) { return [].slice.call((r || D).querySelectorAll(s)); }
  var calm = W.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  /* ---------- меню на телефоне ---------- */
  var burger = $('.tqb-burger'), menu = $('.tqb-menu'), scrim = $('.tqb-scrim');
  function setMenu(open) {
    if (!burger) return;
    burger.setAttribute('aria-expanded', String(open));
    menu.classList.toggle('is-open', open);
    scrim.classList.toggle('is-open', open);
  }
  if (burger) {
    burger.addEventListener('click', function () { setMenu(burger.getAttribute('aria-expanded') !== 'true'); });
    scrim.addEventListener('click', function () { setMenu(false); });
    $$('a', menu).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
    D.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
  }

  /* ---------- сцена глав (только главная) ---------- */
  var story = $('.tqb-story');
  var pinned = false, cur = -1, N = 0, panels = [], navs = [];
  if (story) {
    panels = $$('.tqb-panel', story); N = panels.length;
    navs = $$('.tqb-rail li a', story);
    var mq = W.matchMedia('(min-width: 900px) and (min-height: 620px)');
    var big = $('.tqb-rail .big', story), nm = $('.tqb-rail .name', story), art = $('.tqb-art', story);
    var rp = 0, ptr = { x: 0, y: 0 };
    var setCh = function (i) {
      if (i === cur) return;
      var old = cur; cur = i;
      panels.forEach(function (p, k) {
        p.classList.toggle('is-on', k === i);
        if (k === old && old >= 0) { p.classList.add('is-prev'); setTimeout(function () { p.classList.remove('is-prev'); }, 950); }
        else if (k !== old) p.classList.remove('is-prev');
      });
      navs.forEach(function (a, k) { a.classList.toggle('is-on', k === i); });
      if (big) big.textContent = '0' + (i + 1);
      if (nm) nm.textContent = navs[i] ? navs[i].getAttribute('data-name') : '';
    };
    var upd = function () {
      rp = 0;
      if (!pinned) return;
      var r = story.getBoundingClientRect(), total = story.offsetHeight - W.innerHeight;
      var p = clamp(-r.top / total, 0, 0.9999);
      var i = Math.min(N - 1, Math.floor(p * N));
      story.style.setProperty('--sp', p.toFixed(3));
      if (art) art.style.setProperty('--lp', (i === 0 ? p * N : 1).toFixed(3));
      setCh(i);
    };
    var go = function () { if (!rp) rp = requestAnimationFrame(upd); };
    var layout = function () {
      pinned = mq.matches && story.classList.contains('tqb-pin');
      if (pinned) { go(); upd(); }
      else {
        cur = -1; panels.forEach(function (p) { p.classList.remove('is-on', 'is-prev'); });
        stackedPar();
      }
    };
    story.classList.add('tqb-pin');
    W.addEventListener('scroll', function () { go(); stackedPar(); }, { passive: true });
    W.addEventListener('resize', layout);
    if (mq.addEventListener) mq.addEventListener('change', layout);
    var goCh = function (i) {
      if (!pinned) { var t = panels[i]; if (t) t.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' }); return; }
      var total = story.offsetHeight - W.innerHeight;
      W.scrollTo({ top: story.getBoundingClientRect().top + W.scrollY + ((i + 0.5) / N) * total, behavior: calm ? 'auto' : 'smooth' });
    };
    navs.forEach(function (a, k) { a.addEventListener('click', function (e) { e.preventDefault(); goCh(k); }); });
    $$('[data-go]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); goCh(+a.getAttribute('data-go')); }); });
    $$('a[href="#book"]').forEach(function (a) { a.addEventListener('click', function (e) { if (pinned) { e.preventDefault(); goCh(4); } }); });
    /* курсор двигает слои иллюстрации */
    if (art && !calm) {
      var host = art.closest('.tqb-panel') || art, pr = 0;
      host.addEventListener('pointermove', function (e) {
        var b = art.getBoundingClientRect();
        ptr.x = clamp((e.clientX - b.left) / b.width - 0.5, -0.6, 0.6) * 2;
        ptr.y = clamp((e.clientY - b.top) / b.height - 0.5, -0.6, 0.6) * 2;
        if (!pr) pr = requestAnimationFrame(function () { pr = 0; art.style.setProperty('--px', ptr.x.toFixed(2)); art.style.setProperty('--py', ptr.y.toFixed(2)); });
      }, { passive: true });
    }
    var stackedPar = function () {
      if (pinned || !art || calm) return;
      var b = art.getBoundingClientRect();
      if (b.bottom < 0 || b.top > W.innerHeight) return;
      art.style.setProperty('--lp', clamp((W.innerHeight - b.top) / (W.innerHeight + b.height), 0, 1).toFixed(3));
    };
    layout();
  }

  /* ---------- игра: соберите слово ---------- */
  var play = $('.tqb-play');
  if (play) {
    var WORDS = [
      { w: 'გამარჯობა', tr: 'гамарджоба', ru: 'здравствуйте' },
      { w: 'დედა', tr: 'деда', ru: 'мама' },
      { w: 'ენა', tr: 'эна', ru: 'язык' },
      { w: 'მზე', tr: 'мзе', ru: 'солнце' },
      { w: 'სახლი', tr: 'сахли', ru: 'дом' }
    ];
    var POOL = 'ბგდევზთიკლნოპრსტუფქღყშჩცძწჭხჯჰ'.split('');
    var slotsEl = $('.tqb-slots', play), fieldEl = $('.tqb-field', play), sayEl = $('.tqb-say', play), dotsEl = $('.tqb-dots', play), doneEl = $('.tqb-done', play);
    var round = 0, pos = 0, letters = [], busy = false;
    var shuffle = function (a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
    var dots = WORDS.map(function () { var i = D.createElement('i'); dotsEl.appendChild(i); return i; });
    var start = function () {
      var it = WORDS[round]; letters = it.w.split(''); pos = 0; busy = false;
      slotsEl.textContent = ''; fieldEl.textContent = ''; sayEl.textContent = '';
      sayEl.hidden = false; doneEl.hidden = true; slotsEl.hidden = false; fieldEl.hidden = false;
      letters.forEach(function () { var s = D.createElement('span'); s.className = 'tqb-slot ka'; slotsEl.appendChild(s); });
      slotsEl.children[0].classList.add('is-next');
      var decoys = shuffle(POOL.filter(function (c) { return letters.indexOf(c) < 0; })).slice(0, 2);
      shuffle(letters.concat(decoys)).forEach(function (c) {
        var b = D.createElement('button'); b.type = 'button'; b.className = 'tqb-tile'; b.textContent = c; b.setAttribute('data-c', c);
        b.setAttribute('aria-label', 'Буква ' + c);
        b.style.setProperty('--dx', Math.round(Math.random() * 20 - 10) + 'px');
        b.style.setProperty('--dy', Math.round(Math.random() * 18 - 9) + 'px');
        b.style.setProperty('--r', Math.round(Math.random() * 24 - 12) + 'deg');
        b.style.setProperty('--b', (-Math.random() * 3.6).toFixed(2) + 's');
        fieldEl.appendChild(b);
      });
    };
    var finish = function () {
      var it = WORDS[round]; dots[round].classList.add('is-on');
      sayEl.innerHTML = '';
      var s = D.createElement('strong'); s.className = 'ka'; s.textContent = it.w;
      var t = D.createElement('span'); t.textContent = it.tr + ' · ' + it.ru;
      sayEl.appendChild(s); sayEl.appendChild(t);
      var nx = D.createElement('button'); nx.type = 'button'; nx.className = 'tqb-cta';
      nx.textContent = round < WORDS.length - 1 ? 'Следующее слово' : 'Готово';
      nx.addEventListener('click', function () {
        if (round < WORDS.length - 1) { round++; start(); } else end();
      });
      sayEl.appendChild(nx); nx.focus({ preventScroll: true });
    };
    var end = function () {
      slotsEl.hidden = true; fieldEl.hidden = true; sayEl.hidden = true; doneEl.hidden = false;
    };
    var again = $('[data-again]', play);
    if (again) again.addEventListener('click', function () { round = 0; dots.forEach(function (d) { d.classList.remove('is-on'); }); start(); });
    var bad = function (tile) {
      tile.classList.add('is-bad');
      var a = Math.random() * Math.PI * 2, d = 46;
      if (tile.animate && !calm) tile.animate([{ translate: '0 0' }, { translate: Math.cos(a) * d + 'px ' + Math.sin(a) * d + 'px', offset: .35 }, { translate: '0 0' }], { duration: 520, easing: 'cubic-bezier(.34,1.56,.64,1)' });
      setTimeout(function () { tile.classList.remove('is-bad'); }, 420);
    };
    fieldEl.addEventListener('click', function (e) {
      var tile = e.target.closest('.tqb-tile');
      if (!tile || busy || tile.classList.contains('is-used')) return;
      if (tile.getAttribute('data-c') !== letters[pos]) { bad(tile); return; }
      var slot = slotsEl.children[pos], at = pos; pos++; tile.classList.add('is-used');
      var done = pos === letters.length; if (done) busy = true;
      var fill = function () {
        slot.textContent = letters[at]; slot.classList.remove('is-next'); slot.classList.add('is-set');
        if (!done) slotsEl.children[pos].classList.add('is-next'); else finish();
      };
      if (calm || !tile.animate) { fill(); return; }
      var pr = play.getBoundingClientRect(), tr = tile.getBoundingClientRect(), sr = slot.getBoundingClientRect();
      var f = D.createElement('div'); f.className = 'tqb-fly'; f.textContent = letters[at];
      f.style.cssText = 'left:' + (tr.left - pr.left) + 'px;top:' + (tr.top - pr.top) + 'px;width:' + tr.width + 'px;height:' + tr.height + 'px';
      play.appendChild(f);
      var k = sr.width / tr.width;
      f.animate([{ transform: 'none' }, { transform: 'translate(' + (sr.left - tr.left + (sr.width - tr.width) / 2) + 'px,' + (sr.top - tr.top + (sr.height - tr.height) / 2) + 'px) scale(' + k + ')' }], { duration: 420, easing: 'cubic-bezier(.16,1,.3,1)' })
        .onfinish = function () { f.remove(); fill(); };
    });
    start();
  }

  /* ---------- карта: вкладки городов ---------- */
  var tabs = $$('.tqb-tabs button'), frame = $('.tqb-map iframe'), go2 = $('.tqb-map__go a'), adr = $('.tqb-adr');
  tabs.forEach(function (b) {
    b.addEventListener('click', function () {
      var q = b.getAttribute('data-q');
      tabs.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      frame.src = 'https://www.google.com/maps?q=' + encodeURIComponent(q) + '&z=16&output=embed';
      go2.href = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(q);
      if (adr) adr.textContent = b.getAttribute('data-adr');
    });
  });

  /* ---------- форма ---------- */
  var form = $('#form');
  if (form) {
    var sel = $('#f-kurs'), ok = $('#f-ok'), send = $('#f-send'), done = $('#done'), nameEl = $('#f-name');
    var key = form.getAttribute('data-kurs') || (new URLSearchParams(W.location.search).get('kurs')) || 'probe';
    $$('option', sel).forEach(function (o) { if (o.getAttribute('data-k') === key) sel.value = o.value; });
    ok.addEventListener('change', function () { send.disabled = !ok.checked; });
    $$('input,select', form).forEach(function (el) { el.addEventListener('input', function () { el.removeAttribute('aria-invalid'); }); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var bad = null;
      $$('[required]', form).forEach(function (el) {
        var no = el.value.trim().length < 2; el.setAttribute('aria-invalid', no ? 'true' : 'false');
        if (no && !bad) bad = el;
      });
      if (bad) { bad.focus(); return; }
      var ch = $('input[name=chan]:checked', form).value;
      var text = 'Здравствуйте! Пишу с сайта Tamarjoba.\nНаправление: ' + sel.value + '\nИмя: ' + nameEl.value.trim() + '\nКонтакт: ' + $('#f-tel').value.trim() + '\nУдобно в ' + ch;
      $('#done-text').textContent = text;
      $('#done-wa').href = 'https://wa.me/995551160580?text=' + encodeURIComponent(text);
      var tg = $('#done-tg');
      tg.onclick = function () { if (navigator.clipboard) navigator.clipboard.writeText(text).catch(function () {}); };
      form.hidden = true; done.hidden = false; done.focus();
    });
    $('#done-back').addEventListener('click', function () { done.hidden = true; form.hidden = false; nameEl.focus(); });
  }

  /* ---------- появление блоков на страницах услуг ---------- */
  var rev = $$('.reveal');
  if (rev.length) {
    if ('IntersectionObserver' in W && !calm) {
      var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: .05 });
      rev.forEach(function (el) { io.observe(el); });
      setTimeout(function () { rev.forEach(function (el) { if (el.getBoundingClientRect().top < W.innerHeight) el.classList.add('in'); }); }, 1500);
    } else rev.forEach(function (el) { el.classList.add('in'); });
  }
})();
