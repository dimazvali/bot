(function () {
  var lb = document.getElementById('lightbox');
  if (!lb) return;

  var lbImg = document.getElementById('lightbox-img');
  var photos = [];
  var current = 0;
  var touchStartX = 0;

  document.querySelectorAll('.gallery-photo').forEach(function (img, i) {
    photos.push(img.src);
    img.addEventListener('click', function () {
      current = i;
      lbImg.src = photos[current];
      lb.classList.add('open');
    });
  });

  window.lbNav = function (dir) {
    if (!photos.length) return;
    current = (current + dir + photos.length) % photos.length;
    lbImg.src = photos[current];
  };

  document.addEventListener('keydown', function (e) {
    if (!lb.classList.contains('open')) return;
    if (e.key === 'Escape')      lb.classList.remove('open');
    if (e.key === 'ArrowRight')  lbNav(1);
    if (e.key === 'ArrowLeft')   lbNav(-1);
  });

  lb.addEventListener('touchstart', function (e) {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });

  lb.addEventListener('touchend', function (e) {
    var dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) lbNav(dx < 0 ? 1 : -1);
  });
})();
