/* ============ open-sites.io — общий скрипт ============ */

/* --- НАСТРОЙКА ОТПРАВКИ ЗАЯВОК ---
   Вариант 1 (рекомендуется): создать бота через @BotFather, вписать токен и chat_id.
   Вариант 2: оставить пустым — форма покажет готовый текст брифа с кнопкой
   «скопировать» и ссылкой на ваш Telegram. */
const CONFIG = {
  TG_BOT_TOKEN: "",            // токен бота от @BotFather, например "123456:ABC-DEF..."
  TG_CHAT_ID: "",              // ваш chat_id (узнать у @userinfobot)
  TG_USERNAME: "open_sites",   // ваш ник в Telegram без @ — для кнопки «написать напрямую»
  WA_PHONE: "",                // номер WhatsApp в формате 79000000000 (без + и пробелов); пусто = кнопка скрыта
  IG_USERNAME: "",             // ник в Instagram без @; пусто = ссылка не показывается
};

/* ---------- навигация ---------- */
const nav = document.getElementById("nav");
if (nav) {
  const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 30);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}
const burger = document.getElementById("burger");
const navLinks = document.getElementById("navLinks");
if (burger && navLinks) {
  burger.addEventListener("click", () => navLinks.classList.toggle("open"));
  navLinks.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => navLinks.classList.remove("open"))
  );
}


/* ---------- появление блоков при скролле ---------- */
const io = new IntersectionObserver(
  (entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  }),
  { threshold: 0.12 }
);
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

/* ---------- счётчики цифр ---------- */
const counters = document.querySelectorAll(".count");
const cio = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    cio.unobserve(e.target);
    const to = parseInt(e.target.dataset.to, 10);
    const start = performance.now();
    const dur = 1200;
    const tick = (now) => {
      const p = Math.min((now - start) / dur, 1);
      e.target.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}, { threshold: 0.6 });
counters.forEach((el) => cio.observe(el));

/* ---------- карусель кейсов ---------- */
const track = document.getElementById("carTrack");
if (track) {
  const slides = track.children.length;
  const dotsBox = document.getElementById("carDots");
  let idx = 0;
  let auto;

  for (let i = 0; i < slides; i++) {
    const d = document.createElement("button");
    d.className = "car-dot";
    d.setAttribute("aria-label", "Кейс " + (i + 1));
    d.addEventListener("click", () => go(i, true));
    dotsBox.appendChild(d);
  }
  const dots = dotsBox.children;

  function go(i, manual) {
    idx = (i + slides) % slides;
    track.style.transform = `translateX(-${idx * 100}%)`;
    [...dots].forEach((d, n) => d.classList.toggle("on", n === idx));
    if (manual) restartAuto();
  }
  function restartAuto() {
    clearInterval(auto);
    auto = setInterval(() => go(idx + 1), 4000);
  }
  document.getElementById("carPrev").addEventListener("click", () => go(idx - 1, true));
  document.getElementById("carNext").addEventListener("click", () => go(idx + 1, true));

  /* свайп на телефоне */
  let x0 = null;
  track.addEventListener("touchstart", (e) => (x0 = e.touches[0].clientX), { passive: true });
  track.addEventListener("touchend", (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 40) go(idx + (dx < 0 ? 1 : -1), true);
    x0 = null;
  }, { passive: true });

  go(0);
  restartAuto();
}

/* ---------- витрина услуг (coverflow, авто-вращение без ручного листания) ---------- */
const svcStage = document.getElementById("svcStage");
if (svcStage) {
  const cards = [...svcStage.children];
  const n = cards.length;
  let active = 0;
  let autoS;

  function layout() {
    const w = svcStage.clientWidth;
    const mobile = w < 640;
    const near = Math.min(255, w * 0.34);
    const far = near * 1.7;
    cards.forEach((c, i) => {
      let rel = i - active;
      if (rel > n / 2) rel -= n;
      if (rel < -n / 2) rel += n;
      const a = Math.abs(rel);
      let x = 0, scale = 1, ry = 0, z = 10, op = 1, blur = 0;
      if (mobile) {
        /* на телефоне показываем одну карточку — боковые уводим за экран, чтобы не накладывались */
        if (rel !== 0) { x = Math.sign(rel) * w * 0.9; scale = 0.9; op = 0; z = 1; }
      } else if (a === 1) {
        x = rel * near; scale = 0.84; ry = rel * -26; z = 6; op = 0.78;
      } else if (a >= 2) {
        x = Math.sign(rel) * far; scale = 0.66; ry = Math.sign(rel) * -32; z = 3; op = 0.32; blur = 2;
      }
      c.style.transform = `translate(-50%, -50%) translateX(${x}px) scale(${scale}) rotateY(${ry}deg)`;
      c.style.zIndex = z;
      c.style.opacity = op;
      c.style.filter = blur ? `blur(${blur}px)` : "none";
      c.classList.toggle("is-center", rel === 0);
    });
  }

  window.addEventListener("resize", layout);
  layout();
  autoS = setInterval(() => { active = (active + 1) % n; layout(); }, 3200);
}

