/* dofamart · Акции — «Город» в 3D (19.11). Сцена на three.js (vendor/three.min.js, грузится лениво при первом открытии).
   Только отрисовка: данные и действия приходят от gorod.js через api { lang, states, name, pick, fail }.
   Кадр по требованию: рендер идёт только пока что-то движется (поворот, инерция, масштаб); потом цикл засыпает.
   Раздел закрыт или вкладка скрыта — сцена освобождается (dispose). */
(function (root) {
'use strict';
let loading = null, inst = null, A = null, pendBox = null;
const PITCH = 3, PAD = 2, COLS = 4, ROWS = 3;     // клетка = 1; участок 2×2 клетки, дорога шириной 1
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
const posOf = i => ({ x: ((i % COLS) - (COLS - 1) / 2) * PITCH, z: (Math.floor(i / COLS) - (ROWS - 1) / 2) * PITCH });

function build(box) {
  const THREE = root.THREE, mob = window.matchMedia && matchMedia('(max-width:700px)').matches;
  const C1 = rgbVar('--acc') || 0x22e3ff, C2 = rgbVar('--acc2') || 0x786eff, BG = 0x050a14;
  const rootEl = document.createElement('div'); rootEl.className = 'gr3-root';
  const canvas = document.createElement('canvas'); canvas.setAttribute('aria-label', A.label || '3D'); canvas.setAttribute('role', 'img');
  rootEl.appendChild(canvas);
  rootEl.insertAdjacentHTML('beforeend', '<div class="gr3-ui"><button type="button" class="gr3-b" data-z="in" aria-label="+">+</button><button type="button" class="gr3-b" data-z="out" aria-label="−">−</button><button type="button" class="gr3-b" data-z="reset" aria-label="reset">⟲</button></div><p class="gr3-hint"></p>');
  const R = new THREE.WebGLRenderer({ canvas: canvas, antialias: !mob, alpha: false, powerPreference: 'default' });
  R.setPixelRatio(Math.min(window.devicePixelRatio || 1, mob ? 1.5 : 2)); R.setClearColor(BG, 1);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(BG); scene.fog = new THREE.FogExp2(BG, 0.018);
  const cam = new THREE.PerspectiveCamera(38, 1, 0.5, 120);
  scene.add(new THREE.AmbientLight(0x6f94c0, 0.75));
  scene.add(new THREE.HemisphereLight(0x5ac8ff, 0x20104a, 0.55));
  const sun = new THREE.DirectionalLight(0xffffff, 0.95); sun.position.set(5, 9, 6); scene.add(sun);

  /* --- общие геометрии и материалы --- */
  const geoms = {}, disp = [];
  const G = (key, mk) => geoms[key] || (geoms[key] = (() => { const g = mk(); disp.push(g); const e = new THREE.EdgesGeometry(g, 20); disp.push(e); return { g: g, e: e }; })());
  const BOX = () => G('box', () => new THREE.BoxGeometry(1, 1, 1));
  const CYL = n => G('cyl' + n, () => new THREE.CylinderGeometry(0.5, 0.5, 1, n));
  const TAP = () => G('tap', () => { const g = new THREE.CylinderGeometry(0.3, 0.5, 1, 4); g.rotateY(Math.PI / 4); return g; });
  const PYR = () => G('pyr', () => { const g = new THREE.CylinderGeometry(0, 0.5, 1, 4); g.rotateY(Math.PI / 4); return g; });
  const DOME = () => G('dome', () => new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2));
  const SPH = () => G('sph', () => new THREE.SphereGeometry(0.5, 12, 8));
  const mats = {
    body: new THREE.MeshLambertMaterial({ color: 0x0b1628, emissive: 0x050c18 }),
    body2: new THREE.MeshLambertMaterial({ color: 0x130f2c, emissive: 0x080520 }),
    pad: new THREE.MeshLambertMaterial({ color: 0x0c182c, emissive: 0x040a14 }),
    padHot: new THREE.MeshLambertMaterial({ color: 0x123658, emissive: 0x0a2440 }),
    ghost: new THREE.MeshBasicMaterial({ color: C1, transparent: true, opacity: 0.07, depthWrite: false }),
    ghostL: new THREE.MeshBasicMaterial({ color: C2, transparent: true, opacity: 0.04, depthWrite: false }),
    e1: new THREE.LineBasicMaterial({ color: C1 }), e2: new THREE.LineBasicMaterial({ color: C2 }),
    eDim: new THREE.LineBasicMaterial({ color: C1, transparent: true, opacity: 0.3 }),
    eGhost: new THREE.LineBasicMaterial({ color: C1, transparent: true, opacity: 0.55 }),
    eLock: new THREE.LineBasicMaterial({ color: C2, transparent: true, opacity: 0.28 }),
    glow: new THREE.MeshBasicMaterial({ color: 0xbff8ff }),
    beam: new THREE.MeshBasicMaterial({ color: C1, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending }),
    pick: new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })
  };
  Object.keys(mats).forEach(k => disp.push(mats[k]));

  /* --- земля: одна плоскость с текстурой сетки --- */
  const GW = 17, GD = 13, TS = 56, gc = document.createElement('canvas'); gc.width = GW * TS; gc.height = GD * TS;
  (function () {
    const x = gc.getContext('2d'), css = n => '#' + ('000000' + n.toString(16)).slice(-6);
    x.fillStyle = '#07101e'; x.fillRect(0, 0, gc.width, gc.height);
    for (let i = 0; i < ROWS; i++) for (let j = 0; j < COLS; j++) { const p = posOf(i * COLS + j); const px = (p.x + GW / 2 - PAD / 2) * TS, pz = (p.z + GD / 2 - PAD / 2) * TS; x.fillStyle = '#0a1830'; x.fillRect(px - 4, pz - 4, PAD * TS + 8, PAD * TS + 8); }
    x.strokeStyle = css(C1) + '33'; x.lineWidth = 1; x.beginPath();
    for (let i = 0; i <= GW; i++) { x.moveTo(i * TS + .5, 0); x.lineTo(i * TS + .5, gc.height); }
    for (let j = 0; j <= GD; j++) { x.moveTo(0, j * TS + .5); x.lineTo(gc.width, j * TS + .5); }
    x.stroke();
    x.strokeStyle = css(C1) + '55'; x.setLineDash([10, 14]); x.lineWidth = 2; x.beginPath();    // осевая линия дорог
    for (let i = 0; i < COLS - 1; i++) { const cx = (((i - (COLS - 2) / 2) * PITCH) + GW / 2) * TS; x.moveTo(cx, 0.5 * TS); x.lineTo(cx, gc.height - 0.5 * TS); }
    for (let j = 0; j < ROWS - 1; j++) { const cz = (((j - (ROWS - 2) / 2) * PITCH) + GD / 2) * TS; x.moveTo(0.5 * TS, cz); x.lineTo(gc.width - 0.5 * TS, cz); }
    x.stroke(); x.setLineDash([]);
    const rg = x.createRadialGradient(gc.width / 2, gc.height / 2, gc.height * 0.3, gc.width / 2, gc.height / 2, gc.width * 0.56); rg.addColorStop(0, 'rgba(5,10,20,0)'); rg.addColorStop(1, 'rgba(5,10,20,1)');
    x.fillStyle = rg; x.fillRect(0, 0, gc.width, gc.height);
  })();
  const gtex = new THREE.CanvasTexture(gc); gtex.anisotropy = 4; gtex.colorSpace = THREE.SRGBColorSpace; disp.push(gtex);
  const gmat = new THREE.MeshBasicMaterial({ map: gtex }); disp.push(gmat);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(GW, GD), gmat); ground.rotation.x = -Math.PI / 2; disp.push(ground.geometry); scene.add(ground);

  const dyn = new THREE.Group(); scene.add(dyn);          // всё, что пересобирается при изменениях
  const pickList = [], pads = {};
  let dynDisp = [];
  const WMAX = 3200, wgeo = new THREE.PlaneGeometry(0.1, 0.13); disp.push(wgeo);
  const wmat = new THREE.MeshBasicMaterial({ color: 0xffffff }); disp.push(wmat);
  const wins = new THREE.InstancedMesh(wgeo, wmat, WMAX); wins.count = 0; wins.frustumCulled = false; scene.add(wins);
  const dm = new THREE.Object3D(), wc = new THREE.Color(), lit1 = new THREE.Color(C1).lerp(new THREE.Color(0xffffff), 0.55), lit2 = new THREE.Color(0xffd98a), off = new THREE.Color(C1).multiplyScalar(0.16);
  let wn = 0;

  /* --- кирпичики зданий --- */
  function ctx(grp, ox, oz, id, l, ghost, kind) {
    const rnd = rng(hash(id)), litP = 0.22 + 0.15 * l;
    const em = ghost ? (kind === 'lock' ? mats.eLock : mats.eGhost) : null;
    const body = ghost ? (kind === 'lock' ? mats.ghostL : mats.ghost) : mats.body;
    const put = (gg, bm, em1, x, y, z, sx, sy, sz, ry) => {
      const m = new THREE.Mesh(gg.g, bm); m.position.set(x, y, z); m.scale.set(sx, sy, sz); if (ry) m.rotation.y = ry; grp.add(m);
      const ln = new THREE.LineSegments(gg.e, em1); ln.position.copy(m.position); ln.scale.copy(m.scale); ln.rotation.copy(m.rotation); grp.add(ln);
      return m;
    };
    const C = {
      edge: (i2) => (ghost ? em : (i2 ? mats.e2 : mats.e1)),
      bx(x, y0, z, w, h, d, alt, win) {
        put(BOX(), alt && !ghost ? mats.body2 : body, C.edge(alt), x, y0 + h / 2, z, w, h, d);
        if (win && !ghost) C.windows(x, y0, z, w, h, d);
      },
      cyl(n, x, y0, z, w, h, d, alt, ry) { put(CYL(n), alt && !ghost ? mats.body2 : body, C.edge(alt), x, y0 + h / 2, z, w, h, d, ry); },
      tap(x, y0, z, w, h, d, alt) { put(TAP(), alt && !ghost ? mats.body2 : body, C.edge(alt), x, y0 + h / 2, z, w, h, d); },
      pyr(x, y0, z, w, h, d, alt) { put(PYR(), alt && !ghost ? mats.body2 : body, C.edge(alt), x, y0 + h / 2, z, w, h, d); },
      dome(x, y0, z, w, h, d, alt) { put(DOME(), alt && !ghost ? mats.body2 : body, C.edge(alt), x, y0, z, w, h * 2, d); },
      glowBall(x, y, z, r) { if (ghost) return; const m = new THREE.Mesh(SPH().g, mats.glow); m.position.set(x, y, z); m.scale.setScalar(r * 2); grp.add(m); },
      windows(x, y0, z, w, h, d) {
        const faces = [[0, d / 2, 0, w], [Math.PI, -d / 2, 0, w], [Math.PI / 2, w / 2, 1, d], [-Math.PI / 2, -w / 2, 1, d]];
        const rows = Math.max(1, Math.floor((h - 0.12) / 0.26)), step = 0.26;
        faces.forEach(f => {
          const cols = Math.max(1, Math.floor((f[3] - 0.1) / 0.24)), sp = (f[3] - 0.1) / cols;
          for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            if (wn >= WMAX) return;
            const lx = -f[3] / 2 + 0.05 + sp * (c + 0.5), ly = y0 + 0.14 + r * step + 0.08;
            dm.rotation.set(0, f[0], 0);
            if (f[2] === 0) dm.position.set(ox + x + (f[1] > 0 ? lx : -lx), ly, oz + z + f[1] + (f[1] > 0 ? 0.004 : -0.004));
            else dm.position.set(ox + x + f[1] + (f[1] > 0 ? 0.004 : -0.004), ly, oz + z + (f[1] > 0 ? -lx : lx));
            dm.updateMatrix(); wins.setMatrixAt(wn, dm.matrix);
            const v = rnd(); wins.setColorAt(wn, v < litP ? (v < litP * 0.22 ? lit2 : lit1) : off); wn++;
          }
        });
      }
    };
    return C;
  }
  const LH = l => 1 + 0.17 * (l - 1);
  // каждое здание — своя фигура; возвращает высоту верха и центр для украшений
  const BLD = {
    kiosk(c, l) { const h = 0.5 * LH(l); c.bx(0, 0, 0, 0.95, h, 0.8, 0, 1); c.pyr(0, h, 0, 1.25, 0.32, 1.1, 1); c.bx(0, 0.28, 0.52, 0.95, 0.035, 0.3, 1); if (l >= 3) c.bx(0.62, 0, -0.3, 0.4, h * 0.8, 0.4, 1, 1); return h + 0.32; },
    exch(c, l) { const h = 0.62 * LH(l); c.bx(0, 0, 0, 1.55, h, 1.1, 0, 1); c.cyl(16, 0, h, 0, 0.8, 0.07 + 0.02 * l, 0.8, 1); c.cyl(16, 0, h + 0.07, 0, 0.5, 0.05, 0.5, 0); return h + 0.14; },
    dc(c, l) { const n = 3, hh = 0.3 * LH(l); for (let i = 0; i < n; i++) c.bx(0, i * (hh + 0.07), 0, 1.35, hh, 1.0, i % 2, 1); return n * (hh + 0.07); },
    hall(c, l) { const h = 0.5 * LH(l); c.bx(0, 0, 0, 1.6, 0.1, 1.2, 1); [-0.6, -0.2, 0.2, 0.6].forEach(x => c.bx(x, 0.1, 0.45, 0.12, h, 0.12, 0)); c.bx(0, 0.1, -0.2, 1.4, h, 0.5, 0, 1); c.cyl(3, 0, 0.1 + h, 0.25, 1.65, 0.42, 1.25, 1, Math.PI / 2); return h + 0.56; },
    bank(c, l) { const h = 0.78 * LH(l); c.bx(0, 0, 0, 1.45, h, 1.2, 0, 1); [-0.45, 0, 0.45].forEach(x => c.bx(x, 0, 0.66, 0.1, h * 0.85, 0.1, 1)); c.cyl(3, 0, h, 0, 1.5, 0.3, 1.2, 1, Math.PI / 2); c.dome(0, h + 0.3, 0, 0.4, 0.2, 0.4, 0); return h + 0.52; },
    lab(c, l) { const h = 0.55 * LH(l); c.bx(-0.25, 0, 0, 1.1, h, 1.1, 0, 1); c.cyl(12, 0.45, 0, 0.35, 0.18, h + 0.9, 0.18, 1); c.dome(0.45, h + 0.9, 0.35, 0.7, 0.25, 0.7, 1); c.bx(-0.25, h, 0, 0.3, 0.3, 0.3, 1); return h + 1.15; },
    fund(c, l) { const a = 0.9 * LH(l), b = 1.5 * LH(l); c.bx(-0.45, 0, 0.1, 0.7, a, 0.9, 0, 1); c.bx(0.4, 0, -0.1, 0.8, b, 0.9, 1, 1); c.bx(-0.45, a, 0.1, 0.4, 0.12, 0.5, 1); return b; },
    tower(c, l) { const h = 1.75 * LH(l); c.tap(0, 0, 0, 1.1, h, 1.1, 0); c.bx(0, h, 0, 0.35, 0.32, 0.35, 1, 1); c.bx(0, h + 0.32, 0, 0.04, 0.5, 0.04, 1); return h + 0.84; },
    inst(c, l) { const h = 0.55 * LH(l); c.bx(0, 0, 0, 1.6, 0.1, 1.5, 1); c.bx(0, 0.1, 0, 1.35, h, 1.05, 0, 1); [-0.55, -0.18, 0.18, 0.55].forEach(x => c.bx(x, 0.1, 0.62, 0.1, h, 0.1, 1)); c.dome(0, 0.1 + h, 0, 1.15, 0.55, 1.15, 1); return h + 0.7; },
    obs(c, l) { const h = 0.5 * LH(l); c.cyl(20, 0, 0, 0, 1.55, h, 1.55, 0); c.dome(0, h, 0, 1.25, 0.6, 1.25, 1); c.cyl(10, 0.28, h + 0.5, 0, 0.16, 0.7, 0.16, 0, 0); return h + 0.75; }
  };

  function mkLabel(text, kind) {                              // подпись или значок суммы: холст → спрайт
    const cv = document.createElement('canvas'), big = kind === 'badge'; cv.width = big ? 256 : 400; cv.height = 64;
    const x = cv.getContext('2d'); x.textAlign = 'center'; x.textBaseline = 'middle';
    if (big) { x.fillStyle = 'rgba(5,10,20,.88)'; x.beginPath(); x.roundRect ? x.roundRect(14, 8, 228, 48, 24) : x.rect(14, 8, 228, 48); x.fill(); x.strokeStyle = '#' + ('000000' + C1.toString(16)).slice(-6); x.lineWidth = 3; x.stroke(); }
    x.font = (big ? '700 30px ' : '600 30px ') + (big ? '"IBM Plex Mono", ui-monospace, Consolas, monospace' : '"IBM Plex Sans", system-ui, "Segoe UI", sans-serif'); x.fillStyle = big ? '#bff8ff' : kind === 'lock' ? 'rgba(190,200,230,.55)' : 'rgba(234,246,255,.88)';
    let t = text; while (x.measureText(t).width > cv.width - 30 && t.length > 4) t = t.slice(0, -2); if (t !== text) t = t.trim() + '…';
    if (text === 'LOCK') { x.strokeStyle = x.fillStyle = 'rgba(190,200,230,.7)'; x.lineWidth = 5; x.beginPath(); x.arc(cv.width / 2, 24, 9, Math.PI, 0); x.stroke(); x.fillRect(cv.width / 2 - 14, 28, 28, 22); } else x.fillText(t, cv.width / 2, 33);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
    const sp = new THREE.Sprite(m); sp.scale.set(big ? 1.3 : 2.5, big ? 0.325 : 0.4, 1); sp.renderOrder = 10; sp.userData.m = m; sp.userData.tex = tex; return sp;
  }
  const badges = {};
  function rebuild(states) {
    dynDisp.forEach(o => o.dispose && o.dispose()); dynDisp = [];
    for (let i = dyn.children.length - 1; i >= 0; i--) dyn.remove(dyn.children[i]);
    pickList.length = 0; wn = 0; Object.keys(badges).forEach(k => delete badges[k]);
    states.forEach((s, i) => {
      const p = posOf(i), grp = new THREE.Group(); grp.position.set(p.x, 0, p.z); dyn.add(grp);
      const pad = new THREE.Mesh(BOX().g, mats.pad); pad.position.y = 0.03; pad.scale.set(PAD, 0.06, PAD); grp.add(pad); pads[s.id] = pad;
      const pe = new THREE.LineSegments(BOX().e, s.k === 'own' ? mats.e1 : s.k === 'can' ? mats.eGhost : mats.eLock); pe.position.copy(pad.position); pe.scale.copy(pad.scale); grp.add(pe);
      const ghost = s.k !== 'own', c = ctx(grp, p.x, p.z, s.id, s.l || 1, ghost, s.k), top = BLD[s.id](c, ghost ? 1 : s.l);
      if (!ghost) {
        const l = s.l; const base = 0.08;
        if (l >= 3) c.bx(0, 0, 0, 1.78, base, 1.78, 1);
        if (l >= 2) { c.bx(0, top, 0, 0.035, 0.28 + 0.08 * l, 0.035, 0); c.glowBall(0, top + 0.3 + 0.08 * l, 0, 0.05); }
        if (l >= 4) [[-0.82, -0.82], [0.82, -0.82], [-0.82, 0.82], [0.82, 0.82]].forEach(q => { c.bx(q[0], 0, q[1], 0.08, 0.34, 0.08, 1); c.glowBall(q[0], 0.4, q[1], 0.05); });
        if (l >= 5) { const bm = new THREE.Mesh(CYL(10).g, mats.beam); bm.scale.set(0.16, 1.5, 0.16); bm.position.set(0, top + 0.8, 0); grp.add(bm); c.glowBall(0, top + 0.5, 0, 0.1); }
        const hl = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: C1, transparent: true, opacity: 0.18 + 0.05 * l, depthWrite: false, blending: THREE.AdditiveBlending })); hl.scale.set(3.1, 2.2, 1); hl.position.set(0, 0.45, 0); grp.add(hl); dynDisp.push(hl.material);
        const bd = mkLabel(s.txt || '', 'badge'); bd.position.set(0, top + (l >= 5 ? 0.85 : 0.62), 0); grp.add(bd); badges[s.id] = { sp: bd, txt: s.txt || '' }; dynDisp.push(bd.userData.m, bd.userData.tex);
      } else if (s.k === 'lock') {
        const lk = mkLabel('LOCK', 'lock'); lk.scale.set(0.6, 0.3, 1); lk.position.set(0, top + 0.35, 0); grp.add(lk); dynDisp.push(lk.userData.m, lk.userData.tex);
      }
      const nm = mkLabel(A.name(s.id), s.k === 'lock' ? 'lock' : 'name'); nm.position.set(0, 0.1, PAD / 2 + 0.28); grp.add(nm); dynDisp.push(nm.userData.m, nm.userData.tex);
      const pk = new THREE.Mesh(BOX().g, mats.pick); pk.scale.set(PAD, Math.max(top + 0.5, 1.4), PAD); pk.position.y = pk.scale.y / 2; pk.userData.id = s.id; grp.add(pk); pickList.push(pk);
    });
    wins.count = wn; wins.instanceMatrix.needsUpdate = true; if (wins.instanceColor) wins.instanceColor.needsUpdate = true;
  }
  // мягкое свечение: радиальный градиент на холсте
  const hc = document.createElement('canvas'); hc.width = hc.height = 128; { const x = hc.getContext('2d'), rg = x.createRadialGradient(64, 64, 0, 64, 64, 64); rg.addColorStop(0, 'rgba(255,255,255,.9)'); rg.addColorStop(0.4, 'rgba(255,255,255,.25)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = rg; x.fillRect(0, 0, 128, 128); }
  const haloTex = new THREE.CanvasTexture(hc); haloTex.colorSpace = THREE.SRGBColorSpace; disp.push(haloTex);

  /* --- камера и ввод --- */
  const TG = new THREE.Vector3(0, 0.35, 0), EL0 = 0.93, AZ0 = 0.62;
  let az = AZ0, el = EL0, dist = 20, distT = 20, fit = 20, vaz = 0, vel = 0, raf = 0, dirty = true, bench = 0, hover = '', w = 0, h = 0;
  const ptr = new Map(); let drag = null, pinch = 0;
  const fitDist = () => { const tf = Math.tan(cam.fov * Math.PI / 360), a = Math.max(0.4, w / Math.max(1, h)); return Math.max(6.3 / (tf * a), 5.6 / tf * 0.92) * 1.0; };
  function resize() {
    const r = rootEl.getBoundingClientRect(); if (r.width < 10 || r.height < 10) return;
    w = Math.round(r.width); h = Math.round(r.height); R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
    const old = fit; fit = fitDist(); distT = old ? distT / old * fit : fit; dist = old ? dist / old * fit : fit; need();
  }
  function place() {
    cam.position.set(TG.x + dist * Math.cos(el) * Math.sin(az), TG.y + dist * Math.sin(el), TG.z + dist * Math.cos(el) * Math.cos(az)); cam.lookAt(TG);
    // чем ближе, тем меньше туман, чтобы поле не серело
  }
  const stats = { dt: [] };
  let last = 0;
  function frame(t) {
    raf = 0; if (!inst) return;
    if (document.hidden) return;
    let moving = false;
    if (!drag && ptr.size === 0 && (Math.abs(vaz) > 2e-4 || Math.abs(vel) > 2e-4)) { az += vaz; el = clamp(el + vel, 0.5, 1.4); vaz *= 0.92; vel *= 0.92; moving = true; }
    if (Math.abs(distT - dist) > fit * 0.002) { dist += (distT - dist) * 0.22; moving = true; } else dist = distT;
    if (bench) { az += 0.012; moving = true; if (t - bench0 > benchMs) { bench = 0; moving = false; benchDone && benchDone(); } }
    if (moving || dirty) {
      dirty = false; place(); R.render(scene, cam);
      if (last) { stats.dt.push(t - last); if (stats.dt.length > 240) stats.dt.shift(); } last = t;
    } else last = 0;
    if (moving || bench) raf = requestAnimationFrame(frame); else last = 0;
  }
  function need() { dirty = true; if (!raf && inst) raf = requestAnimationFrame(frame); }
  let bench0 = 0, benchMs = 0, benchDone = null;

  const ray = new THREE.Raycaster(), v2 = new THREE.Vector2();
  function pickAt(cx, cy) {
    const r = canvas.getBoundingClientRect(); v2.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(v2, cam); const hit = ray.intersectObjects(pickList, false)[0]; return hit ? hit.object.userData.id : '';
  }
  function setHover(id) {
    if (id === hover) return;
    if (hover && pads[hover]) pads[hover].material = mats.pad; hover = id; if (id && pads[id]) pads[id].material = mats.padHot; canvas.style.cursor = id ? 'pointer' : 'grab'; need();
  }
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId); ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptr.size === 1) drag = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t: performance.now(), moved: 0 }; else { drag = null; }
    if (ptr.size === 2) { const a = [...ptr.values()]; pinch = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); }
    vaz = vel = 0;
  });
  canvas.addEventListener('pointermove', e => {
    const p = ptr.get(e.pointerId);
    if (!p) { if (e.pointerType === 'mouse') setHover(pickAt(e.clientX, e.clientY)); return; }
    if (ptr.size === 2) {
      p.x = e.clientX; p.y = e.clientY; const a = [...ptr.values()], d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
      if (pinch > 0) { distT = clamp(distT * pinch / d, fit * 0.38, fit * 1.3); dist = distT; need(); } pinch = d; return;
    }
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
    if (drag.moved > 6) { vaz = -dx * 0.0065; vel = dy * 0.0045; az += vaz; el = clamp(el + vel, 0.5, 1.4); need(); }
  });
  const up = e => {
    const had = ptr.has(e.pointerId); ptr.delete(e.pointerId); if (!had) return;
    if (drag && e.type === 'pointerup' && drag.moved <= 6 && performance.now() - drag.t < 700) { const id = pickAt(e.clientX, e.clientY); vaz = vel = 0; if (id) A.pick(id); }
    else if (drag && performance.now() - drag.t > 120) { /* инерция из последнего движения */ } else { vaz = vel = 0; }
    if (ptr.size < 2) pinch = 0; drag = null; if (Math.abs(vaz) > 2e-4 || Math.abs(vel) > 2e-4) need();
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !ptr.size) setHover(''); });
  canvas.addEventListener('wheel', e => { e.preventDefault(); distT = clamp(distT * Math.exp(e.deltaY * 0.0012), fit * 0.38, fit * 1.3); need(); }, { passive: false });
  rootEl.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-z]'); if (!b) return; const z = b.getAttribute('data-z');
    if (z === 'in') distT = clamp(distT * 0.8, fit * 0.38, fit * 1.3); else if (z === 'out') distT = clamp(distT * 1.25, fit * 0.38, fit * 1.3); else { az = AZ0; el = EL0; distT = fit; vaz = vel = 0; }
    need();
  });
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
    root: rootEl, sig: '', box: null, need: need, resize: resize,
    update(states, lang) {
      const hp = rootEl.querySelector('.gr3-hint'); if (hp && A.hint) hp.textContent = A.hint;
      const sig = lang + '|' + states.map(s => s.id + s.k + (s.l || 0)).join(',');
      if (sig !== inst.sig) { inst.sig = sig; rebuild(states); need(); return; }
      states.forEach(s => { const b = badges[s.id]; if (b && b.txt !== s.txt) {            // только сумма над зданием
        const nb = mkLabel(s.txt, 'badge'); nb.position.copy(b.sp.position); b.sp.parent.add(nb); b.sp.parent.remove(b.sp); b.sp.userData.m.dispose(); b.sp.userData.tex.dispose(); dynDisp.push(nb.userData.m, nb.userData.tex); badges[s.id] = { sp: nb, txt: s.txt }; need(); } });
    },
    bench(ms) { return new Promise(res => { stats.dt.length = 0; bench0 = performance.now(); bench = 1; benchMs = ms; benchDone = () => { const a = stats.dt.slice(), n = a.length, avg = a.reduce((s, x) => s + x, 0) / Math.max(1, n); a.sort((x, y) => x - y); res({ frames: n, avgMs: +avg.toFixed(2), fps: +(1000 / avg).toFixed(1), p95Ms: +(a[Math.floor(n * 0.95)] || 0).toFixed(1), maxMs: +(a[n - 1] || 0).toFixed(1) }); }; need(); }); },
    stop() {
      canvas.removeEventListener('webglcontextlost', onLost); clearInterval(wd); document.removeEventListener('visibilitychange', onVis); if (ro) ro.disconnect(); if (raf) cancelAnimationFrame(raf); raf = 0;
      dynDisp.forEach(o => o.dispose && o.dispose()); disp.forEach(o => o.dispose && o.dispose()); wins.dispose && wins.dispose();
      try { R.dispose(); R.forceContextLoss(); } catch (e) { /* ничего */ }
      rootEl.remove();
    },
    screen(id) { const i = A.states().findIndex(q => q.id === id); if (i < 0) return null; const p = posOf(i), v = new THREE.Vector3(p.x, 0.5, p.z); place(); cam.updateMatrixWorld(); v.project(cam); const r = canvas.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; },
    info: () => ({ calls: R.info.render.calls, tris: R.info.render.triangles, geos: R.info.memory.geometries, tex: R.info.memory.textures, wins: wn })
  };
  return inst;
}

