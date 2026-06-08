(function () {
  var THEME_KEY = 'photo-theme';

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }

  function getAutoTheme() {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.media !== 'not all') {
      return mq.matches ? 'dark' : 'light';
    }
    var h = new Date().getHours();
    return (h >= 7 && h < 21) ? 'light' : 'dark';
  }

  function initTheme() {
    var saved = localStorage.getItem(THEME_KEY);
    if (saved) {
      document.documentElement.setAttribute('data-theme', saved);
      return;
    }
    document.documentElement.setAttribute('data-theme', getAutoTheme());
  }

  initTheme();

  var mqDark = window.matchMedia('(prefers-color-scheme: dark)');
  if (mqDark.addEventListener) {
    mqDark.addEventListener('change', function () {
      if (!localStorage.getItem(THEME_KEY)) {
        document.documentElement.setAttribute('data-theme', getAutoTheme());
      }
    });
  }

  window.toggleTheme = function () {
    var current = document.documentElement.getAttribute('data-theme') || 'dark';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  };

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var lbEl = document.getElementById('lb');
      if (lbEl && lbEl.classList.contains('lb-open')) { lbEl.classList.remove('lb-open'); document.body.style.overflow = ''; return; }
      var url = document.body.getAttribute('data-series-url');
      if (url) location.href = url;
    }
    if (e.key === 'ArrowLeft') {
      var btn = document.querySelector('.nav-btn[data-dir="prev"]');
      if (btn) location.href = btn.getAttribute('href');
    }
    if (e.key === 'ArrowRight') {
      var btn = document.querySelector('.nav-btn[data-dir="next"]');
      if (btn) location.href = btn.getAttribute('href');
    }
  });

  document.querySelectorAll('.masonry .photo-card img').forEach(function (img) {
    if (img.complete && img.naturalWidth) {
      img.classList.add('loaded');
      img.closest('.photo-card').classList.add('loaded');
    } else {
      img.addEventListener('load', function () { img.classList.add('loaded'); img.closest('.photo-card').classList.add('loaded'); });
      img.addEventListener('error', function () { img.classList.add('loaded'); img.closest('.photo-card').classList.add('loaded'); });
    }
  });
  var burger = document.getElementById('burger');
  var sidebar = document.getElementById('sidebar');
  var sidebarOverlay = document.getElementById('sidebar-overlay');

  function closeSidebar() {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('visible');
    document.body.classList.remove('sidebar-open');
  }

  if (burger) {
    burger.addEventListener('click', function () {
      var isOpen = sidebar.classList.toggle('open');
      sidebarOverlay.classList.toggle('visible', isOpen);
      document.body.classList.toggle('sidebar-open', isOpen);
    });
    sidebarOverlay.addEventListener('click', closeSidebar);
    sidebar.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', closeSidebar);
    });
  }

  // Lightbox + skeleton
  var photoPageImg = document.querySelector('.photo-page-image img');
  if (photoPageImg) {
    var imgContainer = photoPageImg.closest('.photo-page-image');
    function markImgLoaded() { if (imgContainer) imgContainer.classList.add('loaded'); }
    if (photoPageImg.complete && photoPageImg.naturalWidth) {
      markImgLoaded();
    } else {
      photoPageImg.addEventListener('load', markImgLoaded);
      photoPageImg.addEventListener('error', markImgLoaded);
    }

    var lb = document.createElement('div');
    lb.id = 'lb';
    lb.className = 'lb';
    var lbClose = document.createElement('button');
    lbClose.className = 'lb-close';
    lbClose.textContent = '✕';
    var lbImg = document.createElement('img');
    lbImg.className = 'lb-img';
    lb.appendChild(lbClose);
    lb.appendChild(lbImg);
    document.body.appendChild(lb);

    function openLb() {
      lbImg.src = photoPageImg.src;
      lb.classList.add('lb-open');
      document.body.style.overflow = 'hidden';
    }
    function closeLb() {
      lb.classList.remove('lb-open');
      document.body.style.overflow = '';
    }

    photoPageImg.addEventListener('click', openLb);
    lb.addEventListener('click', closeLb);
    lbClose.addEventListener('click', function (e) { e.stopPropagation(); closeLb(); });
  }

  window.shuffleMasonry = function () {
    var masonry = document.querySelector('.masonry');
    if (!masonry) return;
    var cards = Array.from(masonry.querySelectorAll('.photo-card'));
    for (var i = cards.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = cards[i]; cards[i] = cards[j]; cards[j] = tmp;
    }
    cards.forEach(function (card) { masonry.appendChild(card); });
  };

  window.sharePhoto = function () {
    var title = document.title;
    var url = location.href;
    if (navigator.share) {
      navigator.share({ title: title, url: url }).catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(function () {
        var btn = document.querySelector('.action-btn[onclick="sharePhoto()"]');
        if (btn) {
          var orig = btn.textContent;
          btn.textContent = 'СКОПИРОВАНО';
          setTimeout(function () { btn.textContent = orig; }, 2000);
        }
      });
    }
  };
}());
