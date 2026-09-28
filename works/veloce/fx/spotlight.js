// «Прожектор» — зал в темноте, курсор светит фонарём: в луче проступают цвет и скрытая надпись.
// Без курсора луч сам медленно обходит сцену. Только CSS-маска и немного JS — нагрузка лёгкая.
import { loop, damp, pointer, css, unsplash } from './core.js';

const BEAM = 0.42;   // VELOCE: луч шире — машина читается целиком

export function mount(stage, opts = {}) {
  css('spotlight', `
    .sp{position:absolute;inset:0;overflow:hidden;background:#050506;--x:50%;--y:50%;--r:230px}
    .sp__img{position:absolute;inset:0;background-size:cover;background-position:center}
    .sp__dark{filter:grayscale(1) brightness(.14) contrast(1.1)}
    .sp__lit{filter:saturate(1.15) brightness(1.05);
      -webkit-mask-image:radial-gradient(circle var(--r) at var(--x) var(--y),#000 0%,#000 38%,rgba(0,0,0,.55) 62%,transparent 100%);
              mask-image:radial-gradient(circle var(--r) at var(--x) var(--y),#000 0%,#000 38%,rgba(0,0,0,.55) 62%,transparent 100%)}
    .sp__glow{position:absolute;inset:0;pointer-events:none;mix-blend-mode:screen;
      background:radial-gradient(circle calc(var(--r) * 1.1) at var(--x) var(--y),rgba(200,232,255,.2),transparent 70%)}
    .sp__secret{position:absolute;right:8%;top:30%;text-align:right;color:#fff;
      -webkit-mask-image:radial-gradient(circle var(--r) at var(--mx) var(--my),#000 30%,transparent 72%);
              mask-image:radial-gradient(circle var(--r) at var(--mx) var(--my),#000 30%,transparent 72%)}
    .sp__secret b{display:block;font:800 clamp(34px,5.5vw,76px)/.95 'Exo 2',system-ui,sans-serif;letter-spacing:-.035em;text-shadow:0 4px 30px rgba(0,0,0,.6)}
    .sp__secret span{display:inline-block;margin-top:12px;font:600 15px/1 'Exo 2',system-ui,sans-serif;padding:9px 14px;border-radius:999px;background:#9DE6FF;color:#0b0f14}
    .sp__dust{position:absolute;inset:0;pointer-events:none}
    @media (max-width:760px){.sp__secret{right:16px;left:16px;top:20%}}`);
  const photo = opts.photo || unsplash('photo-1599011176306-4a96f1516d4d', 1800);
  const wrap = document.createElement('div');
  wrap.className = 'sp';
  wrap.innerHTML = `
    <div class="sp__img sp__dark" style="background-image:url(${photo})"></div>
    <div class="sp__img sp__lit" style="background-image:url(${photo})"></div>
    <div class="sp__glow"></div>
    <canvas class="sp__dust"></canvas>
    <div class="sp__secret"><b>${opts.secret || 'Открыто<br>до 02:00'}</b><span>${opts.hint || 'Запись на вечер'}</span></div>`;
  stage.prepend(wrap);
  const cv = wrap.querySelector('.sp__dust'), g = cv.getContext('2d');
  const secret = wrap.querySelector('.sp__secret');

  // пылинки в луче: видны только рядом с центром света
  const dust = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), z: Math.random(), s: Math.random() * Math.PI * 2 }));
  const ptr = pointer(stage);
  let x = 0.35, y = 0.45, W = 1, H = 1, dpr = 1;
  const resize = () => {
    W = stage.clientWidth || 1; H = stage.clientHeight || 1; dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = W * dpr; cv.height = H * dpr;
    wrap.style.setProperty('--r', Math.round(Math.max(150, Math.min(W, H) * BEAM)) + 'px');
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(stage);

  const lp = loop((t, dt) => {
    const k = dt || 0.016;
    const tx = ptr.active ? ptr.u : 0.5 + Math.sin(t * 0.33) * 0.32, ty = ptr.active ? 1 - ptr.v : 0.45 + Math.sin(t * 0.51) * 0.2;
    x = damp(x, tx, 6, k); y = damp(y, ty, 6, k);
    wrap.style.setProperty('--x', (x * 100).toFixed(2) + '%');
    wrap.style.setProperty('--y', (y * 100).toFixed(2) + '%');
    // для надписи — координаты луча относительно неё самой
    const r = secret.getBoundingClientRect(), sr = stage.getBoundingClientRect();
    secret.style.setProperty('--mx', (x * sr.width - (r.left - sr.left)) + 'px');
    secret.style.setProperty('--my', (y * sr.height - (r.top - sr.top)) + 'px');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const R = Math.max(150, Math.min(W, H) * BEAM);
    for (const d of dust) {
      d.y -= k * (0.004 + d.z * 0.01); d.s += k;
      if (d.y < -0.05) d.y = 1.05;
      const px = (d.x + Math.sin(d.s * 0.7) * 0.01) * W, py = d.y * H;
      const near = 1 - Math.hypot(px - x * W, py - y * H) / R;
      if (near <= 0) continue;
      g.globalAlpha = near * (0.3 + d.z * 0.6);
      g.fillStyle = '#e6f6ff';   // VELOCE: пылинки в холодном свете
      g.beginPath(); g.arc(px, py, 0.6 + d.z * 1.6, 0, Math.PI * 2); g.fill();
    }
  });

  return {
    start: lp.start, stop: lp.stop,
    destroy() { lp.stop(); ro.disconnect(); wrap.remove(); },
  };
}
