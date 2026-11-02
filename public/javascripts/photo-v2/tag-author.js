// "Don't forget to tag the author @dimazvali2" — shown after a file / selection / archive download,
// at most once a day. Links marked [data-tag-author] trigger it on click; other code calls
// window.photoTagAuthor() (selection download in gallery.pug, archive after sign-in in download-login.pug).
(function () {
  var KEY = 'photo-tag-author-shown';
  var DAY = 24 * 60 * 60 * 1000;
  var popup = document.getElementById('tag-author-popup');
  if (!popup) return;

  function close() { popup.classList.remove('is-open'); }

  window.photoTagAuthor = function () {
    try {
      var last = +localStorage.getItem(KEY) || 0;
      if (Date.now() - last < DAY) return;
      localStorage.setItem(KEY, String(Date.now()));
    } catch (e) { return; }
    // let the download start first — the popup shouldn't hide the browser's download prompt
    setTimeout(function () {
      popup.classList.add('is-open');
      window.photoTrack && window.photoTrack('tag_author_popup');
    }, 600);
  };

  document.getElementById('tag-author-ok').addEventListener('click', close);
  // the profile link is counted by main.js's delegated instagram_click handler
  document.getElementById('tag-author-profile').addEventListener('click', close);
  popup.addEventListener('click', function (e) { if (e.target === popup) close(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('a[data-tag-author]')) window.photoTagAuthor();
  });
}());
