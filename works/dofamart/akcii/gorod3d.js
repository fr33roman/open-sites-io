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
  R.setPixelRatio(Math.min(window.devicePixelRatio || 1, mob ? 1.5 : 2)); R.setClearColor(BG, 1);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(BG); scene.fog = new THREE.FogExp2(0x070d1c, 0.0092);
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
    }
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
  function paintGround() {
    const x = gx, P = c => c * TS, o = MG, doors = A.districts(), ew = W * TS, ed = D * TS;
    x.fillStyle = '#050a14'; x.fillRect(0, 0, gc.width, gc.height);
    // за краем карты — тёмная земля с редкой сеткой и мягким затуханием
    const bg = x.createLinearGradient(0, 0, 0, P(o + 27)); bg.addColorStop(0, '#060c1a'); bg.addColorStop(1, '#0a1630'); x.fillStyle = bg; x.fillRect(0, 0, gc.width, P(o + 27));
    x.strokeStyle = css(C1) + '10'; x.lineWidth = 1; x.beginPath();
    for (let i = 0; i <= GWc; i++) { x.moveTo(P(i) + .5, 0); x.lineTo(P(i) + .5, P(o + 27)); } for (let j = 0; j <= o + 27; j++) { x.moveTo(0, P(j) + .5); x.lineTo(gc.width, P(j) + .5); } x.stroke();
    // вода: глубокий градиент, береговая пена, блики
    const sea = x.createLinearGradient(0, P(o + 27), 0, gc.height); sea.addColorStop(0, '#0b4666'); sea.addColorStop(0.12, '#083a58'); sea.addColorStop(0.5, '#062a45'); sea.addColorStop(1, '#040f1e'); x.fillStyle = sea; x.fillRect(0, P(o + 27), gc.width, gc.height - P(o + 27));
    for (let k = 0; k < 6; k++) { const yy = P(o + 27) + (k + 0.5) * TS * 0.55; const g2 = x.createLinearGradient(0, yy, 0, yy + TS * 0.4); g2.addColorStop(0, 'rgba(120,225,255,.10)'); g2.addColorStop(1, 'rgba(120,225,255,0)'); x.fillStyle = g2; x.fillRect(0, yy, gc.width, TS * 0.4); }
    // клетки земли: мостовая с разной яркостью по шахматке, у дорог чуть светлее
    for (let z = 0; z < D; z++) for (let c = 0; c < W; c++) {
      const t = MP.T[z * W + c], px = P(o + c), pz = P(o + z);
      if (t === 2) { const g3 = x.createLinearGradient(0, pz, 0, pz + TS); g3.addColorStop(0, '#0a4a6a'); g3.addColorStop(1, '#083c5a'); x.fillStyle = g3; x.fillRect(px, pz, TS, TS); continue; }
      if (t === 1) { x.fillStyle = '#080f1e'; x.fillRect(px, pz, TS, TS); continue; }
      x.fillStyle = t === 3 ? '#0c2d38' : t === 4 ? '#12304d' : ((c + z) & 1 ? '#0b1a33' : '#0a172e'); x.fillRect(px, pz, TS, TS);
      const di = MP.DM[z * W + c], tints = ['', 'rgba(60,110,255,.05)', 'rgba(150,80,255,.05)', 'rgba(30,220,200,.05)', 'rgba(120,255,180,.05)', 'rgba(255,200,100,.04)'];
      if (di > 0 && tints[di]) { x.fillStyle = tints[di]; x.fillRect(px, pz, TS, TS); }
    }
    // свет фонарей на земле — мягкие пятна
    lamps.forEach(l => { const gcx = P(o + l[0]), gcz = P(o + l[1]), gr = x.createRadialGradient(gcx, gcz, 0, gcx, gcz, TS * 1.5); gr.addColorStop(0, css(C1) + '2a'); gr.addColorStop(1, css(C1) + '00'); x.fillStyle = gr; x.fillRect(gcx - TS * 1.5, gcz - TS * 1.5, TS * 3, TS * 3); });
    // сетка клеток
    x.strokeStyle = css(C1) + '1c'; x.lineWidth = 1; x.beginPath();
    for (let z = 0; z < D; z++) for (let c = 0; c < W; c++) { const t = MP.T[z * W + c]; if (t === 1 || t === 2) continue; const px = P(o + c), pz = P(o + z); x.moveTo(px + .5, pz); x.lineTo(px + .5, pz + TS); x.moveTo(px, pz + .5); x.lineTo(px + TS, pz + .5); }
    x.stroke();
    // дороги: светящиеся кромки там, где соседняя клетка — не дорога, осевая разметка, зебры на перекрёстках
    x.strokeStyle = css(C1) + 'bb'; x.lineWidth = 2; x.beginPath();
    for (let z = 0; z < D; z++) for (let c = 0; c < W; c++) { if (!isRoad(c, z)) continue; const px = P(o + c), pz = P(o + z);
      if (z > 0 && !isRoad(c, z - 1) && MP.T[(z - 1) * W + c] !== 2) { x.moveTo(px, pz + 1); x.lineTo(px + TS, pz + 1); }
      if (z < D - 1 && !isRoad(c, z + 1) && MP.T[(z + 1) * W + c] !== 2) { x.moveTo(px, pz + TS - 1); x.lineTo(px + TS, pz + TS - 1); }
      if (c > 0 && !isRoad(c - 1, z)) { x.moveTo(px + 1, pz); x.lineTo(px + 1, pz + TS); }
      if (c < W - 1 && !isRoad(c + 1, z)) { x.moveTo(px + TS - 1, pz); x.lineTo(px + TS - 1, pz + TS); } }
    x.stroke();
    x.strokeStyle = 'rgba(255,217,138,.62)'; x.setLineDash([TS * .42, TS * .34]); x.lineWidth = 2; x.beginPath();
    RX.forEach(c => { x.moveTo(P(o + c) + TS / 2, P(o)); x.lineTo(P(o + c) + TS / 2, P(o + ROADZ)); });
    RZ.forEach(z => { x.moveTo(P(o), P(o + z) + TS / 2); x.lineTo(P(o + W), P(o + z) + TS / 2); });
    x.stroke(); x.setLineDash([]);
    x.fillStyle = 'rgba(232,248,255,.62)';                                                            // пешеходные переходы у перекрёстков
    RX.forEach(c => RZ.forEach(z => { if (z > 24) return; for (let k = 0; k < 5; k++) { const a = P(o + c) + 3 + k * (TS - 6) / 5, b = P(o + z) + 3 + k * (TS - 6) / 5;
      x.fillRect(a, P(o + z - 1) + 3, 2.5, TS - 6); x.fillRect(a, P(o + z + 1) + 3, 2.5, TS - 6); x.fillRect(P(o + c - 1) + 3, b, TS - 6, 2.5); x.fillRect(P(o + c + 1) + 3, b, TS - 6, 2.5); } }));
    // береговая линия: пена и подсветка
    x.strokeStyle = css(C1) + 'cc'; x.lineWidth = 3; x.beginPath(); x.moveTo(0, P(o + 27)); x.lineTo(gc.width, P(o + 27)); x.stroke();
    x.strokeStyle = 'rgba(220,250,255,.35)'; x.lineWidth = 2; x.beginPath(); for (let i = 0; i <= 160; i++) { const xx = i * gc.width / 160, yy = P(o + 27) + 6 + Math.sin(i * 0.55) * 2.2; i ? x.lineTo(xx, yy) : x.moveTo(xx, yy); } x.stroke();
    x.strokeStyle = 'rgba(120,200,255,.16)'; x.lineWidth = 1.5; for (let k = 0; k < 14; k++) { const zz = P(o + 28.4 + k * 0.9); x.beginPath(); for (let i = 0; i <= 80; i++) { const xx = i * gc.width / 80, yy = zz + Math.sin(i * 0.9 + k) * 2.2; i ? x.lineTo(xx, yy) : x.moveTo(xx, yy); } x.stroke(); }
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
    fd(0, 0, gc.width, P(o) - 1, 0, P(o), 0, 0); fd(0, P(o), P(o), P(27), P(o), 0, 0, 0); fd(P(o + W), P(o), gc.width - P(o + W), P(27), P(o + W), 0, gc.width, 0);
    // закрытые районы — тёмные, со штриховкой и пунктирной рамкой
    doors.forEach(d => { if (d.open) return; const r = MP.DIST[d.id];
      for (let z = r.z0; z <= r.z1; z++) for (let c = r.x0; c <= r.x1; c++) { if (MP.DM[z * W + c] !== d.id) continue; x.fillStyle = 'rgba(2,5,12,.74)'; x.fillRect(P(o + c), P(o + z), TS, TS); }
      x.strokeStyle = css(C2) + '40'; x.lineWidth = 1; x.beginPath();
      for (let z = r.z0; z <= r.z1; z++) for (let c = r.x0; c <= r.x1; c++) if (MP.DM[z * W + c] === d.id && ((c + z) % 2 === 0)) { x.moveTo(P(o + c), P(o + z + 1)); x.lineTo(P(o + c + 1), P(o + z)); }
      x.stroke();
      x.strokeStyle = css(C2) + '99'; x.lineWidth = 2; x.setLineDash([TS * .5, TS * .3]); x.strokeRect(P(o + r.x0) + 2, P(o + r.z0) + 2, P(r.x1 - r.x0 + 1) - 4, P(r.z1 - r.z0 + 1) - 4); x.setLineDash([]); });
    gtex.needsUpdate = true;
  }
  const groundMat = keep(new THREE.MeshBasicMaterial({ map: gtex }));
  const ground = new THREE.Mesh(keep(new THREE.PlaneGeometry(GWc, GDc)), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, 0); scene.add(ground);
  // блики на воде: полупрозрачная плоскость с бегущей текстурой (двигается только в режиме «жизнь города»)
  const wtC = document.createElement('canvas'); wtC.width = 256; wtC.height = 256;
  (function () { const x = wtC.getContext('2d'), r = rng(5); x.clearRect(0, 0, 256, 256); for (let i = 0; i < 90; i++) { const px = r() * 256, py = r() * 256, l = 6 + r() * 16; x.strokeStyle = 'rgba(190,245,255,' + (0.18 + r() * 0.5).toFixed(2) + ')'; x.lineWidth = 1 + r() * 1.4; x.beginPath(); x.moveTo(px, py); x.lineTo(px + l, py + (r() - 0.5) * 2); x.stroke(); } })();
  const wtex = keep(new THREE.CanvasTexture(wtC)); wtex.wrapS = wtex.wrapT = THREE.RepeatWrapping; wtex.repeat.set(GWc / 6, 4); wtex.colorSpace = THREE.SRGBColorSpace;
  const waterGlint = new THREE.Mesh(keep(new THREE.PlaneGeometry(GWc, MG + 3)), keep(new THREE.MeshBasicMaterial({ map: wtex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 })));
  waterGlint.rotation.x = -Math.PI / 2; waterGlint.position.set(0, 0.012, wz(27) + (MG + 3) / 2); waterGlint.renderOrder = 1; scene.add(waterGlint);
  // небо: купол с градиентом (у горизонта фиолетово-бирюзовое свечение) и звёздами; следует за камерой
  const skyC = document.createElement('canvas'); skyC.width = 512; skyC.height = 256;
  (function () { const x = skyC.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#02050c'); g.addColorStop(0.45, '#060d1f'); g.addColorStop(0.78, '#122046'); g.addColorStop(0.93, '#1c3a66'); g.addColorStop(1, '#0d2a4a'); x.fillStyle = g; x.fillRect(0, 0, 512, 256);
    const r = rng(9); for (let i = 0; i < 160; i++) { x.fillStyle = 'rgba(220,240,255,' + (0.25 + r() * 0.6).toFixed(2) + ')'; const s2 = r() < 0.1 ? 2 : 1; x.fillRect(r() * 512, r() * 140, s2, s2); } })();
  const skyTex = keep(new THREE.CanvasTexture(skyC)); skyTex.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(keep(new THREE.SphereGeometry(150, 20, 10)), keep(new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false }))); sky.renderOrder = -2; scene.background = null; scene.add(sky);
  const fogRef = scene.fog;

  /* --- «кирпичики» зданий --- */
  const dm = new THREE.Object3D();
  const _m = new THREE.Matrix4(), _l = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
  const mat = (px, py, pz, sx, sy, sz, ry, rx) => { _q.setFromEuler(_e.set(rx || 0, ry || 0, 0, 'YXZ')); return _l.compose(_p.set(px, py, pz), _q, _s.set(sx, sy, sz)); };
  const WMAX = 1600, wgeo = keep(PLN()), wmat = keep(new THREE.MeshBasicMaterial({ color: 0xffffff }));      // «мигающие» окна — инстансы
  const wins = new THREE.InstancedMesh(wgeo, wmat, WMAX); wins.count = 0; wins.frustumCulled = false; wins.renderOrder = 3; scene.add(wins); wins.geometry.scale(0.1, 0.13, 1);
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
    Object.assign(C, {
      bx(x, y0, z, w, h, d, alt, win, ry) {
        put(BOX(), bcol(alt), ecol(alt), x, y0 + h / 2, z, w, h, d, ry);
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
      ring(x, y, z, r, k) { if (ghost) return; _m.multiplyMatrices(BM, mat(x, y, z, r * 2, r * 2, r * 2, 0, Math.PI / 2)); S.glow.add(TOR(), _m, neonCol(k), null); },
      sg(x, y, z, w, h, ic, ry, k) { if (ghost) return; const u = uvOf(ICON[ic] != null ? ICON[ic] : 13); _m.multiplyMatrices(BM, mat(x, y, z, 1, 1, 1, ry)); const t = k ? neonCol(k) : K.white; h /= hm; S.sign.q(_m, -w / 2, -h / 2, 0, w, 0, 0, 0, h, 0, u[0], u[1], u[2], u[3], t); },
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
      c.cyl(20, 0, 0, 0, 1.0, 0.06, 1.0, 0); c.cyl(12, 0, 0.06, 0, 0.3, h, 0.3, 1); c.cyl(24, 0, h + 0.06, 0, 1.3, 0.09, 1.3, 2); c.ring(0, h + 0.1, 0, 0.65, 1); c.ring(0, h + 0.05, 0, 0.6, 2);
      c.bx(0, 0.06, 0.32, 0.5, 0.34, 0.3, 1, 1); c.sg(0, 0.22, 0.475, 0.36, 0.2, 'atm', 0, 1); c.plate(0, h + 0.15, 0, 0.62, 0.62, 1); c.sgf(0, h + 0.188, 0, 0.62, 'atm', 1);
      c.ant(0, h + 0.2, -0.3, 0.3, 1);
      if (l >= 3) c.ring(0, h + 0.26, 0, 0.9, 1);
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
  function newSet() { return { body: new Batch(), glow: new Batch(), beam: new Batch(), fac: new QB(), facG: new QB(), facM: new QB(), facS: new QB(), sign: new QB(), halo: new QB() }; }
  // одно здание в набор S: площадка, фигура, детали ступени; возвращает рост для подписи и выбора
  function addBuilding(S, it, ghost, cols, rnd) {
    const dim = DIM[it.id] || [1.5, 1.2], fw = it.w, fd = it.d, s = Math.min(fw / dim[0], fd / dim[1]) * 0.95, cx = it.x + fw / 2, cz = it.y + fd / 2, base = elevAt(it.x + (fw >> 1), it.y + (fd >> 1)), l = it.l;
    const lv = ghost ? { b: cols.b, b2: cols.b2, b3: cols.b, e1: cols.e1, e2: cols.e2, e3: cols.e1 } : livery(it.id);
    const tg = TGT[it.id] || [1.4, 3], tgt = tg[0] + (tg[1] - tg[0]) * (l - 1) / 4, top0 = Math.max(0.3, BLD[it.id](NOPC, l) || 1), hm = clamp(tgt / (top0 * s), 0.85, 2.4);
    if (!ghost) { _m.copy(mat(wx(cx), base + 0.025, wz(cz), fw * 0.96, 0.05, fd * 0.96)); S.body.add(BOX(), _m, K.pad, lv.pad); }
    const BM = new THREE.Matrix4().compose(_p.set(wx(cx), base + 0.05, wz(cz)), _q.setFromEuler(_e.set(0, it.r ? Math.PI / 2 : 0, 0)), _s.set(s, s * hm, s));
    const c = ctx(S, BM, ghost, lv, rnd, l, hm), top = BLD[it.id](c, l), lw = (it.r ? fd : fw) / s, ld = (it.r ? fw : fd) / s;
    // каждая ступень добавляет деталей: свечение земли, антенна, угловые опоры с огнями, луч
    if (!ghost) {
      if (l >= 3) { c.halo(lw * 1.5, ld * 1.5, 1, 0.55); c.nb(0, 0, ld / 2 * 0.99, lw * 0.98, 0.03, 0.02, 1); c.nb(0, 0, -ld / 2 * 0.99, lw * 0.98, 0.03, 0.02, 1); }
      if (l >= 4) [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(q => { const px = q[0] * (lw / 2 - 0.08), pz = q[1] * (ld / 2 - 0.08); c.bx(px, 0, pz, 0.06, 0.3, 0.06, 1); c.ball(px, 0.34, pz, 0.045, 4); });
      if (l >= 5) { c.beamAt(0, top + 0.1, 0, 0.16, 1.7); c.ball(0, top + 0.42, 0, 0.09, 4); c.halo(lw * 2.2, ld * 2.2, 2, 0.5); }
      else if (l >= 2) c.ball(lw / 2 - 0.05, 0.1, ld / 2 - 0.05, 0.035, 1);
      // мигающие окна: несколько отдельных светящихся окошек на главной грани
      if (c.main && wn < WMAX - 8) { const mb = c.main, nBl = 2 + l; for (let i = 0; i < nBl && wn < WMAX; i++) {
        const face = Math.floor(rnd() * 2), lx = (rnd() - 0.5) * (mb[3] - 0.2), ly = mb[1] + 0.12 + rnd() * Math.max(0.05, mb[4] - 0.26), px = mb[0] + lx, pz = mb[2] + (face ? -1 : 1) * (mb[5] / 2 + 0.02);
        dm.rotation.set(0, face ? Math.PI : 0, 0); dm.position.set(px, ly, pz); dm.scale.set(1, 1 / hm, 1); dm.updateMatrix(); wm.multiplyMatrices(BM, dm.matrix); wins.setMatrixAt(wn, wm); wins.setColorAt(wn, rnd() < 0.5 ? lit1 : lit2); blinkList.push(wn); wn++; } }
    }
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
    lamps.forEach(l => { _m.copy(mat(wx(l[0]), 0.11, wz(l[1]), 0.03, 0.22, 0.03)); S.body.add(BOX(), _m, K.body2, null); _m.copy(mat(wx(l[0]), 0.24, wz(l[1]), 0.08, 0.04, 0.08)); S.glow.add(BOX(), _m, K.warm, null); });
    // деревья по краю карты и на холме (не там, где можно строить)
    const tree = (x, z, s, ye) => { const y = ye || 0; _m.copy(mat(wx(x), y + 0.06 * s, wz(z), 0.05 * s, 0.12 * s, 0.05 * s)); S.body.add(BOX(), _m, K.rock, null); _m.copy(mat(wx(x), y + 0.12 * s + 0.2 * s, wz(z), 0.3 * s, 0.4 * s, 0.3 * s)); S.body.add(CONE(6), _m, r() < 0.5 ? K.tree : K.tree2, K.dim.clone().multiplyScalar(0.5)); };
    for (let i = 0; i < 70; i++) { const side = Math.floor(r() * 3), a = r(); let x, z; if (side === 0) { x = -4 + r() * 3 - 1; z = a * (D - 4); x = -1 - r() * 2.2; } else if (side === 1) { x = W + 0.4 + r() * 2.2; z = a * (D - 4); } else { x = a * W; z = -1 - r() * 2.2; } tree(x, z, 0.8 + r() * 0.7); }
    for (let i = 0; i < 26; i++) { const a = r() * 6.28, rr = 0.5 + r() * 0.5; const px = 31 + Math.cos(a) * 3.3 * rr * 1.2, pz = 3.5 + Math.sin(a) * 2.6 * rr * 1.2; if (Math.abs(px - 31) < 3.1 && Math.abs(pz - 3.5) < 2.55) continue; tree(px, pz, 0.6 + r() * 0.5, 0.01); }
    // дальние кварталы за краем карты: коробки разной высоты с окнами (создают глубину и ощущение большого города)
    const far = (x0, z0, x1, z1, n, hmax) => { for (let i = 0; i < n; i++) { const x = x0 + r() * (x1 - x0), z = z0 + r() * (z1 - z0), w = 0.8 + r() * 1.4, d = 0.8 + r() * 1.4, h = 0.4 + r() * hmax * (0.25 + Math.hypot(wx(x), wz(z)) / 70); const alt = r() < 0.4;
      _m.copy(mat(wx(x), h / 2, wz(z), w, h, d)); S.body.add(BOX(), _m, alt ? K.body2 : K.body, (alt ? K.e2 : K.e1).clone().multiplyScalar(0.32));
      const e = 0.012, rows = Math.max(1, Math.round((h - 0.1) / 0.3)), cc = Math.max(1, Math.round(w / 0.3)), ou = Math.floor(r() * 8) / 8, tc = new THREE.Color(0.24, 0.26, 0.32); _m.identity();
      S.fac.q(_m, wx(x) - w / 2, 0.05, wz(z) + d / 2 + e, w, 0, 0, 0, h - 0.1, 0, ou, 0, ou + cc / 8, rows / 8, tc); S.fac.q(_m, wx(x) + w / 2 + e, 0.05, wz(z) + d / 2, 0, 0, -d, 0, h - 0.1, 0, ou, 0, ou + cc / 8, rows / 8, tc);
      if (r() < 0.2) { _m.copy(mat(wx(x), h + 0.15, wz(z), 0.03, 0.3, 0.03)); S.glow.add(BOX(), _m, K.red, null); } } };
    far(-16, -16, W + 16, -4.5, 46, 3.6); far(-16, -3, -4.5, D - 3, 20, 2.8); far(W + 4.5, -3, W + 16, D - 3, 20, 2.8);
    // огни на воде: бакены вдоль берега
    for (let i = 0; i < 10; i++) { const x = r() * W, z = 28.4 + r() * 2.6; _m.copy(mat(wx(x), 0.05, wz(z), 0.06, 0.1, 0.06)); S.glow.add(BOX(), _m, r() < 0.5 ? K.e1 : K.red, null); }
    return S;
  }
  const staticMeshes = [];
  function flush(S, list, frust) {
    const b = S.body; if (b.p.length) { const m = new THREE.Mesh(geoOf(b.p, b.n, b.c), matBody); scene.add(m); list.push(m); }
    if (b.lp.length) { const ln = new THREE.LineSegments(geoOf(b.lp, null, b.lc), matLine); scene.add(ln); list.push(ln); }
    if (S.glow.p.length) { const m = new THREE.Mesh(geoOf(S.glow.p, S.glow.n, S.glow.c), matBright); m.frustumCulled = false; scene.add(m); list.push(m); }
    if (S.beam.p.length) { const m = new THREE.Mesh(geoOf(S.beam.p, S.beam.n, S.beam.c), matBeam); m.frustumCulled = false; scene.add(m); list.push(m); }
    [['fac', matFac], ['facG', matFacG], ['facM', matFacM], ['facS', matFacS]].forEach(q => { const Q = S[q[0]]; if (Q && Q.p.length) { const m = new THREE.Mesh(geoQ(Q), q[1]); m.frustumCulled = false; scene.add(m); list.push(m); } });
    if (S.sign.p.length) { const m = new THREE.Mesh(geoQ(S.sign), matSign); m.frustumCulled = false; scene.add(m); list.push(m); }
    if (S.halo.p.length) { const m = new THREE.Mesh(geoQ(S.halo), matHalo); m.frustumCulled = false; m.renderOrder = 1; scene.add(m); list.push(m); }
  }

  /* --- машины на дорогах (инстансы, двигаются только в режиме «жизнь города») --- */
  const CARN = 44, carGeo = keep(new THREE.BoxGeometry(0.3, 0.07, 0.12)), cars = new THREE.InstancedMesh(carGeo, keep(new THREE.MeshBasicMaterial({ color: 0xffffff })), CARN); cars.frustumCulled = false; cars.renderOrder = 3; scene.add(cars);
  const carDef = []; (function () { const r = rng(31), pal = [0xcfeaff, 0x22e3ff, 0xffd98a, 0xff6a84, 0x9a90ff, 0xffffff], seg = [];
    RZ.forEach(z => seg.push({ h: 1, c: z, len: W })); RX.forEach(c => seg.push({ h: 0, c: c, len: ROADZ }));
    for (let i = 0; i < CARN; i++) { const sg = seg[i % seg.length], dir = r() < 0.5 ? 1 : -1; carDef.push({ sg: sg, dir: dir, t0: r() * sg.len, sp: 0.7 + r() * 1.3, col: new THREE.Color(pal[Math.floor(r() * pal.length)]) }); cars.setColorAt(i, carDef[i].col); } })();
  function moveCars(t) {
    for (let i = 0; i < CARN; i++) { const d = carDef[i], sg = d.sg, p = ((d.t0 + d.dir * d.sp * t) % sg.len + sg.len) % sg.len, lane = 0.5 + d.dir * 0.18 * (sg.h ? 1 : -1);
      if (sg.h) dm.position.set(wx(p), 0.06, wz(sg.c + lane)); else dm.position.set(wx(sg.c + lane), 0.06, wz(p));
      dm.rotation.set(0, sg.h ? 0 : Math.PI / 2, 0); dm.scale.set(1, 1, 1); dm.updateMatrix(); cars.setMatrixAt(i, dm.matrix); }
    cars.instanceMatrix.needsUpdate = true; if (cars.instanceColor) cars.instanceColor.needsUpdate = true;
  }
  moveCars(0);

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

  /* --- пересборка города --- */
  let vitOn = false, meshes = [], its = [], tags = [], ghostMeshes = [], builtSig = '', gSig = '', ovSig = '', dSig = '', ringSig = '', ghostSig = '';
  const killMeshes = list => { list.forEach(o => { scene.remove(o); o.geometry && o.geometry.dispose(); }); list.length = 0; };
  function rebuild(items) {
    killMeshes(meshes); its = []; wn = 0; blinkList = [];
    const chunks = {}, S = newSet(), get = k => chunks[k] || (chunks[k] = new Batch()), kc = { b: K.body, b2: K.body2, e1: K.e1, e2: K.e2 };
    items.forEach(it => {
      S.body = get(chunkOf(it.x, it.y)); const rnd = rng(hash(it.id + it.u)), res = addBuilding(S, it, false, kc, rnd), l = it.l;
      its.push({ u: it.u, id: it.id, x: it.x, y: it.y, w: it.w, d: it.d, base: res.base, h: res.base + (res.top + (l >= 5 ? 1.2 : 0.4)) * res.s + 0.2, ax: wx(res.cx), az: wz(res.cz), ay: res.base + (res.top + (l >= 5 ? 1.2 : 0.5)) * res.s + 0.15 });
    });
    Object.keys(chunks).forEach(k => { const one = newSet(); one.body = chunks[k]; flush({ body: chunks[k], glow: new Batch(), beam: new Batch(), fac: new QB(), sign: new QB(), halo: new QB() }, meshes); });
    flush({ body: new Batch(), glow: S.glow, beam: S.beam, fac: S.fac, facG: S.facG, facM: S.facM, facS: S.facS, sign: S.sign, halo: S.halo }, meshes);
    wins.count = wn; wins.instanceMatrix.needsUpdate = true; if (wins.instanceColor) wins.instanceColor.needsUpdate = true;
    buildTags(items);
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
      tagBox.appendChild(el); tags.push({ el: el, nm: el.firstChild, amt: el.lastChild, x: t.ax, y: t.ay, z: t.az, u: t.u, txt: '', vis: true, sel: false });
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
      const i = by[t.u]; if (i) { const a = i.txt || ''; if (a !== t.txt) { t.txt = a; t.amt.textContent = a; t.amt.hidden = !a; } t.fill = i.fill || 0; t.v = i.v || 0; if (t.sel !== !!i.sel) { t.sel = !!i.sel; t.el.classList.toggle('sel', t.sel); } }
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
    w = Math.round(r.width); h = Math.round(r.height); R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
    const old = fit; fit = fitDist(); if (!old) { dist = distT = fit; focusStart(); } else { distT = distT / old * fit; dist = dist / old * fit; } need();
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
    let live = false;
    if (!moving && !dirty && !bench && ambOn && ambVis && !document.hidden) {                         // «жизнь города»: редкие кадры, только пока карта на экране
      live = true; ambLast = t; const ts = (performance.now() - ambT0) / 1000; moveCars(ts); wtex.offset.x = (ts * 0.012) % 1; wtex.offset.y = (Math.sin(ts * 0.4) * 0.02);
      if (t - blinkAt > 1300) { blinkAt = t; blinkTick(t); }
    }
    if (moving || dirty || live) {
      dirty = false; const c0 = performance.now(); applyDim(); place(); R.render(scene, cam); upTags(); stats.cpu.push(performance.now() - c0); if (stats.cpu.length > 240) stats.cpu.shift();
      if (last && !live) { stats.dt.push(t - last); if (stats.dt.length > 240) stats.dt.shift(); } last = live ? 0 : t;
    } else last = 0;
    if (moving || bench) raf = requestAnimationFrame(frame);
    else { last = 0; if (ambOn && ambVis && !document.hidden) { clearTimeout(tmo); tmo = setTimeout(() => { tmo = 0; if (!raf && inst) raf = requestAnimationFrame(frame); }, mob ? 55 : 42); } }
  }
  function applyDim() {
    const k = 1 - 0.58 * dimK; groundMat.color.setScalar(k); amb.intensity = 0.8 * (1 - 0.45 * dimK); hemi.intensity = 0.55 * (1 - 0.45 * dimK); sun.intensity = 0.95 * (1 - 0.4 * dimK);
    matBody.color.setScalar(1 - 0.25 * dimK); waterGlint.material.opacity = 0.8 * (1 - 0.5 * dimK);
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
      if (sig !== builtSig) { builtSig = sig; rebuild(items); ch = true; }
      const dsig = A.districts().map(d => d.id + (d.open ? 1 : 0)).join('');
      if (dsig !== gSig) { gSig = dsig; paintGround(); refreshDists(true); ch = true; }
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
    live(on) { if (on != null) { ambOn = !!on; try { localStorage.setItem('dofa_gr_amb', ambOn ? '1' : '0'); } catch (e) { /* ничего */ } if (!ambOn) { moveCars(0); } need(); } return ambOn; },
    view(a, e2, d2) { if (a != null) azT = az = a; if (e2 != null) elT = el = e2; if (d2 != null) distT = dist = d2; need(); },
    bench(ms) { return new Promise(res => { stats.dt.length = 0; stats.cpu.length = 0; bench0 = performance.now(); bench = 1; benchMs = ms; benchDone = () => { const a = stats.dt.slice(), n = a.length, avg = a.reduce((s, x) => s + x, 0) / Math.max(1, n); a.sort((x, y) => x - y); res({ frames: n, avgMs: +avg.toFixed(2), fps: +(1000 / avg).toFixed(1), p95Ms: +(a[Math.floor(n * 0.95)] || 0).toFixed(1), maxMs: +(a[n - 1] || 0).toFixed(1), cpuAvgMs: +(stats.cpu.reduce((q, x) => q + x, 0) / Math.max(1, stats.cpu.length)).toFixed(2), cpuMaxMs: +Math.max(0, ...stats.cpu).toFixed(1) }); }; need(); }); },
    vitrina(list, o) {                                         // витрина для снимков: показать только указанные здания (без правил), камера — крупно
      o = o || {}; vitOn = true; builtSig = 'vit'; rebuild(list); tags.forEach(t => { t.el.style.display = 'none'; t.vis = false; });
      const q = list[0], t0 = its[0], hh = t0 ? t0.h : 1.5; if (q) { TG.set(wx(q.x + q.w / 2), hh * 0.38, wz(q.y + q.d / 2)); tgT = null; }
      azT = az = o.az != null ? o.az : 0.62; elT = el = o.el != null ? o.el : 0.5; distT = dist = o.dist || (Math.max(q ? q.w : 2, q ? q.d : 2) * 1.3 + hh * 1.5 + 1.6); need();
    },
    stop() {
      canvas.removeEventListener('webglcontextlost', onLost); clearInterval(wd); document.removeEventListener('visibilitychange', onVis); document.removeEventListener('keydown', onKey); if (ro) ro.disconnect(); if (io) io.disconnect(); if (raf) cancelAnimationFrame(raf); raf = 0; clearTimeout(tmo);
      killMeshes(meshes); killMeshes(ghostMeshes); killMeshes(staticMeshes); disp.forEach(o => o.dispose && o.dispose()); wins.dispose && wins.dispose(); ov.dispose && ov.dispose(); cars.dispose && cars.dispose();
      try { R.dispose(); R.forceContextLoss(); } catch (e) { /* ничего */ }
      rootEl.remove();
    },
    cellScreen(cx, cz) { place(); cam.updateMatrixWorld(); const v = new THREE.Vector3(wx(cx + 0.5), elevAt(cx, cz) + 0.1, wz(cz + 0.5)).project(cam), r = canvas.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; },
    screen(u) { const t = its.find(q => q.u === u); if (!t) return null; place(); cam.updateMatrixWorld(); const v = new THREE.Vector3(t.ax, t.base + 0.5, t.az).project(cam), r = canvas.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; },
    info: () => ({ calls: R.info.render.calls, tris: R.info.render.triangles, geos: R.info.memory.geometries, tex: R.info.memory.textures, wins: wn, items: its.length, dpr: R.getPixelRatio(), dist: +dist.toFixed(1), fit: +fit.toFixed(1), az: +az.toFixed(3), el: +el.toFixed(3), rotMode: rotMode })
  };
  paintGround();
  flush(buildStatic(), staticMeshes);
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
  mode: m => (inst ? inst.mode(m) : false), live: on => (inst ? inst.live(on) : false), view: (a, e, d) => inst && inst.view(a, e, d), vitrina: (l, o) => inst && inst.vitrina(l, o),
  bench: ms => (inst ? inst.bench(ms) : Promise.resolve(null)),
  screen: u => (inst ? inst.screen(u) : null), cellScreen: (x, z) => (inst ? inst.cellScreen(x, z) : null),
  info: () => (inst ? inst.info() : null)
};
root.DofaGorod3D = api3;
})(window);
