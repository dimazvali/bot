// Unified gallery filters for the v2 redesign: type · colour · tag (filter bar) and person (shoot
// "find yourself" widget) combine — a frame stays visible only if it passes every active filter.
// Cards are hidden through the same `data-hidden` attribute v1 used, so the presentation mode
// (which skips [data-hidden] cards) keeps working unchanged.
(function () {
  var cards = Array.prototype.slice.call(document.querySelectorAll('.photo-card[data-photo-id]'));
  if (!cards.length) return;

  var state = { type: null, color: null, tag: null, person: null };
  var countEl = document.getElementById('fb-count-n');
  var emptyEl = document.getElementById('filter-empty');

  function csv(v) { return v ? v.split(',') : []; }

  function passes(card) {
    if (state.type && card.dataset.type !== state.type) return false;
    if (state.color && csv(card.dataset.colors).indexOf(state.color) === -1) return false;
    if (state.tag && csv(card.dataset.tags).indexOf(state.tag) === -1) return false;
    if (state.person && csv(card.dataset.personKeys).indexOf(state.person) === -1) return false;
    return true;
  }

  function apply() {
    var visible = 0;
    cards.forEach(function (card) {
      var ok = passes(card);
      card.toggleAttribute('data-hidden', !ok);
      if (ok && !card.hasAttribute('data-curator-hidden')) visible++;
    });
    if (countEl) countEl.textContent = visible;
    if (emptyEl) emptyEl.style.display = visible === 0 ? '' : 'none';
    // promo / subscribe tiles are pointless inside a filtered view
    document.querySelectorAll('.photo-card--promo, .action-card').forEach(function (el) {
      var filtered = !!(state.type || state.color || state.tag || state.person);
      el.style.display = filtered ? 'none' : '';
    });
  }

  function set(key, value) {
    state[key] = state[key] === value ? null : value; // clicking the active one clears it
    apply();
  }

  // ── type ──
  var typeBtns = document.querySelectorAll('.type-filter-btn');
  typeBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      set('type', btn.dataset.type);
      typeBtns.forEach(function (b) { b.classList.toggle('active', b.dataset.type === state.type); });
    });
  });

  // ── colour ──
  var colorBtns = document.querySelectorAll('.fb-color');
  colorBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      set('color', btn.dataset.color);
      colorBtns.forEach(function (b) { b.classList.toggle('is-active', b.dataset.color === state.color); });
    });
  });

  // ── tag dropdown ──
  var tagBtn = document.getElementById('fb-tag-btn');
  var tagMenu = document.getElementById('fb-tag-menu');
  var tagOpen = document.getElementById('fb-tag-open');
  if (tagBtn && tagMenu) {
    var baseLabel = tagBtn.getAttribute('data-label') || '';
    function closeMenu() { tagMenu.classList.remove('is-open'); tagBtn.setAttribute('aria-expanded', 'false'); }
    tagBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = tagMenu.classList.toggle('is-open');
      tagBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('click', function (e) { if (!tagMenu.contains(e.target)) closeMenu(); });
    tagMenu.querySelectorAll('.fb-tag-item').forEach(function (item) {
      item.addEventListener('click', function () {
        set('tag', item.dataset.tag);
        tagMenu.querySelectorAll('.fb-tag-item').forEach(function (i) { i.classList.toggle('is-active', i.dataset.tag === state.tag); });
        tagBtn.classList.toggle('is-active', !!state.tag);
        tagBtn.textContent = (state.tag ? item.textContent : baseLabel) + ' ▾';
        if (tagOpen) {
          tagOpen.style.display = state.tag ? '' : 'none';
          if (state.tag) tagOpen.setAttribute('href', item.dataset.href);
        }
        closeMenu();
      });
    });
  }

  // ── person ("find yourself" widget on a shoot) ──
  var widget = document.getElementById('faces-widget');
  if (widget) {
    var items = widget.querySelectorAll('.faces-widget-item');
    var resetBtn = widget.querySelector('.faces-widget-reset');

    function applyPerson(key) {
      state.person = key;
      if (key) widget.setAttribute('data-active', ''); else widget.removeAttribute('data-active');
      items.forEach(function (el) { el.classList.toggle('is-active', el.dataset.personKey === key); });
      apply();
    }
    function pushPerson(key) {
      var url = new URL(window.location.href);
      if (key) url.searchParams.set('person', key); else url.searchParams.delete('person');
      history.pushState({}, '', url);
    }
    items.forEach(function (el) {
      el.addEventListener('click', function () {
        var key = state.person === el.dataset.personKey ? null : el.dataset.personKey;
        applyPerson(key);
        pushPerson(key);
      });
    });
    if (resetBtn) resetBtn.addEventListener('click', function () { applyPerson(null); pushPerson(null); });

    var initial = new URLSearchParams(window.location.search).get('person');
    if (initial) applyPerson(initial);
  }

  // ── reset from the empty state ──
  var resetAll = document.getElementById('filter-reset');
  if (resetAll) {
    resetAll.addEventListener('click', function () {
      state.type = state.color = state.tag = null;
      typeBtns.forEach(function (b) { b.classList.remove('active'); });
      colorBtns.forEach(function (b) { b.classList.remove('is-active'); });
      if (tagBtn) { tagBtn.classList.remove('is-active'); tagBtn.textContent = (tagBtn.getAttribute('data-label') || '') + ' ▾'; }
      if (tagMenu) tagMenu.querySelectorAll('.fb-tag-item').forEach(function (i) { i.classList.remove('is-active'); });
      if (tagOpen) tagOpen.style.display = 'none';
      apply();
    });
  }

  window.PhotoFilters = { apply: apply, state: state };
}());
