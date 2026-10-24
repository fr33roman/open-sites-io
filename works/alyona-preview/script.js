/* ============ Alyona Design v2 — скрипт ============ */

/* боковая панель меню */
const panel = document.getElementById("sidePanel");
const overlay = document.getElementById("panelOverlay");
const openPanel = () => { panel.classList.add("open"); overlay.classList.add("open"); };
const closePanel = () => { panel.classList.remove("open"); overlay.classList.remove("open"); };
document.getElementById("menuOpen").addEventListener("click", openPanel);
document.getElementById("menuClose").addEventListener("click", closePanel);
overlay.addEventListener("click", closePanel);
panel.querySelectorAll("a").forEach((a) => a.addEventListener("click", closePanel));
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closePanel(); });

/* шапка: прозрачная на герое, сплошная после прокрутки */
const nav = document.getElementById("nav");
const onScroll = () => nav.classList.toggle("solid", window.scrollY > window.innerHeight - 120);
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

/* появление блоков */
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
}, { threshold: 0.12 });
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

/* тарифы: валюта цен ₽ / $ / ₾. Цены в карточках заданы Алёной в каждой валюте (data-rub/-usd/-gel),
   это не пересчёт по курсу. Выбор посетителя запоминается; пока он не выбрал — по языку сайта:
   русский → рубли, английский → доллары. i18n.js зовёт window.adOnLang при каждой смене языка. */
const CUR_KEY = "ad_cur";
function setCur(cur, save) {
  document.querySelectorAll("[data-rub]").forEach((el) => {
    const v = el.getAttribute("data-" + cur);
    if (v) el.textContent = v;
  });
  document.querySelectorAll(".cur-b").forEach((b) =>
    b.setAttribute("aria-pressed", b.getAttribute("data-cur") === cur ? "true" : "false")
  );
  if (save) { try { localStorage.setItem(CUR_KEY, cur); } catch (_) {} }
}
document.querySelectorAll(".cur-b").forEach((b) =>
  b.addEventListener("click", () => setCur(b.getAttribute("data-cur"), true))
);
/* тарифы в объёме: под курсором карточка поворачивается к человеку, по ней скользит блик.
   Только мышь на широком экране и только без «уменьшить движение» в системе */
if (matchMedia("(hover: hover) and (pointer: fine) and (min-width: 961px)").matches &&
    !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  document.querySelectorAll(".plan").forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      const u = (e.clientX - r.left) / r.width, v = (e.clientY - r.top) / r.height;
      card.style.setProperty("--ty", ((u - 0.5) * 8).toFixed(2) + "deg");
      card.style.setProperty("--tx", ((0.5 - v) * 6).toFixed(2) + "deg");
      card.style.setProperty("--gx", (u * 100).toFixed(1) + "%");
      card.style.setProperty("--gy", (v * 100).toFixed(1) + "%");
    });
    card.addEventListener("pointerleave", () => {
      card.style.removeProperty("--tx");
      card.style.removeProperty("--ty");
    });
  });
}

window.adOnLang = function (lang) {
  let saved = null;
  try { saved = localStorage.getItem(CUR_KEY); } catch (_) {}
  setCur(saved || (lang === "en" ? "usd" : "rub"), false);
  if (window.adOnLangExtra) window.adOnLangExtra();
};

/* ================= вторая волна 21.10: движение и объём ================= */
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const FINE = matchMedia("(hover: hover) and (pointer: fine)").matches;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const two = (n) => String(n).padStart(2, "0");

/* золотой штрих «от руки» вокруг выделенного слова заголовка (после смены языка — заново) */
function ring() {
  const hl = document.querySelector(".hl");
  if (!hl || hl.querySelector("svg")) return;
  hl.insertAdjacentHTML("beforeend",
    '<svg viewBox="0 0 200 80" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M24 52 C18 22 96 6 168 18 C204 25 200 58 150 68 C100 78 26 74 12 50 C4 34 40 14 92 12"/></svg>');
}

/* цитата: слова загораются по одному при прокрутке */
const quote = document.getElementById("quote");
function splitQuote() {
  if (!quote) return;
  const t = quote.textContent;
  quote.innerHTML = t.split(/(\s+)/).map((w) => (/^\s+$/.test(w) || !w ? w : '<span class="w">' + w.replace(/[&<>]/g, "") + "</span>")).join("");
}

window.adOnLangExtra = function () { ring(); splitQuote(); onPage(); };

