/* ==========================================================================
   TAMARJOBA — ПРЕСЕТ Б (script.js)
   1. Сборка 3 грузинских слов по буквам (გამარჯობა, მადლობა, საქართველო)
   2. Живая пропись грузинских букв (ა, გ, თ, მ) со стрелками на Canvas
   3. Переворачивающиеся карточки алфавита и форма записи
   ========================================================================== */

(function () {
  'use strict';

  /* ── 1. Плавное появление секций (IntersectionObserver) ── */
  var secs = document.querySelectorAll('.tjb-sec');
  if ('IntersectionObserver' in window && secs.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
        }
      });
    }, { threshold: 0.08 });
    secs.forEach(function (s) { io.observe(s); });
  }

  /* ── 2. Сборка 3 грузинских слов по буквам ── */
  var WORDS = [
    {
      id: 'gamarjoba',
      geo: 'გამარჯობა',
      letters: ['გ', 'ა', 'მ', 'ა', 'რ', 'ჯ', 'ო', 'ბ', 'ა'],
      pool: ['გ', 'ა', 'მ', 'რ', 'ჯ', 'ო', 'ბ', 'ა', 'ა'],
      ru: 'гамарджоба · здравствуйте'
    },
    {
      id: 'madloba',
      geo: 'მადლობა',
      letters: ['მ', 'ა', 'დ', 'ლ', 'ო', 'ბ', 'ა'],
      pool: ['მ', 'ა', 'დ', 'ლ', 'ო', 'ბ', 'ა'],
      ru: 'мадлоба · спасибо'
    },
    {
      id: 'sakartvelo',
      geo: 'საქართველო',
      letters: ['ს', 'ა', 'ქ', 'ა', 'რ', 'თ', 'ვ', 'ე', 'ლ', 'ო'],
      pool: ['ს', 'ა', 'ქ', 'რ', 'თ', 'ვ', 'ე', 'ლ', 'ო', 'ა'],
      ru: 'сакартвело · Грузия'
    }
  ];

  var slotsEl = document.getElementById('tjb-word-slots');
  var poolEl = document.getElementById('tjb-letter-pool');
  var statusEl = document.getElementById('tjb-word-status');
  var resetWordBtn = document.getElementById('tjb-word-reset');
  var wordTabs = document.querySelectorAll('[data-word-idx]');

  var currentWordIdx = 0;
  var currentStep = 0;
  var usedIndices = [];

  function renderWordGame() {
    if (!slotsEl || !poolEl) return;
    var w = WORDS[currentWordIdx];

    /* Отрисовка слотов */
    slotsEl.innerHTML = '';
    for (var i = 0; i < w.letters.length; i++) {
      var slot = document.createElement('span');
      slot.className = 'tjb-slot-char' + (i < currentStep ? ' is-filled' : '');
      slot.textContent = i < currentStep ? w.letters[i] : '·';
      slotsEl.appendChild(slot);
    }

    /* Отрисовка кнопок букв */
    poolEl.innerHTML = '';
    var nextChar = currentStep < w.letters.length ? w.letters[currentStep] : null;
    var highlightedNext = false;

    w.pool.forEach(function (ch, idx) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tjb-letter-btn';
      btn.textContent = ch;
      var isUsed = usedIndices.indexOf(idx) !== -1;
      if (isUsed) {
        btn.disabled = true;
      } else if (ch === nextChar && !highlightedNext) {
        btn.classList.add('is-next');
        highlightedNext = true;
      }
      btn.addEventListener('click', function () {
        if (isUsed || currentStep >= w.letters.length) return;
        if (ch === w.letters[currentStep]) {
          usedIndices.push(idx);
          currentStep++;
          renderWordGame();
        } else if (statusEl) {
          statusEl.textContent = 'Следующая буква в слове — «' + w.letters[currentStep] + '»';
        }
      });
      poolEl.appendChild(btn);
    });

    if (statusEl) {
      if (currentStep >= w.letters.length) {
        statusEl.textContent = 'Собрано слово «' + w.geo + '» (' + w.ru + ')!';
      } else {
        statusEl.textContent = 'Слово «' + w.ru + '» · шаг ' + (currentStep + 1) + ' из ' + w.letters.length;
      }
    }
  }

  if (wordTabs.length) {
    wordTabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var idx = parseInt(tab.getAttribute('data-word-idx'), 10) || 0;
        currentWordIdx = idx;
        currentStep = 0;
        usedIndices = [];
        wordTabs.forEach(function (t) { t.classList.remove('is-active'); });
        tab.classList.add('is-active');
        renderWordGame();
      });
    });
  }

  if (resetWordBtn) {
    resetWordBtn.addEventListener('click', function () {
      currentStep = 0;
      usedIndices = [];
      renderWordGame();
    });
  }

  renderWordGame();

  /* ── 3. Карточки грузинских букв с произношением ── */
  var flipCards = document.querySelectorAll('.tjb-flip-card');
  flipCards.forEach(function (card) {
    card.addEventListener('click', function () {
      card.classList.toggle('is-flipped');
      var label = card.querySelector('.tjb-flip-card__ru');
      if (label) {
        var front = card.getAttribute('data-front');
        var back = card.getAttribute('data-back');
        label.textContent = card.classList.contains('is-flipped') ? back : front;
      }
    });
  });

  /* ── 4. Живая пропись грузинских букв со стрелками на Canvas ── */
  var traceCanvas = document.getElementById('tjb-trace-canvas');
  var traceStatus = document.getElementById('tjb-trace-status');
  var btnAnimate = document.getElementById('tjb-trace-play');
  var btnClear = document.getElementById('tjb-trace-clear');
  var charButtons = document.querySelectorAll('[data-trace-char]');

  var GLYPHS = {
    'ა': {
      name: 'ани (а)',
      pts: [
        [210, 62], [175, 58], [148, 80], [145, 118],
        [160, 162], [198, 190], [248, 188], [278, 160],
        [276, 124], [248, 108], [214, 114]
      ]
    },
    'გ': {
      name: 'гани (г)',
      pts: [
        [176, 54], [228, 54], [250, 82], [220, 112],
        [175, 128], [150, 162], [176, 198], [232, 200],
        [274, 174], [270, 138], [230, 130]
      ]
    },
    'თ': {
      name: 'тани (т)',
      pts: [
        [152, 135], [145, 92], [174, 62], [212, 68],
        [226, 108], [222, 166], [246, 192], [282, 176],
        [292, 124], [276, 74], [242, 64]
      ]
    },
    'მ': {
      name: 'мани (м)',
      pts: [
        [172, 82], [202, 54], [244, 60], [262, 96],
        [258, 152], [234, 194], [190, 196], [156, 168],
        [162, 130], [206, 124], [254, 132]
      ]
    }
  };

  var activeGlyph = 'ა';
  var userStrokes = [];
  var currentStroke = null;
  var animFrameId = null;

  function drawArrowhead(ctx, x1, y1, x2, y2, color) {
    var angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.save();
    ctx.translate(x2, y2);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-10, -5);
    ctx.lineTo(-10, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function renderCanvas(animProgress) {
    if (!traceCanvas) return;
    var ctx = traceCanvas.getContext('2d');
    var W = traceCanvas.width;
    var H = traceCanvas.height;
    ctx.clearRect(0, 0, W, H);

    /* Линейки прописи */
    ctx.strokeStyle = '#E4E4E8';
    ctx.lineWidth = 1;
    [54, 125, 196].forEach(function (y) {
      ctx.beginPath();
      ctx.moveTo(20, y);
      ctx.lineTo(W - 20, y);
      ctx.stroke();
    });

    var g = GLYPHS[activeGlyph] || GLYPHS['ა'];
    var pts = g.pts;

    /* Контур буквы (пунктир + полупрозрачная дорожка) */
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.14)';
    ctx.lineWidth = 22;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    pts.forEach(function (p, i) {
      if (i === 0) ctx.moveTo(p[0], p[1]);
      else ctx.lineTo(p[0], p[1]);
    });
    ctx.stroke();

    ctx.strokeStyle = '#76767E';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.restore();

    /* Направляющие стрелки и стартовая точка */
    ctx.fillStyle = '#FC0304';
    ctx.beginPath();
    ctx.arc(pts[0][0], pts[0][1], 6, 0, Math.PI * 2);
    ctx.fill();

    if (pts.length > 3) {
      drawArrowhead(ctx, pts[1][0], pts[1][1], pts[2][0], pts[2][1], '#B80001');
      drawArrowhead(ctx, pts[5][0], pts[5][1], pts[6][0], pts[6][1], '#B80001');
    }

    /* Анимация показа росчерка */
    if (typeof animProgress === 'number' && animProgress > 0) {
      var maxIdx = Math.min(pts.length - 1, Math.floor(animProgress * (pts.length - 1)));
      ctx.save();
      ctx.strokeStyle = '#FC0304';
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (var k = 0; k <= maxIdx; k++) {
        if (k === 0) ctx.moveTo(pts[k][0], pts[k][1]);
        else ctx.lineTo(pts[k][0], pts[k][1]);
      }
      ctx.stroke();
      ctx.restore();
    }

    /* Пользовательские штрихи тушью #FC0304 */
    ctx.save();
    ctx.strokeStyle = '#FC0304';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    userStrokes.forEach(function (stroke) {
      if (stroke.length < 2) return;
      ctx.beginPath();
      stroke.forEach(function (pt, idx) {
        if (idx === 0) ctx.moveTo(pt[0], pt[1]);
        else ctx.lineTo(pt[0], pt[1]);
      });
      ctx.stroke();
    });
    ctx.restore();
  }

  function getCanvasCoords(e) {
    var rect = traceCanvas.getBoundingClientRect();
    var scaleX = traceCanvas.width / rect.width;
    var scaleY = traceCanvas.height / rect.height;
    return [
      (e.clientX - rect.left) * scaleX,
      (e.clientY - rect.top) * scaleY
    ];
  }

  function evaluateTrace() {
    if (!traceStatus) return;
    var g = GLYPHS[activeGlyph] || GLYPHS['ა'];
    var flat = [];
    userStrokes.forEach(function (s) { flat = flat.concat(s); });
    if (flat.length < 5) return;
    var hits = 0;
    g.pts.forEach(function (target) {
      var close = flat.some(function (u) {
        var dx = u[0] - target[0];
        var dy = u[1] - target[1];
        return Math.sqrt(dx * dx + dy * dy) < 34;
      });
      if (close) hits++;
    });
    var score = Math.min(100, Math.round((hits / g.pts.length) * 100));
    traceStatus.textContent = 'Буква «' + activeGlyph + '» (' + g.name + ') · точность росчерка ' + score + '%';
  }

  if (traceCanvas) {
    traceCanvas.addEventListener('pointerdown', function (e) {
      if (animFrameId) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
      }
      currentStroke = [getCanvasCoords(e)];
      userStrokes.push(currentStroke);
      renderCanvas(0);
    });

    traceCanvas.addEventListener('pointermove', function (e) {
      if (!currentStroke) return;
      currentStroke.push(getCanvasCoords(e));
      renderCanvas(0);
    });

    window.addEventListener('pointerup', function () {
      if (currentStroke) {
        currentStroke = null;
        evaluateTrace();
      }
    });

    renderCanvas(0);
  }

  if (charButtons.length) {
    charButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        activeGlyph = btn.getAttribute('data-trace-char') || 'ა';
        userStrokes = [];
        charButtons.forEach(function (b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        if (traceStatus && GLYPHS[activeGlyph]) {
          traceStatus.textContent = 'Буква «' + activeGlyph + '» (' + GLYPHS[activeGlyph].name + ') · проведите по стрелкам';
        }
        renderCanvas(0);
      });
    });
  }

  if (btnClear) {
    btnClear.addEventListener('click', function () {
      userStrokes = [];
      if (traceStatus && GLYPHS[activeGlyph]) {
        traceStatus.textContent = 'Лист очищен · обведите букву «' + activeGlyph + '»';
      }
      renderCanvas(0);
    });
  }

  if (btnAnimate) {
    btnAnimate.addEventListener('click', function () {
      userStrokes = [];
      var start = performance.now();
      var duration = 1100;
      function step(now) {
        var t = Math.min(1, (now - start) / duration);
        renderCanvas(t);
        if (t < 1) {
          animFrameId = requestAnimationFrame(step);
        } else {
          animFrameId = null;
        }
      }
      animFrameId = requestAnimationFrame(step);
    });
  }

  /* ── 5. Формы записи (включение кнопки при согласии + отправка) ── */
  var forms = document.querySelectorAll('.tjb-booking-form');
  forms.forEach(function (form) {
    var checkbox = form.querySelector('input[type="checkbox"]');
    var submitBtn = form.querySelector('button[type="submit"]');
    var feedback = form.querySelector('.tjb-form-feedback');

    if (checkbox && submitBtn) {
      checkbox.addEventListener('change', function () {
        submitBtn.disabled = !checkbox.checked;
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (feedback) {
        feedback.textContent = 'Заявка принята! Куратор школы Tamarjoba свяжется с вами в ближайшее время.';
      }
      if (submitBtn) {
        submitBtn.textContent = 'Отправлено ✓';
      }
    });
  });
})();
