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
     2. КНОПКА ПРИВЕТСТВИЯ გამარჯობა НА ПЕРВОМ ЭКРАНЕ
     -------------------------------------------------------------------------- */
  var helloBtn = document.getElementById('tja-hello-btn');
  var helloTr = document.getElementById('tja-hello-tr');
  var greetings = [
    { geo: 'გამარჯობა', tr: 'Гамарджоба · Здравствуйте!', freq: 523.25 },
    { geo: 'როგორ ხარ?', tr: 'Рогор хар · Как дела?', freq: 587.33 },
    { geo: 'მადლობა', tr: 'Мадлоба · Спасибо!', freq: 659.25 },
    { geo: 'საქართველო', tr: 'Сакартвело · Грузия!', freq: 698.46 }
  ];
  var greetIdx = 0;

  if (helloBtn && helloTr) {
    helloBtn.addEventListener('click', function () {
      greetIdx = (greetIdx + 1) % greetings.length;
      var item = greetings[greetIdx];
      var geoSpan = helloBtn.querySelector('.tja-hello-btn__geo');
      if (geoSpan) geoSpan.textContent = item.geo;
      helloTr.textContent = item.tr;
      playTone(item.freq, 0.26, 'triangle');
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
        playTone(notes[idx % notes.length], 0.22, 'sine');
      });
    })(letterCards[i], i);
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
      selectCourseAndScroll('Индивидуальные уроки (пробный 20 мин бесплатно)');
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

  var TEACHER_DOSSIERS = {
    '1': {
      badge: 'ПРЕПОДАВАТЕЛЬ TAMARJOBA',
      title: 'Виктория',
      lead: '«Обожаю солнце и поэтому живу в солнечной Грузии».',
      selectVal: 'Индивидуальные уроки',
      tiers: [],
      bullets: []
    },
    '2': {
      badge: 'ПРЕПОДАВАТЕЛЬ TAMARJOBA',
      title: 'Нана Оболадзе',
      lead: '«Учитель может сделать только одно: указать дорогу».',
      selectVal: 'Индивидуальные уроки',
      tiers: [],
      bullets: []
    },
    '3': {
      badge: 'ПРЕПОДАВАТЕЛЬ TAMARJOBA',
      title: 'Ануш',
      lead: '«Я преподаватель и филолог грузинского языка, трилингв».',
      selectVal: 'Индивидуальные уроки',
      tiers: [],
      bullets: []
    },
    '4': {
      badge: 'ПРЕПОДАВАТЕЛЬ TAMARJOBA',
      title: 'Элене Горадзе',
      lead: '«Стоит поверить, что вы можете, и вы уже на полпути к цели».',
      selectVal: 'Индивидуальные уроки',
      tiers: [],
      bullets: []
    },
    '5': {
      badge: 'ПРЕПОДАВАТЕЛЬ TAMARJOBA',
      title: 'Джейн Хабази',
      lead: '«Для результата важно подходить к каждому ученику по-своему».',
      selectVal: 'Индивидуальные уроки',
      tiers: [],
      bullets: []
    },
    '6': {
      badge: 'ПРЕПОДАВАТЕЛЬ TAMARJOBA',
      title: 'Майя Горгошидзе',
      lead: '«Улыбчивость, оптимизм и энтузиазм: мои помощники на каждом занятии».',
      selectVal: 'Индивидуальные уроки',
      tiers: [],
      bullets: []
    },
    '7': {
      badge: 'ПРЕПОДАВАТЕЛЬ TAMARJOBA',
      title: 'Инга',
      lead: '«Можно жить так, будто всё в этом мире является чудом».',
      selectVal: 'Индивидуальные уроки',
      tiers: [],
      bullets: []
    },
    '8': {
      badge: 'ПРЕПОДАВАТЕЛЬ TAMARJOBA',
      title: 'Нино',
      lead: '«Давайте говорить на грузинском вместе!»',
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
     7. ОТЗЫВ СВЕТЛАНЫ (ДОСЛОВНО С САЙТА ШКОЛЫ)
     -------------------------------------------------------------------------- */
  var REVIEWS = [
    {
      author: 'Светлана',
      text: '«Вы доступно объясняете! Занятия каждый день держат в тонусе и погружают в язык. Я очень довольна, спасибо вам огромное!»'
    }
  ];

  var revText = document.getElementById('tja-rev-text');
  var revAuthor = document.getElementById('tja-rev-author');
  var revDots = document.querySelectorAll('[data-rev-idx]');
  var revBox = document.getElementById('tja-reviews-box');
  var revIdx = 0;
  var revTimer = null;

  function showReview(idx) {
    revIdx = (idx + REVIEWS.length) % REVIEWS.length;
    if (revText) revText.textContent = REVIEWS[revIdx].text;
    if (revAuthor) revAuthor.textContent = REVIEWS[revIdx].author;
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
