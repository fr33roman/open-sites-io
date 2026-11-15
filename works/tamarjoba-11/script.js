/* ==========================================================================
   TAMARJOBA 11 — script.js
   1. Сменный баннер первого экрана из promo.js
   2. Кнопка-приветствие со звуком
   3. Окна по центру: алфавит с игрой, формат обучения, педагог, магазин
   4. Карусель отзывов
   5. Форма записи, свои выпадающие списки
   6. Меню-бургер, мягкое появление блоков, отклик света на карточках
   ========================================================================== */
(function () {
  'use strict';

  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var phoneMq = window.matchMedia('(max-width: 720px)');

  /* --------------------------------------------------------------------------
     Мягкий синтезатор Web Audio для карточек букв и игры
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

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* --------------------------------------------------------------------------
     1. СМЕННЫЙ БАННЕР ПЕРВОГО ЭКРАНА (данные — promo.js)
        Слайд с полем video на телефоне играет ролик (на компьютере он не грузится).
        Два слайда и больше — смена раз в 6 секунд; на паузе при наведении, в фоне и вне экрана.
     -------------------------------------------------------------------------- */
  var promoFrame = document.getElementById('tja-promo-frame');
  var promoDots = document.getElementById('tja-promo-dots');
  var promoData = (window.TJA_PROMO && window.TJA_PROMO.length) ? window.TJA_PROMO : null;
  var promoSlides = [];
  var promoIdx = 0, promoTimer = null, promoHover = false, promoVisible = true;

  function setPromo(idx) {
    promoIdx = (idx + promoSlides.length) % promoSlides.length;
    for (var i = 0; i < promoSlides.length; i++) {
      var on = i === promoIdx;
      promoSlides[i].node.classList.toggle('is-on', on);
      promoSlides[i].node.setAttribute('aria-hidden', on ? 'false' : 'true');
      if (promoSlides[i].dot) {
        promoSlides[i].dot.classList.toggle('is-on', on);
        promoSlides[i].dot.setAttribute('aria-current', on ? 'true' : 'false');
      }
      var v = promoSlides[i].video;
      if (v) { if (on && phoneMq.matches && !reducedMotion) { var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); } else v.pause(); }
    }
  }
  function promoTick() {
    if (promoSlides.length < 2 || promoHover || !promoVisible || document.hidden || reducedMotion) return;
    setPromo(promoIdx + 1);
  }

  if (promoFrame && promoData) {
    promoFrame.innerHTML = '';
    for (var pi = 0; pi < promoData.length; pi++) {
      (function (d, i) {
        var slide = el('div', 'tja-promo__slide');
        var hasVideo = !!(d.video && phoneMq.matches);
        if (d.video) slide.classList.add('tja-promo__slide--video');
        var img = document.createElement('img');
        img.src = d.img;
        img.alt = d.alt || '';
        img.width = 1200; img.height = 1000;
        if (i === 0) img.setAttribute('fetchpriority', 'high'); else img.loading = 'lazy';
        slide.appendChild(img);
        var video = null;
        if (hasVideo) {
          video = document.createElement('video');
          video.muted = true; video.loop = true; video.playsInline = true; video.preload = 'none';
          video.setAttribute('aria-hidden', 'true');
          if (d.poster) video.poster = d.poster;
          if (!reducedMotion) {
            video.src = d.video;
            video.defaultPlaybackRate = 0.8;
            video.playbackRate = 0.8;
            video.addEventListener('loadedmetadata', function () { video.playbackRate = 0.8; });
          }
          slide.appendChild(video);
          document.documentElement.classList.add('tja-has-video');
        }
        if (d.title) {
          var card = el('div', 'tja-promo__card');
          card.appendChild(el('strong', 'tja-promo__title', d.title));
          if (d.text) card.appendChild(el('p', 'tja-promo__text', d.text));
          if (d.button) {
            var btn = el('a', 'tja-cta tja-cta--red tja-promo__btn', d.button);
            btn.href = d.link || '#booking';
            if (/^https?:/.test(btn.href) && btn.href.indexOf(location.origin) !== 0) { btn.target = '_blank'; btn.rel = 'noopener'; }
            card.appendChild(btn);
          }
          slide.appendChild(card);
        }
        promoFrame.appendChild(slide);
        var rec = { node: slide, video: video, dot: null };
        if (promoData.length > 1 && promoDots) {
          var dot = el('button', 'tja-promo__dot');
          dot.type = 'button';
          dot.setAttribute('aria-label', 'Слайд ' + (i + 1));
          dot.addEventListener('click', function () { setPromo(i); });
          promoDots.appendChild(dot);
          rec.dot = dot;
        }
        promoSlides.push(rec);
      })(promoData[pi], pi);
    }
    setPromo(0);
    if (promoSlides.length > 1 && !reducedMotion) {
      promoTimer = setInterval(promoTick, 6000);
      promoFrame.addEventListener('pointerenter', function () { promoHover = true; });
      promoFrame.addEventListener('pointerleave', function () { promoHover = false; });
      promoFrame.addEventListener('focusin', function () { promoHover = true; });
      promoFrame.addEventListener('focusout', function () { promoHover = false; });
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) {
        promoVisible = en[0].isIntersecting;
        for (var s = 0; s < promoSlides.length; s++) {
          var v2 = promoSlides[s].video;
          if (!v2) continue;
          if (!promoVisible) v2.pause();
          else if (promoSlides[s].node.classList.contains('is-on') && phoneMq.matches && !reducedMotion) { var p2 = v2.play(); if (p2 && p2.catch) p2.catch(function () {}); }
        }
      }, { threshold: 0.15 }).observe(promoFrame);
    }
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) for (var s = 0; s < promoSlides.length; s++) if (promoSlides[s].video) promoSlides[s].video.pause();
    });
  }

  /* --------------------------------------------------------------------------
     2. КНОПКА-ПРИВЕТСТВИЕ გამარჯობა («Выучи первые слова»)
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
     3а. КАРТОЧКИ БУКВ (в окне алфавита) — переворот, звук, смена восьмёрки раз в 6 секунд
     -------------------------------------------------------------------------- */
  var letterCards = document.querySelectorAll('.tja-letter-card');
  var notes = [440, 493.88, 523.25, 587.33, 659.25, 698.46, 783.99, 880];
  for (var i = 0; i < letterCards.length; i++) {
    (function (card, idx) {
      card.addEventListener('click', function () {
        for (var k = 0; k < letterCards.length; k++) letterCards[k].classList.remove('is-pulse');
        var flipped = card.classList.toggle('is-flipped');
        card.setAttribute('aria-pressed', flipped ? 'true' : 'false');
        card.classList.add('is-said');
        playTone(notes[idx % notes.length], 0.22, 'sine');
      });
    })(letterCards[i], i);
  }

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
  var alphaBadge = document.getElementById('tja-alpha-badge');
  var alphaGridEl = document.getElementById('tja-alpha-grid');
  var alphaHold = false, alphaTimer = null;
  function labelCard(card, L) {
    card.setAttribute('aria-label', 'Буква ' + L.g + ', звук ' + L.s + ', слово ' + L.r + ' — ' + L.m);
  }
  function fillCard(card, L) {
    card.querySelector('.tja-letter-card__glyph').textContent = L.g;
    card.querySelector('.tja-letter-card__sound').textContent = 'звук «' + L.s.split(' ')[0] + '»' + (L.s.indexOf(' ') > 0 ? ' ' + L.s.split(' ').slice(1).join(' ') : '');
    card.querySelector('.tja-letter-card__word').textContent = L.w;
    card.querySelector('.tja-letter-card__read').textContent = L.m + ' (' + L.r + ')';
    labelCard(card, L);
  }
  for (var lc = 0; lc < letterCards.length; lc++) labelCard(letterCards[lc], ALPHABET[lc]);
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
  if (alphaGridEl) {
    alphaGridEl.addEventListener('pointerenter', function () { alphaHold = true; });
    alphaGridEl.addEventListener('pointerleave', function () { alphaHold = false; });
    alphaGridEl.addEventListener('focusin', function () { alphaHold = true; });
    alphaGridEl.addEventListener('focusout', function () { alphaHold = false; });
  }
  // при открытии окна: подписи «звук …» появляются по одной; смена восьмёрки идёт только пока окно открыто
  function alphaOpened() {
    for (var q = 0; q < letterCards.length; q++) {
      (function (card, k) {
        if (reducedMotion) card.classList.add('is-said');
        else setTimeout(function () { card.classList.add('is-said'); }, 350 + k * 320);
      })(letterCards[q], q);
    }
    if (!reducedMotion && !alphaTimer) alphaTimer = setInterval(nextAlphaPage, 6000);
  }
  function alphaClosed() {
    if (alphaTimer) { clearInterval(alphaTimer); alphaTimer = null; }
  }

  /* --------------------------------------------------------------------------
     3б. МИНИ-ИГРА: СОБЕРИТЕ СЛОВО გამარჯობა ИЗ 9 БУКВ
     -------------------------------------------------------------------------- */
  var TARGET_WORD = ['გ', 'ა', 'მ', 'ა', 'რ', 'ჯ', 'ო', 'ბ', 'ა'];
  var SHUFFLED_INDICES = [2, 0, 5, 1, 7, 4, 8, 3, 6];
  var slotsWrap = document.getElementById('tja-word-slots');
  var trayWrap = document.getElementById('tja-word-tray');
  var resetBtn = document.getElementById('tja-word-reset');
  var winBox = document.getElementById('tja-word-win');
  var currentStep = 0;

  function renderWordGame() {
    if (!slotsWrap || !trayWrap) return;
    currentStep = 0;
    if (winBox) winBox.hidden = true;
    slotsWrap.innerHTML = '';
    trayWrap.innerHTML = '';
    for (var s = 0; s < TARGET_WORD.length; s++) {
      var slot = el('span', 'tja-slot', '·');
      slot.setAttribute('data-slot', String(s));
      slotsWrap.appendChild(slot);
    }
    for (var c = 0; c < SHUFFLED_INDICES.length; c++) {
      var letter = TARGET_WORD[SHUFFLED_INDICES[c]];
      var chip = el('button', 'tja-chip', letter);
      chip.type = 'button';
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
    for (var k = 0; k < chips.length; k++) {
      chips[k].classList.remove('is-next');
      if (!highlighted && !chips[k].classList.contains('is-used') && chips[k].getAttribute('data-letter') === needed) {
        chips[k].classList.add('is-next');
        highlighted = true;
      }
    }
  }
  function onChipClick(e) {
    var btn = e.currentTarget;
    if (btn.classList.contains('is-used') || currentStep >= TARGET_WORD.length) return;
    var letter = btn.getAttribute('data-letter');
    if (letter === TARGET_WORD[currentStep]) {
      btn.classList.add('is-used');
      btn.classList.remove('is-next');
      var slot = slotsWrap.querySelector('[data-slot="' + currentStep + '"]');
      if (slot) { slot.textContent = letter; slot.classList.add('is-filled'); }
      playTone(480 + currentStep * 45, 0.18, 'triangle');
      currentStep++;
      if (currentStep >= TARGET_WORD.length) {
        if (winBox) winBox.hidden = false;
        playTone(784, 0.35, 'sine');
      } else highlightNextChip();
    } else {
      btn.classList.remove('is-wrong');
      void btn.offsetWidth;
      btn.classList.add('is-wrong');
      playTone(220, 0.2, 'sawtooth');
    }
  }
  if (resetBtn) resetBtn.addEventListener('click', renderWordGame);
  renderWordGame();

  /* --------------------------------------------------------------------------
     3в. СВЕДЕНИЯ ДЛЯ ОКОН: ФОРМАТЫ (без цен — цены только в «Магазине») И ПЕДАГОГИ
     -------------------------------------------------------------------------- */
  var COURSE_DOSSIERS = {
    'offline': {
      badge: 'ТБИЛИСИ · БАТУМИ',
      title: 'Очные группы: Тбилиси, Батуми',
      lead: 'Живые занятия в небольших группах. Тбилиси, Сабуртало, ул. Медеи Чахава, 9 и Батуми, ул. Зураба Горгиладзе, 95.',
      selectVal: 'Очные группы: Тбилиси, Батуми',
      tiers: [
        { name: 'Занятия', val: '2 раза в неделю · 60 мин' },
        { name: 'Города', val: 'Тбилиси и Батуми' },
        { name: 'Уровни', val: 'с нуля до продвинутого' }
      ],
      bullets: [
        'Узнать свой уровень поможет тест на знания языка.',
        'Условия и расписание группы подскажет школа.'
      ]
    },
    'online': {
      badge: 'ОНЛАЙН · ГРУППЫ ДО 6 ЧЕЛОВЕК',
      title: 'Онлайн-группы',
      lead: 'Занятия по 60 минут 2 раза в неделю в небольшой группе от 4 до 6 человек.',
      selectVal: 'Онлайн-группы',
      tiers: [
        { name: 'Группа', val: '4–6 человек' },
        { name: 'A1', val: '40 часов · 5 месяцев' },
        { name: 'A2', val: '32 часа · 4 месяца' },
        { name: 'A2+', val: '40 часов' },
        { name: 'Разговорная практика', val: 'часы входят' }
      ],
      bullets: [
        'В A1 — 4 часа разговорной практики, в A2 — 3 часа.',
        'Программа A1 разбита по темам: алфавит, настоящее время, счёт.'
      ]
    },
    'indiv': {
      badge: '1 НА 1 · ОНЛАЙН И ОФЛАЙН',
      title: 'Индивидуальные уроки',
      lead: 'Занятия один на один, онлайн и офлайн. Преподаватели говорят по-грузински и по-русски.',
      selectVal: 'Индивидуальные уроки',
      tiers: [
        { name: 'Урок', val: '60 минут' },
        { name: 'Где', val: 'онлайн · Тбилиси · Батуми' },
        { name: 'Язык объяснений', val: 'грузинский и русский' }
      ],
      bullets: [
        'Преподавателя и формат занятий поможет подобрать школа.'
      ]
    },
    'video': {
      badge: 'ПЛАТФОРМА GURUCAN · УРОКИ ПО 15 МИН',
      title: 'Видеокурсы с Тамарой Кавтарадзе',
      lead: 'Короткие видеоуроки с самой Тамарой. Оплата любой картой, можно купить отдельный модуль.',
      selectVal: 'Видеокурсы с Тамарой',
      tiers: [
        { name: 'Курс «Алфавит»', val: 'скидка 50%' },
        { name: '«Gamarjoba Start: Первые шаги»', val: 'с нуля до A1' },
        { name: '«Gamarjoba Plus: Говорю и понимаю»', val: 'A1–B2' },
        { name: 'Один урок', val: 'около 15 минут' }
      ],
      bullets: [
        'Занимайтесь в удобное время в своём темпе.',
        'Цены модулей — в разделе «Магазин».'
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
     3г. МЕНЕДЖЕР ОКОН: открытие по центру, закрытие крестиком, фоном и Esc, возврат фокуса
     -------------------------------------------------------------------------- */
  var openStack = [];
  var lastTrigger = null;
  function focusables(root) {
    return root.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])');
  }
  function openModal(id, trigger) {
    var mb = document.getElementById(id);
    if (!mb) return;
    lastTrigger = trigger || document.activeElement;
    mb.hidden = false;
    document.body.classList.add('is-modal-open');
    openStack.push(mb);
    var inner = mb.querySelector('.tja-modal');
    if (inner) inner.scrollTop = 0;
    var x = mb.querySelector('[data-close]');
    if (x) x.focus({ preventScroll: true });
    if (id === 'tja-m-alpha') alphaOpened();
    playTone(587.33, 0.16, 'sine');
  }
  function closeModal(mb) {
    if (!mb || mb.hidden) return;
    mb.hidden = true;
    var k = openStack.indexOf(mb);
    if (k >= 0) openStack.splice(k, 1);
    if (!openStack.length) document.body.classList.remove('is-modal-open');
    if (mb.id === 'tja-m-alpha') alphaClosed();
    if (lastTrigger && lastTrigger.focus) { try { lastTrigger.focus({ preventScroll: true }); } catch (e) {} }
  }
  function closeAllModals() { while (openStack.length) closeModal(openStack[openStack.length - 1]); }

  var mbs = document.querySelectorAll('.tja-mb');
  for (var mi = 0; mi < mbs.length; mi++) {
    (function (mb) {
      mb.addEventListener('mousedown', function (e) { if (e.target === mb) closeModal(mb); });
      var xs = mb.querySelectorAll('[data-close]');
      for (var xi = 0; xi < xs.length; xi++) xs[xi].addEventListener('click', function () { closeModal(mb); });
      mb.addEventListener('keydown', function (e) {
        if (e.key !== 'Tab') return;
        var f = focusables(mb);
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      });
    })(mbs[mi]);
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && openStack.length) { e.preventDefault(); closeModal(openStack[openStack.length - 1]); }
  });

  var MODAL_IDS = { alpha: 'tja-m-alpha', shop: 'tja-m-shop' };
  var modalTriggers = document.querySelectorAll('[data-open-modal]');
  for (var mt = 0; mt < modalTriggers.length; mt++) {
    modalTriggers[mt].addEventListener('click', function (e) {
      var id = MODAL_IDS[e.currentTarget.getAttribute('data-open-modal')];
      closeMenu();
      openModal(id, e.currentTarget);
    });
  }

  /* окно формата или педагога */
  var drawerBadge = document.getElementById('tja-drawer-badge');
  var drawerTitle = document.getElementById('tja-drawer-title');
  var drawerLead = document.getElementById('tja-drawer-lead');
  var drawerTiers = document.getElementById('tja-drawer-tiers');
  var drawerList = document.getElementById('tja-drawer-list');
  var drawerBookBtn = document.getElementById('tja-drawer-book');
  var activeSelectValue = 'Помогите выбрать формат';

  function openDossier(data, trigger) {
    if (!data) return;
    activeSelectValue = data.selectVal || 'Помогите выбрать формат';
    drawerBadge.textContent = data.badge || '';
    drawerTitle.textContent = data.title || '';
    drawerLead.textContent = data.lead || '';
    drawerLead.hidden = !data.lead;
    var aboutBox = document.getElementById('tja-drawer-about');
    var about = data.about || [];
    aboutBox.hidden = !about.length;
    var aboutText = document.getElementById('tja-drawer-text');
    var aboutPhoto = document.getElementById('tja-drawer-photo');
    if (data.photo) { aboutPhoto.src = data.photo; aboutPhoto.alt = data.title || ''; }
    aboutText.innerHTML = '';
    for (var ap = 0; ap < about.length; ap++) aboutText.appendChild(el('p', null, about[ap]));

    drawerTiers.innerHTML = '';
    var tiers = data.tiers || [];
    for (var t = 0; t < tiers.length; t++) {
      var row = el('div', 'tja-tier-row');
      row.appendChild(el('span', 'tja-tier-row__name', tiers[t].name));
      row.appendChild(el('span', 'tja-tier-row__val', tiers[t].val));
      drawerTiers.appendChild(row);
    }
    drawerList.innerHTML = '';
    var bullets = data.bullets || [];
    for (var b = 0; b < bullets.length; b++) drawerList.appendChild(el('li', null, bullets[b]));
    openModal('tja-m-drawer', trigger);
  }

  /* выбранное направление — в форму и прокрутка к записи */
  function selectCourseAndScroll(courseValue) {
    closeAllModals();
    var selectEl = document.getElementById('tja-select-course');
    if (selectEl && courseValue) {
      for (var i2 = 0; i2 < selectEl.options.length; i2++) {
        if (selectEl.options[i2].value === courseValue) {
          selectEl.selectedIndex = i2;
          selectEl.dispatchEvent(new Event('change', { bubbles: true }));
          break;
        }
      }
    }
    var bookSec = document.getElementById('booking');
    if (bookSec) {
      bookSec.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
      var nameInp = document.getElementById('tja-inp-name');
      if (nameInp) setTimeout(function () { nameInp.focus({ preventScroll: true }); }, 500);
    }
  }

  var courseTriggers = document.querySelectorAll('[data-open-course]');
  for (var ct = 0; ct < courseTriggers.length; ct++) {
    courseTriggers[ct].addEventListener('click', function (e) {
      openDossier(COURSE_DOSSIERS[e.currentTarget.getAttribute('data-open-course')], e.currentTarget);
    });
  }
  var teacherTriggers = document.querySelectorAll('[data-open-teacher]');
  for (var tt = 0; tt < teacherTriggers.length; tt++) {
    teacherTriggers[tt].addEventListener('click', function (e) {
      openDossier(TEACHER_DOSSIERS[e.currentTarget.getAttribute('data-open-teacher')], e.currentTarget);
    });
  }
  if (drawerBookBtn) drawerBookBtn.addEventListener('click', function () { selectCourseAndScroll(activeSelectValue); });
  var bookBtns = document.querySelectorAll('[data-book]');
  for (var bb = 0; bb < bookBtns.length; bb++) {
    bookBtns[bb].addEventListener('click', function (e) { selectCourseAndScroll(e.currentTarget.getAttribute('data-book')); });
  }

  /* «Магазин»: «Заказать» открывает WhatsApp школы с готовой фразой */
  var orderLinks = document.querySelectorAll('[data-order]');
  for (var ol = 0; ol < orderLinks.length; ol++) {
    orderLinks[ol].href = 'https://wa.me/995551160580?text=' + encodeURIComponent('Здравствуйте! Хочу заказать: ' + orderLinks[ol].getAttribute('data-order'));
  }

  /* --------------------------------------------------------------------------
     4. ОТЗЫВЫ: ТРИ НАСТОЯЩИХ С САЙТА ШКОЛЫ (Светлана, Алёна, София) И ТРИ ПРИМЕРА ПО СЛОВУ РОМАНА 04.11
        («только для примера клиента») — ДО ПЕРЕДАЧИ ШКОЛЕ ЗАМЕНИТЬ НАСТОЯЩИМИ
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

  var revStage = document.getElementById('tja-rev-stage');
  var revCount = document.getElementById('tja-rev-count');
  var revBox = document.getElementById('tja-reviews-box');
  var revNodes = [];
  var revIdx = 0, revTimer = null, revHover = false, revVisible = true;
  if (revStage) {
    for (var r = 0; r < REVIEWS.length; r++) {
      var fig = el('figure', 'tja-rev');
      fig.appendChild(el('blockquote', null, REVIEWS[r].text));
      fig.appendChild(el('figcaption', null, REVIEWS[r].author));
      fig.setAttribute('aria-hidden', 'true');
      revStage.appendChild(fig);
      revNodes.push(fig);
    }
  }
  function showReview(idx) {
    if (!revNodes.length) return;
    var prev = revIdx;
    revIdx = (idx + revNodes.length) % revNodes.length;
    for (var n = 0; n < revNodes.length; n++) {
      var node = revNodes[n];
      node.classList.remove('is-out');
      if (n === revIdx) { node.classList.add('is-on'); node.setAttribute('aria-hidden', 'false'); }
      else {
        if (n === prev && prev !== revIdx && !reducedMotion) node.classList.add('is-out');
        node.classList.remove('is-on');
        node.setAttribute('aria-hidden', 'true');
      }
    }
    if (revCount) revCount.textContent = (revIdx + 1) + ' / ' + revNodes.length;
  }
  showReview(0);
  if (revBox && !reducedMotion && revNodes.length > 1) {
    revTimer = setInterval(function () { if (!revHover && revVisible && !document.hidden) showReview(revIdx + 1); }, 5500);
    revBox.addEventListener('pointerenter', function () { revHover = true; });
    revBox.addEventListener('pointerleave', function () { revHover = false; });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { revVisible = en[0].isIntersecting; }, { threshold: 0.2 }).observe(revBox);
  }

  /* --------------------------------------------------------------------------
     5. ФОРМА ЗАПИСИ (активация по чекбоксу, подтверждение на месте)
     -------------------------------------------------------------------------- */
  var consentChk = document.getElementById('tja-consent-chk');
  var submitBtn = document.getElementById('tja-submit-btn');
  var bookingForm = document.getElementById('tja-booking-form');
  var formOk = document.getElementById('tja-form-ok');
  if (consentChk && submitBtn) consentChk.addEventListener('change', function () { submitBtn.disabled = !consentChk.checked; });
  if (bookingForm) {
    bookingForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var nameVal = (document.getElementById('tja-inp-name') || {}).value || 'Гость';
      var courseVal = (document.getElementById('tja-select-course') || {}).value || 'Помогите выбрать формат';
      var contactVal = (document.getElementById('tja-inp-contact') || {}).value || '';
      var channelVal = (document.getElementById('tja-select-channel') || {}).value || 'WhatsApp';
      if (formOk) {
        formOk.hidden = false;
        formOk.textContent = 'გამარჯობა, ' + nameVal + '! Заявка «' + courseVal + '» принята. Школа напишет вам в ' + channelVal + ' (' + contactVal + ') в ближайшее время.';
      }
      playTone(659.25, 0.3, 'triangle');
    });
  }

  /* --------------------------------------------------------------------------
     5б. ВЫПАДАЮЩИЕ СПИСКИ ФОРМЫ — СВОЙ СПИСОК ВМЕСТО СИСТЕМНОЙ ТАБЛИЦЫ (образец — .tja-pick из 9а)
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
     6. МЕНЮ-БУРГЕР (телефон и узкий экран)
     -------------------------------------------------------------------------- */
  var header = document.getElementById('tja-header');
  var burger = document.getElementById('tja-burger');
  function closeMenu() {
    if (!header || !header.classList.contains('is-open')) return;
    header.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Открыть меню');
  }
  if (burger && header) {
    burger.addEventListener('click', function () {
      var open = header.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    });
    header.addEventListener('click', function (e) {
      if (e.target.closest('.tja-panel a')) closeMenu();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
    document.addEventListener('pointerdown', function (e) { if (!e.target.closest('#tja-header')) closeMenu(); });
    window.addEventListener('resize', function () { if (window.innerWidth > 1280) closeMenu(); });
  }

  /* --------------------------------------------------------------------------
     7. МЯГКОЕ ПОЯВЛЕНИЕ БЛОКОВ: прячем только то, что ниже экрана на момент загрузки
     -------------------------------------------------------------------------- */
  var rvs = document.querySelectorAll('.tja-rv');
  if ('IntersectionObserver' in window && !reducedMotion && rvs.length) {
    var vh = window.innerHeight;
    var below = [];
    for (var v = 0; v < rvs.length; v++) {
      if (rvs[v].getBoundingClientRect().top > vh * 0.95) below.push(rvs[v]);
    }
    if (below.length) {
      document.documentElement.classList.add('tja-reveal');
      var rvIo = new IntersectionObserver(function (en) {
        for (var q = 0; q < en.length; q++) {
          if (en[q].isIntersecting) { en[q].target.classList.add('is-in'); rvIo.unobserve(en[q].target); }
        }
      }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
      for (var bi = 0; bi < rvs.length; bi++) {
        if (below.indexOf(rvs[bi]) < 0) rvs[bi].classList.add('is-in');
        else rvIo.observe(rvs[bi]);
      }
    }
  }

  /* --------------------------------------------------------------------------
     8. СВЕТОВОЙ ОТКЛИК (--mx, --my) только у карточки под курсором
     -------------------------------------------------------------------------- */
  if (!reducedMotion && window.matchMedia('(hover: hover)').matches) {
    var spotRaf = 0, spotEv = null;
    document.addEventListener('pointermove', function (e) {
      spotEv = e;
      if (spotRaf) return;
      spotRaf = requestAnimationFrame(function () {
        spotRaf = 0;
        var s = spotEv.target.closest && spotEv.target.closest('.tja-spot');
        if (!s) return;
        var rc = s.getBoundingClientRect();
        s.style.setProperty('--mx', (spotEv.clientX - rc.left) + 'px');
        s.style.setProperty('--my', (spotEv.clientY - rc.top) + 'px');
      });
    }, { passive: true });
  }
})();