/* «магнит»: кнопка тянется к курсору */
if (FINE && !REDUCED) {
  document.querySelectorAll(".mag").forEach((b) => {
    b.addEventListener("pointermove", (e) => {
      const r = b.getBoundingClientRect();
      b.style.setProperty("--bx", ((e.clientX - r.left - r.width / 2) * 0.22).toFixed(1) + "px");
      b.style.setProperty("--by", ((e.clientY - r.top - r.height / 2) * 0.3).toFixed(1) + "px");
    });
    b.addEventListener("pointerleave", () => { b.style.removeProperty("--bx"); b.style.removeProperty("--by"); });
  });
  /* фото Алёны поворачиваются к курсору */
  document.querySelectorAll(".philo-photo, .contact-photo").forEach((box) => {
    const img = box.querySelector("img");
    box.addEventListener("pointermove", (e) => {
      const r = box.getBoundingClientRect();
      const u = (e.clientX - r.left) / r.width - 0.5, v = (e.clientY - r.top) / r.height - 0.5;
      img.style.setProperty("--ty", (u * 12).toFixed(2) + "deg");
      img.style.setProperty("--tx", (-v * 10).toFixed(2) + "deg");
    });
    box.addEventListener("pointerleave", () => { img.style.removeProperty("--tx"); img.style.removeProperty("--ty"); });
  });
  /* пятно света за курсором на листах тарифов и контактов */
  document.querySelectorAll(".sheet").forEach((sh) => {
    sh.addEventListener("pointermove", (e) => {
      const r = sh.getBoundingClientRect();
      sh.style.setProperty("--mx", (e.clientX - r.left).toFixed(0) + "px");
      sh.style.setProperty("--my", (e.clientY - r.top).toFixed(0) + "px");
      sh.style.setProperty("--lo", "1");
    });
    sh.addEventListener("pointerleave", () => sh.style.setProperty("--lo", "0"));
  });
}

/* герой: веер отпечатков следует за мышью, каждый на своей глубине */
const hero = document.getElementById("hero");
const prints = [...document.querySelectorAll(".print")];
let hmx = 0, hmy = 0;
if (hero && FINE && !REDUCED) {
  hero.addEventListener("pointermove", (e) => {
    hmx = e.clientX / innerWidth - 0.5; hmy = e.clientY / innerHeight - 0.5;
    prints.forEach((p) => {
      const d = +p.dataset.d || 20;
      p.style.setProperty("--x", (hmx * d).toFixed(1) + "px");
      p.style.setProperty("--y", (hmy * d).toFixed(1) + "px");
    });
  });
}

/* ---------- проекты: пролёт сквозь фото ---------- */
const fly = document.getElementById("gallery");
const flyStage = document.getElementById("flyStage");
const flyWorld = document.getElementById("flyWorld");
const cards = flyWorld ? [...flyWorld.children] : [];
/* где висит каждый снимок: доля ширины / высоты экрана от центра и наклон; последний — по центру, им пролёт кончается */
const FX = [-0.25, 0.24, -0.2, 0.23, -0.26, 0.2, -0.19, 0.24, 0];
const FY = [-0.07, 0.09, 0.11, -0.1, 0.05, -0.12, 0.12, 0.03, -0.02];
const FR = [-4, 3, -2, 5, -3, 2, -5, 3, 0];
let flyP = 0, rx = 0, ry = 0, trx = 0, try_ = 0;
function flyFrame() {
  if (!fly || !cards.length) return;
  const r = fly.getBoundingClientRect();
  const p = clamp01(-r.top / Math.max(1, r.height - innerHeight));
  flyP = p;
  const W = innerWidth, H = innerHeight, narrow = W < 700;
  const D = narrow ? 560 : 680, N = cards.length;
  const cam = p * (N + 3) * D;
  const k = narrow ? 0.62 : 1;
  cards.forEach((c, i) => {
    const z = -(i + 4) * D + cam;
    const o = REDUCED ? (z > -3 * D && z < 400 ? 1 : 0) : sstep(-5.2 * D, -3 * D, z) * (1 - sstep(60, 380, z));
    c.style.opacity = o.toFixed(3);
    c.style.visibility = o < 0.01 ? "hidden" : "visible";
    c._o = o;
    if (o < 0.01) return;
    c.style.transform = `translate(-50%, -50%) translate3d(${(FX[i] * W * k).toFixed(1)}px, ${(FY[i] * H).toFixed(1)}px, ${z.toFixed(1)}px) rotate(${FR[i]}deg)`;
  });
  flyStage.style.setProperty("--to", (1 - sstep(0.0, 0.1, p)).toFixed(3));
  flyStage.style.setProperty("--ts", (1 + sstep(0, 0.1, p) * 0.25).toFixed(3));
  const eo = sstep(0.9, 0.985, p);
  flyStage.style.setProperty("--eo", eo.toFixed(3));
  fly.classList.toggle("end-on", eo > 0.5);
}
/* лёгкий наклон всего «мира» за мышью — объём */
if (flyStage && FINE && !REDUCED) {
  flyStage.addEventListener("pointermove", (e) => {
    const u = e.clientX / innerWidth - 0.5, v = e.clientY / innerHeight - 0.5;
    try_ = u * 7; trx = -v * 5;
    flyStage.style.setProperty("--gx", (50 + u * 60).toFixed(1) + "%");
    flyStage.style.setProperty("--gy", (45 + v * 60).toFixed(1) + "%");
    if (!tilting) { tilting = true; requestAnimationFrame(tiltStep); }
  });
  flyStage.addEventListener("pointerleave", () => { trx = 0; try_ = 0; if (!tilting) { tilting = true; requestAnimationFrame(tiltStep); } });
}
let tilting = false;
function tiltStep() {
  rx += (trx - rx) * 0.08; ry += (try_ - ry) * 0.08;
  flyWorld.style.setProperty("--rx", rx.toFixed(2) + "deg");
  flyWorld.style.setProperty("--ry", ry.toFixed(2) + "deg");
  if (Math.abs(trx - rx) + Math.abs(try_ - ry) > 0.02) requestAnimationFrame(tiltStep); else tilting = false;
}

