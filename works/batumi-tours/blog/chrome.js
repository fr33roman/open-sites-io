/* chrome-js:start — меню телефона, список языков, шапка при прокрутке; собирает _blog/chrome.py, руками не править */
(function () {
  'use strict';
  var d = document;
  var top = d.getElementById('btTop'), burger = d.getElementById('btBurger'), menu = d.getElementById('btMenu');
  var langs = [].slice.call(d.querySelectorAll('[data-lang-box]'));
  function onScroll() { if (top) top.classList.toggle('bt-solid', window.scrollY > 10); }
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  function setMenu(on) {
    if (!top || !burger) return;
    top.classList.toggle('bt-open', on); burger.setAttribute('aria-expanded', on ? 'true' : 'false');
    if (!on) closeLangs();
  }
  function closeLangs(except) {
    langs.forEach(function (box) {
      if (box === except) return;
      box.classList.remove('is-open'); box.querySelector('.bt-lang__b').setAttribute('aria-expanded', 'false');
    });
  }
  if (burger && top) {
    burger.addEventListener('click', function () { setMenu(!top.classList.contains('bt-open')); });
    if (menu) menu.addEventListener('click', function (e) { if (e.target.closest('.bt-menu__nav a')) setMenu(false); });
    var book = top.querySelector('.bt-bookb');
    if (book) book.addEventListener('click', function () { setMenu(false); });
  }
  langs.forEach(function (box) {
    var b = box.querySelector('.bt-lang__b');
    b.addEventListener('click', function () {
      var on = !box.classList.contains('is-open');
      closeLangs(box); box.classList.toggle('is-open', on); b.setAttribute('aria-expanded', on ? 'true' : 'false');
    });
    box.addEventListener('click', function (e) {      // выбран «RU» (единственный рабочий пункт): список закрывается
      if (e.target.closest('.bt-lang__o:not(:disabled)')) { box.classList.remove('is-open'); b.setAttribute('aria-expanded', 'false'); b.focus(); }
    });
  });
  d.addEventListener('click', function (e) {
    if (top && !top.contains(e.target)) setMenu(false);
    else if (!e.target.closest('[data-lang-box]')) closeLangs();
  });
  d.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var open = langs.filter(function (b) { return b.classList.contains('is-open'); })[0];
    if (open) { closeLangs(); open.querySelector('.bt-lang__b').focus(); return; }
    setMenu(false);
  });
})();
/* chrome-js:end */
