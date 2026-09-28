// «Физика плашек» — услуги падают круглыми плашками, складываются горкой; их можно хватать и бросать.
// Своя физика на холсте 2D: шаг Верле, несколько подшагов, столкновения кругов, стенки, бросок пальцем.
import { loop, watchSize, css, IS_MOBILE, REDUCED } from './core.js';

const WORDS = ['Силовые', 'Кроссфит', 'Бокс', 'Сайкл', 'Йога', 'Пилатес', 'Стретчинг', 'TRX', 'Функционал', 'Кардио',
  'Персональные', 'Сауна'];   // FORMA: направления клуба (правится только список)
const FILLS = [['#D7FF3F', '#101412'], ['#F8F9F6', '#101412'], ['#8FE3C0', '#101412'], ['#46524A', '#F8F9F6'],
  ['#EDEFEA', '#101412'], ['#5B6A60', '#D7FF3F']];   // FORMA: вольт, мел, мята, графит

export function mount(stage, opts = {}) {
  css('physics', `.ph-cv{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:pan-y;cursor:grab}
    .ph-cv:active{cursor:grabbing}`);
  stage.style.background = 'radial-gradient(70% 60% at 50% 70%, #17132a 0%, #07070a 75%)';
  stage.classList.add('no-shade');
  const cv = document.createElement('canvas');
  cv.className = 'ph-cv';
  stage.prepend(cv);
  const g = cv.getContext('2d');

  let W = 1, H = 1, dpr = 1, scale = 1;
  const bodies = [];
  const font = (s) => `600 ${Math.round(15 * s)}px Rubik, system-ui, sans-serif`;
  const words = WORDS;   // FORMA: все 12 направлений и на телефоне — на арене им хватает места
  const measure = (w) => { g.font = font(scale); return g.measureText(w).width; };

  const unwatch = watchSize(stage, (w, h) => {
    W = w; H = h; dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    scale = Math.max(0.8, Math.min(1.25, w / 1100));
    for (const b of bodies) b.r = Math.max(34 * scale, measure(b.word) / 2 + 16 * scale);
  });

  let spawned = 0, spawnT = 0;
  const spawn = () => {
    const word = words[spawned % words.length];
    const r = Math.max(34 * scale, measure(word) / 2 + 16 * scale);
    const x = W * (0.35 + Math.random() * 0.5), y = -r - 10;
    const [fill, ink] = FILLS[spawned % FILLS.length];
    bodies.push({ word, r, x, y, px: x - (Math.random() - 0.5) * 3, py: y - 2, fill, ink, hot: 0 });
    spawned++;
  };

  // перетаскивание: схваченная плашка тянется к пальцу пружиной, при отпускании летит с его скоростью
  let grab = null, gx = 0, gy = 0, hist = [];
  const at = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const onDown = (e) => {
    const [x, y] = at(e);
    grab = bodies.find((b) => (b.x - x) ** 2 + (b.y - y) ** 2 < b.r * b.r) || null;
    if (grab) { gx = x; gy = y; hist = [[x, y, performance.now()]]; cv.setPointerCapture(e.pointerId); }
  };
  const onMove = (e) => {
    const [x, y] = at(e);
    for (const b of bodies) b.hover = (b.x - x) ** 2 + (b.y - y) ** 2 < b.r * b.r;
    if (!grab) return;
    gx = x; gy = y; hist.push([x, y, performance.now()]); if (hist.length > 5) hist.shift();
  };
  const onUp = () => {
    if (grab && hist.length > 1) {
      const [x0, y0, t0] = hist[0], [x1, y1, t1] = hist[hist.length - 1], dt = Math.max(16, t1 - t0) / 1000;
      grab.px = grab.x - (x1 - x0) / dt / 60; grab.py = grab.y - (y1 - y0) / dt / 60;   // бросок
    }
    grab = null;
  };
  cv.addEventListener('pointerdown', onDown);
  cv.addEventListener('pointermove', onMove);
  cv.addEventListener('pointerup', onUp);
  cv.addEventListener('pointercancel', onUp);

  const SUB = 4, GRAV = 0.32;
  const physics = () => {
    for (let s = 0; s < SUB; s++) {
      for (const b of bodies) {
        const vx = (b.x - b.px) * 0.995, vy = (b.y - b.py) * 0.995;
        b.px = b.x; b.py = b.y;
        b.x += vx; b.y += vy + GRAV / SUB;
        if (b === grab) { b.x += (gx - b.x) * 0.35; b.y += (gy - b.y) * 0.35; }
      }
      for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i], b = bodies[j], dx = b.x - a.x, dy = b.y - a.y, min = a.r + b.r, d2 = dx * dx + dy * dy;
        if (d2 < min * min && d2 > 0.0001) {
          const d = Math.sqrt(d2), push = (min - d) / d * 0.5;
          const ma = a.r * a.r, mb = b.r * b.r, wa = mb / (ma + mb), wb = ma / (ma + mb);   // лёгкая уступает тяжёлой
          a.x -= dx * push * wa * 2; a.y -= dy * push * wa * 2;
          b.x += dx * push * wb * 2; b.y += dy * push * wb * 2;
        }
      }
      for (const b of bodies) {
        const floor = H - 12;
        if (b.y + b.r > floor) { b.y = floor - b.r; const vx = b.x - b.px; b.px = b.x - vx * 0.9; }   // трение о пол
        if (b.x - b.r < 8) b.x = 8 + b.r;
        if (b.x + b.r > W - 8) b.x = W - 8 - b.r;
      }
    }
  };

  const lp = loop((t, dt) => {
    if (spawned < words.length) {
      spawnT -= dt;
      if (REDUCED) { while (spawned < words.length) spawn(); }
      else if (spawnT <= 0) { spawn(); spawnT = 0.14; }
    }
    // шаги физики — по времени, а не по кадрам: на слабом телефоне плашки не падают «замедленно»
    const n = REDUCED && !grab ? 20 : Math.max(1, Math.min(4, Math.round((dt || 0.0167) * 60)));
    for (let i = 0; i < n; i++) physics();
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = font(scale);
    for (const b of bodies) {
      b.hot += ((b.hover || b === grab ? 1 : 0) - b.hot) * 0.2;
      g.save();
      g.translate(b.x, b.y);
      g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 18; g.shadowOffsetY = 8;
      g.fillStyle = b.fill;
      g.beginPath(); g.arc(0, 0, b.r * (1 + b.hot * 0.06), 0, Math.PI * 2); g.fill();
      g.shadowColor = 'transparent';
      if (b.hot > 0.05) { g.strokeStyle = `rgba(255,255,255,${b.hot * 0.8})`; g.lineWidth = 2; g.stroke(); }
      g.fillStyle = b.ink;
      g.fillText(b.word, 0, 1);
      g.restore();
    }
  });

  return {
    start: lp.start, stop: lp.stop,
    destroy() {
      lp.stop(); unwatch(); cv.remove();
      ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'].forEach((ev, i) => cv.removeEventListener(ev, [onDown, onMove, onUp, onUp][i]));
    },
  };
}
