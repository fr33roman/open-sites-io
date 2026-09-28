// «Кисть» — карандашный набросок интерьера на акварельной бумаге: где прошла кисть, проступает цвет акварелью.
// Холст 2D, без WebGL: бумага и набросок считаются из фото один раз; краска — маска из мазков с тёмной каёмкой пигмента.
import { loop, watchSize, css, unsplash, IS_MOBILE, REDUCED } from './core.js';

const PHOTO = 'photo-1615876234886-fd9a39fda97f';   // гостиная: кожаный диван, картины, цветы (Unsplash, бесплатно)
const PAPER = [247, 243, 234];
const LEAD = [62, 64, 74];                            // графит
const IDLE = 11;      // с без касания — и вода «высыхает»
const FADE = 4.6;     // с — цвет уходит обратно в набросок
const HOLD = 2.8;     // с — готовая акварель стоит
const REST = 1.2;     // с — чистый набросок перед новым кругом
const SPACING = 0.15; // шаг отпечатков кисти в долях ширины мазка
const SPR = 128;      // размер заготовок кисти, px

const cvs = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const rnd = (a, b) => a + Math.random() * (b - a);

// размытие «бегущей суммой» по строкам и столбцам: 2–3 прохода дают почти гаусс, цена не зависит от радиуса
function blur(a, w, h, r, tmp, passes) {
  if (r < 1) return a;
  const inv = 1 / (2 * r + 1);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) {
      const o = y * w;
      let s = a[o] * (r + 1);
      for (let i = 1; i <= r; i++) s += a[o + Math.min(i, w - 1)];
      for (let x = 0; x < w; x++) {
        tmp[o + x] = s * inv;
        s += a[o + Math.min(x + r + 1, w - 1)] - a[o + Math.max(x - r, 0)];
      }
    }
    for (let x = 0; x < w; x++) {
      let s = tmp[x] * (r + 1);
      for (let i = 1; i <= r; i++) s += tmp[Math.min(i, h - 1) * w + x];
      for (let y = 0; y < h; y++) {
        a[y * w + x] = s * inv;
        s += tmp[Math.min(y + r + 1, h - 1) * w + x] - tmp[Math.max(y - r, 0) * w + x];
      }
    }
  }
  return a;
}

// шум заданной крупности: белый шум → размытие → среднее 0, разброс 1 (генератор: считается кусками между кадрами)
function* noise(w, h, r, passes, tmp) {
  const n = w * h, a = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = Math.random();
  for (let p = 0; p < passes; p++) { blur(a, w, h, r, tmp, 1); yield; }
  let m = 0, v = 0;
  for (let i = 0; i < n; i++) m += a[i];
  m /= n;
  for (let i = 0; i < n; i++) v += (a[i] - m) * (a[i] - m);
  const k = 1 / (Math.sqrt(v / n) || 1);
  for (let i = 0; i < n; i++) a[i] = (a[i] - m) * k;
  return a;
}
function* blurG(a, w, h, r, tmp, passes) {
  for (let p = 0; p < passes; p++) { blur(a, w, h, r, tmp, 1); yield; }
  return a;
}