/* подсказка «Открыть» у курсора над снимком */
const curDot = document.getElementById("curDot");
if (FINE && curDot) {
  addEventListener("pointermove", (e) => {
    curDot.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    const c = e.target.closest && e.target.closest(".fly__card");
    curDot.classList.toggle("on", !!(c && c._o > 0.4));
  }, { passive: true });
}

/* ---------- фото на весь экран ---------- */
const lb = document.getElementById("lb"), lbImg = document.getElementById("lbImg"), lbCount = document.getElementById("lbCount");
let list = [], li = 0, lastFocus = null;
function paint(swap) {
  const im = list[li];
  const set = () => { lbImg.src = im.currentSrc || im.src; lbImg.alt = im.alt; lbImg.classList.remove("swap"); };
  lbCount.textContent = two(li + 1) + " / " + two(list.length);
  if (swap && !REDUCED) { lbImg.classList.add("swap"); setTimeout(set, 220); } else set();
}
function openLb(imgs, i) {
  list = imgs; li = Math.max(0, i);
  lastFocus = document.activeElement;
  paint(false);
  lb.hidden = false; document.body.style.overflow = "hidden";
  void lb.offsetWidth; lb.classList.add("open");
  if (curDot) curDot.classList.remove("on");
  document.getElementById("lbClose").focus();
}
function closeLb() {
  lb.classList.remove("open"); document.body.style.overflow = "";
  setTimeout(() => (lb.hidden = true), 350);
  if (lastFocus) lastFocus.focus();
}
if (lb) {
  const lbGo = (d) => { li = (li + d + list.length) % list.length; paint(true); };
  cards.forEach((c, i) => c.addEventListener("click", () => { if (c._o > 0.4) openLb(cards.map((x) => x.querySelector("img")), i); }));
  document.getElementById("lbClose").addEventListener("click", closeLb);
  document.getElementById("lbPrev").addEventListener("click", () => lbGo(-1));
  document.getElementById("lbNext").addEventListener("click", () => lbGo(1));
  lb.addEventListener("click", (e) => { if (e.target === lb || e.target.classList.contains("lb-fig")) closeLb(); });
  document.addEventListener("keydown", (e) => {
    if (lb.hidden) return;
    if (e.key === "Escape") closeLb();
    if (e.key === "ArrowRight") lbGo(1);
    if (e.key === "ArrowLeft") lbGo(-1);
  });
  let tx = null;
  lb.addEventListener("touchstart", (e) => (tx = e.touches[0].clientX), { passive: true });
  lb.addEventListener("touchend", (e) => {
    if (tx === null) return;
    const dx = e.changedTouches[0].clientX - tx; tx = null;
    if (Math.abs(dx) > 40) lbGo(dx < 0 ? 1 : -1);
  }, { passive: true });
}

