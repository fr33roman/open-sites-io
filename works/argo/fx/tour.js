// «Маршрут тура» — камера летит над пастельными горами по Военно-Грузинской дороге, дни тура встают на карте.
// Рельеф low-poly из шума (плоские грани, цвет по высоте и крутизне), Three.js; карточки дней — HTML поверх 3D.
import * as THREE from 'three';
import { loop, watchSize, pointer, damp, css, IS_MOBILE } from './core.js';
import { makeRenderer, release } from './gl.js';

const DAYS = [   // ARGO: дни тура «Тбилиси и Казбеги» (правится только этот список)
  ['Тбилиси', 'Старый город, серные бани и канатка к Нарикале'],
  ['Мцхета и Джвари', 'Древняя столица и монастырь над слиянием рек'],
  ['Ананури и Казбеги', 'Крепость у бирюзового озера и ночь под Казбеком'],
  ['Гудаури', 'Смотровая над перевалом и полёт на параплане'],
];

// карта в условных единицах: x — на восток, z — на юг; дорога идёт с юга (Тбилиси) на север (Гудаури)
const X0 = -46, X1 = 46, Z0 = -80, Z1 = 64;
const KURA = [[3.5, 60], [2.8, 36], [1.4, 22], [0.2, 13], [-1, 7], [-2.2, 3.6], [-7, 2.6], [-14, 4.6], [-22, 3.2], [-31, 5.4], [-48, 4]];
const ARAGVI = [[-2.2, 3.6], [-0.6, -3], [0.9, -10], [0.3, -15], [0, -20], [0.9, -26], [0.5, -31], [0.2, -35]];
const HEAD_VALLEY = [[0.2, -35], [-0.3, -40], [-0.4, -46], [0, -51]];   // верховье: выше истока долина идёт к плато
const LAKE = [0.1, -20.5, 3.6, 5.8];                                // Жинвальское водохранилище: центр и полуоси
const ROUTE = [[5.4, 26], [4.4, 19], [2.9, 12], [1.9, 6.4], [2.6, -1], [3.5, -8], [4.1, -14], [4.3, -20.5], [3.9, -27],
  [2.9, -32], [2.0, -35.3], [0.2, -37.4], [-2.0, -38.9], [0.9, -40.9], [-1.5, -43.1], [-0.2, -46.6]];
const STOP_AT = [0, 3, 7, 15];                                      // точки маршрута, где остановки
const PLATEAU = 6.0;                                                // высота плато Гудаури
const RAMP = [-36, -45.5];                                          // здесь дно долины серпантином поднимается к плато

const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

/** Симплекс-шум 2D с постоянным зерном: карта одна и та же при каждом открытии */
function makeNoise(seed) {
  const perm = new Uint8Array(512), src = [...Array(256).keys()];
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [src[i], src[j]] = [src[j], src[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = src[i & 255];
  const G = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
  const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
  const c = (g, x, y) => { let t = 0.5 - x * x - y * y; if (t < 0) return 0; t *= t; return t * t * (g[0] * x + g[1] * y); };
  return (x, y) => {
    const k = (x + y) * F2, i = Math.floor(x + k), j = Math.floor(y + k), t = (i + j) * G2;
    const x0 = x - i + t, y0 = y - j + t, i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
    const ii = i & 255, jj = j & 255;
    return 70 * (c(G[perm[ii + perm[jj]] & 7], x0, y0)
      + c(G[perm[ii + i1 + perm[jj + j1]] & 7], x0 - i1 + G2, y0 - j1 + G2)
      + c(G[perm[ii + 1 + perm[jj + 1]] & 7], x0 - 1 + 2 * G2, y0 - 1 + 2 * G2));
  };
}
const N1 = makeNoise(7), N2 = makeNoise(19), N3 = makeNoise(41);
const fbm = (x, z) => N1(x, z) * 0.6 + N1(x * 2.1 + 3.3, z * 2.1 - 1.7) * 0.28 + N1(x * 4.3, z * 4.3) * 0.12;
const ridged = (x, z) => { let s = 0, a = 0.55, f = 1; for (let o = 0; o < 4; o++) { const n = 1 - Math.abs(N2(x * f, z * f)); s += n * n * a; a *= 0.5; f *= 2.03; } return s; };

/** Ломаная по сглаженной кривой через точки (x, z) */
function dense(pts, n) {
  const c = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)));
  return c.getSpacedPoints(n).map((v) => [v.x, v.z]);
}
/** Расстояние до ломаной и доля пути до ближайшей точки */
function near(pl, x, z) {
  let best = 1e9, bt = 0;
  for (let i = 0; i < pl.length - 1; i++) {
    const [ax, az] = pl[i], [bx, bz] = pl[i + 1];
    const vx = bx - ax, vz = bz - az, wx = x - ax, wz = z - az;
    const t = Math.max(0, Math.min(1, (wx * vx + wz * vz) / (vx * vx + vz * vz)));
    const dx = wx - vx * t, dz = wz - vz * t, d = dx * dx + dz * dz;
    if (d < best) { best = d; bt = (i + t) / (pl.length - 1); }
  }
  return { d: Math.sqrt(best), t: bt };
}
const KURA_D = dense(KURA, 110), ARAGVI_D = dense(ARAGVI, 80), TOP_D = dense(HEAD_VALLEY, 20);
const S4 = ROUTE[STOP_AT[3]];
const floorAt = (z) => 0.45 + (PLATEAU - 0.45) * sm(RAMP[0], RAMP[1], z);

