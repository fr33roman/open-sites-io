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
      title: 'Интенсив в мини-группе A1–A2+',
      price: '280 лари',
      rub: 'за месяц · около 9 500 руб · 690 лари за весь курс (3 мес)',
      pack: '4–7 человек · 2 раза в неделю по 90 мин · учебник и рабочая тетрадь включены',
      page: 'program-groups.html',
      selectVal: 'Интенсив в мини-группе (280 лари / мес)',
      bullets: [
        'Недели 1–2 · Алфавит Анбани, чтение вывесок и меню в Тбилиси и Батуми без транскрипции',
        'Недели 3–6 · Живые диалоги в кафе, банке, клинике, на рынке и с арендодателем',
        'Недели 7–12 · Времена глаголов, тосты, свободная беседа с носителями и практика в чате'
      ]
    },
    'a1:indiv': {
      title: 'Персональный курс с билингвом A1–B2',
      price: '640 лари',
      rub: 'абонемент 8 уроков · около 21 700 руб · 1 урок = 80 лари',
      pack: '1 на 1 в классе или Zoom · личный график · разбор ваших рабочих и бытовых тем',
      page: 'program-groups.html',
      selectVal: 'Индивидуально с билингвом (640 лари / 8 уроков)',
      bullets: [
        'Гибкое расписание утром, днём или вечером с переносом занятия за 12 часов',
        'Персональный словарь под вашу профессию, бизнес или переезд в Грузию',
        'Голосовая проверка домашних заданий преподавателем-билингвом между уроками'
      ]
    },
    'a1:self': {
      title: 'Книги Тамары + приложение Gurucan',
      price: '50 лари',
      rub: 'самоучитель и прописи · около 1 700 руб · доставка Ozon / WB / Тбилиси',
      pack: 'Печатный бестселлер Тамары Кавтарадзе + аудиодорожки носителей и тренажёр слов',
      page: 'program-groups.html',
      selectVal: 'Самостоятельно · Книги и Gurucan (50 лари)',
      bullets: [
        'Авторский самоучитель с понятными таблицами без перегруженной академической теории',
        'Каллиграфические прописи мхедрули с правильным направлением каждого штриха',
        'Доступ к аудиозаписям диалогов и карточкам запоминания в мобильном приложении'
      ]
    },
    'cit:group': {
      title: 'Подготовка к экзамену на гражданство (группа)',
      price: '690 лари',
      rub: 'полный курс 3 месяца · около 23 400 руб · 280 лари в месяц',
      pack: 'Разбор всех 600 билетов Минюста · язык, история и право Грузии + пробное интервью',
      page: 'program-citizenship.html',
      selectVal: 'Экзамен на гражданство · курс (690 лари)',
      bullets: [
        'Отработка 200 вопросов по грузинскому языку, 200 по истории и 200 по основам права',
        'Тренировка письменного эссе и устного собеседования с комиссией в Доме юстиции',
        'Еженедельные симуляции тестирования на время с разбором ловушек в формулировках'
      ]
    },
    'cit:indiv': {
      title: 'Экспресс-подготовка к гражданству 1 на 1',
      price: '650 лари',
      rub: 'интенсивный блок · около 22 100 руб · личный куратор-эксперт',
      pack: 'Ускоренный разбор билетов Минюста под дату вашего экзамена · симуляция комиссии',
      page: 'program-citizenship.html',
      selectVal: 'Экзамен на гражданство · индивидуально (650 лари)',
      bullets: [
        'Диагностика текущего уровня и составление плана ровно до дня вашей подачи в Минюст',
        'Постановка уверенной устной речи для ответа на вопросы комиссии о биографии и мотивации',
        'Полный комплект шпаргалок по датам царей, конституции и ключевым историческим событиям'
      ]
    },
    'cit:self': {
      title: 'Тренажёр билетов Минюста + видеокурс',
      price: '90 лари',
      rub: 'доступ на 30 дней · около 3 100 руб · тесты + видеоразборы',
      pack: 'Онлайн-база тестов гражданства с переводом, озвучкой и короткими уроками по 15 мин',
      page: 'program-citizenship.html',
      selectVal: 'Тренажёр гражданства + видеокурс (90 лари)',
      bullets: [
        'Интерактивные карточки всех официальных вопросов с объяснением правильных ответов',
        'Короткие видеоуроки по 15 минут для повторения грамматики и лексики в дороге',
        'Режим контрольного экзамена с таймером и подсчётом проходного балла'
      ]
    },
    'kids:group': {
      title: 'Детский курс «33 буквы Анбани» в группе',
      price: '280 лари',
      rub: 'в месяц · около 9 500 руб · игровые уроки для детей 6–13 лет',
      pack: 'Иллюстрированные прописи, настольные игры со словами, песни и чтение сказок вслух',
      page: 'program-kids.html',
      selectVal: 'Детский курс 33 буквы Анбани (280 лари)',
      bullets: [
        'Каждая буква изучается через образ, рисунок, весёлую скороговорку и наклейку в альбоме',
        'Чтение первых грузинских слов и коротких комиксов уже на третьем занятии',
        'Доброжелательная среда, которая помогает ребёнку легко общаться со сверстниками в школе'
      ]
    },
    'kids:indiv': {
      title: 'Детские уроки с билингвом 1 на 1',
      price: '640 лари',
      rub: 'абонемент 8 уроков · около 21 700 руб · помощь со школьной программой',
      pack: 'Бережные занятия по 45–60 минут · постановка чтения, письма и устной речи для школы',
      page: 'program-kids.html',
      selectVal: 'Детские уроки 1 на 1 (640 лари / 8 уроков)',
      bullets: [
        'Помощь с домашними заданиями грузинской школы и снятие языкового барьера у ребёнка',
        'Игровая подача грамматики через мультфильмы, загадки и диалоги по ролям',
        'Регулярная обратная связь для родителей о прогрессе и новых выученных словах'
      ]
    },
    'kids:self': {
      title: 'Детский комплект прописей и карточек Анбани',
      price: '50 лари',
      rub: 'печатный набор · около 1 700 руб · 33 карточки + раскраска-пропись',
      pack: 'Плотные карточки с грузинскими буквами, словами-ассоциациями и озвучкой по QR-коду',
      page: 'program-kids.html',
      selectVal: 'Детский набор прописей Анбани (50 лари)',
      bullets: [
        '33 красочные карточки с грузинскими буквами, зверями и предметами на каждый звук',
        'Крупная разлиновка для детской руки с пунктирными подсказками направления письма',
        'QR-коды с живым произношением каждой буквы и слова голосом Тамары Кавтарадзе'
      ]
    },
    'vid:group': {
      title: 'Видеокурс с Тамарой + разговорный клуб',
      price: '90 лари',
      rub: 'в месяц · около 3 100 руб · уроки по 15 мин + живые созвоны',
      pack: 'Ежедневные видеоуроки в приложении Gurucan + еженедельная практика в мини-группе',
      page: 'program-groups.html',
      selectVal: 'Видеокурс с Тамарой по 15 мин (90 лари)',
      bullets: [
        'Короткие 15-минутные видеоуроки Тамары Кавтарадзе, которые легко смотреть за утренним кофе',
        'Интерактивные упражнения на телефоне сразу после каждого ролика для закрепления фраз',
        'Живая разговорная встреча раз в неделю для отработки произношения и бытовых сцен'
      ]
    },
    'vid:indiv': {
      title: 'Видеокурс + индивидуальные разборы с педагогом',
      price: '280 лари',
      rub: 'комбо-тариф на месяц · около 9 500 руб · видеоуроки + 4 личных созвона',
      pack: 'Теория в удобном темпе по 15 минут в день + личная разговорная практика каждую неделю',
      page: 'program-groups.html',
      selectVal: 'Видеокурс + 4 урока с педагогом (280 лари)',
      bullets: [
        'Экономия времени на теории — правила и лексику вы смотрите в коротких роликах Тамары',
        'Весь созвон с преподавателем посвящён только живой разговорной речи и ответам на вопросы',
        'Доступ ко всем материалам, прописям и словарям в личном кабинете приложения Gurucan'
      ]
    },
    'vid:self': {
      title: 'Автономный видеокурс Тамары по 15 минут',
      price: '90 лари',
      rub: 'полный доступ на месяц · около 3 100 руб · приложение Gurucan',
      pack: '30 estrutурированных видеоуроков от алфавита до уверенных диалогов в городе',
      page: 'program-groups.html',
      selectVal: 'Видеокурс с Тамарой по 15 мин (90 лари)',
      bullets: [
        'Занимайтесь в любом часовом поясе по 15 минут в день со смартфона или ноутбука',
        'Встроенный тренажёр карточек, аудиодиктанты и PDF-конспекты к каждому модулю',
        'Сертификат школы Tamarjoba после прохождения итогового интерактивного теста'
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
      giftBanner.textContent = 'Бонус за собранное слово активирован · прописи Анбани + 20 мин пробный урок бесплатно';
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
    clockEl.textContent = 'Тбилиси и Батуми ' + hh + '.' + mm + (open ? ' · филиалы открыты' : ' · приём онлайн-заявок');
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
