/* dofamart · Акции — «Город» в 3D (19.11, вторая версия: большая карта). Сцена на three.js (vendor/three.min.js, грузится лениво).
   Только отрисовка и камера: данные, правила и действия приходят от gorod.js через api A { map, items, districts, overlay, ghost, placing, cell, tapItem, tapCell, ... }.
   Скорость: все здания сливаются в несколько больших сеток по кварталам карты (отсечение невидимого по кускам), окна и клетки-подсветка — инстансами,
   подписи — обычные элементы страницы над холстом. Кадр по требованию: рендер идёт, только пока что-то движется; потом цикл засыпает.
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

function build(box) {
  const THREE = root.THREE, MP = A.map, W = MP.W, D = MP.D, HH = MP.HILL_H, mob = window.matchMedia && matchMedia('(max-width:700px)').matches;
  const C1 = rgbVar('--acc') || 0x22e3ff, C2 = rgbVar('--acc2') || 0x786eff, BG = 0x050a14;
  const rootEl = document.createElement('div'); rootEl.className = 'gr3-root';
  const canvas = document.createElement('canvas'); canvas.setAttribute('aria-label', A.label || '3D'); canvas.setAttribute('role', 'img');
  rootEl.appendChild(canvas);
  const tagBox = document.createElement('div'); tagBox.className = 'gr3-tags'; rootEl.appendChild(tagBox);
  const R = new THREE.WebGLRenderer({ canvas: canvas, antialias: !mob, alpha: false, powerPreference: 'default' });
  R.setPixelRatio(Math.min(window.devicePixelRatio || 1, mob ? 1.5 : 2)); R.setClearColor(BG, 1);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(BG); scene.fog = new THREE.FogExp2(BG, 0.0075);
  const cam = new THREE.PerspectiveCamera(38, 1, 0.5, 190);
  scene.add(new THREE.AmbientLight(0x6f94c0, 0.8));
  scene.add(new THREE.HemisphereLight(0x5ac8ff, 0x20104a, 0.55));
  const sun = new THREE.DirectionalLight(0xffffff, 0.95); sun.position.set(5, 9, 6); scene.add(sun);
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
  const PYR = () => TP('pyr', () => { const g = new THREE.CylinderGeometry(0, 0.5, 1, 4); g.rotateY(Math.PI / 4); return g; });
  const DOME = () => TP('dome', () => new THREE.SphereGeometry(0.5, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2));
  const SPH = () => TP('sph', () => new THREE.SphereGeometry(0.5, 10, 6));
  const PLN = () => new THREE.PlaneGeometry(1, 1);

  const _v = new THREE.Vector3(), _n3 = new THREE.Matrix3();
  function Batch() { this.p = []; this.n = []; this.c = []; this.lp = []; this.lc = []; this.pc = 0; }
  Batch.prototype.add = function (t, m, col, lcol) {
    _n3.getNormalMatrix(m); const P = t.pos, N = t.nor;
    for (let i = 0; i < P.length; i += 3) {
      _v.set(P[i], P[i + 1], P[i + 2]).applyMatrix4(m); this.p.push(_v.x, _v.y, _v.z);
      _v.set(N[i], N[i + 1], N[i + 2]).applyMatrix3(_n3).normalize(); this.n.push(_v.x, _v.y, _v.z); this.c.push(col.r, col.g, col.b);
    }
    if (lcol) { const L = t.lpos; for (let i = 0; i < L.length; i += 3) { _v.set(L[i], L[i + 1], L[i + 2]).applyMatrix4(m); this.lp.push(_v.x, _v.y, _v.z); this.lc.push(lcol.r, lcol.g, lcol.b); } }
  };
  function geoOf(pos, nor, col) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); if (nor) g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeBoundingSphere(); return g;
  }
  const matBody = keep(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x050c18 }));
  const matLine = keep(new THREE.LineBasicMaterial({ vertexColors: true }));
  const matBright = keep(new THREE.MeshBasicMaterial({ vertexColors: true }));
  const matBeam = keep(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending }));
  const matGB = keep(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.42, depthWrite: false }));
  const matGL = keep(new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95 }));
  const K = {                                              // цвета
    body: new THREE.Color(0x0b1628), body2: new THREE.Color(0x130f2c), pad: new THREE.Color(0x0c182c), hill: new THREE.Color(0x0b2230), hill2: new THREE.Color(0x0a1a2c),
    e1: new THREE.Color(C1), e2: new THREE.Color(C2), dim: new THREE.Color(C1).multiplyScalar(0.34), hillE: new THREE.Color(C2).multiplyScalar(0.55),
    glow: new THREE.Color(0xbff8ff), beam: new THREE.Color(C1), ok: new THREE.Color(0x1ccf8a), okE: new THREE.Color(0x7dffc8), bad: new THREE.Color(0xd8334f), badE: new THREE.Color(0xff8aa0)
  };
  const wx = cx => cx - W / 2, wz = cz => cz - D / 2;
  const elevAt = (cx, cz) => (MP.T[Math.floor(cz) * W + Math.floor(cx)] === 3 ? HH : 0);

  /* --- земля: одна плоскость с нарисованной картой (клетки, дороги, вода, холм, площадь, закрытые районы) --- */
  const MG = 18, GWc = W + 2 * MG, GDc = D + 2 * MG, TS = mob ? 18 : 24, gc = document.createElement('canvas'); gc.width = GWc * TS; gc.height = GDc * TS;
  const gx = gc.getContext('2d'), gtex = keep(new THREE.CanvasTexture(gc)); gtex.anisotropy = 4; gtex.colorSpace = THREE.SRGBColorSpace;
  function paintGround() {
    const x = gx, P = c => c * TS, o = MG; let doors = A.districts();
    x.fillStyle = '#050a14'; x.fillRect(0, 0, gc.width, gc.height);
    x.fillStyle = '#08142b'; x.fillRect(0, 0, gc.width, P(o + 27));                                         // за краем карты — тёмная земля с редкой сеткой, а не пустота
    x.strokeStyle = css(C1) + '14'; x.lineWidth = 1; x.beginPath();
    for (let i = 0; i <= GWc; i++) { x.moveTo(P(i) + .5, 0); x.lineTo(P(i) + .5, P(o + 27)); } for (let j = 0; j <= o + 27; j++) { x.moveTo(0, P(j) + .5); x.lineTo(gc.width, P(j) + .5); } x.stroke();
    x.fillStyle = 'rgba(5,10,20,.4)'; x.fillRect(0, 0, gc.width, P(o)); x.fillRect(0, P(o), P(o), P(27)); x.fillRect(P(o + W), P(o), gc.width - P(o + W), P(27));
    x.strokeStyle = css(C1) + '66'; x.lineWidth = 2; x.strokeRect(P(o) + 1, P(o) + 1, P(W) - 2, P(27) - 2);
    x.fillStyle = '#052a44'; x.fillRect(0, P(o + 27), gc.width, gc.height - P(o + 27));                 // море уходит за край карты
    const sea = x.createLinearGradient(0, P(o + 27), 0, gc.height); sea.addColorStop(0, 'rgba(34,227,255,.16)'); sea.addColorStop(0.18, 'rgba(34,227,255,.04)'); sea.addColorStop(1, 'rgba(5,10,20,.9)'); x.fillStyle = sea; x.fillRect(0, P(o + 27), gc.width, gc.height - P(o + 27));
    for (let z = 0; z < D; z++) for (let c = 0; c < W; c++) {
      const t = MP.T[z * W + c], px = P(o + c), pz = P(o + z);
      if (t === 2) continue;
      x.fillStyle = t === 1 ? '#0f1f38' : t === 3 ? '#0c2d38' : t === 4 ? '#12304d' : ((c + z) & 1 ? '#0a1830' : '#091629');
      x.fillRect(px, pz, TS, TS);
    }
    x.strokeStyle = css(C1) + '22'; x.lineWidth = 1; x.beginPath();                                       // сетка клеток
    for (let i = 0; i <= W; i++) { x.moveTo(P(o + i) + .5, P(o)); x.lineTo(P(o + i) + .5, P(o + 27)); }
    for (let j = 0; j <= 27; j++) { x.moveTo(P(o), P(o + j) + .5); x.lineTo(P(o + W), P(o + j) + .5); }
    x.stroke();
    x.strokeStyle = css(C1) + '77'; x.setLineDash([TS * .4, TS * .35]); x.lineWidth = 2; x.beginPath();    // осевые линии дорог
    [11, 23].forEach(c => { x.moveTo(P(o + c) + TS / 2, P(o)); x.lineTo(P(o + c) + TS / 2, P(o + 25)); });
    [7, 15, 24].forEach(z => { x.moveTo(P(o), P(o + z) + TS / 2); x.lineTo(P(o + W), P(o + z) + TS / 2); });
    x.stroke(); x.setLineDash([]);
    x.strokeStyle = css(C1) + '99'; x.lineWidth = 3; x.beginPath(); x.moveTo(P(o) - gc.width, P(o + 27)); x.lineTo(gc.width, P(o + 27)); x.stroke();   // берег
    x.strokeStyle = 'rgba(120,200,255,.16)'; x.lineWidth = 1.5; for (let k = 0; k < 14; k++) { const zz = P(o + 27.6 + k * 0.9); x.beginPath(); for (let i = 0; i <= 80; i++) { const xx = i * gc.width / 80, yy = zz + Math.sin(i * 0.9 + k) * 2.2; i ? x.lineTo(xx, yy) : x.moveTo(xx, yy); } x.stroke(); }
    // площадь: кольца и круг в середине
    x.strokeStyle = css(C1) + '88'; x.lineWidth = 2; const pcx = P(o + 15.5), pcz = P(o + 11.5);
    [1.4, 2.4, 3.2].forEach(r => { x.beginPath(); x.arc(pcx, pcz, r * TS, 0, 6.2832); x.stroke(); });
    x.strokeStyle = css(C1) + '66'; x.strokeRect(P(o + 12) + 2, P(o + 8) + 2, TS * 7 - 4, TS * 7 - 4);
    // холм: линии высоты
    x.strokeStyle = css(C2) + 'aa'; x.lineWidth = 1.5; [[28, 1, 6, 5], [27.2, 0.4, 7.6, 6.2]].forEach(q => x.strokeRect(P(o + q[0]), P(o + q[1]), TS * q[2], TS * q[3]));
    // закрытые районы — затемнены, со штриховкой
    doors.forEach(d => { if (d.open) return; const r = MP.DIST[d.id];
      for (let z = r.z0; z <= r.z1; z++) for (let c = r.x0; c <= r.x1; c++) { if (MP.DM[z * W + c] !== d.id) continue; x.fillStyle = 'rgba(2,5,12,.66)'; x.fillRect(P(o + c), P(o + z), TS, TS); }
      x.strokeStyle = css(C2) + '33'; x.lineWidth = 1; x.beginPath();
      for (let z = r.z0; z <= r.z1; z++) for (let c = r.x0; c <= r.x1; c++) if (MP.DM[z * W + c] === d.id && ((c + z) % 2 === 0)) { x.moveTo(P(o + c), P(o + z + 1)); x.lineTo(P(o + c + 1), P(o + z)); }
      x.stroke(); });
    gtex.needsUpdate = true;
  }
  const ground = new THREE.Mesh(keep(new THREE.PlaneGeometry(GWc, GDc)), keep(new THREE.MeshBasicMaterial({ map: gtex })));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, 0); scene.add(ground);

  /* --- здания --- */
  const WMAX = 9000, wgeo = keep(PLN()), wmat = keep(new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const wins = new THREE.InstancedMesh(wgeo, wmat, WMAX); wins.count = 0; wins.frustumCulled = false; scene.add(wins); wins.geometry.scale(0.1, 0.13, 1);
  const dm = new THREE.Object3D(), wm = new THREE.Matrix4(), lit1 = new THREE.Color(C1).lerp(new THREE.Color(0xffffff), 0.55), lit2 = new THREE.Color(0xffd98a), off = new THREE.Color(C1).multiplyScalar(0.16);
  let wn = 0;
  const _m = new THREE.Matrix4(), _l = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
  const mat = (px, py, pz, sx, sy, sz, ry) => { _q.setFromEuler(_e.set(0, ry || 0, 0)); return _l.compose(_p.set(px, py, pz), _q, _s.set(sx, sy, sz)); };

  // ctx: рисует кирпичики здания в локальных координатах (центр основания в 0, ось y вверх); BM — матрица в мир
  function ctx(batch, glow, beam, BM, id, ghost, cols, rnd, litP, doWin) {
    const put = (t, bc, ec, px, py, pz, sx, sy, sz, ry) => { _m.multiplyMatrices(BM, mat(px, py, pz, sx, sy, sz, ry)); batch.add(t, _m, bc, ec); };
    const C = {
      bx(x, y0, z, w, h, d, alt, win, ry) { put(BOX(), alt ? cols.b2 : cols.b, alt ? cols.e2 : cols.e1, x, y0 + h / 2, z, w, h, d, ry); if (win && doWin && !ry) C.windows(x, y0, z, w, h, d); },
      cyl(n, x, y0, z, w, h, d, alt, ry) { put(CYL(n), alt ? cols.b2 : cols.b, alt ? cols.e2 : cols.e1, x, y0 + h / 2, z, w, h, d, ry); },
      pyr(x, y0, z, w, h, d, alt) { put(PYR(), alt ? cols.b2 : cols.b, alt ? cols.e2 : cols.e1, x, y0 + h / 2, z, w, h, d); },
      dome(x, y0, z, w, h, d, alt) { put(DOME(), alt ? cols.b2 : cols.b, alt ? cols.e2 : cols.e1, x, y0, z, w, h * 2, d); },
      glowBall(x, y, z, r) { if (ghost) return; _m.multiplyMatrices(BM, mat(x, y, z, r * 2, r * 2, r * 2)); glow.add(SPH(), _m, K.glow, null); },
      beamAt(x, y0, z, w, h) { _m.multiplyMatrices(BM, mat(x, y0 + h / 2, z, w, h, w)); beam.add(CYL(10), _m, K.beam, null); },
      windows(x, y0, z, w, h, d) {
        const faces = [[0, d / 2, 0, w], [Math.PI, -d / 2, 0, w], [Math.PI / 2, w / 2, 1, d], [-Math.PI / 2, -w / 2, 1, d]], rows = Math.max(1, Math.floor((h - 0.12) / 0.26)), step = 0.26;
        faces.forEach(f => {
          const cc = Math.max(1, Math.floor((f[3] - 0.1) / 0.24)), sp = (f[3] - 0.1) / cc;
          for (let r = 0; r < rows; r++) for (let c = 0; c < cc; c++) {
            if (wn >= WMAX) return;
            const lx = -f[3] / 2 + 0.05 + sp * (c + 0.5), ly = y0 + 0.14 + r * step + 0.08;
            dm.rotation.set(0, f[0], 0);
            if (f[2] === 0) dm.position.set(x + (f[1] > 0 ? lx : -lx), ly, z + f[1] + (f[1] > 0 ? 0.004 : -0.004));
            else dm.position.set(x + f[1] + (f[1] > 0 ? 0.004 : -0.004), ly, z + (f[1] > 0 ? -lx : lx));
            dm.updateMatrix(); wm.multiplyMatrices(BM, dm.matrix); wins.setMatrixAt(wn, wm);
            const v = rnd(); wins.setColorAt(wn, v < litP ? (v < litP * 0.22 ? lit2 : lit1) : off); wn++;
          }
        });
      }
    };
    return C;
  }
  // каждое здание — своя фигура; возвращает высоту верха
  const BLD = {
    kiosk(c, l) { const h = 0.5 * LH(l); c.bx(0, 0, 0, 0.95, h, 0.8, 0, 1); c.pyr(0, h, 0, 1.25, 0.32, 1.1, 1); c.bx(0, 0.28, 0.52, 0.95, 0.035, 0.3, 1); if (l >= 3) c.bx(0.62, 0, -0.3, 0.4, h * 0.8, 0.4, 1, 1); return h + 0.32; },
    exch(c, l) { const h = 0.62 * LH(l); c.bx(0, 0, 0, 1.55, h, 1.1, 0, 1); c.cyl(16, 0, h, 0, 0.8, 0.07 + 0.02 * l, 0.8, 1); c.cyl(16, 0, h + 0.07, 0, 0.5, 0.05, 0.5, 0); return h + 0.14; },
    dc(c, l) { const hh = 0.3 * LH(l); for (let i = 0; i < 3; i++) c.bx(0, i * (hh + 0.07), 0, 1.35, hh, 1.0, i % 2, 1); return 3 * (hh + 0.07); },
    hall(c, l) { const h = 0.5 * LH(l); c.bx(0, 0, 0, 1.6, 0.1, 1.2, 1); [-0.6, -0.2, 0.2, 0.6].forEach(x => c.bx(x, 0.1, 0.45, 0.12, h, 0.12, 0)); c.bx(0, 0.1, -0.2, 1.4, h, 0.5, 0, 1); c.cyl(3, 0, 0.1 + h, 0.25, 1.65, 0.42, 1.25, 1, Math.PI / 2); return h + 0.56; },
    bank(c, l) { const h = 0.78 * LH(l); c.bx(0, 0, 0, 1.45, h, 1.2, 0, 1); [-0.45, 0, 0.45].forEach(x => c.bx(x, 0, 0.66, 0.1, h * 0.85, 0.1, 1)); c.cyl(3, 0, h, 0, 1.5, 0.3, 1.2, 1, Math.PI / 2); c.dome(0, h + 0.3, 0, 0.4, 0.2, 0.4, 0); return h + 0.52; },
    lab(c, l) { const h = 0.55 * LH(l); c.bx(-0.25, 0, 0, 1.1, h, 1.1, 0, 1); c.cyl(12, 0.45, 0, 0.35, 0.18, h + 0.9, 0.18, 1); c.dome(0.45, h + 0.9, 0.35, 0.7, 0.25, 0.7, 1); c.bx(-0.25, h, 0, 0.3, 0.3, 0.3, 1); return h + 1.15; },
    fund(c, l) { const a = 0.9 * LH(l), b = 1.5 * LH(l); c.bx(-0.45, 0, 0.1, 0.7, a, 0.9, 0, 1); c.bx(0.4, 0, -0.1, 0.8, b, 0.9, 1, 1); c.bx(-0.45, a, 0.1, 0.4, 0.12, 0.5, 1); return b; },
    tower(c, l) {                              // ступенчатая башня: три уступа с окнами по всем граням и шпиль; растёт с каждой ступенью
      const k = LH(l), h1 = 0.8 * k, h2 = 0.75 * k, h3 = 0.6 * k;
      c.bx(0, 0, 0, 1.3, h1, 1.3, 0, 1); c.bx(0, h1, 0, 1.0, h2, 1.0, 1, 1); c.bx(0, h1 + h2, 0, 0.7, h3, 0.7, 0, 1);
      const t = h1 + h2 + h3; c.bx(0, t, 0, 0.5, 0.1, 0.5, 1); c.pyr(0, t + 0.1, 0, 0.34, 0.5, 0.34, 1); c.bx(0, t + 0.6, 0, 0.03, 0.4, 0.03, 1); return t + 1.0;
    },
    inst(c, l) { const h = 0.55 * LH(l); c.bx(0, 0, 0, 1.6, 0.1, 1.5, 1); c.bx(0, 0.1, 0, 1.35, h, 1.05, 0, 1); [-0.55, -0.18, 0.18, 0.55].forEach(x => c.bx(x, 0.1, 0.62, 0.1, h, 0.1, 1)); c.dome(0, 0.1 + h, 0, 1.15, 0.55, 1.15, 1); return h + 0.7; },
    obs(c, l) { const h = 0.5 * LH(l); c.cyl(20, 0, 0, 0, 1.55, h, 1.55, 0); c.dome(0, h, 0, 1.25, 0.6, 1.25, 1); c.cyl(10, 0.28, h + 0.5, 0, 0.16, 0.7, 0.16, 0, 0); return h + 0.75; },
    vend(c, l) { const h = 0.5 * LH(l); c.bx(0, 0, 0, 1.3, h, 0.65, 0, 1); c.bx(0, h, 0, 1.5, 0.06, 0.8, 1); c.bx(0, 0.1, 0.34, 1.0, h * 0.55, 0.04, 1); c.glowBall(-0.45, h * 0.6, 0.38, 0.04); c.glowBall(0.45, h * 0.6, 0.38, 0.04); return h + 0.06; },
    atm(c, l) { const h = 0.7 * LH(l); c.bx(0, 0, 0, 1.0, h, 1.0, 0, 1); c.bx(-0.55, 0, 0.2, 0.18, h * 0.55, 0.5, 1); c.bx(0.55, 0, 0.2, 0.18, h * 0.55, 0.5, 1); c.cyl(18, 0, h, 0, 1.15, 0.05, 1.15, 1); c.cyl(18, 0, h + 0.05, 0, 0.55, 0.12, 0.55, 0); return h + 0.17; },
    pay(c, l) { const h = 0.95 * LH(l); c.bx(-0.55, 0, 0, 0.3, h, 0.7, 0, 1); c.bx(0.55, 0, 0, 0.3, h, 0.7, 0, 1); c.bx(0, h - 0.12, 0, 1.4, 0.22, 0.7, 1); c.cyl(20, 0, 0.12, 0, 0.62, 0.04, 0.62, 1); c.glowBall(0, 0.14 + 0.1 * l, 0, 0.1); return h + 0.1; },
    broker(c, l) { const h = 0.45 * LH(l), t = 1.0 * LH(l); c.bx(0, 0, 0, 1.9, h, 1.1, 0, 1); c.bx(-0.5, h, -0.1, 0.8, t, 0.7, 1, 1); c.bx(0.45, h, 0.2, 0.7, 0.22, 0.4, 0); c.bx(0, 0.16, 0.56, 1.7, 0.05, 0.04, 1); return h + t; },
    vc(c, l) { const k = LH(l); c.bx(0, 0, 0, 1.15, 0.5 * k, 1.15, 0, 1); c.bx(0, 0.5 * k, 0, 0.95, 0.45 * k, 0.95, 1, 0, 0.45); c.bx(0, 0.95 * k, 0, 0.75, 0.4 * k, 0.75, 0, 0, 0.9); c.bx(0, 1.35 * k, 0, 0.5, 0.3 * k, 0.5, 1, 0, 1.3); c.glowBall(0, 1.65 * k + 0.12, 0, 0.09); return 1.65 * k + 0.2; },
    home(c, l) { const k = LH(l); c.bx(-0.25, 0, 0, 0.8, 0.55 * k, 1.0, 0, 1); c.bx(0.35, 0, 0.05, 0.6, 0.9 * k, 0.8, 1, 1); c.bx(-0.25, 0.55 * k, 0, 0.9, 0.05, 1.1, 1); c.bx(0.35, 0.9 * k, 0.05, 0.7, 0.05, 0.9, 1); return 0.95 * k; },
    cowork(c, l) { const h = 0.45 * LH(l); c.bx(0, 0, 0, 1.4, h, 1.1, 0, 1); c.cyl(3, 0, h, 0, 1.45, 0.34, 1.15, 1, Math.PI / 2); c.bx(0.45, h + 0.34, -0.2, 0.2, 0.3, 0.2, 1); return h + 0.4; },
    mall(c, l) { const h = 0.5 * LH(l); c.bx(0, 0, 0, 1.9, h, 1.15, 0, 1); c.dome(0, h, 0, 1.2, 0.4, 0.85, 1); c.bx(-0.75, h, 0, 0.3, 0.18, 0.5, 1); c.bx(0.75, h, 0, 0.3, 0.18, 0.5, 1); return h + 0.42; },
    park(c, l) { const k = 1 + 0.08 * (l - 1); c.bx(0, 0, 0, 0.85, 0.03, 0.85, 1); c.cyl(6, 0, 0.03, 0, 0.09, 0.3, 0.09, 0); c.pyr(0, 0.3, 0, 0.55 * k, 0.45 * k, 0.55 * k, 1); c.pyr(0, 0.62 * k, 0, 0.38 * k, 0.4 * k, 0.38 * k, 0); c.glowBall(0.28, 0.12, 0.25, 0.03); return 0.98 * k; },
    fountain(c, l) { c.cyl(20, 0, 0, 0, 1.5, 0.12, 1.5, 0); c.cyl(18, 0, 0.12, 0, 1.2, 0.05, 1.2, 1); c.cyl(8, 0, 0.12, 0, 0.18, 0.5 + 0.06 * l, 0.18, 1); c.cyl(14, 0, 0.5 + 0.06 * l, 0, 0.5, 0.05, 0.5, 1); c.glowBall(0, 0.72 + 0.06 * l, 0, 0.09); return 0.8 + 0.06 * l; },
    port(c, l) { const k = LH(l); c.bx(0, 0, 0, 1.9, 0.1, 1.2, 1); [[-0.7, 0.3, 0], [-0.25, 0.3, 1], [0.2, 0.3, 0]].forEach(q => c.bx(q[0], 0.1, q[1], 0.42, 0.26 * k, 0.3, q[2], 1)); c.bx(0.75, 0.1, -0.3, 0.09, 0.95 * k, 0.09, 1); c.bx(0.38, 0.1 + 0.9 * k, -0.3, 0.8, 0.07, 0.07, 1); c.bx(-0.3, 0.1, -0.35, 0.9, 0.3, 0.4, 0, 1); return 1.1 * k; },
    maglev(c, l) { const h = 0.14; c.bx(0, 0, 0, 1.95, h, 1.1, 1); [-0.8, -0.27, 0.27, 0.8].forEach(x => c.bx(x, h, -0.38, 0.08, 0.5, 0.08, 0)); c.bx(0, h + 0.5, -0.1, 1.95, 0.07, 0.95, 1); c.bx(0, h + 0.02, 0.18, 1.7, 0.2 * LH(l), 0.4, 0, 1); c.glowBall(0.86, h + 0.14, 0.18, 0.05); return h + 0.6; }
  };
  const chunkOf = (cx, cz) => Math.floor(cx / CHW) + 4 * Math.floor(cz / CHD);

  /* --- сетка клеток-подсветки (доступные места, радиус прибавки, призрак, выбранное) --- */
  const ovGeo = keep(PLN()); ovGeo.rotateX(-Math.PI / 2);
  const ovMat = keep(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  const ov = new THREE.InstancedMesh(ovGeo, ovMat, W * D); ov.count = 0; ov.frustumCulled = false; ov.renderOrder = 2; scene.add(ov);
  const OVC = [null, new THREE.Color(0x0a5a3c), new THREE.Color(0x2a52b8), new THREE.Color(0x30e098), new THREE.Color(0xe02a4a), new THREE.Color(0x7ad8e8)];
  function paintOverlay() {
    const m = A.overlay(); let n = 0;
    if (m) for (let i = 0; i < m.length; i++) {
      const k = m[i]; if (!k) continue; const cx = i % W, cz = (i / W) | 0;
      dm.position.set(wx(cx) + 0.5, elevAt(cx, cz) + 0.03, wz(cz) + 0.5); dm.rotation.set(0, 0, 0); dm.scale.set(0.94, 1, 0.94); dm.updateMatrix(); ov.setMatrixAt(n, dm.matrix); ov.setColorAt(n, OVC[k]); n++;
    }
    dm.scale.set(1, 1, 1); ov.count = n; ov.instanceMatrix.needsUpdate = true; if (ov.instanceColor) ov.instanceColor.needsUpdate = true;
  }

  /* --- пересборка города --- */
  let meshes = [], its = [], tags = [], ghostMeshes = [], builtSig = '', gSig = '', ovSig = '', dSig = '', hillBuilt = false;
  const killMeshes = list => { list.forEach(o => { scene.remove(o); o.geometry && o.geometry.dispose(); }); list.length = 0; };
  function rebuild(items) {
    killMeshes(meshes); its = []; wn = 0;
    const chunks = {}, glow = new Batch(), beam = new Batch(), get = k => chunks[k] || (chunks[k] = new Batch());
    // холм — две ступени
    { const b = get(chunkOf(30, 3)), put = (cx, cz, w, d, h, col, ec) => { _m.copy(mat(wx(cx + w / 2), h / 2, wz(cz + d / 2), w, h, d)); b.add(BOX(), _m, col, ec); };
      put(27, 0, 8, 7, HH * 0.5, K.hill2, K.hillE); put(28, 1, 6, 5, HH, K.hill, K.hillE); }
    const kc = { b: K.body, b2: K.body2, e1: K.e1, e2: K.e2 };
    items.forEach(it => {
      const dim = DIM[it.id] || [1.5, 1.2], fw = it.w, fd = it.d, s = Math.min(fw / dim[0], fd / dim[1]) * 0.95, cx = it.x + fw / 2, cz = it.y + fd / 2, base = elevAt(it.x + (fw >> 1), it.y + (fd >> 1)), b = get(chunkOf(it.x, it.y));
      _m.copy(mat(wx(cx), base + 0.025, wz(cz), fw * 0.96, 0.05, fd * 0.96)); b.add(BOX(), _m, K.pad, K.dim);      // площадка
      const BM = new THREE.Matrix4().compose(_p.set(wx(cx), base + 0.05, wz(cz)), _q.setFromEuler(_e.set(0, it.r ? Math.PI / 2 : 0, 0)), _s.set(s, s, s));
      const c = ctx(b, glow, beam, BM, it.id, false, kc, rng(hash(it.id + it.u)), 0.22 + 0.15 * it.l, true), l = it.l, top = BLD[it.id](c, l), lw = (it.r ? fd : fw) / s, ld = (it.r ? fw : fd) / s;
      // каждая ступень добавляет деталей (как в первой версии)
      if (l >= 3) c.bx(0, 0, 0, lw * 0.98, 0.06, ld * 0.98, 1);
      if (l >= 2 && it.id !== 'park' && it.id !== 'fountain') { c.bx(0, top, 0, 0.035, 0.28 + 0.08 * l, 0.035, 0); c.glowBall(0, top + 0.3 + 0.08 * l, 0, 0.05); }
      if (l >= 4) [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(q => { const px = q[0] * (lw / 2 - 0.1), pz = q[1] * (ld / 2 - 0.1); c.bx(px, 0, pz, 0.08, 0.34, 0.08, 1); c.glowBall(px, 0.4, pz, 0.05); });
      if (l >= 5) { c.beamAt(0, top + 0.1, 0, 0.16, 1.6); c.glowBall(0, top + 0.5, 0, 0.1); }
      its.push({ u: it.u, id: it.id, x: it.x, y: it.y, w: fw, d: fd, base: base, h: base + (top + (l >= 5 ? 1.2 : 0.4)) * s + 0.2, ax: wx(cx), az: wz(cz), ay: base + (top + (l >= 5 ? 1.2 : 0.5)) * s + 0.15 });
    });
    Object.keys(chunks).forEach(k => {
      const b = chunks[k]; if (!b.p.length) return;
      const m = new THREE.Mesh(geoOf(b.p, b.n, b.c), matBody); scene.add(m); meshes.push(m);
      if (b.lp.length) { const ln = new THREE.LineSegments(geoOf(b.lp, null, b.lc), matLine); scene.add(ln); meshes.push(ln); }
    });
    if (glow.p.length) { const m = new THREE.Mesh(geoOf(glow.p, glow.n, glow.c), matBright); m.frustumCulled = false; scene.add(m); meshes.push(m); }
    if (beam.p.length) { const m = new THREE.Mesh(geoOf(beam.p, beam.n, beam.c), matBeam); m.frustumCulled = false; scene.add(m); meshes.push(m); }
    wins.count = wn; wins.instanceMatrix.needsUpdate = true; if (wins.instanceColor) wins.instanceColor.needsUpdate = true;
    buildTags(items);
  }
  function paintGhost() {
    killMeshes(ghostMeshes);
    const g = A.ghost(); if (!g) return;
    const dim = DIM[g.id] || [1.5, 1.2], f = g.w, d2 = g.d, s = Math.min(f / dim[0], d2 / dim[1]) * 0.95, cx = g.x + f / 2, cz = g.y + d2 / 2, base = elevAt(g.x + (f >> 1), g.y + (d2 >> 1));
    const kc = g.ok ? { b: K.ok, b2: K.ok, e1: K.okE, e2: K.okE } : { b: K.bad, b2: K.bad, e1: K.badE, e2: K.badE }, b = new Batch(), junk = new Batch();
    const BM = new THREE.Matrix4().compose(_p.set(wx(cx), base + 0.05, wz(cz)), _q.setFromEuler(_e.set(0, g.r ? Math.PI / 2 : 0, 0)), _s.set(s, s, s));
    const c = ctx(b, junk, junk, BM, g.id, true, kc, Math.random, 0, false); BLD[g.id](c, 1);
    const m = new THREE.Mesh(geoOf(b.p, b.n, b.c), matGB); m.renderOrder = 3; scene.add(m); ghostMeshes.push(m);
    const ln = new THREE.LineSegments(geoOf(b.lp, null, b.lc), matGL); ln.renderOrder = 4; scene.add(ln); ghostMeshes.push(ln);
  }
  function buildTags(items) {
    tags.forEach(t => t.el.remove()); tags = []; tagBox.innerHTML = '';
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
  function upTags() {                                        // подписи: сумма над зданием, имя вблизи; положение — по камере
    const items = A.items(), by = {}; items.forEach(i => { by[i.u] = i; });
    const near = dist < fit * 0.62; rootEl.classList.toggle('near', near);
    tags.forEach(t => {
      const i = by[t.u]; if (i) { const a = i.txt || ''; if (a !== t.txt) { t.txt = a; t.amt.textContent = a; t.amt.hidden = !a; } if (t.sel !== !!i.sel) { t.sel = !!i.sel; t.el.classList.toggle('sel', t.sel); } }
      pos(t);
    });
    distTags.forEach(pos);
  }
  const _pv = new THREE.Vector3();
  function pos(t) {
    _pv.set(t.x, t.y, t.z).project(cam); const ok = _pv.z < 1 && Math.abs(_pv.x) < 1.15 && Math.abs(_pv.y) < 1.15;
    if (ok !== t.vis) { t.vis = ok; t.el.style.display = ok ? '' : 'none'; }
    if (ok) t.el.style.transform = 'translate(' + ((_pv.x + 1) / 2 * w).toFixed(1) + 'px,' + ((1 - _pv.y) / 2 * h).toFixed(1) + 'px)';
  }

  /* --- камера и ввод: один палец или левая кнопка — сдвиг; два пальца / правая кнопка / кнопки — поворот и масштаб --- */
  const TG = new THREE.Vector3(-6.5, 0, -3.5), EL0 = 0.95, AZ0 = 0.52;
  let az = AZ0, azT = AZ0, el = EL0, dist = 20, distT = 20, fit = 20, raf = 0, dirty = true, bench = 0, w = 0, h = 0, tgT = null, last = 0, hover = '';
  const pv = { x: 0, z: 0 }; const ptr = new Map(); let drag = null, pinch = 0, twist = 0;
  const tf = Math.tan(cam.fov * Math.PI / 360);
  function fitDist() {                                       // стартовая дальность: на экране 12 клеток в ширину (телефон стоя) … 28 (широкий экран)
    const a = Math.max(0.4, w / Math.max(1, h)), span = clamp(12 + 14 * (a - 0.5), 12, 28); return span / (2 * tf * a);
  }
  const dMin = () => fit * 0.36, dMax = () => Math.min(fit * 2.9, 40 / (2 * tf * Math.max(0.4, w / Math.max(1, h))));
  function resize() {
    const r = rootEl.getBoundingClientRect(); if (r.width < 10 || r.height < 10) return;
    w = Math.round(r.width); h = Math.round(r.height); R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
    const old = fit; fit = fitDist(); if (!old) { dist = distT = fit; focusStart(); } else { distT = distT / old * fit; dist = dist / old * fit; } need();
  }
  function clampTG() { TG.x = clamp(TG.x, -W / 2 + 2, W / 2 - 2); TG.z = clamp(TG.z, -D / 2 + 1, D / 2 - 2.5); }
  function place() {
    clampTG();
    cam.position.set(TG.x + dist * Math.cos(el) * Math.sin(az), TG.y + dist * Math.sin(el), TG.z + dist * Math.cos(el) * Math.cos(az)); cam.lookAt(TG);
  }
  function focusStart() {                                    // стартовый вид — на застроенную часть (или на стартовый район)
    const its2 = A.items(); let sx = 0, sz = 0, n = 0; its2.forEach(i => { sx += i.x + i.w / 2; sz += i.y + i.d / 2; n++; });
    const c = n ? { x: sx / n, z: sz / n } : { x: MP.START.x + 0.5, z: MP.START.z + 0.5 }; TG.set(wx(c.x), 0, wz(c.z)); clampTG();
  }
  const stats = { dt: [], cpu: [] };
  function frame(t) {
    raf = 0; if (!inst) return;
    if (document.hidden) return;
    let moving = false;
    if (Math.abs(distT - dist) > fit * 0.002) { dist += (distT - dist) * 0.24; moving = true; } else dist = distT;
    if (Math.abs(azT - az) > 0.002) { az += (azT - az) * 0.22; moving = true; } else az = azT;
    if (!drag && ptr.size === 0 && (Math.abs(pv.x) + Math.abs(pv.z) > 0.004)) { const b0 = tgT || TG; tgT = { x: clamp(b0.x + pv.x, -W / 2 + 2, W / 2 - 2), z: clamp(b0.z + pv.z, -D / 2 + 1, D / 2 - 2.5) }; pv.x *= 0.92; pv.z *= 0.92; moving = true; } else if (!drag) { pv.x = pv.z = 0; }
    if (tgT) { const dx = tgT.x - TG.x, dz = tgT.z - TG.z; if (Math.abs(dx) + Math.abs(dz) > 0.02) { TG.x += dx * 0.3; TG.z += dz * 0.3; moving = true; } else { TG.x = tgT.x; TG.z = tgT.z; tgT = null; } }
    if (bench) { azT = az += 0.012; moving = true; if (t - bench0 > benchMs) { bench = 0; moving = false; benchDone && benchDone(); } }
    if (moving || dirty) {
      dirty = false; const c0 = performance.now(); place(); R.render(scene, cam); upTags(); stats.cpu.push(performance.now() - c0); if (stats.cpu.length > 240) stats.cpu.shift();
      if (last) { stats.dt.push(t - last); if (stats.dt.length > 240) stats.dt.shift(); } last = t;
    } else last = 0;
    if (moving || bench) raf = requestAnimationFrame(frame); else last = 0;
  }
  function need() { dirty = true; if (!raf && inst) raf = requestAnimationFrame(frame); }
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
  const upd = e => { const p = ptr.get(e.pointerId); if (p) { p.x = e.clientX; p.y = e.clientY; } };
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId); ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptr.size === 1) drag = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t: performance.now(), moved: 0, rot: e.pointerType === 'mouse' && e.button === 2 }; else drag = null;
    if (ptr.size === 2) { const a = [...ptr.values()]; pinch = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); twist = Math.atan2(a[1].y - a[0].y, a[1].x - a[0].x); }
    tgT = null; pv.x = pv.z = 0;
  });
  canvas.addEventListener('pointermove', e => {
    const p = ptr.get(e.pointerId);
    if (!p) { if (e.pointerType === 'mouse' && A.placing()) { const c = cellAt(e.clientX, e.clientY); if (c) A.cell(c.cx, c.cz, false); } return; }
    if (ptr.size === 2) {
      p.x = e.clientX; p.y = e.clientY; const a = [...ptr.values()], d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), an = Math.atan2(a[1].y - a[0].y, a[1].x - a[0].x);
      if (pinch > 0) { distT = clamp(distT * pinch / d, dMin(), dMax()); dist = distT; }
      let da = an - twist; if (da > Math.PI) da -= 6.2832; if (da < -Math.PI) da += 6.2832; azT = az = az - da; pinch = d; twist = an; need(); return;
    }
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (drag.rot) { drag.moved += Math.abs(dx) + Math.abs(dy); azT = az = az - dx * 0.011; el = clamp(el + dy * 0.008, 0.62, 1.3); drag.x = e.clientX; drag.y = e.clientY; need(); return; }
    drag.moved += Math.abs(dx) + Math.abs(dy); drag.tm = performance.now();
    if (drag.moved > 6) {                                      // сдвиг: точка под пальцем остаётся под пальцем
      const g0 = groundAt(drag.x, drag.y), g1 = groundAt(e.clientX, e.clientY); drag.x = e.clientX; drag.y = e.clientY;
      if (g0 && g1) { const k = 1.4, dx = (g0.x - g1.x) * k, dz = (g0.z - g1.z) * k, b0 = tgT || TG; tgT = { x: clamp(b0.x + dx, -W / 2 + 2, W / 2 - 2), z: clamp(b0.z + dz, -D / 2 + 1, D / 2 - 2.5) }; pv.x = pv.x * 0.4 + dx * 0.6; pv.z = pv.z * 0.4 + dz * 0.6; need(); }
    }
  });
  const up = e => {
    const had = ptr.has(e.pointerId); ptr.delete(e.pointerId); if (!had) return;
    if (drag && e.type === 'pointerup' && drag.moved <= 6 && performance.now() - drag.t < 700 && !drag.rot) {
      const c = cellAt(e.clientX, e.clientY);
      if (A.placing()) { if (c) A.cell(c.cx, c.cz, true); }
      else { const u = itemAt(e.clientX, e.clientY); if (u) A.tapItem(u); else A.tapCell(c ? c.cx : -1, c ? c.cz : -1); }
    }
    if (drag && performance.now() - (drag.tm || 0) > 90) { pv.x = pv.z = 0; }
    if (ptr.size < 2) { pinch = 0; } drag = null; if (Math.abs(pv.x) + Math.abs(pv.z) > 0.004) need();
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', e => { e.preventDefault(); distT = clamp(distT * Math.exp(e.deltaY * 0.0022), dMin(), dMax()); need(); }, { passive: false });
  const onLost = e => { e.preventDefault(); if (inst && inst.root === rootEl) A.fail && A.fail(true); };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.style.cursor = 'grab';

  const ro = window.ResizeObserver ? new ResizeObserver(() => resize()) : null; if (ro) ro.observe(rootEl);
  const wd = setInterval(() => {                           // раздел закрыт или заменён — освободить сцену
    const vw = document.getElementById('v-gorod');
    if (!inst) return; if (!rootEl.isConnected || (vw && vw.hidden)) api3.dispose();
  }, 1000);
  const onVis = () => { if (!document.hidden) need(); };
  document.addEventListener('visibilitychange', onVis);

  inst = {
    root: rootEl, box: null, need: need, resize: resize,
    update() {
      const items = A.items(), sig = items.map(s => s.id + ':' + s.u + ':' + s.l + ':' + s.x + ':' + s.y + ':' + s.r).join(',') + '|' + A.lang(); let ch = false;
      if (sig !== builtSig) { builtSig = sig; rebuild(items); ch = true; }
      const dsig = A.districts().map(d => d.id + (d.open ? 1 : 0)).join('');
      if (dsig !== gSig) { gSig = dsig; paintGround(); refreshDists(true); ch = true; }
      const o = A.ovSig(); if (o !== ovSig) { ovSig = o; paintOverlay(); paintGhost(); ch = true; } else upTags();
      if (ch) need();
    },
    zoom(f) { distT = clamp(distT * f, dMin(), dMax()); need(); },
    rot(a) { azT += a; need(); },
    home() { azT = AZ0; el = EL0; distT = fit; focusStart(); need(); },
    focus(cx, cz) { tgT = { x: clamp(wx(cx), -W / 2 + 2, W / 2 - 2), z: clamp(wz(cz), -D / 2 + 1, D / 2 - 2.5) }; need(); },
    center() { return { cx: Math.floor(TG.x + W / 2), cz: Math.floor(TG.z + D / 2) }; },
    bench(ms) { return new Promise(res => { stats.dt.length = 0; stats.cpu.length = 0; bench0 = performance.now(); bench = 1; benchMs = ms; benchDone = () => { const a = stats.dt.slice(), n = a.length, avg = a.reduce((s, x) => s + x, 0) / Math.max(1, n); a.sort((x, y) => x - y); res({ frames: n, avgMs: +avg.toFixed(2), fps: +(1000 / avg).toFixed(1), p95Ms: +(a[Math.floor(n * 0.95)] || 0).toFixed(1), maxMs: +(a[n - 1] || 0).toFixed(1), cpuAvgMs: +(stats.cpu.reduce((q, x) => q + x, 0) / Math.max(1, stats.cpu.length)).toFixed(2), cpuMaxMs: +Math.max(0, ...stats.cpu).toFixed(1) }); }; need(); }); },
    stop() {
      canvas.removeEventListener('webglcontextlost', onLost); clearInterval(wd); document.removeEventListener('visibilitychange', onVis); if (ro) ro.disconnect(); if (raf) cancelAnimationFrame(raf); raf = 0;
      killMeshes(meshes); killMeshes(ghostMeshes); disp.forEach(o => o.dispose && o.dispose()); wins.dispose && wins.dispose(); ov.dispose && ov.dispose();
      try { R.dispose(); R.forceContextLoss(); } catch (e) { /* ничего */ }
      rootEl.remove();
    },
    cellScreen(cx, cz) { place(); cam.updateMatrixWorld(); const v = new THREE.Vector3(wx(cx + 0.5), elevAt(cx, cz) + 0.1, wz(cz + 0.5)).project(cam), r = canvas.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; },
    screen(u) { const t = its.find(q => q.u === u); if (!t) return null; place(); cam.updateMatrixWorld(); const v = new THREE.Vector3(t.ax, t.base + 0.5, t.az).project(cam), r = canvas.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; },
    info: () => ({ calls: R.info.render.calls, tris: R.info.render.triangles, geos: R.info.memory.geometries, tex: R.info.memory.textures, wins: wn, items: its.length, dpr: R.getPixelRatio(), dist: +dist.toFixed(1), fit: +fit.toFixed(1) })
  };
  paintGround();
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
  bench: ms => (inst ? inst.bench(ms) : Promise.resolve(null)),
  screen: u => (inst ? inst.screen(u) : null), cellScreen: (x, z) => (inst ? inst.cellScreen(x, z) : null),
  info: () => (inst ? inst.info() : null)
};
root.DofaGorod3D = api3;
})(window);