/** Высота рельефа: долины рек, холмы на юге, горы на севере, Казбек, плато Гудаури, русла ниже воды */
function heightAt(x, z) {
  const n = sm(24, -50, z);                                         // 0 на юге, 1 на севере
  const dk = near(KURA_D, x, z), da = near(ARAGVI_D, x, z);
  const dv = Math.min(dk.d, da.d, near(TOP_D, x, z).d);
  const floorH = floorAt(z) + 0.2 * fbm(x * 0.09, z * 0.09);
  const hills = (0.6 + 0.4 * N3(x * 0.05, z * 0.05)) * (1.6 + 2.6 * n) + 0.7 * fbm(x * 0.13 + 5, z * 0.13 - 2);
  const peaks = ridged(x * 0.03 + 3, z * 0.03 - 1) * (1 + 14 * n * n);
  const w0 = mix(4.4, 2.8, n) + 4.5 * sm(-33, -43, z);            // у Гудаури долина раздаётся в чашу
  let h = floorH + sm(w0, w0 + mix(10, 7, n), dv) * Math.max(0, hills + peaks);
  h = mix(floorH, h, sm(5, 12, Math.hypot(x - 2.2, z - 25)));      // Тбилисская котловина — широкая и ровная
  h += 2.3 * Math.pow(Math.max(0, 1 - Math.hypot(x - 4.9, z - 2.4) / 3.2), 1.4);          // холм Джвари
  h += 20 * Math.pow(Math.max(0, 1 - Math.hypot(x - 8, z + 64) / 16), 1.7);               // Казбек
  h += sm(-66, -76, z) * 10 * (0.6 + 0.4 * ridged(x * 0.06, z * 0.06));                   // хребет по краю карты
  h = mix(PLATEAU + 0.12 * fbm(x * 0.3, z * 0.3), h, sm(2.4, 5.2, Math.hypot(x - S4[0], z - S4[1])));   // плато Гудаури
  // русла и озеро — ниже уровня воды (0); река сужается к истоку
  const wa = 0.8 * (1 - sm(0.78, 1, da.t));
  let bed = Math.min(sm(0.3, 1.35, dk.d), wa > 0.02 ? sm(wa * 0.35, wa * 1.5, da.d) : 1);
  bed = Math.min(bed, sm(0.75, 1.08, Math.hypot((x - LAKE[0]) / LAKE[2], (z - LAKE[1]) / LAKE[3])));
  return mix(-0.5, h, bed);
}

// пастельная палитра граней
const PAL = Object.fromEntries(Object.entries({
  bank: '#efe6dc', grassA: '#c4e8cb', grassB: '#b0ddbf', meadow: '#dcefcb', pink: '#e3e4ee',
  lav: '#c9d0e6', rock: '#a9b3d3', deep: '#8f9bc4', snow: '#eef2f7', snowS: '#dde3ee',
}).map(([k, v]) => [k, new THREE.Color(v)]));

/** Цвет грани по высоте над дном долины, крутизне и месту */
function faceColor(out, h, slope, x, z, r) {
  const rel = h - floorAt(z);
  if (h < 0.1) out.copy(PAL.bank);
  else if (rel < 0.9 && slope < 0.22) out.copy(PAL.grassA).lerp(PAL.grassB, 0.5 + 0.5 * N1(x * 0.21, z * 0.21));
  else if (h > 8.8 + 1.8 * N3(x * 0.16, z * 0.16) && slope < 0.62) out.copy(PAL.snow).lerp(PAL.snowS, r * 0.7);
  else {
    const t = sm(1, 9.5, h), st = sm(0.18, 0.75, slope);
    out.copy(PAL.meadow).lerp(PAL.pink, sm(1.1, 3.4, rel)).lerp(PAL.lav, t).lerp(PAL.rock, st * 0.55 + t * 0.2).lerp(PAL.deep, st * t * 0.55);
  }
  out.multiplyScalar(0.97 + r * 0.06);
}

/** Склейка простых геометрий в одну (позиции, нормали, цвет вершин) */
function merge(list) {
  const pos = [], nor = [], col = [];
  for (const [g0, color] of list) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    g.computeVertexNormals();
    const c = new THREE.Color(color || '#ffffff');
    pos.push(...g.attributes.position.array);
    nor.push(...g.attributes.normal.array);
    for (let i = 0; i < g.attributes.position.count; i++) col.push(c.r, c.g, c.b);
    g.dispose(); if (g !== g0) g0.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return out;
}

/** Рельеф: сетка со сдвинутыми узлами и чередующейся диагональю — грани неровные, как нарисованные */
function buildTerrain(nx, nz) {
  const dx = (X1 - X0) / nx, dz = (Z1 - Z0) / nz, W = nx + 1;
  const vx = new Float32Array(W * (nz + 1)), vz = new Float32Array(W * (nz + 1)), vy = new Float32Array(W * (nz + 1));
  let s = 3;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const k = j * W + i, edge = i === 0 || j === 0 || i === nx || j === nz;
    vx[k] = X0 + i * dx + (edge ? 0 : (rnd() - 0.5) * 0.42 * dx);
    vz[k] = Z0 + j * dz + (edge ? 0 : (rnd() - 0.5) * 0.42 * dz);
    vy[k] = heightAt(vx[k], vz[k]);
  }
  const tris = (i, j) => {
    const a = j * W + i, b = a + 1, c = a + W, d = c + 1;
    return (i + j) % 2 ? [[a, c, b], [b, c, d]] : [[a, c, d], [a, d, b]];
  };
  const pos = new Float32Array(nx * nz * 18), col = new Float32Array(nx * nz * 18);
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), cl = new THREE.Color();
  let o = 0;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) for (const t of tris(i, j)) {
    A.set(vx[t[0]], vy[t[0]], vz[t[0]]); B.set(vx[t[1]], vy[t[1]], vz[t[1]]); C.set(vx[t[2]], vy[t[2]], vz[t[2]]);
    const h = (A.y + B.y + C.y) / 3, cx = (A.x + B.x + C.x) / 3, cz = (A.z + B.z + C.z) / 3;
    const ny = B.clone().sub(A).cross(C.clone().sub(A)).normalize().y;
    faceColor(cl, h, 1 - ny, cx, cz, rnd());
    for (const P of [A, B, C]) { pos[o] = P.x; pos[o + 1] = P.y; pos[o + 2] = P.z; col[o] = cl.r; col[o + 1] = cl.g; col[o + 2] = cl.b; o += 3; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  // высота ровно по граням: дорога и значки лежат на земле, а не парят и не тонут
  const bary = (px, pz, t) => {
    const [a, b, c] = t, x1 = vx[a], z1 = vz[a], x2 = vx[b], z2 = vz[b], x3 = vx[c], z3 = vz[c];
    const den = (z2 - z3) * (x1 - x3) + (x3 - x2) * (z1 - z3);
    const l1 = ((z2 - z3) * (px - x3) + (x3 - x2) * (pz - z3)) / den, l2 = ((z3 - z1) * (px - x3) + (x1 - x3) * (pz - z3)) / den, l3 = 1 - l1 - l2;
    return l1 > -1e-4 && l2 > -1e-4 && l3 > -1e-4 ? l1 * vy[a] + l2 * vy[b] + l3 * vy[c] : null;
  };
  const surface = (x, z) => {
    const i0 = Math.floor((x - X0) / dx), j0 = Math.floor((z - Z0) / dz);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const i = i0 + di, j = j0 + dj;
      if (i < 0 || j < 0 || i >= nx || j >= nz) continue;
      for (const t of tris(i, j)) { const y = bary(x, z, t); if (y !== null) return y; }
    }
    return heightAt(x, z);
  };
  return { geometry: g, surface };
}

