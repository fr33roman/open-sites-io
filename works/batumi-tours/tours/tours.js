/* Страница тура: галерея (стрелки, миниатюры, свайп — родной, через прокрутку) и просмотр фото на весь экран. */
(function () {
  'use strict';
  var d = document;
  var gal = d.querySelector('[data-gal]');
  if (!gal) return;
  var track = gal.querySelector('.tp-g__track');
  var slides = [].slice.call(gal.querySelectorAll('.tp-g__s'));
  var thumbs = [].slice.call(gal.querySelectorAll('.tp-g__t'));
  var cur = gal.querySelector('[data-cur]');
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var idx = 0;

  function mark(i) {
    idx = i;
    if (cur) cur.textContent = String(i + 1);
    thumbs.forEach(function (t, k) {
      t.classList.toggle('is-on', k === i);
      if (k === i && t.scrollIntoView) { try { t.parentNode.scrollTo({ left: t.offsetLeft - 12, behavior: reduced ? 'auto' : 'smooth' }); } catch (e) { /* не страшно */ } }
    });
  }
  function go(i) {
    i = (i + slides.length) % slides.length;
    track.scrollTo({ left: slides[i].offsetLeft - track.offsetLeft, behavior: reduced ? 'auto' : 'smooth' });
    mark(i);
  }
  var tmr = 0;
  track.addEventListener('scroll', function () {
    clearTimeout(tmr);
    tmr = setTimeout(function () {
      var i = Math.round(track.scrollLeft / track.clientWidth);
      if (i !== idx && i >= 0 && i < slides.length) mark(i);
    }, 60);
  }, { passive: true });
  var p = gal.querySelector('[data-prev]'), n = gal.querySelector('[data-next]');
  if (p) p.addEventListener('click', function () { go(idx - 1); });
  if (n) n.addEventListener('click', function () { go(idx + 1); });
  thumbs.forEach(function (t) { t.addEventListener('click', function () { go(+t.getAttribute('data-go')); }); });

  /* полный кадр */
  var lb = d.getElementById('tpLb');
  if (!lb) return;
  var img = lb.querySelector('.tp-lb__i'), li = 0, opener = null;
  var full = [].slice.call(gal.querySelectorAll('[data-full]')).map(function (b) {
    return { src: b.getAttribute('data-full'), alt: (b.querySelector('img') || {}).alt || '' };
  });
  function show(i) {
    li = (i + full.length) % full.length;
    img.src = full[li].src; img.alt = full[li].alt;
  }
  function open(i, from) {
    opener = from; show(i); lb.hidden = false; d.documentElement.style.overflow = 'hidden';
    lb.querySelector('.tp-lb__x').focus();
  }
  function close() {
    lb.hidden = true; d.documentElement.style.overflow = '';
    go(li); if (opener) opener.focus();
  }
  gal.addEventListener('click', function (e) {
    var b = e.target.closest('[data-open]'); if (b) open(+b.getAttribute('data-open'), b);
  });
  lb.querySelector('.tp-lb__x').addEventListener('click', close);
  lb.querySelector('[data-lprev]').addEventListener('click', function () { show(li - 1); });
  lb.querySelector('[data-lnext]').addEventListener('click', function () { show(li + 1); });
  if (full.length < 2) { lb.querySelector('[data-lprev]').hidden = true; lb.querySelector('[data-lnext]').hidden = true; }
  lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
  d.addEventListener('keydown', function (e) {
    if (lb.hidden) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') show(li - 1);
    else if (e.key === 'ArrowRight') show(li + 1);
  });
  var sx = null;
  lb.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', function (e) {
    if (sx === null || full.length < 2) return;
    var dx = e.changedTouches[0].clientX - sx; sx = null;
    if (Math.abs(dx) > 50) show(li + (dx < 0 ? 1 : -1));
  }, { passive: true });
})();
