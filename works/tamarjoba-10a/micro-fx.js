/* ==========================================================================
   OPEN-SITES DESIGN KIT — ДВИЖОК МИКРО-ФИЗИКИ И CANVAS-ЭФФЕКТОВ (micro-fx.js)
   0 внешних зависимостей · 60 FPS · Авто-отключение при prefers-reduced-motion
   Поддерживает режимы холста data-canvas-mode="chrono | shockwave | orbits | matrix"
   ========================================================================== */
(function () {
  'use strict';

  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isBot = !!navigator.webdriver;

  /* 1. АВТОЗАПУСК ВИДЕО ТОЛЬКО У ЖИВОГО ПОЛЬЗОВАТЕЛЯ (чтобы не тормозить проверки Chrome) */
  if (!reducedMotion && !isBot) {
    var autoVids = document.querySelectorAll('video[data-autoplay="1"]');
    for (var av = 0; av < autoVids.length; av++) {
      autoVids[av].play().catch(function () {});
    }
  }

  /* 2. СВЕТ ПРОЖЕКТОРА (--mx, --my) + ВОЛНА НА ТЕЛЕФОНЕ ПРИ ПРОКРУТКЕ */
  var spots = document.querySelectorAll('[data-spot], .dk-spot, [class*="-spot"]');
  if (!reducedMotion && spots.length) {
    document.addEventListener('pointermove', function (e) {
      for (var i = 0; i < spots.length; i++) {
        var el = spots[i];
        var r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) continue;
        el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        el.style.setProperty('--my', (e.clientY - r.top) + 'px');
      }
    }, { passive: true });

    window.addEventListener('scroll', function () {
      var sy = window.scrollY || 0;
      var waveX = 50 + Math.sin(sy / 420) * 32;
      for (var i = 0; i < spots.length; i++) {
        var el = spots[i];
        var r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) continue;
        el.style.setProperty('--mx', waveX.toFixed(1) + '%');
        el.style.setProperty('--my', '24%');
      }
    }, { passive: true });
  }

  /* 3. 3D-НАКЛОН КАРТОЧЕК С ПРУЖИННЫМ ВОЗВРАТОМ */
  var tilts = document.querySelectorAll('[data-tilt], .dk-tilt, [class*="-tilt"]');
  if (!reducedMotion && tilts.length) {
    for (var t = 0; t < tilts.length; t++) {
      (function (card) {
        card.addEventListener('pointermove', function (e) {
          var r = card.getBoundingClientRect();
          var px = (e.clientX - r.left) / Math.max(1, r.width) - 0.5;
          var py = (e.clientY - r.top) / Math.max(1, r.height) - 0.5;
          card.style.transform =
            'perspective(900px) rotateX(' + (-py * 7).toFixed(2) + 'deg) rotateY(' + (px * 9).toFixed(2) + 'deg) translateY(-3px)';
        });
        card.addEventListener('pointerleave', function () {
          card.style.transform = '';
        });
      })(tilts[t]);
    }
  }

  /* 4. МАГНИТНЫЕ КНОПКИ (data-magnetic) */
  var magnets = document.querySelectorAll('[data-magnetic]');
  if (!reducedMotion && magnets.length) {
    for (var m = 0; m < magnets.length; m++) {
      (function (btn) {
        btn.addEventListener('pointermove', function (e) {
          var r = btn.getBoundingClientRect();
          var dx = (e.clientX - (r.left + r.width * 0.5)) * 0.22;
          var dy = (e.clientY - (r.top + r.height * 0.5)) * 0.22;
          btn.style.transform = 'translate(' + dx.toFixed(1) + 'px, ' + dy.toFixed(1) + 'px)';
        });
        btn.addEventListener('pointerleave', function () {
          btn.style.transform = '';
        });
      })(magnets[m]);
    }
  }

  /* 5. ПАРАМЕТРИЧЕСКИЙ ХОЛСТ ГЕРОЯ (chrono | shockwave | orbits | matrix) */
  var canvas = document.getElementById('sf-hero-canvas') || document.querySelector('canvas[data-canvas-mode]');
  if (canvas && canvas.getContext && !reducedMotion) {
    var ctx = canvas.getContext('2d');
    var mode = canvas.getAttribute('data-canvas-mode') || 'chrono';
    var accent = canvas.getAttribute('data-accent') || '232, 114, 26';
    var accentHi = canvas.getAttribute('data-accent-hi') || '255, 179, 122';
    var particles = [];
    var waves = [];
    var angle = 0;
    var ptr = { x: 0.5, y: 0.5 };
    var visible = true;

    for (var p = 0; p < 28; p++) {
      particles.push({
        a: (Math.PI * 2 * p) / 28,
        r: 86 + (p % 5) * 28,
        sp: 0.003 + (p % 4) * 0.0014,
        sz: 1.5 + (p % 3) * 1.1
      });
    }

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        visible = entries[0] ? entries[0].isIntersecting : true;
      });
      io.observe(canvas);
    }

    var host = canvas.parentElement || canvas;
    host.addEventListener('pointermove', function (e) {
      var r = canvas.getBoundingClientRect();
      ptr.x = (e.clientX - r.left) / Math.max(1, r.width);
      ptr.y = (e.clientY - r.top) / Math.max(1, r.height);
    }, { passive: true });

    host.addEventListener('pointerdown', function (e) {
      var r = canvas.getBoundingClientRect();
      waves.push({
        x: e.clientX - r.left,
        y: e.clientY - r.top,
        rad: 10,
        alpha: 0.78
      });
    });

    function tick() {
      if (visible) {
        var w = canvas.width;
        var h = canvas.height;
        var cx = w * 0.5 + (ptr.x - 0.5) * 20;
        var cy = h * 0.5 + (ptr.y - 0.5) * 20;
        ctx.clearRect(0, 0, w, h);
        angle += 0.0042;

        if (mode === 'chrono' || mode === 'shockwave') {
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(angle);
          for (var i = 0; i < 60; i++) {
            var a = (Math.PI * 2 * i) / 60;
            var r1 = i % 5 === 0 ? 154 : 162;
            var r2 = 170;
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
            ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
            ctx.strokeStyle = i % 5 === 0 ? 'rgba(' + accent + ', 0.55)' : 'rgba(239, 233, 223, 0.14)';
            ctx.lineWidth = i % 5 === 0 ? 2 : 1;
            ctx.stroke();
          }
          ctx.restore();
        }

        for (var j = 0; j < particles.length; j++) {
          var pt = particles[j];
          pt.a += pt.sp;
          var px = cx + Math.cos(pt.a) * pt.r;
          var py = cy + Math.sin(pt.a) * pt.r;
          ctx.beginPath();
          ctx.arc(px, py, pt.sz, 0, Math.PI * 2);
          ctx.fillStyle = j % 2 === 0 ? 'rgba(' + accentHi + ', 0.65)' : 'rgba(' + accent + ', 0.42)';
          ctx.fill();
        }

        for (var k = waves.length - 1; k >= 0; k--) {
          var wv = waves[k];
          wv.rad += 4.4;
          wv.alpha *= 0.94;
          ctx.beginPath();
          ctx.arc(wv.x, wv.y, wv.rad, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(' + accent + ', ' + wv.alpha.toFixed(3) + ')';
          ctx.lineWidth = 2;
          ctx.stroke();
          if (wv.alpha < 0.04) waves.splice(k, 1);
        }
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
})();