/** Небо: персик у горизонта → розовый → сиреневый, мягкое солнце */
function skyMaterial(horizon, sunDir) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      uH: { value: horizon }, uM: { value: new THREE.Color('#dbe6ef') }, uT: { value: new THREE.Color('#a8bfd9') },
      uSun: { value: sunDir }, uSunC: { value: new THREE.Color('#fff4e6') },
    },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
      uniform vec3 uH, uM, uT, uSun, uSunC; varying vec3 vD;
      void main(){
        float y = max(vD.y, 0.0);
        vec3 c = mix(uH, uM, smoothstep(0.0, 0.22, y));
        c = mix(c, uT, smoothstep(0.18, 0.75, y));
        float s = max(dot(normalize(vD), normalize(uSun)), 0.0);
        c = mix(c, uSunC, smoothstep(0.9975, 0.999, s));             // диск солнца
        c += uSunC * (pow(s, 60.0) * 0.35 + pow(s, 8.0) * 0.12);    // ореол
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

/** Цифра дня на белом круге — лицо значка */
function digitTexture(n) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const draw = () => {
    g.clearRect(0, 0, 128, 128);
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(64, 64, 62, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#9B2335'; g.font = '700 78px "Source Sans 3", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(n), 64, 69);
  };
  draw();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  // шрифт мог ещё не прийти: когда придёт — перерисовать цифру
  if (document.fonts) document.fonts.load('700 78px "Source Sans 3"').then(() => { draw(); t.needsUpdate = true; }).catch(() => {});
  return t;
}

/** Значок остановки — плоская «капля» с фаской, остриём в землю */
function pinGeometry() {
  const R = 0.34, C = 0.8, th = Math.acos(R / C), al = Math.PI / 2 - th;
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(R * Math.sin(th), C - R * Math.cos(th));
  s.absarc(0, C, R, -al, Math.PI + al, false);
  s.lineTo(0, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.03, bevelSegments: 3, curveSegments: 20 });
  g.translate(0, 0, -0.035);
  return g;
}

