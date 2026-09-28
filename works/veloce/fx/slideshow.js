// «Слайд-шоу с жидким переходом» — фото сменяют друг друга растекающейся границей; листать стрелками или пальцем.
import * as THREE from 'three';
import { loop, watchSize, unsplash, css, NOISE, REDUCED, IS_MOBILE } from './core.js';
import { makeRenderer, texture, release } from './gl.js';

const SLIDES = [   // VELOCE: машины первого экрана (правится только этот список)
  ['photo-1648413653877-ade5eefd2f1b', 'G 63 · 1 100 ₾'], ['photo-1614162692292-7ac56d7f7f1e', '911 GT3 · 1 400 ₾'],
  ['photo-1575650681837-c0ca3b1e7275', 'Urus · 1 600 ₾'], ['photo-1555215695-3004980ad54e', 'M5 · 850 ₾'],
  ['photo-1563458563737-e60b1f1b345f', 'Range Rover · 650 ₾'],
];
const HOLD = 2.0, TRANS = 1.0;   // VELOCE: машина стоит 2 с и сменяется за 1 с — новая каждые 3 секунды
const QUAD_VS = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export function mount(stage, opts = {}) {
  css('slideshow', `
    .ss-ui{position:absolute;right:clamp(16px,5vw,64px);bottom:clamp(20px,6vh,64px);z-index:6;display:flex;align-items:center;gap:14px;
      font:600 14px/1 'Exo 2',system-ui,sans-serif;color:#f3f1ec}
    .ss-ui button{width:46px;height:46px;border-radius:50%;border:1px solid rgba(255,255,255,.3);background:rgba(10,10,14,.45);color:#fff;
      cursor:pointer;backdrop-filter:blur(8px);display:grid;place-items:center;transition:.25s}
    .ss-ui button:hover{background:#f3f1ec;color:#0b0b10}
    .ss-ui svg{width:18px;height:18px}
    .ss-count{text-shadow:0 1px 12px rgba(0,0,0,.55)}
    .ss-count b{font-size:22px;letter-spacing:-.02em}
    .ss-bar{width:90px;height:2px;background:rgba(255,255,255,.25);border-radius:2px;overflow:hidden}
    .ss-bar i{display:block;height:100%;width:0;background:#f3f1ec}
    .ss-room{position:absolute;right:clamp(16px,5vw,64px);top:clamp(80px,12vh,120px);z-index:6;font:700 clamp(28px,4vw,52px)/1 'Exo 2',system-ui,sans-serif;
      color:#fff;letter-spacing:-.03em;text-shadow:0 2px 24px rgba(0,0,0,.55),0 1px 3px rgba(0,0,0,.35);transition:opacity .4s,transform .6s}
    .ss-room.out{opacity:0;transform:translateY(12px)}
    @media (max-width:760px){.ss-ui{right:16px;left:auto;bottom:auto;top:84px;gap:10px}.ss-bar{display:none}
      .ss-room{top:89px;left:16px;right:auto;font-size:20px;padding:8px 14px;border-radius:999px;background:rgba(10,10,14,.5);backdrop-filter:blur(8px);text-shadow:none}}`);

  const renderer = makeRenderer(stage, { antialias: false });
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const aspects = SLIDES.map(() => 1.5);
  const texs = SLIDES.map(([id], i) => texture(unsplash(id, IS_MOBILE ? 1300 : 2000), (t) => { aspects[i] = t.image.width / t.image.height; fit(); }));   // VELOCE: на телефоне кадр 1300 — машина резкая
  const uni = {
    tA: { value: texs[0] }, tB: { value: texs[1] }, uP: { value: 0 }, uTime: { value: 0 },
    uCoverA: { value: new THREE.Vector2(1, 1) }, uCoverB: { value: new THREE.Vector2(1, 1) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: uni, vertexShader: QUAD_VS,
    fragmentShader: /* glsl */`
      ${NOISE}
      uniform sampler2D tA, tB; uniform float uP, uTime; uniform vec2 uCoverA, uCoverB;
      varying vec2 vUv;
      void main(){
        float n = snoise(vec3(vUv * vec2(2.2, 3.0), uTime * 0.15)) * 0.5 + 0.5;
        float edge = uP * 1.5 - 0.25;
        float m = smoothstep(edge - 0.12, edge + 0.12, vUv.x * 0.72 + n * 0.28);        // 1 — ещё старое фото
        vec2 a = (vUv - 0.5) * uCoverA * (1.0 - 0.05 * uP) + 0.5 + vec2(0.06 * (1.0 - m) * uP, 0.0);
        vec2 b = (vUv - 0.5) * uCoverB * (1.0 + 0.08 * (1.0 - uP)) + 0.5 - vec2(0.05 * m * (1.0 - uP), 0.0);
        vec3 col = mix(texture2D(tB, b).rgb, texture2D(tA, a).rgb, m);
        float ink = smoothstep(0.0, 0.5, m) * smoothstep(1.0, 0.5, m);                    // светлая кромка чернил
        col += ink * vec3(1.0, 0.95, 0.9) * 0.35;
        float vig = smoothstep(1.2, 0.3, length(vUv - 0.5) * 1.5);
        gl_FragColor = vec4(col * mix(0.6, 1.0, vig), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));

  const ui = document.createElement('div');
  ui.className = 'ss-ui';
  const arrow = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="${d}"/></svg>`;
  ui.innerHTML = `<button type="button" data-d="-1" aria-label="Назад">${arrow('M15 5l-7 7 7 7')}</button>
    <span class="ss-count"><b>01</b> / ${String(SLIDES.length).padStart(2, '0')}</span><span class="ss-bar"><i></i></span>
    <button type="button" data-d="1" aria-label="Вперёд">${arrow('M9 5l7 7-7 7')}</button>`;
  const room = document.createElement('div');
  room.className = 'ss-room';
  room.textContent = SLIDES[0][1];
  stage.append(ui, room);
  const countEl = ui.querySelector('b'), barEl = ui.querySelector('.ss-bar i');

  let W = 1, H = 1, cur = 0, next = 1, p = 0, moving = false, wait = 0;
  function fit() {
    const a = W / H, cov = (ia) => (a > ia ? [1, ia / a] : [a / ia, 1]);
    uni.uCoverA.value.set(...cov(aspects[cur]));
    uni.uCoverB.value.set(...cov(aspects[next]));
  }
  const go = (d) => {
    if (moving) return;
    next = (cur + d + SLIDES.length) % SLIDES.length;
    uni.tB.value = texs[next];
    fit();
    moving = true; p = 0; wait = 0;
    room.classList.add('out');
  };
  ui.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) go(+b.dataset.d); });
  let sx = null;
  const onDown = (e) => { sx = e.clientX; };
  const onUp = (e) => { if (sx != null && Math.abs(e.clientX - sx) > 40) go(e.clientX < sx ? 1 : -1); sx = null; };
  stage.addEventListener('pointerdown', onDown);
  stage.addEventListener('pointerup', onUp);
  stage.style.touchAction = 'pan-y';

  const unwatch = watchSize(stage, (w, h) => { W = w; H = h; renderer.setSize(w, h, false); fit(); });
  const lp = loop((t, dt) => {
    uni.uTime.value = t;
    if (moving) {
      p = Math.min(1, p + dt / TRANS);
      uni.uP.value = p * p * (3 - 2 * p);
      if (p >= 1) {
        cur = next; moving = false;
        uni.tA.value = texs[cur]; uni.uP.value = 0;
        next = (cur + 1) % SLIDES.length; uni.tB.value = texs[next];
        fit();
        countEl.textContent = String(cur + 1).padStart(2, '0');
        room.textContent = SLIDES[cur][1];
        room.classList.remove('out');
      }
    } else if (!REDUCED) {
      wait += dt;
      if (wait >= HOLD) go(1);
    }
    barEl.style.width = (moving ? 100 : Math.min(100, wait / HOLD * 100)) + '%';
    renderer.render(scene, cam);
  });

  return {
    start: lp.start, stop: lp.stop,
    destroy() {
      lp.stop(); unwatch(); ui.remove(); room.remove();
      stage.removeEventListener('pointerdown', onDown); stage.removeEventListener('pointerup', onUp);
      texs.forEach((t) => t.dispose()); mat.dispose(); release(renderer);
    },
  };
}