/* ---------- всё, что живёт от прокрутки ---------- */
const sLine = document.getElementById("scrollLine");
const testiImg = document.querySelector(".testi-bg img");
const philo = document.getElementById("philosophy");
const plan = document.querySelector(".philo-plan");
let sq = false;
function onPage() {
  sq = false;
  const H = innerHeight;
  const h = document.documentElement.scrollHeight - H;
  sLine.style.setProperty("--sp", (h > 0 ? scrollY / h : 0).toFixed(4));
  /* чертёж в «Философии» дорисовывается, пока блок проходит по экрану */
  if (plan) {
    const b = philo.getBoundingClientRect();
    const t = REDUCED ? 1 : clamp01((H - b.top) / (H + b.height * 0.6));
    plan.style.setProperty("--d", sstep(0.05, 0.75, t).toFixed(3));
    plan.style.setProperty("--d2", sstep(0.35, 0.95, t).toFixed(3));
  }
  /* веер в герое уходит вверх медленнее страницы */
  if (hero && !REDUCED && scrollY < H * 1.2) hero.querySelector(".hero-fan").style.translate = `0 ${(scrollY * -0.18).toFixed(1)}px`;
  if (testiImg && !REDUCED) {
    const b = testiImg.parentNode.getBoundingClientRect();
    if (b.bottom > 0 && b.top < H) {
      const t = (b.top + b.height / 2 - H / 2) / H;
      testiImg.style.setProperty("--ty", (t * -0.12 * b.height).toFixed(1) + "px");
    }
  }
  if (quote) {
    const b = quote.getBoundingClientRect();
    const t = REDUCED ? 1 : clamp01((H * 0.9 - b.top) / (H * 0.55));
    const ws = quote.querySelectorAll(".w"), n = ws.length;
    ws.forEach((w, i) => w.style.setProperty("--o", clamp01(t * (n + 3) / 3 - i / 3 * 1).toFixed(3)));
  }
  if (fly) {
    const b = fly.getBoundingClientRect();
    if (b.bottom > -100 && b.top < H + 100) flyFrame();
  }
}
addEventListener("scroll", () => { if (!sq) { sq = true; requestAnimationFrame(onPage); } }, { passive: true });
addEventListener("resize", onPage);
ring();
splitQuote();
onPage();
flyFrame();

/* ================= третья волна 22.10 ================= */

/* заголовки разделов: слова поднимаются из-под черты (после смены языка — заново) */
function splitHeads() {
  document.querySelectorAll("main h2").forEach((h) => {
    if (h.querySelector(".wm")) return;
    let i = 0;
    const wrap = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((w) => {
            if (!w) return;
            if (/^\s+$/.test(w)) { frag.appendChild(document.createTextNode(w)); return; }
            const m = document.createElement("span"); m.className = "wm";
            const s = document.createElement("span"); s.className = "wi"; s.style.setProperty("--i", i++); s.textContent = w;
            m.appendChild(s); frag.appendChild(m);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== "BR") {
          const m = document.createElement("span"); m.className = "wm";
          const s = document.createElement("span"); s.className = "wi"; s.style.setProperty("--i", i++);
          n.replaceWith(m); s.appendChild(n); m.appendChild(s);
        }
      });
    };
    wrap(h);
    if (!h.classList.contains("split")) { h.classList.add("split"); io.observe(h); }
  });
}

/* фото Алёны: после шторки снимаем обрезку, чтобы вернулась тень */
document.querySelectorAll(".philo-photo, .contact-photo").forEach((box) => {
  new MutationObserver(() => { if (box.classList.contains("in")) setTimeout(() => box.classList.add("shown"), 1700); })
    .observe(box, { attributes: true, attributeFilter: ["class"] });
});

/* подвал: буквы имени поднимаются по очереди */
const fMark = document.querySelector(".footer-mark");
if (fMark) io.observe(fMark);

