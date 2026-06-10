(function () {
  if (!window.matchMedia('(pointer: fine)').matches) return;

  var cursor = document.getElementById('custom-cursor');
  if (!cursor) return;

  var tx = window.innerWidth / 2, ty = window.innerHeight / 2;
  var cx = tx, cy = ty;

  function lerp(a, b, t) { return a + (b - a) * t; }

  function loop() {
    cx = lerp(cx, tx, 0.28);
    cy = lerp(cy, ty, 0.28);
    cursor.style.transform = 'translate(' + cx + 'px, ' + cy + 'px)';
    requestAnimationFrame(loop);
  }

  document.addEventListener('mousemove', function (e) {
    tx = e.clientX;
    ty = e.clientY;
    cursor.classList.remove('cur-hidden');
  });

  document.addEventListener('mouseleave', function () { cursor.classList.add('cur-hidden'); });
  document.addEventListener('mouseenter', function () { cursor.classList.remove('cur-hidden'); });

  document.addEventListener('mousedown', function () { cursor.classList.add('cur-click'); });
  document.addEventListener('mouseup',   function () { cursor.classList.remove('cur-click'); });

  var HOVER = 'a, button, [role="button"], input, select, textarea, label, .masonry-item, .section-card, .menu-card, .news-card, .gallery-photo';

  document.addEventListener('mouseover', function (e) {
    if (e.target.closest(HOVER)) cursor.classList.add('cur-hover');
  });
  document.addEventListener('mouseout', function (e) {
    if (e.target.closest(HOVER)) cursor.classList.remove('cur-hover');
  });

  loop();
})();
