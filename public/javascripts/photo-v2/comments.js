(function () {
  var section = document.querySelector('.photo-comments-section');
  if (!section) return;

  var lang = window.PhotoI18n.lang;
  var UI = {
    empty: window.PhotoI18n.t.commentsEmpty, hide: window.PhotoI18n.t.commentsHide, signOut: window.PhotoI18n.t.commentsSignOut,
    writePlaceholder: window.PhotoI18n.t.commentsWritePlaceholder, submit: window.PhotoI18n.t.commentsSubmit,
    signInNote: window.PhotoI18n.t.commentsSignInNote, signInGoogle: window.PhotoI18n.t.commentsSignInGoogle,
    loadError: window.PhotoI18n.t.commentsLoadError,
  };

  var country = section.dataset.country;
  var series = section.dataset.series;
  var photoId = section.dataset.photoId;
  var isAdmin = section.dataset.isAdmin === '1';
  var googleClientId = section.dataset.googleClientId;
  var user = null;
  try { user = section.dataset.user ? JSON.parse(section.dataset.user) : null; } catch (e) {}

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString(window.PhotoI18n.dateLocale, { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function pluralComments(n) {
    if (lang === 'en') return n + ' ' + (n === 1 ? window.PhotoI18n.t.commentsOne : window.PhotoI18n.t.commentsMany);
    if (n % 10 === 1 && n % 100 !== 11) return n + ' ' + window.PhotoI18n.t.commentsOne;
    if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return n + ' ' + window.PhotoI18n.t.commentsFew;
    return n + ' ' + window.PhotoI18n.t.commentsMany;
  }

  function avatarHtml(picture, name, cls) {
    cls = cls || 'comment-avatar';
    if (picture) {
      return '<div class="' + cls + '"><img src="' + esc(picture) + '" alt="" referrerpolicy="no-referrer"></div>';
    }
    return '<div class="' + cls + '">' + esc((name || '?')[0].toUpperCase()) + '</div>';
  }

  function renderCommentsList(comments) {
    if (!comments.length) return '<p class="comments-empty">' + UI.empty + '</p>';
    var html = '<p class="comments-count">' + pluralComments(comments.length) + '</p>';
    html += '<div class="comments-list">';
    comments.forEach(function (c) {
      html += '<div class="comment" data-id="' + esc(c.id) + '">';
      html += avatarHtml(c.userPicture, c.userName);
      html += '<div class="comment-body">';
      html += '<div class="comment-meta">';
      html += '<span class="comment-name">' + esc((c.userName || '').toUpperCase()) + '</span>';
      html += '<span class="comment-date">' + esc(formatDate(c.createdAt)) + '</span>';
      if (isAdmin) {
        html += '<button class="comment-hide-btn" data-id="' + esc(c.id) + '">' + UI.hide + '</button>';
      }
      html += '</div>';
      html += '<div class="comment-text">' + esc(c.text).replace(/\n/g, '<br>') + '</div>';
      html += '</div></div>';
    });
    html += '</div>';
    return html;
  }

  function renderWriteBlock() {
    if (user) {
      return '<div class="comment-write">' +
        '<div class="comment-user-line">' +
        avatarHtml(user.picture, user.name, 'comment-avatar comment-avatar-sm') +
        '<span class="comment-user-name">' + esc(user.name.toUpperCase()) + '</span>' +
        '<button class="comment-signout-btn">' + UI.signOut + '</button>' +
        '</div>' +
        '<textarea class="inquiry-input comment-textarea" placeholder="' + esc(UI.writePlaceholder) + '" rows="3"></textarea>' +
        '<button class="inquiry-submit comment-submit-btn">' + UI.submit + '</button>' +
        '</div>';
    }
    return '<div class="comment-signin-block">' +
      '<span class="comment-signin-note">' + UI.signInNote + '</span>' +
      '<div class="comment-google-mount"></div>' +
      '</div>';
  }

  function render(comments) {
    section.innerHTML = renderCommentsList(comments) + renderWriteBlock();
    bindEvents();
  }

  function bindEvents() {
    section.querySelectorAll('.comment-hide-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.dataset.id;
        fetch('/photo-comments/admin/' + id + '/hide', { method: 'POST' })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (data.ok) {
              var el = section.querySelector('.comment[data-id="' + id + '"]');
              if (el) el.remove();
            }
          });
      });
    });

    var signoutBtn = section.querySelector('.comment-signout-btn');
    if (signoutBtn) {
      signoutBtn.addEventListener('click', function () {
        fetch('/photo-comments/auth/signout', { method: 'POST' }).then(function () {
          user = null;
          load();
        });
      });
    }

    var submitBtn = section.querySelector('.comment-submit-btn');
    if (submitBtn) {
      submitBtn.addEventListener('click', function () {
        var textarea = section.querySelector('.comment-textarea');
        var text = textarea ? textarea.value.trim() : '';
        if (!text) return;
        submitBtn.disabled = true;
        fetch('/photo-comments/' + country + '/' + series + '/' + photoId, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: text }),
        })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (data.ok) { window.photoTrack && window.photoTrack('add_comment', window.photoTrack.photo()); load(); } else { submitBtn.disabled = false; }
          })
          .catch(function () { submitBtn.disabled = false; });
      });
    }

    // Rendered GIS button rather than One Tap (google.accounts.id.prompt()): the
    // prompt goes through FedCM, which fails with "Not signed in with the identity
    // provider" when there's no active Google session or third-party cookies are
    // blocked. Same fix as photo/comments.js and points.js.
    var googleMount = section.querySelector('.comment-google-mount');
    if (googleMount && googleClientId) {
      waitForGsi(function () {
        /* global google */
        google.accounts.id.initialize({
          client_id: googleClientId,
          callback: function (response) {
            fetch('/photo-comments/auth/google', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ credential: response.credential }),
            })
              .then(function (r) { return r.json(); })
              .then(function (data) {
                if (data.ok) { user = data.user; window.photoTrack && window.photoTrack('login', { method: 'google', context: 'comments' }); load(); }
              });
          },
        });
        google.accounts.id.renderButton(googleMount, { theme: 'filled_black', size: 'medium', text: 'signin_with' });
      });
    }
  }

  // Waits for the (deferred) GSI script to be ready before rendering the button.
  function waitForGsi(cb, attemptsLeft) {
    attemptsLeft = attemptsLeft == null ? 50 : attemptsLeft; // ~5s at 100ms/try, then give up quietly
    if (typeof google !== 'undefined' && google.accounts && google.accounts.id) { cb(); return; }
    if (attemptsLeft <= 0) return;
    setTimeout(function () { waitForGsi(cb, attemptsLeft - 1); }, 100);
  }

  function load() {
    fetch('/photo-comments/' + country + '/' + series + '/' + photoId)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.ok) render(data.comments);
        else section.innerHTML = '<p class="comments-empty">' + UI.loadError + '</p>';
      })
      .catch(function () {
        section.innerHTML = '<p class="comments-empty">' + UI.loadError + '</p>';
      });
  }

  load();
}());
