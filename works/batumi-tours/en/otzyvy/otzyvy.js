/* Страница отзывов: фильтр по источнику и «Читать полностью» для длинных текстов. */
(function () {
  'use strict';
  var d = document;
  var cards = [].slice.call(d.querySelectorAll('.rv'));
  var btns = [].slice.call(d.querySelectorAll('.rv-f'));
  var empty = d.querySelector('.rv-empty');

  btns.forEach(function (b) {
    b.addEventListener('click', function () {
      var f = b.getAttribute('data-f'), shown = 0;
      btns.forEach(function (x) { var on = x === b; x.classList.toggle('is-on', on); x.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      cards.forEach(function (c) {
        var ok = !f || c.getAttribute('data-src') === f;
        c.hidden = !ok; if (ok) shown++;
      });
      if (empty) empty.hidden = shown > 0;
      measure();
    });
  });

  function measure() {
    cards.forEach(function (c) {
      if (c.hidden) return;
      var t = c.querySelector('.rv__t'), m = c.querySelector('.rv__more');
      if (!t || !m) return;
      if (c.classList.contains('is-open')) { m.hidden = false; return; }
      m.hidden = !(t.scrollHeight > t.clientHeight + 2);
    });
  }
  cards.forEach(function (c) {
    var m = c.querySelector('.rv__more');
    if (!m) return;
    m.addEventListener('click', function () {
      var open = c.classList.toggle('is-open');
      m.textContent = open ? 'Show less' : 'Read more';
      m.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });
  measure();
  window.addEventListener('load', measure);
  var tm = 0;
  window.addEventListener('resize', function () { clearTimeout(tm); tm = setTimeout(measure, 120); });
  if (d.fonts && d.fonts.ready) d.fonts.ready.then(measure);
})();