/* ---------- таймер скидки (вечнозелёный: 24 часа на посетителя) ---------- */
const timerEl = document.getElementById("timer");
if (timerEl) {
  const KEY = "os_deadline";
  let deadline = parseInt(localStorage.getItem(KEY) || "0", 10);
  if (!deadline || deadline < Date.now()) {
    deadline = Date.now() + 24 * 3600 * 1000;
    localStorage.setItem(KEY, String(deadline));
  }
  const pad = (n) => String(n).padStart(2, "0");
  const tH = document.getElementById("tH");
  const tM = document.getElementById("tM");
  const tS = document.getElementById("tS");
  setInterval(() => {
    let left = Math.max(0, deadline - Date.now());
    if (left === 0) {
      deadline = Date.now() + 24 * 3600 * 1000;
      localStorage.setItem(KEY, String(deadline));
      left = deadline - Date.now();
    }
    tH.textContent = pad(Math.floor(left / 3600000));
    tM.textContent = pad(Math.floor(left / 60000) % 60);
    tS.textContent = pad(Math.floor(left / 1000) % 60);
  }, 1000);
}

/* ---------- плавающая кнопка заявки ---------- */
const floatCta = document.getElementById("floatCta");
if (floatCta) {
  window.addEventListener("scroll", () => {
    floatCta.classList.toggle("show", window.scrollY > window.innerHeight * 0.8);
  }, { passive: true });
}