// бумага: «зуб» холодного прессования с боковым светом и лёгкой неровностью тона
function* makePaper(w, h, q) {
  const n = w * h, tmp = new Float32Array(n);
  const fine = yield* noise(w, h, Math.max(1, Math.round(0.7 * q)), 1, tmp);
  const tooth = yield* noise(w, h, Math.max(2, Math.round(3 * q)), 2, tmp);
  const low = yield* noise(w, h, Math.max(8, Math.round(Math.min(w, h) / 9)), 3, tmp);
  const hp = new Float32Array(n);
  for (let i = 0; i < n; i++) hp[i] = 0.35 * fine[i] + 0.9 * tooth[i];
  const c = cvs(w, h), g = c.getContext('2d'), im = g.createImageData(w, h), d = im.data;
  for (let i = 0; i < n; i++) {
    const e = hp[i] - hp[Math.min(n - 1, i + w + 1)];          // свет слева сверху: бугорки бумаги
    const s = 1 + 0.02 * e + 0.009 * low[i];
    d[i * 4] = PAPER[0] * s; d[i * 4 + 1] = PAPER[1] * s; d[i * 4 + 2] = PAPER[2] * s; d[i * 4 + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  return { c, hp, low, tmp, w, h };
}

// из фото: карандашный набросок (линии + штриховка по тону), акварельный цвет и его тёмная каёмка, карта интереса
function* makeSketch(img, P) {
  const { w, h, tmp, hp, low } = P, n = w * h, q = w / P.cssW;
  const wk = cvs(w, h), wg = wk.getContext('2d', { willReadFrequently: true });
  const iw = img.naturalWidth, ih = img.naturalHeight, ir = iw / ih, cr = w / h;
  const sw = ir > cr ? ih * cr : iw, sh = ir > cr ? ih : iw / cr;
  wg.drawImage(img, (iw - sw) / 2, (ih - sh) * 0.45, sw, sh, 0, 0, w, h);
  const src = wg.getImageData(0, 0, w, h).data;
  yield;
  const R = new Float32Array(n), G = new Float32Array(n), B = new Float32Array(n), L = new Float32Array(n);
  const hist = new Uint32Array(256);
  for (let i = 0; i < n; i++) {
    R[i] = src[i * 4] / 255; G[i] = src[i * 4 + 1] / 255; B[i] = src[i * 4 + 2] / 255;
    L[i] = 0.3 * R[i] + 0.59 * G[i] + 0.11 * B[i];
    hist[Math.min(255, L[i] * 255 | 0)]++;
  }
  // растянуть яркость по перцентилям: и тёмное, и светлое фото дают одинаково читаемый набросок
  let acc = 0, lo = 0, hi = 255;
  for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc < n * 0.01) lo = i; if (acc < n * 0.985) hi = i; }
  lo /= 255; hi = Math.max(lo + 0.2, hi / 255);
  for (let i = 0; i < n; i++) L[i] = Math.min(1, Math.max(0, (L[i] - lo) / (hi - lo)));
  yield;

  const m = Math.min(w, h);
  const L1 = yield* blurG(L, w, h, Math.max(1, Math.round(0.7 * q)), tmp, 1);
  const Lb = yield* blurG(L1.slice(), w, h, Math.max(1, Math.round(1.6 * q)), tmp, 2);
  const Lb2 = yield* blurG(L1.slice(), w, h, Math.max(3, Math.round(4.5 * q)), tmp, 2);
  const T = yield* blurG(L1.slice(), w, h, Math.max(4, Math.round(m / 60)), tmp, 3);
  const wob1 = yield* noise(w, h, Math.round(26 * q), 2, tmp);
  const wob2 = yield* noise(w, h, Math.round(30 * q), 2, tmp);
  const cr1 = Math.max(1, Math.round(1.3 * q));
  yield* blurG(R, w, h, cr1, tmp, 2);
  yield* blurG(G, w, h, cr1, tmp, 2);
  yield* blurG(B, w, h, cr1, tmp, 2);

  const sk = cvs(w, h), sg = sk.getContext('2d'), sim = sg.createImageData(w, h), sd = sim.data;
  const wcw = cvs(w, h), wcg = wcw.getContext('2d'), wim = wcg.createImageData(w, h), wd = wim.data;
  const rmw = cvs(w, h), rmg = rmw.getContext('2d'), rim = rmg.createImageData(w, h), rd = rim.data;
  const GX = 16, GY = 11, grid = new Float32Array(GX * GY);
  const sp = 4.2 * q, seg = 26 * q;                            // шаг штриховки и длина одного штриха
  const a1 = 1.05, c1 = Math.cos(a1), s1 = Math.sin(a1);      // штрих «/» под ~60°
  const a2 = -0.5, c2 = Math.cos(a2), s2 = Math.sin(a2);      // перекрёстный
  // у каждой линии штриховки свой сдвиг штрихов, длина и нажим — таблицы вместо синусов в каждом пикселе
  const K = Math.ceil((w + h) / sp) + 8, HA = new Float32Array(K * 2), HB = new Float32Array(K * 2), HC = new Float32Array(K * 2);
  for (let k = 0; k < K * 2; k++) { HA[k] = Math.random() * 7; HB[k] = 0.62 + 0.3 * Math.random(); HC[k] = 0.55 + 0.45 * Math.random(); }
  const hatch = (x, y, c, s, step, wob, td) => {
    const u = (x * c + y * s) / step + wob * 0.3, k = Math.floor(u), f = Math.abs(u - k - 0.5) * step, kk = k + K;
    const v = (y * c - x * s) / seg + HA[kk], fv = v - Math.floor(v);
    const on = sstep(0, 0.08, fv) * (1 - sstep(HB[kk], HB[kk] + 0.1, fv));
    return on * HC[kk] * (1 - sstep(0.25 * q + 0.35 * td * q, 0.95 * q + 0.5 * td * q, f));
  };
  const POW = new Float32Array(257);
  for (let i = 0; i <= 256; i++) POW[i] = Math.pow(0.06 + 0.94 * i / 256, 0.9);
  const pw = (v) => POW[Math.max(0, Math.min(256, v * 256 | 0))];
  const sc = 1 / (hi - lo * 0.5);
  for (let y = 0; y < h; y++) {
    if ((y & 15) === 15) yield;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      // контур — разность размытий (DoG): тонкая линия по тёмной стороне края, крупные тёмные места не заливаются
      const line = Math.min(1, sstep(0.018, 0.085, Lb[i] - L1[i]) * 0.85 + sstep(0.05, 0.16, Lb2[i] - L1[i]) * 0.3);
      const td = 1 - T[i];
      const h1 = td > 0.36 ? sstep(0.36, 0.72, td) * hatch(x, y, c1, s1, sp, wob1[i], td) : 0;
      const h2 = td > 0.6 ? sstep(0.6, 0.9, td) * hatch(x, y, c2, s2, sp * 1.2, wob2[i], td) : 0;
      let S = 1 - (1 - line) * (1 - 0.55 * h1) * (1 - 0.45 * h2) * (1 - td * td * 0.16);
      S *= 0.58 + 0.42 * sstep(-1.3, 1.1, hp[i]);                 // графит цепляется за бугорки бумаги
      sd[i * 4] = LEAD[0]; sd[i * 4 + 1] = LEAD[1]; sd[i * 4 + 2] = LEAD[2]; sd[i * 4 + 3] = Math.min(0.9, S) * 255;
      // акварель: светлое и серое остаётся бумагой, цвет сочнее, без чёрного; пигмент гуще во впадинах бумаги
      let r = Math.min(1, (R[i] - lo * 0.5) * sc), g = Math.min(1, (G[i] - lo * 0.5) * sc), b = Math.min(1, (B[i] - lo * 0.5) * sc);
      const l = 0.3 * r + 0.59 * g + 0.11 * b, chr = Math.max(r, g, b) - Math.min(r, g, b);
      r = l + (r - l) * 1.5; g = l + (g - l) * 1.5; b = l + (b - l) * 1.5;
      const wht = sstep(0.62, 0.92, l) * (1 - sstep(0.06, 0.26, chr)) * 0.68;
      const ab = (0.95 + 0.08 * low[i] - 0.07 * hp[i]) * (1 - wht);
      r = 1 - (1 - pw(r)) * ab; g = 1 - (1 - pw(g)) * ab; b = 1 - (1 - pw(b)) * ab;
      wd[i * 4] = r * 255; wd[i * 4 + 1] = g * 255; wd[i * 4 + 2] = b * 255; wd[i * 4 + 3] = 255;
      // каёмка: того же цвета, но гуще — у белого её нет
      rd[i * 4] = (1 - Math.min(1, (1 - r) * 1.7)) * 255; rd[i * 4 + 1] = (1 - Math.min(1, (1 - g) * 1.7)) * 255;
      rd[i * 4 + 2] = (1 - Math.min(1, (1 - b) * 1.7)) * 255; rd[i * 4 + 3] = 255;
      // интерес: цвет и подробности
      grid[Math.min(GY - 1, y * GY / h | 0) * GX + Math.min(GX - 1, x * GX / w | 0)] += chr + line * 0.35;
    }
  }
  sg.putImageData(sim, 0, 0); wcg.putImageData(wim, 0, 0); rmg.putImageData(rim, 0, 0);
  return { sk, wc: wcw, rim: rmw, grid, GX, GY, wd, rd, w, h };
}

