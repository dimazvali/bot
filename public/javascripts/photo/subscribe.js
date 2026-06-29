(function () {
  var googleClientId = (document.querySelector('meta[name="google-client-id"]') || {}).content || '';

  // ── Subscribed state: unsubscribe button ────────────────────────────────────
  var unsubBtn = document.getElementById('unsubscribe-google-btn');
  if (unsubBtn) {
    unsubBtn.addEventListener('click', function () {
      unsubBtn.disabled = true;
      fetch('/unsubscribe/google', { method: 'POST' })
        .then(function (r) { return r.json(); })
        .then(function (d) { if (d.ok) window.location.reload(); else unsubBtn.disabled = false; })
        .catch(function () { unsubBtn.disabled = false; });
    });
    return;
  }

  // ── Unsubscribed state: toggle popup ───────────────────────────────────────
  var toggle = document.getElementById('subscribe-toggle');
  var popup = document.getElementById('subscribe-popup');
  var emailBtn = document.getElementById('subscribe-email-btn');
  var msg = document.getElementById('subscribe-msg');

  if (!toggle || !popup) return;

  toggle.addEventListener('click', function (e) {
    e.stopPropagation();
    popup.style.display = popup.style.display === 'none' ? 'flex' : 'none';
  });

  document.addEventListener('click', function () {
    popup.style.display = 'none';
  });

  popup.addEventListener('click', function (e) { e.stopPropagation(); });

  // ── Email option: Google Sign-In ────────────────────────────────────────────
  if (emailBtn && googleClientId) {
    emailBtn.addEventListener('click', function () {
      popup.style.display = 'none';
      emailBtn.disabled = true;
      /* global google */
      google.accounts.id.initialize({
        client_id: googleClientId,
        callback: function (response) {
          fetch('/subscribe/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential: response.credential }),
          })
            .then(function (r) { return r.json(); })
            .then(function (data) {
              if (data.ok) {
                if (msg) { msg.textContent = '✓ вы подписаны (почта)'; msg.style.display = ''; }
                if (toggle) toggle.style.display = 'none';
              } else {
                emailBtn.disabled = false;
              }
            })
            .catch(function () { emailBtn.disabled = false; });
        },
        use_fedcm_for_prompt: true,
      });
      google.accounts.id.prompt();
    });
  }
}());
