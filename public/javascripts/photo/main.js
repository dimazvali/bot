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
      var url = document.body.getAttribute('data-series-url');
      if (url) location.href = url;
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
