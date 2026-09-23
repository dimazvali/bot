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

  // ── Unsubscribed state: sidebar toggle popup (email/telegram) ───────────────
  var toggle = document.getElementById('subscribe-toggle');
  var popup = document.getElementById('subscribe-popup');
  if (toggle && popup) {
    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      popup.style.display = popup.style.display === 'none' ? 'flex' : 'none';
    });
    document.addEventListener('click', function () { popup.style.display = 'none'; });
    popup.addEventListener('click', function (e) { e.stopPropagation(); });
  }

  // ── Email option (Google Sign-In): binds every instance on the page — the
  // sidebar widget and any "subscribe" action-card in the feed both use the
  // same .subscribe-email-btn class, so a click anywhere goes through here.
  if (!googleClientId) return;
  document.querySelectorAll('.subscribe-email-btn').forEach(function (emailBtn) {
    emailBtn.addEventListener('click', function () {
      if (popup) popup.style.display = 'none';
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
              if (data.ok) window.location.reload();
              else emailBtn.disabled = false;
            })
            .catch(function () { emailBtn.disabled = false; });
        },
        use_fedcm_for_prompt: true,
      });
      google.accounts.id.prompt();
    });
  });
}());
