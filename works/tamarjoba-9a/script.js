/* ==========================================================================
   TAMARJOBA — ПРЕСЕТ А · ИНТЕРАКТИВНЫЙ ДВИЖОК (script.js)
   1. Живая озвучка приветствия გამარჯობა + Web Audio API для карточек букв
   2. 3D-переворот 8 грузинских букв и мини-игра сборки слова გამარჯობა
   3. Открывающиеся карточки-досье (drawer/modal) для 6 курсов и 8 педагогов
      с переносом выбранного направления в форму записи в 1 клик!
   4. Автокарусель 3 реальных отзывов с паузой при наведении
   5. Живой прожектор (--mx, --my) на карточках .tja-spot
   ========================================================================== */
(function () {
  'use strict';

  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* --------------------------------------------------------------------------
     1. МЯГКИЙ СИНТЕЗАТОР WEB AUDIO API ДЛЯ ПЕРЕВОРОТА БУКВ И ИГРЫ
     -------------------------------------------------------------------------- */
  var audioCtx = null;
  function playTone(freq, duration, type) {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtx) audioCtx = new Ctx();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq || 440, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + (duration || 0.22));
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + (duration || 0.22));
    } catch (e) {}
  }

  /* --------------------------------------------------------------------------
     1б. РОЛИК ПЕРВОГО ЭКРАНА НА ТЕЛЕФОНЕ (вместо картинки; на компьютере не грузится)
         Играет только пока виден — вне экрана стоит, чтобы не греть телефон
     -------------------------------------------------------------------------- */
  var heroVideo = document.querySelector('.tja-arch-frame__video');
  var phoneMq = window.matchMedia('(max-width: 720px)');
  if (heroVideo && phoneMq.matches) {
    document.documentElement.classList.add('tja-has-video');
    if (!reducedMotion) {
      heroVideo.src = heroVideo.getAttribute('data-src');
      heroVideo.preload = 'auto';
      var tryPlay = function () { var pr = heroVideo.play(); if (pr && pr.catch) pr.catch(function () {}); };
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (en) {
          if (en[0].isIntersecting) tryPlay(); else heroVideo.pause();
        }, { threshold: 0.2 }).observe(heroVideo);
      } else tryPlay();
      document.addEventListener('visibilitychange', function () { if (document.hidden) heroVideo.pause(); });
    }
  }

  /* --------------------------------------------------------------------------
     2. КНОПКА ПРИВЕТСТВИЯ გამარჯობა НА ПЕРВОМ ЭКРАНЕ
     -------------------------------------------------------------------------- */
  var helloBtn = document.getElementById('tja-hello-btn');
  var helloTr = document.getElementById('tja-hello-tr');
  var greetings = [
    { geo: 'გამარჯობა', tr: 'Гамарджоба · Здравствуйте!', freq: 523.25, audio: 'audio/gamarjoba.mp3' },
    { geo: 'როგორ ხარ?', tr: 'Рогор хар · Как дела?', freq: 587.33, audio: 'audio/rogor-khar.mp3' },
    { geo: 'მადლობა', tr: 'Мадлоба · Спасибо!', freq: 659.25, audio: 'audio/madloba.mp3' },
    { geo: 'საქართველო', tr: 'Сакартвело · Грузия!', freq: 698.46, audio: 'audio/sakartvelo.mp3' }
  ];
  // озвучка — временный голос Microsoft (ka-GE-EkaNeural, 04.11); потом заменить записью голоса Тамары с теми же именами файлов
  var greetIdx = 0, greetHeard = false, greetSound = null;
  function sayGreeting(item) {
    try {
      if (greetSound) greetSound.pause();
      greetSound = new Audio(item.audio);
      var p = greetSound.play();
      if (p && p.catch) p.catch(function () { playTone(item.freq, 0.26, 'triangle'); });
    } catch (err) { playTone(item.freq, 0.26, 'triangle'); }
  }

  if (helloBtn && helloTr) {
    helloBtn.addEventListener('click', function () {
      // первое нажатие озвучивает то, что уже написано; дальше — следующая фраза
      if (greetHeard) greetIdx = (greetIdx + 1) % greetings.length;
      greetHeard = true;
      var item = greetings[greetIdx];
      var geoSpan = helloBtn.querySelector('.tja-hello-btn__geo');
      if (geoSpan) geoSpan.textContent = item.geo;
      helloTr.textContent = item.tr;
      sayGreeting(item);
    });
  }

  /* --------------------------------------------------------------------------
     3. ПЕРЕВОРАЧИВАЮЩИЕСЯ 3D-КАРТОЧКИ 8 БУКВ ГРУЗИНСКОГО АЛФАВИТА
     -------------------------------------------------------------------------- */
  var letterCards = document.querySelectorAll('.tja-letter-card');
  var notes = [440, 493.88, 523.25, 587.33, 659.25, 698.46, 783.99, 880];

  for (var i = 0; i < letterCards.length; i++) {
    (function (card, idx) {
      card.addEventListener('click', function () {
        for (var k = 0; k < letterCards.length; k++) {
          letterCards[k].classList.remove('is-pulse');
        }
        var flipped = card.classList.toggle('is-flipped');
        card.setAttribute('aria-pressed', flipped ? 'true' : 'false');
        card.classList.add('is-said');
        playTone(notes[idx % notes.length], 0.22, 'sine');
      });
    })(letterCards[i], i);
  }

  // весь алфавит: карточка раз в 6 секунд показывает следующие 8 букв (слово Романа 04.11)
  var ALPHABET = [
    { g: 'ა', s: 'а', w: 'ატამი', m: 'персик', r: 'атами' },
    { g: 'ბ', s: 'б', w: 'ბავშვი', m: 'ребёнок', r: 'бавшви' },
    { g: 'გ', s: 'г', w: 'გემრიელი', m: 'вкусный', r: 'гемриели' },
    { g: 'დ', s: 'д', w: 'დედა', m: 'мама', r: 'деда' },
    { g: 'ე', s: 'э', w: 'ენა', m: 'язык', r: 'эна' },
    { g: 'ვ', s: 'в', w: 'ვაშლი', m: 'яблоко', r: 'вашли' },
    { g: 'ზ', s: 'з', w: 'ზღვა', m: 'море', r: 'згва' },
    { g: 'თ', s: 'т', w: 'თევზი', m: 'рыба', r: 'тевзи' },
    { g: 'ი', s: 'и', w: 'ია', m: 'фиалка', r: 'иа' },
    { g: 'კ', s: 'к (резкое)', w: 'კატა', m: 'кошка', r: 'ката' },
    { g: 'ლ', s: 'л', w: 'ლომი', m: 'лев', r: 'ломи' },
    { g: 'მ', s: 'м', w: 'მზე', m: 'солнце', r: 'мзе' },
    { g: 'ნ', s: 'н', w: 'ნავი', m: 'лодка', r: 'нави' },
    { g: 'ო', s: 'о', w: 'ოთახი', m: 'комната', r: 'отахи' },
    { g: 'პ', s: 'п (резкое)', w: 'პური', m: 'хлеб', r: 'пури' },
    { g: 'ჟ', s: 'ж', w: 'ჟირაფი', m: 'жираф', r: 'жирапи' },
    { g: 'რ', s: 'р', w: 'რძე', m: 'молоко', r: 'рдзе' },
    { g: 'ს', s: 'с', w: 'სახლი', m: 'дом', r: 'сахли' },
    { g: 'ტ', s: 'т (резкое)', w: 'ტყე', m: 'лес', r: 'тке' },
    { g: 'უ', s: 'у', w: 'უჯრა', m: 'ящик', r: 'уджра' },
    { g: 'ფ', s: 'п', w: 'ფული', m: 'деньги', r: 'пули' },
    { g: 'ქ', s: 'к', w: 'ქალაქი', m: 'город', r: 'калаки' },
    { g: 'ღ', s: 'гх', w: 'ღვინო', m: 'вино', r: 'гвино' },
    { g: 'ყ', s: 'к (гортанное)', w: 'ყავა', m: 'кофе', r: 'кава' },
    { g: 'შ', s: 'ш', w: 'შაქარი', m: 'сахар', r: 'шакари' },
    { g: 'ჩ', s: 'ч', w: 'ჩაი', m: 'чай', r: 'чаи' },
    { g: 'ც', s: 'ц', w: 'ცა', m: 'небо', r: 'ца' },
    { g: 'ძ', s: 'дз', w: 'ძაღლი', m: 'собака', r: 'дзагли' },
    { g: 'წ', s: 'ц (резкое)', w: 'წყალი', m: 'вода', r: 'цкали' },
    { g: 'ჭ', s: 'ч (резкое)', w: 'ჭიქა', m: 'стакан', r: 'чика' },
    { g: 'ხ', s: 'х', w: 'ხე', m: 'дерево', r: 'хе' },
    { g: 'ჯ', s: 'дж', w: 'ჯიბე', m: 'карман', r: 'джибе' },
    { g: 'ჰ', s: 'х (лёгкое)', w: 'ჰაერი', m: 'воздух', r: 'хаэри' }
  ];
  var alphaPage = 0;
  var alphaBadge = document.querySelector('.tja-alpha-deck__top .tja-badge');
  var alphaGridEl = document.querySelector('.tja-alpha-grid');
  var alphaHold = false;
  function fillCard(card, L) {
    card.querySelector('.tja-letter-card__glyph').textContent = L.g;
    card.querySelector('.tja-letter-card__sound').textContent = 'звук «' + L.s.split(' ')[0] + '»' + (L.s.indexOf(' ') > 0 ? ' ' + L.s.split(' ').slice(1).join(' ') : '');
    card.querySelector('.tja-letter-card__word').textContent = L.w;
    card.querySelector('.tja-letter-card__read').textContent = L.m + ' (' + L.r + ')';
    card.setAttribute('aria-label', 'Буква ' + L.g + ', звук ' + L.s + ', слово ' + L.r + ' — ' + L.m);
  }
  function nextAlphaPage() {
    if (alphaHold || document.hidden || !alphaGridEl) return;
    alphaPage = (alphaPage + 1) % Math.ceil(ALPHABET.length / letterCards.length);
    alphaGridEl.classList.add('is-turning');
    setTimeout(function () {
      var start = alphaPage * letterCards.length;
      for (var c = 0; c < letterCards.length; c++) {
        var L = ALPHABET[(start + c) % ALPHABET.length];
        letterCards[c].classList.remove('is-flipped', 'is-pulse');
        letterCards[c].setAttribute('aria-pressed', 'false');
        fillCard(letterCards[c], L);
      }
      if (alphaBadge) {
        var from = start + 1, to = Math.min(start + letterCards.length, ALPHABET.length);
        alphaBadge.textContent = 'буквы ' + from + '–' + to + ' из 33';
      }
      alphaGridEl.classList.remove('is-turning');
    }, 420);
  }
  if (alphaGridEl && !reducedMotion) {
    alphaGridEl.addEventListener('pointerenter', function () { alphaHold = true; });
    alphaGridEl.addEventListener('pointerleave', function () { alphaHold = false; });
    alphaGridEl.addEventListener('focusin', function () { alphaHold = true; });
    alphaGridEl.addEventListener('focusout', function () { alphaHold = false; });
    setInterval(nextAlphaPage, 6000);
  }

  // подписи «звук «а»» не стоят сразу: появляются по одной, когда алфавит въезжает на экран
  var alphaDeck = document.querySelector('.tja-alpha-deck');
  function sayInTurn() {
    for (var q = 0; q < letterCards.length; q++) {
      (function (card, k) { setTimeout(function () { card.classList.add('is-said'); }, 350 + k * 420); })(letterCards[q], q);
    }
  }
  if (alphaDeck && 'IntersectionObserver' in window && !reducedMotion) {
    var alphaIo = new IntersectionObserver(function (en) {
      if (en[0].isIntersecting) { alphaIo.disconnect(); sayInTurn(); }
    }, { threshold: 0.45 });
    alphaIo.observe(alphaDeck);
  } else {
    for (var q2 = 0; q2 < letterCards.length; q2++) letterCards[q2].classList.add('is-said');
  }

  /* --------------------------------------------------------------------------
     4. МИНИ-ИГРА: СОБЕРИТЕ СЛОВО გამარჯობა ИЗ 9 БУКВ
     -------------------------------------------------------------------------- */
  var TARGET_WORD = ['გ', 'ა', 'მ', 'ა', 'რ', 'ჯ', 'ო', 'ბ', 'ა'];
  var SHUFFLED_INDICES = [2, 0, 5, 1, 7, 4, 8, 3, 6]; // მ, გ, ჯ, ა, ბ, რ, ა, ა, ო
  var slotsWrap = document.getElementById('tja-word-slots');
  var trayWrap = document.getElementById('tja-word-tray');
  var resetBtn = document.getElementById('tja-word-reset');
  var winBox = document.getElementById('tja-word-win');
  var winClaimBtn = document.getElementById('tja-word-claim');
  var currentStep = 0;

  function renderWordGame() {
    if (!slotsWrap || !trayWrap) return;
    currentStep = 0;
    if (winBox) winBox.hidden = true;
    slotsWrap.innerHTML = '';
    trayWrap.innerHTML = '';

    for (var s = 0; s < TARGET_WORD.length; s++) {
      var slot = document.createElement('span');
      slot.className = 'tja-slot';
      slot.setAttribute('data-slot', String(s));
      slot.textContent = '·';
      slotsWrap.appendChild(slot);
    }

    for (var c = 0; c < SHUFFLED_INDICES.length; c++) {
      var letter = TARGET_WORD[SHUFFLED_INDICES[c]];
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'tja-chip';
      chip.textContent = letter;
      chip.setAttribute('data-letter', letter);
      chip.setAttribute('aria-label', 'Буква ' + letter);
      chip.addEventListener('click', onChipClick);
      trayWrap.appendChild(chip);
    }
    highlightNextChip();
  }

  function highlightNextChip() {
    if (!trayWrap) return;
    var needed = TARGET_WORD[currentStep];
    var chips = trayWrap.querySelectorAll('.tja-chip');
    var highlighted = false;
    for (var i = 0; i < chips.length; i++) {
      chips[i].classList.remove('is-next');
      if (!highlighted && !chips[i].classList.contains('is-used') && chips[i].getAttribute('data-letter') === needed) {
        chips[i].classList.add('is-next');
        highlighted = true;
      }
    }
  }

  function onChipClick(e) {
    var btn = e.currentTarget;
    if (btn.classList.contains('is-used') || currentStep >= TARGET_WORD.length) return;
    var letter = btn.getAttribute('data-letter');
    var needed = TARGET_WORD[currentStep];

    if (letter === needed) {
      btn.classList.add('is-used');
      btn.classList.remove('is-next');
      var slot = slotsWrap.querySelector('[data-slot="' + currentStep + '"]');
      if (slot) {
        slot.textContent = letter;
        slot.classList.add('is-filled');
      }
      playTone(480 + currentStep * 45, 0.18, 'triangle');
      currentStep++;
      if (currentStep >= TARGET_WORD.length) {
        if (winBox) winBox.hidden = false;
        playTone(784, 0.35, 'sine');
      } else {
        highlightNextChip();
      }
    } else {
      btn.classList.remove('is-wrong');
      void btn.offsetWidth;
      btn.classList.add('is-wrong');
      playTone(220, 0.2, 'sawtooth');
    }
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', renderWordGame);
  }

  if (winClaimBtn) {
    winClaimBtn.addEventListener('click', function () {
      selectCourseAndScroll('Индивидуальные уроки');
    });
  }

  renderWordGame();

  /* --------------------------------------------------------------------------
     5. БАЗА ДАННЫХ ДОСЬЕ 6 НАПРАВЛЕНИЙ И 8 ПРЕПОДАВАТЕЛЕЙ (БЕЗ ПЕРЕЗАГРУЗКИ)
     -------------------------------------------------------------------------- */
  var COURSE_DOSSIERS = {
    'offline': {
      badge: 'ТБИЛИСИ · БАТУМИ · ОФЛАЙН',
      title: 'Очные группы: Тбилиси, Батуми',
      lead: 'Живые занятия в Тбилиси (Сабуртало, ул. Медеи Чахава, 9) и Батуми (ул. Зураба Горгиладзе, 95). Небольшие группы, 2 раза в неделю по 60 минут.',
      selectVal: 'Очные группы: Тбилиси, Батуми',
      tiers: [
        { name: 'Занятия', val: '2 раза в неделю · 60 мин' },
        { name: 'Города', val: 'Тбилиси и Батуми' },
        { name: 'Стоимость офлайн-групп', val: 'подскажет школа' }
      ],
      bullets: [
        'Грузинский с нуля до продвинутого уровня.',
        'Тест уровня — на отдельной странице школы.'
      ]
    },
    'online': {
      badge: 'ОНЛАЙН · ГРУППЫ ДО 6 ЧЕЛОВЕК',
      title: 'Онлайн-группы',
      lead: 'Онлайн-группы от 4 до 6 человек, занятия по 60 минут 2 раза в неделю.',
      selectVal: 'Онлайн-группы',
      tiers: [
        { name: 'A1 · 40 часов (5 месяцев) · 40 уроков', val: '1 200 лари' },
        { name: 'A1 · 8 уроков', val: '280 лари' },
        { name: 'A2 · 32 часа (4 месяца) · 32 урока', val: '960 лари' },
        { name: 'A2+ · 40 часов · 40 уроков', val: '1 200 лари' },
        { name: 'Разговорная практика в A1 · 4 часа', val: 'бесплатно' }
      ],
      bullets: [
        'В A2 3 часа разговорной практики бесплатно.',
        'Программа A1 разбита по темам: алфавит, настоящее время, счёт.'
      ]
    },
    'indiv': {
      badge: '1 НА 1 · ОНЛАЙН И ОФЛАЙН',
      title: 'Индивидуальные уроки',
      lead: 'Занятия один на один, онлайн и офлайн. Преподаватели говорят по-грузински и по-русски. Сначала — бесплатный пробный урок 20 минут.',
      selectVal: 'Индивидуальные уроки',
      tiers: [
        { name: 'Знакомство · 20 минут', val: 'бесплатно' },
        { name: 'Пакет из 8 уроков по часу', val: '560 лари' },
        { name: '16 уроков', val: '1 в подарок' },
        { name: '24 урока', val: '2 в подарок' }
      ],
      bullets: [
        'Онлайн или в Тбилиси и Батуми.',
        'Цена в рублях: 16 800 ₽ за 8 уроков.'
      ]
    },
    'citizen': {
      badge: 'ЭКЗАМЕН НА ГРАЖДАНСТВО · БОЛЕЕ 6 ЛЕТ',
      title: 'Экзамен на гражданство Грузии',
      lead: 'К экзамену на гражданство Грузии школа готовит более 6 лет.',
      selectVal: 'Экзамен на гражданство Грузии',
      tiers: [
        { name: 'Онлайн-встреча «Кава с Tamarjoba»', val: 'бесплатно' },
        { name: 'Печатные экзаменационные тесты', val: 'с переводами' },
        { name: 'Онлайн-тренажёр', val: 'режим экзамена' }
      ],
      bullets: [
        'Бесплатная онлайн-встреча для знакомства с подготовкой.',
        'Стоимость подготовки подскажет школа.'
      ]
    },
    'video': {
      badge: 'ПЛАТФОРМА GURUCAN · УРОКИ ПО 15 МИН',
      title: 'Видеокурсы с Тамарой Кавтарадзе',
      lead: 'Короткие видеоуроки по 15 минут с самой Тамарой на платформе Gurucan. Оплата любой картой, можно купить отдельный модуль.',
      selectVal: 'Видеокурсы с Тамарой',
      tiers: [
        { name: 'Курс «Алфавит»', val: 'скидка −50%' },
        { name: '«Gamarjoba Start: Первые шаги» · с нуля до A1', val: 'модуль 160 лари' },
        { name: '«Gamarjoba Plus: Говорю и понимаю» · A1–B2', val: 'модуль 160 лари' },
        { name: 'Модуль в долларах и рублях', val: '60 $ · 3 980 ₽' }
      ],
      bullets: [
        'Цены указаны в лари, долларах и рублях.',
        'Платформа Gurucan, оплата любой картой.'
      ]
    },
    'kids': {
      badge: 'ДЕТЯМ · 33 БУКВЫ + АУДИО ПО КОДАМ',
      title: 'Грузинский для детей',
      lead: 'Пособие Tamarjoba для детей на 16 уроков: все 33 буквы, прописи и аудио по кодам.',
      selectVal: 'Грузинский для детей',
      tiers: [
        { name: 'Печатная версия пособия', val: '50 лари' },
        { name: 'Уроков в пособии', val: '16' },
        { name: 'Букв грузинского алфавита', val: '33' }
      ],
      bullets: [
        'Прописи для каждой буквы.',
        'Аудио открывается по кодам в пособии.'
      ]
    }
  };

  // тексты педагогов — с их сайта tamarjoba.com (карточки преподавателей, demo/tamarjoba/_src/skachano/prepod-N.png)
  var TEACHER_DOSSIERS = {
    '1': {
      badge: 'ПРЕПОДАВАТЕЛЬ TAMARJOBA',
      title: 'Виктория',
      lead: '«За любые наши труды нас ждёт хорошее вознаграждение».',
      photo: 'img/prepod-1.jpg',
      about: [
        'Люблю читать и развиваться, обожаю солнце и поэтому живу в солнечной Грузии.',
        'Я всегда в поиске нового, но в то же время предпочитаю старые устои.',
        'Любимая цитата: სწავლის ძირი მწარე არის, კენწეროში გატკბილდების.'
      ],
      selectVal: 'Индивидуальные уроки',
      tiers: [],
      bullets: []
    },
    '2': {
      badge: 'ПРЕПОДАВАТЕЛЬ TAMARJOBA',
      title: 'Нана Оболадзе',
      lead: '«Учитель может сделать только одно — указать дорогу».',
      photo: 'img/prepod-2.jpg',
      about: [
        'Люблю общаться с интересными людьми, рисовать и вообще заниматься творчеством. Стараюсь идти по жизни так, будто впереди всегда есть чему научиться.',
        'Если запастись терпением и проявить старание, то семена знания непременно дадут добрые всходы: «Учения корень горек, но плод сладок» (Леонардо да Винчи).'
      ],
      selectVal: 'Индивидуальные уроки',
      tiers: [],
      bullets: []
    },
    '3': {
      badge: 'ПРЕПОДАВАТЕЛЬ TAMARJOBA',
      title: 'Ануш',
      lead: '«Я преподаватель и филолог грузинского языка, трилингв».',
      photo: 'img/prepod-3.jpg',
      about: [
        'Мне нравится быть полезной и делиться знаниями. Стараюсь развиваться и получать всё больше знаний, вдохновляюсь хорошими людьми и солнцем.',
        'На изучение нового языка нужно терпение, и я с терпением всегда помогаю моим ученикам достигать намеченной цели — овладеть грузинским языком.',
        'На моих уроках всегда комфортно и интересно, а ещё вы найдёте все ответы на ваши вопросы о чудесном и древнем ქართული ენა.'
      ],
      selectVal: 'Индивидуальные уроки',
      tiers: [],
      bullets: []
    },
    '4': {
      badge: 'ПРЕПОДАВАТЕЛЬ TAMARJOBA',
      title: 'Элене Горадзе',
      lead: '«Стоит только поверить, что вы можете, — и вы уже на полпути к цели».',
      photo: 'img/prepod-4.jpg',
      about: [
        'Я люблю учить иностранные языки — говорю на пяти, читать книги, путешествовать и играть в волейбол.',
        'Люблю свою работу и общение с людьми: всегда можно узнать что-то новое и интересное. Хочу помочь вам изучать грузинский язык в приятной и дружелюбной обстановке.'
      ],
      selectVal: 'Индивидуальные уроки',
      tiers: [],
      bullets: []
    },
    '5': {
      badge: 'ПРЕПОДАВАТЕЛЬ TAMARJOBA',
      title: 'Джейн Хабази',
      lead: '«Для результата важен индивидуальный подход к каждому ученику».',
      photo: 'img/prepod-5.jpg',
      about: [
        'Магистр международных экономических отношений, дипломат. Очень нравится общение с новыми интересными людьми.',
        'На уроке должно быть комфортно и интересно. Считаю, что мир прекрасен и интересен, поэтому изучать его и учиться новому нужно всегда.'
      ],
      selectVal: 'Индивидуальные уроки',
      tiers: [],
      bullets: []
    },
    '6': {
      badge: 'ПРЕПОДАВАТЕЛЬ TAMARJOBA',
      title: 'Майя Горгошидзе',
      lead: '«Улыбчивость, оптимизм и энтузиазм — мои помощники на каждом занятии».',
      photo: 'img/prepod-6.jpg',
      about: [
        'Я грузинка со славянскими корнями. Люблю помогать ученикам в получении знаний, придавать больше уверенности в себе.',
        'На занятии создаю эмоционально комфортную обстановку, проявляю уважение к индивидуальности ученика и использую разные стратегии обучения.'
      ],
      selectVal: 'Индивидуальные уроки',
      tiers: [],
      bullets: []
    },
    '7': {
      badge: 'ПРЕПОДАВАТЕЛЬ TAMARJOBA',
      title: 'Инга',
      lead: '«Вы можете жить так, будто всё в этом мире является чудом».',
      photo: 'img/prepod-7.jpg',
      about: [
        'Есть два способа жить: вы можете жить так, как будто чудес не бывает, и вы можете жить так, как будто всё в этом мире является чудом.'
      ],
      selectVal: 'Индивидуальные уроки',
      tiers: [],
      bullets: []
    },
    '8': {
      badge: 'ПРЕПОДАВАТЕЛЬ TAMARJOBA',
      title: 'Нино',
      lead: '«Давайте говорить на грузинском вместе!»',
      photo: 'img/prepod-8.jpg',
      about: [
        'Я люблю общаться и знакомиться с новыми людьми, ценю доброжелательность и искренность в общении и дружбе.',
        'На моих уроках комфортно и очень интересно! Мы много говорим на грузинском с учениками — это самый важный и кратчайший путь к владению языком.'
      ],
      selectVal: 'Индивидуальные уроки',
      tiers: [],
      bullets: []
    }
  };

  /* --------------------------------------------------------------------------
     6. ЛОГИКА ОТКРЫТИЯ МОДАЛЬНОГО ДОСЬЕ (DRAWER) И ПЕРЕХОДА К ФОРМЕ
     -------------------------------------------------------------------------- */
  var backdrop = document.getElementById('tja-drawer-backdrop');
  var drawerBadge = document.getElementById('tja-drawer-badge');
  var drawerTitle = document.getElementById('tja-drawer-title');
  var drawerLead = document.getElementById('tja-drawer-lead');
  var drawerTiers = document.getElementById('tja-drawer-tiers');
  var drawerList = document.getElementById('tja-drawer-list');
  var drawerBookBtn = document.getElementById('tja-drawer-book');
  var drawerCloseBtn = document.getElementById('tja-drawer-close');
  var activeSelectValue = 'Очные группы: Тбилиси, Батуми';

  function openDossier(data) {
    if (!backdrop || !data) return;
    activeSelectValue = data.selectVal || 'Очные группы: Тбилиси, Батуми';
    if (drawerBadge) drawerBadge.textContent = data.badge || '';
    if (drawerTitle) drawerTitle.textContent = data.title || '';
    if (drawerLead) drawerLead.textContent = data.lead || '';
    if (drawerBookBtn) drawerBookBtn.textContent = data.about ? 'Записаться на пробный урок' : 'Записаться на это направление';
    var aboutBox = document.getElementById('tja-drawer-about');
    if (aboutBox) {
      var about = data.about || [];
      aboutBox.hidden = !about.length;
      var aboutText = document.getElementById('tja-drawer-text');
      var aboutPhoto = document.getElementById('tja-drawer-photo');
      if (aboutPhoto && data.photo) { aboutPhoto.src = data.photo; aboutPhoto.alt = data.title || ''; }
      if (aboutText) {
        aboutText.innerHTML = '';
        for (var ap = 0; ap < about.length; ap++) {
          var para = document.createElement('p');
          para.textContent = about[ap];
          aboutText.appendChild(para);
        }
      }
    }

    if (drawerTiers) {
      drawerTiers.innerHTML = '';
      var tiers = data.tiers || [];
      for (var i = 0; i < tiers.length; i++) {
        var row = document.createElement('div');
        row.className = 'tja-tier-row';
        var n = document.createElement('span');
        n.className = 'tja-tier-row__name';
        n.textContent = tiers[i].name;
        var v = document.createElement('span');
        v.className = 'tja-tier-row__val';
        v.textContent = tiers[i].val;
        row.appendChild(n);
        row.appendChild(v);
        drawerTiers.appendChild(row);
      }
    }

    if (drawerList) {
      drawerList.innerHTML = '';
      var bullets = data.bullets || [];
      for (var b = 0; b < bullets.length; b++) {
        var li = document.createElement('li');
        li.textContent = bullets[b];
        drawerList.appendChild(li);
      }
    }

    backdrop.hidden = false;
    document.body.classList.add('is-modal-open');
    playTone(587.33, 0.16, 'sine');
  }

  function closeDossier() {
    if (!backdrop) return;
    backdrop.hidden = true;
    document.body.classList.remove('is-modal-open');
  }

  function selectCourseAndScroll(courseValue) {
    closeDossier();
    var selectEl = document.getElementById('tja-select-course');
    if (selectEl && courseValue) {
      for (var i = 0; i < selectEl.options.length; i++) {
        if (selectEl.options[i].value === courseValue) {
          selectEl.selectedIndex = i;
          selectEl.dispatchEvent(new Event('change', { bubbles: true }));
          break;
        }
      }
    }
    var bookSec = document.getElementById('booking');
    if (bookSec) {
      bookSec.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
      var nameInp = document.getElementById('tja-inp-name');
      if (nameInp) {
        setTimeout(function () { nameInp.focus({ preventScroll: true }); }, 450);
      }
    }
  }

  var courseTriggers = document.querySelectorAll('[data-open-course]');
  for (var ct = 0; ct < courseTriggers.length; ct++) {
    courseTriggers[ct].addEventListener('click', function (e) {
      var key = e.currentTarget.getAttribute('data-open-course');
      openDossier(COURSE_DOSSIERS[key]);
    });
  }

  var teacherTriggers = document.querySelectorAll('[data-open-teacher]');
  for (var tt = 0; tt < teacherTriggers.length; tt++) {
    teacherTriggers[tt].addEventListener('click', function (e) {
      var id = e.currentTarget.getAttribute('data-open-teacher');
      openDossier(TEACHER_DOSSIERS[id]);
    });
  }

  if (drawerCloseBtn) {
    drawerCloseBtn.addEventListener('click', closeDossier);
  }

  if (backdrop) {
    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) closeDossier();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && backdrop && !backdrop.hidden) {
      closeDossier();
    }
  });

  if (drawerBookBtn) {
    drawerBookBtn.addEventListener('click', function () {
      selectCourseAndScroll(activeSelectValue);
    });
  }

  /* --------------------------------------------------------------------------
     7. ОТЗЫВЫ: ТРИ НАСТОЯЩИХ С САЙТА ШКОЛЫ (Светлана, Алёна, София — demo/tamarjoba/_src/skachano/otzyv-1…3.png)
        И ТРИ ПРИМЕРА ПО СЛОВУ РОМАНА 04.11 («только для примера клиента») — ДО ВЫКЛАДКИ ДЛЯ ШКОЛЫ ЗАМЕНИТЬ НАСТОЯЩИМИ
     -------------------------------------------------------------------------- */
  var REVIEWS = [
    {
      author: 'Светлана',
      text: '«Вы доступно объясняете! Занятия каждый день держат в тонусе и погружают в язык. Я очень довольна, спасибо вам огромное!»'
    },
    {
      author: 'Алёна',
      text: '«Только закончила ваш курс A1. Информация подана настолько понятно и структурированно, что прогресс пошёл. Я уже два года учу грузинский, и этот курс — лучшее, что у меня было».'
    },
    {
      author: 'София',
      text: '«Занимаюсь ночами — по-другому не выходит. Уроки такие интересные, что жду возможности присесть за урок, как отдыха за сериалом».'
    },
    { // пример
      author: 'Ирина',
      text: '«Переехали в Батуми, и через полгода я спокойно говорю с соседями и на рынке. Алфавит перестал пугать уже на втором уроке».'
    },
    { // пример
      author: 'Дмитрий',
      text: '«Готовился к экзамену на гражданство: тесты с переводами и тренажёр сняли весь страх. Сдал с первого раза, спасибо школе!»'
    },
    { // пример
      author: 'Ольга',
      text: '«Занимаемся с дочкой по детскому пособию. Ей нравятся прописи и аудио, а я учу буквы вместе с ней».'
    }
  ];

  var revText = document.getElementById('tja-rev-text');
  var revAuthor = document.getElementById('tja-rev-author');
  var revDots = document.querySelectorAll('[data-rev-idx]');
  var revBox = document.getElementById('tja-reviews-box');
  var revIdx = 0;
  var revTimer = null;

  var revSwap = null;
  function showReview(idx) {
    revIdx = (idx + REVIEWS.length) % REVIEWS.length;
    var apply = function () {
      if (revText) revText.textContent = REVIEWS[revIdx].text;
      if (revAuthor) revAuthor.textContent = REVIEWS[revIdx].author;
      if (revBox) { revBox.classList.remove('is-out'); revBox.classList.add('is-in'); }
    };
    // карточка уходит вверх и гаснет, новый отзыв въезжает снизу
    if (revBox && !reducedMotion) {
      clearTimeout(revSwap);
      revBox.classList.remove('is-in');
      revBox.classList.add('is-out');
      revSwap = setTimeout(apply, 380);
    } else apply();
    for (var i = 0; i < revDots.length; i++) {
      revDots[i].classList.toggle('is-active', i === revIdx);
    }
  }

  for (var rd = 0; rd < revDots.length; rd++) {
    revDots[rd].addEventListener('click', function (e) {
      var i = parseInt(e.currentTarget.getAttribute('data-rev-idx'), 10) || 0;
      showReview(i);
    });
  }

  if (!reducedMotion && revBox) {
    revTimer = setInterval(function () { showReview(revIdx + 1); }, 5500);
    revBox.addEventListener('pointerenter', function () {
      if (revTimer) clearInterval(revTimer);
    });
    revBox.addEventListener('pointerleave', function () {
      revTimer = setInterval(function () { showReview(revIdx + 1); }, 5500);
    });
  }

  /* --------------------------------------------------------------------------
     8. ФОРМА ЗАПИСИ (АКТИВАЦИЯ ПО ЧЕКБОКСУ И МГНОВЕННОЕ ПОДТВЕРЖДЕНИЕ)
     -------------------------------------------------------------------------- */
  var consentChk = document.getElementById('tja-consent-chk');
  var submitBtn = document.getElementById('tja-submit-btn');
  var bookingForm = document.getElementById('tja-booking-form');
  var formOk = document.getElementById('tja-form-ok');

  if (consentChk && submitBtn) {
    consentChk.addEventListener('change', function () {
      submitBtn.disabled = !consentChk.checked;
    });
  }

  if (bookingForm) {
    bookingForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var nameVal = (document.getElementById('tja-inp-name') || {}).value || 'Гость';
      var courseVal = (document.getElementById('tja-select-course') || {}).value || 'Пробный урок';
      var contactVal = (document.getElementById('tja-inp-contact') || {}).value || '';
      var channelVal = (document.getElementById('tja-select-channel') || {}).value || 'WhatsApp';

      if (formOk) {
        formOk.hidden = false;
        formOk.textContent = 'გამარჯობა, ' + nameVal + '! Заявка на «' + courseVal + '» принята. Менеджер Tamarjoba напишет вам в ' + channelVal + ' (' + contactVal + ') в ближайшее время.';
      }
      playTone(659.25, 0.3, 'triangle');
    });
  }

  /* --------------------------------------------------------------------------
     8б. ВЫПАДАЮЩИЕ СПИСКИ ФОРМЫ — СВОЙ СПИСОК ВМЕСТО СИСТЕМНОЙ ТАБЛИЦЫ
         (образец — demo/batumi-tours, .bt-pick; настоящий select скрыт и держит то же значение)
     -------------------------------------------------------------------------- */
  var picks = [];
  function closeAllPicks(except) {
    for (var cp = 0; cp < picks.length; cp++) if (picks[cp] !== except) picks[cp].close(false);
  }
  var nativeSelects = document.querySelectorAll('.tja-form select.tja-input');
  for (var ns = 0; ns < nativeSelects.length; ns++) {
    (function (sel) {
      var wrap = document.createElement('div');
      wrap.className = 'tja-pick';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tja-pick__b';
      btn.setAttribute('aria-haspopup', 'listbox');
      btn.setAttribute('aria-expanded', 'false');
      var val = document.createElement('span');
      val.className = 'tja-pick__v';
      btn.appendChild(val);
      var chev = document.createElement('span');
      chev.className = 'tja-pick__c';
      chev.setAttribute('aria-hidden', 'true');
      btn.appendChild(chev);
      var list = document.createElement('ul');
      list.className = 'tja-pick__list';
      list.setAttribute('role', 'listbox');
      list.tabIndex = -1;
      list.id = sel.id + '-list';
      btn.setAttribute('aria-controls', list.id);
      var lab = sel.closest('label');
      var labText = lab && lab.querySelector('.tja-field__label');
      if (labText) { labText.id = labText.id || sel.id + '-lbl'; list.setAttribute('aria-labelledby', labText.id); btn.setAttribute('aria-labelledby', labText.id + ' ' + sel.id + '-val'); }
      val.id = sel.id + '-val';
      var opts = [], cur = -1;
      for (var o = 0; o < sel.options.length; o++) {
        var li = document.createElement('li');
        li.className = 'tja-opt';
        li.id = sel.id + '-opt-' + o;
        li.setAttribute('role', 'option');
        li.textContent = sel.options[o].text;
        list.appendChild(li);
        opts.push(li);
      }
      sel.parentNode.insertBefore(wrap, sel);
      wrap.appendChild(btn);
      wrap.appendChild(list);
      wrap.appendChild(sel);
      sel.classList.add('tja-pick__native');
      sel.tabIndex = -1;
      sel.setAttribute('aria-hidden', 'true');
      // label с select внутри открывал системный список по клику на подпись — теперь подпись ведёт к кнопке
      if (lab) lab.addEventListener('click', function (e) { if (e.target === labText) { e.preventDefault(); btn.focus(); } });

      function sync() {
        val.textContent = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : '';
        for (var k = 0; k < opts.length; k++) opts[k].setAttribute('aria-selected', k === sel.selectedIndex ? 'true' : 'false');
      }
      function setCur(i) {
        cur = Math.max(0, Math.min(opts.length - 1, i));
        for (var k = 0; k < opts.length; k++) opts[k].classList.toggle('is-cur', k === cur);
        list.setAttribute('aria-activedescendant', opts[cur].id);
        var top = opts[cur].offsetTop, bot = top + opts[cur].offsetHeight;
        if (top < list.scrollTop) list.scrollTop = top - 6;
        else if (bot > list.scrollTop + list.clientHeight) list.scrollTop = bot - list.clientHeight + 6;
      }
      function open() {
        if (wrap.classList.contains('is-open')) return;
        closeAllPicks(api);
        wrap.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
        setCur(sel.selectedIndex);
        list.focus({ preventScroll: true });
      }
      function close(back) {
        if (!wrap.classList.contains('is-open')) return;
        wrap.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');
        if (back) btn.focus({ preventScroll: true });
      }
      function choose(i) {
        if (i < 0 || !opts[i]) return;
        sel.selectedIndex = i;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        sync();
        close(true);
        playTone(523.25, 0.12, 'sine');
      }
      var api = { close: close };
      picks.push(api);
      btn.addEventListener('click', function () { if (wrap.classList.contains('is-open')) close(true); else open(); });
      btn.addEventListener('keydown', function (e) { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(); } });
      list.addEventListener('click', function (e) { var li = e.target.closest('.tja-opt'); if (li) choose(opts.indexOf(li)); });
      list.addEventListener('keydown', function (e) {
        var k = e.key;
        if (k === 'ArrowDown') { e.preventDefault(); setCur(cur + 1); }
        else if (k === 'ArrowUp') { e.preventDefault(); setCur(cur - 1); }
        else if (k === 'Home') { e.preventDefault(); setCur(0); }
        else if (k === 'End') { e.preventDefault(); setCur(opts.length - 1); }
        else if (k === 'Enter' || k === ' ') { e.preventDefault(); choose(cur); }
        else if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); }
        else if (k === 'Tab') close(false);
      });
      sel.addEventListener('change', sync);
      sync();
    })(nativeSelects[ns]);
  }
  document.addEventListener('pointerdown', function (e) {
    if (!e.target.closest('.tja-pick')) closeAllPicks(null);
  });

  /* --------------------------------------------------------------------------
     9. СВЕТОВОЙ ОТКЛИК СЛОЯ 3 (--mx, --my) НА КАРТОЧКАХ .tja-spot
     -------------------------------------------------------------------------- */
  var spots = document.querySelectorAll('.tja-spot');
  if (!reducedMotion && spots.length) {
    document.addEventListener('pointermove', function (e) {
      for (var s = 0; s < spots.length; s++) {
        var el = spots[s];
        var r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) continue;
        el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        el.style.setProperty('--my', (e.clientY - r.top) + 'px');
      }
    }, { passive: true });
  }
})();