export function mount(stage, opts = {}) {
  // ARGO: карточки пишутся шрифтом сайта (Source Sans 3 уже загружен страницей)
  css('tour', `
    .tour-card{position:absolute;left:0;top:0;z-index:6;pointer-events:none;width:max-content;max-width:290px;padding:12px 16px 13px;border-radius:16px;
      background:rgba(255,255,255,.86);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);box-shadow:0 18px 44px rgba(16,42,67,.16),0 0 0 1px rgba(16,42,67,.06);
      font:600 14px/1.35 'Source Sans 3',system-ui,sans-serif;color:#3c4d5e;opacity:0;transition:opacity .35s,translate .35s;translate:0 8px;will-change:transform}
    .tour-card.on{opacity:1;translate:0 0}
    .tour-card b{display:block;font:700 17px/1.2 'Source Sans 3',system-ui,sans-serif;color:#102A43;margin-bottom:3px;letter-spacing:-.005em}
    .tour-card b i{font-style:normal;color:#9B2335}
    .tour-tag{position:absolute;left:0;top:0;z-index:6;pointer-events:none;white-space:nowrap;font:700 13px/1 'Source Sans 3',system-ui,sans-serif;color:#102A43;
      padding:6px 10px 6px 6px;border-radius:999px;background:rgba(255,255,255,.9);box-shadow:0 8px 22px rgba(16,42,67,.14);display:flex;align-items:center;gap:6px;
      opacity:0;transition:opacity .4s;will-change:transform}
    .tour-tag i{font-style:normal;width:19px;height:19px;border-radius:50%;background:#9B2335;color:#fff;display:grid;place-items:center;font-size:11.5px}
    .tour-sum{position:absolute;z-index:6;pointer-events:none;top:clamp(80px,12vh,120px);right:clamp(16px,5vw,64px);padding:16px 20px 15px;border-radius:18px;
      background:rgba(255,255,255,.86);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);box-shadow:0 18px 44px rgba(16,42,67,.16),0 0 0 1px rgba(16,42,67,.06);
      font:700 14px/1.3 'Source Sans 3',system-ui,sans-serif;color:#3c4d5e;opacity:0;transition:opacity .5s,translate .5s;translate:0 10px}
    .tour-sum.on{opacity:1;translate:0 0}
    .tour-sum b{display:block;font:700 clamp(30px,3.6vw,48px)/1 'Source Sans 3',system-ui,sans-serif;color:#102A43;letter-spacing:-.02em;margin-bottom:6px}
    .tour-sum b i{font-style:normal;color:#9B2335}
    @media (max-width:760px){
      .tour-card{left:16px!important;right:16px;top:84px!important;transform:none!important;max-width:none;width:auto}
      .tour-tag{font-size:12px;padding:5px 8px 5px 5px}
      .tour-sum{right:16px;left:16px;top:84px;padding:13px 16px 12px}
    }`);
  stage.style.background = '#E6EDF1';
  stage.style.touchAction = 'pan-y';

  const HORIZON = new THREE.Color('#E9EFF3');
  const renderer = makeRenderer(stage, { antialias: true });
  renderer.setClearColor(HORIZON, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;                           // горы стоят: тень считаем один раз
  renderer.shadowMap.needsUpdate = true;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(HORIZON, 38, 150);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 700);
  const disposables = [];
  const keep = (x) => { disposables.push(x); return x; };

  // свет: мягкое небо + тёплое солнце с юга, из-за спины: склоны, обращённые к камере, светлые
  const sunDir = new THREE.Vector3(-0.45, 0.6, 0.66).normalize();
  scene.add(new THREE.HemisphereLight('#f4f8fb', '#c2cddd', 1.7));
  const sun = new THREE.DirectionalLight('#ffe4cf', 2.9);
  sun.position.copy(sunDir).multiplyScalar(90);
  sun.castShadow = true;
  const sc = sun.shadow.camera;
  sc.left = -82; sc.right = 82; sc.top = 82; sc.bottom = -82; sc.near = 10; sc.far = 240;
  sun.shadow.mapSize.set(IS_MOBILE ? 1024 : 2048, IS_MOBILE ? 1024 : 2048);
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.06;
  sun.target.position.set(0, 0, -11);
  scene.add(sun, sun.target);

  const sky = new THREE.Mesh(keep(new THREE.SphereGeometry(500, 32, 16)), keep(skyMaterial(HORIZON, new THREE.Vector3(-0.8, 0.1, -0.55))));
  sky.renderOrder = -1;
  scene.add(sky);

  // рельеф
  const T = buildTerrain(IS_MOBILE ? 92 : 152, IS_MOBILE ? 144 : 240);
  const ground = new THREE.Mesh(keep(T.geometry), keep(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })));
  ground.receiveShadow = ground.castShadow = true;
  scene.add(ground);
  const Y = T.surface;

  let waterMat = null;
  // вода: плоские треугольники на уровне 0, каждый мерцает в своей фазе; у берега светлее
  {
    const step = IS_MOBILE ? 1.3 : 0.95, nx = Math.ceil((X1 - X0) / step), nz = Math.ceil((Z1 - Z0) / step);
    const pos = [], ph = [], dep = [];
    let s = 11;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const jit = new Map();
    const P = (i, j) => {
      const k = i + ',' + j;
      if (!jit.has(k)) { const e = i === 0 || j === 0 || i === nx || j === nz; jit.set(k, [X0 + i * step + (e ? 0 : (rnd() - 0.5) * 0.5 * step), Z0 + j * step + (e ? 0 : (rnd() - 0.5) * 0.5 * step)]); }
      return jit.get(k);
    };
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const cx = X0 + (i + 0.5) * step, cz = Z0 + (j + 0.5) * step;
      const hs = step * 0.5;
      if (Math.min(Y(cx, cz), Y(cx - hs, cz - hs), Y(cx + hs, cz + hs), Y(cx + hs, cz - hs), Y(cx - hs, cz + hs)) > 0.25) continue;
      const a = P(i, j), b = P(i + 1, j), c = P(i, j + 1), d = P(i + 1, j + 1);
      for (const tri of [[a, c, b], [b, c, d]]) {
        const r = rnd();
        for (const [x, z] of tri) { pos.push(x, 0, z); ph.push(r); dep.push(Math.max(0, -Y(x, z))); }
      }
    }
    const g = keep(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aPh', new THREE.Float32BufferAttribute(ph, 1));
    g.setAttribute('aDep', new THREE.Float32BufferAttribute(dep, 1));
    waterMat = keep(new THREE.ShaderMaterial({
      fog: true,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        uT: { value: 0 }, uShallow: { value: new THREE.Color('#b9ecea') }, uDeep: { value: new THREE.Color('#7fcfd6') }, uHi: { value: new THREE.Color('#f4fffd') },
      }]),
      vertexShader: /* glsl */`
        attribute float aPh; attribute float aDep; varying float vPh; varying float vDep;
        #include <fog_pars_vertex>
        void main(){ vPh = aPh; vDep = aDep; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */`
        uniform float uT; uniform vec3 uShallow, uDeep, uHi; varying float vPh; varying float vDep;
        #include <fog_pars_fragment>
        void main(){
          vec3 c = mix(uShallow, uDeep, smoothstep(0.02, 0.35, vDep));
          float w = 0.5 + 0.5 * sin(uT * 1.4 + vPh * 6.2832);
          c = mix(c, uHi, w * 0.16 + pow(max(0.0, sin(uT * 0.8 + vPh * 41.0)), 24.0) * 0.55);   // грани мерцают, изредка — блик
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    }));
    scene.add(new THREE.Mesh(g, waterMat));
  }

  // ели и круглые деревья — по склонам и долинам, не на дороге и не в воде
  const routeCurve = new THREE.CatmullRomCurve3(ROUTE.map(([x, z]) => new THREE.Vector3(x, 0, z)));
  const ROUTE_D = routeCurve.getSpacedPoints(160).map((v) => [v.x, v.z]);
  const stops = STOP_AT.map((i) => ROUTE[i]);
  const nearRoad = (x, z, r) => x > -4 && x < 7.5 && z > -48.5 && z < 28 && near(ROUTE_D, x, z).d < r;
  let seed = 5;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sv = new THREE.Vector3(), pv = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  {
    const fir = keep(merge([
      [new THREE.CylinderGeometry(0.035, 0.045, 0.16, 5).translate(0, 0.08, 0), '#8d7a8f'],
      [new THREE.ConeGeometry(0.24, 0.5, 6).translate(0, 0.38, 0), '#ffffff'],
      [new THREE.ConeGeometry(0.17, 0.38, 6).translate(0, 0.66, 0), '#ffffff'],
    ]));
    const round = keep(merge([
      [new THREE.CylinderGeometry(0.035, 0.045, 0.2, 5).translate(0, 0.1, 0), '#8d7a8f'],
      [new THREE.IcosahedronGeometry(0.22, 0).translate(0, 0.36, 0), '#ffffff'],
    ]));
    const treeMat = keep(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    const FIRS = ['#5aa594', '#4d9888', '#68b09c', '#7aa9a8'].map((c) => new THREE.Color(c));
    const ROUNDS = ['#9fd8b4', '#b7e2a8', '#f4c4ad', '#8fcfb0'].map((c) => new THREE.Color(c));
    const NF = IS_MOBILE ? 900 : 2000, NR = IS_MOBILE ? 80 : 170;
    const firs = new THREE.InstancedMesh(fir, treeMat, NF), rounds = new THREE.InstancedMesh(round, treeMat, NR);
    let nf = 0, nr = 0;
    for (let k = 0; k < 90000 && (nf < NF || nr < NR); k++) {
      const x = X0 + 2 + rnd() * (X1 - X0 - 4), z = Z0 + 2 + rnd() * (Z1 - Z0 - 4);
      const h = Y(x, z), rel = h - floorAt(z);
      if (h < 0.3 || h > 8) continue;
      const slope = Math.abs(Y(x + 0.4, z) - h) + Math.abs(Y(x, z + 0.4) - h);
      if (slope > 0.5) continue;
      const forest = N3(x * 0.09 + 9, z * 0.09) + 0.35 * N1(x * 0.3, z * 0.3);   // леса пятнами, края неровные
      const grove = N1(x * 0.2 + 4, z * 0.2 - 7);
      const isFir = rel > 0.7 && rel < 6.5 && forest > 0.28;
      const isRound = rel < 0.6 && grove > 0.5;
      if (!(isFir && nf < NF) && !(isRound && nr < NR)) continue;
      if (nearRoad(x, z, 0.8) || stops.some(([sx, sz]) => Math.hypot(x - sx, z - sz) < 2.2)) continue;
      q.setFromAxisAngle(up, rnd() * 6.28);
      if (isRound && nr < NR) {
        const s = 0.75 + rnd() * 0.45;
        rounds.setMatrixAt(nr, m4.compose(pv.set(x, h - 0.02, z), q, sv.set(s, s, s)));
        rounds.setColorAt(nr++, ROUNDS[Math.floor(rnd() * ROUNDS.length)]);
      } else {
        const s = 0.7 + rnd() * 0.55;
        firs.setMatrixAt(nf, m4.compose(pv.set(x, h - 0.02, z), q, sv.set(s, s * (0.9 + rnd() * 0.3), s)));
        firs.setColorAt(nf++, FIRS[Math.floor(rnd() * FIRS.length)]);
      }
    }
    firs.count = nf; rounds.count = nr;
    for (const m of [firs, rounds]) { m.castShadow = true; m.receiveShadow = true; scene.add(m); }
  }

  // городки у остановок: белые домики с цветными крышами; на холме — Джвари, у озера — башни Ананури
  {
    const house = keep(new THREE.BoxGeometry(0.3, 0.24, 0.24).translate(0, 0.12, 0));
    const roof = keep(new THREE.ConeGeometry(0.24, 0.17, 4).rotateY(Math.PI / 4).scale(1, 1, 0.82).translate(0, 0.325, 0));
    const wallMat = keep(new THREE.MeshLambertMaterial({ color: '#fffaf3' })), roofMat = keep(new THREE.MeshLambertMaterial({ color: '#ffffff' }));
    const ROOFS = ['#ec8f7c', '#f2a7a6', '#b8a4dc', '#e9b48a'].map((c) => new THREE.Color(c));
    const plan = [[0, 80, 7.5, 0.2, 1.4], [1, 26, 4.2, 0.2, 1.6], [2, 10, 3.2, 0.2, 1.6], [3, 18, 3.4, PLATEAU - 0.5, PLATEAU + 0.5]];
    const N = plan.reduce((a, p) => a + p[1], 0);
    const walls = new THREE.InstancedMesh(house, wallMat, N), roofs = new THREE.InstancedMesh(roof, roofMat, N);
    let n = 0;
    for (const [k, cnt, rad, lo, hi] of plan) {
      const [sx, sz] = stops[k];
      for (let a = 0, placed = 0; a < 900 && placed < cnt; a++) {
        const r = Math.sqrt(rnd()) * rad, an = rnd() * 6.28, x = sx + Math.cos(an) * r * 1.2, z = sz + Math.sin(an) * r;
        const h = Y(x, z);
        if (h < lo || h > hi || nearRoad(x, z, 0.5) || Math.hypot(x - sx, z - sz) < 0.9) continue;
        if (Math.abs(Y(x + 0.3, z) - h) + Math.abs(Y(x, z + 0.3) - h) > 0.18) continue;
        const tall = k === 0 && r < 3.5 && rnd() < 0.35 ? 1.4 + rnd() * 1.4 : 1;
        q.setFromAxisAngle(up, (Math.floor(rnd() * 4) * Math.PI) / 2 + (rnd() - 0.5) * 0.3);
        walls.setMatrixAt(n, m4.compose(pv.set(x, Y(x, z) - 0.02, z), q, sv.set(1, tall, 1)));
        roofs.setMatrixAt(n, m4.compose(pv.set(x, Y(x, z) - 0.02 + 0.24 * (tall - 1), z), q, sv.set(1, 1, 1)));
        roofs.setColorAt(n++, ROOFS[Math.floor(rnd() * ROOFS.length)]);
        placed++;
      }
    }
    walls.count = roofs.count = n;
    for (const m of [walls, roofs]) { m.castShadow = true; m.receiveShadow = true; scene.add(m); }
    // Джвари — храм на холме; Ананури — две башни у воды; Гергети — храм под Казбеком
    const stone = keep(new THREE.MeshLambertMaterial({ color: '#f3e6d6', flatShading: true })), dark = keep(new THREE.MeshLambertMaterial({ color: '#8d98bd', flatShading: true }));
    const church = (x, z, s) => {
      const g = new THREE.Group(), y = Y(x, z);
      const add = (geo, mat, px, py, pz) => { const m = new THREE.Mesh(keep(geo), mat); m.position.set(px, py, pz); m.castShadow = true; g.add(m); };
      add(new THREE.BoxGeometry(0.7, 0.34, 0.36), stone, 0, 0.17, 0);
      add(new THREE.BoxGeometry(0.36, 0.34, 0.7), stone, 0, 0.17, 0);
      add(new THREE.CylinderGeometry(0.12, 0.12, 0.22, 8), stone, 0, 0.45, 0);
      add(new THREE.ConeGeometry(0.15, 0.2, 8), dark, 0, 0.66, 0);
      g.position.set(x, y - 0.02, z); g.scale.setScalar(s); g.rotation.y = 0.4;
      scene.add(g);
    };
    church(4.9, 2.4, 1.1);
    church(9.5, -54.5, 0.9);
    const tower = (x, z, h) => {
      const t = new THREE.Mesh(keep(new THREE.BoxGeometry(0.34, h, 0.34).translate(0, h / 2, 0)), stone);
      const r = new THREE.Mesh(keep(new THREE.ConeGeometry(0.28, 0.26, 4).rotateY(Math.PI / 4).translate(0, h + 0.13, 0)), dark);
      for (const m of [t, r]) { m.position.set(x, Y(x, z) - 0.02, z); m.castShadow = true; scene.add(m); }
    };
    tower(3.1, -16.2, 0.9); tower(3.6, -15.3, 0.65);
  }

  // дорога: лента по земле, пройденная часть — пунктир, впереди — тонкая бледная линия
  const routeLen = routeCurve.getLength();
  const RP = routeCurve.getSpacedPoints(Math.round(routeLen / 0.12));
  const stopU = stops.map(([sx, sz]) => {
    let best = 1e9, bi = 0;
    RP.forEach((p, i) => { const d = Math.hypot(p.x - sx, p.z - sz); if (d < best) { best = d; bi = i; } });
    return bi / (RP.length - 1);
  });
  const routeMat = keep(new THREE.ShaderMaterial({
    fog: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uHalf: { value: 0.11 }, uReveal: { value: 0 }, uDash: { value: 0.62 }, uShift: { value: 0 }, uAhead: { value: 0.6 },
      uCol: { value: new THREE.Color('#9B2335') },
    }]),
    vertexShader: /* glsl */`
      attribute vec2 aPerp; attribute float aSide; attribute float aDist;
      uniform float uHalf; varying float vD; varying float vS;
      #include <fog_pars_vertex>
      void main(){
        vD = aDist; vS = aSide;
        vec3 p = position + vec3(aPerp.x, 0.0, aPerp.y) * aSide * uHalf;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      uniform float uReveal, uDash, uShift, uAhead; uniform vec3 uCol; varying float vD; varying float vS;
      #include <fog_pars_fragment>
      void main(){
        vec3 col; float a;
        if (vD <= uReveal) {
          float ph = fract((vD - uShift) / uDash);
          a = smoothstep(0.0, 0.05, ph) * (1.0 - smoothstep(0.52, 0.57, ph)) * (1.0 - smoothstep(0.8, 1.0, abs(vS)));
          col = uCol;
        } else {
          a = step(abs(vS), 0.4) * step(fract(vD / (uDash * 0.55)), 0.45) * uAhead;
          col = vec3(1.0);
        }
        if (a < 0.02) discard;
        gl_FragColor = vec4(col, a);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  }));
  {
    const n = RP.length, pos = new Float32Array(n * 6), perp = new Float32Array(n * 4), side = new Float32Array(n * 2), dist = new Float32Array(n * 2), idx = [];
    for (let i = 0; i < n; i++) {
      const a = RP[Math.max(0, i - 1)], b = RP[Math.min(n - 1, i + 1)];
      let tx = b.x - a.x, tz = b.z - a.z;
      const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      const y = Math.max(Y(RP[i].x, RP[i].z), Y(RP[i].x - tz * 0.1, RP[i].z + tx * 0.1), Y(RP[i].x + tz * 0.1, RP[i].z - tx * 0.1)) + 0.05;
      for (let k = 0; k < 2; k++) {
        const v = i * 2 + k;
        pos.set([RP[i].x, y, RP[i].z], v * 3);
        perp.set([-tz, tx], v * 2);
        side[v] = k ? 1 : -1;
        dist[v] = (i / (n - 1)) * routeLen;
      }
      if (i < n - 1) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const g = keep(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aPerp', new THREE.BufferAttribute(perp, 2));
    g.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
    g.setAttribute('aDist', new THREE.BufferAttribute(dist, 1));
    g.setIndex(idx);
    const road = new THREE.Mesh(g, routeMat);
    road.frustumCulled = false;
    road.renderOrder = 2;
    scene.add(road);
  }
  const routeAt = (u) => { const p = RP[Math.round(Math.min(1, Math.max(0, u)) * (RP.length - 1))]; return new THREE.Vector3(p.x, Y(p.x, p.z), p.z); };

  // значки остановок: капля с цифрой, смотрит в камеру; при появлении по земле расходится круг
  const pinGeo = keep(pinGeometry()), faceGeo = keep(new THREE.CircleGeometry(0.2, 32)), ringGeo = keep(new THREE.RingGeometry(0.34, 0.42, 48));
  const pinMat = keep(new THREE.MeshLambertMaterial({ color: '#c0404c', emissive: '#9B2335', emissiveIntensity: 0.28 }));
  const pins = stops.map(([x, z], i) => {
    const base = new THREE.Vector3(x, Y(x, z), z);
    const holder = new THREE.Group();
    holder.position.copy(base);
    const pin = new THREE.Group();
    pin.add(new THREE.Mesh(pinGeo, pinMat));
    const tex = keep(digitTexture(i + 1));
    const face = new THREE.Mesh(faceGeo, keep(new THREE.MeshBasicMaterial({ map: tex, fog: false })));
    face.position.set(0, 0.8, 0.075);
    pin.add(face);
    holder.add(pin);
    const ringMat = keep(new THREE.MeshBasicMaterial({ color: '#c0404c', transparent: true, opacity: 0, depthWrite: false, fog: false }));
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    holder.add(ring);
    scene.add(holder);
    return { holder, pin, ring, ringMat, base, head: new THREE.Vector3() };
  });

  // путешественник — светлая точка на конце пройденного пути
  const dot = new THREE.Mesh(keep(new THREE.SphereGeometry(0.13, 20, 14)), keep(new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false })));
  const halo = new THREE.Mesh(keep(new THREE.RingGeometry(0.16, 0.26, 40)), keep(new THREE.MeshBasicMaterial({ color: '#9B2335', transparent: true, depthWrite: false, fog: false })));
  scene.add(dot, halo);

  // параплан над Гудаури кружит сам по себе
  const glider = new THREE.Group();
  {
    const wing = new THREE.Mesh(keep(new THREE.TorusGeometry(0.42, 0.05, 4, 16, Math.PI * 0.8).rotateZ(Math.PI * 0.1).scale(1, 0.5, 2.2)),
      keep(new THREE.MeshLambertMaterial({ color: '#ffb35c', emissive: '#ff8a4a', emissiveIntensity: 0.3, side: THREE.DoubleSide })));
    const man = new THREE.Mesh(keep(new THREE.SphereGeometry(0.05, 8, 6)), keep(new THREE.MeshLambertMaterial({ color: '#1d3552' })));
    man.position.y = -0.36;
    glider.add(wing, man);
    scene.add(glider);
  }

  // облака: плоские low-poly, плывут на восток
  const clouds = [];
  let cloudMat = null;
  {
    cloudMat = keep(new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#e8eef4', emissiveIntensity: 0.55, flatShading: true, transparent: true }));
    const NC = IS_MOBILE ? 7 : 11;
    for (let i = 0; i < NC; i++) {
      const parts = [], n = 4 + Math.floor(rnd() * 3);
      for (let k = 0; k < n; k++) {
        const e = Math.abs(k - (n - 1) / 2) / ((n - 1) / 2), s = (1.15 - e * 0.55) * (0.85 + rnd() * 0.3);   // к краям клубы меньше
        const g = new THREE.IcosahedronGeometry(1, 1).scale(s * 1.1, s * 0.8, s * 0.9).translate((k - (n - 1) / 2) * 0.95, s * 0.35, (rnd() - 0.5) * 0.7);
        const a2 = g.attributes.position;
        for (let v = 0; v < a2.count; v++) if (a2.getY(v) < 0) a2.setY(v, a2.getY(v) * 0.25);   // плоское дно
        parts.push([g]);
      }
      const m = new THREE.Mesh(keep(merge(parts)), cloudMat);
      const sz = 1.3 + rnd() * 1.1;
      m.scale.set(sz, sz * 0.8, sz);
      let x, z;
      for (let a = 0; a < 30; a++) { x = X0 + rnd() * (X1 - X0); z = Z0 + 6 + rnd() * (Z1 - Z0 - 12); if (near(ROUTE_D, x, z).d > 7) break; }
      m.position.set(x, 11 + rnd() * 5 + Math.max(0, Y(x, z) - 6) * 0.6, z);
      m.userData = { x0: x, v: 0.25 + rnd() * 0.3 };
      scene.add(m);
      clouds.push(m);
    }
  }

  // HTML: карточка дня, ярлыки остановок для вида сверху, итог
  const card = document.createElement('div');
  card.className = 'tour-card';
  stage.appendChild(card);
  const tags = DAYS.map(([name], i) => {
    const el = document.createElement('div');
    el.className = 'tour-tag';
    el.innerHTML = `<i>${i + 1}</i>${name}`;
    stage.appendChild(el);
    return el;
  });
  const sum = document.createElement('div');
  sum.className = 'tour-sum';
  sum.innerHTML = '<b>4 дня · <i>380 км</i></b>По Военно-Грузинской дороге';
  stage.appendChild(sum);
  let cardDay = -1;
  const setCard = (k) => {
    if (k === cardDay) return;
    cardDay = k;
    if (k < 0) { card.classList.remove('on'); return; }
    card.innerHTML = `<b><i>День ${k + 1}</i> · ${DAYS[k][0]}</b>${DAYS[k][1]}`;
    card.classList.add('on');
  };

  // полёт: ключевые точки камеры и взгляда; между ними — сглаженные кривые
  const at = (k, dx, dy, dz) => { const [x, z] = stops[k]; return new THREE.Vector3(x + dx, Y(x, z) + dy, z + dz); };
  const P = [0, 0.1, 0.22, 0.34, 0.46, 0.57, 0.66, 0.76, 0.95, 1];
  const HEAD = [[0, 0], [0.1, 0.045], [0.22, stopU[1] - 0.015], [0.34, stopU[1] + 0.02], [0.46, stopU[2] - 0.02], [0.57, stopU[2] + 0.015],
    [0.62, stopU[3] - 0.13], [0.7, 1], [1, 1]];
  let camCurve, lookCurve, narrow = false, W = 1, H = 1;
  const buildFlight = () => {
    // вид сверху: на компьютере дорога лежит слева направо (камера с востока), на телефоне — снизу вверх (камера с юга)
    const c = new THREE.Vector3(1.7, 0, -10.3);
    const top = narrow ? new THREE.Vector3(1.7, 80, 94) : c.clone().add(new THREE.Vector3(42, 70, 0));
    const topLook = narrow ? new THREE.Vector3(1.7, 0, 0.3) : c.clone().add(new THREE.Vector3(6, 0, 0));
    const cams = [at(0, 4, 7.5, 30), at(0, 1, 7, 15), at(1, 6, 7.5, 22), at(1, -5, 7, 18), at(2, 4, 7.5, 26), at(2, -6, 7, 17),
      at(3, 4, 9, 23), at(3, 1.5, 10, 13), top, top];
    const looks = [at(0, -1, 1, -4), at(0, -2, 1, -20), at(1, -1, 1, -3), at(1, 1.5, 1, -2), at(2, -1.5, 0.5, -2), at(2, 0, 0.5, -3),
      at(3, -0.5, 0.5, -3), at(3, 1, 1, -5), topLook, topLook];
    camCurve = new THREE.CatmullRomCurve3(cams, false, 'centripetal');
    lookCurve = new THREE.CatmullRomCurve3(looks, false, 'centripetal');
  };
  const along = (p, table) => {
    for (let i = 1; i < table.length; i++) if (p <= table[i][0]) { const [p0, v0] = table[i - 1], [p1, v1] = table[i]; return v0 + (v1 - v0) * sm(0, 1, (p - p0) / (p1 - p0)); }
    return table[table.length - 1][1];
  };
  const tau = (p) => { for (let i = 1; i < P.length; i++) if (p <= P[i]) return (i - 1 + (p - P[i - 1]) / (P[i] - P[i - 1])) / (P.length - 1); return 1; };

  const ptr = pointer(stage);
  const unwatch = watchSize(stage, (w, h) => {
    W = w; H = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    narrow = w / h < 0.8;
    camera.fov = narrow ? 56 : 42;
    camera.updateProjectionMatrix();
    buildFlight();
  });

  let target = null, shown = 0, px = 0, py = 0;
  const cam = new THREE.Vector3(), look = new THREE.Vector3(), right = new THREE.Vector3(), v = new THREE.Vector3();
  const toScreen = (p) => { v.copy(p).project(camera); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H, v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1]; };
  const easeBack = (x) => { const c1 = 1.9; return x <= 0 ? 0 : x >= 1 ? 1 : 1 + (c1 + 1) * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };

  const lp = loop((t, dt) => {
    const k = dt || 0.016;
    shown = damp(shown, target ?? 0, 4, k);
    const p = shown;
    const head = along(p, HEAD);
    const topK = sm(0.8, 0.95, p);                                  // 0 — полёт, 1 — вид сверху

    // камера по кривой + лёгкий параллакс от курсора; не ниже склона под ней
    const tt = tau(p);
    camCurve.getPoint(tt, cam);
    lookCurve.getPoint(tt, look);
    px = damp(px, ptr.active ? ptr.x : 0, 2.5, k);
    py = damp(py, ptr.active ? ptr.y : 0, 2.5, k);
    right.subVectors(look, cam).cross(up).normalize();
    const par = 1 + topK * 3;
    cam.addScaledVector(right, px * 0.9 * par).addScaledVector(up, py * 0.5 * par);
    cam.y = Math.max(cam.y, Y(cam.x, cam.z) + 1.6);
    camera.position.copy(cam);
    camera.lookAt(look);
    camera.updateMatrixWorld();                                     // карточки ставим по этому же кадру
    sky.position.copy(cam);
    scene.fog.near = mix(38, 90, topK);
    scene.fog.far = mix(150, 260, topK);

    // дорога: пройдено до «головы», пунктир ползёт; на виде сверху линия шире
    const u = routeLen * head;
    routeMat.uniforms.uReveal.value = u;
    routeMat.uniforms.uShift.value = t * 0.35;
    routeMat.uniforms.uHalf.value = mix(0.095, 0.42, topK);
    routeMat.uniforms.uDash.value = mix(0.62, 2.1, topK);
    routeMat.uniforms.uAhead.value = 0.6 * (1 - topK);
    const hp = routeAt(head);
    const perPx = (pt) => pt.distanceTo(camera.position) * 2 * Math.tan(camera.fov * Math.PI / 360) / H;   // мир на пиксель
    const big = 14 * perPx(hp) / 0.26;
    dot.position.set(hp.x, hp.y + 0.14 * big, hp.z);
    dot.scale.setScalar(big);
    halo.position.copy(dot.position);
    halo.quaternion.copy(camera.quaternion);
    const pulse = (t * 0.8) % 1;
    halo.scale.setScalar(big * (1 + pulse * 1.6));
    halo.material.opacity = 0.55 * (1 - pulse);

    // значки встают, когда до них долетаешь; карточка — у ближайшего вставшего значка
    let current = -1;
    pins.forEach((pn, i) => {
      const a = sm(stopU[i] - 0.03, stopU[i] + 0.005, head + (i === 0 ? 0.03 : 0));
      const s = Math.max(0.001, easeBack(a)) * Math.min(8, Math.max(0.35, mix(narrow ? 54 : 64, narrow ? 34 : 42, topK) * perPx(pn.base) / 1.1));
      pn.pin.scale.set(s, s, s);
      pn.pin.position.y = Math.sin(t * 1.6 + i) * 0.04 * a;
      pn.pin.quaternion.copy(camera.quaternion);
      const r = sm(0, 1, a * 1.25);
      pn.ring.scale.setScalar((0.6 + r * 2.4) * Math.max(0.35, s));
      pn.ringMat.opacity = 0.5 * Math.sin(Math.min(1, a * 1.25) * Math.PI) + 0.12 * a;
      pn.head.set(0, 1.05 * s, 0).applyQuaternion(camera.quaternion).add(pn.holder.position);
      if (a > 0.5) current = i;
    });
    const showCard = current >= 0 && topK < 0.2;
    if (showCard) {
      const [sx, sy, vis] = toScreen(pins[current].head);
      if (vis) {
        const cw = card.offsetWidth, ch = card.offsetHeight;
        const x = Math.min(W - cw - 16, Math.max(16, sx + 14)), y = Math.min(H - ch - 16, Math.max(88, sy - ch - 10));
        card.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        setCard(current);
      } else setCard(-1);
    } else setCard(-1);
    tags.forEach((el, i) => {
      const [sx, sy, vis] = toScreen(pins[i].head);
      el.style.transform = `translate(${(sx + 10).toFixed(1)}px, ${(sy - 14).toFixed(1)}px)`;
      el.style.opacity = vis && topK > 0.85 ? 1 : 0;
    });
    sum.classList.toggle('on', p > 0.9);

    // жизнь без касания: облака плывут, параплан кружит, вода мерцает
    for (const c of clouds) { const span = X1 - X0 + 20; c.position.x = X0 - 10 + ((c.userData.x0 - X0 + 10 + t * c.userData.v) % span + span) % span; c.visible = topK < 0.98; }
    cloudMat.opacity = 1 - topK;
    const ga = t * 0.35;
    glider.position.set(S4[0] + 1.5 + Math.cos(ga) * 2.6, PLATEAU + 2.6 + Math.sin(t * 0.9) * 0.2, S4[1] - 1 + Math.sin(ga) * 2.6);
    glider.rotation.set(0, -ga, 0.35);
    waterMat.uniforms.uT.value = t;
    renderer.render(scene, camera);
  });

  return {
    start: lp.start, stop: lp.stop,
    setProgress(p) { if (target === null) shown = p; target = p; },
    destroy() {
      lp.stop(); unwatch();
      card.remove(); sum.remove(); tags.forEach((e) => e.remove());
      disposables.forEach((d) => d.dispose());
      sun.shadow.dispose();
      release(renderer);
    },
  };
}
