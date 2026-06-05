(function () {
  var THEME_KEY = 'photo-theme';

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }

  // restore saved theme on load
  var saved = localStorage.getItem(THEME_KEY);
  if (saved) applyTheme(saved);

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
}());