const api3 = {
  supported: () => canGL(),
  mount(box, api) {
    A = api; if (!box) return;
    if (inst) { inst.box = box; box.innerHTML = ''; box.appendChild(inst.root); inst.update(A.states(), A.lang()); inst.resize(); inst.need(); return; }
    pendBox = box; if (box.getAttribute('data-ld') !== '1') { box.setAttribute('data-ld', '1'); box.innerHTML = '<p class="gr3-ld">' + (A.loading || '…') + '</p>'; }
    loadThree().then(() => {
      if (inst) { return; }
      const b = pendBox; if (!b || !b.isConnected) return;
      let i; try { i = build(b); } catch (e) { A.fail && A.fail(false); return; }
      i.box = b; b.innerHTML = ''; b.appendChild(i.root); i.update(A.states(), A.lang()); i.resize();
      document.documentElement.setAttribute('data-gr3', '1');
    }).catch(() => { A.fail && A.fail(false); });
  },
  update() { if (inst && A) inst.update(A.states(), A.lang()); },
  dispose() { if (inst) { const i = inst; inst = null; i.stop(); } pendBox = null; document.documentElement.removeAttribute('data-gr3'); },
  alive: () => !!inst,
  bench: ms => (inst ? inst.bench(ms) : Promise.resolve(null)),
  screen: id => (inst ? inst.screen(id) : null),
  info: () => (inst ? inst.info() : null)
};
root.DofaGorod3D = api3;
})(window);
