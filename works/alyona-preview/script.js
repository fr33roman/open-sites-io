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
  pfTabs();
};

/* ---------- проекты: лента фото на каждый проект ----------
   Вкладки «Проект 01 / 02 / 03», крупный номер, ленту листают мышью (тянуть), пальцем и стрелками.
   В конце ленты стрелка «дальше» открывает следующий проект. Нажатие на фото — фото на весь экран. */
const pf = document.getElementById("pf");
const lang2 = () => ((document.documentElement.lang || "ru").slice(0, 2) === "en" ? "en" : "ru");
let pfTabs = () => {};
if (pf) {
  const rails = [...pf.querySelectorAll(".pf-rail")];
  const tabsBox = document.getElementById("pfTabs");
  const num = document.getElementById("pfNum");
  const prog = document.getElementById("pfProg");
  const cursor = document.getElementById("pfCursor");
  const two = (n) => String(n).padStart(2, "0");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let cur = -1;
  document.getElementById("pfOf").textContent = "/ " + two(rails.length);
  rails.forEach((r) => [...r.children].forEach((it, i) => it.style.setProperty("--i", i)));

  pfTabs = () => {
    const en = lang2() === "en";
    tabsBox.innerHTML = "";
    rails.forEach((r, k) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "pf-tab"; b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", k === cur ? "true" : "false");
      const n = r.children.length;
      b.innerHTML = (en ? "Project " : "Проект ") + two(k + 1) + "<small>" + n + (en ? " photos" : " фото") + "</small>";
      b.addEventListener("click", () => show(k));
      tabsBox.appendChild(b);
    });
  };

  const padL = (r) => parseFloat(getComputedStyle(r).paddingLeft) || 0;
  const maxS = (r) => r.scrollWidth - r.clientWidth;

  function frame() {
    const r = rails[cur];
    if (!r) return;
    const m = maxS(r);
    const vis = r.clientWidth / r.scrollWidth;
    prog.parentNode.style.setProperty("--p", (vis + (1 - vis) * (m > 0 ? r.scrollLeft / m : 1)).toFixed(4));
    if (reduce) return;
    const W = innerWidth;
    for (const it of r.children) {
      const b = it.getBoundingClientRect();
      if (b.right < -50 || b.left > W + 50) continue;
      const d = (b.left + b.width / 2 - W / 2) / W;            // −0.5 … 0.5 от середины экрана
      it.firstElementChild.style.setProperty("--px", (Math.max(-1, Math.min(1, d)) * -5).toFixed(2) + "%");
    }
  }
  let fq = false;
  const queue = () => { if (!fq) { fq = true; requestAnimationFrame(() => { fq = false; frame(); }); } };
  rails.forEach((r) => r.addEventListener("scroll", queue, { passive: true }));
  addEventListener("resize", queue);

  function show(k) {
    k = (k + rails.length) % rails.length;
    if (k === cur) return;
    const old = rails[cur];
    if (old) {
      old.classList.remove("on", "play");
      if (!reduce) { old.classList.add("out"); setTimeout(() => old.classList.remove("out"), 460); }
    }
    cur = k;
    const r = rails[k];
    r.scrollLeft = 0;
    r.classList.add("on");
    if (old && !reduce) {
      r.classList.add("play");
      clearTimeout(r._t); r._t = setTimeout(() => r.classList.remove("play"), 1300 + r.children.length * 90);
      num.classList.remove("flip"); void num.offsetWidth; num.classList.add("flip");
    }
    num.textContent = two(k + 1);
    [...tabsBox.children].forEach((b, n) => b.setAttribute("aria-selected", n === k ? "true" : "false"));
    frame();
  }

  function step(dir) {
    const r = rails[cur], pl = padL(r), items = [...r.children], x = r.scrollLeft;
    if (dir > 0) {
      if (x >= maxS(r) - 4) return show(cur + 1);
      const t = items.find((it) => it.offsetLeft - pl > x + 5);
      r.scrollTo({ left: t ? t.offsetLeft - pl : maxS(r), behavior: "smooth" });
    } else {
      if (x <= 4) return show(cur - 1);
      const t = items.filter((it) => it.offsetLeft - pl < x - 5).pop();
      r.scrollTo({ left: t ? t.offsetLeft - pl : 0, behavior: "smooth" });
    }
  }
  document.getElementById("pfPrev").addEventListener("click", () => step(-1));
  document.getElementById("pfNext").addEventListener("click", () => step(1));

  /* мышью: тянуть ленту; круглая подсказка у курсора */
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  let drag = null;
  rails.forEach((r) => {
    r.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      drag = { r, x0: e.clientX, s0: r.scrollLeft, moved: false };
    });
    r.addEventListener("click", (e) => {
      if (r._dragged) { r._dragged = false; return; }
      const it = e.target.closest(".pf-item");
      if (it) openLb(r, [...r.children].indexOf(it));
    });
    if (fine) {
      r.addEventListener("pointerenter", () => cursor.classList.add("on"));
      r.addEventListener("pointerleave", () => cursor.classList.remove("on"));
    }
  });
  addEventListener("pointermove", (e) => {
    if (fine) cursor.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    if (!drag) return;
    const dx = e.clientX - drag.x0;
    if (!drag.moved && Math.abs(dx) > 5) { drag.moved = true; drag.r.classList.add("drag"); cursor.classList.add("drag"); }
    if (drag.moved) drag.r.scrollLeft = drag.s0 - dx;
  });
  addEventListener("pointerup", () => {
    if (!drag) return;
    const { r, moved } = drag;
    drag = null;
    cursor.classList.remove("drag");
    if (!moved) return;
    r._dragged = true;
    setTimeout(() => (r._dragged = false), 50);
    /* докатить до ближайшего кадра */
    const pl = padL(r), x = r.scrollLeft;
    let best = 0, bd = Infinity;
    for (const it of r.children) { const d = Math.abs(it.offsetLeft - pl - x); if (d < bd) { bd = d; best = it.offsetLeft - pl; } }
    if (x >= maxS(r) - 30) best = maxS(r);
    r.classList.remove("drag");
    r.scrollTo({ left: best, behavior: "smooth" });
  });

  pfTabs();
  show(0);

  /* ---------- фото на весь экран ---------- */
  const lb = document.getElementById("lb"), lbImg = document.getElementById("lbImg"), lbCount = document.getElementById("lbCount");
  let list = [], li = 0, lastFocus = null;
  function paint(swap) {
    const im = list[li];
    const set = () => { lbImg.src = im.currentSrc || im.src; lbImg.alt = im.alt; lbImg.classList.remove("swap"); };
    lbCount.textContent = two(li + 1) + " / " + two(list.length);
    if (swap && !reduce) { lbImg.classList.add("swap"); setTimeout(set, 220); } else set();
  }
  function openLb(r, i) {
    list = [...r.querySelectorAll("img")]; li = Math.max(0, i);
    lastFocus = document.activeElement;
    paint(false);
    lb.hidden = false; document.body.style.overflow = "hidden";
    cursor.classList.remove("on");
    void lb.offsetWidth; lb.classList.add("open");
    document.getElementById("lbClose").focus();
  }
  function closeLb() {
    lb.classList.remove("open"); document.body.style.overflow = "";
    setTimeout(() => (lb.hidden = true), 350);
    if (lastFocus) lastFocus.focus();
  }
  const lbGo = (d) => { li = (li + d + list.length) % list.length; paint(true); };
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

/* золотая полоса прокрутки сверху и медленный фон у цитаты */
const sLine = document.getElementById("scrollLine");
const testiImg = document.querySelector(".testi-bg img");
const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
let sq = false;
function onPage() {
  sq = false;
  const h = document.documentElement.scrollHeight - innerHeight;
  sLine.style.setProperty("--sp", (h > 0 ? scrollY / h : 0).toFixed(4));
  if (testiImg && !still) {
    const b = testiImg.parentNode.getBoundingClientRect();
    if (b.bottom > 0 && b.top < innerHeight) {
      const t = (b.top + b.height / 2 - innerHeight / 2) / innerHeight;  // −1 … 1
      testiImg.style.setProperty("--ty", (t * -0.1 * b.height).toFixed(1) + "px");
    }
  }
}
addEventListener("scroll", () => { if (!sq) { sq = true; requestAnimationFrame(onPage); } }, { passive: true });
addEventListener("resize", onPage);
onPage();
