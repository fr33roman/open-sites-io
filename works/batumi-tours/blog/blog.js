/* Страницы статей: меню и комментарии.
   Комментарии. Пока сервера нет, они хранятся в браузере посетителя (localStorage) — видны только ему.
   Сервер — файл _server/comments.php на хостинге компании (решение Романа 08.10.2026: хранить у них, не у нас).
   Его адрес ставит сборка блога в <html data-comments="…"> (COMMENTS_API в _blog/make_blog.py): тогда список
   и отправка идут туда (GET ?post=<slug> → [{id,name,text,ts}], POST {post,name,text,site} → {id,name,text,ts,pending}),
   а удаляет и одобряет администратор на странице comments.php?admin=<секрет>. Текст всегда выводится через textContent. */
(function () {
  'use strict';
  var d = document, root = d.documentElement;

  /* меню */
  var top = d.getElementById('btTop'), burger = d.getElementById('btBurger'), menu = d.getElementById('btMenu');
  if (burger && top) {
    var setMenu = function (on) { top.classList.toggle('bt-open', on); burger.setAttribute('aria-expanded', on ? 'true' : 'false'); };
    burger.addEventListener('click', function () { setMenu(!top.classList.contains('bt-open')); });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
    d.addEventListener('click', function (e) { if (!top.contains(e.target)) setMenu(false); });
    if (menu) menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
  }

  /* обложка с сайта компании не загрузилась — остаётся фон рамки */
  d.querySelectorAll('img[data-soft]').forEach(function (img) {
    img.addEventListener('error', function () { img.hidden = true; });
  });

  /* комментарии */
  var box = d.getElementById('blCom');
  if (!box) return;
  var slug = box.getAttribute('data-post');
  var api = root.getAttribute('data-comments') || '';
  var KEY = 'bt-comments:' + slug;
  var list = d.getElementById('blList'), form = d.getElementById('blForm'), count = d.getElementById('blCount');
  var name = d.getElementById('blName'), text = d.getElementById('blText'), agree = d.getElementById('blAgree');
  var send = d.getElementById('blSend'), ok = d.getElementById('blOk');
  var trap = d.getElementById('blSite');   // скрытое поле: человек его не видит, заполняют только роботы
  var items = [];

  var store = {
    load: function () {
      if (api) return fetch(api + '?post=' + encodeURIComponent(slug)).then(function (r) { return r.ok ? r.json() : []; });
      try { return Promise.resolve(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch (e) { return Promise.resolve([]); }
    },
    add: function (c) {
      if (api) return fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ post: slug, name: c.name, text: c.text, site: trap ? trap.value : '' }) })
        .then(function (r) { if (!r.ok) throw new Error(r.status === 429 ? 'slow' : 'send'); return r.json(); });
      c.id = String(Date.now()); c.mine = true;
      items.unshift(c);
      try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) { /* хранилище закрыто — комментарий останется до перезагрузки */ }
      return Promise.resolve(null);
    },
    remove: function (id) {
      items = items.filter(function (c) { return c.id !== id; });
      try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) { /* то же */ }
    }
  };

  var MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  function when(ts) {
    var t = new Date(ts), now = new Date();
    if (now - t < 60 * 1000) return 'только что';
    if (t.toDateString() === now.toDateString()) return 'сегодня, ' + ('0' + t.getHours()).slice(-2) + ':' + ('0' + t.getMinutes()).slice(-2);
    return t.getDate() + ' ' + MONTHS[t.getMonth()] + ' ' + t.getFullYear();
  }
  function el(tag, cls, txt) { var n = d.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; }

  function render() {
    list.textContent = '';
    count.textContent = items.length;
    count.hidden = !items.length;
    if (!items.length) { list.appendChild(el('li', 'bl-empty', 'Пока нет комментариев. Будьте первым!')); return; }
    items.forEach(function (c) {
      var li = el('li', 'bl-c');
      li.appendChild(el('span', 'bl-c__a', (c.name || '?').trim().charAt(0)));
      var h = el('div', 'bl-c__h');
      h.appendChild(el('b', '', c.name));
      var tm = el('time', '', when(c.ts)); tm.dateTime = new Date(c.ts).toISOString();
      h.appendChild(tm);
      li.appendChild(h);
      li.appendChild(el('p', 'bl-c__t', c.text));
      if (c.mine) {
        var x = el('button', 'bl-c__x', 'Удалить');
        x.type = 'button';
        x.addEventListener('click', function () { store.remove(c.id); render(); });
        li.appendChild(x);
      }
      list.appendChild(li);
    });
  }

  function ready() { send.disabled = !(agree.checked && name.value.trim() && text.value.trim()); }
  [name, text].forEach(function (i) { i.addEventListener('input', ready); });
  agree.addEventListener('change', ready);

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    ready();
    if (send.disabled) return;
    var c = { name: name.value.trim().slice(0, 40), text: text.value.trim().slice(0, 1000), ts: Date.now() };
    send.disabled = true;
    store.add(c).then(function (saved) {
      var wait = saved && saved.pending;   // на сервере включена проверка: комментарий появится после одобрения
      if (saved && !wait) items.unshift(saved);
      text.value = '';
      agree.checked = false;
      ok.textContent = wait ? 'Спасибо! Комментарий появится после проверки.' : 'Комментарий опубликован.';
      ok.hidden = false;
      setTimeout(function () { ok.hidden = true; }, wait ? 7000 : 4000);
      render();
      ready();
    }).catch(function (err) {
      ok.textContent = err && err.message === 'slow' ? 'Слишком часто. Попробуйте через минуту.' : 'Не отправилось. Попробуйте ещё раз.';
      ok.hidden = false;
      ready();
    });
  });

  store.load().then(function (arr) { items = Array.isArray(arr) ? arr : []; render(); });
  ready();
})();