/* цифры в плашках героя досчитываются */
if (!REDUCED) document.querySelectorAll("[data-count]").forEach((el) => {
  const n = +el.dataset.count, suf = el.dataset.suffix || "", t0 = performance.now() + 1300;
  el.textContent = "0" + suf;
  const step = (t) => { const k = clamp01((t - t0) / 1100); el.textContent = Math.round(n * (1 - Math.pow(1 - k, 3))) + suf; if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
});

/* ---------- ленты: бегут сами, от прокрутки — быстрее и в её сторону ---------- */
const rbTracks = [...document.querySelectorAll(".rb__track")];
function fillRibbons() {
  rbTracks.forEach((tr) => {
    const set = tr.querySelector(".rb__set");
    tr.querySelectorAll(".rb__clone").forEach((n) => n.remove());
    set.innerHTML = set.textContent.replace(/[&<>]/g, "").replace(/✦/g, "<i>✦</i>");
    const w = set.getBoundingClientRect().width || 1;
    for (let k = 0, n = Math.ceil((innerWidth * 1.25) / w) + 1; k < n; k++) {
      const c = set.cloneNode(true); c.classList.add("rb__clone"); c.removeAttribute("data-i18n"); tr.appendChild(c);
    }
    tr._w = w; tr._x = tr._x || 0;
  });
}
let rbOn = false, rbLastY = scrollY, rbDir = 1, rbBoost = 0;
function rbStep() {
  if (!rbOn) return;
  const dy = scrollY - rbLastY; rbLastY = scrollY;
  if (dy) rbDir = dy > 0 ? 1 : -1;
  rbBoost += (Math.min(14, Math.abs(dy) * 0.35) - rbBoost) * 0.12;
  rbTracks.forEach((tr) => {
    const d = +tr.dataset.dir || 1;
    tr._x = (tr._x + (0.55 + rbBoost) * d * rbDir) % tr._w;
    tr.style.transform = `translate3d(${(tr._x > 0 ? tr._x - tr._w : tr._x).toFixed(2)}px,0,0)`;
  });
  requestAnimationFrame(rbStep);
}
const ribbons = document.querySelector(".ribbons");
if (ribbons && !REDUCED) {
  new IntersectionObserver((es) => es.forEach((e) => {
    const was = rbOn; rbOn = e.isIntersecting; rbLastY = scrollY;
    if (rbOn && !was) requestAnimationFrame(rbStep);
  })).observe(ribbons);
}

/* ---------- палитра проекта: цвета каждого снимка считаются в браузере из самого фото ---------- */
const hex = (r, g, b) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
function paletteOf(img) {
  const S = 48, c = document.createElement("canvas"); c.width = S; c.height = S;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.drawImage(img, 0, 0, S, S);
  const d = x.getImageData(0, 0, S, S).data, box = new Map();
  for (let i = 0; i < d.length; i += 4) {
    const k = (d[i] >> 4) * 256 + (d[i + 1] >> 4) * 16 + (d[i + 2] >> 4);
    const b = box.get(k) || [0, 0, 0, 0];
    b[0] += d[i]; b[1] += d[i + 1]; b[2] += d[i + 2]; b[3]++; box.set(k, b);
  }
  const all = [...box.values()].map((b) => [b[0] / b[3], b[1] / b[3], b[2] / b[3], b[3]]).sort((a, b) => b[3] - a[3]);
  const dist = (a, b) => Math.hypot(a[0] - b[0], (a[1] - b[1]) * 1.2, a[2] - b[2]);
  let pick = [];
  for (const lim of [56, 40, 26, 12]) {
    pick = [];
    for (const c2 of all) { if (pick.every((p) => dist(p, c2) > lim)) pick.push(c2); if (pick.length === 5) break; }
    if (pick.length === 5) break;
  }
  const lum = (c2) => 0.2126 * c2[0] + 0.7152 * c2[1] + 0.0722 * c2[2];
  const sat = (c2) => Math.max(c2[0], c2[1], c2[2]) - Math.min(c2[0], c2[1], c2[2]);
  /* свет сцены: самый «цветной» из средних по яркости, приглушённый к ночному фону */
  const mid = pick.filter((c2) => lum(c2) > 45 && lum(c2) < 205);
  const a = (mid.length ? mid : pick).slice().sort((p, q) => sat(q) - sat(p))[0];
  return { chips: pick.sort((p, q) => lum(q) - lum(p)).map((c2) => hex(c2[0], c2[1], c2[2])),
    amb: hex(a[0] * 0.62 + 31 * 0.38, a[1] * 0.62 + 26 * 0.38, a[2] * 0.62 + 20 * 0.38) };
}
const flyPal = document.getElementById("flyPal");
const chipEls = flyPal ? [...flyPal.querySelectorAll("i")] : [];
let palIdx = -1;
function palFor(card) {
  if (card._pal !== undefined) return card._pal;
  const img = card.querySelector("img");
  if (!img.complete || !img.naturalWidth) {
    if (!card._wait) { card._wait = true; img.addEventListener("load", () => { palIdx = -1; flyFrame(); }, { once: true }); }
    return null;
  }
  try { card._pal = paletteOf(img); } catch (_) { card._pal = null; }
  return card._pal;
}
function showPalette(i) {
  if (i === palIdx || !flyPal) return;
  const pal = palFor(cards[i]);
  if (!pal) return;
  palIdx = i;
  chipEls.forEach((el, k) => {
    const c = pal.chips[k] || pal.chips[pal.chips.length - 1];
    el.querySelector("b").style.backgroundColor = c;
    el.querySelector("s").textContent = c;
  });
  flyStage.style.setProperty("--amb", pal.amb);
  if (!REDUCED) { flyPal.classList.add("flip"); setTimeout(() => flyPal.classList.remove("flip"), 260); }
}
/* какой снимок сейчас ближе всех к зрителю — тот и задаёт свет и палитру */
const _flyFrame = flyFrame;
flyFrame = function () {
  _flyFrame();
  if (!cards.length) return;
  /* снимки летят к зрителю по порядку: ближний — первый из тех, что ещё хорошо видны */
  const best = cards.findIndex((c) => (c._o || 0) > 0.5);
  if (best >= 0) showPalette(best);
  const po = sstep(0.05, 0.12, flyP) * (1 - sstep(0.86, 0.93, flyP));
  flyStage.style.setProperty("--po", po.toFixed(3));
};

/* ---------- тарифы на телефоне — лента, «Базовый» по центру; соседние чуть меньше и тусклее ---------- */
const plansEl = document.querySelector(".plans");
const phone = matchMedia("(max-width: 600px)");
function plansCenter() {
  if (!plansEl || !phone.matches) return;
  const main = plansEl.querySelector(".plan--main");
  plansEl.scrollLeft = main.offsetLeft - (plansEl.clientWidth - main.offsetWidth) / 2;
  plansFlow();
}
function plansFlow() {
  if (!plansEl || !phone.matches) return;
  const mid = plansEl.scrollLeft + plansEl.clientWidth / 2;
  plansEl.querySelectorAll(".plan").forEach((p) => {
    const d = Math.min(1, Math.abs(p.offsetLeft + p.offsetWidth / 2 - mid) / p.offsetWidth);
    p.style.setProperty("--cs", (1 - d * 0.07).toFixed(3));
    p.style.setProperty("--co", (1 - d * 0.35).toFixed(3));
  });
}
if (plansEl) {
  plansEl.addEventListener("scroll", () => requestAnimationFrame(plansFlow), { passive: true });
  phone.addEventListener("change", plansCenter);
  plansCenter();
}

/* ---------- всё, что живёт от прокрутки: герой уходит, листы вырастают, шапка темнеет ---------- */
const heroFrame = document.querySelector(".hero-frame"), heroContent = document.querySelector(".hero-content");
const growEls = [...document.querySelectorAll(".sheet, .testi-frame")];
const darkEls = [...document.querySelectorAll("[data-nav='dark']")];
const _onPage = onPage;
onPage = function () {
  _onPage();
  const H = innerHeight;
  if (!REDUCED) {
    if (heroFrame && scrollY < H * 1.3) {
      const p = clamp01(scrollY / H);
      heroFrame.style.setProperty("--hs", (1 - p * 0.08).toFixed(4));
      heroContent.style.setProperty("--hy", (-p * H * 0.22).toFixed(1) + "px");
      heroContent.style.setProperty("--ho", (1 - sstep(0.15, 0.7, p)).toFixed(3));
    }
    growEls.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top > H * 1.2 || r.bottom < -H) return;
      el.style.setProperty("--g", (0.93 + 0.07 * sstep(0, 1, (H - r.top) / (H * 0.75))).toFixed(4));
    });
  }
  const y = 44;
  nav.classList.toggle("dark", darkEls.some((el) => { const r = el.getBoundingClientRect(); return r.top <= y && r.bottom >= y; }));
};

const _extra = window.adOnLangExtra;
window.adOnLangExtra = function () { _extra(); splitHeads(); fillRibbons(); palIdx = -1; flyFrame(); };
splitHeads();
fillRibbons();
addEventListener("resize", () => { fillRibbons(); plansCenter(); });
if (document.fonts) document.fonts.ready.then(fillRibbons);
onPage();
flyFrame();
