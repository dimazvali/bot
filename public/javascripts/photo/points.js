// Lets a signed-in visitor drop a marker/point on a shoot photo — reuses the
// same Google auth (photoUser cookie) as the comments widget, and the same
// coordinate math the page already uses to position existing markers
// (see repositionAnnots() below / in photo.pug), so a placed point lines up
// with the click even when the image is letterboxed.
(function () {
  var addBtn = document.getElementById('add-point-btn');
  var wrap = document.querySelector('.photo-image-wrap');
  var popup = document.getElementById('point-popup');
  if (!addBtn || !wrap || !popup) return;

  var t = window.PhotoI18n.t;
  var section = document.querySelector('.photo-comments-section');
  var googleClientId = section ? section.dataset.googleClientId : '';
  var user = null;
  try { user = section && section.dataset.user ? JSON.parse(section.dataset.user) : null; } catch (e) {}

  var slug = addBtn.dataset.slug;
  var photoId = addBtn.dataset.photoId;
  var addBtnLabel = addBtn.textContent;

  var textarea = document.getElementById('point-popup-input');
  var msgEl = document.getElementById('point-popup-msg');
  var saveBtn = document.getElementById('point-popup-save');
  var cancelBtn = document.getElementById('point-popup-cancel');

  var armed = false;
  var pendingMarker = null;
  var pendingX = 0, pendingY = 0;

  function setArmed(v) {
    armed = v;
    wrap.classList.toggle('is-placing', v);
    addBtn.classList.toggle('is-active', v);
    addBtn.textContent = v ? t.pointArmed : addBtnLabel;
  }

  function removePendingMarker() {
    if (pendingMarker) { pendingMarker.remove(); pendingMarker = null; }
  }

  function closePopup() {
    popup.classList.remove('is-open');
    removePendingMarker();
    setArmed(false);
  }

  var signInPopup = document.getElementById('point-signin-popup');
  var signInBtnContainer = document.getElementById('point-signin-btn');
  var signInCancelBtn = document.getElementById('point-signin-cancel');
  var gsiInitialized = false;
  var gsiButtonRendered = false;

  addBtn.addEventListener('click', function () {
    if (armed) { setArmed(false); return; }
    if (!user) { openSignIn(); return; }
    setArmed(true);
  });

  wrap.addEventListener('click', function (e) {
    if (!armed) return;
    // Placing a point takes over the click entirely — without this, the same
    // click also bubbles up to the document-level handler (photo.pug) that
    // opens the fullscreen lightbox on any click on the image.
    e.stopPropagation();
    e.preventDefault();
    var img = wrap.querySelector('img');
    if (!img || !img.naturalWidth) return;
    var rect = wrap.getBoundingClientRect();
    var W = img.clientWidth, H = img.clientHeight;
    var scale = Math.min(W / img.naturalWidth, H / img.naturalHeight);
    var rW = img.naturalWidth * scale, rH = img.naturalHeight * scale;
    var rL = (W - rW) / 2, rT = (H - rH) / 2;
    var clickX = e.clientX - rect.left, clickY = e.clientY - rect.top;
    var x = (clickX - rL) / rW * 100;
    var y = (clickY - rT) / rH * 100;
    if (x < 0 || x > 100 || y < 0 || y > 100) return; // clicked the letterbox padding, not the image itself
    pendingX = Math.round(x * 100) / 100;
    pendingY = Math.round(y * 100) / 100;

    removePendingMarker();
    var m = document.createElement('div');
    m.className = 'photo-annot photo-annot--pending';
    m.style.left = clickX + 'px';
    m.style.top = clickY + 'px';
    wrap.appendChild(m);
    pendingMarker = m;

    textarea.value = '';
    msgEl.textContent = '';
    popup.classList.add('is-open');
    textarea.focus();
  });

  cancelBtn.addEventListener('click', closePopup);
  popup.addEventListener('click', function (e) { if (e.target === popup) closePopup(); });

  saveBtn.addEventListener('click', function () {
    var text = textarea.value.trim();
    if (!text) { msgEl.textContent = t.pointEmptyError; return; }
    saveBtn.disabled = true;
    fetch('/shoot/' + slug + '/' + photoId + '/point', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x: pendingX, y: pendingY, text: text }),
    })
      .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
      .then(function (res) {
        if (!res.ok) {
          saveBtn.disabled = false;
          msgEl.textContent = (res.data && res.data.error) || t.pointSaveError;
          return;
        }
        window.location.reload();
      })
      .catch(function () {
        saveBtn.disabled = false;
        msgEl.textContent = t.pointSaveError;
      });
  });

  // Waits for the (deferred) GSI script to actually be ready — clicking right as the
  // page loads can otherwise silently do nothing if google.accounts isn't defined yet.
  function waitForGsi(cb, attemptsLeft) {
    attemptsLeft = attemptsLeft == null ? 50 : attemptsLeft; // ~5s at 100ms/try, then give up quietly
    if (typeof google !== 'undefined' && google.accounts && google.accounts.id) { cb(); return; }
    if (attemptsLeft <= 0) return;
    setTimeout(function () { waitForGsi(cb, attemptsLeft - 1); }, 100);
  }

  function handleCredential(response) {
    /* global google */
    fetch('/photo-comments/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.ok) return;
        user = data.user;
        if (section) section.dataset.user = JSON.stringify(data.user);
        if (signInPopup) signInPopup.classList.remove('is-open');
        setArmed(true); // straight into placement mode — no extra click needed after signing in
      });
  }

  // A real, rendered "Sign in with Google" button rather than the One Tap prompt() —
  // prompt() can be silently suppressed (dismissed before, opted out, etc.), which from
  // a custom "add a mark" button would look like clicking it just does nothing. A
  // button the visitor explicitly clicks always opens the sign-in flow.
  function openSignIn() {
    if (!googleClientId || !signInPopup || !signInBtnContainer) return;
    signInPopup.classList.add('is-open');
    waitForGsi(function () {
      if (!gsiInitialized) {
        gsiInitialized = true;
        google.accounts.id.initialize({ client_id: googleClientId, callback: handleCredential });
      }
      if (!gsiButtonRendered) {
        gsiButtonRendered = true;
        google.accounts.id.renderButton(signInBtnContainer, { theme: 'filled_black', size: 'medium', text: 'signin_with' });
      }
    });
  }

  if (signInCancelBtn) signInCancelBtn.addEventListener('click', function () { signInPopup.classList.remove('is-open'); });
  if (signInPopup) signInPopup.addEventListener('click', function (e) { if (e.target === signInPopup) signInPopup.classList.remove('is-open'); });
}());
