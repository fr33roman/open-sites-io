/* dofamart · Акции — «Город» в 3D (19.11, этап 3). Сцена на three.js (vendor/three.min.js, грузится лениво).
   Только отрисовка, камера и ввод: данные, правила и действия приходят от gorod.js через api A.
   Модели: процедурные (кирпичики в коде) + текстуры, нарисованные на canvas (окна, вывески). Все здания сливаются в несколько больших сеток
   по кварталам карты; окна — наклейки-фасады одной сеткой; огни и машины — инстансами. Кадр по требованию: рендер идёт, только пока что-то
   движется (камера, призрак); лёгкая «жизнь» города (машины, блики воды, мигающие окна) — по таймеру 18–24 к/с, только пока карта видна, и выключается кнопкой.
   Раздел закрыт или вкладка скрыта — сцена освобождается (dispose). */
(function (root) {
'use strict';
let loading = null, inst = null, A = null, pendBox = null;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function loadThree() {
  if (root.THREE) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = 'vendor/three.min.js?v=158';
    s.onload = () => (root.THREE ? res() : rej(new Error('no THREE')));
    s.onerror = () => { loading = null; rej(new Error('load')); };
    document.head.appendChild(s);
  });
  return loading;
}
let glOk = null;
function canGL() {
  if (glOk !== null) return glOk;
  try { const c = document.createElement('canvas'); glOk = !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { glOk = false; }
  return glOk;
}
const rgbVar = n => {
  const m = (getComputedStyle(document.documentElement).getPropertyValue(n) || '').match(/\d+/g);
  return m && m.length >= 3 ? (+m[0] << 16) | (+m[1] << 8) | +m[2] : null;
};
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const css = n => '#' + ('000000' + n.toString(16)).slice(-6);
// габариты рисунка каждого здания (ширина, глубина) в его собственных единицах — по ним фигура вписывается в площадь w×d клеток
const DIM = { kiosk: [1.25, 1.1], exch: [1.6, 1.1], dc: [1.4, 1.0], hall: [1.7, 1.3], bank: [1.55, 1.3], lab: [1.7, 1.1], fund: [1.7, 1.1], tower: [1.3, 1.3], inst: [1.65, 1.55], obs: [1.6, 1.6],
  vend: [1.5, 0.8], atm: [1.3, 1.3], pay: [1.6, 0.9], broker: [1.9, 1.1], vc: [1.2, 1.2], home: [1.3, 1.1], cowork: [1.5, 1.2], mall: [1.9, 1.2], park: [0.9, 0.9], fountain: [1.5, 1.5], port: [1.9, 1.2], maglev: [1.95, 1.1] };
const LH = l => 1 + 0.17 * (l - 1);
const CHW = 12, CHD = 10;       // размер куска карты для отсечения
const ICON = { coin: 16, server: 17, anchor: 18, leaf: 19, train: 20, flask: 21, bag: 22, drop: 23, rocket: 24, people: 25, cap: 26, case: 27, pillars: 28, globe: 29, star: 30, clock: 31, chart: 0, bars: 1, dollar: 2, swap: 3, atm: 4, bank: 5, shop: 6, pay: 7, line: 8, vc: 9, home: 10, stripe: 11, maglev: 12, solid: 13, cloud: 14, glow: 15 };

function build(box) {
  const THREE = root.THREE, MP = A.map, W = MP.W, D = MP.D, HH = MP.HILL_H, mob = window.matchMedia && matchMedia('(max-width:700px)').matches;
  const C1 = rgbVar('--acc') || 0x22e3ff, C2 = rgbVar('--acc2') || 0x786eff, BG = 0x050a14;
  const rootEl = document.createElement('div'); rootEl.className = 'gr3-root';
  const canvas = document.createElement('canvas'); canvas.setAttribute('aria-label', A.label || '3D'); canvas.setAttribute('role', 'img');
  rootEl.appendChild(canvas);
  const tagBox = document.createElement('div'); tagBox.className = 'gr3-tags'; rootEl.appendChild(tagBox);
  const R = new THREE.WebGLRenderer({ canvas: canvas, antialias: !mob, alpha: false, powerPreference: 'default' });
  R.setPixelRatio(Math.min(window.devicePixelRatio || 1, mob ? 1.5 : 2)); R.setClearColor(BG, 1); R.info.autoReset = false;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(BG); scene.fog = new THREE.FogExp2(0x112247, 0.0105);
  const cam = new THREE.PerspectiveCamera(38, 1, 0.5, 220);
  const amb = new THREE.AmbientLight(0x6f94c0, 0.8), hemi = new THREE.HemisphereLight(0x5ac8ff, 0x20104a, 0.55), sun = new THREE.DirectionalLight(0xffffff, 0.95);
  sun.position.set(5, 9, 6); scene.add(amb); scene.add(hemi); scene.add(sun);
  const disp = [];                                      // всё, что надо освободить при закрытии
  const keep = o => { disp.push(o); return o; };

  /* --- шаблоны геометрии: массивы вершин, из которых собираются большие сетки --- */
  const tpl = {};
  function TP(key, mk) {
    if (tpl[key]) return tpl[key];
    const g = mk().toNonIndexed(), e = new THREE.EdgesGeometry(g, 20);
    tpl[key] = { pos: g.attributes.position.array, nor: g.attributes.normal.array, lpos: e.attributes.position.array }; g.dispose(); e.dispose(); return tpl[key];
  }
  const BOX = () => TP('box', () => new THREE.BoxGeometry(1, 1, 1));
  const CYL = n => TP('cyl' + n, () => new THREE.CylinderGeometry(0.5, 0.5, 1, n));
  const CONE = n => TP('cone' + n, () => new THREE.CylinderGeometry(0, 0.5, 1, n));
  const PYR = () => TP('pyr', () => { const g = new THREE.CylinderGeometry(0, 0.5, 1, 4); g.rotateY(Math.PI / 4); return g; });
  const DOME = () => TP('dome', () => new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2));
  const SPH = () => TP('sph', () => new THREE.SphereGeometry(0.5, 6, 4));
  const TOR = () => TP('tor', () => new THREE.TorusGeometry(0.5, 0.035, 3, 20));
  const FRU = () => TP('fru', () => { const g = new THREE.BoxGeometry(1, 1, 1), p = g.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) { p.setX(i, p.getX(i) * 0.857); p.setZ(i, p.getZ(i) * 0.833); } g.computeVertexNormals(); return g; });
  const PLN = () => new THREE.PlaneGeometry(1, 1);
  const WEDGE = () => TP('wedge', () => { const g = new THREE.BoxGeometry(1, 1, 1), p = g.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) > 0 && p.getX(i) > 0) p.setY(i, -0.2); g.computeVertexNormals(); return g; });     // односкатная крыша: высоко слева, низко справа
  const GABLE = () => TP('gable', () => { const g = new THREE.BoxGeometry(1, 1, 1), p = g.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setX(i, 0); g.computeVertexNormals(); return g; });                       // двускатная: конёк вдоль z
  const ARC = () => TP('arc', () => new THREE.TorusGeometry(0.5, 0.075, 4, 16, Math.PI));

  const _v = new THREE.Vector3(), _n3 = new THREE.Matrix3();
  function Batch() { this.p = []; this.n = []; this.c = []; this.lp = []; this.lc = []; }
  Batch.prototype.add = function (t, m, col, lcol) {
    _n3.getNormalMatrix(m); const P = t.pos, N = t.nor;
    for (let i = 0; i < P.length; i += 3) {
      _v.set(P[i], P[i + 1], P[i + 2]).applyMatrix4(m); this.p.push(_v.x, _v.y, _v.z);
      _v.set(N[i], N[i + 1], N[i + 2]).applyMatrix3(_n3).normalize(); this.n.push(_v.x, _v.y, _v.z); this.c.push(col.r, col.g, col.b);
    }
    if (lcol) { const L = t.lpos; for (let i = 0; i < L.length; i += 3) { _v.set(L[i], L[i + 1], L[i + 2]).applyMatrix4(m); this.lp.push(_v.x, _v.y, _v.z); this.lc.push(lcol.r, lcol.g, lcol.b); } }
  };
  // QB — наклейки (фасады, вывески, ореолы): четырёхугольники с текстурными координатами
  function QB() { this.p = []; this.u = []; this.c = []; }
  const _a = new THREE.Vector3();
  QB.prototype.q = function (M, x, y, z, ux, uy, uz, vx, vy, vz, u0, v0, u1, v1, col) {
    const P = [[x, y, z, u0, v0], [x + ux, y + uy, z + uz, u1, v0], [x + ux + vx, y + uy + vy, z + uz + vz, u1, v1], [x + vx, y + vy, z + vz, u0, v1]];
    [0, 1, 2, 0, 2, 3].forEach(k => { const q = P[k]; _a.set(q[0], q[1], q[2]).applyMatrix4(M); this.p.push(_a.x, _a.y, _a.z); this.u.push(q[3], q[4]); this.c.push(col.r, col.g, col.b); });
  };
  function geoOf(pos, nor, col) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); if (nor) g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeBoundingSphere(); return g;
  }
  function geoQ(b) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(b.u, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(b.c, 3)); g.computeBoundingSphere(); return g;
  }

  /* --- текстуры, нарисованные на canvas: окна (повторяются), вывески (атлас 4×4), блики воды --- */
  const winC = document.createElement('canvas'); winC.width = winC.height = 128;
  (function () {
    const x = winC.getContext('2d'), r = rng(77), cell = 16; x.fillStyle = '#081224'; x.fillRect(0, 0, 128, 128);
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
      const v = r(), px = i * cell, py = j * cell;
      x.fillStyle = '#0c1a30'; x.fillRect(px + 1, py + 1, cell - 2, cell - 2);
      const col = v < 0.2 ? '#ffd48a' : v < 0.42 ? '#bff4ff' : v < 0.5 ? '#b7a8ff' : v < 0.72 ? '#14365a' : '#0c2240';
      x.fillStyle = col; x.fillRect(px + 3, py + 3, cell - 6, cell - 7);
      if (v < 0.5) { x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(px + 3, py + 3, cell - 6, 2); }
      x.fillStyle = '#2a4a74'; x.fillRect(px + 2, py + 1, cell - 4, 2);                        // перемычка над окном
      x.fillStyle = '#1a3358'; x.fillRect(px + 2, py + cell - 4, cell - 4, 2);                  // подоконник
      if (v > 0.82) { x.fillStyle = '#0a1830'; x.fillRect(px + cell / 2 - 1, py + 3, 2, cell - 7); }   // импост в части окон
    }
    for (let i = 0; i < 8; i++) { const px = i * cell;                                           // ряды-ленты: непрерывное остекление и тёплая полоса (ритм этажей)
      x.fillStyle = '#0b2a4a'; x.fillRect(px, 3 * cell + 3, cell, cell - 6); x.fillStyle = i % 4 === 3 ? '#ffd48a' : '#4aa8d8'; x.fillRect(px + 1, 3 * cell + 5, cell - 2, 4); x.fillStyle = '#2a4a74'; x.fillRect(px, 3 * cell + 3, cell, 1);
      x.fillStyle = '#16294a'; x.fillRect(px, 6 * cell + 6, cell, 3); x.fillStyle = 'rgba(255,200,120,.35)'; x.fillRect(px, 6 * cell + 7, cell, 1); }
  })();
  const winTex = keep(new THREE.CanvasTexture(winC)); winTex.wrapS = winTex.wrapT = THREE.RepeatWrapping; winTex.colorSpace = THREE.SRGBColorSpace; winTex.anisotropy = 4;
  // три других материала фасада: стекло с отражением неба, тёмный металл с полосами окон, светлый камень с арочными окнами (клетка 16×16, 8×8 — как у обычных окон)
  const mkFac = (seed, drawCell) => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d'), r = rng(seed); for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { x.save(); x.translate(i * 16, j * 16); x.beginPath(); x.rect(0, 0, 16, 16); x.clip(); drawCell(x, r(), r(), j); x.restore(); }
    const t = keep(new THREE.CanvasTexture(cv)); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  const glassTex = mkFac(31, (x, v, v2, j) => { const g = x.createLinearGradient(0, 0, 0, 16); g.addColorStop(0, v < 0.18 ? '#ffe3a6' : '#4fb4e6'); g.addColorStop(0.55, v < 0.18 ? '#e8b868' : '#1f6fa0'); g.addColorStop(1, '#0d3556'); x.fillStyle = '#05182a'; x.fillRect(0, 0, 16, 16); x.fillStyle = g; x.fillRect(1, 1, 14, 14);
    x.fillStyle = 'rgba(255,255,255,' + (0.1 + v2 * 0.26).toFixed(2) + ')'; x.beginPath(); x.moveTo(1, 1); x.lineTo(10, 1); x.lineTo(1, 11); x.fill(); if (v2 > 0.7) { x.fillStyle = 'rgba(220,250,255,.35)'; x.fillRect(11, 2, 2, 12); } });
  const metalTex = mkFac(47, (x, v, v2) => { x.fillStyle = '#0b1322'; x.fillRect(0, 0, 16, 16); x.fillStyle = '#1b2640'; x.fillRect(0, 0, 16, 1); x.fillRect(0, 0, 1, 16); x.fillStyle = '#070d19'; x.fillRect(0, 15, 16, 1);
    x.fillStyle = v < 0.24 ? '#ffd48a' : v < 0.5 ? '#bff4ff' : v < 0.7 ? '#14365a' : '#0d2644'; x.fillRect(1, 5, 14, 5); x.fillStyle = 'rgba(255,255,255,.22)'; x.fillRect(1, 5, 14, 1); if (v2 < 0.12) { x.fillStyle = '#ff7090'; x.fillRect(2, 12, 2, 2); } });
  const stoneTex = mkFac(53, (x, v, v2) => { x.fillStyle = '#cbd6ea'; x.fillRect(0, 0, 16, 16); x.fillStyle = '#9aa8c2'; x.fillRect(0, 15, 16, 1); x.fillRect(15, 0, 1, 16); x.fillStyle = '#e9f0fb'; x.fillRect(0, 0, 16, 1);
    x.fillStyle = v < 0.34 ? '#ffd48a' : '#1d2c4a'; x.beginPath(); x.moveTo(5, 13); x.lineTo(5, 6); x.arc(8, 6, 3, Math.PI, 0); x.lineTo(11, 13); x.closePath(); x.fill(); x.fillStyle = 'rgba(255,255,255,.3)'; x.fillRect(5, 12, 6, 1); });
  const sgC = document.createElement('canvas'); sgC.width = 256; sgC.height = 512;
  (function () {
    const x = sgC.getContext('2d'), S = 64, cy = '#22e3ff', vi = '#9a90ff', wm = '#ffd98a', gr = '#38f0a0', rd = '#ff6a84';
    const cell = (i, fn) => { x.save(); x.translate((i % 4) * S, Math.floor(i / 4) * S); x.beginPath(); x.rect(0, 0, S, S); x.clip(); x.fillStyle = '#06101f'; x.fillRect(0, 0, S, S); fn(); x.restore(); };
    const txt = (t, sz, col, yy) => { x.fillStyle = col; x.font = '800 ' + sz + 'px Arial,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t, S / 2, yy || S / 2); };
    const frame = col => { x.strokeStyle = col; x.lineWidth = 3; x.strokeRect(3, 3, S - 6, S - 6); };
    cell(0, () => { frame(cy); [[10, 40, 30, 1], [20, 30, 44, 0], [30, 36, 22, 1], [40, 22, 38, 0], [50, 28, 14, 1]].forEach(k => { x.fillStyle = k[3] ? gr : rd; x.fillRect(k[0] - 2, k[2] - 4, 4, k[1] - k[2] + 8 > 0 ? 8 : 8); x.fillRect(k[0] - 4, Math.min(k[1], k[2]), 8, Math.abs(k[1] - k[2]) + 4); x.fillRect(k[0] - 0.5, Math.min(k[1], k[2]) - 6, 1.5, Math.abs(k[1] - k[2]) + 16); }); });
    cell(1, () => { frame(vi); [14, 24, 20, 34, 44].forEach((h, i) => { x.fillStyle = i % 2 ? cy : vi; x.fillRect(9 + i * 10, 56 - h, 7, h); }); });
    cell(2, () => { frame(wm); txt('$', 46, wm, 34); });
    cell(3, () => { frame(cy); x.strokeStyle = cy; x.lineWidth = 4; x.beginPath(); x.moveTo(12, 24); x.lineTo(50, 24); x.lineTo(42, 16); x.moveTo(50, 24); x.lineTo(42, 32); x.moveTo(52, 42); x.lineTo(14, 42); x.lineTo(22, 34); x.moveTo(14, 42); x.lineTo(22, 50); x.stroke(); });
    cell(4, () => { frame(gr); txt('ATM', 24, gr); });
    cell(5, () => { frame(wm); txt('BANK', 19, wm); });
    cell(6, () => { frame(vi); x.strokeStyle = vi; x.lineWidth = 4; x.strokeRect(16, 26, 32, 26); x.beginPath(); x.arc(32, 26, 9, Math.PI, 0); x.stroke(); });
    cell(7, () => { frame(cy); x.fillStyle = cy; x.fillRect(12, 20, 40, 24); x.fillStyle = '#06101f'; x.fillRect(12, 26, 40, 5); txt('PAY', 14, '#bff8ff', 52); });
    cell(8, () => { frame(gr); x.strokeStyle = gr; x.lineWidth = 4; x.beginPath(); x.moveTo(8, 50); x.lineTo(22, 38); x.lineTo(32, 44); x.lineTo(46, 22); x.lineTo(56, 14); x.stroke(); });
    cell(9, () => { frame(vi); x.fillStyle = vi; x.beginPath(); x.moveTo(32, 12); x.lineTo(50, 50); x.lineTo(14, 50); x.closePath(); x.fill(); txt('VC', 16, '#06101f', 40); });
    cell(10, () => { frame(wm); x.strokeStyle = wm; x.lineWidth = 4; x.beginPath(); x.moveTo(12, 34); x.lineTo(32, 16); x.lineTo(52, 34); x.moveTo(18, 32); x.lineTo(18, 52); x.lineTo(46, 52); x.lineTo(46, 32); x.stroke(); });
    cell(11, () => { x.fillStyle = cy; for (let i = -2; i < 8; i++) { x.beginPath(); x.moveTo(i * 12, 0); x.lineTo(i * 12 + 7, 0); x.lineTo(i * 12 + 7 + 64, 64); x.lineTo(i * 12 + 64, 64); x.fill(); } });
    cell(12, () => { frame(cy); x.strokeStyle = cy; x.lineWidth = 5; [10, 24, 38].forEach(o => { x.beginPath(); x.moveTo(o, 18); x.lineTo(o + 14, 32); x.lineTo(o, 46); x.stroke(); }); });
    cell(13, () => { x.fillStyle = '#bff8ff'; x.fillRect(0, 0, S, S); });
    cell(14, () => { frame(vi); txt('24/7', 20, vi); });
    cell(15, () => { x.clearRect(0, 0, S, S); const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.4)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, S, S); });
    const W2 = '#ffffff', st = (lw, fn) => { x.strokeStyle = W2; x.fillStyle = W2; x.lineWidth = lw; x.lineCap = 'round'; x.lineJoin = 'round'; fn(); };
    cell(16, () => { frame(W2); st(4, () => { x.beginPath(); x.arc(32, 32, 19, 0, 6.3); x.stroke(); x.beginPath(); x.arc(32, 32, 12, 0, 6.3); x.stroke(); }); txt('$', 24, W2, 33); });
    cell(17, () => { frame(W2); st(3, () => { [14, 28, 42].forEach(yy => { x.strokeRect(12, yy, 40, 10); x.beginPath(); x.arc(18, yy + 5, 1.6, 0, 6.3); x.fill(); x.moveTo(30, yy + 5); x.lineTo(46, yy + 5); x.stroke(); }); }); });
    cell(18, () => { frame(W2); st(4, () => { x.beginPath(); x.arc(32, 15, 5, 0, 6.3); x.stroke(); x.beginPath(); x.moveTo(32, 20); x.lineTo(32, 50); x.moveTo(23, 28); x.lineTo(41, 28); x.moveTo(13, 38); x.quadraticCurveTo(18, 52, 32, 50); x.quadraticCurveTo(46, 52, 51, 38); x.stroke(); }); });
    cell(19, () => { frame(W2); st(3, () => { x.beginPath(); x.moveTo(14, 48); x.quadraticCurveTo(10, 16, 50, 14); x.quadraticCurveTo(54, 50, 14, 48); x.fill(); x.strokeStyle = '#06101f'; x.beginPath(); x.moveTo(16, 46); x.lineTo(40, 24); x.stroke(); }); });
    cell(20, () => { frame(W2); st(3, () => { x.beginPath(); x.moveTo(14, 44); x.lineTo(14, 26); x.quadraticCurveTo(14, 16, 26, 16); x.lineTo(46, 16); x.quadraticCurveTo(52, 18, 52, 28); x.lineTo(52, 44); x.closePath(); x.stroke(); x.fillRect(20, 22, 14, 9); x.fillRect(38, 22, 8, 9); x.beginPath(); x.moveTo(8, 52); x.lineTo(56, 52); x.stroke(); }); });
    cell(21, () => { frame(W2); st(3, () => { x.beginPath(); x.moveTo(26, 12); x.lineTo(38, 12); x.moveTo(28, 12); x.lineTo(28, 28); x.lineTo(14, 50); x.lineTo(50, 50); x.lineTo(36, 28); x.lineTo(36, 12); x.stroke(); x.fillRect(22, 40, 20, 6); x.beginPath(); x.arc(32, 33, 2.2, 0, 6.3); x.fill(); }); });
    cell(22, () => { frame(W2); st(3, () => { x.fillRect(16, 24, 32, 26); x.strokeStyle = W2; x.beginPath(); x.arc(32, 24, 9, Math.PI, 0); x.stroke(); }); });
    cell(23, () => { frame(W2); st(3, () => { x.beginPath(); x.moveTo(32, 10); x.quadraticCurveTo(50, 32, 46, 42); x.quadraticCurveTo(42, 54, 32, 54); x.quadraticCurveTo(22, 54, 18, 42); x.quadraticCurveTo(14, 32, 32, 10); x.fill(); }); });
    cell(24, () => { frame(W2); st(3, () => { x.beginPath(); x.moveTo(32, 8); x.quadraticCurveTo(46, 22, 42, 40); x.lineTo(22, 40); x.quadraticCurveTo(18, 22, 32, 8); x.fill(); x.beginPath(); x.moveTo(22, 34); x.lineTo(12, 48); x.lineTo(24, 42); x.moveTo(42, 34); x.lineTo(52, 48); x.lineTo(40, 42); x.fill(); x.beginPath(); x.moveTo(28, 46); x.lineTo(32, 56); x.lineTo(36, 46); x.stroke(); x.fillStyle = '#06101f'; x.beginPath(); x.arc(32, 24, 4, 0, 6.3); x.fill(); }); });
    cell(25, () => { frame(W2); st(3, () => { [[22, 40], [42, 40]].forEach(q => { x.beginPath(); x.arc(q[0], 24, 7, 0, 6.3); x.fill(); x.beginPath(); x.arc(q[0], 52, 12, Math.PI, 0); x.fill(); }); }); });
    cell(26, () => { frame(W2); st(3, () => { x.beginPath(); x.moveTo(32, 14); x.lineTo(54, 26); x.lineTo(32, 38); x.lineTo(10, 26); x.closePath(); x.fill(); x.beginPath(); x.moveTo(20, 34); x.lineTo(20, 44); x.quadraticCurveTo(32, 52, 44, 44); x.lineTo(44, 34); x.stroke(); x.beginPath(); x.moveTo(54, 26); x.lineTo(54, 42); x.stroke(); }); });
    cell(27, () => { frame(W2); st(3, () => { x.strokeRect(12, 24, 40, 26); x.strokeRect(25, 15, 14, 9); x.beginPath(); x.moveTo(12, 36); x.lineTo(52, 36); x.stroke(); x.fillRect(28, 33, 8, 7); }); });
    cell(28, () => { frame(W2); st(3, () => { x.beginPath(); x.moveTo(10, 24); x.lineTo(32, 11); x.lineTo(54, 24); x.closePath(); x.fill(); [16, 26, 38, 48].forEach(xx => { x.beginPath(); x.moveTo(xx, 28); x.lineTo(xx, 46); x.stroke(); }); x.fillRect(10, 48, 44, 5); }); });
    cell(29, () => { frame(W2); st(3, () => { x.beginPath(); x.arc(32, 32, 20, 0, 6.3); x.stroke(); x.beginPath(); x.ellipse(32, 32, 9, 20, 0, 0, 6.3); x.stroke(); x.beginPath(); x.moveTo(12, 32); x.lineTo(52, 32); x.moveTo(15, 22); x.lineTo(49, 22); x.moveTo(15, 42); x.lineTo(49, 42); x.stroke(); }); });
    cell(30, () => { frame(W2); st(2, () => { x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 9 : 21; x[i ? 'lineTo' : 'moveTo'](32 + Math.cos(a) * r, 34 + Math.sin(a) * r); } x.closePath(); x.fill(); }); });
    cell(31, () => { frame(W2); st(4, () => { x.beginPath(); x.arc(32, 32, 20, 0, 6.3); x.stroke(); x.beginPath(); x.moveTo(32, 32); x.lineTo(32, 18); x.moveTo(32, 32); x.lineTo(43, 38); x.stroke(); }); });
  })();
  const sgTex = keep(new THREE.CanvasTexture(sgC)); sgTex.colorSpace = THREE.SRGBColorSpace; sgTex.anisotropy = 4;
  const uvOf = i => { const c = i % 4, r = Math.floor(i / 4); return [c / 4 + 0.006, 1 - (r + 1) / 8 + 0.003, (c + 1) / 4 - 0.006, 1 - r / 8 - 0.003]; };

  const shC = document.createElement('canvas'); shC.width = shC.height = 64;
  (function () { const x = shC.getContext('2d'), g = x.createRadialGradient(32, 32, 4, 32, 32, 31); g.addColorStop(0, 'rgba(0,0,0,.95)'); g.addColorStop(0.45, 'rgba(0,0,0,.6)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); })();
  const shTex = keep(new THREE.CanvasTexture(shC));
  const matBody = keep(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x0b1a30 }));
  const matLine = keep(new THREE.LineBasicMaterial({ vertexColors: true }));
  const matBright = keep(new THREE.MeshBasicMaterial({ vertexColors: true }));
  const matBeam = keep(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending }));
  const matFac = keep(new THREE.MeshBasicMaterial({ map: winTex, vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }));
  const mkMat = t => keep(new THREE.MeshBasicMaterial({ map: t, vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }));
  const matFacG = mkMat(glassTex), matFacM = mkMat(metalTex), matFacS = mkMat(stoneTex);
  const matSign = keep(new THREE.MeshBasicMaterial({ map: sgTex, vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -3 }));
  const matHalo = keep(new THREE.MeshBasicMaterial({ map: sgTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  const matGB = keep(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.42, depthWrite: false }));
  const matGL = keep(new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95 }));
  const col = h => new THREE.Color(h);
  // общий патч шейдера: затемнение у основания фасада (ложное затенение) и мягкий градиент по высоте; «окно» постройки (срез по высоте внутри коробки здания) и вспышка улучшения
  const UN = { cb: { value: new THREE.Vector4(0, 0, 0, 0) }, cy: { value: 99 }, fl: { value: 0 }, flc: { value: new THREE.Color(C1) } };
  function patch(m, ao) {
    m.onBeforeCompile = sh => {
      sh.uniforms.uCb = UN.cb; sh.uniforms.uCy = UN.cy; sh.uniforms.uFl = UN.fl; sh.uniforms.uFlc = UN.flc;
      sh.vertexShader = 'varying vec3 vWp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vec4 _w4 = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\n _w4 = instanceMatrix * _w4;\n#endif\n vWp = (modelMatrix * _w4).xyz;');
      let f = 'varying vec3 vWp; uniform vec4 uCb; uniform float uCy; uniform float uFl; uniform vec3 uFlc;\n' + sh.fragmentShader;
      f = f.replace('void main() {', 'void main() {\n bool inb = vWp.x > uCb.x && vWp.x < uCb.z && vWp.z > uCb.y && vWp.z < uCb.w;\n if (inb && vWp.y > uCy) discard;');
      f = f.replace('#include <opaque_fragment>', (ao ? ' outgoingLight *= mix(0.46, 1.0, smoothstep(0.02, 0.85, vWp.y)) * (0.9 + 0.14 * smoothstep(0.8, 3.4, vWp.y));\n' : '') + ' if (inb) outgoingLight += uFlc * uFl;\n#include <opaque_fragment>');
      sh.fragmentShader = f;
    };
    m.customProgramCacheKey = () => 'g4' + (ao ? 'a' : 'n');
  }
  [matBody, matLine, matFac, matFacG, matFacM, matFacS].forEach(m => patch(m, true)); [matBright, matSign].forEach(m => patch(m, false));
  const matShad = keep(new THREE.MeshBasicMaterial({ map: shTex, color: 0x000000, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  const K = {                                              // цвета
    body: col(0x10213b), body2: col(0x1a1744), pad: col(0x0c182c), hill: col(0x0b2a38), hill2: col(0x0a1d30), rock: col(0x0d1830),
    e1: col(C1), e2: col(C2), dim: col(C1).multiplyScalar(0.34), hillE: col(C2).multiplyScalar(0.6),
    glow: col(0xbff8ff), beam: col(C1), warm: col(0xffd98a), white: col(0xe8f8ff), red: col(0xff5a72),
    ok: col(0x1ccf8a), okE: col(0x7dffc8), bad: col(0xd8334f), badE: col(0xff8aa0), tree: col(0x0d3a3a), tree2: col(0x14304a)
  };
  const NEON = [null, K.e1.clone(), K.e2.clone().lerp(col(0xffffff), 0.25), K.warm, K.white];
  const wx = cx => cx - W / 2, wz = cz => cz - D / 2;
  const elevAt = (cx, cz) => (MP.T[Math.floor(cz) * W + Math.floor(cx)] === 3 ? HH : 0);
  let dimK = 0, dimT = 0;                                  // «тень»: 0 — день работы, 1 — стройка (всё, кроме подходящих клеток, уходит в тень)

  /* --- земля: одна плоскость с нарисованной картой (кварталы, дороги с разметкой, площадь, холм, вода, закрытые районы) --- */
  const MG = 18, GWc = W + 2 * MG, GDc = D + 2 * MG, TS = mob ? 18 : 24, gc = document.createElement('canvas'); gc.width = GWc * TS; gc.height = GDc * TS;
  const gx = gc.getContext('2d'), gtex = keep(new THREE.CanvasTexture(gc)); gtex.anisotropy = 4; gtex.colorSpace = THREE.SRGBColorSpace;
  const RX = [11, 23], RZ = [7, 15, 24], ROADZ = 25;      // дороги карты: столбцы RX (до строки ROADZ), строки RZ — на всю ширину
  const isRoad = (c, z) => c >= 0 && z >= 0 && c < W && z < D && MP.T[z * W + c] === 1;
  const lamps = [];                                        // позиции фонарей вдоль дорог (в клетках)
  RZ.forEach(z => { for (let c = 1; c < W; c += 3) { if (RX.indexOf(c) >= 0 || RX.indexOf(c + 1) >= 0 || RX.indexOf(c - 1) >= 0) continue; lamps.push([c + 0.5, z + 0.04], [c + 1.5, z + 0.96]); } });
  RX.forEach(c => { for (let z = 1; z < ROADZ; z += 3) { if (RZ.indexOf(z) >= 0 || RZ.indexOf(z + 1) >= 0 || RZ.indexOf(z - 1) >= 0) continue; lamps.push([c + 0.04, z + 0.5], [c + 0.96, z + 1.5]); } });
  const quay = []; for (let c = 1.5; c < W - 0.5; c += 3) quay.push([c, 26.82]);          // огни набережной
  function paintGround() {
    const x = gx, P = c => c * TS, o = MG, doors = A.districts(), r0 = rng(404), S27 = P(o + 27), cw = gc.width;
    const rdA = (c, z) => (c >= 0 && z >= 0 && c < W && z < D) ? MP.T[z * W + c] === 1 : ((RZ.indexOf(z) >= 0 && z < 27) || (RX.indexOf(c) >= 0 && z <= ROADZ));
    x.fillStyle = '#050a14'; x.fillRect(0, 0, cw, gc.height);
    // вода: глубокий градиент, береговая пена, блики
    const sea = x.createLinearGradient(0, S27, 0, gc.height); sea.addColorStop(0, '#0b4666'); sea.addColorStop(0.12, '#083a58'); sea.addColorStop(0.5, '#062a45'); sea.addColorStop(1, '#040f1e'); x.fillStyle = sea; x.fillRect(0, S27, cw, gc.height - S27);
    for (let k = 0; k < 6; k++) { const yy = S27 + (k + 0.5) * TS * 0.55; const g2 = x.createLinearGradient(0, yy, 0, yy + TS * 0.4); g2.addColorStop(0, 'rgba(120,225,255,.10)'); g2.addColorStop(1, 'rgba(120,225,255,0)'); x.fillStyle = g2; x.fillRect(0, yy, cw, TS * 0.4); }
    // земля: плитка кварталов. Площадка — вставка с угловыми метками, у дорог — тротуар, в районе «Холм» — газон; за краем карты те же кварталы и продолжения дорог (приглушённые)
    const sw = TS * 0.2;
    for (let j = 0; j < o + 27; j++) for (let i = 0; i < GWc; i++) {
      const c = i - o, z = j - o, px = P(i), pz = P(j), inside = c >= 0 && c < W && z >= 0, t = inside ? MP.T[z * W + c] : 0;
      if (rdA(c, z)) { x.fillStyle = '#070c19'; x.fillRect(px, pz, TS, TS); if (r0() < 0.4) { x.fillStyle = 'rgba(130,170,230,.05)'; x.fillRect(px + r0() * TS, pz + r0() * TS, 3, 1.5); } continue; }
      const di = inside ? MP.DM[z * W + c] : -1, hill = t === 3, grass = inside && di === 4 && !hill, plaza = t === 4;
      x.fillStyle = hill ? '#0c2d38' : plaza ? '#112f52' : grass ? '#0a2a2c' : ((c + z) & 1 ? '#0b1a33' : '#0a172e'); x.fillRect(px, pz, TS, TS);
      if (!hill && !plaza) {
        x.fillStyle = grass ? '#0d3a36' : inside ? '#0e2142' : '#0a1a36'; x.fillRect(px + 2, pz + 2, TS - 4, TS - 4);
        if (grass) { x.strokeStyle = 'rgba(70,220,150,.30)'; x.lineWidth = 1; x.beginPath(); for (let k = 0; k < 7; k++) { const bx = px + 3 + r0() * (TS - 6), by = pz + 5 + r0() * (TS - 8); x.moveTo(bx, by); x.lineTo(bx + (r0() - 0.5) * 2, by - 2.5 - r0() * 2); } x.stroke(); }
        else { x.fillStyle = css(C1) + (inside ? '30' : '18'); [[2, 2], [TS - 5, 2], [2, TS - 5], [TS - 5, TS - 5]].forEach(q => { x.fillRect(px + q[0], pz + q[1], 3, 1); x.fillRect(px + q[0] + 1, pz + q[1] - 1, 1, 3); });
          if (inside && r0() < 0.3) { x.fillStyle = 'rgba(160,200,255,.05)'; x.fillRect(px + 4 + r0() * (TS - 12), pz + 4 + r0() * (TS - 12), 5, 5); } }
        const tints = ['', 'rgba(60,110,255,.06)', 'rgba(150,80,255,.06)', 'rgba(30,220,200,.06)', 'rgba(120,255,180,.0)', 'rgba(255,200,100,.05)'];
        if (di > 0 && tints[di]) { x.fillStyle = tints[di]; x.fillRect(px, pz, TS, TS); }
      }
      x.fillStyle = '#1a3558';                                                                         // тротуар вдоль дороги
      if (rdA(c, z - 1)) x.fillRect(px, pz, TS, sw); if (rdA(c, z + 1)) x.fillRect(px, pz + TS - sw, TS, sw); if (rdA(c - 1, z)) x.fillRect(px, pz, sw, TS); if (rdA(c + 1, z)) x.fillRect(px + TS - sw, pz, sw, TS);
    }
    // набережная: каменная полоса вдоль воды
    x.fillStyle = '#12274a'; x.fillRect(0, S27 - TS * 0.3, cw, TS * 0.3); x.fillStyle = 'rgba(120,200,255,.35)'; x.fillRect(0, S27 - TS * 0.3, cw, 1.5);
    // свет фонарей на земле: тёплые пятна и бирюзовая кайма
    lamps.forEach(l => { const gcx = P(o + l[0]), gcz = P(o + l[1]), gr = x.createRadialGradient(gcx, gcz, 0, gcx, gcz, TS * 1.7); gr.addColorStop(0, 'rgba(255,214,150,.26)'); gr.addColorStop(0.5, css(C1) + '14'); gr.addColorStop(1, css(C1) + '00'); x.fillStyle = gr; x.fillRect(gcx - TS * 1.7, gcz - TS * 1.7, TS * 3.4, TS * 3.4); });
    quay.forEach(q => { const gcx = P(o + q[0]), gcz = P(o + q[1]), gr = x.createRadialGradient(gcx, gcz, 0, gcx, gcz, TS * 2); gr.addColorStop(0, 'rgba(255,214,150,.32)'); gr.addColorStop(1, 'rgba(255,214,150,0)'); x.fillStyle = gr; x.fillRect(gcx - TS * 2, gcz - TS * 2, TS * 4, TS * 4); });
    // перекрёстки ярче
    RX.forEach(c => RZ.forEach(z => { if (z > 24) return; const gcx = P(o + c + 0.5), gcz = P(o + z + 0.5), gr = x.createRadialGradient(gcx, gcz, 0, gcx, gcz, TS * 2.2); gr.addColorStop(0, css(C1) + '30'); gr.addColorStop(1, css(C1) + '00'); x.fillStyle = gr; x.fillRect(gcx - TS * 2.2, gcz - TS * 2.2, TS * 4.4, TS * 4.4); }));
    // дороги: светящиеся бордюры (мягкий ореол + яркая линия), осевая разметка, зебры
    const curb = (lw, a) => { x.strokeStyle = css(C1) + a; x.lineWidth = lw; x.beginPath();
      for (let j = 0; j < o + 27; j++) for (let i = 0; i < GWc; i++) { const c = i - o, z = j - o; if (!rdA(c, z)) continue; const px = P(i), pz = P(j);
        if (!rdA(c, z - 1)) { x.moveTo(px, pz + 1); x.lineTo(px + TS, pz + 1); } if (!rdA(c, z + 1) && z < 26) { x.moveTo(px, pz + TS - 1); x.lineTo(px + TS, pz + TS - 1); }
        if (!rdA(c - 1, z)) { x.moveTo(px + 1, pz); x.lineTo(px + 1, pz + TS); } if (!rdA(c + 1, z)) { x.moveTo(px + TS - 1, pz); x.lineTo(px + TS - 1, pz + TS); } }
      x.stroke(); };
    curb(7, '1c'); curb(2, 'cc');
    x.strokeStyle = 'rgba(255,217,138,.62)'; x.setLineDash([TS * .42, TS * .34]); x.lineWidth = 2; x.beginPath();
    RX.forEach(c => { x.moveTo(P(o + c) + TS / 2, 0); x.lineTo(P(o + c) + TS / 2, P(o + ROADZ)); });
    RZ.forEach(z => { x.moveTo(0, P(o + z) + TS / 2); x.lineTo(cw, P(o + z) + TS / 2); });
    x.stroke(); x.setLineDash([]);
    x.fillStyle = 'rgba(232,248,255,.62)';
    RX.forEach(c => RZ.forEach(z => { if (z > 24) return; for (let k = 0; k < 5; k++) { const a = P(o + c) + 3 + k * (TS - 6) / 5, b = P(o + z) + 3 + k * (TS - 6) / 5;
      x.fillRect(a, P(o + z - 1) + 3, 2.5, TS - 6); x.fillRect(a, P(o + z + 1) + 3, 2.5, TS - 6); x.fillRect(P(o + c - 1) + 3, b, TS - 6, 2.5); x.fillRect(P(o + c + 1) + 3, b, TS - 6, 2.5); } }));
    // стоп-линии перед «зеброй» (по полосам движения справа), стрелки на полосах и люки
    x.fillStyle = 'rgba(240,250,255,.85)'; const sl = TS * 0.1;
    RX.forEach(c => RZ.forEach(z => { if (z > 24) return;
      x.fillRect(P(o + c - 1.2), P(o + z + 0.52), sl, P(0.46)); x.fillRect(P(o + c + 2.1), P(o + z + 0.02), sl, P(0.46));           // горизонтальная дорога: на восток (нижняя полоса), на запад (верхняя)
      x.fillRect(P(o + c + 0.02), P(o + z - 1.2), P(0.46), sl); x.fillRect(P(o + c + 0.52), P(o + z + 2.1), P(0.46), sl); }));           // вертикальная: на юг (левая полоса), на север (правая)
    x.fillStyle = 'rgba(225,240,255,.4)'; const arrow = (ax, az, dx, dz) => { x.beginPath(); x.moveTo(ax + dx * TS * 0.22, az + dz * TS * 0.22); x.lineTo(ax - dx * TS * 0.1 - dz * TS * 0.11, az - dz * TS * 0.1 + dx * TS * 0.11); x.lineTo(ax - dx * TS * 0.1 + dz * TS * 0.11, az - dz * TS * 0.1 - dx * TS * 0.11); x.closePath(); x.fill(); x.fillRect(ax - dx * TS * 0.34 - Math.abs(dz) * TS * 0.03, az - dz * TS * 0.34 - Math.abs(dx) * TS * 0.03, Math.abs(dx) * TS * 0.26 + Math.abs(dz) * TS * 0.06, Math.abs(dz) * TS * 0.26 + Math.abs(dx) * TS * 0.06); };
    RX.forEach(c => RZ.forEach(z => { if (z > 24) return;
      arrow(P(o + c - 2.35), P(o + z + 0.68), 1, 0); arrow(P(o + c + 3.35), P(o + z + 0.32), -1, 0); arrow(P(o + c + 0.32), P(o + z - 2.35), 0, 1); arrow(P(o + c + 0.68), P(o + z + 3.35), 0, -1); }));
    x.fillStyle = 'rgba(140,175,225,.30)'; x.strokeStyle = 'rgba(180,220,255,.28)'; x.lineWidth = 1; const rm = rng(808);
    for (let k = 0; k < 46; k++) { const c = Math.floor(rm() * W), z = Math.floor(rm() * 25); if (!rdA(c, z) || (RX.indexOf(c) < 0 && RZ.indexOf(z) < 0)) continue; if (RX.indexOf(c) >= 0 && RZ.indexOf(z) >= 0) continue;
      const hx = RZ.indexOf(z) >= 0; x.beginPath(); x.arc(P(o + c) + TS * (hx ? 0.5 : 0.5 + (rm() < 0.5 ? 0.2 : -0.2)), P(o + z) + TS * (hx ? 0.5 + (rm() < 0.5 ? 0.2 : -0.2) : 0.5), TS * 0.1, 0, 6.3); x.fill(); x.stroke(); }
    // береговая линия: пена и подсветка
    x.strokeStyle = css(C1) + 'cc'; x.lineWidth = 3; x.beginPath(); x.moveTo(0, S27); x.lineTo(cw, S27); x.stroke();
    x.strokeStyle = 'rgba(220,250,255,.35)'; x.lineWidth = 2; x.beginPath(); for (let i = 0; i <= 160; i++) { const xx = i * cw / 160, yy = S27 + 6 + Math.sin(i * 0.55) * 2.2; i ? x.lineTo(xx, yy) : x.moveTo(xx, yy); } x.stroke();
    x.strokeStyle = 'rgba(120,200,255,.16)'; x.lineWidth = 1.5; for (let k = 0; k < 14; k++) { const zz = P(o + 28.4 + k * 0.9); x.beginPath(); for (let i = 0; i <= 80; i++) { const xx = i * cw / 80, yy = zz + Math.sin(i * 0.9 + k) * 2.2; i ? x.lineTo(xx, yy) : x.moveTo(xx, yy); } x.stroke(); }
    // площадь: плитка шахматкой, кольца, лучи, знак в центре
    const pcx = P(o + 15.5), pcz = P(o + 11.5);
    for (let z = 8; z <= 14; z++) for (let c = 12; c <= 18; c++) { x.fillStyle = (c + z) & 1 ? '#173a60' : '#112f52'; x.fillRect(P(o + c), P(o + z), TS, TS); }
    x.strokeStyle = css(C1) + '99'; x.lineWidth = 2; [1.4, 2.4, 3.2].forEach(r => { x.beginPath(); x.arc(pcx, pcz, r * TS, 0, 6.2832); x.stroke(); });
    x.strokeStyle = css(C1) + '55'; x.lineWidth = 1.5; x.beginPath(); for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8; x.moveTo(pcx + Math.cos(a) * 1.4 * TS, pcz + Math.sin(a) * 1.4 * TS); x.lineTo(pcx + Math.cos(a) * 3.2 * TS, pcz + Math.sin(a) * 3.2 * TS); } x.stroke();
    x.strokeStyle = css(C1) + '77'; x.lineWidth = 2; x.strokeRect(P(o + 12) + 2, P(o + 8) + 2, TS * 7 - 4, TS * 7 - 4);
    x.fillStyle = css(C1) + '33'; x.beginPath(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + Math.PI / 8, r = k % 2 ? 0.7 : 1.15; x.lineTo(pcx + Math.cos(a) * r * TS, pcz + Math.sin(a) * r * TS); } x.closePath(); x.fill();
    // холм: мягкое тёмное основание под рельефом
    x.fillStyle = 'rgba(5,10,20,.5)'; x.fillRect(P(o + 26.5), P(o - 0.5), TS * 9, TS * 8);
    // край карты: рамка и затухание наружу
    x.strokeStyle = css(C1) + '77'; x.lineWidth = 2; x.strokeRect(P(o) + 1, P(o) + 1, P(W) - 2, P(27) - 2);
    const fd = (a, b, c2, d2, sx, sy, ex, ey) => { const g4 = x.createLinearGradient(sx, sy, ex, ey); g4.addColorStop(0, 'rgba(5,10,20,0)'); g4.addColorStop(1, 'rgba(5,10,20,.92)'); x.fillStyle = g4; x.fillRect(a, b, c2, d2); };
    fd(0, 0, cw, P(o) - 1, 0, P(o), 0, 0); fd(0, P(o), P(o), P(27), P(o), 0, 0, 0); fd(P(o + W), P(o), cw - P(o + W), P(27), P(o + W), 0, cw, 0);
    // закрытые районы: «спящий» квартал — тёмный, с голографической сеткой и пунктирной рамкой (объёмный контур будущей застройки — отдельная сетка линий, paintSleep)
    doors.forEach(d => { if (d.open) return; const r = MP.DIST[d.id];
      for (let z = r.z0; z <= r.z1; z++) for (let c = r.x0; c <= r.x1; c++) { if (MP.DM[z * W + c] !== d.id) continue; x.fillStyle = 'rgba(3,6,16,.8)'; x.fillRect(P(o + c), P(o + z), TS, TS); x.fillStyle = css(C2) + '44'; x.fillRect(P(o + c) - 1, P(o + z) - 1, 3, 1); x.fillRect(P(o + c), P(o + z) - 2, 1, 3); }
      x.strokeStyle = css(C2) + '30'; x.lineWidth = 1; x.beginPath();
      for (let z = r.z0; z <= r.z1; z++) for (let c = r.x0; c <= r.x1; c++) if (MP.DM[z * W + c] === d.id && ((c + z) % 2 === 0)) { x.moveTo(P(o + c), P(o + z + 1)); x.lineTo(P(o + c + 1), P(o + z)); }
      x.stroke();
      x.strokeStyle = css(C2) + 'aa'; x.lineWidth = 2; x.setLineDash([TS * .5, TS * .3]); x.strokeRect(P(o + r.x0) + 2, P(o + r.z0) + 2, P(r.x1 - r.x0 + 1) - 4, P(r.z1 - r.z0 + 1) - 4); x.setLineDash([]); });
    gtex.needsUpdate = true;
  }
  /* сетка клеток — отдельная плоскость: видна только в режиме стройки (в обычном еле заметна) */
  const grc = document.createElement('canvas'); grc.width = W * TS; grc.height = D * TS;
  (function () { const x = grc.getContext('2d'); x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 1; x.beginPath();
    for (let z = 0; z < D; z++) for (let c = 0; c < W; c++) { const t = MP.T[z * W + c]; if (t === 1 || t === 2) continue; const px = c * TS, pz = z * TS; x.moveTo(px + .5, pz); x.lineTo(px + .5, pz + TS); x.moveTo(px, pz + .5); x.lineTo(px + TS, pz + .5); }
    x.stroke(); })();
  const grTex = keep(new THREE.CanvasTexture(grc)); grTex.anisotropy = 4; grTex.colorSpace = THREE.SRGBColorSpace;
  const gridMesh = new THREE.Mesh(keep(new THREE.PlaneGeometry(W, D)), keep(new THREE.MeshBasicMaterial({ map: grTex, color: C1, transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })));
  gridMesh.rotation.x = -Math.PI / 2; gridMesh.position.set(0, 0.006, 0); gridMesh.renderOrder = 0.2;
  const groundMat = keep(new THREE.MeshBasicMaterial({ map: gtex }));
  const ground = new THREE.Mesh(keep(new THREE.PlaneGeometry(GWc, GDc)), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, 0); scene.add(ground); scene.add(gridMesh);
  const farGround = new THREE.Mesh(keep(new THREE.PlaneGeometry(700, 700)), keep(new THREE.MeshBasicMaterial({ color: 0x060d1e }))); farGround.rotation.x = -Math.PI / 2; farGround.position.set(0, -0.05, 0); farGround.renderOrder = -1; scene.add(farGround);
  // блики на воде: полупрозрачная плоскость с бегущей текстурой (двигается только в режиме «жизнь города»)
  const wtC = document.createElement('canvas'); wtC.width = 256; wtC.height = 256;
  (function () { const x = wtC.getContext('2d'), r = rng(5); x.clearRect(0, 0, 256, 256); for (let i = 0; i < 90; i++) { const px = r() * 256, py = r() * 256, l = 6 + r() * 16; x.strokeStyle = 'rgba(190,245,255,' + (0.18 + r() * 0.5).toFixed(2) + ')'; x.lineWidth = 1 + r() * 1.4; x.beginPath(); x.moveTo(px, py); x.lineTo(px + l, py + (r() - 0.5) * 2); x.stroke(); } })();
  const wtex = keep(new THREE.CanvasTexture(wtC)); wtex.wrapS = wtex.wrapT = THREE.RepeatWrapping; wtex.repeat.set(GWc / 6, 4); wtex.colorSpace = THREE.SRGBColorSpace;
  const waterGlint = new THREE.Mesh(keep(new THREE.PlaneGeometry(GWc, MG + 3)), keep(new THREE.MeshBasicMaterial({ map: wtex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 })));
  waterGlint.rotation.x = -Math.PI / 2; waterGlint.position.set(0, 0.012, wz(27) + (MG + 3) / 2); waterGlint.renderOrder = 1; scene.add(waterGlint);
  // небо: купол с градиентом (у горизонта фиолетово-бирюзовое свечение) и звёздами; следует за камерой
  const skyC = document.createElement('canvas'); skyC.width = 512; skyC.height = 256;
  (function () { const x = skyC.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#02050c'); g.addColorStop(0.22, '#050c22'); g.addColorStop(0.36, '#0e1946'); g.addColorStop(0.44, '#2a2d78'); g.addColorStop(0.485, '#2a7aa8'); g.addColorStop(0.5, '#1d4f86'); g.addColorStop(0.54, '#112247'); g.addColorStop(1, '#07101f'); x.fillStyle = g; x.fillRect(0, 0, 512, 256);
    const r = rng(9); for (let i = 0; i < 190; i++) { x.fillStyle = 'rgba(220,240,255,' + (0.2 + r() * 0.6).toFixed(2) + ')'; const s2 = r() < 0.1 ? 2 : 1; x.fillRect(r() * 512, r() * 90, s2, s2); }
    for (let k = 0; k < 5; k++) { const cx = r() * 512, cy = 70 + r() * 40, gr = x.createRadialGradient(cx, cy, 0, cx, cy, 60 + r() * 40); gr.addColorStop(0, 'rgba(120,110,255,.10)'); gr.addColorStop(1, 'rgba(120,110,255,0)'); x.fillStyle = gr; x.fillRect(cx - 120, cy - 120, 240, 240); } })();
  const skyTex = keep(new THREE.CanvasTexture(skyC)); skyTex.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(keep(new THREE.SphereGeometry(150, 20, 10)), keep(new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false }))); sky.renderOrder = -2; scene.background = null; scene.add(sky);
  const fogRef = scene.fog;

  /* --- «кирпичики» зданий --- */
  const dm = new THREE.Object3D(), _I = new THREE.Matrix4();
  const _m = new THREE.Matrix4(), _l = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
  const mat = (px, py, pz, sx, sy, sz, ry, rx) => { _q.setFromEuler(_e.set(rx || 0, ry || 0, 0, 'YXZ')); return _l.compose(_p.set(px, py, pz), _q, _s.set(sx, sy, sz)); };
  const WMAX = 1600, wgeo = keep(PLN()), wmat = keep(new THREE.MeshBasicMaterial({ color: 0xffffff }));      // «мигающие» окна — инстансы
  const wins = new THREE.InstancedMesh(wgeo, wmat, WMAX); wins.count = 0; wins.frustumCulled = false; wins.renderOrder = 3; scene.add(wins); wins.geometry.scale(0.1, 0.13, 1); patch(wmat, false);
  const lit1 = new THREE.Color(C1).lerp(new THREE.Color(0xffffff), 0.55), lit2 = new THREE.Color(0xffd98a), off = new THREE.Color(0x0a1a30);
  let wn = 0, blinkList = [];
  const wm = new THREE.Matrix4();

  // ctx: рисует кирпичики здания в локальных координатах (центр основания в 0, ось y вверх); BM — матрица в мир; hm — растяжение по высоте (знаки и окна его компенсируют)
  function ctx(S, BM, ghost, cols, rnd, lvl, hm) {
    hm = hm || 1; const batch = S.body, put = (t, bc, ec, px, py, pz, sx, sy, sz, ry, rx) => { _m.multiplyMatrices(BM, mat(px, py, pz, sx, sy, sz, ry, rx)); batch.add(t, _m, bc, ec); };
    const bcol = a => a === 2 ? cols.b3 : a ? cols.b2 : cols.b, ecol = a => a === 2 ? cols.e3 : a ? cols.e2 : cols.e1, NE = cols.ne || [null, K.e1, K.e2, K.warm, K.white], FS = ghost ? null : S[cols.fk || 'fac'];
    const tv = Math.min(1.25, (0.42 + 0.08 * lvl) * (cols.ti || 1)), tint = new THREE.Color().setRGB(tv, tv, tv);
    const C = { main: null, top: 0 };
    const fq = (x, y0, z, w, h, d, face, tc) => {
      const len = face < 2 ? w : d; if (len < 0.16 || h < 0.2) return;
      const cols2 = Math.max(1, Math.round(len / 0.15)), rows = Math.max(1, Math.round((h * hm - 0.1) / 0.17)), e = 0.012, ou = Math.floor(rnd() * 8) / 8, ov = Math.floor(rnd() * 8) / 8, y = y0 + 0.05, hh = h - 0.1;
      const u0 = ou, u1 = ou + cols2 / 8, v0 = ov, v1 = ov + rows / 8;
      if (face === 0) FS.q(BM, x - w / 2, y, z + d / 2 + e, w, 0, 0, 0, hh, 0, u0, v0, u1, v1, tc);
      else if (face === 1) FS.q(BM, x + w / 2, y, z - d / 2 - e, -w, 0, 0, 0, hh, 0, u0, v0, u1, v1, tc);
      else if (face === 2) FS.q(BM, x + w / 2 + e, y, z + d / 2, 0, 0, -d, 0, hh, 0, u0, v0, u1, v1, tc);
      else FS.q(BM, x - w / 2 - e, y, z - d / 2, 0, 0, d, 0, hh, 0, u0, v0, u1, v1, tc);
    };
    const neonCol = k => NE[k || 1];
    const belt = bcol(1).clone().lerp(K.white, 0.14);
    Object.assign(C, {
      px(x, y0, z, w, h, d, cl, ry) { put(BOX(), cl, null, x, y0 + h / 2, z, w, h, d, ry); },                       // цветная коробка без рёбер (мелкие детали)
      pcy(n, x, y0, z, w, h, d, cl) { put(CYL(n), cl, null, x, y0 + h / 2, z, w, h, d); },
      pcn(n, x, y0, z, w, h, d, cl) { put(CONE(n), cl, null, x, y0 + h / 2, z, w, h, d); },
      gl(x, y0, z, w, h, d, cl) { if (ghost) return; _m.multiplyMatrices(BM, mat(x, y0 + h / 2, z, w, h, d)); S.glow.add(BOX(), _m, cl, null); },   // светящаяся коробка своего цвета
      bx(x, y0, z, w, h, d, alt, win, ry) {
        put(BOX(), bcol(alt), ecol(alt), x, y0 + h / 2, z, w, h, d, ry);
        if (win && !ghost && !ry && h >= 0.26) { put(BOX(), belt, null, x, y0 + h - 0.014, z, w + 0.05, 0.03, d + 0.05); if (h >= 0.62) put(BOX(), belt, null, x, y0 + h * 0.5, z, w + 0.022, 0.014, d + 0.022); }          // карниз и пояс этажей
        if (win && !ghost && !ry) { const tc = alt === 1 ? tint.clone().multiply(col(0xd8d0ff)) : tint; fq(x, y0, z, w, h, d, 0, tc); fq(x, y0, z, w, h, d, 1, tc); if (win === 1 || win === 2) { fq(x, y0, z, w, h, d, 2, tc); fq(x, y0, z, w, h, d, 3, tc); } if (!C.main || w * h > C.main[3] * C.main[4]) C.main = [x, y0, z, w, h, d]; }
      },
      cyl(n, x, y0, z, w, h, d, alt, ry, win) {
        put(CYL(n), bcol(alt), ecol(alt), x, y0 + h / 2, z, w, h, d, ry);
        if (win && !ghost) { const r = w / 2 + 0.012, hh = h - 0.1; for (let i = 0; i < n; i++) { const a0 = i / n * 6.2832, a1 = (i + 1) / n * 6.2832, len = 3.1416 * w / n * 1.0, cc = Math.max(1, Math.round(len / 0.15)), rows = Math.max(1, Math.round(hh * hm / 0.17)), ou = Math.floor(rnd() * 8) / 8;
          FS.q(BM, x + Math.sin(a0) * r, y0 + 0.05, z + Math.cos(a0) * r * d / w, Math.sin(a1) * r - Math.sin(a0) * r, 0, (Math.cos(a1) - Math.cos(a0)) * r * d / w, 0, hh, 0, ou, 0, ou + cc / 8, rows / 8, tint); } }
      },
      lay(ax, n, x, y, z, len, dia, alt) { put(CYL(n), bcol(alt), ecol(alt), x, y, z, dia, len, dia, ax === 'x' ? Math.PI / 2 : 0, Math.PI / 2); },        // цилиндр лёжа: свод, капсула поезда
      cone(n, x, y0, z, w, h, d, alt) { put(CONE(n), bcol(alt), ecol(alt), x, y0 + h / 2, z, w, h, d); },
      icone(n, x, y0, z, w, h, d, alt) { put(CONE(n), bcol(alt), ecol(alt), x, y0 + h / 2, z, w, h, d, 0, Math.PI); },
      pyr(x, y0, z, w, h, d, alt) { put(PYR(), bcol(alt), ecol(alt), x, y0 + h / 2, z, w, h, d); },
      dome(x, y0, z, w, h, d, alt) { put(DOME(), bcol(alt), ecol(alt), x, y0, z, w, h * 2, d); },
      wedge(x, y0, z, len, h, wid, alt, ry) { put(WEDGE(), bcol(alt), ecol(alt), x, y0 + h / 2, z, len, h, wid, ry); },
      gable(x, y0, z, w, h, d, alt, ry) { put(GABLE(), bcol(alt), ecol(alt), x, y0 + h / 2, z, w, h, d, ry); },
      arc(x, y0, z, w, h, d, alt) { put(ARC(), bcol(alt), ecol(alt), x, y0, z, w, h, d); },
      tb(x, y0, z, w, h, d, rx, alt) { put(BOX(), bcol(alt), ecol(alt), x, y0 + h / 2, z, w, h, d, 0, rx); },
      nb(x, y0, z, w, h, d, k) { if (ghost) return; _m.multiplyMatrices(BM, mat(x, y0 + h / 2, z, w, h, d)); S.glow.add(BOX(), _m, neonCol(k), null); },
      ball(x, y, z, r, k) { if (ghost) return; _m.multiplyMatrices(BM, mat(x, y, z, r * 2, r * 2 / hm, r * 2)); S.glow.add(SPH(), _m, k ? neonCol(k) : K.glow, null); },
      ring(x, y, z, r, k, a) { if (ghost) return; _m.multiplyMatrices(BM, mat(x, y, z, r * 2, r * 2, r * 2, 0, Math.PI / 2)); S.glow.add(TOR(), _m, a ? neonCol(k).clone().multiplyScalar(a) : neonCol(k), null); },
      sg(x, y, z, w, h, ic, ry, k) { if (ghost) return; const u = uvOf(ICON[ic] != null ? ICON[ic] : 13); _m.multiplyMatrices(BM, mat(x, y, z, 1, 1, 1, ry)); const t = k ? neonCol(k) : K.white; h /= hm; S.sign.q(_m, -w / 2, -h / 2, 0, w, 0, 0, 0, h, 0, u[0], u[1], u[2], u[3], t); const gu = uvOf(15); S.halo.q(_m, -w * 0.95, -h * 0.95, 0.014, w * 1.9, 0, 0, 0, h * 1.9, 0, gu[0], gu[1], gu[2], gu[3], t.clone().multiplyScalar(0.32)); },
      sgf(x, y, z, w, ic, k, ry) { if (ghost) return; const u = uvOf(ICON[ic] != null ? ICON[ic] : 13); _m.multiplyMatrices(BM, mat(x, y, z, 1, 1, 1, ry || 0, -Math.PI / 2)); S.sign.q(_m, -w / 2, -w / 2, 0, w, 0, 0, 0, w, 0, u[0], u[1], u[2], u[3], neonCol(k || 1)); },   // знак, лежащий на крыше: читается сверху
      plate(x, y, z, w, d, k) { C.bx(x, y, z, w + 0.04, 0.03, d + 0.04, 0); C.nb(x, y + 0.03, z, w + 0.04, 0.008, d + 0.04, k || 1); },                                                      // подложка под знак с неоновой каймой
      ant(x, y0, z, h, k) { put(BOX(), cols.b2, cols.e2, x, y0 + h / 2, z, 0.03, h, 0.03); C.ball(x, y0 + h + 0.03, z, 0.04, k || 3); },
      beamAt(x, y0, z, w, h) { if (ghost) return; _m.multiplyMatrices(BM, mat(x, y0 + h / 2, z, w, h, w)); S.beam.add(CYL(10), _m, NE[1], null); },
      halo(w, d, k, a) { if (ghost) return; const u = uvOf(15), t = NE[k || 1].clone().multiplyScalar(a || 0.5); _m.copy(BM); S.halo.q(_m, -w / 2, 0.055, d / 2, w, 0, 0, 0, 0, -d, u[0], u[1], u[2], u[3], t); }
    });
    return C;
  }
  const small = (c, x, y, z) => c.bx(x, y, z, 0.14, 0.07, 0.11, 1);   // кондиционер/блок на крыше
  const NOPC = new Proxy({}, { get: () => () => 0 });                 // «сухой прогон»: только узнать высоту фигуры

  // каждое здание — своя фигура и свой знак; возвращает высоту верха в своих единицах. Ступень l (1…5) добавляет этажи, детали и огни; общая высота подгоняется под таблицу TGT.
  const BLD = {
    kiosk(c, l) { const h = 0.46 * LH(l);                                       // павильон с односкатной крышей, козырьком и столбом-вывеской
      c.bx(0, 0, 0.02, 0.95, h, 0.7, 0, 2); c.wedge(0, h, 0.02, 0.9, 0.22 + 0.02 * l, 1.08, 2, -Math.PI / 2); c.tb(0, h - 0.12, 0.5, 1.04, 0.04, 0.34, 0.5, 1); c.nb(0, h - 0.07, 0.62, 1.04, 0.02, 0.02, 1);
      c.sg(0, h * 0.5, 0.375, 0.5, 0.22, 'shop', 0, 2); c.bx(0.52, 0, -0.32, 0.05, h + 0.95, 0.05, 1); c.nb(0.52, h + 0.9, -0.32, 0.56, 0.03, 0.03, 2); c.sg(0.52, h + 0.62, -0.32, 0.5, 0.5, 'chart', 0, 1); c.ball(0.52, h + 1.0, -0.32, 0.04, 3);
      if (l >= 3) { c.bx(-0.55, 0, -0.2, 0.3, h * 1.5, 0.4, 1, 1); c.nb(-0.55, h * 1.5, -0.2, 0.34, 0.015, 0.44, 2); }
      if (l >= 4) c.ring(0, h + 0.3, 0, 0.45, 1);
      return h + 1.0; },
    exch(c, l) { const h = 0.56 * LH(l);                                        // круглый торговый зал с колоннадой, пристройка с бегущей строкой, знак на крыше
      c.bx(0, 0, 0, 1.55, 0.07, 1.05, 1); c.cyl(24, 0.15, 0.07, 0.02, 1.0, h, 1.0, 0, 0, 1); c.cyl(24, 0.15, h + 0.07, 0.02, 1.1, 0.07, 1.1, 1); c.ring(0.15, h * 0.5 + 0.07, 0.02, 0.51, 1);
      for (let i = 0; i < 7; i++) { const a = -1.3 + i * 0.433; c.cyl(8, 0.15 + Math.sin(a) * 0.56, 0.07, 0.02 + Math.cos(a) * 0.56, 0.07, h, 0.07, 1); }
      c.plate(0.15, h + 0.14, 0.02, 0.62, 0.62, 1); c.sgf(0.15, h + 0.178, 0.02, 0.62, 'swap', 1);
      c.bx(-0.6, 0.07, -0.18, 0.34, h * 1.55, 0.6, 1, 1); c.nb(-0.6, 0.07 + h * 1.55, -0.18, 0.38, 0.02, 0.64, 2); c.sg(-0.6, h * 0.8, 0.125, 0.28, 0.5, 'dollar', 0, 3);
      if (l >= 3) c.ring(0.15, h + 0.32, 0.02, 0.38, 3);
      if (l >= 4) c.ant(-0.6, 0.07 + h * 1.55, -0.18, 0.4, 3);
      return h * 1.55 + 0.2; },
    dc(c, l) { const h = 0.42 * LH(l);                                          // низкий серверный блок со светящимися щелями, градирни и труба
      c.bx(0, 0, 0, 1.38, h, 0.96, 1, 1); for (let i = 0; i < 6; i++) c.nb(-0.55 + i * 0.22, 0.06, 0.485, 0.035, h - 0.12, 0.01, i % 2 ? 2 : 1);
      [-0.42, 0, 0.42].forEach(x => { c.cyl(12, x, h, -0.2, 0.32, 0.13, 0.32, 2); c.ring(x, h + 0.13, -0.2, 0.14, 1); });
      c.plate(0.44, h, 0.3, 0.34, 0.34, 1); c.sgf(0.44, h + 0.038, 0.3, 0.34, 'server', 1);
      c.cyl(10, -0.6, 0, -0.38, 0.16, h + 0.6, 0.16, 1); c.ball(-0.6, h + 0.64, -0.38, 0.04, 3);
      if (l >= 3) { c.bx(-0.6, 0, 0.4, 0.2, h * 1.5, 0.3, 0, 1); c.nb(-0.6, h * 1.5, 0.4, 0.22, 0.012, 0.32, 1); }
      if (l >= 4) c.bx(0.1, h, 0.32, 0.5, 0.2, 0.26, 2, 1);
      return h + 0.65; },
    hall(c, l) { const h = 0.5 * LH(l);                                         // ратуша: ступени, портик с фронтоном и башня с часами и шпилем
      c.bx(0, 0, 0, 1.68, 0.06, 1.28, 1); c.bx(0, 0.06, 0.56, 1.5, 0.05, 0.5, 2); c.bx(0, 0.11, 0.6, 1.4, 0.05, 0.36, 2); c.bx(0, 0.06, -0.12, 1.4, h, 0.78, 2, 1);
      for (let i = 0; i < 6; i++) c.cyl(8, -0.6 + i * 0.24, 0.16, 0.5, 0.1, h - 0.1, 0.1, 2); c.bx(0, 0.06 + h - 0.06, 0.48, 1.5, 0.07, 0.56, 2); c.gable(0, 0.06 + h + 0.01, 0.48, 1.5, 0.26, 0.56, 2, 0); c.nb(0, 0.06, 0.8, 1.5, 0.02, 0.02, 1);
      c.bx(0, 0.06 + h, -0.2, 0.5, 0.6, 0.5, 2, 1); c.sg(0, 0.06 + h + 0.34, 0.06, 0.3, 0.3, 'clock', 0, 1); c.pyr(0, 0.06 + h + 0.6, -0.2, 0.6, 0.6, 0.6, 1); c.ant(0, 0.06 + h + 1.2, -0.2, 0.25, 3);
      if (l >= 3) [-0.62, 0.62].forEach(x => { c.bx(x, 0.06 + h, -0.12, 0.3, 0.22, 0.5, 2, 1); });
      if (l >= 4) c.ring(0, 0.06 + h + 0.7, -0.2, 0.45, 3);
      return h + 1.5; },
    bank(c, l) { const h = 0.62 * LH(l);                                        // банк-сейф: массивный блок, четыре угловых башни, огромная монета-дверь и золотой знак на крыше
      c.bx(0, 0, 0, 1.55, 0.07, 1.3, 1); c.bx(0, 0.07, 0, 1.1, h, 1.0, 2, 1);
      [[-0.62, -0.5], [0.62, -0.5], [-0.62, 0.5], [0.62, 0.5]].forEach(q => { c.bx(q[0], 0.07, q[1], 0.3, h * 1.35, 0.3, 2, 1); c.bx(q[0], 0.07 + h * 1.35, q[1], 0.36, 0.05, 0.36, 1); c.nb(q[0], 0.12 + h * 1.35, q[1], 0.2, 0.02, 0.2, 1); });
      c.sg(0, 0.07 + h * 0.45, 0.505, 0.56, 0.56, 'coin', 0, 1); c.plate(0, 0.07 + h, 0, 0.62, 0.62, 1); c.sgf(0, 0.07 + h + 0.038, 0, 0.62, 'dollar', 1); c.nb(0, 0.07, 0.66, 1.5, 0.02, 0.02, 1);
      if (l >= 3) c.bx(0, 0.07 + h, -0.35, 0.8, 0.14, 0.2, 2, 1);
      if (l >= 5) c.ring(0, 0.07 + h * 1.35 + 0.35, 0, 0.42, 3);
      return 0.07 + h * 1.35 + 0.15; },
    lab(c, l) { const h = 0.5 * LH(l);                                          // лаборатория: стеклянный корпус, круглая башня с куполом и колбы-трубы, знак-колба на крыше
      c.bx(-0.4, 0, 0, 0.9, h, 0.95, 2, 1); c.cyl(20, 0.45, 0, 0.1, 0.78, h + 0.3, 0.78, 2, 0, 1); c.dome(0.45, h + 0.3, 0.1, 0.82, 0.36, 0.82, 2); c.ring(0.45, h + 0.3, 0.1, 0.43, 1);
      c.plate(-0.4, h, 0.12, 0.5, 0.5, 1); c.sgf(-0.4, h + 0.038, 0.12, 0.5, 'flask', 1); c.cyl(8, -0.72, h, -0.36, 0.12, 0.5, 0.12, 2); c.cyl(8, -0.5, h, -0.36, 0.12, 0.34, 0.12, 2); c.nb(-0.72, h + 0.5, -0.36, 0.1, 0.02, 0.1, 2); c.nb(-0.5, h + 0.34, -0.36, 0.1, 0.02, 0.1, 1);
      c.ant(0.45, h + 0.62, 0.1, 0.3, 1);
      if (l >= 3) c.bx(-0.4, h, -0.3, 0.5, 0.22, 0.26, 2, 1);
      if (l >= 4) c.ring(0.45, h + 0.1, 0.1, 0.55, 2);
      return h + 0.95; },
    fund(c, l) { const a = 1.0 * LH(l), b = 1.45 * LH(l);                      // фонд: две башни разной высоты и сквозной переход между ними
      c.bx(0, 0, 0, 1.7, 0.06, 1.1, 1); c.bx(-0.52, 0.06, 0, 0.5, a, 0.7, 2, 1); c.bx(0.52, 0.06, 0, 0.5, b, 0.7, 2, 1);
      c.bx(0, 0.06 + a * 0.62, 0, 0.6, 0.16, 0.4, 1, 1); c.nb(0, 0.22 + a * 0.62, 0, 0.62, 0.015, 0.42, 2); [[-0.78, -0.36], [-0.26, -0.36], [0.78, 0.36], [0.26, 0.36]].forEach(q => c.nb(q[0], 0.06, q[1], 0.025, q[0] < 0 ? a : b, 0.025, 1));
      c.plate(-0.52, 0.06 + a, 0, 0.42, 0.52, 1); c.sgf(-0.52, 0.06 + a + 0.038, 0, 0.42, 'line', 1); c.pyr(0.52, 0.06 + b, 0, 0.42, 0.36, 0.5, 1); c.ant(0.52, 0.06 + b + 0.36, 0, 0.4, 2);
      if (l >= 3) c.ring(-0.52, 0.06 + a + 0.25, 0, 0.3, 2);
      if (l >= 4) c.sg(0.52, 0.06 + b * 0.8, 0.36, 0.34, 0.34, 'chart', 0, 1);
      return 0.06 + b + 0.8; },
    tower(c, l) {                              // ступенчатая стеклянная башня: три уступа, огни по рёбрам, шпиль
      const k = LH(l), h1 = 0.8 * k, h2 = 0.75 * k, h3 = 0.6 * k;
      c.bx(0, 0, 0, 1.3, 0.08, 1.3, 1); c.bx(0, 0.08, 0, 1.24, h1, 1.24, 0, 1); c.bx(0, h1 + 0.08, 0, 1.0, h2, 1.0, 1, 1); c.bx(0, h1 + h2 + 0.08, 0, 0.7, h3, 0.7, 0, 1);
      [[-0.62, -0.62], [0.62, -0.62], [-0.62, 0.62], [0.62, 0.62]].forEach(q => c.nb(q[0], 0.08, q[1], 0.03, h1, 0.03, 1));
      const t = h1 + h2 + h3 + 0.08; c.nb(0, h1 + 0.08, 0, 1.04, 0.02, 1.04, 2); c.nb(0, h1 + h2 + 0.08, 0, 0.74, 0.02, 0.74, 1); c.bx(0, t, 0, 0.5, 0.1, 0.5, 1); c.pyr(0, t + 0.1, 0, 0.34, 0.5, 0.34, 1); c.ant(0, t + 0.6, 0, 0.4, 1);
      c.sg(0, h1 * 0.55 + 0.08, 0.625, 0.62, 0.3, 'globe', 0, 1); c.plate(0, h1 + 0.08, 0.35, 0.5, 0.3, 1); c.sgf(0, h1 + 0.115, 0.35, 0.3, 'chart', 3, 0);
      if (l >= 3) { [-0.2, 0.2].forEach(x => c.nb(x, h1 + h2 + 0.08, 0.36, 0.02, h3, 0.02, 4)); }
      if (l >= 4) c.ring(0, t + 0.28, 0, 0.5, 2);
      return t + 1.0; },
    inst(c, l) { const h = 0.55 * LH(l);                                        // институт: П-образный корпус с атриумом-двором, ротонда с куполом
      c.bx(0, 0, 0, 1.62, 0.06, 1.5, 1); c.bx(-0.6, 0.06, 0.0, 0.42, h, 1.3, 2, 1); c.bx(0.6, 0.06, 0, 0.42, h, 1.3, 2, 1); c.bx(0, 0.06, -0.55, 0.8, h * 1.15, 0.4, 2, 1);
      c.nb(0, 0.065, 0.1, 0.74, 0.01, 0.88, 1); c.sgf(0, 0.085, 0.1, 0.62, 'cap', 1); [-0.24, 0.24].forEach(x => c.cyl(8, x, 0.06, 0.68, 0.09, h, 0.09, 2)); c.bx(0, 0.06 + h, 0.68, 0.66, 0.06, 0.16, 1);
      c.cyl(16, 0, 0.06 + h * 1.15, -0.55, 0.62, 0.08, 0.62, 1); c.dome(0, 0.14 + h * 1.15, -0.55, 0.56, 0.3, 0.56, 2); c.ant(0, 0.14 + h * 1.15 + 0.3, -0.55, 0.3, 2);
      [-0.6, 0.6].forEach(x => c.pyr(x, 0.06 + h, 0, 0.3, 0.2, 1.3, 1));
      if (l >= 4) c.ring(0, 0.14 + h * 1.15 + 0.2, -0.55, 0.42, 1);
      return 0.06 + h * 1.15 + 0.7; },
    obs(c, l) { const h = 0.5 * LH(l);                                          // обсерватория: диск-основание, купол с щелью, телескоп
      c.cyl(24, 0, 0, 0, 1.58, 0.12, 1.58, 0); c.cyl(20, 0, 0.12, 0, 1.4, h, 1.4, 1, 0, 1); c.sg(0, 0.12 + h * 0.5, 0.72, 0.5, 0.5, 'star', 0, 1);
      c.cyl(20, 0, 0.12 + h, 0, 1.3, 0.1, 1.3, 0); c.dome(0, 0.22 + h, 0, 1.2, 0.58, 1.2, 2); c.nb(0, 0.22 + h + 0.02, 0.0, 0.04, 0.55, 0.04, 1); c.nb(0, 0.22 + h + 0.5, 0.0, 0.4, 0.05, 0.05, 4);
      c.cyl(10, 0.46, 0.22 + h + 0.44, 0.3, 0.14, 0.5, 0.14, 0); c.tb(0.46, 0.22 + h + 0.8, 0.45, 0.1, 0.44, 0.1, -0.7, 0); c.ball(0.52, 0.22 + h + 1.12, 0.62, 0.045, 1);
      c.bx(-0.72, 0.12, 0.2, 0.2, h * 0.7, 0.3, 1, 1); c.ant(0.2, 0.22 + h + 0.58, -0.1, 0.32, 2);
      if (l >= 3) c.ring(0, 0.2 + h * 0.9, 0, 0.86, 2);
      if (l >= 4) [-0.5, 0.5].forEach(x => c.cyl(8, x, 0.12, -0.7, 0.1, h * 1.3, 0.1, 1));
      return h + 0.8; },
    vend(c, l) { const h = 0.5 * LH(l);                                         // навес-консоль на тонких опорах над рядом автоматов, знак на навесе
      c.bx(0, 0, -0.2, 1.3, h, 0.3, 0, 1); c.bx(0, h, 0.02, 1.5, 0.06, 0.66, 1); [-0.68, 0.68].forEach(x => c.bx(x, 0, 0.3, 0.05, h, 0.05, 1)); c.nb(0, h - 0.02, 0.06, 1.42, 0.012, 0.5, 1);
      [-0.45, 0, 0.45].forEach((x, i) => { c.bx(x, 0, 0.1, 0.32, h * 0.8, 0.22, 0); c.nb(x, h * 0.4, 0.215, 0.22, h * 0.34, 0.01, i % 2 ? 2 : 1); });
      c.plate(0, h + 0.06, 0.02, 0.5, 0.5, 1); c.sgf(0, h + 0.1, 0.02, 0.5, 'bag', 1); c.ant(0.62, h + 0.06, -0.15, 0.24 + 0.04 * l);
      if (l >= 3) { c.bx(-0.4, h + 0.06, -0.2, 0.5, 0.2, 0.3, 1, 1); c.nb(-0.4, h + 0.26, -0.2, 0.54, 0.014, 0.34, 2); }
      if (l >= 4) c.tb(0.5, h + 0.12, 0.3, 0.36, 0.02, 0.26, -0.5, 0);
      return h + 0.12 + (l >= 3 ? 0.2 : 0); },
    atm(c, l) { const h = 0.62 * LH(l);                                         // диск на ножке: тонкий стебель держит большую светящуюся тарелку со знаком
      c.cyl(20, 0, 0, 0, 1.0, 0.06, 1.0, 0); c.cyl(12, 0, 0.06, 0, 0.3, h, 0.3, 1); c.cyl(24, 0, h + 0.06, 0, 1.3, 0.09, 1.3, 2); c.ring(0, h + 0.1, 0, 0.65, 1, 0.5); c.ring(0, h + 0.05, 0, 0.6, 2, 0.6);
      c.bx(0, 0.06, 0.32, 0.5, 0.34, 0.3, 1, 1); c.sg(0, 0.22, 0.475, 0.36, 0.2, 'atm', 0, 1); c.plate(0, h + 0.15, 0, 0.62, 0.62, 1); c.sgf(0, h + 0.188, 0, 0.62, 'atm', 1);
      c.ant(0, h + 0.2, -0.3, 0.3, 1);
      if (l >= 3) c.ring(0, h + 0.26, 0, 0.9, 1, 0.5);
      if (l >= 4) [-0.4, 0.4].forEach(x => c.bx(x, h + 0.15, -0.35, 0.18, 0.18, 0.18, 1, 1));
      return h + 0.3; },
    pay(c, l) { const h = 0.85 * LH(l);                                         // шлюз: две опоры и высокая арка с «порталом» и знаком
      c.bx(0, 0, 0, 1.5, 0.06, 0.8, 1); c.bx(-0.6, 0.06, 0, 0.28, h, 0.55, 2, 1); c.bx(0.6, 0.06, 0, 0.28, h, 0.55, 2, 1); c.arc(0, 0.06 + h, 0, 1.12, 1.4, 0.5, 2);
      c.sg(0, 0.06 + h * 0.62, 0, 0.5, 0.5, 'pay', 0, 1); c.ball(0, 0.06 + h + 0.74, 0, 0.07, 3); c.nb(0, 0.06, 0.34, 1.46, 0.018, 0.018, 2); c.plate(0, 0.06, 0.3, 0.34, 0.2, 1); c.sgf(0, 0.1, 0.3, 0.22, 'pay', 1);
      if (l >= 3) { c.ant(-0.6, 0.06 + h, 0, 0.3, 3); c.ant(0.6, 0.06 + h, 0, 0.3, 3); }
      if (l >= 4) c.ring(0, 0.06 + h + 0.3, 0, 0.5, 1);
      return 0.06 + h + 0.82; },
    broker(c, l) { const h = 0.4 * LH(l), t = 0.9 * LH(l);                      // брокерский дом: высокий объём нависает консолью над низким подиумом
      c.bx(0, 0, 0, 1.9, 0.06, 1.1, 1); c.bx(-0.3, 0.06, 0, 1.3, h, 1.0, 2, 1); c.bx(0.2, 0.06 + h, -0.1, 1.1, t, 0.7, 0, 1); [0.2, -0.35].forEach(z => c.bx(0.72, 0.06, z, 0.07, h, 0.07, 1));
      c.nb(0.55, 0.06 + h - 0.02, -0.1, 0.4, 0.012, 0.62, 2); c.nb(-0.3, 0.06, 0.52, 1.3, 0.03, 0.02, 1);
      c.plate(0.2, 0.06 + h + t, -0.1, 0.6, 0.6, 1); c.sgf(0.2, 0.06 + h + t + 0.038, -0.1, 0.6, 'case', 1); c.ant(-0.2, 0.06 + h + t, -0.1, 0.45, 2); c.sg(-0.55, 0.06 + h * 0.55, 0.505, 0.5, 0.22, 'chart', 0, 1);
      if (l >= 3) c.bx(-0.7, 0.06 + h, 0.1, 0.4, 0.3, 0.4, 1, 1);
      if (l >= 4) c.ring(0.2, 0.06 + h + t + 0.3, -0.1, 0.5, 3);
      return 0.06 + h + t + 0.6; },
    vc(c, l) { const k = LH(l);                                                 // хаб: тонкая игла с «тарелкой»-капсулой и шпилем
      c.bx(0, 0, 0, 1.15, 0.06, 1.15, 1); c.bx(0, 0.06, 0, 0.9, 0.4, 0.9, 2, 1); c.cyl(10, 0, 0.46, 0, 0.22, 1.5 * k, 0.22, 1);
      const ys = 0.46 + 1.15 * k; c.cyl(20, 0, ys, 0, 0.78, 0.06, 0.78, 1); c.dome(0, ys + 0.06, 0, 0.5, 0.22, 0.5, 2); c.icone(12, 0, ys - 0.2, 0, 0.7, 0.2, 0.7, 2); c.ring(0, ys + 0.03, 0, 0.4, 1);
      c.cone(6, 0, 0.46 + 1.5 * k, 0, 0.2, 0.4, 0.2, 1); c.ball(0, 0.46 + 1.5 * k + 0.44, 0, 0.05, 2); c.plate(0, 0.46, 0.27, 0.4, 0.4, 1); c.sgf(0, 0.498, 0.27, 0.4, 'rocket', 1);
      if (l >= 3) [-0.38, 0.38].forEach(x => { c.cyl(8, x, 0.46, 0.38, 0.1, 0.4 * k, 0.1, 1); c.ball(x, 0.46 + 0.4 * k + 0.05, 0.38, 0.04, 2); });
      if (l >= 4) c.ring(0, ys + 0.3, 0, 0.3, 2);
      return 0.46 + 1.5 * k + 0.5; },
    home(c, l) { const k = LH(l);                                               // жилой модуль: двускатные крыши разной высоты, труба, большой знак-домик
      c.bx(0, 0, 0, 1.3, 0.05, 1.1, 1); c.bx(0.3, 0.05, 0, 0.6, 0.7 * k, 0.8, 2, 1); c.gable(0.3, 0.05 + 0.7 * k, 0, 0.66, 0.3, 0.86, 1, 0); c.bx(-0.3, 0.05, 0.05, 0.55, 0.4 * k, 0.7, 0, 1); c.gable(-0.3, 0.05 + 0.4 * k, 0.05, 0.6, 0.22, 0.76, 2, 0);
      c.nb(0.3, 0.05 + 0.7 * k + 0.3, 0, 0.025, 0.015, 0.88, 1); c.nb(-0.3, 0.05 + 0.4 * k + 0.22, 0.05, 0.025, 0.015, 0.78, 3); c.sg(0.3, 0.05 + 0.7 * k * 0.5, 0.405, 0.36, 0.36, 'home', 0, 1); c.bx(0.5, 0.05 + 0.7 * k + 0.12, -0.2, 0.1, 0.22, 0.1, 1);
      c.sg(-0.3, 0.05 + 0.4 * k * 0.5, 0.405, 0.3, 0.18, 'stripe', 0, 3);
      if (l >= 3) { c.bx(-0.3, 0.05 + 0.4 * k + 0.1, 0.05, 0.24, 0.26, 0.24, 2, 1); }
      if (l >= 4) c.ring(0.3, 0.05 + 0.7 * k + 0.45, 0, 0.4, 3);
      return 0.05 + 0.7 * k + 0.45; },
    cowork(c, l) { const h = 0.4 * LH(l);                                       // коворкинг: стеклянный свод-атриум между двумя корпусами
      c.bx(0, 0, 0, 1.44, 0.05, 1.12, 1); c.bx(-0.52, 0.05, 0, 0.4, h, 1.0, 2, 1); c.bx(0.52, 0.05, 0, 0.4, h, 1.0, 2, 1); c.lay('z', 14, 0, 0.39, 0, 1.0, 0.68, 2); c.nb(0, 0.73, 0, 0.03, 0.012, 0.98, 1); c.nb(-0.17, 0.61, 0, 0.02, 0.012, 0.98, 2); c.nb(0.17, 0.61, 0, 0.02, 0.012, 0.98, 2);
      c.sg(0, 0.39, 0.505, 0.4, 0.4, 'cloud', 0, 1); c.plate(-0.52, 0.05 + h, 0, 0.32, 0.5, 1); c.sgf(-0.52, 0.05 + h + 0.038, 0, 0.32, 'people', 1); c.cyl(6, 0.52, 0.05 + h, 0.3, 0.2, 0.08, 0.2, 0);
      if (l >= 3) c.bx(0.52, 0.05 + h, -0.1, 0.36, 0.3, 0.6, 2, 1);
      if (l >= 4) c.ant(0.52, 0.05 + h + 0.3, -0.1, 0.36, 1);
      return 0.75 + (l >= 3 ? 0.15 : 0); },
    mall(c, l) { const h = 0.42 * LH(l);                                        // пассаж: длинный стеклянный свод вдоль, торцевые флагштоки, полосатые навесы
      c.bx(0, 0, 0, 1.9, 0.05, 1.15, 1); c.bx(0, 0.05, -0.38, 1.84, h, 0.36, 2, 1); c.bx(0, 0.05, 0.4, 1.84, h * 0.7, 0.3, 2, 1); c.lay('x', 14, 0, 0.31, 0, 1.4, 0.52, 2); c.nb(0, 0.57, 0, 1.4, 0.012, 0.03, 1);
      c.tb(0, h * 0.7 + 0.02, 0.62, 1.7, 0.04, 0.3, 0.4, 1); c.sg(0.55, 0.05 + h * 0.35, 0.555, 0.5, 0.2, 'stripe', 0, 2); c.sg(-0.55, 0.05 + h * 0.35, 0.555, 0.5, 0.2, 'shop', 0, 1);
      c.plate(-0.45, 0.05 + h, -0.38, 0.3, 0.3, 1); c.sgf(-0.45, 0.05 + h + 0.038, -0.38, 0.3, 'bag', 1); [-0.88, 0.88].forEach(x => { c.bx(x, 0.05, 0, 0.14, h + 0.45, 0.14, 1, 1); c.ball(x, h + 0.55, 0, 0.05, 3); });
      if (l >= 3) c.bx(0.4, 0.05 + h, -0.38, 0.6, 0.2, 0.3, 1, 1);
      if (l >= 4) c.ring(0, 0.57, 0, 0.3, 1);
      return h + 0.6; },
    park(c, l) { const k = 1 + 0.08 * (l - 1);                                  // сквер: сосны разной высоты, пруд-кольцо, знак-лист на земле
      c.bx(0, 0, 0, 0.85, 0.03, 0.85, 1); c.cyl(6, -0.12, 0.03, -0.12, 0.09, 0.3, 0.09, 0); c.cone(7, -0.12, 0.3, -0.12, 0.55 * k, 0.5 * k, 0.55 * k, 1); c.cone(7, -0.12, 0.66 * k, -0.12, 0.38 * k, 0.45 * k, 0.38 * k, 2); c.cone(6, -0.12, 0.98 * k, -0.12, 0.22 * k, 0.3 * k, 0.22 * k, 1);
      c.cyl(8, -0.3, 0.03, 0.28, 0.2, 0.18 * k, 0.2, 0); c.cone(6, -0.3, 0.2 * k, 0.28, 0.2, 0.26, 0.2, 1); c.sgf(0.2, 0.045, 0.24, 0.3, 'leaf', 1); c.ball(0.3, 0.1, -0.3, 0.03, 3);
      if (l >= 3) { c.cone(6, 0.3, 0.03, -0.3, 0.22, 0.5, 0.22, 1); c.ball(-0.3, 0.1, 0.1, 0.03, 3); }
      if (l >= 4) c.ring(0, 0.04, 0, 0.8, 1);
      return 1.3 * k; },
    fountain(c, l) { c.cyl(24, 0, 0, 0, 1.5, 0.12, 1.5, 0); c.cyl(22, 0, 0.12, 0, 1.2, 0.05, 1.2, 1); c.nb(0, 0.17, 0, 1.0, 0.01, 1.0, 1); c.cyl(8, 0, 0.12, 0, 0.18, 0.5 + 0.06 * l, 0.18, 1); c.cyl(16, 0, 0.5 + 0.06 * l, 0, 0.5, 0.05, 0.5, 1);
      c.ball(0, 0.9 + 0.06 * l, 0, 0.09, 1); c.cone(8, 0, 0.55 + 0.06 * l, 0, 0.16, 0.26, 0.16, 1); c.nb(0, 0.58 + 0.06 * l, 0, 0.03, 0.34, 0.03, 1); c.ring(0, 0.2, 0, 1.05, 1); c.plate(0, 0.17, 0.42, 0.3, 0.3, 1); c.sgf(0, 0.21, 0.42, 0.3, 'drop', 1);
      if (l >= 3) { c.ring(0, 0.56 + 0.06 * l, 0, 0.5, 2); [0, 1, 2, 3].forEach(i => c.ball(Math.cos(i * 1.5708) * 0.52, 0.16, Math.sin(i * 1.5708) * 0.52, 0.035, 4)); }
      if (l >= 4) [0, 1, 2, 3].forEach(i => c.cyl(8, Math.cos(i * 1.5708 + 0.78) * 0.68, 0.12, Math.sin(i * 1.5708 + 0.78) * 0.68, 0.08, 0.22, 0.08, 1));
      return 1.0 + 0.06 * l; },
    port(c, l) { const k = LH(l);                                               // порт: склад со знаком-якорем, контейнеры, портальный кран
      c.bx(0, 0, 0, 1.9, 0.1, 1.2, 1); c.nb(0, 0.1, 0.6, 1.9, 0.02, 0.02, 1);
      [[-0.7, 0.28, 0], [-0.25, 0.28, 2], [0.2, 0.28, 1], [-0.5, 0.28, 2]].forEach((q, i) => { c.bx(q[0], 0.1 + (i === 3 ? 0.26 * k : 0), q[1], 0.42, 0.26 * k, 0.3, q[2], 1); });
      c.bx(0.75, 0.1, -0.3, 0.09, 0.95 * k, 0.09, 1); c.bx(0.38, 0.1 + 0.9 * k, -0.3, 0.8, 0.07, 0.07, 1); c.bx(0.75, 0.1, 0.1, 0.09, 0.95 * k, 0.09, 1); c.bx(0.38, 0.1 + 0.9 * k, 0.1, 0.8, 0.07, 0.07, 1); c.bx(0.75, 0.1 + 0.9 * k, -0.1, 0.1, 0.07, 0.5, 1);
      c.ball(0.02, 0.1 + 0.9 * k, -0.3, 0.04, 3); c.ball(0.02, 0.1 + 0.9 * k, 0.1, 0.04, 3);
      c.bx(-0.3, 0.1, -0.35, 0.9, 0.3, 0.4, 1, 1); c.plate(-0.3, 0.4, -0.35, 0.36, 0.34, 1); c.sgf(-0.3, 0.438, -0.35, 0.34, 'anchor', 1);
      if (l >= 3) { c.bx(0.1, 0.1, -0.45, 0.5, 0.2 * k, 0.25, 2); c.bx(0.1, 0.1 + 0.2 * k, -0.45, 0.5, 0.2 * k, 0.25, 0); }
      if (l >= 4) c.ant(-0.85, 0.1, 0.4, 0.5, 1);
      return 1.1 * k; },
    maglev(c, l) { const h = 0.14;                                              // станция на эстакаде: капсула поезда, длинная балка с огнями, знак-поезд на крыше
      c.bx(0, 0, 0, 1.95, h, 1.1, 1); [-0.8, -0.27, 0.27, 0.8].forEach(x => c.bx(x, h, -0.38, 0.08, 0.5, 0.08, 0)); c.bx(0, h + 0.5, -0.38, 1.95, 0.07, 0.3, 1); c.nb(0, h + 0.57, -0.38, 1.95, 0.015, 0.05, 1); c.nb(0, h + 0.5, -0.24, 1.95, 0.012, 0.012, 2);
      c.lay('x', 12, 0, h + 0.14, 0.18, 1.7, 0.26, 2); c.nb(0, h + 0.2, 0.31, 1.5, 0.02, 0.02, 1); c.cone(10, 0.9, h + 0.01, 0.18, 0.26, 0.2, 0.26, 2); c.ball(0.88, h + 0.14, 0.18, 0.05, 1);
      c.bx(-0.55, h + 0.3, 0.18, 0.62, 0.24, 0.4, 1, 1); c.plate(-0.55, h + 0.54, 0.18, 0.4, 0.3, 1); c.sgf(-0.55, h + 0.578, 0.18, 0.3, 'train', 1);
      if (l >= 3) { c.bx(0.55, h + 0.28, 0.18, 0.5, 0.2, 0.4, 1, 1); c.nb(0.55, h + 0.48, 0.18, 0.54, 0.014, 0.44, 2); }
      if (l >= 4) [-0.9, 0.9].forEach(x => c.ant(x, h + 0.57, -0.38, 0.35, 1));
      return h + 0.6 + (l >= 4 ? 0.3 : 0); }
  };

  /* --- этап 5: общий слой деталей — вход с козырьком и светом, участок (плитка, деревья, фонарь, машины у парковки), крыши и балконы по типам --- */
  const FZ = { kiosk: 0.68, exch: 0.6, dc: 0.5, hall: 0.86, bank: 0.68, lab: 0.5, fund: 0.56, tower: 0.66, inst: 0.76, obs: 0.8, vend: 0.36, atm: 0.5, pay: 0.4, broker: 0.55, vc: 0.58, home: 0.56, cowork: 0.57, mall: 0.78, port: 0.6, maglev: 0.55 };   // где кончается лицевая сторона (локальная z)
  const PARKS = { hall: 1, inst: 1, mall: 1, port: 1, bank: 1, dc: 1, fund: 1, broker: 1, lab: 1, cowork: 1, home: 1, exch: 1 };
  const DKC = col(0x0a1424), MTC = col(0x3b4c6e), GR1 = col(0x1c5a3c), GR2 = col(0x1f8a5a), TRC = col(0x1b6a5c), TRK = col(0x2a2038), CARC = [col(0x8fb4d8), col(0x1aa8c0), col(0xc04860), col(0xc8a860), col(0x7468c8), col(0xd8e4f0)];
  function details(c, id, l, hm, lw, ld, dim, s, lv, rnd) {
    const yh = v => v / hm, fz = FZ[id], belt = lv.b2.clone().lerp(K.white, 0.2), n2 = lv.ne[2] || K.e2, k = LH(l);
    const ac = (x, y, z) => { c.px(x, y, z, 0.15, yh(0.06), 0.11, MTC); c.px(x, y + yh(0.06), z, 0.11, yh(0.012), 0.08, DKC); };
    const tank = (x, y, z) => { c.px(x, y, z, 0.07, yh(0.04), 0.07, DKC); c.pcy(8, x, y + yh(0.04), z, 0.1, yh(0.14), 0.1, MTC); c.pcn(8, x, y + yh(0.18), z, 0.1, yh(0.03), 0.1, DKC); };
    const sky = (x, y, z, w, d) => { c.px(x, y, z, w, yh(0.035), d, DKC); c.gl(x, y + yh(0.035), z, w * 0.8, yh(0.008), d * 0.8, n2); };
    const heli = (x, y, z, r) => { c.pcy(16, x, y, z, r * 2, yh(0.016), r * 2, DKC); c.ring(x, y + yh(0.026), z, r * 0.86, 4, 0.9); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(q => c.ball(x + q[0] * r * 0.8, y + yh(0.04), z + q[1] * r * 0.8, 0.018, 3)); c.px(x, y + yh(0.017), z, r * 0.9, yh(0.004), 0.05, K.white); };
    const garden = (x, y, z, w, d) => { c.px(x, y, z, w, yh(0.03), d, GR1); c.pcn(6, x - w * 0.25, y + yh(0.03), z, 0.1, yh(0.15), 0.1, GR2); c.pcn(6, x + w * 0.2, y + yh(0.03), z + d * 0.1, 0.08, yh(0.12), 0.08, GR2); };
    const scr = (x, y, z, w, h, ic, kk) => { c.px(x, y, z, w + 0.03, yh(h + 0.03), 0.02, DKC); c.sg(x, y + yh(h / 2 + 0.015), z + 0.012, w, h, ic, 0, kk); };
    const balc = (x, y, z, w) => { c.px(x, y, z + 0.045, w, yh(0.012), 0.09, belt); c.gl(x, y + yh(0.028), z + 0.088, w, yh(0.008), 0.008, n2); };
    // --- крыши и балконы ---
    if (id === 'dc') { const h = 0.42 * k; ac(-0.42, h, 0.22); ac(-0.2, h, 0.22); }
    else if (id === 'bank') { const h = 0.62 * k; ac(-0.25, 0.07 + h, 0.4); ac(0.25, 0.07 + h, 0.4); }
    else if (id === 'broker') { const h = 0.4 * k, t = 0.9 * k; tank(0.62, 0.06 + h + t, -0.28); ac(0.62, 0.06 + h + t, 0.1); ac(-0.62, 0.06 + h, -0.35); ac(-0.3, 0.06 + h, 0.36); }
    else if (id === 'fund') { heli(0, 0.22 + k * 0.62, 0, 0.17); }
    else if (id === 'tower') { const y2 = 0.8 * k + 0.75 * k + 0.08; ac(0.42, y2, 0.28); ac(-0.42, y2, -0.28); }
    else if (id === 'vend') { ac(-0.62, 0.5 * k + 0.06, 0.15); }
    else if (id === 'vc') { ac(-0.3, 0.46, -0.3); ac(0.3, 0.46, -0.3); tank(0.32, 0.46, 0.3); }
    else if (id === 'mall') { const h = 0.42 * k; garden(-0.1, 0.05 + h, -0.38, 0.26, 0.2); scr(0.55, 0.05 + h * 0.7, 0.42, 0.5, 0.16, 'stripe', 2); }
    else if (id === 'cowork') { const h = 0.4 * k; garden(0.52, 0.05 + h, -0.3, 0.3, 0.22); sky(0.52, 0.05 + h, 0.3, 0.2, 0.14); for (let j = 0; j < Math.max(1, Math.floor(h / 0.2)); j++) { balc(-0.52, 0.1 + j * 0.2, 0.5, 0.3); balc(0.52, 0.1 + j * 0.2, 0.5, 0.3); } }
    else if (id === 'port') { ac(-0.62, 0.4, -0.35); ac(0.0, 0.4, -0.35); }
    else if (id === 'lab') { const h = 0.5 * k; ac(-0.2, h, -0.35); sky(-0.65, h, 0.3, 0.22, 0.16); }
    else if (id === 'exch') { ac(-0.6, 0.07 + 0.56 * k * 1.55, -0.38); }
    else if (id === 'home') { const h = 0.4 * k;
      for (let j = 0; j < Math.max(1, Math.floor(0.7 * k / 0.2)); j++) { const y = 0.1 + j * 0.2; balc(0.1, y, 0.405, 0.12); balc(0.5, y, 0.405, 0.12); }
      for (let j = 0; j < Math.max(1, Math.floor(h / 0.2)); j++) { const y = 0.1 + j * 0.2; balc(-0.5, y, 0.4, 0.09); balc(-0.08, y, 0.4, 0.09); } }
    // --- вход: плитка, козырёк с тёплым светом, табличка, огни по сторонам ---
    if (fz != null) {
      const zc = Math.min(fz + 0.08, ld / 2 - 0.05), zp = Math.min(fz, ld / 2 - 0.1), len = ld / 2 - zp, tile = lv.pad.clone().lerp(K.white, 0.28);
      if (len > 0.05) c.px(0, 0, (zp + ld / 2) / 2, 0.22, yh(0.012), len, tile);
      c.px(0, yh(0.2), zc, 0.34, yh(0.025), 0.12, belt); [-0.15, 0.15].forEach(x => c.px(x, 0, zc + 0.04, 0.022, yh(0.2), 0.022, lv.b2));
      c.gl(0, yh(0.188), zc, 0.3, yh(0.008), 0.09, K.warm); c.sg(0, yh(0.235), zc + 0.062, 0.2, 0.05, 'stripe', 0, 2); [-0.25, 0.25].forEach(x => c.ball(x, yh(0.05), zc + 0.12, 0.022, 3));
    }
    // --- участок: деревья по свободным углам, фонарь, машины у парковки ---
    const hw = lw / 2, hd = ld / 2, free = (x, z) => Math.abs(x) > dim[0] / 2 + 0.07 || z > (fz != null ? fz : dim[1] / 2) + 0.07 || z < -dim[1] / 2 - 0.07;
    const tree = (x, z, sc) => { c.px(x, 0, z, 0.025, yh(0.07 * sc), 0.025, TRK); c.pcn(7, x, yh(0.06 * sc), z, 0.15 * sc, yh(0.2 * sc), 0.15 * sc, TRC); c.pcn(7, x, yh(0.18 * sc), z, 0.11 * sc, yh(0.15 * sc), 0.11 * sc, GR2); };
    [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach((q, i) => { const x = q[0] * (hw - 0.09), z = q[1] * (hd - 0.09); if (!free(x, z)) return;
      if (i === 1 && fz != null) { c.px(x, 0, z, 0.014, yh(0.3), 0.014, DKC); c.ball(x, yh(0.31), z, 0.03, 3); }
      else if (rnd() < 0.85) tree(x, z, 0.8 + rnd() * 0.5); });
    if (PARKS[id] && fz != null) { const fm = (hd - fz) * s;
      if (fm >= 0.15) { const cl = 0.27 / s, cw = 0.12 / s; [-1, 1].forEach(sd => { const x = sd * (0.25 + cl / 2 + 0.1); if (Math.abs(x) + cl / 2 > hw - 0.02 || rnd() < 0.2) return; const cc = CARC[Math.floor(rnd() * CARC.length)], z = hd - cw / 2 - 0.015;
        c.px(x, yh(0.01), z, cl, yh(0.035), cw, cc); c.px(x - sd * cl * 0.05, yh(0.045), z, cl * 0.5, yh(0.03), cw * 0.86, DKC); c.gl(x + sd * cl / 2, yh(0.025), z, 0.012, yh(0.012), cw * 0.7, K.warm); c.gl(x - sd * cl / 2, yh(0.025), z, 0.012, yh(0.012), cw * 0.7, K.red); }); } }
    if (id === 'park') { c.px(0.3, 0.03, 0.34, 0.2, yh(0.02), 0.05, belt); c.px(0.3, 0.05, 0.37, 0.2, yh(0.05), 0.012, belt); }
  }
  // облик типа: акцентные цвета (бирюза, фиолет, янтарь, розовый, лайм, белый лёд) и материал фасада — по смыслу: торговля, финансы, техника, жильё и отдых, транспорт
  const QC = { tq: 0x22e3ff, vi: 0x9a90ff, am: 0xffc25a, pk: 0xff5fa8, lm: 0x9dff5a, ic: 0xe8f8ff };
  const MATS = { glass: { b: 0x0f2c4c, b2: 0x143a60, b3: 0x1f6a9c, fk: 'facG', ti: 1 }, metal: { b: 0x0c1424, b2: 0x16203a, b3: 0x2a3550, fk: 'facM', ti: 1 }, stone: { b: 0x4a5673, b2: 0x3d4963, b3: 0x7080a0, fk: 'facS', ti: 1.4 }, plain: { b: 0x10213b, b2: 0x1a1744, b3: 0x1e3a62, fk: 'fac', ti: 1 } };
  const LIV = { kiosk: ['pk', 'am', 'ic', 'plain'], exch: ['am', 'tq', 'ic', 'metal'], dc: ['tq', 'vi', 'ic', 'metal'], hall: ['ic', 'am', 'tq', 'stone'], bank: ['am', 'ic', 'vi', 'stone'], lab: ['lm', 'tq', 'ic', 'glass'], fund: ['vi', 'ic', 'pk', 'metal'], tower: ['tq', 'vi', 'ic', 'glass'],
    inst: ['ic', 'vi', 'am', 'stone'], obs: ['vi', 'tq', 'ic', 'glass'], vend: ['am', 'pk', 'ic', 'metal'], atm: ['lm', 'ic', 'am', 'plain'], pay: ['tq', 'ic', 'pk', 'metal'], broker: ['ic', 'am', 'tq', 'metal'], vc: ['vi', 'pk', 'ic', 'glass'], home: ['lm', 'pk', 'ic', 'plain'],
    cowork: ['pk', 'tq', 'ic', 'glass'], mall: ['am', 'pk', 'ic', 'glass'], park: ['lm', 'tq', 'ic', 'plain'], fountain: ['tq', 'ic', 'vi', 'plain'], port: ['am', 'tq', 'ic', 'metal'], maglev: ['ic', 'tq', 'vi', 'metal'] };
  // высота здания в клетках: [ступень 1, ступень 5]; промежуточные — по прямой
  const TGT = { kiosk: [1.1, 1.8], vend: [1.1, 1.9], atm: [1.25, 2.1], pay: [1.6, 2.8], park: [1.0, 1.7], fountain: [1.2, 2.2], maglev: [1.2, 2.2], port: [1.4, 2.8], home: [1.5, 3.0], cowork: [1.3, 2.6], mall: [1.3, 2.4], dc: [1.4, 3.0], hall: [1.9, 3.3], bank: [1.7, 3.3],
    lab: [1.6, 3.2], fund: [2.0, 3.8], tower: [2.5, 4.0], inst: [1.8, 3.2], obs: [1.7, 3.0], exch: [1.5, 3.1], broker: [2.0, 3.8], vc: [2.4, 4.0] };
  const livC = {};
  function livery(id) {
    if (livC[id]) return livC[id]; const L = LIV[id] || LIV.kiosk, M = MATS[L[3]], a1 = col(QC[L[0]]), a2 = col(QC[L[1]]), a3 = col(QC[L[2]]);
    return (livC[id] = { b: col(M.b).lerp(a1, 0.08), b2: col(M.b2).lerp(a2, 0.08), b3: col(M.b3), e1: a1.clone().multiplyScalar(0.62), e2: a2.clone().multiplyScalar(0.62), e3: a3.clone().multiplyScalar(0.5), fk: M.fk, ti: M.ti, ne: [null, a1, a2, a3, K.white], pad: a1.clone().multiplyScalar(0.4) });
  }
  const chunkOf = (cx, cz) => Math.floor(cx / CHW) + 4 * Math.floor(cz / CHD);
  function newSet() { return { shad: new QB(), body: new Batch(), glow: new Batch(), beam: new Batch(), fac: new QB(), facG: new QB(), facM: new QB(), facS: new QB(), sign: new QB(), halo: new QB() }; }
  // одно здание в набор S: площадка, фигура, детали ступени; возвращает рост для подписи и выбора
  function addBuilding(S, it, ghost, cols, rnd) {
    const dim = DIM[it.id] || [1.5, 1.2], fw = it.w, fd = it.d, odd = (it.r | 0) & 1, s = Math.min(fw / (odd ? dim[1] : dim[0]), fd / (odd ? dim[0] : dim[1])) * 0.95, cx = it.x + fw / 2, cz = it.y + fd / 2, base = elevAt(it.x + (fw >> 1), it.y + (fd >> 1)), l = it.l;
    const lv = ghost ? { b: cols.b, b2: cols.b2, b3: cols.b, e1: cols.e1, e2: cols.e2, e3: cols.e1 } : livery(it.id);
    const tg = TGT[it.id] || [1.4, 3], tgt = tg[0] + (tg[1] - tg[0]) * (l - 1) / 4, top0 = Math.max(0.3, BLD[it.id](NOPC, l) || 1), hm = clamp(tgt / (top0 * s), 0.85, 2.4);
    if (!ghost) { _m.copy(mat(wx(cx), base + 0.025, wz(cz), fw * 0.96, 0.05, fd * 0.96)); S.body.add(BOX(), _m, K.pad, lv.pad);
      const ht = tgt, sw = fw * 1.25 + 0.55 + ht * 0.2, sd = fd * 1.25 + 0.55 + ht * 0.2, sx = wx(cx) - 0.2 * ht * 0.62, sz = wz(cz) - 0.2 * ht * 0.78, su = uvOf(15), gs = 1.7 + 0.2 * l, gcol = lv.ne[1].clone().multiplyScalar(0.1 + 0.085 * l);
      S.shad.q(_I, sx - sw / 2, base + 0.02, sz + sd / 2, sw, 0, 0, 0, 0, -sd, 0, 0, 1, 1, K.pad);                                    // контактная тень (мягкий край), смещена от солнца
      S.halo.q(_I, wx(cx) - fw * gs / 2 * 0.62 - 0.4, base + 0.043, wz(cz) + fd * gs / 2 * 0.62 + 0.4, fw * gs * 0.62 + 0.8, 0, 0, 0, 0, -(fd * gs * 0.62 + 0.8), su[0], su[1], su[2], su[3], gcol); }   // отсвет неона на земле
    const BM = new THREE.Matrix4().compose(_p.set(wx(cx), base + 0.05, wz(cz)), _q.setFromEuler(_e.set(0, ((it.r | 0) & 3) * Math.PI / 2, 0)), _s.set(s, s * hm, s));
    const c = ctx(S, BM, ghost, lv, rnd, l, hm), top = BLD[it.id](c, l), lw = ((it.r | 0) & 1 ? fd : fw) / s, ld = ((it.r | 0) & 1 ? fw : fd) / s;
    // каждая ступень добавляет деталей: свечение земли, антенна, угловые опоры с огнями, луч
    if (!ghost) {
      if (l >= 3) { c.halo(lw * 1.5, ld * 1.5, 1, 0.55); c.nb(0, 0, ld / 2 * 0.99, lw * 0.98, 0.03, 0.02, 1); c.nb(0, 0, -ld / 2 * 0.99, lw * 0.98, 0.03, 0.02, 1); }
      if (l >= 4) [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(q => { const px = q[0] * (lw / 2 - 0.08), pz = q[1] * (ld / 2 - 0.08); c.bx(px, 0, pz, 0.06, 0.3, 0.06, 1); c.ball(px, 0.34, pz, 0.045, 4); });
      if (l >= 5) { c.beamAt(0, top + 0.1, 0, 0.16, 1.7); c.ball(0, top + 0.42, 0, 0.09, 4); c.halo(lw * 2.2, ld * 2.2, 2, 0.5); _v.set(0, top + 0.75, 0).applyMatrix4(BM); bcD.push([_v.x, _v.y, _v.z]); }
      else if (l >= 2) c.ball(lw / 2 - 0.05, 0.1, ld / 2 - 0.05, 0.035, 1);
      // мигающие окна: несколько отдельных светящихся окошек на главной грани
      if (c.main && wn < WMAX - 8) { const mb = c.main, nBl = 2 + l; for (let i = 0; i < nBl && wn < WMAX; i++) {
        const face = Math.floor(rnd() * 2), lx = (rnd() - 0.5) * (mb[3] - 0.2), ly = mb[1] + 0.12 + rnd() * Math.max(0.05, mb[4] - 0.26), px = mb[0] + lx, pz = mb[2] + (face ? -1 : 1) * (mb[5] / 2 + 0.02);
        dm.rotation.set(0, face ? Math.PI : 0, 0); dm.position.set(px, ly, pz); dm.scale.set(1, 1 / hm, 1); dm.updateMatrix(); wm.multiplyMatrices(BM, dm.matrix); wins.setMatrixAt(wn, wm); wins.setColorAt(wn, rnd() < 0.5 ? lit1 : lit2); blinkList.push(wn); wn++; } }
    }
    if (!ghost) details(c, it.id, l, hm, lw, ld, dim, s, lv, rnd);
    if (ghost) { const zt = ld / 2 + 0.06;                                              // призрак: две стрелки-шеврона на земле перед фасадом — видно, куда смотрит вход
      [0, 1].forEach(k => { const z = zt + 0.14 + k * 0.28; c.bx(-0.1, 0.003, z, 0.3, 0.03, 0.07, 0, 0, -Math.PI / 4); c.bx(0.1, 0.003, z, 0.3, 0.03, 0.07, 0, 0, Math.PI / 4); }); }
    return { top: top * hm, base: base, s: s, cx: cx, cz: cz };
  }

  /* --- декор вокруг карты: низкий «горизонт» из домов, деревья, холм-рельеф, фонари --- */
  function buildStatic() {
    const S = newSet(), r = rng(2026), kc = { b: K.body, b2: K.body2, e1: K.e1.clone().multiplyScalar(0.5), e2: K.e2.clone().multiplyScalar(0.5) };
    // холм: усечённая пирамида (скат) + верхняя площадка + террасы; фиолетовые рёбра
    _m.copy(mat(wx(31), 0.09, wz(3.5), 8.0, 0.18, 7.0)); S.body.add(BOX(), _m, K.rock, K.hillE);
    _m.copy(mat(wx(31), 0.18 + (HH - 0.18) / 2, wz(3.5), 7, HH - 0.18, 6)); S.body.add(FRU(), _m, K.hill, K.hillE);
    _m.copy(mat(wx(31), HH + 0.02, wz(3.5), 6.0, 0.04, 5.0)); S.body.add(BOX(), _m, K.hill2, K.hillE);
    [[5.0, 4.0], [3.8, 2.8]].forEach(q => { _m.copy(mat(wx(31), HH + 0.045, wz(3.5), q[0], 0.012, q[1])); S.body.add(BOX(), _m, K.hill, K.hillE); });     // линии высоты
    [[0, -2.5, 6.05, 0.04], [0, 2.5, 6.05, 0.04], [-3, 0, 0.04, 5.05], [3, 0, 0.04, 5.05]].forEach(q => { _m.copy(mat(wx(31 + q[0]), HH + 0.05, wz(3.5 + q[1]), q[2], 0.03, q[3] > 1 ? q[3] : 0.04)); if (q[3] > 1) _m.copy(mat(wx(31 + q[0]), HH + 0.05, wz(3.5), q[2], 0.03, q[3])); S.glow.add(BOX(), _m, K.e2, null); });   // светящаяся кромка плато
    [[27.1, 0.4, 0.9, 1.5], [34.3, 5.9, 1.3, 0.9], [27.3, 5.7, 1.1, 1.2], [34.4, 0.5, 0.9, 1.1], [30.5, 7.05, 1.4, 0.7]].forEach(q => { _m.copy(mat(wx(q[0]), 0.1, wz(q[1]), q[2], 0.2, q[3])); S.body.add(BOX(), _m, K.rock, K.hillE); });
    for (let i = 0; i < 9; i++) { _m.copy(mat(wx(28.2 + i * 0.7), 0.03 + (i % 2) * 0.01, wz(7.1), 0.5, 0.06, 0.12)); S.body.add(BOX(), _m, K.hill, null); }
    // фонари вдоль дорог: тонкая опора и яркий огонёк
    tlHeads.forEach(q => { _m.copy(mat(wx(q.x), 0.15, wz(q.z), 0.02, 0.3, 0.02)); S.body.add(BOX(), _m, K.body2, null); });      // столбики светофоров
    lamps.forEach(l => { _m.copy(mat(wx(l[0]), 0.11, wz(l[1]), 0.03, 0.22, 0.03)); S.body.add(BOX(), _m, K.body2, null); _m.copy(mat(wx(l[0]), 0.24, wz(l[1]), 0.08, 0.04, 0.08)); S.glow.add(BOX(), _m, K.warm, null); });
    // деревья по краю карты и на холме (не там, где можно строить)
    // деревья: три вида крон (ель из трёх ярусов, круглая крона, тонкий кипарис), группами; крупнее прежних
    const T3 = col(0x0f5a46), T4 = col(0x1b5a78), TR = K.dim.clone().multiplyScalar(0.5);
    const tree = (x, z, s, ye, kind) => { const y = ye || 0, kk = kind != null ? kind : (r() * 3) | 0;
      _m.copy(mat(wx(x), y + 0.08 * s, wz(z), 0.06 * s, 0.16 * s, 0.06 * s)); S.body.add(BOX(), _m, K.rock, null);
      if (kk === 0) [[0.5, 0.4, 0.16], [0.38, 0.36, 0.38], [0.24, 0.3, 0.6]].forEach((q, i) => { _m.copy(mat(wx(x), y + (q[2] + q[1] / 2) * s, wz(z), q[0] * s * 0.7, q[1] * s, q[0] * s * 0.7)); S.body.add(CONE(6), _m, i % 2 ? K.tree : T3, TR); });
      else if (kk === 1) { _m.copy(mat(wx(x), y + 0.4 * s, wz(z), 0.52 * s, 0.46 * s, 0.52 * s)); S.body.add(SPH(), _m, T3, TR); _m.copy(mat(wx(x) + 0.08 * s, y + 0.58 * s, wz(z) - 0.04 * s, 0.34 * s, 0.32 * s, 0.34 * s)); S.body.add(SPH(), _m, K.tree2, null); }
      else { _m.copy(mat(wx(x), y + 0.5 * s, wz(z), 0.32 * s, 0.72 * s, 0.32 * s)); S.body.add(CONE(5), _m, T4, TR); }
    };
    const grove = (x, z, n, rad, ye) => { for (let i = 0; i < n; i++) { const a = r() * 6.28, rr = rad * Math.sqrt(r()); tree(x + Math.cos(a) * rr, z + Math.sin(a) * rr, 0.95 + r() * 0.65, ye); } };
    for (let i = 0; i < 18; i++) { const side = i % 3, a = r(); if (side === 0) grove(-1.6 - r() * 1.6, a * (D - 6) + 1, 4, 0.8); else if (side === 1) grove(W + 1.0 + r() * 1.6, a * (D - 6) + 1, 4, 0.8); else grove(a * W, -1.6 - r() * 1.6, 4, 0.8); }
    for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28 + 0.3, px = 31 + Math.cos(a) * 3.6, pz = 3.5 + Math.sin(a) * 2.9; if (Math.abs(px - 31) < 3.1 && Math.abs(pz - 3.5) < 2.55) continue; grove(px, pz, 3, 0.45, 0.01); }
    // дальние кварталы за краем карты: коробки разной высоты с окнами (создают глубину и ощущение большого города)
    const far = (x0, z0, x1, z1, n, hmax) => { for (let i = 0; i < n; i++) { const x = x0 + r() * (x1 - x0), z = z0 + r() * (z1 - z0), w = 0.8 + r() * 1.4, d = 0.8 + r() * 1.4, h = 0.4 + r() * hmax * (0.25 + Math.hypot(wx(x), wz(z)) / 70); const alt = r() < 0.4;
      _m.copy(mat(wx(x), h / 2, wz(z), w, h, d)); S.body.add(BOX(), _m, alt ? K.body2 : K.body, (alt ? K.e2 : K.e1).clone().multiplyScalar(0.32));
      const e = 0.012, rows = Math.max(1, Math.round((h - 0.1) / 0.3)), cc = Math.max(1, Math.round(w / 0.3)), ou = Math.floor(r() * 8) / 8, tc = new THREE.Color(0.24, 0.26, 0.32); _m.identity();
      S.fac.q(_m, wx(x) - w / 2, 0.05, wz(z) + d / 2 + e, w, 0, 0, 0, h - 0.1, 0, ou, 0, ou + cc / 8, rows / 8, tc); S.fac.q(_m, wx(x) + w / 2 + e, 0.05, wz(z) + d / 2, 0, 0, -d, 0, h - 0.1, 0, ou, 0, ou + cc / 8, rows / 8, tc);
      if (r() < 0.2) { _m.copy(mat(wx(x), h + 0.15, wz(z), 0.03, 0.3, 0.03)); S.glow.add(BOX(), _m, K.red, null); } } };
    far(-16, -16, W + 16, -4.5, 46, 3.6); far(-16, -3, -4.5, D - 3, 20, 2.8); far(W + 4.5, -3, W + 16, D - 3, 20, 2.8);
    // огни на воде: бакены вдоль берега
    for (let i = 0; i < 10; i++) { const x = r() * W, z = 28.4 + r() * 2.6; _m.copy(mat(wx(x), 0.05, wz(z), 0.06, 0.1, 0.06)); S.glow.add(BOX(), _m, r() < 0.5 ? K.e1 : K.red, null); }
    // дальний план: три слоя небоскрёбов; чем дальше — тем темнее и в дымку; на шпилях красные огни
    const ix = W / 2 + 19, iz = D / 2 + 19, gu = uvOf(15), warmH = K.warm.clone().multiplyScalar(0.5);
    const layer = (n, ox0, oz0, ox1, oz1, hMin, hMax, wk, body, lit) => { for (let i = 0, g = 0; i < n && g < 500; g++) { const x = (r() * 2 - 1) * ox1, z = (r() * 2 - 1) * oz1; if (Math.abs(x) < ox0 && Math.abs(z) < oz0) continue; i++;
      const w = (0.9 + r() * 1.3) * wk, d = (0.9 + r() * 1.3) * wk, h = hMin + r() * r() * (hMax - hMin) + (hMax - hMin) * 0.25 * r(), tc = new THREE.Color(lit, lit * 1.05, lit * 1.3);
      _m.copy(mat(x, h / 2 - 0.05, z, w, h, d)); S.body.add(BOX(), _m, body, null);
      const e = 0.02, rows = Math.max(1, Math.round((h - 0.1) / (0.3 * wk))), cc = Math.max(1, Math.round(w / (0.3 * wk))), cd = Math.max(1, Math.round(d / (0.3 * wk))), ou = Math.floor(r() * 8) / 8;
      S.fac.q(_I, x - w / 2, 0.05, z + d / 2 + e, w, 0, 0, 0, h - 0.1, 0, ou, 0, ou + cc / 8, rows / 8, tc); S.fac.q(_I, x + w / 2 + e, 0.05, z + d / 2, 0, 0, -d, 0, h - 0.1, 0, ou, 0, ou + cd / 8, rows / 8, tc);
      if (h > hMax * 0.62 && r() < 0.5) { _m.copy(mat(x, h + 0.35 * wk, z, 0.05 * wk, 0.7 * wk, 0.05 * wk)); S.body.add(BOX(), _m, body, null); bcS.push([x, h + 0.75 * wk, z]); } } };
    layer(44, ix, iz, ix + 16, iz + 16, 3, 10, 1, col(0x0e1b37), 0.2);
    layer(50, ix + 14, iz + 14, ix + 44, iz + 44, 5, 16, 1.5, col(0x111f42), 0.14);
    layer(42, ix + 38, iz + 38, ix + 90, iz + 90, 8, 24, 2.4, col(0x15274e), 0.09);
    // набережная: опоры с огнями, пятна света и отражения в воде (вытянутые полосы; бегут вместе с бликами воды)
    quay.forEach((q, i) => { _m.copy(mat(wx(q[0]), 0.12, wz(q[1]), 0.03, 0.24, 0.03)); S.body.add(BOX(), _m, K.body2, null); _m.copy(mat(wx(q[0]), 0.26, wz(q[1]), 0.09, 0.04, 0.09)); S.glow.add(BOX(), _m, K.warm, null);
      S.halo.q(_I, wx(q[0]) - 0.35, 0.29, wz(q[1]) + 0.35, 0.7, 0, 0, 0, 0, -0.7, gu[0], gu[1], gu[2], gu[3], warmH);
      S.halo.q(_I, wx(q[0]) - 0.17, 0.03, wz(27.05), 0.34, 0, 0, 0, 0, 2.6, gu[0], gu[1], gu[2], gu[3], (i % 2 ? K.e1 : K.warm).clone().multiplyScalar(0.55)); });
    // фонари вдоль дорог: ореол
    lamps.forEach(l => { S.halo.q(_I, wx(l[0]) - 0.3, 0.27, wz(l[1]) + 0.3, 0.6, 0, 0, 0, 0, -0.6, gu[0], gu[1], gu[2], gu[3], warmH); });
    return S;
  }

  /* --- мелочи города (этап 5): скамьи, урны, клумбы, киоски, рекламные щиты, остановки — на тротуарах открытых районов, в клетках без построек --- */
  const PROPK = [col(0x2a3a5c), col(0x0a1424), col(0x1c5a3c), col(0x1f8a5a), col(0x3b4c6e)], PSIGN = ['chart', 'coin', 'shop', 'vc', 'dollar', 'bag', 'globe', 'star'];
  function propsBatch(items) {
    const P = new Batch(), G = new Batch(), SG = new QB(), occ = new Uint8Array(W * D); items.forEach(it => { for (let j = 0; j < it.d; j++) for (let i = 0; i < it.w; i++) occ[(it.y + j) * W + it.x + i] = 1; });
    const open = {}; A.districts().forEach(d => { if (d.open) open[d.id] = 1; });
    const BMp = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e4 = new THREE.Euler(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3(1, 1, 1);
    const part = (T, x, y, z, w, h, d, cl, gl) => { _m.multiplyMatrices(BMp, mat(x, y + h / 2, z, w, h, d)); (gl ? G : P).add(T, _m, cl, null); };
    let cnt = 0;
    for (let z = 0; z < 25; z++) for (let c = 0; c < W; c++) {
      if (cnt > (mob ? 26 : 48) || occ[z * W + c] || MP.T[z * W + c] !== 0 || !open[MP.DM[z * W + c]]) continue;
      const h = hash('p' + c + ',' + z), rv = (h % 1000) / 1000; if (rv > 0.11) continue;
      let fx = 0, fz = 0; if (isRoad(c, z + 1)) fz = 1; else if (isRoad(c, z - 1)) fz = -1; else if (isRoad(c + 1, z)) fx = 1; else if (isRoad(c - 1, z)) fx = -1; else continue;
      const px = wx(c + 0.5 + fx * 0.36), pz = wz(z + 0.5 + fz * 0.36), ry = Math.atan2(fx, fz); BMp.compose(v3.set(px, 0.02, pz), q4.setFromEuler(e4.set(0, ry, 0)), s3); cnt++;
      const kind = Math.floor(rv * 1000) % 9;
      if (kind < 3) { part(BOX(), 0, 0.045, 0, 0.2, 0.025, 0.06, PROPK[0]); part(BOX(), 0, 0.075, -0.03, 0.2, 0.05, 0.012, PROPK[0]); part(BOX(), -0.08, 0, 0, 0.02, 0.045, 0.05, PROPK[1]); part(BOX(), 0.08, 0, 0, 0.02, 0.045, 0.05, PROPK[1]); }      // скамья
      else if (kind < 5) { part(CYL(7), 0, 0, 0, 0.07, 0.11, 0.07, PROPK[1]); part(BOX(), 0, 0.11, 0, 0.045, 0.01, 0.045, K.warm, true); }                                                    // урна
      else if (kind < 7) { part(BOX(), 0, 0, 0, 0.22, 0.05, 0.07, PROPK[4]); part(BOX(), 0, 0.05, 0, 0.2, 0.012, 0.055, PROPK[2]); part(CONE(6), -0.05, 0.06, 0, 0.07, 0.09, 0.07, PROPK[3]); part(CONE(6), 0.05, 0.06, 0, 0.06, 0.07, 0.06, PROPK[3]); }   // клумба
      else if (kind === 7) { part(BOX(), 0, 0, 0, 0.2, 0.13, 0.14, PROPK[4]); part(BOX(), 0, 0.13, 0.02, 0.24, 0.012, 0.18, PROPK[1]); part(BOX(), 0, 0.03, 0.072, 0.14, 0.06, 0.008, K.warm, true); part(BOX(), 0, 0.134, 0.1, 0.2, 0.006, 0.006, K.e1, true); }   // киоск
      else { const u = uvOf(ICON[PSIGN[(h >> 5) % PSIGN.length]]); part(BOX(), -0.14, 0, 0, 0.014, 0.3, 0.014, PROPK[1]); part(BOX(), 0.14, 0, 0, 0.014, 0.3, 0.014, PROPK[1]); part(BOX(), 0, 0.2, 0, 0.34, 0.17, 0.014, PROPK[1]);                // рекламный щит
        _m.multiplyMatrices(BMp, mat(0, 0.285, 0.011, 1, 1, 1)); SG.q(_m, -0.14, -0.065, 0, 0.28, 0, 0, 0, 0.13, 0, u[0], u[1], u[2], u[3], (h & 1 ? K.e1 : K.warm)); }
    }
    return { P: P, G: G, SG: SG };
  }
  const staticMeshes = [];
  function flush(S, list, frust) {
    const b = S.body; if (b.p.length) { const m = new THREE.Mesh(geoOf(b.p, b.n, b.c), matBody); scene.add(m); list.push(m); }
    if (b.lp.length) { const ln = new THREE.LineSegments(geoOf(b.lp, null, b.lc), matLine); scene.add(ln); list.push(ln); }
    if (S.glow.p.length) { const m = new THREE.Mesh(geoOf(S.glow.p, S.glow.n, S.glow.c), matBright); m.frustumCulled = false; scene.add(m); list.push(m); }
    if (S.beam.p.length) { const m = new THREE.Mesh(geoOf(S.beam.p, S.beam.n, S.beam.c), matBeam); m.frustumCulled = false; scene.add(m); list.push(m); }
    [['fac', matFac], ['facG', matFacG], ['facM', matFacM], ['facS', matFacS]].forEach(q => { const Q = S[q[0]]; if (Q && Q.p.length) { const m = new THREE.Mesh(geoQ(Q), q[1]); m.frustumCulled = false; scene.add(m); list.push(m); } });
    if (S.shad && S.shad.p.length) { const m = new THREE.Mesh(geoQ(S.shad), matShad); m.frustumCulled = false; m.renderOrder = 0.4; scene.add(m); list.push(m); }
    if (S.sign.p.length) { const m = new THREE.Mesh(geoQ(S.sign), matSign); m.frustumCulled = false; scene.add(m); list.push(m); }
    if (S.halo.p.length) { const m = new THREE.Mesh(geoQ(S.halo), matHalo); m.frustumCulled = false; m.renderOrder = 1; scene.add(m); list.push(m); }
  }

  /* --- машины (этап 5): 5 видов, движение по полосам вправо, светофоры по фазам, повороты на перекрёстках; один общий расчёт без выделения памяти в кадре --- */
  const CARMAX = mob ? 30 : 56, CARMIN = 5, CKIND = [0, 0, 0, 1, 0, 0, 2, 0, 0, 4, 0, 3];         // вид машины по номеру: 0 легковая, 1 такси, 2 фургон, 3 автобус, 4 грузовик
  const CKL = [0.3, 0.3, 0.36, 0.62, 0.5], CKV = [0.95, 0.95, 0.8, 0.62, 0.7];                  // длина и желаемая скорость вида
  function carGeo(parts) {                                                                          // коробки с цветом и затенением по граням, перед машины — вдоль +x
    const t = BOX(), pos = [], clr = [];
    parts.forEach(q => { for (let i = 0; i < t.pos.length; i += 3) { const nx = t.nor[i], ny = t.nor[i + 1], sh = ny > 0.5 ? 1 : ny < -0.5 ? 0.35 : Math.abs(nx) > 0.5 ? 0.82 : 0.66;
      pos.push(t.pos[i] * q[3] + q[0], t.pos[i + 1] * q[4] + q[1], t.pos[i + 2] * q[5] + q[2]); clr.push(q[6] * sh, q[7] * sh, q[8] * sh); } });
    return keep(geoOf(pos, null, clr));
  }
  const WH = [0.1, 0.1, 0.12], GL = [0.1, 0.17, 0.27], WL = [0.03, 0.03, 0.04];
  const wheels = (L, W, y, r) => [[L * 0.3, -1], [L * 0.3, 1], [-L * 0.3, -1], [-L * 0.3, 1]].map(q => [q[0], y, q[1] * (W / 2 - 0.004), r * 2, r * 2, 0.018, WL[0], WL[1], WL[2]]);
  const CG = [
    carGeo([[0, 0.026, 0, 0.3, 0.03, 0.13, 1, 1, 1], [-0.02, 0.052, 0, 0.16, 0.026, 0.114, GL[0], GL[1], GL[2]], [-0.02, 0.067, 0, 0.14, 0.006, 0.11, 1, 1, 1]].concat(wheels(0.3, 0.13, 0.014, 0.014))),
    carGeo([[0, 0.026, 0, 0.3, 0.03, 0.13, 1, 1, 1], [-0.02, 0.052, 0, 0.16, 0.026, 0.114, GL[0], GL[1], GL[2]], [-0.02, 0.067, 0, 0.14, 0.006, 0.11, 1, 1, 1], [-0.02, 0.078, 0, 0.05, 0.016, 0.03, 1, 0.95, 0.5]].concat(wheels(0.3, 0.13, 0.014, 0.014))),
    carGeo([[-0.03, 0.04, 0, 0.3, 0.05, 0.14, 1, 1, 1], [0.12, 0.034, 0, 0.12, 0.038, 0.14, 0.86, 0.9, 1], [0.13, 0.058, 0, 0.1, 0.03, 0.128, GL[0], GL[1], GL[2]]].concat(wheels(0.36, 0.14, 0.016, 0.016))),
    carGeo([[0, 0.046, 0, 0.62, 0.07, 0.16, 1, 1, 1], [0, 0.058, 0, 0.58, 0.028, 0.168, GL[0], GL[1], GL[2]], [0, 0.085, 0, 0.62, 0.006, 0.15, 0.9, 0.95, 1]].concat(wheels(0.62, 0.16, 0.018, 0.018))),
    carGeo([[0.17, 0.042, 0, 0.14, 0.06, 0.15, 1, 1, 1], [0.215, 0.056, 0, 0.05, 0.028, 0.152, GL[0], GL[1], GL[2]], [-0.08, 0.05, 0, 0.3, 0.075, 0.16, 0.8, 0.85, 0.95]].concat(wheels(0.5, 0.15, 0.018, 0.018)))
  ];
  const carMat = keep(new THREE.MeshBasicMaterial({ vertexColors: true }));
  const KN = [0, 0, 0, 0, 0]; for (let i = 0; i < CARMAX; i++) KN[CKIND[i % 12]]++;
  const carM = CG.map((g, k) => { const m = new THREE.InstancedMesh(g, carMat, Math.max(1, KN[k])); m.frustumCulled = false; m.renderOrder = 3; m.count = 0; scene.add(m); return m; });
  const lampG = (() => { const t = BOX(), pos = [], clr = []; [[0.5, 0.3, 1, 0.94, 0.66], [0.5, -0.3, 1, 0.94, 0.66], [-0.5, 0.3, 1, 0.1, 0.12], [-0.5, -0.3, 1, 0.1, 0.12]].forEach(q => { for (let i = 0; i < t.pos.length; i += 3) { pos.push(t.pos[i] * 0.012 + q[0] * 0.296, t.pos[i + 1] * 0.016 + 0.03, t.pos[i + 2] * 0.03 + q[1] * 0.13); const wl = q[0] > 0; clr.push(1.0, wl ? 0.94 : 0.1, wl ? 0.66 : 0.12); } }); return keep(geoOf(pos, null, clr)); })();
  const lampM = new THREE.InstancedMesh(lampG, keep(new THREE.MeshBasicMaterial({ vertexColors: true })), CARMAX); lampM.frustumCulled = false; lampM.renderOrder = 3.1; lampM.count = 0; scene.add(lampM);
  const bmC = document.createElement('canvas'); bmC.width = 64; bmC.height = 32;
  (function () { const x = bmC.getContext('2d'), g = x.createRadialGradient(0, 16, 1, 0, 16, 62); g.addColorStop(0, 'rgba(255,226,160,.9)'); g.addColorStop(0.35, 'rgba(255,210,140,.35)'); g.addColorStop(1, 'rgba(255,200,120,0)'); x.fillStyle = g; x.beginPath(); x.moveTo(0, 12); x.lineTo(64, 0); x.lineTo(64, 32); x.lineTo(0, 20); x.closePath(); x.fill(); })();
  const bmTex = keep(new THREE.CanvasTexture(bmC)); bmTex.colorSpace = THREE.SRGBColorSpace;
  const bmGeo = keep(PLN()); bmGeo.rotateX(-Math.PI / 2); bmGeo.translate(0.5, 0, 0);
  const beamM = new THREE.InstancedMesh(bmGeo, keep(new THREE.MeshBasicMaterial({ map: bmTex, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })), CARMAX); beamM.frustumCulled = false; beamM.renderOrder = 2.4; beamM.count = 0; scene.add(beamM);
  // перекрёстки и светофоры: 6 перекрёстков (столбцы RX × строки RZ); фаза общая: горизонтальные дороги — зелёный 5 с, жёлтый 1,2 с, пауза 2,3 с (успеть выехать), потом вертикальные
  const SEG = []; RZ.forEach(z => SEG.push({ h: 1, c: z, len: W, cr: RX.slice() })); RX.forEach(c => SEG.push({ h: 0, c: c, len: ROADZ, cr: RZ.slice() }));
  const phaseOf = ts => { const t = ts % 17; return t < 5 ? 0 : t < 6.2 ? 1 : t < 8.5 ? 2 : t < 13.5 ? 3 : t < 14.7 ? 4 : 5; };                       // 0 гор. зелёный, 1 гор. жёлтый, 2 всем красный, 3 верт. зелёный, 4 верт. жёлтый, 5 всем красный
  const stateH = ph => (ph === 0 ? 2 : ph === 1 ? 1 : 0), stateV = ph => (ph === 3 ? 2 : ph === 4 ? 1 : 0);                                    // 0 красный, 1 жёлтый, 2 зелёный
  const TLC = [col(0xff3050), col(0xffc040), col(0x30ff90)];
  const tlHeads = [];                                                                                  // по 4 головки на перекрёсток: {x, z, h}: h=1 — для горизонтального потока
  RX.forEach(c => RZ.forEach(z => { tlHeads.push({ x: c - 0.12, z: z + 1.12, h: 1 }, { x: c + 1.12, z: z - 0.12, h: 1 }, { x: c - 0.12, z: z - 0.12, h: 0 }, { x: c + 1.12, z: z + 1.12, h: 0 }); }));
  const tlM = new THREE.InstancedMesh(keep(new THREE.BoxGeometry(0.055, 0.075, 0.055)), keep(new THREE.MeshBasicMaterial({ color: 0xffffff })), tlHeads.length); tlM.frustumCulled = false; tlM.renderOrder = 3;
  tlHeads.forEach((q, i) => { dm.position.set(wx(q.x), 0.33, wz(q.z)); dm.rotation.set(0, 0, 0); dm.scale.set(1, 1, 1); dm.updateMatrix(); tlM.setMatrixAt(i, dm.matrix); tlM.setColorAt(i, TLC[0]); }); scene.add(tlM);
  let tlSig = -1; const lightsSet = ph => { const sg = stateH(ph) * 3 + stateV(ph); if (sg === tlSig) return; tlSig = sg; tlHeads.forEach((q, i) => tlM.setColorAt(i, TLC[q.h ? stateH(ph) : stateV(ph)])); tlM.instanceColor.needsUpdate = true; };
  // состояние машин: типизированные массивы (в кадре ничего не создаётся)
  const cSeg = new Int8Array(CARMAX), cDir = new Int8Array(CARMAX), cP = new Float32Array(CARMAX), cV = new Float32Array(CARMAX), cMax = new Float32Array(CARMAX), cTurn = new Float32Array(CARMAX), cKind = new Uint8Array(CARMAX), cKi = new Uint16Array(CARMAX), cWant = new Int8Array(CARMAX);
  const cB = new Float32Array(CARMAX * 6), cBl = new Float32Array(CARMAX), cInt = new Int16Array(CARMAX), cNs = new Int8Array(CARMAX), cNd = new Int8Array(CARMAX), cNp = new Float32Array(CARMAX), cX = new Float32Array(CARMAX), cZ = new Float32Array(CARMAX), cH = new Float32Array(CARMAX);
  let carN = 0, carCnt = [0, 0, 0, 0, 0], carT = -1, carSeed = 12345, carMs = 0, carMsN = 0;
  const crnd = () => { carSeed = (Math.imul(carSeed, 1664525) + 1013904223) >>> 0; return carSeed / 4294967296; };
  const laneZ = (sg, dir) => sg.c + 0.5 + 0.18 * dir, laneX = (sg, dir) => sg.c + 0.5 - 0.18 * dir;                                                  // смещение полосы от оси: движение справа
  (function () { const kc = [0, 0, 0, 0, 0]; for (let i = 0; i < CARMAX; i++) { const k = CKIND[i % 12]; cKind[i] = k; cKi[i] = kc[k]++; } })();
  const CPAL = [col(0xdff0ff), col(0x22e3ff), col(0xff6a84), col(0x9a90ff), col(0xe8f0ff), col(0xffb85a), col(0x7be8a8)], TAXI = col(0xffc828), BUS = col(0x2ad0a0), TRUCKC = col(0xb8c4dc), VANC = col(0xe8eeff);
  function carsPlace() {                                                                                // расстановка по полосам: ровно, с разбросом; скорость небольшая
    const r = rng(31), slots = Math.ceil(CARMAX / 10); carSeed = 12345;
    for (let i = 0; i < CARMAX; i++) { const ln = i % 10, s = ln >> 1, sg = SEG[s], dir = (ln & 1) ? -1 : 1, slot = Math.floor(i / 10), step = sg.len / slots;
      cSeg[i] = s; cDir[i] = dir; cP[i] = (slot + 0.12 + 0.76 * r()) * step; cV[i] = 0.3; cTurn[i] = -1; cMax[i] = CKV[cKind[i]] * (0.78 + 0.3 * r()); cWant[i] = crnd() < 0.34 ? (crnd() < 0.5 ? 1 : -1) : 0;
      const k = cKind[i]; carM[k].setColorAt(cKi[i], k === 1 ? TAXI : k === 3 ? BUS : k === 4 ? TRUCKC : k === 2 ? VANC : CPAL[Math.floor(r() * CPAL.length)]); }
    carM.forEach(m => { if (m.instanceColor) m.instanceColor.needsUpdate = true; });
  }
  carsPlace();
  function carCount(n) {                                                                                // число машин зависит от числа зданий; потолок по бюджету (на телефоне меньше)
    const want = Math.max(CARMIN, Math.min(CARMAX, Math.round(5 + n * 1.25))); if (want === carN) return; carN = want; carCnt = [0, 0, 0, 0, 0]; for (let i = 0; i < carN; i++) carCnt[cKind[i]]++;
    carM.forEach((m, k) => { m.count = carCnt[k]; }); lampM.count = beamM.count = carN; carT = -1; carsPlace(); carsDraw();
  }
  function carsDraw() {                                                                                 // положение и поворот из состояния
    for (let i = 0; i < carN; i++) { const sg = SEG[cSeg[i]], k = cKind[i]; let x, z, hd;
      if (cTurn[i] >= 0) { const u = cTurn[i], a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c2 = u * u, o = i * 6; x = a * cB[o] + b * cB[o + 2] + c2 * cB[o + 4]; z = a * cB[o + 1] + b * cB[o + 3] + c2 * cB[o + 5]; hd = Math.atan2(-((1 - u) * (cB[o + 3] - cB[o + 1]) + u * (cB[o + 5] - cB[o + 3])), (1 - u) * (cB[o + 2] - cB[o]) + u * (cB[o + 4] - cB[o + 2])); }
      else if (sg.h) { x = cP[i]; z = laneZ(sg, cDir[i]); hd = cDir[i] > 0 ? 0 : Math.PI; } else { x = laneX(sg, cDir[i]); z = cP[i]; hd = cDir[i] > 0 ? -Math.PI / 2 : Math.PI / 2; }
      cX[i] = x; cZ[i] = z; cH[i] = hd;
      dm.position.set(wx(x), 0.012, wz(z)); dm.rotation.set(0, hd, 0); dm.scale.set(1, 1, 1); dm.updateMatrix(); carM[k].setMatrixAt(cKi[i], dm.matrix);
      dm.scale.set(CKL[k] / 0.3, 1, CKL[k] > 0.4 ? 1.15 : 1); dm.updateMatrix(); lampM.setMatrixAt(i, dm.matrix);
      const fx = x + Math.cos(hd) * CKL[k] / 2, fz = z - Math.sin(hd) * CKL[k] / 2; dm.position.set(wx(fx), 0.009, wz(fz)); dm.scale.set(0.62, 1, 0.34); dm.updateMatrix(); beamM.setMatrixAt(i, dm.matrix); }
    carM.forEach(m => { m.instanceMatrix.needsUpdate = true; }); lampM.instanceMatrix.needsUpdate = true; beamM.instanceMatrix.needsUpdate = true;
  }
  function carsStep(dt, ph) {
    for (let i = 0; i < carN; i++) {
      const L = CKL[cKind[i]];
      if (cTurn[i] >= 0) {                                                                              // поворот: квадратичная кривая, медленнее
        const tv = 0.55; cV[i] += Math.max(-3 * dt, Math.min(1.2 * dt, tv - cV[i])); cTurn[i] += cV[i] * dt / cBl[i];
        if (cTurn[i] >= 1) { cSeg[i] = cNs[i]; cDir[i] = cNd[i]; cP[i] = cNp[i]; cTurn[i] = -1; cWant[i] = crnd() < 0.34 ? (crnd() < 0.5 ? 1 : -1) : 0; }
        continue;
      }
      const s = cSeg[i], sg = SEG[s], dir = cDir[i], len = sg.len, p = cP[i]; let target = cMax[i];
      for (let j = 0; j < carN; j++) { if (j === i || cTurn[j] >= 0 || cSeg[j] !== s || cDir[j] !== dir) continue;      // машина впереди на той же полосе (полоса замкнута)
        let gap = (cP[j] - p) * dir; gap = ((gap % len) + len) % len; gap -= (L + CKL[cKind[j]]) / 2 + 0.07;
        if (gap < 0.9) { const al = Math.max(0, gap); const tv = Math.min(cMax[i], al * 2.4, al < 0.35 ? cV[j] : 9); if (tv < target) target = tv; } }
      const hs = sg.h ? stateH(ph) : stateV(ph), front = p + dir * L / 2;
      for (let q = 0; q < sg.cr.length; q++) { const cc = sg.cr[q]; let dist, stop = dir > 0 ? cc - 1.06 : cc + 2.06;       // стоп-линия — перед «зеброй» (клетка перед перекрёстком)
        dist = (stop - front) * dir; if (dist < -0.2 || dist > 1.4) continue;
        const brake = cV[i] * cV[i] / (2 * 3.2);
        if (hs !== 2 && !(dist < brake - 0.02 && hs === 1)) { const tv = Math.max(0, dist) * 2.2; if (tv < target) target = tv; if (dist < 0.03) target = 0; }
      }
      // начало поворота на перекрёстке: центр машины дошёл до границы клетки перекрёстка
      if (cWant[i] !== 0) for (let q = 0; q < sg.cr.length; q++) { const cc = sg.cr[q], ent = dir > 0 ? cc : cc + 1;
        if ((p - ent) * dir >= 0 && (p - ent) * dir < 0.12 && cV[i] > 0.05) {
          const right = sg.h ? dir : -dir, nd = cWant[i] > 0 ? right : -right;
          const ts = sg.h ? SEG.findIndex(o => !o.h && o.c === cc) : SEG.findIndex(o => o.h && o.c === cc), tg = SEG[ts]; let ok = ts >= 0; const np = nd > 0 ? sg.c + 1 : sg.c, key = sg.h ? cc * 100 + sg.c : sg.c * 100 + cc;
          if (ok) {                                              // p выхода по новой дороге: граница клетки перекрёстка
            for (let j = 0; j < carN && ok; j++) { if (j === i) continue; if (cTurn[j] >= 0 && cInt[j] === key) { ok = false; break; } if (cWant[i] < 0 && cTurn[j] < 0 && cSeg[j] === s && cDir[j] === -dir && Math.abs(cP[j] - (cc + 0.5)) < 1.8 && cV[j] > 0.05) { ok = false; break; } if (cTurn[j] < 0 && cSeg[j] === ts && cDir[j] === nd && Math.abs(cP[j] - np) < 0.7) ok = false; else if (cTurn[j] >= 0 && cNs[j] === ts && cNd[j] === nd) ok = false; }
            if (ok) { const o = i * 6;
              if (sg.h) { const zl = laneZ(sg, dir), xl = laneX(tg, nd); cB[o] = ent; cB[o + 1] = zl; cB[o + 2] = xl; cB[o + 3] = zl; cB[o + 4] = xl; cB[o + 5] = np; }
              else { const xl = laneX(sg, dir), zl = laneZ(tg, nd); cB[o] = xl; cB[o + 1] = ent; cB[o + 2] = xl; cB[o + 3] = zl; cB[o + 4] = np; cB[o + 5] = zl; }
              cBl[i] = (Math.hypot(cB[o + 2] - cB[o], cB[o + 3] - cB[o + 1]) + Math.hypot(cB[o + 4] - cB[o + 2], cB[o + 5] - cB[o + 3]) + Math.hypot(cB[o + 4] - cB[o], cB[o + 5] - cB[o + 1])) / 2;
              cNs[i] = ts; cNd[i] = nd; cNp[i] = np; cInt[i] = key; cTurn[i] = 0; } }
          if (!ok || cTurn[i] < 0) cWant[i] = 0; break; } }
      if (cTurn[i] >= 0) continue;
      cV[i] += Math.max(-3.2 * dt, Math.min(1.2 * dt, target - cV[i])); if (cV[i] < 0.002) cV[i] = 0;
      let np2 = p + dir * cV[i] * dt; if (np2 >= len) np2 -= len; else if (np2 < 0) np2 += len; cP[i] = np2;
    }
  }
  function moveCars(ts) {
    if (carN < 1) return;
    if (ts <= 0) { carsPlace(); carT = -1; lightsSet(0); carsDraw(); return; }
    let dt = carT < 0 ? 0.04 : ts - carT; carT = ts; if (dt > 0.12) dt = 0.05; if (dt <= 0) return;
    const t0 = performance.now(); const ph = phaseOf(ts); lightsSet(ph); carsStep(dt, ph); carsDraw(); carMs += performance.now() - t0; carMsN++;
  }
  lightsSet(0); carCount(10);

  /* --- сетка клеток-подсветки: подходящие места, радиус прибавки, призрак, выбранное; недоступные клетки закрыты тенью --- */
  const tlC = document.createElement('canvas'); tlC.width = tlC.height = 64;
  (function () { const x = tlC.getContext('2d'), g = x.createRadialGradient(32, 32, 4, 32, 32, 34); g.addColorStop(0, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(255,255,255,.52)'); x.fillStyle = g; x.fillRect(3, 3, 58, 58); x.strokeStyle = 'rgba(255,255,255,.95)'; x.lineWidth = 3; x.strokeRect(3.5, 3.5, 57, 57); x.fillStyle = 'rgba(255,255,255,.9)'; [[3, 3], [49, 3], [3, 49], [49, 49]].forEach(q => x.fillRect(q[0], q[1], 12, 3)); })();
  const tlTex = keep(new THREE.CanvasTexture(tlC)); tlTex.colorSpace = THREE.SRGBColorSpace;
  const ovGeo = keep(PLN()); ovGeo.rotateX(-Math.PI / 2);
  const ovMat = keep(new THREE.MeshBasicMaterial({ map: tlTex, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  const ov = new THREE.InstancedMesh(ovGeo, ovMat, W * D); ov.count = 0; ov.frustumCulled = false; ov.renderOrder = 2; scene.add(ov);
  const OVC = [null, new THREE.Color(0x14a06a), new THREE.Color(0x2a52b8), new THREE.Color(0x40ffb0), new THREE.Color(0xff3556), new THREE.Color(0x7ad8e8)];
  function paintOverlay() {
    const m = A.overlay(); let n = 0;
    if (m) for (let i = 0; i < m.length; i++) {
      const k = m[i]; if (!k) continue; const cx = i % W, cz = (i / W) | 0;
      dm.position.set(wx(cx) + 0.5, elevAt(cx, cz) + 0.03, wz(cz) + 0.5); dm.rotation.set(0, 0, 0); dm.scale.set(0.96, 1, 0.96); dm.updateMatrix(); ov.setMatrixAt(n, dm.matrix); ov.setColorAt(n, OVC[k]); n++;
    }
    dm.scale.set(1, 1, 1); ov.count = n; ov.instanceMatrix.needsUpdate = true; if (ov.instanceColor) ov.instanceColor.needsUpdate = true;
  }

  /* --- эффекты (этап 4): кольца-импульсы, искры дохода, красные огни шпилей, «окно» постройки, лучи прожекторов, «спящие» кварталы ---
     Всё лёгкое: по одному общему набору инстансов, без создания объектов на каждое действие. */
  const glC = document.createElement('canvas'); glC.width = glC.height = 64;
  (function () { const x = glC.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.22, 'rgba(255,255,255,.6)'); g.addColorStop(0.5, 'rgba(255,255,255,.16)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); })();
  const glTex = keep(new THREE.CanvasTexture(glC)); glTex.colorSpace = THREE.SRGBColorSpace;
  const rgC = document.createElement('canvas'); rgC.width = rgC.height = 128;
  (function () { const x = rgC.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,.10)'); g.addColorStop(0.6, 'rgba(255,255,255,.04)'); g.addColorStop(0.84, 'rgba(255,255,255,.9)'); g.addColorStop(0.92, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); })();
  const ringTex = keep(new THREE.CanvasTexture(rgC)); ringTex.colorSpace = THREE.SRGBColorSpace;
  const scC = document.createElement('canvas'); scC.width = scC.height = 64;
  (function () { const x = scC.getContext('2d'); x.fillStyle = 'rgba(255,255,255,.2)'; x.fillRect(0, 0, 64, 64); x.strokeStyle = 'rgba(255,255,255,.95)'; x.lineWidth = 4; x.strokeRect(2, 2, 60, 60); })();
  const scTex = keep(new THREE.CanvasTexture(scC)); scTex.colorSpace = THREE.SRGBColorSpace;
  const addMat = (map, extra) => keep(new THREE.MeshBasicMaterial(Object.assign({ map: map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }, extra || {})));
  const RN = 10, SN = 72, BN = 96, bcS = [], bcD = [], blackC = new THREE.Color(0, 0, 0), _cc = new THREE.Color();
  const flat = keep(PLN()); flat.rotateX(-Math.PI / 2); const unitQ = keep(PLN());
  const rings = new THREE.InstancedMesh(flat, addMat(ringTex, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), RN), rg = [];
  const sparks = new THREE.InstancedMesh(unitQ, addMat(glTex), SN), sp = [];
  const bcM = new THREE.InstancedMesh(unitQ, addMat(glTex), BN);
  [sparks, bcM].forEach(m => { const mt = m.material; mt.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', 'vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0); mvPosition.xy += position.xy * length(instanceMatrix[0].xyz); gl_Position = projectionMatrix * mvPosition;'); }; mt.customProgramCacheKey = () => 'bill'; });
  [rings, sparks, bcM].forEach(m => { m.frustumCulled = false; scene.add(m); }); rings.renderOrder = 2.5; sparks.renderOrder = 4; bcM.renderOrder = 3.5;
  dm.scale.set(0, 0, 0); dm.position.set(0, 0, 0); dm.updateMatrix();
  for (let i = 0; i < RN; i++) { rg.push({ on: false, c: new THREE.Color() }); rings.setMatrixAt(i, dm.matrix); rings.setColorAt(i, blackC); }
  for (let i = 0; i < SN; i++) { sp.push({ on: false }); sparks.setMatrixAt(i, dm.matrix); sparks.setColorAt(i, blackC); }
  bcM.count = 0;
  const scan = new THREE.Mesh(keep(flat.clone()), addMat(scTex, { color: C1 })); scan.visible = false; scan.renderOrder = 3; scan.frustumCulled = false; scene.add(scan);
  function ringAdd(x, y, z, R, c, dur, delay, a) { let k = rg.findIndex(q => !q.on); if (k < 0) k = 0; const q = rg[k]; q.on = true; q.x = x; q.y = y; q.z = z; q.R = R; q.c.copy(c); q.dur = dur; q.t0 = performance.now() + (delay || 0); q.a = a == null ? 1 : a; }
  function sparkBurst(x, y, z) {                                                         // 6–10 искр-монет взлетают от здания вверх (к панели)
    const n = 6 + ((Math.random() * 5) | 0), now = performance.now();
    for (let k = 0; k < n; k++) { const i = sp.findIndex(q => !q.on); if (i < 0) break; const q = sp[i]; q.on = true; q.x = x + (Math.random() - 0.5) * 0.3; q.y = y; q.z = z + (Math.random() - 0.5) * 0.3; q.vx = (Math.random() - 0.5) * 0.9; q.vz = (Math.random() - 0.5) * 0.9; q.vy = 2.3 + Math.random() * 1.7; q.sz = 0.24 + Math.random() * 0.14; q.life = 850 + Math.random() * 500; q.t0 = now + k * 38; }
    need();
  }
  // красные огни: на шпилях зданий ступени 5 и дальних небоскрёбов; мигают в режиме «жизнь города»
  let bcList = [], bcN = 0, bcPh = -1; const _lq = new THREE.Quaternion();
  function beaconCols(live, ts) { for (let i = 0; i < bcN; i++) bcM.setColorAt(i, _cc.copy(K.red).multiplyScalar(live && ((ts * 1.05 + i * 0.37) % 1) > 0.5 ? 0.2 : 0.95)); if (bcM.instanceColor) bcM.instanceColor.needsUpdate = true; }
  function billT() {
    if (!bcN) return; dm.quaternion.set(0, 0, 0, 1);
    for (let i = 0; i < bcN; i++) { dm.position.set(bcList[i][0], bcList[i][1], bcList[i][2]); dm.scale.setScalar(0.8); dm.updateMatrix(); bcM.setMatrixAt(i, dm.matrix); }
    bcM.instanceMatrix.needsUpdate = true;
  }
  function setBeacons() { bcList = bcS.concat(bcD).slice(0, BN); bcN = bcList.length; bcM.count = bcN; beaconCols(false, 0); billT(); }
  // лучи прожекторов в небе: три медленно ходящих луча
  const spotGeo = keep(new THREE.CylinderGeometry(1.5, 0.06, 44, 10, 1, true)); spotGeo.translate(0, 22, 0);
  (function () { const p = spotGeo.attributes.position, c = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const k = 1 - p.getY(i) / 44; c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = k * k; } spotGeo.setAttribute('color', new THREE.BufferAttribute(c, 3)); })();
  const spots = [[-46, -40, 0xffffff & C1, -0.25, 0.3], [52, -34, C2, 0.28, 0.15], [6, -64, 0xffd98a, 0.05, -0.2]].map((q, i) => { const m = new THREE.Mesh(spotGeo, keep(new THREE.MeshBasicMaterial({ vertexColors: true, color: q[2] || C1, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false })));
    m.position.set(q[0], 0, q[1]); m.userData = { z0: q[3], x0: q[4], ph: i * 2.1 }; m.rotation.set(q[4], 0, q[3]); m.frustumCulled = false; m.renderOrder = 1.5; m.visible = !mob; scene.add(m); return m; });
  // «спящие» кварталы: контур будущей застройки — голографические коробки (линии и еле заметные грани)
  let sleepMeshes = [];
  const sleepLM = keep(new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.6 })), sleepFM = keep(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.05, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  function paintSleep() {                                                                       // «спящие» районы: тонкие контуры разной высоты, на части — стрела крана и тёплый огонёк
    killMeshes(sleepMeshes); const L = new Batch(), G = new Batch(), r = rng(515), cF = K.e2.clone().multiplyScalar(0.55), cL = K.e2.clone().multiplyScalar(0.7), wa = K.warm.clone(), rd = K.red.clone();
    A.districts().forEach(d => { if (d.open) return; const q = MP.DIST[d.id];
      for (let z = q.z0; z < q.z1; z += 2) for (let c = q.x0; c < q.x1; c += 2) {
        if (r() < 0.38) continue; if ([[c, z], [c + 1, z], [c, z + 1], [c + 1, z + 1]].some(p => MP.DM[p[1] * W + p[0]] !== d.id || MP.T[p[1] * W + p[0]] === 3)) continue;
        const w0 = 0.7 + r() * 0.8, d0 = 0.7 + r() * 0.8, h0 = 0.25 + r() * r() * 3.2, px = wx(c + 1) + (r() - 0.5) * 0.3, pz = wz(z + 1) + (r() - 0.5) * 0.3; _m.copy(mat(px, h0 / 2 + 0.02, pz, w0, h0, d0)); L.add(BOX(), _m, cF, cL);
        if (h0 > 1.5 && r() < 0.42) { const cr = r() < 0.5; _m.copy(mat(px + w0 * 0.3, h0 + 0.3, pz, 0.025, 0.6, 0.025)); L.add(BOX(), _m, cF, cL);
          if (cr) { _m.copy(mat(px + w0 * 0.3 - 0.25, h0 + 0.58, pz, 0.6, 0.02, 0.02)); L.add(BOX(), _m, cF, cL); _m.copy(mat(px + w0 * 0.3 - 0.52, h0 + 0.54, pz, 0.045, 0.045, 0.045)); G.add(BOX(), _m, r() < 0.5 ? wa : rd, null); }
          else { _m.copy(mat(px + w0 * 0.3, h0 + 0.62, pz, 0.05, 0.05, 0.05)); G.add(BOX(), _m, wa, null); } } } });
    if (!L.p.length) return;
    const m = new THREE.Mesh(geoOf(L.p, L.n, L.c), sleepFM); m.frustumCulled = false; m.renderOrder = 1.2; scene.add(m); sleepMeshes.push(m);
    const ln = new THREE.LineSegments(geoOf(L.lp, null, L.lc), sleepLM); ln.frustumCulled = false; ln.renderOrder = 1.3; scene.add(ln); sleepMeshes.push(ln);
    if (G.p.length) { const gm = new THREE.Mesh(geoOf(G.p, G.n, G.c), matBright); gm.frustumCulled = false; scene.add(gm); sleepMeshes.push(gm); }
  }
  // постройка / улучшение / открытие района: один активный «кадр действия»
  let anim = null, fxDirty = false; const flashC = K.white.clone().lerp(K.e1, 0.45);
  function endAnim() { anim = null; UN.cy.value = 99; UN.fl.value = 0; UN.cb.value.set(0, 0, 0, 0); scan.visible = false; need(); }
  function startAnim(t, kind) {
    if (anim) endAnim(); anim = { t0: performance.now(), dur: kind === 'build' ? 650 : 500, kind: kind, t: t };
    UN.cb.value.set(wx(t.x) - 0.02, wz(t.y) - 0.02, wx(t.x + t.w) + 0.02, wz(t.y + t.d) + 0.02); const R = Math.max(t.w, t.d) * 0.8 + 0.8;
    if (kind === 'build') { UN.cy.value = t.base - 0.1; scan.scale.set(t.w + 0.1, 1, t.d + 0.1); scan.position.set(t.ax, t.base - 0.1, t.az); scan.material.opacity = 0.9; scan.visible = true; ringAdd(t.ax, t.base + 0.07, t.az, R, K.e1, 800, 0, 1); ringAdd(t.ax, t.base + 0.07, t.az, R * 0.7, K.e2, 800, 170, 0.8); }
    else { UN.fl.value = 0.7; UN.flc.value.copy(flashC); ringAdd(t.ax, t.base + 0.07, t.az, R * 1.1, flashC, 800, 0, 1); ringAdd(t.ax, t.base + 0.07, t.az, R * 0.7, K.warm, 800, 150, 0.8); }
    need();
  }
  const seen = new Set(), lvOf = {}; let fxReady = false, prevOpen = null;
  function fxDetect(items) {                                                           // кто появился или вырос — после пересборки покажем действие (не при первой загрузке)
    const out = []; items.forEach(it => { if (fxReady) { if (!seen.has(it.u)) out.push([it.u, 'build']); else if ((lvOf[it.u] || 0) < it.l) out.push([it.u, 'up']); } seen.add(it.u); lvOf[it.u] = it.l; }); fxReady = true; return out.length <= 3 ? out : [];
  }
  function fxStart(list) { list.forEach(q => { const t = its.find(z => z.u === q[0]); if (t) startAnim(t, q[1]); }); }
  function districtFx(ds) {                                                            // район открылся: три волны света по земле от его центра
    const cur = {}; ds.forEach(d => { cur[d.id] = d.open; });
    if (prevOpen) ds.forEach(d => { if (d.open && prevOpen[d.id] === false) { const q = MP.DIST[d.id], R = Math.max(q.x1 - q.x0 + 1, q.z1 - q.z0 + 1) * 0.6 + 2.5; for (let k = 0; k < 3; k++) ringAdd(wx((q.x0 + q.x1 + 1) / 2), 0.07, wz((q.z0 + q.z1 + 1) / 2), R, k === 1 ? K.e2 : K.e1, 1300, k * 230, 0.9); need(); } });
    prevOpen = cur;
  }
  function fxTick(now) {
    let act = false;
    for (let i = 0; i < RN; i++) { const q = rg[i]; if (!q.on) continue; const p = (now - q.t0) / q.dur;
      if (p >= 1) { q.on = false; dm.position.set(0, 0, 0); dm.scale.set(0, 0, 0); dm.updateMatrix(); rings.setMatrixAt(i, dm.matrix); rings.setColorAt(i, blackC); fxDirty = true; continue; }
      act = true; if (p < 0) continue;
      const s = q.R * (0.12 + 0.88 * (1 - Math.pow(1 - p, 2.2))) * 2; dm.position.set(q.x, q.y, q.z); dm.rotation.set(0, 0, 0); dm.scale.set(s, 1, s); dm.updateMatrix(); rings.setMatrixAt(i, dm.matrix); rings.setColorAt(i, _cc.copy(q.c).multiplyScalar(Math.pow(1 - p, 1.4) * q.a)); fxDirty = true; }
    for (let i = 0; i < SN; i++) { const q = sp[i]; if (!q.on) continue; const s = (now - q.t0) / 1000, p = s * 1000 / q.life;
      if (p >= 1) { q.on = false; dm.position.set(0, 0, 0); dm.scale.set(0, 0, 0); dm.updateMatrix(); sparks.setMatrixAt(i, dm.matrix); sparks.setColorAt(i, blackC); fxDirty = true; continue; }
      act = true; if (p < 0) continue;
      dm.position.set(q.x + q.vx * s, q.y + q.vy * s * (1 - 0.22 * s), q.z + q.vz * s); dm.quaternion.set(0, 0, 0, 1); const sc = q.sz * (1 - p * 0.55); dm.scale.set(sc, sc, sc); dm.updateMatrix(); sparks.setMatrixAt(i, dm.matrix);
      sparks.setColorAt(i, _cc.copy(K.warm).lerp(K.white, 0.35 * (1 - p)).multiplyScalar(Math.min(1, p * 12) * Math.pow(1 - p, 0.7))); fxDirty = true; }
    if (anim) { const p = (now - anim.t0) / anim.dur;
      if (p >= 1) endAnim(); else { act = true; const e = p * p * (3 - 2 * p);
        if (anim.kind === 'build') { const y = anim.t.base - 0.1 + (anim.t.h + 0.5 - anim.t.base) * e; UN.cy.value = y; scan.position.y = y; scan.material.opacity = 0.9 * (1 - Math.max(0, p - 0.8) * 5); }
        else UN.fl.value = 0.7 * (1 - p) * (1 - p); } }
    if (fxDirty) { rings.instanceMatrix.needsUpdate = true; if (rings.instanceColor) rings.instanceColor.needsUpdate = true; sparks.instanceMatrix.needsUpdate = true; if (sparks.instanceColor) sparks.instanceColor.needsUpdate = true; fxDirty = false; }
    return act;
  }
  let fullAt = 0;
  function liveTick(ts) {                                                              // жизнь города: огни шпилей, лучи прожекторов, вывески, «сон» кварталов, копилка полна
    const ph = Math.floor(ts * 6); if (ph !== bcPh) { bcPh = ph; beaconCols(true, ts); }
    spots.forEach(m => { m.rotation.z = m.userData.z0 + Math.sin(ts * 0.17 + m.userData.ph) * 0.3; m.rotation.x = m.userData.x0 + Math.cos(ts * 0.13 + m.userData.ph) * 0.22; });
    matSign.color.setScalar(0.9 + 0.1 * Math.sin(ts * 3.1) * Math.sin(ts * 1.3 + 1)); sleepLM.opacity = 0.5 + 0.15 * Math.sin(ts * 1.1); sleepFM.opacity = 0.045 + 0.02 * Math.sin(ts * 1.1);
    if (ts - fullAt > 2.8) { fullAt = ts; let n = 0; tags.forEach(t => { if (t.fill >= 0.98 && t.vis && n < 3) { ringAdd(t.x, t.by + 0.07, t.z, 0.95, K.warm, 1200, n * 160, 0.5); n++; } }); }
  }
  function lifeReset() { beaconCols(false, 0); spots.forEach(m => m.rotation.set(m.userData.x0, 0, m.userData.z0)); matSign.color.setScalar(1); sleepLM.opacity = 0.6; sleepFM.opacity = 0.05; }

  /* --- свечение (bloom): свой проход без библиотек. Сцена → цель с половинным разрешением → порог → размытие в два прохода → ещё в четверть → сложение. Только компьютер; сторож качества может выключить --- */
  const bl = { ok: false, on: false };
  (function () {
    try {
      if (mob || !R.capabilities.isWebGL2) return; const ex = R.extensions; if (!(ex.has('EXT_color_buffer_float') || ex.has('EXT_color_buffer_half_float'))) return;
      const opt = (dp, sm) => ({ type: THREE.HalfFloatType, depthBuffer: dp, samples: sm, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
      bl.s = new THREE.WebGLRenderTarget(4, 4, opt(true, ex.has('EXT_color_buffer_float') ? 4 : 0)); bl.a = new THREE.WebGLRenderTarget(4, 4, opt(false, 0)); bl.b = bl.a.clone(); bl.c = bl.a.clone(); bl.d = bl.a.clone();
      const vs = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', mk = (fs, un) => new THREE.ShaderMaterial({ vertexShader: vs, fragmentShader: fs, uniforms: un, depthTest: false, depthWrite: false });
      bl.mBright = mk('uniform sampler2D t; varying vec2 vUv; void main() { vec3 c = texture2D(t, vUv).rgb; float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * smoothstep(0.66, 1.0, l), 1.0); }', { t: { value: null } });
      bl.mBlur = mk('uniform sampler2D t; uniform vec2 d; varying vec2 vUv; void main() { vec3 s = texture2D(t, vUv).rgb * 0.227027; vec2 o1 = d * 1.3846153846, o2 = d * 3.2307692308; s += (texture2D(t, vUv + o1).rgb + texture2D(t, vUv - o1).rgb) * 0.3162162162; s += (texture2D(t, vUv + o2).rgb + texture2D(t, vUv - o2).rgb) * 0.0702702703; gl_FragColor = vec4(s, 1.0); }', { t: { value: null }, d: { value: new THREE.Vector2() } });
      bl.mOut = mk('uniform sampler2D ts, t1, t2; varying vec2 vUv; vec3 enc(vec3 c) { c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(0.416667)) - 0.055, step(0.0031308, c)); } void main() { vec3 c = texture2D(ts, vUv).rgb + texture2D(t1, vUv).rgb * 0.7 + texture2D(t2, vUv).rgb * 0.95; vec3 o = enc(c); float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453); gl_FragColor = vec4(o + (n - 0.5) / 255.0, 1.0); }', { ts: { value: null }, t1: { value: null }, t2: { value: null } });
      bl.q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bl.mBright); bl.q.frustumCulled = false; bl.qs = new THREE.Scene(); bl.qs.add(bl.q); bl.qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); bl.dims = [2, 2, 2, 2];
      bl.ok = true; bl.on = true;
    } catch (e) { bl.ok = false; bl.on = false; }
  })();
  function blSize() {
    if (!bl.ok) return; const pr = R.getPixelRatio(), pw = Math.max(4, Math.round(w * pr)), ph = Math.max(4, Math.round(h * pr)), hw = pw >> 1, hh = ph >> 1, qw = hw >> 1, qh = hh >> 1;
    bl.s.setSize(pw, ph); bl.a.setSize(hw, hh); bl.b.setSize(hw, hh); bl.c.setSize(qw, qh); bl.d.setSize(qw, qh); bl.dims = [hw, hh, qw, qh];
  }
  function bpass(m, rt, tex, dx, dy) { m.uniforms.t.value = tex; if (dx != null) m.uniforms.d.value.set(dx, dy); bl.q.material = m; R.setRenderTarget(rt); R.render(bl.qs, bl.qc); }
  function draw() {
    if (!bl.on) { R.render(scene, cam); return; }
    const D4 = bl.dims; R.setRenderTarget(bl.s); R.render(scene, cam);
    bpass(bl.mBright, bl.a, bl.s.texture); bpass(bl.mBlur, bl.b, bl.a.texture, 1 / D4[0], 0); bpass(bl.mBlur, bl.a, bl.b.texture, 0, 1 / D4[1]);
    bpass(bl.mBlur, bl.c, bl.a.texture, 1.5 / D4[2], 0); bpass(bl.mBlur, bl.d, bl.c.texture, 0, 1.5 / D4[3]);
    const u = bl.mOut.uniforms; u.ts.value = bl.s.texture; u.t1.value = bl.a.texture; u.t2.value = bl.d.texture; bl.q.material = bl.mOut; R.setRenderTarget(null); R.render(bl.qs, bl.qc);
  }
  /* --- сторож качества: первые ~3 с и далее раз в ~5 с — среднее время кадра; хуже 22 мс — по шагам: выключить свечение → плотность пикселей 1,5 → 1 → выключить «жизнь» --- */
  const QG = { acc: [], next: 0, log: [] }; let ambGuard = false, probeEnd = 0;
  const lifeOn = () => ambOn && !ambGuard;
  function setPR(v) { R.setPixelRatio(v); R.setSize(w, h, false); blSize(); need(); }
  function guardTick(now) {
    if (!QG.next || now < QG.next) { if (QG.acc.length > 400) QG.acc.splice(0, 200); return; }
    if (QG.acc.length < 20) return; const a = QG.acc.splice(0).slice(4), avg = a.reduce((s2, x2) => s2 + x2, 0) / Math.max(1, a.length); QG.next = now + 5000; if (!a.length) return;
    const lim = QG.first === undefined && bl.on ? 18.2 : 22; QG.first = 1;                    // первый замер со свечением: меньше 55 к/с — свечение выкл
    if (avg > lim) { let st = '';
      if (bl.on) { bl.on = false; st = 'свечение выкл'; } else if (R.getPixelRatio() > 1.5) { setPR(1.5); st = 'пиксели 1,5'; } else if (R.getPixelRatio() > 1) { setPR(1); st = 'пиксели 1'; } else if (!ambGuard) { ambGuard = true; lifeReset(); st = 'жизнь выкл'; }
      if (st) { QG.log.push(avg.toFixed(1) + ' мс → ' + st); need(); } }
  }

  /* --- пересборка города --- */
  let vitOn = false, meshes = [], its = [], tags = [], ghostMeshes = [], builtSig = '', gSig = '', ovSig = '', dSig = '', ringSig = '', ghostSig = '';
  const killMeshes = list => { list.forEach(o => { scene.remove(o); o.geometry && o.geometry.dispose(); }); list.length = 0; };
  function rebuild(items) {
    killMeshes(meshes); carCount(items.length); its = []; wn = 0; blinkList = []; bcD.length = 0;
    const chunks = {}, S = newSet(), get = k => chunks[k] || (chunks[k] = new Batch()), kc = { b: K.body, b2: K.body2, e1: K.e1, e2: K.e2 };
    items.forEach(it => {
      S.body = get(chunkOf(it.x, it.y)); const rnd = rng(hash(it.id + it.u)), res = addBuilding(S, it, false, kc, rnd), l = it.l;
      its.push({ u: it.u, id: it.id, x: it.x, y: it.y, w: it.w, d: it.d, base: res.base, h: res.base + (res.top + (l >= 5 ? 1.2 : 0.4)) * res.s + 0.2, ax: wx(res.cx), az: wz(res.cz), ay: res.base + (res.top + (l >= 5 ? 1.2 : 0.5)) * res.s + 0.15 });
    });
    Object.keys(chunks).forEach(k => { const one = newSet(); one.body = chunks[k]; flush({ body: chunks[k], glow: new Batch(), beam: new Batch(), fac: new QB(), sign: new QB(), halo: new QB() }, meshes); });
    flush({ shad: S.shad, body: new Batch(), glow: S.glow, beam: S.beam, fac: S.fac, facG: S.facG, facM: S.facM, facS: S.facS, sign: S.sign, halo: S.halo }, meshes);
    wins.count = wn; wins.instanceMatrix.needsUpdate = true; if (wins.instanceColor) wins.instanceColor.needsUpdate = true;
    const pr = propsBatch(items); flush({ body: pr.P, glow: pr.G, beam: new Batch(), fac: new QB(), sign: pr.SG, halo: new QB() }, meshes);
    buildTags(items); setBeacons();
  }
  function paintGhost() {
    killMeshes(ghostMeshes);
    const g = A.ghost(); if (!g) return;
    const kc = g.ok ? { b: K.ok, b2: K.ok, e1: K.okE, e2: K.okE } : { b: K.bad, b2: K.bad, e1: K.badE, e2: K.badE }, S = newSet();
    addBuilding(S, { id: g.id, x: g.x, y: g.y, w: g.w, d: g.d, r: g.r, l: 1, u: 0 }, true, kc, Math.random);
    const b = S.body, m = new THREE.Mesh(geoOf(b.p, b.n, b.c), matGB); m.renderOrder = 3; scene.add(m); ghostMeshes.push(m);
    const ln = new THREE.LineSegments(geoOf(b.lp, null, b.lc), matGL); ln.renderOrder = 4; scene.add(ln); ghostMeshes.push(ln);
  }
  function buildTags(items) {
    tags.forEach(t => t.el.remove()); tags = []; tagBox.querySelectorAll('.gr3-tg').forEach(e => e.remove());
    its.forEach(t => {
      const el = document.createElement('div'); el.className = 'gr3-tg'; el.setAttribute('data-u', t.u);
      el.innerHTML = '<button type="button" class="gr3-nm" data-g="tag" data-u="' + t.u + '">' + A.name(t.id) + '</button><button type="button" class="gr3-amt" data-g="col" data-u="' + t.u + '" hidden></button>';
      tagBox.appendChild(el); tags.push({ el: el, nm: el.firstChild, amt: el.lastChild, x: t.ax, y: t.ay, z: t.az, by: t.base, u: t.u, txt: '', vis: true, sel: false });
    });
    refreshDists(true); upTags();
  }
  let distTags = [];
  function refreshDists(force) {
    const ds = A.districts().filter(d => !d.open), sig = ds.map(d => d.id + d.cond).join('|');
    if (!force && sig === dSig) return; dSig = sig;
    distTags.forEach(t => t.el.remove()); distTags = [];
    ds.forEach(d => { const r = MP.DIST[d.id], el = document.createElement('button'); el.type = 'button'; el.className = 'gr3-ds'; el.setAttribute('data-g', 'dist'); el.setAttribute('data-id', d.id);
      el.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg><b>' + d.name + '</b><small>' + d.cond + '</small>'; tagBox.appendChild(el);
      distTags.push({ el: el, x: wx((r.x0 + r.x1 + 1) / 2), y: 0.2, z: wz((r.z0 + r.z1 + 1) / 2), vis: true }); });
  }

  /* --- кнопки у призрака и кольцо действий у здания: обычные элементы страницы поверх холста --- */
  const gbEl = document.createElement('div'); gbEl.className = 'gr3-gb'; gbEl.hidden = true; tagBox.appendChild(gbEl);
  const ringEl = document.createElement('div'); ringEl.className = 'gr3-ring'; ringEl.hidden = true; tagBox.appendChild(ringEl);
  const SVGI = { col: '<path d="M12 4v16M16 8.5c0-1.7-1.8-2.5-4-2.5s-4 .9-4 2.6c0 3.6 8 1.800 8 5.400 0 1.700-1.800 2.600-4 2.600s-4-.9-4-2.500"/>', up: '<path d="M12 19V6M6 11l6-6 6 6"/>', mv: '<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>', st: '<path d="M4 8h16v11H4zM2 4h20v4H2zM10 12h4"/>', ok: '<path d="M5 12.500l4.500 4.500L19 7"/>', rot: '<path d="M20 11a8 8 0 10-2.300 5.700M20 4v7h-7"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>' };
  const ib = (g, ic, lbl, extra) => '<button type="button" class="gr3-rb' + (extra || '') + '" data-g="' + g + '" aria-label="' + lbl + '" title="' + lbl + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + SVGI[ic] + '</svg></button>';
  let gUI = { x: 0, y: 0, z: 0, vis: false }, ringU = 0, ringPos = { x: 0, y: 0, z: 0 };
  function updGhostUI() {
    const g = A.ghost(); if (!g || !A.ghostUI) { if (!gbEl.hidden) gbEl.hidden = true; gUI.vis = false; return; }
    const u = A.ghostUI(), sig = [g.ok ? 1 : 0, u.msg, u.price, u.rot ? 1 : 0, u.mv ? 1 : 0].join('|');
    if (sig !== ghostSig) { ghostSig = sig; gbEl.className = 'gr3-gb ' + (g.ok ? 'ok' : 'bad'); gbEl.innerHTML = '<div class="gr3-gm">' + u.msg + '</div><div class="gr3-gk">' + (u.rot ? ib('pmrot', 'rot', u.lRot) : '') + ib('pmok', 'ok', u.lOk, g.ok ? '' : ' off') + ib('pmx', 'x', u.lNo) + '</div>'; }
    gbEl.hidden = false; const dm2 = DIM[g.id] || [1.5, 1.2]; gUI.x = wx(g.x + g.w / 2); gUI.z = wz(g.y + g.d / 2); gUI.y = elevAt(g.x, g.y) + 1.5 + 0.12 * Math.max(g.w, g.d); gUI.vis = true;
  }
  function updRing() {
    const d = A.ring ? A.ring() : null, sig = d ? d.u + '|' + d.btns.map(b => b.g + (b.off ? 'o' : '') + (b.need ? 'n' : '')).join(',') : '';
    if (sig !== ringSig) { ringSig = sig; ringU = d ? d.u : 0;
      if (!d) { ringEl.hidden = true; ringEl.innerHTML = ''; }
      else { const n = d.btns.length; ringEl.innerHTML = d.btns.map((b, i) => { const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.95 + (n === 1 ? 0 : 0); return '<button type="button" class="gr3-rb' + (b.off ? ' off' : '') + '" data-g="' + b.g + '" data-u="' + d.u + '"' + (b.need ? ' data-need="1"' : '') + ' aria-label="' + b.lbl + '" title="' + b.lbl + '" style="--rx:' + (Math.cos(a) * 70).toFixed(1) + 'px;--ry:' + (Math.sin(a) * 70 + 6).toFixed(1) + 'px"><svg viewBox="0 0 24 24" aria-hidden="true">' + SVGI[b.ic] + '</svg><i>' + (b.t || '') + '</i></button>'; }).join(''); ringEl.hidden = false; }
    }
    if (d) { const t = its.find(q => q.u === d.u); if (t) { ringPos.x = t.ax; ringPos.y = t.base + 0.3; ringPos.z = t.az; } else ringEl.hidden = true; }
  }
  function upTags() {                                        // подписи: сумма над зданием, имя вблизи; положение — по камере
    const items = A.items(), by = {}; items.forEach(i => { by[i.u] = i; });
    const near = dist < fit * 0.62; rootEl.classList.toggle('near', near);
    tags.forEach(t => {
      const i = by[t.u]; if (i) { const a = i.txt || ''; if (a !== t.txt) { t.txt = a; t.amt.textContent = a; t.amt.hidden = !a; } const pf = t.fill || 0; t.fill = i.fill || 0; t.v = i.v || 0; if (pf > 0.04 && t.fill < 0.02 && !vitOn && t.vis) sparkBurst(t.x, t.by + 0.5, t.z); if (t.sel !== !!i.sel) { t.sel = !!i.sel; t.el.classList.toggle('sel', t.sel); } }
      pos(t);
    });
    distTags.forEach(pos); updGhostUI(); updRing();
    const bld = A.building ? A.building() : A.placing(); if (bld !== bldOn) { bldOn = bld; rootEl.classList.toggle('bld', bld); }          // стройка: ярлыки дохода скрыты полностью
    if (++dcTick % 6 === 0) declutter(); clearTimeout(dcT); dcT = setTimeout(declutter, 110);
    if (gUI.vis) { _pv.set(gUI.x, gUI.y, gUI.z).project(cam); const ok = _pv.z < 1; gbEl.style.transform = ok ? 'translate(' + clamp((_pv.x + 1) / 2 * w, 76, w - 76).toFixed(1) + 'px,' + clamp((1 - _pv.y) / 2 * h, 118, h - 24).toFixed(1) + 'px)' : 'translate(-999px,-999px)'; }
    if (!ringEl.hidden) { _pv.set(ringPos.x, ringPos.y, ringPos.z).project(cam); ringEl.style.transform = 'translate(' + ((_pv.x + 1) / 2 * w).toFixed(1) + 'px,' + ((1 - _pv.y) / 2 * h).toFixed(1) + 'px)'; }
  }
  const _pv = new THREE.Vector3();
  /* ярлыки дохода: не наползают друг на друга. Раз в несколько кадров (и когда движение кончилось) оставляем ближние к камере, пересекающиеся прячем;
     на телефоне — только заполненные от 25 %; при сильном отдалении вместо россыпи — один общий значок сбора */
  let bldOn = false, dcTick = 0, dcT = 0; const abEl = document.createElement('button'); abEl.type = 'button'; abEl.className = 'gr3-ab'; abEl.setAttribute('data-g', 'all'); abEl.hidden = true; tagBox.appendChild(abEl);
  function declutter() {
    dcT = 0; if (!inst || !w) return; const bld = bldOn, far = dist > fit * 1.55, cand = [], used = []; let sum = 0, n = 0, ax = 0, ay = 0;
    tags.forEach(t => { t.dd = Math.hypot(cam.position.x - t.x, cam.position.y - t.y, cam.position.z - t.z); if (t.txt && t.vis) { sum += t.v || 0; n++; ax += t.sx; ay += t.sy; } });
    tags.forEach(t => { const want = !bld && t.txt && t.vis && (t.sel || (!far && (!mob || (t.fill || 0) >= 0.25))); if (want) cand.push(t); else if (t.hid !== true) { t.hid = true; t.el.classList.add('ov'); } });
    cand.sort((a, b) => (b.sel ? 1 : 0) - (a.sel ? 1 : 0) || a.dd - b.dd);
    cand.forEach(t => { const hw = (t.txt.length * 7.4 + 24) / 2, r = [t.sx - hw - 3, t.sy - 33, t.sx + hw + 3, t.sy]; let hit = false;
      if (!t.sel) for (let k = 0; k < used.length; k++) { const u = used[k]; if (r[0] < u[2] && r[2] > u[0] && r[1] < u[3] && r[3] > u[1]) { hit = true; break; } }
      if (hit) { if (t.hid !== true) { t.hid = true; t.el.classList.add('ov'); } } else { used.push(r); if (t.hid !== false) { t.hid = false; t.el.classList.remove('ov'); } } });
    const showB = !bld && far && n >= 2 && sum >= 1;
    if (showB) { const tx = '+' + (A.fmt ? A.fmt(sum) : Math.round(sum)); if (abEl.textContent !== tx) abEl.textContent = tx; abEl.style.transform = 'translate(' + clamp(ax / n, 50, w - 50).toFixed(1) + 'px,' + clamp(ay / n, 60, h - 40).toFixed(1) + 'px)'; }
    if (abEl.hidden === showB) abEl.hidden = !showB;
  }
  function pos(t) {
    _pv.set(t.x, t.y, t.z).project(cam); const ok = _pv.z < 1 && Math.abs(_pv.x) < 1.15 && Math.abs(_pv.y) < 1.15;
    if (ok !== t.vis) { t.vis = ok; t.el.style.display = ok ? '' : 'none'; }
    t.sx = (_pv.x + 1) / 2 * w; t.sy = (1 - _pv.y) / 2 * h;
    if (ok) t.el.style.transform = 'translate(' + ((_pv.x + 1) / 2 * w).toFixed(1) + 'px,' + ((1 - _pv.y) / 2 * h).toFixed(1) + 'px)';
  }

  /* --- камера и ввод ---
     левая кнопка / один палец — сдвиг; правая или средняя кнопка — поворот и наклон; два пальца — щипок = масштаб, закручивание = поворот;
     колесо — масштаб к точке под курсором; Q/E — поворот; переключатель «Сдвиг ↔ Поворот»: в режиме «Поворот» одним пальцем/левой кнопкой вращают карту.
     Поворот с инерцией; наклон ограничен (не под землю, не строго сверху). */
  const TG = new THREE.Vector3(-6.5, 0, -3.5), EL0 = 0.95, AZ0 = 0.52, EL_MIN = 0.42, EL_MAX = 1.28;
  let az = AZ0, azT = AZ0, el = EL0, elT = EL0, dist = 20, distT = 20, fit = 20, raf = 0, dirty = true, bench = 0, w = 0, h = 0, tgT = null, last = 0, azV = 0, rotMode = false, ambOn = true, ambVis = true, ambLast = 0, ambT0 = performance.now();
  try { const v = localStorage.getItem('dofa_gr_amb'); ambOn = v === null ? !mob : v === '1'; } catch (e) { /* ничего */ }   // на телефоне «жизнь города» по умолчанию выключена (батарея), включается кнопкой
  const pv = { x: 0, z: 0 }; const ptr = new Map(); let drag = null, pinch = 0, twist = 0, edge = null, lpTimer = 0;
  const tf = Math.tan(cam.fov * Math.PI / 360);
  function fitDist() {                                       // стартовая дальность (этап 3б — ближе): ~10–12 клеток в ширину на телефоне стоя … ~21 на широком экране
    const a = Math.max(0.4, w / Math.max(1, h)), span = clamp(10.4 + 10 * (a - 0.5), 10.4, 21); return span / (2 * tf * a);
  }
  const dMin = () => fit * 0.3, dMax = () => Math.min(fit * 2.9, 44 / (2 * tf * Math.max(0.4, w / Math.max(1, h))));
  function resize() {
    const r = rootEl.getBoundingClientRect(); if (r.width < 10 || r.height < 10) return;
    w = Math.round(r.width); h = Math.round(r.height); R.setSize(w, h, false); blSize(); cam.aspect = w / h; cam.updateProjectionMatrix();
    const old = fit; fit = fitDist(); if (!old) { dist = distT = fit; focusStart(); QG.next = performance.now() + 2900; probeEnd = QG.next - 100; } else { distT = distT / old * fit; dist = dist / old * fit; } need();
  }
  const LIM = { x: () => W / 2 - 2, z0: () => -D / 2 + 1, z1: () => D / 2 - 2.5 };
  function clampTG() { TG.x = clamp(TG.x, -W / 2 + 2, LIM.x()); TG.z = clamp(TG.z, LIM.z0(), LIM.z1()); }
  function place() {
    clampTG(); el = clamp(el, EL_MIN, EL_MAX);
    cam.position.set(TG.x + dist * Math.cos(el) * Math.sin(az), TG.y + dist * Math.sin(el), TG.z + dist * Math.cos(el) * Math.cos(az)); cam.lookAt(TG); sky.position.copy(cam.position);
  }
  function focusStart() {                                    // стартовый вид — на застроенную часть (или на стартовый район)
    const its2 = A.items(); let sx = 0, sz = 0, n = 0; its2.forEach(i => { sx += i.x + i.w / 2; sz += i.y + i.d / 2; n++; });
    const c = n ? { x: sx / n, z: sz / n } : { x: MP.START.x + 0.5, z: MP.START.z + 0.5 }; TG.set(wx(c.x), 0, wz(c.z)); clampTG();
  }
  const stats = { dt: [], cpu: [] };
  const blinkTick = t => { if (!blinkList.length) return; const n = 1 + (Math.random() * 2 | 0); for (let i = 0; i < n; i++) { const k = blinkList[Math.random() * blinkList.length | 0]; wins.setColorAt(k, Math.random() < 0.55 ? off : (Math.random() < 0.5 ? lit1 : lit2)); } if (wins.instanceColor) wins.instanceColor.needsUpdate = true; };
  let blinkAt = 0;
  function frame(t) {
    raf = 0; if (!inst) return;
    if (document.hidden) return;
    let moving = false;
    if (Math.abs(distT - dist) > fit * 0.002) { dist += (distT - dist) * 0.24; moving = true; } else dist = distT;
    if (Math.abs(azT - az) > 0.002) { az += (azT - az) * 0.22; moving = true; } else az = azT;
    if (Math.abs(elT - el) > 0.002) { el += (elT - el) * 0.22; moving = true; } else el = elT;
    if (!drag && ptr.size === 0 && Math.abs(azV) > 0.0006) { azT = az = az + azV; azV *= 0.93; moving = true; } else if (!drag && ptr.size === 0) azV = 0;
    if (!drag && ptr.size === 0 && (Math.abs(pv.x) + Math.abs(pv.z) > 0.004)) { const b0 = tgT || TG; tgT = { x: clamp(b0.x + pv.x, -W / 2 + 2, LIM.x()), z: clamp(b0.z + pv.z, LIM.z0(), LIM.z1()) }; pv.x *= 0.92; pv.z *= 0.92; moving = true; } else if (!drag) { pv.x = pv.z = 0; }
    if (edge) { const sp = 0.16 * dist / fit; TG.x += (edge.x * Math.cos(az) - edge.z * Math.sin(az)) * sp; TG.z += (-edge.x * Math.sin(az) - edge.z * Math.cos(az)) * sp; moving = true; if (edge.cell) { const c = cellAt(edge.px, edge.py - edge.off); if (c) A.cell(c.cx, c.cz, false); } }
    if (tgT) { const dx = tgT.x - TG.x, dz = tgT.z - TG.z; if (Math.abs(dx) + Math.abs(dz) > 0.02) { TG.x += dx * 0.3; TG.z += dz * 0.3; moving = true; } else { TG.x = tgT.x; TG.z = tgT.z; tgT = null; } }
    if (Math.abs(dimT - dimK) > 0.01) { dimK += (dimT - dimK) * 0.2; moving = true; } else dimK = dimT;
    if (bench) { azT = az += 0.012; moving = true; if (t - bench0 > benchMs) { bench = 0; moving = false; benchDone && benchDone(); } }
    const nowp = performance.now(); if (fxTick(nowp)) moving = true; if (nowp < probeEnd) moving = true;
    let live = false;
    if (!moving && !dirty && !bench && lifeOn() && ambVis && !document.hidden) {                         // «жизнь города»: редкие кадры, только пока карта на экране
      live = true; ambLast = t; const ts = (performance.now() - ambT0) / 1000; moveCars(ts); wtex.offset.x = (ts * 0.012) % 1; wtex.offset.y = (Math.sin(ts * 0.4) * 0.02);
      if (t - blinkAt > 1300) { blinkAt = t; blinkTick(t); } liveTick(ts);
    }
    if (moving || dirty || live) {
      dirty = false; const c0 = performance.now(); applyDim(); place(); R.info.reset(); draw(); upTags(); stats.cpu.push(performance.now() - c0); if (stats.cpu.length > 240) stats.cpu.shift();
      if (last && !live) { const dtv = t - last; stats.dt.push(dtv); if (stats.dt.length > 240) stats.dt.shift(); if (dtv < 100) QG.acc.push(dtv); } last = live ? 0 : t;
    } else last = 0;
    guardTick(nowp);
    if (moving || bench) raf = requestAnimationFrame(frame);
    else { last = 0; if (lifeOn() && ambVis && !document.hidden) { clearTimeout(tmo); tmo = setTimeout(() => { tmo = 0; if (!raf && inst) raf = requestAnimationFrame(frame); }, mob ? 55 : 42); } }
  }
  function applyDim() {
    const k = 1 - 0.58 * dimK; groundMat.color.setScalar(k); amb.intensity = 0.8 * (1 - 0.45 * dimK); hemi.intensity = 0.55 * (1 - 0.45 * dimK); sun.intensity = 0.95 * (1 - 0.4 * dimK);
    matBody.color.setScalar(1 - 0.25 * dimK); gridMesh.material.opacity = 0.1 + 0.42 * dimK; waterGlint.material.opacity = 0.8 * (1 - 0.5 * dimK);
  }
  let tmo = 0;
  function need() { dirty = true; if (!raf && inst) { clearTimeout(tmo); raf = requestAnimationFrame(frame); } }
  let bench0 = 0, benchMs = 0, benchDone = null;

  const ray = new THREE.Raycaster(), v2 = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3(), box3 = new THREE.Box3();
  function setRay(cx, cy) { const r = canvas.getBoundingClientRect(); v2.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); ray.setFromCamera(v2, cam); }
  function groundAt(cx, cy) { setRay(cx, cy); return ray.ray.intersectPlane(plane, hit) ? hit.clone() : null; }
  function cellAt(cx, cy) { const p = groundAt(cx, cy); if (!p) return null; const c = Math.floor(p.x + W / 2), z = Math.floor(p.z + D / 2); return c >= 0 && z >= 0 && c < W && z < D ? { cx: c, cz: z } : null; }
  function itemAt(cx, cy) {
    setRay(cx, cy); let best = null, bd = 1e9;
    its.forEach(t => { box3.min.set(wx(t.x), 0, wz(t.y)); box3.max.set(wx(t.x + t.w), t.h, wz(t.y + t.d)); const q = ray.ray.intersectBox(box3, _pv); if (q) { const d = ray.ray.origin.distanceTo(q); if (d < bd) { bd = d; best = t; } } });
    return best ? best.u : 0;
  }
  function keepGhost() {                                    // призрак и выбранное здание не должны уходить под нижнюю панель, кнопки и края
    const g = A.ghost(), su = !g && A.sel ? A.sel() : 0, t = su ? its.find(q => q.u === su) : null; if ((!g && !t) || (drag && drag.ghost) || !w) return;
    const low = document.getElementById('gr3low'), sh = low && low.firstElementChild, r = canvas.getBoundingClientRect(), sr = sh ? sh.getBoundingClientRect() : null;
    if (g) _pv.set(wx(g.x + g.w / 2), elevAt(g.x, g.y) + 0.4, wz(g.y + g.d / 2)); else _pv.set(t.ax, t.base + 0.5, t.az);
    place(); cam.updateMatrixWorld(); _pv.project(cam);
    const sx = (_pv.x + 1) / 2 * w, sy = (1 - _pv.y) / 2 * h; let tx = clamp(sx, 80, w - 84), ty = clamp(sy, 112, h - 24);
    if (sr && sr.height > 4) {                                // нижняя панель: уйти выше неё, а если она занимает только левую часть — можно и правее
      const top = sr.top - r.top, right = sr.right - r.left, above = Math.max(140, top - 50);
      const hit = tx < right + 30 && ty > above;
      if (hit) { const mvUp = ty - above, canRight = right < w - 150, mvR = canRight ? right + 40 - tx : 1e9; if (mvR < mvUp) tx = right + 40; else ty = above; }
    }
    if (Math.abs(tx - sx) + Math.abs(ty - sy) < 2) return;
    const g0 = groundAt(r.left + sx, r.top + sy), g1 = groundAt(r.left + tx, r.top + ty);
    if (g0 && g1) { const b0 = tgT || TG; tgT = { x: clamp(b0.x + g0.x - g1.x, -W / 2 + 2, LIM.x()), z: clamp(b0.z + g0.z - g1.z, LIM.z0(), LIM.z1()) }; need(); }
  }
  const TOUCH_OFF = 58;                                      // на телефоне призрак смещён выше пальца
  const nearGhost = (cx, cy) => { const g = A.ghost(); if (!g) return false; const c = cellAt(cx, cy - 0), c2 = cellAt(cx, cy - TOUCH_OFF); const t = (q, m) => q && q.cx >= g.x - m && q.cx < g.x + g.w + m && q.cz >= g.y - m && q.cz < g.y + g.d + m; return t(c, 1.6) || t(c2, 1.2); };
  const setEdge = (e, on) => { if (!on) { edge = null; return; } const r = canvas.getBoundingClientRect(), m = 52; let x = 0, z = 0; if (e.clientX < r.left + m) x = -1; else if (e.clientX > r.right - m) x = 1; if (e.clientY < r.top + m) z = -1; else if (e.clientY > r.bottom - m) z = 1; edge = x || z ? { x: x, z: z, cell: true, px: e.clientX, py: e.clientY, off: e.pointerType === 'touch' ? TOUCH_OFF : 0 } : null; if (edge) need(); };
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId); ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
    clearTimeout(lpTimer);
    if (ptr.size === 1) {
      const mouseRot = e.pointerType === 'mouse' && (e.button === 2 || e.button === 1);
      drag = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t: performance.now(), moved: 0, rot: mouseRot || (rotMode && e.button === 0), forced: mouseRot, ghost: false, pt: e.pointerType, item: 0 };
      if (!mouseRot && e.button === 0) {
        if (A.placing()) { if (nearGhost(e.clientX, e.clientY)) { drag.ghost = true; drag.rot = false; } }
        else { const u = itemAt(e.clientX, e.clientY); if (u) { drag.item = u; lpTimer = setTimeout(() => { if (drag && drag.item === u && drag.moved <= 6 && A.beginMove && A.beginMove(u)) { drag.ghost = true; drag.rot = false; drag.longp = true; } }, 460); } }
      }
      if (drag.rot) canvas.style.cursor = 'move';
    } else drag = null;
    if (ptr.size === 2) { const a = [...ptr.values()]; pinch = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); twist = Math.atan2(a[1].y - a[0].y, a[1].x - a[0].x); }
    tgT = null; pv.x = pv.z = 0; azV = 0;
  });
  canvas.addEventListener('pointermove', e => {
    const p = ptr.get(e.pointerId);
    if (!p) return;                                            // 19.11: призрак за курсором не ходит — кнопки «Поставить» и «Отмена» убегали от мышки (слово Романа); двигается нажатием на клетку или перетаскиванием
    if (ptr.size === 2) {
      p.x = e.clientX; p.y = e.clientY; const a = [...ptr.values()], d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), an = Math.atan2(a[1].y - a[0].y, a[1].x - a[0].x);
      if (pinch > 0) { distT = clamp(distT * pinch / d, dMin(), dMax()); dist = distT; }
      let da = an - twist; if (da > Math.PI) da -= 6.2832; if (da < -Math.PI) da += 6.2832; azT = az = az + da; pinch = d; twist = an; need(); return;   // 19.11: было «- da» — карта крутилась против пальцев (слово Романа: «управление инвертировано»)
    }
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.moved += Math.abs(dx) + Math.abs(dy);
    if (drag.item && !drag.ghost && !A.placing() && drag.item === (A.sel ? A.sel() : 0) && drag.moved > 10 && A.beginMove && A.beginMove(drag.item)) { drag.ghost = true; drag.rot = false; clearTimeout(lpTimer); }   // перетаскивание выбранного здания
    if (drag.ghost) {
      drag.x = e.clientX; drag.y = e.clientY; const c = cellAt(e.clientX, e.clientY - (drag.pt === 'touch' ? TOUCH_OFF : 0)); if (c) A.cell(c.cx, c.cz, false); setEdge(e, true); drag.moved = Math.max(drag.moved, 7); return;
    }
    if (drag.rot) {
      if (drag.moved > 4) canvas.style.cursor = 'move';
      const da = -dx * 0.008; azT = az = az + da; azV = azV * 0.5 + da * 0.5; elT = el = clamp(el + dy * 0.008, EL_MIN, EL_MAX); drag.x = e.clientX; drag.y = e.clientY; need(); return;
    }
    drag.tm = performance.now(); clearTimeout(lpTimer);
    if (drag.moved > 6) {                                      // сдвиг: точка под пальцем остаётся под пальцем
      const g0 = groundAt(drag.x, drag.y), g1 = groundAt(e.clientX, e.clientY); drag.x = e.clientX; drag.y = e.clientY;
      if (g0 && g1) { const k = 1.4, dx2 = (g0.x - g1.x) * k, dz2 = (g0.z - g1.z) * k, b0 = tgT || TG; tgT = { x: clamp(b0.x + dx2, -W / 2 + 2, LIM.x()), z: clamp(b0.z + dz2, LIM.z0(), LIM.z1()) }; pv.x = pv.x * 0.4 + dx2 * 0.6; pv.z = pv.z * 0.4 + dz2 * 0.6; need(); }
    }
  });
  const up = e => {
    const had = ptr.has(e.pointerId); ptr.delete(e.pointerId); if (!had) return; clearTimeout(lpTimer); edge = null; canvas.style.cursor = rotMode ? 'move' : 'grab';
    if (drag && e.type === 'pointerup' && !drag.ghost && !drag.forced && drag.moved <= 6 && performance.now() - drag.t < 700) {
      const c = cellAt(e.clientX, e.clientY);
      if (A.placing()) { if (c) A.cell(c.cx, c.cz, true); }
      else { const u = itemAt(e.clientX, e.clientY); if (u) A.tapItem(u); else A.tapCell(c ? c.cx : -1, c ? c.cz : -1); }
    }
    if (drag && drag.ghost && e.type === 'pointerup' && A.dropGhost) A.dropGhost();
    if (drag && (drag.rot || drag.ghost || performance.now() - (drag.tm || 0) > 90)) { pv.x = pv.z = 0; }
    if (ptr.size < 2) { pinch = 0; } const wasGhost = drag && drag.ghost; drag = null; if (wasGhost && A.placing()) keepGhost(); if (Math.abs(pv.x) + Math.abs(pv.z) > 0.004 || Math.abs(azV) > 0.0006) need();
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', e => {
    e.preventDefault(); const old = distT; distT = clamp(distT * Math.exp(e.deltaY * 0.0022), dMin(), dMax());
    const p = groundAt(e.clientX, e.clientY); if (p && old !== distT) { const f = 1 - distT / old, b0 = tgT || TG; tgT = { x: clamp(b0.x + (p.x - b0.x) * f, -W / 2 + 2, LIM.x()), z: clamp(b0.z + (p.z - b0.z) * f, LIM.z0(), LIM.z1()) }; }
    need();
  }, { passive: false });
  const onKey = e => {
    if (!inst || e.ctrlKey || e.metaKey || e.altKey) return; const tg = e.target && e.target.tagName; if (tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT') return;
    const vw = document.getElementById('v-gorod'); if (vw && vw.hidden) return;
    if (e.code === 'KeyQ') { azT -= Math.PI / 12; need(); } else if (e.code === 'KeyE') { azT += Math.PI / 12; need(); } else if (e.code === 'KeyR' && A.placing()) { A.rotGhost && A.rotGhost(); }
  };
  document.addEventListener('keydown', onKey);
  const onLost = e => { e.preventDefault(); if (inst && inst.root === rootEl) A.fail && A.fail(true); };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.style.cursor = 'grab';

  const ro = window.ResizeObserver ? new ResizeObserver(() => resize()) : null; if (ro) ro.observe(rootEl);
  const io = window.IntersectionObserver ? new IntersectionObserver(en => { ambVis = en[0].isIntersecting; if (ambVis) need(); }, { threshold: 0.05 }) : null; if (io) io.observe(rootEl);
  const wd = setInterval(() => {                           // раздел закрыт или заменён — освободить сцену
    const vw = document.getElementById('v-gorod');
    if (!inst) return; if (!rootEl.isConnected || (vw && vw.hidden)) api3.dispose();
  }, 1000);
  const onVis = () => { if (!document.hidden) need(); };
  document.addEventListener('visibilitychange', onVis);

  inst = {
    root: rootEl, box: null, need: need, resize: resize,
    update() {
      if (vitOn) return; const items = A.items(), sig = items.map(s => s.id + ':' + s.u + ':' + s.l + ':' + s.x + ':' + s.y + ':' + s.r).join(',') + '|' + A.lang(); let ch = false;
      if (sig !== builtSig) { builtSig = sig; const born = fxDetect(items); rebuild(items); fxStart(born); ch = true; }
      const dsig = A.districts().map(d => d.id + (d.open ? 1 : 0)).join('');
      if (dsig !== gSig) { const first = gSig === ''; gSig = dsig; paintGround(); paintSleep(); districtFx(A.districts()); refreshDists(true); ch = true; if (!first) { builtSig = ''; rebuild(items); } }
      const o = A.ovSig(); if (o !== ovSig) { ovSig = o; paintOverlay(); paintGhost(); ch = true; keepGhost(); } else upTags();
      const dt = A.placing() ? 1 : 0; if (dt !== dimT) { dimT = dt; ch = true; }
      if (ch) need();
    },
    zoom(f) { distT = clamp(distT * f, dMin(), dMax()); need(); },
    rot(a) { azT += a; need(); },
    home() { azT = AZ0; elT = EL0; distT = fit; focusStart(); need(); },
    focus(cx, cz) { tgT = { x: clamp(wx(cx), -W / 2 + 2, LIM.x()), z: clamp(wz(cz), LIM.z0(), LIM.z1()) }; need(); },
    center() { return { cx: Math.floor(TG.x + W / 2), cz: Math.floor(TG.z + D / 2) }; },
    mode(m) { if (m != null) { rotMode = !!m; canvas.style.cursor = rotMode ? 'move' : 'grab'; rootEl.classList.toggle('rot', rotMode); } return rotMode; },
    live(on) { if (on != null) { ambOn = !!on; try { localStorage.setItem('dofa_gr_amb', ambOn ? '1' : '0'); } catch (e) { /* ничего */ } if (!ambOn) { moveCars(0); lifeReset(); } need(); } return ambOn; },
    view(a, e2, d2) { if (a != null) azT = az = a; if (e2 != null) elT = el = e2; if (d2 != null) distT = dist = d2; need(); },
    bench(ms) { return new Promise(res => { stats.dt.length = 0; stats.cpu.length = 0; bench0 = performance.now(); bench = 1; benchMs = ms; benchDone = () => { const a = stats.dt.slice(), n = a.length, avg = a.reduce((s, x) => s + x, 0) / Math.max(1, n); a.sort((x, y) => x - y); res({ frames: n, avgMs: +avg.toFixed(2), fps: +(1000 / avg).toFixed(1), p95Ms: +(a[Math.floor(n * 0.95)] || 0).toFixed(1), maxMs: +(a[n - 1] || 0).toFixed(1), cpuAvgMs: +(stats.cpu.reduce((q, x) => q + x, 0) / Math.max(1, stats.cpu.length)).toFixed(2), cpuMaxMs: +Math.max(0, ...stats.cpu).toFixed(1) }); }; need(); }); },
    vitrina(list, o) {                                         // витрина для снимков: показать только указанные здания (без правил), камера — крупно
      o = o || {}; vitOn = true; builtSig = 'vit'; rebuild(list); tags.forEach(t => { t.el.style.display = 'none'; t.vis = false; });
      const q = list[0], t0 = its[0], hh = t0 ? t0.h : 1.5; if (q) { TG.set(wx(q.x + q.w / 2), hh * 0.38, wz(q.y + q.d / 2)); tgT = null; }
      azT = az = o.az != null ? o.az : 0.62; elT = el = o.el != null ? o.el : 0.5; distT = dist = o.dist || (Math.max(q ? q.w : 2, q ? q.d : 2) * 1.3 + hh * 1.5 + 1.6); need();
    },
    stop() {
      canvas.removeEventListener('webglcontextlost', onLost); clearInterval(wd); document.removeEventListener('visibilitychange', onVis); document.removeEventListener('keydown', onKey); if (ro) ro.disconnect(); if (io) io.disconnect(); if (raf) cancelAnimationFrame(raf); raf = 0; clearTimeout(tmo);
      killMeshes(meshes); killMeshes(ghostMeshes); killMeshes(staticMeshes); killMeshes(sleepMeshes); [rings, sparks, bcM].forEach(m => m.dispose && m.dispose()); ['s', 'a', 'b', 'c', 'd'].forEach(k => bl[k] && bl[k].dispose()); disp.forEach(o => o.dispose && o.dispose()); wins.dispose && wins.dispose(); ov.dispose && ov.dispose(); carM.forEach(m => m.dispose()); lampM.dispose(); beamM.dispose(); tlM.dispose();
      try { R.dispose(); R.forceContextLoss(); } catch (e) { /* ничего */ }
      rootEl.remove();
    },
    cellScreen(cx, cz) { place(); cam.updateMatrixWorld(); const v = new THREE.Vector3(wx(cx + 0.5), elevAt(cx, cz) + 0.1, wz(cz + 0.5)).project(cam), r = canvas.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; },
    screen(u) { const t = its.find(q => q.u === u); if (!t) return null; place(); cam.updateMatrixWorld(); const v = new THREE.Vector3(t.ax, t.base + 0.5, t.az).project(cam), r = canvas.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; },
    carsDbg: () => ({ n: carN, x: Array.from(cX.subarray(0, carN)), z: Array.from(cZ.subarray(0, carN)), v: Array.from(cV.subarray(0, carN)), k: Array.from(cKind.subarray(0, carN)), t: Array.from(cTurn.subarray(0, carN)) }),
    info: () => ({ calls: R.info.render.calls, tris: R.info.render.triangles, geos: R.info.memory.geometries, tex: R.info.memory.textures, wins: wn, items: its.length, dpr: R.getPixelRatio(), dist: +dist.toFixed(1), fit: +fit.toFixed(1), az: +az.toFixed(3), el: +el.toFixed(3), rotMode: rotMode, bloom: bl.on, life: lifeOn(), q: QG.log.slice(), sparks: sp.filter(q => q.on).length, cars: carN, carMs: carMsN ? +(carMs / carMsN).toFixed(3) : 0 })
  };
  paintGround(); paintSleep(); districtFx(A.districts());
  flush(buildStatic(), staticMeshes); setBeacons();
  return inst;
}

const api3 = {
  supported: () => canGL(),
  mount(box, api) {
    A = api; if (!box) return;
    if (inst) { inst.box = box; box.innerHTML = ''; box.appendChild(inst.root); inst.update(); inst.resize(); inst.need(); return; }
    pendBox = box; if (box.getAttribute('data-ld') !== '1') { box.setAttribute('data-ld', '1'); box.innerHTML = '<p class="gr3-ld">' + (A.loading || '…') + '</p>'; }
    loadThree().then(() => {
      if (inst) { return; }
      const b = pendBox; if (!b || !b.isConnected) return;
      let i; try { i = build(b); } catch (e) { if (root.console && console.warn) console.warn('gorod3d', e); A.fail && A.fail(false); return; }
      i.box = b; b.innerHTML = ''; b.appendChild(i.root); i.update(); i.resize();
      document.documentElement.setAttribute('data-gr3', '1');
    }).catch(() => { A.fail && A.fail(false); });
  },
  update() { if (inst && A) inst.update(); },
  dispose() { if (inst) { const i = inst; inst = null; i.stop(); } pendBox = null; document.documentElement.removeAttribute('data-gr3'); },
  alive: () => !!inst,
  zoom: f => inst && inst.zoom(f), rot: a => inst && inst.rot(a), home: () => inst && inst.home(), focus: (x, z) => inst && inst.focus(x, z), center: () => (inst ? inst.center() : null),
  mode: m => (inst ? inst.mode(m) : false), live: on => (inst ? inst.live(on) : false), view: (a, e, d) => inst && inst.view(a, e, d), vitrina: (l, o) => inst && inst.vitrina(l, o), carsDbg: () => (inst ? inst.carsDbg() : null),
  bench: ms => (inst ? inst.bench(ms) : Promise.resolve(null)),
  screen: u => (inst ? inst.screen(u) : null), cellScreen: (x, z) => (inst ? inst.cellScreen(x, z) : null),
  info: () => (inst ? inst.info() : null)
};
root.DofaGorod3D = api3;
})(window);
