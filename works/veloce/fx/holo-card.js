// «Голографическая карта» — подарочный сертификат с радужной фольгой и бликом (CSS 3D, без WebGL).
// Наклон — за курсором, на телефоне — за наклоном руки; без касания карта сама медленно покачивается.
import { loop, damp, pointer } from './core.js';

export function mount(stage, opts = {}) {
  // VELOCE: карта уже свёрстана в странице (видна и без скрипта) — берём её, иначе строим свою
  const own = stage.querySelector('.holo');
  const wrap = own || document.createElement('div');
  wrap.className = 'holo';
  if (!own) wrap.innerHTML = `
    <div class="holo__card">
      <div class="holo__base"></div>
      <div class="holo__foil"></div>
      <div class="holo__content">
        <div class="holo__top"><span class="holo__mark"></span><span>${opts.brand || 'СТАЛЬ · барбершоп'}</span></div>
        <div class="holo__kind">Подарочный сертификат</div>
        <div class="holo__value">${opts.value || '100 ₾'}</div>
        <div class="holo__bottom"><span>${opts.what || 'стрижка и борода'}</span><span>№ 0427</span></div>
      </div>
      <div class="holo__glare"></div>
    </div>`;
  if (!own) stage.appendChild(wrap);
  stage.classList.add('no-shade');
  const card = wrap.querySelector('.holo__card');
  const ptr = pointer(stage);

  // наклон телефона (Android отдаёт без разрешения; на iPhone остаётся самопокачивание)
  let tiltX = null, tiltY = null;
  const onTilt = (e) => { if (e.beta == null) return; tiltX = Math.max(-1, Math.min(1, (e.beta - 40) / 30)); tiltY = Math.max(-1, Math.min(1, e.gamma / 30)); };
  window.addEventListener('deviceorientation', onTilt);

  let rx = 0, ry = 0, mx = 50, my = 50;
  const lp = loop((t, dt) => {
    const k = dt || 0.016;
    let x, y;
    if (ptr.active) { x = ptr.x; y = ptr.y; }
    else if (tiltX != null) { x = tiltY; y = -tiltX; }
    else { x = Math.sin(t * 0.6) * 0.55; y = Math.sin(t * 0.9) * 0.35; }
    rx = damp(rx, y * 14, 5, k);
    ry = damp(ry, x * 18, 5, k);
    mx = damp(mx, 50 + x * 42, 5, k);
    my = damp(my, 50 - y * 42, 5, k);
    card.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
    card.style.setProperty('--mx', mx.toFixed(1) + '%');
    card.style.setProperty('--my', my.toFixed(1) + '%');
    card.style.setProperty('--pos', (50 + x * 50).toFixed(1) + '%');
  });

  return {
    start: lp.start, stop: lp.stop,
    destroy() { lp.stop(); window.removeEventListener('deviceorientation', onTilt); if (!own) wrap.remove(); },
  };
}
