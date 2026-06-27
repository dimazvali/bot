(function () {
  var section = document.querySelector('.photo-comments-section');
  if (!section) return;

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
    return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function pluralComments(n) {
    if (n % 10 === 1 && n % 100 !== 11) return n + ' КОММЕНТАРИЙ';
    if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return n + ' КОММЕНТАРИЯ';
    return n + ' КОММЕНТАРИЕВ';
  }

  function avatarHtml(picture, name, cls) {
    cls = cls || 'comment-avatar';
    if (picture) {
      return '<div class="' + cls + '"><img src="' + esc(picture) + '" alt="" referrerpolicy="no-referrer"></div>';
    }
    return '<div class="' + cls + '">' + esc((name || '?')[0].toUpperCase()) + '</div>';
  }

  function renderCommentsList(comments) {
    if (!comments.length) return '<p class="comments-empty">КОММЕНТАРИЕВ ЕЩЁ НЕТ</p>';
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
        html += '<button class="comment-hide-btn" data-id="' + esc(c.id) + '">СКРЫТЬ</button>';
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
        '<button class="comment-signout-btn">ВЫЙТИ</button>' +
        '</div>' +
        '<textarea class="inquiry-input comment-textarea" placeholder="НАПИСАТЬ КОММЕНТАРИЙ..." rows="3"></textarea>' +
        '<button class="inquiry-submit comment-submit-btn">ОТПРАВИТЬ →</button>' +
        '</div>';
    }
    return '<div class="comment-signin-block">' +
      '<span class="comment-signin-note">ВОЙДИТЕ, ЧТОБЫ ОСТАВИТЬ КОММЕНТАРИЙ</span>' +
      '<button class="comment-google-btn">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" style="flex-shrink:0">' +
      '<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>' +
      '<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>' +
      '<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>' +
      '<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>' +
      '</svg>' +
      'ВОЙТИ ЧЕРЕЗ GOOGLE' +
      '</button>' +
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
            if (data.ok) { load(); } else { submitBtn.disabled = false; }
          })
          .catch(function () { submitBtn.disabled = false; });
      });
    }

    var googleBtn = section.querySelector('.comment-google-btn');
    if (googleBtn && googleClientId) {
      googleBtn.addEventListener('click', function () {
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
                if (data.ok) { user = data.user; load(); }
              });
          },
        });
        google.accounts.id.prompt();
      });
    }
  }

  function load() {
    fetch('/photo-comments/' + country + '/' + series + '/' + photoId)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.ok) render(data.comments);
        else section.innerHTML = '<p class="comments-empty">ОШИБКА ЗАГРУЗКИ</p>';
      })
      .catch(function () {
        section.innerHTML = '<p class="comments-empty">ОШИБКА ЗАГРУЗКИ</p>';
      });
  }

  load();
}());
