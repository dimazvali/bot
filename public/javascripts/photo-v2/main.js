(function () {
  var THEME_KEY = 'photo-theme';

  // Beacon any outbound Instagram link click, site-wide — delegated, so it
  // covers the promo card, sidebar contact link, per-photo IG link, everything,
  // without needing a per-template hook. See POST /ig-click.
  function placement(el) {
    if (el.closest('.photo-card--promo')) return 'feed_card';
    if (el.closest('.sidebar')) return 'sidebar';
    if (el.closest('.promo-card')) return 'promo_popup';
    if (el.closest('.photo-actions')) return 'photo_page';
    if (el.closest('.about-page')) return 'about';
    return 'other';
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href*="instagram.com"]');
    if (!a) return;
    window.photoTrack && window.photoTrack('instagram_click', { placement: placement(a), link_url: a.getAttribute('href') });
    var payload = JSON.stringify({ path: location.pathname });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/ig-click', new Blob([payload], { type: 'application/json' }));
      } else {
        fetch('/ig-click', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(function () {});
      }
    } catch (err) {}
  });

  // ── other clicks worth counting: contacts, Telegram subscribe, shoot downloads, language switch ──
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var h = a.getAttribute('href') || '';
    var path = h.split('?')[0];
    var shootSlug = (path.match(/\/shoot\/([^/]+)\//) || [])[1];
    if (/dimazvalibot/.test(h)) window.photoTrack && window.photoTrack('subscribe_click', { method: 'telegram', placement: placement(a) });
    else if (/^mailto:/.test(h)) window.photoTrack && window.photoTrack('contact_click', { method: 'email', placement: placement(a) });
    else if (/(telegram\.me|t\.me)\//.test(h)) window.photoTrack && window.photoTrack('contact_click', { method: 'telegram', placement: placement(a) });
    else if (/wa\.me\//.test(h)) window.photoTrack && window.photoTrack('contact_click', { method: 'whatsapp', placement: placement(a) });
    else if (/\/download-instagram$/.test(path)) window.photoTrack && window.photoTrack('instagram_download', Object.assign({ shoot: shootSlug }, window.photoTrack.photo()));
    else if (/\/shoot\/[^/]+\/download$/.test(path)) window.photoTrack && window.photoTrack('shoot_download', { scope: 'all', shoot: shootSlug });
    else if (a.matches('.lang-switch, .lang-seg a, .fb-lang')) window.photoTrack && window.photoTrack('language_switch', { to: document.documentElement.lang === 'en' ? 'ru' : 'en' });
  });

  // ── Instagram promo card: closable, stays hidden for ~2 weeks once dismissed ──
  (function () {
    var COOKIE_NAME = 'photoIgDismiss';
    function hasDismissCookie() {
      return document.cookie.split('; ').some(function (c) { return c.indexOf(COOKIE_NAME + '=') === 0; });
    }
    if (hasDismissCookie()) {
      document.querySelectorAll('.photo-card--promo').forEach(function (card) { card.remove(); });
      return;
    }
    document.querySelectorAll('.photo-card-promo-close').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.cookie = COOKIE_NAME + '=1; max-age=1209600; path=/';
        window.photoTrack && window.photoTrack('instagram_card_dismiss');
        var card = btn.closest('.photo-card--promo');
        if (card) card.remove();
      });
    });
  }());

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    window.photoTrack && window.photoTrack('theme_change', { theme: theme });
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

  // client shoot pages: their own light/dark switch (default dark), stored apart from the site theme
  window.toggleFocusTheme = function () {
    var next = document.documentElement.getAttribute('data-focus-theme') === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-focus-theme', next);
    try { localStorage.setItem('photo-focus-theme', next); } catch (e) {}
    window.photoTrack && window.photoTrack('theme_change', { theme: next, scope: 'shoot' });
  };

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var presEl = document.getElementById('presentation-overlay');
      if (presEl && presEl.classList.contains('is-open')) { closePresentation(); return; }
      var lbEl = document.getElementById('lb');
      if (lbEl && lbEl.classList.contains('lb-open')) { lbEl.classList.remove('lb-open'); document.body.style.overflow = ''; return; }
      var url = document.body.getAttribute('data-series-url');
      if (url) location.href = url;
    }
    if (e.key === 'ArrowLeft') {
      var btn = document.querySelector('.nav-btn[data-dir="prev"]');
      if (btn) btn.click();
    }
    if (e.key === 'ArrowRight') {
      var btn = document.querySelector('.nav-btn[data-dir="next"]');
      if (btn) btn.click();
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

  // note: the photo-detail lightbox/skeleton lives in photo.pug (needs to survive soft-nav swaps)

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

  var presentationSlides = [];
  var presentationIndex = 0;
  var presentationTimer = null;

  function showPresentationSlide(idx) {
    if (!presentationSlides.length) return;
    presentationIndex = (idx + presentationSlides.length) % presentationSlides.length;
    var slide = presentationSlides[presentationIndex];
    var img = document.getElementById('presentation-img');
    img.src = slide.src;
    img.alt = slide.title;
  }

  function closePresentation() {
    var overlay = document.getElementById('presentation-overlay');
    if (!overlay) return;
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
    if (presentationTimer) { clearInterval(presentationTimer); presentationTimer = null; }
  }

  window.startPresentation = function () {
    var overlay = document.getElementById('presentation-overlay');
    if (!overlay) return;
    var cards = document.querySelectorAll('.masonry .photo-card[data-full]:not([data-hidden]):not([data-curator-hidden])');
    presentationSlides = Array.prototype.map.call(cards, function (card) {
      var img = card.querySelector('img');
      return { src: card.getAttribute('data-full'), href: card.getAttribute('href'), title: img ? img.alt : '' };
    });
    if (!presentationSlides.length) return;
    window.photoTrack && window.photoTrack('presentation_start', { photos: presentationSlides.length });

    overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    showPresentationSlide(0);
    if (presentationTimer) clearInterval(presentationTimer);
    presentationTimer = setInterval(function () { showPresentationSlide(presentationIndex + 1); }, 5000);
  };

  (function () {
    var overlay = document.getElementById('presentation-overlay');
    if (!overlay) return;
    var img = document.getElementById('presentation-img');
    var closeBtn = document.getElementById('presentation-close');
    img.addEventListener('click', function () {
      var slide = presentationSlides[presentationIndex];
      if (slide && slide.href) location.href = slide.href;
    });
    if (closeBtn) closeBtn.addEventListener('click', closePresentation);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closePresentation(); });
  }());

  // ── Gallery map: markers for this series'/shoot's photos that have coordinates ──
  (function () {
    var toggleBtns = document.querySelectorAll('.gallery-map-trigger');
    var panel = document.getElementById('gallery-map-panel');
    var dataEl = document.getElementById('gallery-map-data');
    if (!toggleBtns.length || !panel || !dataEl) return;

    var points;
    try { points = JSON.parse(dataEl.textContent); } catch (e) { points = []; }
    if (!points.length) return;

    var map = null;

    function initMap() {
      if (map || !window.L) return;
      map = L.map('gallery-map', { scrollWheelZoom: true, attributionControl: false });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
      var pinIcon = L.divIcon({ className: 'gallery-map-pin-wrap', html: '<span class="gallery-map-pin"></span>', iconSize: [12, 12], iconAnchor: [6, 6] });
      var markers = points.map(function (p) {
        var m = L.marker([p.lat, p.lng], { icon: pinIcon }).addTo(map);
        m.bindTooltip(p.title || '');
        m.on('click', function () { location.href = p.href; });
        return m;
      });
      var group = L.featureGroup(markers);
      map.fitBounds(group.getBounds().pad(0.2), { maxZoom: 15 });
    }

    toggleBtns.forEach(function (toggleBtn) {
      toggleBtn.addEventListener('click', function () {
        var isHidden = panel.style.display === 'none';
        panel.style.display = isHidden ? 'block' : 'none';
        toggleBtns.forEach(function (b) { b.classList.toggle('is-active', isHidden); });
        if (isHidden) {
          window.photoTrack && window.photoTrack('map_open', { points: points.length });
          initMap();
          panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
          setTimeout(function () { if (map) map.invalidateSize(); }, 0);
        }
      });
    });
  }());

  // ── v2: mobile "Filters ▾" strip toggles the unified filter bar (hidden on phones by default) ──
  (function () {
    var btn = document.getElementById('mobile-filters-btn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var open = document.body.classList.toggle('filters-open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }());

  // ── v2: "Want a shoot?" modal. Available on every page; auto-opens (5 s / after a screen of
  // scrolling, once per session) only when the page was requested with ?promo — same trigger as v1. ──
  (function () {
    var popup = document.getElementById('promo-popup');
    if (!popup) return;
    var closeBtn = document.getElementById('promo-popup-close');
    var footerBar = document.getElementById('promo-footer-bar');
    var form = document.getElementById('promo-form');
    var msgEl = document.getElementById('promo-form-msg');
    var successView = document.getElementById('promo-popup-success');
    var submitBtn = form ? form.querySelector('.inquiry-submit') : null;
    var seenKey = 'photoPromoPopupSeen';
    var autoShown = false;
    var timer = null;

    try { autoShown = !!sessionStorage.getItem(seenKey); } catch (e) {}

    function showPopup(trigger) {
      window.photoTrack && window.photoTrack('promo_open', { trigger: typeof trigger === 'string' ? trigger : 'button' });
      popup.classList.add('is-open');
      document.body.classList.remove('sidebar-open');
      var sb = document.getElementById('sidebar');
      if (sb) sb.classList.remove('open');
    }
    function closePopup() { popup.classList.remove('is-open'); }

    function autoOpen() {
      if (autoShown) return;
      autoShown = true;
      try { sessionStorage.setItem(seenKey, '1'); } catch (e) {}
      showPopup('auto');
      window.removeEventListener('scroll', onScroll);
      clearTimeout(timer);
    }
    function onScroll() { if (window.scrollY > window.innerHeight) autoOpen(); }

    if (popup.getAttribute('data-auto') === '1') {
      window.addEventListener('scroll', onScroll, { passive: true });
      timer = setTimeout(autoOpen, 5000);
    }

    document.addEventListener('click', function (e) {
      var opener = e.target.closest && e.target.closest('[data-open-promo]');
      if (opener) { e.preventDefault(); showPopup(opener.closest('.sidebar') ? 'sidebar' : 'hero'); }
    });
    if (footerBar) footerBar.addEventListener('click', function () { showPopup('bar'); });
    if (closeBtn) closeBtn.addEventListener('click', closePopup);
    popup.addEventListener('click', function (e) { if (e.target === popup) closePopup(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && popup.classList.contains('is-open')) { e.stopImmediatePropagation(); closePopup(); }
    }, true);

    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = form.name.value.trim();
      var contact = form.contact.value.trim();
      if (!name || !contact) { msgEl.textContent = form.getAttribute('data-err-required') || ''; msgEl.style.display = ''; return; }

      submitBtn.disabled = true;
      msgEl.style.display = 'none';
      fetch('/shoot-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          name: name,
          contact: contact,
          message: form.message.value.trim(),
          source: window.location.pathname,
        }),
      })
        .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
        .then(function (res) {
          submitBtn.disabled = false;
          if (!res.ok) { msgEl.textContent = form.getAttribute('data-err-network') || ''; msgEl.style.display = ''; return; }
          window.photoTrack && window.photoTrack('generate_lead', { form: 'shoot_request', source: location.pathname });
          form.style.display = 'none';
          successView.style.display = '';
        })
        .catch(function () {
          submitBtn.disabled = false;
          msgEl.textContent = form.getAttribute('data-err-network') || '';
          msgEl.style.display = '';
        });
    });
  }());

  window.sharePhoto = function () {
    window.photoTrack && window.photoTrack('share', Object.assign({ method: navigator.share ? 'web_share' : 'copy_link', content_type: 'photo' }, window.photoTrack.photo()));
    var title = document.title;
    var url = location.href;
    if (navigator.share) {
      navigator.share({ title: title, url: url }).catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(function () {
        var btn = document.querySelector('.action-btn[onclick="sharePhoto()"]');
        if (btn) {
          var orig = btn.textContent;
          btn.textContent = window.PhotoI18n.t.shareCopied;
          setTimeout(function () { btn.textContent = orig; }, 2000);
        }
      });
    }
  };
}());
