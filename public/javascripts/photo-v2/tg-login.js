// Sign-in via Telegram on photo.dimazvali.com (lib/photo-tg-login.js, routes/photo.js):
// new token → open @dimazvalibot in a new tab → poll until the bot confirms → photoTgUser cookie is set.
// Used by the archive download gate, the "save selection" popup and the collection page.
//
//   photoTgSignIn(button, {
//     shootUrl: '/shoot/<slug>' (with the /en prefix if any),
//     purpose: 'download' | 'selection' | 'collection',   // only changes the bot's reply
//     text: { waiting, expired, error },                   // status lines
//     say: function(text) {},                              // where status lines go
//     onSignedIn: function() {},
//   })
(function() {
  window.photoTgSignIn = function(btn, opts) {
    if (!btn) return;
    var base = opts.shootUrl + '/download/tg';
    var pollTimer = null;
    function say(t) { if (opts.say) opts.say(t || ''); }

    function poll() {
      fetch(base + '-status', { cache: 'no-store' })
        .then(function(r) { return r.json(); })
        .then(function(d) {
          if (d.status === 'ok') { btn.disabled = false; say(''); return opts.onSignedIn(); }
          if (d.status === 'pending') { pollTimer = setTimeout(poll, 2000); return; }
          btn.disabled = false;
          say(d.status === 'expired' ? opts.text.expired : opts.text.error);
        })
        .catch(function() { pollTimer = setTimeout(poll, 4000); });
    }

    btn.addEventListener('click', function() {
      clearTimeout(pollTimer);
      btn.disabled = true;
      // open the tab synchronously (inside the click), otherwise popup blockers eat it after the fetch
      var win = window.open('', '_blank');
      var url = base + (opts.purpose && opts.purpose !== 'download' ? '?for=' + encodeURIComponent(opts.purpose) : '');
      fetch(url, { method: 'POST' })
        .then(function(r) { return r.json(); })
        .then(function(d) {
          if (!d.ok) throw new Error('tg');
          if (win) win.location.href = d.link; else window.location.href = d.link;
          say(opts.text.waiting);
          pollTimer = setTimeout(poll, 2000);
        })
        .catch(function() {
          if (win) win.close();
          btn.disabled = false;
          say(opts.text.error);
        });
    });
  };
}());