/* ============ БРИФ (brief.html) ============ */
const briefForm = document.getElementById("briefForm");
if (briefForm) {
  const steps = [...briefForm.querySelectorAll(".fstep")];
  const bar = document.getElementById("progressBar");
  const stepLabel = document.getElementById("stepLabel");
  const btnPrev = document.getElementById("btnPrev");
  const btnNext = document.getElementById("btnNext");
  const errBox = document.getElementById("fError");
  const STORE = "os_brief_data";
  let cur = 0;

  /* восстанавливаем черновик ДО построения кастомных списков,
     чтобы их подписи сразу показали сохранённые значения */
  const saved = restoreState();

  function show(i, doScroll) {
    cur = i;
    steps.forEach((s, n) => s.classList.toggle("on", n === i));
    bar.style.width = ((i + 1) / steps.length) * 100 + "%";
    stepLabel.textContent = `Шаг ${i + 1} из ${steps.length}`;
    btnPrev.style.visibility = i === 0 ? "hidden" : "visible";
    btnNext.textContent = i === steps.length - 1 ? "Отправить заявку ✦" : "Дальше →";
    errBox.classList.remove("show");
    /* прокручиваем только при переходе между шагами, не при первой загрузке —
       иначе заголовок «Бриф за 7 минут» уезжает за верх экрана */
    if (doScroll) briefForm.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function validate(i) {
    const s = steps[i];
    /* радиокнопки и чекбоксы, помеченные data-need-one */
    for (const g of s.querySelectorAll("[data-need-one]")) {
      if (!g.querySelector("input:checked")) {
        return g.dataset.needOne;
      }
    }
    for (const inp of s.querySelectorAll("input[required], textarea[required], select[required]")) {
      if (!inp.value.trim()) {
        inp.focus();
        return inp.dataset.err || "Заполните обязательное поле.";
      }
    }
    return null;
  }

  btnPrev.addEventListener("click", () => show(cur - 1, true));
  btnNext.addEventListener("click", () => {
    const err = validate(cur);
    if (err) { errBox.textContent = err; errBox.classList.add("show"); return; }
    if (cur < steps.length - 1) show(cur + 1, true);
    else submitBrief();
  });

  /* ---------- кастомные выпадающие списки ---------- */
  briefForm.querySelectorAll("select").forEach((sel) => {
    sel.classList.add("enhanced");
    const wrap = document.createElement("div");
    wrap.className = "cselect";
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "cselect-trigger";
    const label = document.createElement("span");
    const arrow = document.createElement("span");
    arrow.className = "arrow";
    arrow.textContent = "▼";
    trigger.append(label, arrow);
    const panel = document.createElement("div");
    panel.className = "cselect-panel";

    [...sel.options].forEach((o) => {
      const item = document.createElement("div");
      item.className = "cselect-opt";
      item.textContent = o.textContent;
      if (o.selected) item.classList.add("sel");
      item.addEventListener("click", () => {
        sel.value = o.value;
        label.textContent = o.textContent;
        panel.querySelectorAll(".cselect-opt").forEach((x) => x.classList.remove("sel"));
        item.classList.add("sel");
        wrap.classList.remove("open");
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      });
      panel.appendChild(item);
    });
    label.textContent = sel.options[sel.selectedIndex].textContent;

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const wasOpen = wrap.classList.contains("open");
      document.querySelectorAll(".cselect.open").forEach((c) => c.classList.remove("open"));
      if (!wasOpen) wrap.classList.add("open");
    });

    wrap.append(trigger, panel);
    sel.parentNode.insertBefore(wrap, sel.nextSibling);
  });
  document.addEventListener("click", () => {
    document.querySelectorAll(".cselect.open").forEach((c) => c.classList.remove("open"));
  });

  function collect() {
    const data = new FormData(briefForm);
    const lines = ["📩 НОВАЯ ЗАЯВКА — open-sites.io", ""];
    const fields = [
      ["site_type", "Тип сайта"], ["niche", "Ниша / бизнес"], ["has_site", "Текущий сайт"],
      ["blocks", "Блоки"], ["texts", "Тексты"], ["photos", "Фото"],
      ["style", "Стиль"], ["mood", "Настроение"], ["refs", "Референсы"],
      ["integrations", "Интеграции"], ["domain", "Домен"], ["budget", "Бюджет"],
      ["deadline", "Сроки"], ["name", "Имя"], ["contact", "Контакт"],
      ["channel", "Способ связи"], ["comment", "Комментарий"],
    ];
    for (const [key, label] of fields) {
      const vals = data.getAll(key).filter(Boolean);
      if (vals.length) lines.push(`▪️ ${label}: ${vals.join(", ")}`);
    }
    return lines.join("\n");
  }

  async function submitBrief() {
    const text = collect();
    btnNext.disabled = true;
    btnNext.textContent = "Отправляем…";
    let sent = false;

    if (CONFIG.TG_BOT_TOKEN && CONFIG.TG_CHAT_ID) {
      try {
        const r = await fetch(`https://api.telegram.org/bot${CONFIG.TG_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: CONFIG.TG_CHAT_ID, text }),
        });
        sent = r.ok;
      } catch (_) { sent = false; }
    }

    /* заявка ушла — очищаем сохранённый черновик */
    localStorage.removeItem(STORE);

    document.getElementById("briefCard").style.display = "none";
    document.getElementById("briefDone").classList.add("show");

    document.getElementById("doneTitle").textContent = "Бриф отправлен!";
    document.getElementById("doneText").textContent = sent
      ? "Мы уже получили вашу заявку и ответим в течение пары часов. Скидка −20% закреплена за вами."
      : "Заявка зафиксирована, скидка −20% закреплена за вами. Чтобы мы ответили быстрее, продублируйте бриф напрямую — кнопки ниже.";

    /* ссылки на прямые каналы связи */
    const tg = document.getElementById("dcTg");
    tg.href = `https://t.me/${CONFIG.TG_USERNAME}`;
    const wa = document.getElementById("dcWa");
    if (CONFIG.WA_PHONE) {
      wa.href = `https://wa.me/${CONFIG.WA_PHONE}`;
    } else {
      wa.style.display = "none";
    }
    document.getElementById("dcCopy").addEventListener("click", async (e) => {
      try {
        await navigator.clipboard.writeText(text);
        e.target.textContent = "Скопировано ✓";
      } catch (_) {
        e.target.textContent = "Не удалось — скопируйте вручную";
      }
    });
    /* если заявка ушла автоматически, прямые контакты — лишь по желанию */
    document.getElementById("doneHint").textContent = sent
      ? "Хотите ускорить? Можно написать нам и напрямую:"
      : "Продублируйте бриф нам — так мы точно его получим:";
  }

  /* ---------- автосохранение черновика формы ---------- */
  function saveState() {
    const data = {};
    briefForm.querySelectorAll("input, textarea, select").forEach((el) => {
      if (!el.name) return;
      if (el.type === "checkbox" || el.type === "radio") {
        if (el.checked) (data[el.name] = data[el.name] || []).push(el.value);
      } else {
        data[el.name] = el.value;
      }
    });
    data.__step = cur;
    try { localStorage.setItem(STORE, JSON.stringify(data)); } catch (_) {}
  }
  function restoreState() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(STORE) || "null"); } catch (_) {}
    if (!data) return null;
    briefForm.querySelectorAll("input, textarea, select").forEach((el) => {
      if (!el.name || !(el.name in data)) return;
      const v = data[el.name];
      if (el.type === "checkbox" || el.type === "radio") {
        el.checked = Array.isArray(v) && v.includes(el.value);
      } else {
        el.value = v;
      }
    });
    return data;
  }

  briefForm.addEventListener("input", saveState);
  briefForm.addEventListener("change", saveState);

  show(saved && Number.isInteger(saved.__step) ? saved.__step : 0, false);
}
