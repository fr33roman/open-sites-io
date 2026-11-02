/* ==========================================================================
   SLY FOX SCHOOL — ИНТЕРАКТИВНЫЕ МЕХАНИКИ И ФИЗИКА CANVAS (2026)
   ========================================================================== */
(function () {
  'use strict';

  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reducedMotion && !navigator.webdriver) {
    var autoVids = document.querySelectorAll('video[data-autoplay="1"]');
    for (var av = 0; av < autoVids.length; av++) {
      autoVids[av].play().catch(function () {});
    }
  }

  /* 1. ПРОЖЕКТОР И 3D-НАКЛОН КЛУБНЫХ КАРТ */
  var spots = document.querySelectorAll('.sfc-spot');
  var tilts = document.querySelectorAll('.sfc-tilt');

  if (!reducedMotion) {
    document.addEventListener('pointermove', function (e) {
      for (var i = 0; i < spots.length; i++) {
        var el = spots[i];
        var r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) continue;
        el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        el.style.setProperty('--my', (e.clientY - r.top) + 'px');
      }
    }, { passive: true });

    for (var t = 0; t < tilts.length; t++) {
      (function (card) {
        card.addEventListener('pointermove', function (e) {
          var r = card.getBoundingClientRect();
          var px = (e.clientX - r.left) / r.width - 0.5;
          var py = (e.clientY - r.top) / r.height - 0.5;
          card.style.transform = 'perspective(900px) rotateX(' + (-py * 7).toFixed(2) + 'deg) rotateY(' + (px * 9).toFixed(2) + 'deg) translateY(-3px)';
        });
        card.addEventListener('pointerleave', function () {
          card.style.transform = '';
        });
      })(tilts[t]);
    }
  }

  /* 2. ИНТЕРАКТИВНЫЙ CANVAS ГЕРОЯ */
  var canvas = document.getElementById('sf-hero-canvas');
  if (canvas && canvas.getContext && !reducedMotion) {
    var ctx = canvas.getContext('2d');
    var particles = [];
    var waves = [];
    var angle = 0;
    var ptr = { x: 0.5, y: 0.5 };

    for (var p = 0; p < 28; p++) {
      particles.push({
        a: (Math.PI * 2 * p) / 28,
        r: 90 + (p % 5) * 26,
        sp: 0.003 + (p % 4) * 0.0015,
        sz: 1.5 + (p % 3) * 1.1
      });
    }

    canvas.parentElement.addEventListener('pointermove', function (e) {
      var r = canvas.getBoundingClientRect();
      ptr.x = (e.clientX - r.left) / Math.max(1, r.width);
      ptr.y = (e.clientY - r.top) / Math.max(1, r.height);
    }, { passive: true });

    canvas.parentElement.addEventListener('pointerdown', function (e) {
      var r = canvas.getBoundingClientRect();
      waves.push({
        x: e.clientX - r.left,
        y: e.clientY - r.top,
        rad: 12,
        alpha: 0.75
      });
    });

    function drawCanvas() {
      var w = canvas.width;
      var h = canvas.height;
      var cx = w * 0.5 + (ptr.x - 0.5) * 18;
      var cy = h * 0.5 + (ptr.y - 0.5) * 18;

      ctx.clearRect(0, 0, w, h);
      angle += 0.0045;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      for (var i = 0; i < 60; i++) {
        var a = (Math.PI * 2 * i) / 60;
        var r1 = i % 5 === 0 ? 156 : 164;
        var r2 = 172;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
        ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
        ctx.strokeStyle = i % 5 === 0 ? 'rgba(232, 114, 26, 0.55)' : 'rgba(239, 233, 223, 0.14)';
        ctx.lineWidth = i % 5 === 0 ? 2 : 1;
        ctx.stroke();
      }
      ctx.restore();

      for (var j = 0; j < particles.length; j++) {
        var pt = particles[j];
        pt.a += pt.sp;
        var px = cx + Math.cos(pt.a) * pt.r;
        var py = cy + Math.sin(pt.a) * pt.r;
        ctx.beginPath();
        ctx.arc(px, py, pt.sz, 0, Math.PI * 2);
        ctx.fillStyle = j % 2 === 0 ? 'rgba(255, 179, 122, 0.65)' : 'rgba(232, 114, 26, 0.42)';
        ctx.fill();
      }

      for (var k = waves.length - 1; k >= 0; k--) {
        var wv = waves[k];
        wv.rad += 4.2;
        wv.alpha *= 0.94;
        ctx.beginPath();
        ctx.arc(wv.x, wv.y, wv.rad, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(232, 114, 26, ' + wv.alpha.toFixed(3) + ')';
        ctx.lineWidth = 2;
        ctx.stroke();
        if (wv.alpha < 0.04) waves.splice(k, 1);
      }

      requestAnimationFrame(drawCanvas);
    }
    requestAnimationFrame(drawCanvas);
  }

  /* 3. ПРЕСЕТ Б: ПЕРЕКЛЮЧАТЕЛЬ ВИДЕО */
  var stageVideo = document.getElementById('sf-stage-video');
  var stageBtns = document.querySelectorAll('.sfc-stage-btn');
  for (var sb = 0; sb < stageBtns.length; sb++) {
    stageBtns[sb].addEventListener('click', function () {
      for (var k = 0; k < stageBtns.length; k++) stageBtns[k].classList.remove('is-active');
      this.classList.add('is-active');
      if (stageVideo) {
        stageVideo.src = this.getAttribute('data-video');
        stageVideo.poster = this.getAttribute('data-poster') || '';
        stageVideo.play().catch(function () {});
      }
    });
  }

  /* 4. ПРЕСЕТ В: ПУЛЬТ И ПРОПУСК УЧЕНИКА */
  var passState = { group: 'ОФП', pack: 'Пробная' };
  var prices = {
    'ОФП': { 'Пробная': '0 ₾', '8 занятий': '170 ₾', '12 занятий': '240 ₾', days: 'Пн, Ср, Пт 18:00 / 19:00 · Вт, Чт 11:00', title: 'Группа ОФП · 60 минут' },
    'Продвинутая': { 'Пробная': '0 ₾', '8 занятий': '240 ₾', '12 занятий': '330 ₾', days: 'Пн, Ср, Пт · 16:30 (90 минут)', title: 'Продвинутая · 90 минут' },
    'Персональная': { 'Пробная': '1 на 1', '8 занятий': '1 на 1', '12 занятий': '1 на 1', days: 'Индивидуальный график с тренером', title: 'Персональная · 60 минут' }
  };

  function updatePass() {
    var grpEl = document.getElementById('sf-pass-grp');
    var prEl = document.getElementById('sf-pass-price');
    var daysEl = document.getElementById('sf-pass-days');
    if (!grpEl || !prEl || !daysEl) return;
    var info = prices[passState.group] || prices['ОФП'];
    grpEl.textContent = info.title;
    prEl.textContent = info[passState.pack] || '0 ₾';
    daysEl.textContent = info.days;
  }

  var segBtns = document.querySelectorAll('.sfc-seg__btn');
  for (var sg = 0; sg < segBtns.length; sg++) {
    segBtns[sg].addEventListener('click', function () {
      var parent = this.parentElement;
      var sibs = parent.querySelectorAll('.sfc-seg__btn');
      for (var i = 0; i < sibs.length; i++) sibs[i].classList.remove('is-active');
      this.classList.add('is-active');
      if (this.hasAttribute('data-rec')) passState.group = this.getAttribute('data-rec');
      if (this.hasAttribute('data-pack')) passState.pack = this.getAttribute('data-pack');
      updatePass();
    });
  }

  var applyBtn = document.getElementById('sf-pass-apply');
  if (applyBtn) {
    applyBtn.addEventListener('click', function () {
      selectGroupAndScroll(passState.group, 'Понедельник');
    });
  }

  /* 5. ПЯТЬ ЭТАПОВ ТРЕНИРОВКИ */
  var stepCards = document.querySelectorAll('.sfc-step-card');
  var trackFill = document.getElementById('sf-track-fill');
  for (var sc = 0; sc < stepCards.length; sc++) {
    stepCards[sc].addEventListener('click', function () {
      for (var i = 0; i < stepCards.length; i++) stepCards[i].classList.remove('is-active');
      this.classList.add('is-active');
      var step = parseInt(this.getAttribute('data-step') || '5', 10);
      if (trackFill) {
        trackFill.style.strokeDashoffset = String(1000 - step * 200);
      }
    });
  }

  /* 6. ВИДЕО-РИЛСЫ В ГАЛЕРЕЕ */
  var reelBtns = document.querySelectorAll('.sfc-reel-play');
  for (var rb = 0; rb < reelBtns.length; rb++) {
    reelBtns[rb].addEventListener('click', function () {
      var card = this.closest('.sfc-reel-card');
      var vid = card ? card.querySelector('video') : null;
      if (!vid) return;
      if (vid.paused) {
        vid.play();
        this.textContent = '❚❚';
      } else {
        vid.pause();
        this.textContent = '▶';
      }
    });
  }

  /* 7. ЛАЙТБОКС */
  var lightbox = document.getElementById('sf-lightbox');
  var lightboxImg = document.getElementById('sf-lightbox-img');
  var lightboxClose = document.getElementById('sf-lightbox-close');
  var photoTriggers = document.querySelectorAll('[data-full]');

  for (var pt = 0; pt < photoTriggers.length; pt++) {
    photoTriggers[pt].addEventListener('click', function () {
      if (!lightbox || !lightboxImg) return;
      lightboxImg.src = this.getAttribute('data-full');
      lightboxImg.alt = this.getAttribute('data-alt') || '';
      lightbox.hidden = false;
    });
  }

  if (lightboxClose && lightbox) {
    lightboxClose.addEventListener('click', function () {
      lightbox.hidden = true;
    });
    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox) lightbox.hidden = true;
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !lightbox.hidden) lightbox.hidden = true;
    });
  }

  /* 8. РАСПИСАНИЕ */
  var dayTabs = document.querySelectorAll('.sfc-day-tab');
  var slotCards = document.querySelectorAll('.sfc-slot-card');

  for (var dt = 0; dt < dayTabs.length; dt++) {
    dayTabs[dt].addEventListener('click', function () {
      var day = this.getAttribute('data-day');
      for (var i = 0; i < dayTabs.length; i++) {
        dayTabs[i].classList.remove('is-active');
        dayTabs[i].setAttribute('aria-selected', 'false');
      }
      this.classList.add('is-active');
      this.setAttribute('aria-selected', 'true');

      for (var j = 0; j < slotCards.length; j++) {
        var card = slotCards[j];
        var days = (card.getAttribute('data-days') || '').split(',');
        var show = day === 'all' || days.indexOf(day) !== -1;
        card.hidden = !show;
        if (day !== 'all' && show) {
          card.setAttribute('data-pick-day', day);
        }
      }
    });
  }

  function selectGroupAndScroll(groupName, dayName) {
    var grpSelect = document.getElementById('sf-inp-group');
    var daySelect = document.getElementById('sf-inp-day');
    var formSec = document.getElementById('zapis');
    var nameInp = document.getElementById('sf-inp-name');
    if (grpSelect && groupName) grpSelect.value = groupName;
    if (daySelect && dayName) daySelect.value = dayName;
    if (formSec) formSec.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
    if (nameInp) setTimeout(function () { nameInp.focus(); }, 450);
  }

  for (var sl = 0; sl < slotCards.length; sl++) {
    slotCards[sl].addEventListener('click', function () {
      selectGroupAndScroll(this.getAttribute('data-group'), this.getAttribute('data-pick-day'));
    });
  }

  var priceBtns = document.querySelectorAll('[data-select-group]');
  for (var pb = 0; pb < priceBtns.length; pb++) {
    priceBtns[pb].addEventListener('click', function () {
      selectGroupAndScroll(this.getAttribute('data-select-group'), 'Понедельник');
    });
  }

  /* 9. ФОРМА ЗАПИСИ */
  var consentChk = document.getElementById('sf-consent-chk');
  var submitBtn = document.getElementById('sf-submit-btn');
  var form = document.getElementById('sf-form');

  if (consentChk && submitBtn) {
    consentChk.addEventListener('change', function () {
      submitBtn.disabled = !consentChk.checked;
    });
  }

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = (document.getElementById('sf-inp-name') || {}).value || '';
      var age = (document.getElementById('sf-inp-age') || {}).value || '';
      var group = (document.getElementById('sf-inp-group') || {}).value || 'ОФП';
      var day = (document.getElementById('sf-inp-day') || {}).value || 'Понедельник';
      var msg = 'Здравствуйте, Вадим! Хочу записаться в Sly Fox School.\n' +
                'Имя: ' + name + '\n' +
                (age ? 'Возраст: ' + age + '\n' : '') +
                'Группа: ' + group + '\n' +
                'День: ' + day;
      var url = 'https://t.me/koba19910?text=' + encodeURIComponent(msg);
      window.open(url, '_blank', 'noopener');
    });
  }

  /* 10. ЯЗЫКИ (RU / EN / KA) */
  var dict = {
    en: {
      nav_coach: 'Coach',
      nav_workout: 'Workout',
      nav_hall: 'Gym & Sea',
      nav_sched: 'Schedule',
      nav_prices: 'Prices',
      nav_book: 'Book trial',
      cta_main: 'Book free trial · 0 ₾',
      cta_prices: 'View passes',
      cta_sched: 'Pick a day',
      h2_sched: 'Schedule',
      h2_prices: 'Prices',
      h2_book: 'Book a session',
      f_name: 'Your name',
      f_age: 'Student age',
      f_group: 'Group',
      f_day: 'Preferred day',
      f_consent: 'I agree to personal data processing',
      f_submit: 'Send booking via Telegram'
    },
    ka: {
      nav_coach: 'მწვრთნელი',
      nav_workout: 'ვარჯიში',
      nav_hall: 'დარბაზი',
      nav_sched: 'განრიგი',
      nav_prices: 'ფასები',
      nav_book: 'ჩაწერა',
      cta_main: 'უფასო საცდელი ვარჯიში · 0 ₾',
      cta_prices: 'აბონემენტები',
      cta_sched: 'აირჩიეთ დღე',
      h2_sched: 'განრიგი',
      h2_prices: 'ფასები',
      h2_book: 'ვარჯიშზე ჩაწერა',
      f_name: 'თქვენი სახელი',
      f_age: 'მოსწავლის ასაკი',
      f_group: 'ჯგუფი',
      f_day: 'სასურველი დღე',
      f_consent: 'ვეთანხმები პერსონალური მონაცემების დამუშავებას',
      f_submit: 'განაცხადის გაგზავნა Telegram-ში'
    }
  };

  var langBtns = document.querySelectorAll('.sfc-lang__btn');
  var savedRu = {};
  var i18nNodes = document.querySelectorAll('[data-i18n]');
  for (var n = 0; n < i18nNodes.length; n++) {
    var key = i18nNodes[n].getAttribute('data-i18n');
    savedRu[key] = i18nNodes[n].textContent;
  }

  for (var lb = 0; lb < langBtns.length; lb++) {
    langBtns[lb].addEventListener('click', function () {
      var lang = this.getAttribute('data-lang');
      for (var i = 0; i < langBtns.length; i++) langBtns[i].classList.remove('is-active');
      this.classList.add('is-active');
      document.documentElement.lang = lang;

      for (var j = 0; j < i18nNodes.length; j++) {
        var k = i18nNodes[j].getAttribute('data-i18n');
        if (lang === 'ru' && savedRu[k]) {
          i18nNodes[j].textContent = savedRu[k];
        } else if (dict[lang] && dict[lang][k]) {
          i18nNodes[j].textContent = dict[lang][k];
        }
      }
    });
  }
})();