// заготовки кисти: неровное пятно с мягкой кромкой и «пятнистостью» пигмента; сухие полосы
function blobSprite() {
  const c = cvs(SPR, SPR), g = c.getContext('2d'), R = SPR * 0.36, o = SPR / 2;
  const harm = [];
  for (let k = 2; k <= 9; k++) harm.push([k, rnd(-1, 1) * 0.17 / Math.sqrt(k), rnd(0, 6.283)]);
  const path = (sc) => {
    g.beginPath();
    for (let i = 0; i <= 96; i++) {
      const a = i / 96 * 6.283;
      let r = 1;
      for (const [k, amp, ph] of harm) r += amp * Math.sin(k * a + ph);
      g.lineTo(o + Math.cos(a) * r * R * sc, o + Math.sin(a) * r * R * sc);
    }
    g.closePath();
  };
  g.fillStyle = '#000';
  g.globalAlpha = 0.4; path(1); g.fill();
  g.globalAlpha = 1; path(0.95); g.fill();
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 12; i++) {
    const x = o + rnd(-0.6, 0.6) * R, y = o + rnd(-0.6, 0.6) * R, r = rnd(0.12, 0.4) * R;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(0,0,0,' + rnd(0.08, 0.22) + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 1; g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return c;
}
function streakSprite() {
  const c = cvs(SPR, SPR), g = c.getContext('2d'), o = SPR / 2, R = SPR * 0.36;
  g.strokeStyle = '#000'; g.lineCap = 'round';
  for (let y = -R; y <= R; y += rnd(3, 7)) {
    g.globalAlpha = rnd(0.25, 0.95) * (1 - Math.abs(y / R) * 0.5);
    g.lineWidth = rnd(1.5, 4.5);
    g.beginPath(); g.moveTo(o - R * rnd(0.6, 1), o + y); g.lineTo(o + R * rnd(0.6, 1), o + y + rnd(-1, 1)); g.stroke();
  }
  return c;
}

export function mount(stage, opts = {}) {
  css('brush', `
    .br-desk{position:absolute;inset:0;background:radial-gradient(120% 95% at 66% 36%,#faf6ef 0%,#f0e9de 52%,#e3dacb 100%)}
    .br-desk::after{content:"";position:absolute;inset:0;opacity:.5;mix-blend-mode:multiply;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .55 0 0 0 0 .5 0 0 0 0 .44 0 0 0 .22 0'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)'/%3E%3C/svg%3E")}
    .br-sheet{position:absolute;z-index:1;background:#f7f3ea;isolation:isolate;touch-action:pan-y;cursor:none;
      box-shadow:0 1px 1px rgba(60,44,24,.1),0 5px 14px -6px rgba(60,44,24,.22),0 26px 50px -24px rgba(60,44,24,.42)}
    .br-cv{position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none}
    .br-sk{opacity:0;transition:opacity 1.4s ease}
    .br-sheet.is-drawn .br-sk{opacity:1}
    .br-pt{mix-blend-mode:multiply}
    .br-tape{position:absolute;width:124px;height:34px;pointer-events:none;
      background:linear-gradient(180deg,rgba(236,226,200,.93),rgba(226,213,182,.9)),repeating-linear-gradient(90deg,rgba(255,255,255,.08) 0 2px,rgba(0,0,0,.03) 2px 5px);
      clip-path:polygon(2% 12%,5% 0,95% 3%,98% 14%,96% 30%,100% 47%,97% 66%,99% 84%,95% 100%,4% 97%,0 82%,3% 64%,0 46%,3% 28%)}
    .br-tape--tl{left:-44px;top:-2px;transform:rotate(-40deg)}
    .br-tape--tr{right:-44px;top:-2px;transform:rotate(40deg)}
    .br-tape--bl{left:-44px;bottom:-2px;transform:rotate(40deg)}
    .br-tape--br{right:-44px;bottom:-2px;transform:rotate(-40deg)}
    .br-tip{position:absolute;left:0;top:0;z-index:4;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;pointer-events:none;
      border:1.5px solid rgba(46,38,30,.5);box-shadow:inset 0 0 0 1px rgba(255,255,255,.35);opacity:0;transition:opacity .25s}
    .br-tip.is-on{opacity:1}
    .br-ui{position:absolute;z-index:6;right:clamp(16px,5vw,64px);top:clamp(80px,12vh,120px);display:flex;gap:8px}
    .br-ui button{font:600 13px/1 Onest,system-ui,sans-serif;padding:9px 14px;border-radius:999px;cursor:pointer;display:flex;align-items:center;gap:8px;
      color:#2b251f;background:rgba(255,252,246,.82);border:1px solid rgba(60,44,24,.16);box-shadow:0 6px 18px -10px rgba(60,44,24,.45);
      backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);transition:background .2s,transform .2s}
    .br-ui button:hover{background:#fffdf8;transform:translateY(-1px)}
    .br-ui button i{width:14px;height:14px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#f2b35c,#d9713b 55%,#6f8f5a 100%)}
    @media (max-width:760px){
      .br-ui{left:16px;right:auto;top:84px}
      .br-ui button{min-height:44px;padding:0 16px}
      .br-tape{width:86px;height:26px}
      .br-tape--tl,.br-tape--bl{left:-30px}.br-tape--tr,.br-tape--br{right:-30px}}
    @media (pointer:coarse){.br-tip{display:none}}
    @media (prefers-reduced-motion:reduce){.br-sk{transition:none}}`);

  const el = (tag, cls) => { const e = document.createElement(tag); e.className = cls; return e; };
  const desk = el('div', 'br-desk'), sheet = el('div', 'br-sheet');
  const cPaper = el('canvas', 'br-cv'), cSketch = el('canvas', 'br-cv br-sk'), cPaint = el('canvas', 'br-cv br-pt');
  sheet.append(cPaper, cSketch, cPaint);
  for (const k of ['tl', 'tr', 'bl', 'br']) sheet.appendChild(el('i', 'br-tape br-tape--' + k));
  const tip = el('div', 'br-tip'), ui = el('div', 'br-ui');
  ui.innerHTML = '<button type="button" data-a="fill"><i></i>Раскрасить всё</button><button type="button" data-a="clear">Чистый лист</button>';
  stage.prepend(desk, sheet);
  stage.append(tip, ui);

  const blobs = Array.from({ length: 7 }, blobSprite), streak = streakSprite();
  let dead = false, ready = false, img = null, SK = null, P = null;
  let SW = 1, SH = 1, SX = 0, SY = 0, TILT = 0, MQ = 1, MW = 1, MH = 1, lastW = 0, lastH = 0, regenT = 0;
  // слои краски (все в размере маски): сухая краска, маска кадра, её размытые копии, каёмка, итог
  let dry, dg, mask, mg, half, hg, quar, qg, rimL, rg, pg, wcM, rimM, erodeT, runL, ug;
  const wet = [], drips = [];
  let dirty = false, painted = false, job = null, mode = 'wait', timer = 0, lastUser = -1e9;

  // ——— лист: справа от подписи на компьютере, в верхних 60 % на телефоне ———
  function layout(w, h) {
    if (w <= 760) {
      SW = w - 32; SX = 16; SY = 136;
      SH = Math.max(220, Math.min(SW * 1.08, h * 0.6 - SY));
      TILT = -0.012;
    } else {
      const fit = (x0, y0, x1, y1) => {
        const rw = x1 - x0, rh = y1 - y0, sw = Math.min(rw, rh * 1.55), sh = Math.min(rh, sw / 1.45);
        return { sw, sh, sx: x0 + (rw - sw) / 2, sy: y0 + (rh - sh) / 2, area: sw * sh };
      };
      const A = fit(Math.max(560, w * 0.39), 118, w - Math.max(56, w * 0.05), h - 64);
      const Bf = fit(64, 118, w - 64, h - 330);
      const f = A.area >= Bf.area ? A : Bf;
      SW = f.sw; SH = f.sh; SX = f.sx; SY = f.sy;
      TILT = -0.018;
    }
    SW = Math.round(SW); SH = Math.round(SH);
    Object.assign(sheet.style, { left: SX + 'px', top: SY + 'px', width: SW + 'px', height: SH + 'px', transform: `rotate(${TILT}rad)` });
  }

  // тяжёлый счёт идёт кусками по ~8 мс между кадрами: страница не замирает; новая задача отменяет старую
  let task = 0, busy = false;
  function run(gen) {
    const id = ++task;
    busy = true;
    const step = () => {
      if (dead || id !== task) return;
      const t0 = performance.now();
      while (performance.now() - t0 < 8) if (gen.next().done) { busy = false; return; }
      setTimeout(step, 0);
    };
    setTimeout(step, 0);
  }

  function* build() {
    const dpr = window.devicePixelRatio || 1;
    const q = Math.min(dpr, IS_MOBILE ? 2 : 1.5);
    const w = Math.round(SW * q), h = Math.round(SH * q);
    const paper = yield* makePaper(w, h, q);
    paper.cssW = SW;
    const mq = Math.min(dpr, 1.5), mw = Math.round(SW * mq), mh = Math.round(SH * mq);
    // пятна «высыхания»: где шум выше, цвет уходит раньше
    const en = yield* noise(mw, mh, Math.max(6, Math.round(mh / 14)), 3, new Float32Array(mw * mh));
    const eT = cvs(mw, mh), eg = eT.getContext('2d'), ei = eg.createImageData(mw, mh);
    for (let i = 0; i < en.length; i++) ei.data[i * 4 + 3] = sstep(-0.6, 1.1, en[i]) * 255;
    eg.putImageData(ei, 0, 0);
    // всё новое подменяется разом, между кадрами
    P = paper; erodeT = eT; MQ = mq; MW = mw; MH = mh;
    cPaper.width = w; cPaper.height = h;
    cPaper.getContext('2d').drawImage(P.c, 0, 0);
    dry = cvs(MW, MH); mask = cvs(MW, MH); rimL = cvs(MW, MH); runL = cvs(MW, MH);
    cPaint.width = MW; cPaint.height = MH;
    dg = dry.getContext('2d'); mg = mask.getContext('2d'); rg = rimL.getContext('2d'); pg = cPaint.getContext('2d'); ug = runL.getContext('2d');
    half = cvs(Math.ceil(MW / 2), Math.ceil(MH / 2)); hg = half.getContext('2d');
    quar = cvs(Math.ceil(MW / 4), Math.ceil(MH / 4)); qg = quar.getContext('2d');
    wet.length = 0; drips.length = 0; job = null; painted = false; ready = false;
    if (img) yield* sketch();
  }

  function* sketch() {
    SK = yield* makeSketch(img, P);
    cSketch.width = P.w; cSketch.height = P.h;
    cSketch.getContext('2d').drawImage(SK.sk, 0, 0);
    wcM = cvs(MW, MH); wcM.getContext('2d').drawImage(SK.wc, 0, 0, MW, MH);
    rimM = cvs(MW, MH); rimM.getContext('2d').drawImage(SK.rim, 0, 0, MW, MH);
    sheet.classList.add('is-drawn');
    ready = true;
    dirty = true;
    if (REDUCED) { runInstant(planPaint()); setMode('user'); }
    else setMode('rest');
  }

  const unwatch = watchSize(stage, (w, h) => {
    if (w === lastW && h === lastH) return;
    const first = !lastW;
    lastW = w; lastH = h;
    layout(w, h);
    clearTimeout(regenT);
    if (first) run(build()); else regenT = setTimeout(() => run(build()), 180);
  });

  const im = new Image();
  im.crossOrigin = 'anonymous';
  im.decoding = 'async';
  // фото пришло: если лист уже готов — рисуем набросок; если бумага ещё считается, задача сама дойдёт до наброска
  im.onload = () => { if (dead) return; img = im; if (P && !busy) run(sketch()); };
  im.src = opts.photo || unsplash(PHOTO, IS_MOBILE ? 1000 : 1600);

  // ——— краска ———
  function put(g, spr, x, y, w, rot, a) {
    const s = w * MQ / (0.72 * SPR), c = Math.cos(rot) * s, n = Math.sin(rot) * s;
    g.globalAlpha = a;
    g.setTransform(c, n, -n, c, x * MQ, y * MQ);
    g.drawImage(spr, -SPR / 2, -SPR / 2);
  }
  // отпечаток кисти: сырой растекается (w0 → w1 за dur), потом «впитывается» в сухой слой
  function dab(x, y, w0, w1, a, rot, spr, dur) {
    painted = true; dirty = true;
    if (REDUCED || !dur) { put(dg, spr, x, y, w1, rot, a); return; }
    wet.push({ x, y, w0, w1, a, rot, spr, dur, t: 0 });
  }
  const newBrush = () => ({ on: false, x: 0, y: 0, w: 0, len: 0, left: 0, ph: rnd(0, 9), lowY: -1, lowX: 0, lowW: 0 });
  function stampAt(b, x, y, w, a, dir, dryK, len) {
    const wv = w * (1 + 0.13 * Math.sin(len * 0.021 + b.ph) + 0.07 * Math.sin(len * 0.067 + b.ph * 2));
    const j = rnd(-0.06, 0.06) * w, px = x - Math.sin(dir) * j, py = y + Math.cos(dir) * j;
    if (dryK < 0.95) dab(px, py, wv, wv * 1.13, a * (1 - dryK * 0.75), rnd(0, 6.283), blobs[Math.random() * blobs.length | 0], 0.85);
    if (dryK > 0.05) dab(px, py, wv, wv * 1.08, a * dryK * 1.2, dir, streak, 0);
    if (py > b.lowY) { b.lowY = py; b.lowX = px; b.lowW = wv; }
    // затёк в сырую бумагу: маленькое пятно у края, растёт дольше основного мазка
    if (!REDUCED && Math.random() < 0.028 && dryK < 0.5) {
      const s = Math.random() < 0.5 ? 1 : -1, k = rnd(0.4, 0.55) * w;
      const bx = px - Math.sin(dir) * k * s, by = py + Math.cos(dir) * k * s, bw = w * rnd(0.3, 0.55);
      dab(bx, by, bw * 0.3, bw, a * 1.3, rnd(0, 6.283), blobs[Math.random() * blobs.length | 0], rnd(1.1, 1.8));
    }
  }
  function brushTo(b, x, y, w, a, dryK) {
    if (!b.on) {
      Object.assign(b, { on: true, x, y, w, len: 0, left: 0, lowY: -1 });
      stampAt(b, x, y, w, a, 0, dryK, 0);
      return;
    }
    const dx = x - b.x, dy = y - b.y, d = Math.hypot(dx, dy);
    if (d < 0.01) return;
    const dir = Math.atan2(dy, dx);
    let s = b.left;
    while (s <= d) {
      const k = s / d, ww = b.w + (w - b.w) * k;
      stampAt(b, b.x + dx * k, b.y + dy * k, ww, a, dir, dryK, b.len + s);
      s += Math.max(0.8, ww * SPACING);
    }
    b.left = s - d; b.len += d; b.x = x; b.y = y; b.w = w;
  }
  // конец мазка: иногда вода собирается внизу и стекает каплей
  function endStroke(b, dripP) {
    if (!b.on) return;
    b.on = false;
    if (b.len > 50 && Math.random() < dripP && b.lowY > 0) drip(b.lowX, b.lowY + b.lowW * 0.3, b.lowW * rnd(0.12, 0.16), b.lowW);
  }
  // капля несёт свой пигмент: цвет берётся из мазка над ней, по светлому месту капля не бежит
  function drip(x, y, w, reach) {
    if (REDUCED || !SK) return;
    const ix = Math.min(SK.w - 1, Math.max(0, x * SK.w / SW | 0)), iy = Math.min(SK.h - 1, Math.max(0, (y - reach * 0.45) * SK.h / SH | 0));
    const j = (iy * SK.w + ix) * 4, c = [0, 1, 2].map((k) => SK.wd[j + k] * 0.5 + SK.rd[j + k] * 0.5);
    if (c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11 > 205) return;
    drips.push({ x, y, w, v: rnd(26, 42), life: rnd(1.5, 2.5), t: 0, ph: rnd(0, 6), col: `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` });
  }
  function blot(x, y) {
    const w = baseW() * 2.1;
    dab(x, y, w * 0.45, w, 0.45, rnd(0, 6.283), blobs[0], 1);
    for (let i = 0; i < 3; i++) dab(x + rnd(-0.2, 0.2) * w, y + rnd(-0.2, 0.2) * w, w * 0.3, w * rnd(0.55, 0.8), 0.3, rnd(0, 6.283), blobs[i + 1], 1.2);
    for (let i = 0; i < 6; i++) {
      const an = rnd(0, 6.283), r = rnd(0.42, 0.6) * w, bw = w * rnd(0.22, 0.4);
      dab(x + Math.cos(an) * r, y + Math.sin(an) * r, bw * 0.2, bw, 0.34, rnd(0, 6.283), blobs[(i + 2) % blobs.length], rnd(1.3, 2));
    }
    if (Math.random() < 0.6) drip(x + rnd(-0.1, 0.1) * w, y + w * 0.42, w * 0.09, w);
    lastUser = performance.now() / 1000;
    if (mode !== 'user') { setMode('user'); job = null; }
  }
  const baseW = () => SH * (IS_MOBILE ? 0.1 : 0.085);

  function updateWet(dt) {
    for (let i = wet.length - 1; i >= 0; i--) {
      const d = wet[i];
      d.t += dt;
      if (d.t >= d.dur) { put(dg, d.spr, d.x, d.y, d.w1, d.rot, d.a); wet[i] = wet[wet.length - 1]; wet.pop(); }
    }
    for (let i = drips.length - 1; i >= 0; i--) {
      const d = drips[i];
      d.t += dt;
      const k = Math.min(1, d.t / d.life), v = d.v * Math.pow(1 - k, 1.6), ny = d.y + v * dt;
      const w = d.w * (1 - 0.45 * k);
      ug.setTransform(MQ, 0, 0, MQ, 0, 0);
      ug.fillStyle = d.col; ug.globalAlpha = 0.22;
      for (let y = d.y; y < ny; y += 0.9) { ug.beginPath(); ug.arc(d.x + Math.sin(y * 0.05 + d.ph) * 0.8, y, w / 2, 0, 6.283); ug.fill(); }
      d.y = ny;
      if (k >= 1) {
        ug.globalAlpha = 0.45; ug.beginPath(); ug.arc(d.x, d.y + w * 0.4, d.w * 0.62, 0, 6.283); ug.fill();    // бусина в конце
        drips[i] = drips[drips.length - 1]; drips.pop();
      }
      ug.setTransform(1, 0, 0, 1, 0, 0); ug.globalAlpha = 1;
    }
    if (wet.length || drips.length) dirty = true;
  }

  // кадр: маска = сухая + сырые отпечатки; каёмка = маска минус её размытая копия; цвет фото по маске + каёмка
  function composite() {
    mg.setTransform(1, 0, 0, 1, 0, 0);
    mg.globalAlpha = 1; mg.globalCompositeOperation = 'copy';
    mg.drawImage(dry, 0, 0);
    mg.globalCompositeOperation = 'source-over';
    for (const d of wet) {
      const k = 1 - Math.pow(1 - Math.min(1, d.t / d.dur), 3);
      put(mg, d.spr, d.x, d.y, d.w0 + (d.w1 - d.w0) * k, d.rot, d.a);
    }
    mg.setTransform(1, 0, 0, 1, 0, 0);
    hg.globalCompositeOperation = 'copy'; hg.drawImage(mask, 0, 0, half.width, half.height);
    qg.globalCompositeOperation = 'copy'; qg.drawImage(half, 0, 0, quar.width, quar.height);
    rg.globalAlpha = 1;
    rg.globalCompositeOperation = 'copy'; rg.drawImage(mask, 0, 0);
    // тонкая тёмная кромка (пигмент стянулся к краю высыхающей лужицы) и широкая мягкая — вместе как у настоящей акварели
    rg.globalCompositeOperation = 'destination-out'; rg.drawImage(half, 0, 0, MW, MH); rg.drawImage(quar, 0, 0, MW, MH);
    rg.globalCompositeOperation = 'source-in'; rg.drawImage(rimM, 0, 0);
    pg.globalAlpha = 1;
    pg.globalCompositeOperation = 'copy'; pg.drawImage(mask, 0, 0);
    pg.globalCompositeOperation = 'source-in'; pg.drawImage(wcM, 0, 0);
    pg.globalCompositeOperation = 'source-over'; pg.drawImage(rimL, 0, 0); pg.globalAlpha = 0.4; pg.drawImage(rimL, 0, 0);
    pg.globalAlpha = 0.9; pg.drawImage(runL, 0, 0);
    pg.globalAlpha = 1;
  }

  function erode(dt, dur) {
    const k = dt / dur;
    for (const g of [dg, ug]) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'destination-out';
      g.globalAlpha = Math.min(1, k * 3); g.drawImage(erodeT, 0, 0);
      g.globalAlpha = Math.min(1, k * 3.4); g.fillRect(0, 0, MW, MH);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    }
    dirty = true;
  }
  function wipe() {
    dg.setTransform(1, 0, 0, 1, 0, 0); dg.clearRect(0, 0, MW, MH); ug.clearRect(0, 0, MW, MH);
    wet.length = 0; drips.length = 0; painted = false; dirty = true;
  }

  // ——— невидимый художник: мазки по плану ———
  function stroke(p0, p3, w, a, v, extra = {}) {
    const bend = extra.bend ?? rnd(-0.3, 0.3) * w;
    const p1 = [p0[0] + (p3[0] - p0[0]) / 3, p0[1] + (p3[1] - p0[1]) / 3 + bend];
    const p2 = [p0[0] + (p3[0] - p0[0]) * 2 / 3, p0[1] + (p3[1] - p0[1]) * 2 / 3 - bend * 0.6];
    const pts = [], cum = [0];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40, u = 1 - t;
      pts.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
        u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]);
      if (i) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    }
    return { pts, cum, len: cum[40], s: 0, j: 0, w, a, v, lift: extra.lift ?? rnd(0.15, 0.35), drip: extra.drip ?? 0.3, dry: extra.dry ?? (Math.random() < 0.5) };
  }
  // композиция «акварельной виньетки»: полосы заливки вокруг самого живого места фото, потом акценты
  function planPaint() {
    const { grid, GX, GY } = SK;
    let best = -1, fx = 0.5, fy = 0.5;
    for (let gy = 0; gy < GY; gy++) for (let gx = 0; gx < GX; gx++) {
      const u = (gx + 0.5) / GX, v = (gy + 0.5) / GY;
      const s = grid[gy * GX + gx] * Math.exp(-((u - 0.55) ** 2) / 0.05 - ((v - 0.5) ** 2) / 0.07);
      if (s > best) { best = s; fx = u; fy = v; }
    }
    fx = Math.min(0.62, Math.max(0.4, fx + rnd(-0.05, 0.05))) * SW;
    fy = Math.min(0.6, Math.max(0.42, fy)) * SH;
    const W0 = SH * (IS_MOBILE ? 0.15 : 0.13), gap = W0 * 0.8, Ay = SH * 0.37, Ax = SW * (IS_MOBILE ? 0.4 : 0.36);
    const v = SW * (IS_MOBILE ? 0.75 : 0.6), out = [];
    let flip = Math.random() < 0.5;
    for (const k of [0, -1, 1, -2, 2, -3, 3]) {
      const dy = k * gap;
      if (Math.abs(dy) > Ay) continue;
      const half = Ax * Math.sqrt(1 - (dy / Ay) ** 2) * rnd(0.82, 1.1) + W0 * 0.3;
      const cx = fx + rnd(-0.05, 0.05) * SW, y = fy + dy + rnd(-0.1, 0.1) * gap, tilt = rnd(-0.1, 0.1) * half;
      let p0 = [Math.max(SW * 0.04, cx - half), y + tilt], p3 = [Math.min(SW * 0.96, cx + half), y - tilt];
      if (flip) [p0, p3] = [p3, p0];
      flip = !flip;
      out.push(stroke(p0, p3, W0 * (1 - 0.07 * Math.abs(k)), 0.3, v));
    }
    // акценты: короткие мазки по самым цветным клеткам вне виньетки
    const cells = [];
    for (let gy = 1; gy < GY - 1; gy++) for (let gx = 1; gx < GX - 1; gx++) {
      const x = (gx + 0.5) / GX * SW, y = (gy + 0.5) / GY * SH;
      const e = ((x - fx) / Ax) ** 2 + ((y - fy) / Ay) ** 2;
      if (e > 0.8 && e < 2.2) cells.push([grid[gy * GX + gx] * rnd(0.7, 1.3), x, y]);
    }
    cells.sort((a, b) => b[0] - a[0]);
    for (const [, x, y] of cells.slice(0, IS_MOBILE ? 2 : 3)) {
      const L = SW * rnd(0.1, 0.16), an = rnd(-0.35, 0.35);
      out.push(stroke([x - Math.cos(an) * L / 2, y - Math.sin(an) * L / 2], [x + Math.cos(an) * L / 2, y + Math.sin(an) * L / 2], W0 * 0.6, 0.28, v * 0.8, { drip: 0.15 }));
    }
    return out;
  }
  // «Раскрасить всё»: широкие быстрые полосы сверху вниз, за край листа
  function planWash() {
    const W = SH * 0.26, out = [];
    let flip = false;
    for (let y = SH * 0.02; y < SH + W * 0.3; y += W * 0.72) {
      let p0 = [-SW * 0.06, y + rnd(-0.1, 0.1) * W], p3 = [SW * 1.06, y + rnd(-0.1, 0.1) * W];
      if (flip) [p0, p3] = [p3, p0];
      flip = !flip;
      out.push(stroke(p0, p3, W, 0.34, SW * 2.6, { lift: 0.03, drip: 0.25, dry: false, bend: rnd(-0.15, 0.15) * W }));
    }
    return out;
  }
  function brushAlong(st, s) {
    while (st.j < 39 && st.cum[st.j + 1] < s) st.j++;
    const i = st.j, k = Math.min(1, (s - st.cum[i]) / ((st.cum[i + 1] - st.cum[i]) || 1));
    return [st.pts[i][0] + (st.pts[i + 1][0] - st.pts[i][0]) * k, st.pts[i][1] + (st.pts[i + 1][1] - st.pts[i][1]) * k];
  }
  function stepStroke(b, st) {
    const u = st.s / st.len;
    const pr = sstep(0, 0.07, u) * (1 - 0.62 * sstep(0.7, 1, u));      // нажим: мягкий вход, сход на нет
    const [x, y] = brushAlong(st, st.s);
    brushTo(b, x, y, st.w * (0.3 + 0.7 * pr), st.a * (1.12 - 0.32 * u), st.dry ? sstep(0.72, 1, u) * 0.85 : 0);
  }
  function runPainter(dt) {
    if (!job || job.done) return;
    if (job.lift > 0) { job.lift -= dt; return; }
    const st = job.list[job.i];
    if (!st) { job.done = true; return; }
    st.s = Math.min(st.len, st.s + st.v * dt);
    stepStroke(job.b, st);
    if (st.s >= st.len) { endStroke(job.b, st.drip); job.i++; job.lift = st.lift; }
  }
  // без движения: тот же план кладётся сразу
  function runInstant(list) {
    const b = newBrush();
    for (const st of list) {
      for (st.s = 0; st.s < st.len; st.s = Math.min(st.len, st.s + 3)) stepStroke(b, st);
      st.s = st.len; stepStroke(b, st);
      endStroke(b, 0);
    }
    dirty = true;
  }

  // ——— круг жизни: рисует → стоит → высыхает → чистый набросок ———
  const setMode = (m) => { mode = m; timer = 0; };
  function machine(dt) {
    timer += dt;
    const now = performance.now() / 1000;
    if (mode === 'rest' && timer > REST) { job = { list: planPaint(), i: 0, lift: 0.2, b: newBrush() }; setMode('auto'); }
    else if (mode === 'auto' && job && job.done) setMode('hold');
    else if (mode === 'hold' && timer > HOLD) setMode('fade');
    else if (mode === 'wash' && job && job.done) { setMode('user'); lastUser = now; }
    else if (mode === 'user' && !user.on && now - lastUser > IDLE) setMode(painted ? 'fade' : 'rest');
    else if (mode === 'fade' || mode === 'clear') {
      const dur = mode === 'clear' ? 0.9 : FADE;
      erode(dt, dur);
      if (timer >= dur) {
        wipe();
        if (mode === 'clear') { setMode('user'); lastUser = now - IDLE + 3.5; } else setMode('rest');
      }
    }
  }

  // ——— человек: мышь красит на ходу, палец — горизонтальным мазком; нажатие — пятно ———
  const user = newBrush();
  let tch = null, down = null, lastTap = null;
  const local = (e) => {
    const r = stage.getBoundingClientRect(), px = e.clientX - r.left - SX - SW / 2, py = e.clientY - r.top - SY - SH / 2;
    const c = Math.cos(TILT), s = Math.sin(TILT);
    return [c * px + s * py + SW / 2, -s * px + c * py + SH / 2];
  };
  const inside = ([x, y]) => x > -6 && y > -6 && x < SW + 6 && y < SH + 6;
  function userPaint([x, y], heavy) {
    if (!ready) return;
    const now = performance.now() / 1000;
    if (!user.on) { user.lt = now; user.lx = x; user.ly = y; user.sp = 0; user.ww = 0; }
    const dtm = Math.max(0.008, now - user.lt);
    user.sp = user.sp * 0.65 + (Math.hypot(x - user.lx, y - user.ly) / dtm) * 0.35;   // сглаженная скорость
    const w = baseW() * Math.min(1.45, Math.max(0.42, 1.45 - user.sp / 1300)) * (heavy ? 1.3 : 1);
    user.ww = user.ww ? user.ww + (w - user.ww) * 0.3 : w * 0.55;                     // мазок начинается тоньше
    brushTo(user, x, y, user.ww, 0.28 * (heavy ? 1.3 : 1), sstep(900, 2400, user.sp) * 0.7);
    user.last = now; user.lt = now; user.lx = x; user.ly = y;
    lastUser = now;
    if (mode !== 'user') { setMode('user'); job = null; }
  }
  const isUi = (e) => e.target.closest && e.target.closest('.br-ui');
  const onMove = (e) => {
    if (isUi(e)) return;
    const L = local(e);
    if (e.pointerType === 'mouse') {
      const on = inside(L) && ready;
      tip.classList.toggle('is-on', on);
      const r = stage.getBoundingClientRect();
      tip.style.transform = `translate3d(${e.clientX - r.left}px,${e.clientY - r.top}px,0) scale(${Math.max(0.5, (user.ww || baseW()) / 40)})`;
      if (on) userPaint(L, e.buttons & 1); else endStroke(user, 0);
      return;
    }
    if (!tch || tch.id !== e.pointerId) return;
    if (tch.dir === '?') {
      const dx = e.clientX - tch.x, dy = e.clientY - tch.y;
      if (Math.hypot(dx, dy) < 9) return;
      tch.dir = Math.abs(dx) > Math.abs(dy) * 0.85 ? 'paint' : 'scroll';
      if (tch.dir === 'paint') userPaint(tch.L, false);
    }
    if (tch.dir === 'paint') userPaint(L, false);
  };
  const onDown = (e) => {
    if (isUi(e) || !ready) return;
    const L = local(e);
    if (!inside(L)) return;
    if (e.pointerType === 'mouse') { if (e.button === 0) down = { x: e.clientX, y: e.clientY, L }; return; }
    tch = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), dir: '?', L };
  };
  const onUp = (e) => {
    const now = performance.now();
    if (e.pointerType === 'mouse') {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6) blot(...down.L);
      down = null;
      return;
    }
    if (!tch || tch.id !== e.pointerId) return;
    if (tch.dir === '?' && now - tch.t < 450) {
      if (lastTap && now - lastTap.t < 330 && Math.hypot(tch.x - lastTap.x, tch.y - lastTap.y) < 50) { lastTap = null; fillAll(); }
      else { blot(...tch.L); lastTap = { t: now, x: tch.x, y: tch.y }; }
    }
    endStroke(user, 0.35);
    tch = null;
  };
  const onCancel = () => { endStroke(user, 0); tch = null; };
  const onLeave = () => { tip.classList.remove('is-on'); endStroke(user, 0); };
  const onDbl = (e) => { if (!isUi(e) && inside(local(e))) fillAll(); };
  stage.addEventListener('pointermove', onMove, { passive: true });
  stage.addEventListener('pointerdown', onDown, { passive: true });
  stage.addEventListener('pointerup', onUp, { passive: true });
  stage.addEventListener('pointercancel', onCancel, { passive: true });
  stage.addEventListener('pointerleave', onLeave, { passive: true });
  stage.addEventListener('dblclick', onDbl);

  function fillAll() {
    if (!ready) return;
    endStroke(user, 0);
    if (REDUCED) { runInstant(planWash()); lastUser = performance.now() / 1000; setMode('user'); return; }
    job = { list: planWash(), i: 0, lift: 0, b: newBrush() };
    setMode('wash');
  }
  const onUi = (e) => {
    const b = e.target.closest('button');
    if (!b || !ready) return;
    if (b.dataset.a === 'fill') fillAll();
    else {
      endStroke(user, 0); job = null;
      if (REDUCED) { wipe(); setMode('user'); } else setMode('clear');
    }
  };
  ui.addEventListener('click', onUi);

  const lp = loop((t, dt) => {
    if (!ready) return;
    if (user.on && performance.now() / 1000 - user.last > 0.16) endStroke(user, 0.12);   // мышь замерла — мазок окончен
    if (!REDUCED) machine(dt);
    runPainter(dt);
    updateWet(dt);
    if (dirty) { composite(); dirty = false; }
  });

  return {
    start: lp.start,
    stop: lp.stop,
    destroy() {
      dead = true;
      lp.stop();
      unwatch();
      clearTimeout(regenT);
      task++;
      im.onload = null;
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerdown', onDown);
      stage.removeEventListener('pointerup', onUp);
      stage.removeEventListener('pointercancel', onCancel);
      stage.removeEventListener('pointerleave', onLeave);
      stage.removeEventListener('dblclick', onDbl);
      ui.removeEventListener('click', onUi);
      for (const c of [cPaper, cSketch, cPaint, dry, mask, half, quar, rimL, runL, wcM, rimM, erodeT]) if (c) c.width = c.height = 0;
      desk.remove(); sheet.remove(); tip.remove(); ui.remove();
      wet.length = 0; drips.length = 0; SK = P = null;
    },
  };
}
