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
      title: 'Группы в Тбилиси и Батуми',
      lead: 'Живые занятия в уютных классах в центре Тбилиси (Сабуртало, ул. Медеи Чахава, 9) и Батуми (ул. Зураба Горгиладзе, 95). В группе от 4 до 8 учеников, фирменные рабочие тетради и прописи выдаём бесплатно.',
      selectVal: 'Группы в Тбилиси и Батуми',
      tiers: [
        { name: 'Месячный абонемент · 8 уроков по 90 мин', val: '280 лари' },
        { name: 'Полный курс 3 месяца · 24 урока по 90 мин', val: '690 лари' },
        { name: 'Рабочие тетради и прописи школы Tamarjoba', val: '0 лари · в подарок' }
      ],
      bullets: [
        'Занятия 2 раза в неделю по 1,5 часа в утренних или вечерних группах.',
        'Уровни от нуля (алфавит и чтение) до свободного разговорного B1–B2.',
        'Чай, кофе и разговорные встречи «Кава с Tamarjoba» для практики.',
        'Преподаватели-билингвы мягко ставят грузинское произношение с первого урока.'
      ]
    },
    'online': {
      badge: 'ZOOM + ПЛАТФОРМА · МИНИ-ГРУППЫ',
      title: 'Онлайн-группы с билингвом',
      lead: 'Камерные онлайн-группы на 4–6 человек с живым преподавателем-билингвом, доступом к интерактивной платформе и еженедельной разговорной практикой.',
      selectVal: 'Онлайн-группы с билингвом',
      tiers: [
        { name: 'Абонемент на месяц · 8 живых уроков', val: '280 лари' },
        { name: 'Разговорная практика в клубе · 4 часа в месяц', val: 'включено в курс' },
        { name: 'Доступ к интерактивной платформе и записям', val: '24/7' }
      ],
      bullets: [
        'Все уроки проходят вживую с педагогом и сохраняются в записи в личном кабинете.',
        'Домашние задания с голосовой проверкой от преподавателя.',
        'Интерактивные карточки слов и тренажёры грамматики на платформе.',
        'Удобно совмещать с работой из любой точки Грузии или других стран.'
      ]
    },
    'indiv': {
      badge: '1 НА 1 С ПЕДАГОГОМ · ГИБКИЙ ГРАФИК',
      title: 'Индивидуальные уроки',
      lead: 'Персональная программа под вашу задачу (переезд, работа, бизнес или подготовка к собеседованию). Перед стартом проведём бесплатный пробный урок 20 минут для знакомства и определения уровня.',
      selectVal: 'Индивидуальные уроки (пробный 20 мин бесплатно)',
      tiers: [
        { name: 'Пробный урок-знакомство · 20 минут', val: '0 лари · бесплатно' },
        { name: 'Пакет 8 индивидуальных уроков по 60 минут', val: '640 лари' },
        { name: 'Бонус при продлении в день последнего урока', val: '+1 или +2 урока в подарок' }
      ],
      bullets: [
        'Гибкое расписание в Тбилиси, Батуми или онлайн в Zoom.',
        'Подбор преподавателя-билингва под ваш темп и профессиональную лексику.',
        'Возможность переносить занятия без сгорания уроков по предупреждению.',
        'Все авторские учебные материалы Тамары Кавтарадзе включены.'
      ]
    },
    'citizen': {
      badge: '99% СДАЮТ · 700+ ПОЛУЧИЛИ ПАСПОРТ',
      title: 'Экзамен на гражданство Грузии',
      lead: 'Полная подготовка к экзамену по грузинскому языку, истории и основам права по актуальным правилам Минюста. 99% наших учеников успешно сдают экзамен, более 700 человек уже получили гражданство Грузии.',
      selectVal: 'Экзамен на гражданство Грузии',
      tiers: [
        { name: 'Онлайн-тренажёр официальных тестов', val: 'от 280 лари' },
        { name: 'Подготовка к устному собеседованию с комиссией', val: '300 лари' },
        { name: 'Комплект из 3 печатных книг с тестами и переводами', val: '650 лари' },
        { name: 'Полный курс подготовки с преподавателем', val: '720 лари' },
        { name: 'Консультационная встреча «Кава с Tamarjoba»', val: '0 лари · бесплатно' }
      ],
      bullets: [
        'Разбор всех официальных билетов по языку, истории и праву Грузии.',
        'Репетиция устного собеседования и написания автобиографии.',
        'Актуальная база вопросов с последними обновлениями комиссии.'
      ]
    },
    'video': {
      badge: 'ПЛАТФОРМА GURUCAN · УРОКИ ПО 15 МИН',
      title: 'Видеокурсы с Тамарой Кавтарадзе',
      lead: 'Короткие и понятные видеоуроки по 15 минут с самой Тамарой Кавтарадзе в приложении Gurucan. Занимайтесь в своём ритме с проверкой заданий куратором.',
      selectVal: 'Видеокурсы с Тамарой (Gurucan)',
      tiers: [
        { name: 'Курс «Анбани» · все 33 буквы, чтение и письмо', val: '90 лари' },
        { name: '«Gamarjoba Start» (A1–A2) · 1 ступень на выбор', val: '160 лари' },
        { name: '«Gamarjoba Start» или «Gamarjoba Plus» (глаголы) · полный курс', val: '320 лари' }
      ],
      bullets: [
        'Доступ с телефона и компьютера через удобное приложение Gurucan.',
        'Конспекты, рабочие листы, аудиодиалоги и тесты после каждого модуля.',
        'Отдельный курс «Gamarjoba Plus» полностью снимает страх перед грузинскими глаголами.'
      ]
    },
    'kids': {
      badge: 'ДЕТЯМ · 33 БУКВЫ + АУДИО ПО QR',
      title: 'Грузинский для детей (книга и курс)',
      lead: 'Авторское иллюстрированное пособие Tamarjoba для детей (`tamarjoba.com/p/1190038/`): 59 ярких страниц, 16 игровых уроков, прописи со стрелками и живая озвучка носителя по QR-коду.',
      selectVal: 'Грузинский для детей (книга и уроки)',
      tiers: [
        { name: 'Печатная книга-пропись с доставкой по Грузии', val: '50 лари' },
        { name: 'Электронная PDF-версия для печати дома', val: '1 100 руб.' },
        { name: 'Детские игровые занятия с педагогом', val: 'запись на пробный урок' }
      ],
      bullets: [
        '16 увлекательных уроков и все 33 буквы грузинского алфавита.',
        'На каждой странице QR-код с аудиозаписью правильного произношения слов.',
        'Крупные прописи со стрелками направления руки и раскраски.'
      ]
    }
  };

  var TEACHER_DOSSIERS = {
    '1': {
      badge: 'ПЕДАГОГ-БИЛИНГВ · ТБИЛИСИ И ОНЛАЙН',
      title: 'Тамта',
      lead: 'Дипломированный филолог и преподаватель-билингв. Ведёт утренние и вечерние группы уровня A1–A2 и индивидуальные занятия для начинающих.',
      selectVal: 'Индивидуальные уроки (пробный 20 мин бесплатно)',
      tiers: [
        { name: 'Специализация', val: 'Постановка произношения и база A1–A2' },
        { name: 'Формат работы', val: 'Тбилиси (Сабуртало) и Zoom' }
      ],
      bullets: [
        'Помогает заговорить полными фразами уже с третьей недели обучения.',
        'Автор игровых разминок для запоминания бытовой лексики.'
      ]
    },
    '2': {
      badge: 'ЭКЗАМЕН НА ГРАЖДАНСТВО · B1–B2',
      title: 'Нино',
      lead: 'Старший преподаватель направления подготовки к экзамену на гражданство Грузии и продвинутых разговорных курсов.',
      selectVal: 'Экзамен на гражданство Грузии',
      tiers: [
        { name: 'Специализация', val: 'Экзамен по языку, истории и праву Грузии' },
        { name: 'Результаты учеников', val: '99% успешной сдачи с первой попытки' }
      ],
      bullets: [
        'Проводит персональные репетиции устного собеседования перед комиссией.',
        'Объясняет сложные времена глаголов простыми таблицами.'
      ]
    },
    '3': {
      badge: 'РАЗГОВОРНЫЙ КЛУБ · ОНЛАЙН-ГРУППЫ',
      title: 'Мариам',
      lead: 'Ведущая разговорных клубов и мини-групп онлайн. Снимает языковой барьер через живые диалоги из реальной жизни в Грузии.',
      selectVal: 'Онлайн-группы с билингвом',
      tiers: [
        { name: 'Специализация', val: 'Разговорная практика и живая речь' },
        { name: 'Формат работы', val: 'Мини-группы 4–6 человек онлайн' }
      ],
      bullets: [
        'Моделирует диалоги в банке, клинике, сервисе и на рынке.',
        'Бережно исправляет ошибки, не перебивая мысль ученика.'
      ]
    },
    '4': {
      badge: 'ИСТОРИЯ И ПРАВО · ДЕЛОВОЙ ГРУЗИНСКИЙ',
      title: 'Георгий',
      lead: 'Преподаватель-билингв по деловому грузинскому языку, истории Грузии и юридической терминологии для предпринимателей.',
      selectVal: 'Экзамен на гражданство Грузии',
      tiers: [
        { name: 'Специализация', val: 'Деловой язык и тесты по истории Грузии' },
        { name: 'Формат работы', val: 'Индивидуально и мини-группы' }
      ],
      bullets: [
        'Готовит к ведению переговоров и чтению документов на грузинском.',
        'Разбирает исторические билеты экзамена через яркие истории.'
      ]
    },
    '5': {
      badge: 'БАТУМИ · ОФЛАЙН И ОНЛАЙН',
      title: 'Кетеван',
      lead: 'Ведущий педагог филиала Tamarjoba в Батуми (ул. Зураба Горгиладзе, 95). Ведёт очные группы с нуля и индивидуальные занятия.',
      selectVal: 'Группы в Тбилиси и Батуми',
      tiers: [
        { name: 'Специализация', val: 'Очные группы в Батуми A1–B1' },
        { name: 'Локация', val: 'Батуми, ул. Зураба Горгиладзе, 95' }
      ],
      bullets: [
        'Проводит разговорные встречи и внеклассные экскурсии на грузинском в Батуми.',
        'Влюбляет в грузинскую культуру, песни и живые идиомы.'
      ]
    },
    '6': {
      badge: 'ДЕТСКОЕ НАПРАВЛЕНИЕ · АЛФАВИТ',
      title: 'Саломе',
      lead: 'Преподаватель детских и подростковых групп, соавтор методических игр по книге-прописи из 33 букв.',
      selectVal: 'Грузинский для детей (книга и уроки)',
      tiers: [
        { name: 'Специализация', val: 'Дети 6–14 лет и курс алфавита' },
        { name: 'Формат работы', val: 'Очно и онлайн в игровой форме' }
      ],
      bullets: [
        'Учит детей читать и писать грузинскую вязь без скучной зубрёжки.',
        'Использует аудиосказки, карточки и интерактивные пазлы.'
      ]
    },
    '7': {
      badge: 'СИСТЕМНАЯ ГРАММАТИКА · ГЛАГОЛЫ',
      title: 'Натия',
      lead: 'Эксперт по системе грузинского глагола и куратор студентов на видеокурсах «Gamarjoba Start» и «Gamarjoba Plus».',
      selectVal: 'Видеокурсы с Тамарой (Gurucan)',
      tiers: [
        { name: 'Специализация', val: 'Грузинские глаголы и проверка ДЗ' },
        { name: 'Формат работы', val: 'Онлайн-уроки и кураторство на платформе' }
      ],
      bullets: [
        'Даёт подробную голосовую обратную связь по каждому домашнему заданию.',
        'Раскладывает систему падежей и глагольных рядов по полочкам.'
      ]
    },
    '8': {
      badge: 'ИНТЕНСИВЫ ДЛЯ РЕЛОКАНТОВ · A1–B1',
      title: 'Эка',
      lead: 'Преподаватель интенсивных потоков для тех, кто недавно переехал в Тбилиси или Батуми и хочет быстро адаптироваться.',
      selectVal: 'Онлайн-группы с билингвом',
      tiers: [
        { name: 'Специализация', val: 'Быстрый старт для жизни в Грузии' },
        { name: 'Формат работы', val: 'Тбилиси, Батуми и онлайн' }
      ],
      bullets: [
        'Фокус на самом частотном словаре первых 500 слов.',
        'Дружелюбная поддержка учеников между уроками в чате группы.'
      ]
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
  var activeSelectValue = 'Группы в Тбилиси и Батуми';

  function openDossier(data) {
    if (!backdrop || !data) return;
    activeSelectValue = data.selectVal || 'Группы в Тбилиси и Батуми';
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
     7. КАРУСЕЛЬ 3 РЕАЛЬНЫХ ОТЗЫВОВ (СВЕТЛАНА, АЛЁНА, СОФИЯ)
     -------------------------------------------------------------------------- */
  var REVIEWS = [
    {
      author: 'Светлана · сдала экзамен на гражданство Грузии',
      text: '«Готовилась в Tamarjoba по трём книгам и на курсе с педагогом. На собеседовании понимала каждый вопрос комиссии и сдала с первого раза!»'
    },
    {
      author: 'Алёна · онлайн-группа A1–A2 и курс глаголов',
      text: '«Боялась грузинских букв и глаголов, а через месяц уже читала вывески в Тбилиси и разговаривала с соседями. Уроки пролетают на одном дыхании!»'
    },
    {
      author: 'София · очная группа в Батуми на Горгиладзе, 95',
      text: '«Очень тёплая школа, маленькая группа и чудесные рабочие тетради. Преподаватель-билингв объясняет так просто, что всё укладывается в голове сразу.»'
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
        formOk.textContent = 'გამარჯობა, ' + nameVal + '! Заявка на «' + courseVal + '» принята. Менеджер Tamarjoba напишет вам в ' + channelVal + ' (' + contactVal + ') в течение 15 минут.';
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
