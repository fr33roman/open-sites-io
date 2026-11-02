/* ==========================================================================
   TAMARJOBA — ПРЕСЕТ В (tamarjoba-9c) · script.js
   1. Пульт подбора курса за 3 клика + Выдвижная шторка программы
   2. Быстрые переходы и фильтрация глав
   3. Игра-квест из 3 раундов сборки грузинских слов + Web Audio API
   4. Живое время Тбилиси/Батуми (T8) + 3D-наклон карточек
   ========================================================================== */
(function () {
  'use strict';

  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── 1. Матрица курсов для пульта 3 кликов (точные цены в лари и рублях) ── */
  var COURSES = {
    'a1:group': {
      title: 'Онлайн-группа A1',
      price: '280 лари',
      rub: '8 уроков · 8 500 руб · 40 уроков — 1 200 лари (40 500 руб)',
      pack: '4–6 человек · 2 раза в неделю по 60 мин',
      page: 'program-groups.html',
      selectVal: 'Онлайн-группа (от 280 лари)',
      bullets: [
        'A1 · 40 часов (5 месяцев), 40 уроков',
        'В программе: алфавит, настоящее время, счёт',
        'Офлайн-группы работают в Тбилиси и Батуми, цену подскажет школа'
      ]
    },
    'a1:indiv': {
      title: 'Индивидуальные уроки',
      price: '560 лари',
      rub: '8 уроков по 60 мин · 16 800 руб',
      pack: 'Онлайн и офлайн · пробный урок 20 минут бесплатно',
      page: 'program-groups.html',
      selectVal: 'Индивидуальные уроки (560 лари / 8 уроков)',
      bullets: [
        'Занятия один на один, онлайн и офлайн',
        'Преподаватели говорят по-грузински и по-русски',
        'Пакет из 16 уроков — 1 урок в подарок, из 24 — 2 урока'
      ]
    },
    'a1:self': {
      title: 'Видеокурс «Gamarjoba Start: Первые шаги»',
      price: '160 лари',
      rub: 'модуль · 60 $ · 3 980 руб',
      pack: 'С нуля до A1 · уроки по 15 минут на платформе Gurucan',
      page: 'program-groups.html',
      selectVal: 'Видеокурс Gurucan (модуль 160 лари)',
      bullets: [
        'Можно купить отдельный модуль',
        'Оплата любой картой',
        'Цены в лари, долларах и рублях'
      ]
    },
    'cit:group': {
      title: 'Онлайн-встреча «Кава с Tamarjoba»',
      price: '0 лари',
      rub: 'бесплатно · для тех, кто готовится к экзамену',
      pack: 'Школа готовит к экзамену на гражданство более 6 лет',
      page: 'program-citizenship.html',
      selectVal: 'Онлайн-встреча «Кава с Tamarjoba» (бесплатно)',
      bullets: [
        'Бесплатная онлайн-встреча',
        'Знакомство с подготовкой к экзамену',
        'Тест уровня — на tamarjoba.site/test'
      ]
    },
    'cit:indiv': {
      title: 'Индивидуальные уроки',
      price: '560 лари',
      rub: '8 уроков по 60 мин · 16 800 руб',
      pack: 'Онлайн и офлайн · пробный урок 20 минут бесплатно',
      page: 'program-citizenship.html',
      selectVal: 'Индивидуальные уроки (560 лари / 8 уроков)',
      bullets: [
        'Напишите школе о цели — экзамен на гражданство',
        'Преподаватели говорят по-грузински и по-русски',
        'Пакет из 16 уроков — 1 урок в подарок, из 24 — 2 урока'
      ]
    },
    'cit:self': {
      title: 'Печатные тесты и онлайн-тренажёр',
      price: 'по запросу',
      rub: 'цену подскажет школа',
      pack: 'Тесты с переводами · тренажёр в режиме экзамена',
      page: 'program-citizenship.html',
      selectVal: 'Печатные тесты и тренажёр (экзамен)',
      bullets: [
        'Печатные экзаменационные тесты с переводами',
        'Онлайн-тренажёр в режиме экзамена',
        'Цену подскажет школа'
      ]
    },
    'kids:group': {
      title: 'Детское пособие на 16 уроков',
      price: '50 лари',
      rub: 'печатная версия',
      pack: 'Все 33 буквы · прописи · аудио по кодам',
      page: 'program-kids.html',
      selectVal: 'Детское пособие (50 лари)',
      bullets: [
        '16 уроков и все 33 буквы грузинского алфавита',
        'Прописи для каждой буквы',
        'Аудио открывается по кодам',
        'Детские группы — уточните у школы'
      ]
    },
    'kids:indiv': {
      title: 'Индивидуальные уроки',
      price: '560 лари',
      rub: '8 уроков по 60 мин · 16 800 руб',
      pack: 'Онлайн и офлайн · формат для ребёнка подскажет школа',
      page: 'program-kids.html',
      selectVal: 'Индивидуальные уроки (560 лари / 8 уроков)',
      bullets: [
        'Занятия один на один',
        'Пробный урок 20 минут бесплатно',
        'Возраст ребёнка обсудите со школой'
      ]
    },
    'kids:self': {
      title: 'Детское пособие на 16 уроков',
      price: '50 лари',
      rub: 'печатная версия',
      pack: 'Все 33 буквы · прописи · аудио по кодам',
      page: 'program-kids.html',
      selectVal: 'Детское пособие (50 лари)',
      bullets: [
        '16 уроков и все 33 буквы грузинского алфавита',
        'Прописи для каждой буквы',
        'Аудио открывается по кодам'
      ]
    },
    'vid:group': {
      title: 'Видеокурс «Gamarjoba Plus: Говорю и понимаю»',
      price: '160 лари',
      rub: 'модуль · 60 $ · 3 980 руб',
      pack: 'A1–B2 · уроки по 15 минут на платформе Gurucan',
      page: 'program-groups.html',
      selectVal: 'Видеокурс Gurucan (модуль 160 лари)',
      bullets: [
        'Можно купить отдельный модуль',
        'Оплата любой картой',
        'Цены в лари, долларах и рублях'
      ]
    },
    'vid:indiv': {
      title: 'Видеокурс «Алфавит»',
      price: 'скидка −50%',
      rub: 'уроки по 15 минут',
      pack: 'Все буквы грузинского алфавита · платформа Gurucan',
      page: 'program-groups.html',
      selectVal: 'Видеокурс «Алфавит» (скидка −50%)',
      bullets: [
        'Курс с Тамарой Кавтарадзе',
        'Можно купить отдельный модуль',
        'Оплата любой картой'
      ]
    },
    'vid:self': {
      title: 'Видеокурс «Gamarjoba Start: Первые шаги»',
      price: '160 лари',
      rub: 'модуль · 60 $ · 3 980 руб',
      pack: 'С нуля до A1 · уроки по 15 минут на платформе Gurucan',
      page: 'program-groups.html',
      selectVal: 'Видеокурс Gurucan (модуль 160 лари)',
      bullets: [
        'Можно купить отдельный модуль',
        'Оплата любой картой',
        'Цены в лари, долларах и рублях'
      ]
    }
  };

  var currentGoal = 'a1';
  var currentFmt = 'group';

  var goalBtns = document.querySelectorAll('[data-goal]');
  var fmtBtns = document.querySelectorAll('[data-fmt]');
  var outCourse = document.getElementById('tjc-out-course');
  var outPack = document.getElementById('tjc-out-pack');
  var outPrice = document.getElementById('tjc-out-price');
  var outRub = document.getElementById('tjc-out-rub');
  var formPreset = document.getElementById('tjc-form-preset');
  var courseSelect = document.getElementById('tjc-course-select');
  var drawer = document.getElementById('tjc-drawer');
  var drawerTitle = document.getElementById('tjc-drawer-title');
  var drawerPrice = document.getElementById('tjc-drawer-price');
  var drawerPack = document.getElementById('tjc-drawer-pack');
  var drawerList = document.getElementById('tjc-drawer-list');
  var drawerPageLink = document.getElementById('tjc-drawer-page');

  function getActiveData() {
    var key = currentGoal + ':' + currentFmt;
    return COURSES[key] || COURSES['a1:group'];
  }

  function renderConsole() {
    var d = getActiveData();
    if (outCourse) outCourse.textContent = d.title;
    if (outPack) outPack.textContent = d.pack;
    if (outPrice) outPrice.textContent = d.price;
    if (outRub) outRub.textContent = d.rub;

    if (drawerTitle) drawerTitle.textContent = d.title;
    if (drawerPrice) drawerPrice.textContent = d.price + ' · ' + d.rub;
    if (drawerPack) drawerPack.textContent = d.pack;
    if (drawerPageLink) drawerPageLink.setAttribute('href', d.page);
    if (drawerList) {
      drawerList.innerHTML = '';
      for (var i = 0; i < d.bullets.length; i++) {
        var li = document.createElement('li');
        li.textContent = d.bullets[i];
        drawerList.appendChild(li);
      }
    }
  }

  function syncFormWithCalc() {
    var d = getActiveData();
    if (formPreset) {
      formPreset.textContent = 'Расчёт из пульта · ' + d.title + ' · ' + d.price;
    }
    if (courseSelect) {
      var found = false;
      for (var i = 0; i < courseSelect.options.length; i++) {
        if (courseSelect.options[i].value === d.selectVal) {
          courseSelect.selectedIndex = i;
          found = true;
          break;
        }
      }
      if (!found) {
        var opt = document.createElement('option');
        opt.value = d.selectVal;
        opt.textContent = d.selectVal;
        courseSelect.appendChild(opt);
        courseSelect.value = d.selectVal;
      }
    }
  }

  for (var g = 0; g < goalBtns.length; g++) {
    (function (btn) {
      btn.addEventListener('click', function () {
        currentGoal = btn.getAttribute('data-goal');
        for (var k = 0; k < goalBtns.length; k++) {
          goalBtns[k].classList.toggle('tjc-opt--active', goalBtns[k] === btn);
          goalBtns[k].setAttribute('aria-pressed', goalBtns[k] === btn ? 'true' : 'false');
        }
        renderConsole();
        syncFormWithCalc();
      });
    })(goalBtns[g]);
  }

  for (var f = 0; f < fmtBtns.length; f++) {
    (function (btn) {
      btn.addEventListener('click', function () {
        currentFmt = btn.getAttribute('data-fmt');
        for (var k = 0; k < fmtBtns.length; k++) {
          fmtBtns[k].classList.toggle('tjc-opt--active', fmtBtns[k] === btn);
          fmtBtns[k].setAttribute('aria-pressed', fmtBtns[k] === btn ? 'true' : 'false');
        }
        renderConsole();
        syncFormWithCalc();
      });
    })(fmtBtns[f]);
  }

  var openDrawerBtn = document.getElementById('tjc-open-drawer');
  var closeDrawerBtn = document.getElementById('tjc-close-drawer');
  var drawerEnrollBtn = document.getElementById('tjc-drawer-enroll');
  var applyCalcBtn = document.getElementById('tjc-apply-calc');

  if (openDrawerBtn && drawer) {
    openDrawerBtn.addEventListener('click', function () {
      renderConsole();
      drawer.removeAttribute('hidden');
    });
  }

  if (closeDrawerBtn && drawer) {
    closeDrawerBtn.addEventListener('click', function () {
      drawer.setAttribute('hidden', '');
    });
  }

  if (drawer) {
    drawer.addEventListener('click', function (e) {
      if (e.target === drawer) drawer.setAttribute('hidden', '');
    });
  }

  function scrollToEnroll() {
    syncFormWithCalc();
    showAllChapters();
    var enrollSec = document.getElementById('enroll');
    if (enrollSec) enrollSec.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
  }

  if (applyCalcBtn) {
    applyCalcBtn.addEventListener('click', scrollToEnroll);
  }

  if (drawerEnrollBtn && drawer) {
    drawerEnrollBtn.addEventListener('click', function () {
      drawer.setAttribute('hidden', '');
      scrollToEnroll();
    });
  }

  /* Кнопки выбора тарифа из карточек секции #programs */
  var cardSelectBtns = document.querySelectorAll('[data-pick-goal]');
  for (var cs = 0; cs < cardSelectBtns.length; cs++) {
    (function (btn) {
      btn.addEventListener('click', function () {
        var gVal = btn.getAttribute('data-pick-goal') || 'a1';
        var fVal = btn.getAttribute('data-pick-fmt') || 'group';
        currentGoal = gVal;
        currentFmt = fVal;
        for (var i = 0; i < goalBtns.length; i++) {
          goalBtns[i].classList.toggle('tjc-opt--active', goalBtns[i].getAttribute('data-goal') === gVal);
        }
        for (var j = 0; j < fmtBtns.length; j++) {
          fmtBtns[j].classList.toggle('tjc-opt--active', fmtBtns[j].getAttribute('data-fmt') === fVal);
        }
        renderConsole();
        scrollToEnroll();
      });
    })(cardSelectBtns[cs]);
  }

  /* Кнопки в шапке */
  var hdrCalcBtn = document.getElementById('tjc-hdr-calc');
  var hdrGameBtn = document.getElementById('tjc-hdr-game');
  if (hdrCalcBtn) {
    hdrCalcBtn.addEventListener('click', function () {
      showAllChapters();
      var el = document.getElementById('calc');
      if (el) el.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
    });
  }
  if (hdrGameBtn) {
    hdrGameBtn.addEventListener('click', function () {
      showAllChapters();
      var el = document.getElementById('alphabet');
      if (el) el.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
    });
  }

  /* ── 2. Панель быстрых переходов и фильтрации глав ── */
  var chapterTabs = document.querySelectorAll('[data-chapter]');
  var pageSections = document.querySelectorAll('.tjc-sec[id]');

  function showAllChapters() {
    for (var i = 0; i < pageSections.length; i++) {
      pageSections[i].classList.remove('tjc-sec--hidden');
    }
    for (var j = 0; j < chapterTabs.length; j++) {
      chapterTabs[j].classList.toggle('tjc-tab--active', chapterTabs[j].getAttribute('data-chapter') === 'all');
    }
  }

  for (var ct = 0; ct < chapterTabs.length; ct++) {
    (function (tab) {
      tab.addEventListener('click', function () {
        var target = tab.getAttribute('data-chapter');
        for (var j = 0; j < chapterTabs.length; j++) {
          chapterTabs[j].classList.toggle('tjc-tab--active', chapterTabs[j] === tab);
        }
        if (target === 'all') {
          showAllChapters();
          return;
        }
        for (var i = 0; i < pageSections.length; i++) {
          var isMatch = pageSections[i].id === target || pageSections[i].id === 'enroll';
          pageSections[i].classList.toggle('tjc-sec--hidden', !isMatch);
        }
        var activeSec = document.getElementById(target);
        if (activeSec) activeSec.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
      });
    })(chapterTabs[ct]);
  }

  /* ── 3. Живая игра-квест с грузинскими буквами (3 раунда + Web Audio API) ── */
  var ROUNDS = [
    {
      id: 0,
      word: 'გამარჯობა',
      meaning: 'Раунд 1 · გამარჯობა · здравствуйте (ключевые буквы из колоды)',
      seq: ['გ', 'ა', 'მ', 'ბ', 'ა']
    },
    {
      id: 1,
      word: 'მადლობა',
      meaning: 'Раунд 2 · მადლობა · спасибо (ключевые буквы из колоды)',
      seq: ['მ', 'ა', 'დ', 'ბ', 'ა']
    },
    {
      id: 2,
      word: 'თბილისი',
      meaning: 'Раунд 3 · თბილისი · Тбилиси (ключевые буквы из колоды)',
      seq: ['თ', 'ბ', 'ს']
    }
  ];

  var curRound = 0;
  var curStep = 0;
  var wordsSolved = 0;
  var audioCtx = null;

  var roundBtns = document.querySelectorAll('[data-round]');
  var letterCards = document.querySelectorAll('.tjc-letter[data-char]');
  var wordEl = document.getElementById('tjc-quest-word');
  var meaningEl = document.getElementById('tjc-quest-meaning');
  var slotsEl = document.getElementById('tjc-quest-slots');
  var scoreEl = document.getElementById('tjc-quest-score');
  var resetBtn = document.getElementById('tjc-quest-reset');
  var giftBanner = document.getElementById('tjc-gift-banner');

  function playTone(freq, dur) {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!audioCtx) audioCtx = new AC();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq || 440, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + (dur || 0.22));
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + (dur || 0.22));
    } catch (e) {}
  }

  function speakGeo(text) {
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        var u = new SpeechSynthesisUtterance(text);
        u.lang = 'ka-GE';
        u.rate = 0.92;
        window.speechSynthesis.speak(u);
      }
    } catch (e) {}
  }

  function renderQuest() {
    var r = ROUNDS[curRound];
    if (!r) return;
    if (wordEl) wordEl.textContent = r.word;
    if (meaningEl) meaningEl.textContent = r.meaning;

    for (var rb = 0; rb < roundBtns.length; rb++) {
      var isAct = parseInt(roundBtns[rb].getAttribute('data-round'), 10) === curRound;
      roundBtns[rb].classList.toggle('tjc-round-btn--active', isAct);
    }

    var nextChar = r.seq[curStep] || null;

    if (slotsEl) {
      slotsEl.innerHTML = '';
      for (var i = 0; i < r.seq.length; i++) {
        var sp = document.createElement('span');
        sp.className = 'tjc-slot';
        if (i < curStep) {
          sp.className += ' tjc-slot--done';
          sp.textContent = r.seq[i];
        } else if (i === curStep) {
          sp.className += ' tjc-slot--next';
          sp.textContent = r.seq[i];
        } else {
          sp.textContent = '·';
        }
        slotsEl.appendChild(sp);
      }
    }

    for (var lc = 0; lc < letterCards.length; lc++) {
      var ch = letterCards[lc].getAttribute('data-char');
      letterCards[lc].classList.toggle('tjc-letter--target', ch === nextChar);
    }

    if (scoreEl) {
      scoreEl.textContent = 'Собрано слов · ' + wordsSolved + ' из 3';
    }
  }

  function activateGift() {
    if (giftBanner) {
      giftBanner.textContent = 'Слово собрано · бесплатный пробный урок 20 минут';
      giftBanner.removeAttribute('hidden');
    }
  }

  for (var l = 0; l < letterCards.length; l++) {
    (function (card) {
      card.addEventListener('click', function () {
        var ch = card.getAttribute('data-char');
        var ex = card.getAttribute('data-word') || ch;
        var freq = parseInt(card.getAttribute('data-freq') || '440', 10);
        playTone(freq, 0.24);
        speakGeo(ex);

        var r = ROUNDS[curRound];
        if (r && r.seq[curStep] === ch) {
          curStep++;
          if (curStep >= r.seq.length) {
            wordsSolved = Math.min(3, Math.max(wordsSolved, curRound + 1));
            playTone(660, 0.35);
            activateGift();
            setTimeout(function () {
              curRound = (curRound + 1) % ROUNDS.length;
              curStep = 0;
              renderQuest();
            }, 650);
          }
          renderQuest();
        }
      });

      if (!reducedMotion) {
        card.addEventListener('pointermove', function (e) {
          var rect = card.getBoundingClientRect();
          var px = (e.clientX - rect.left) / Math.max(1, rect.width) - 0.5;
          var py = (e.clientY - rect.top) / Math.max(1, rect.height) - 0.5;
          card.style.transform = 'perspective(700px) rotateX(' + (-py * 8).toFixed(1) + 'deg) rotateY(' + (px * 8).toFixed(1) + 'deg) translateY(-3px)';
        });
        card.addEventListener('pointerleave', function () {
          card.style.transform = '';
        });
      }
    })(letterCards[l]);
  }

  for (var rbi = 0; rbi < roundBtns.length; rbi++) {
    (function (btn) {
      btn.addEventListener('click', function () {
        curRound = parseInt(btn.getAttribute('data-round'), 10) || 0;
        curStep = 0;
        renderQuest();
      });
    })(roundBtns[rbi]);
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      curStep = 0;
      renderQuest();
    });
  }

  /* ── 4. Табло реального времени Тбилиси / Батуми (UTC+4, Архетип T8) ── */
  var clockEl = document.getElementById('tjc-live-clock');
  function updateClock() {
    if (!clockEl) return;
    var now = new Date();
    var utc = now.getTime() + now.getTimezoneOffset() * 60000;
    var geo = new Date(utc + 4 * 3600000);
    var hh = String(geo.getHours()).padStart(2, '0');
    var mm = String(geo.getMinutes()).padStart(2, '0');
    var open = geo.getHours() >= 10 && geo.getHours() < 21;
    clockEl.textContent = 'Тбилиси и Батуми · сейчас ' + hh + '.' + mm;
  }
  updateClock();

  /* ── 5. Форма записи и согласие ── */
  var consentCheck = document.getElementById('tjc-consent');
  var submitBtn = document.getElementById('tjc-submit');
  var enrollForm = document.getElementById('tjc-form');
  var formOk = document.getElementById('tjc-form-ok');

  if (consentCheck && submitBtn) {
    consentCheck.addEventListener('change', function () {
      submitBtn.disabled = !consentCheck.checked;
    });
  }

  if (enrollForm) {
    enrollForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (formOk) {
        formOk.removeAttribute('hidden');
      }
    });
  }

  /* IntersectionObserver + requestAnimationFrame для живого отклика секций */
  var heroArt = document.querySelector('.tjc-hero__svg');
  var heroVisible = true;
  if ('IntersectionObserver' in window && heroArt) {
    var io = new IntersectionObserver(function (entries) {
      heroVisible = entries[0] ? entries[0].isIntersecting : true;
    });
    io.observe(heroArt);
  }

  var phase = 0;
  function animateFrame() {
    if (heroVisible && !reducedMotion) {
      phase += 0.02;
    }
    requestAnimationFrame(animateFrame);
  }
  if (!reducedMotion) {
    requestAnimationFrame(animateFrame);
  }

  renderConsole();
  renderQuest();
})();
