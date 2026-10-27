// Tabs of the admin edit pages (shoot-edit.pug, series-edit.pug).
//   nav: buttons [data-tab-btn=<name>]; content: any blocks [data-tab=<name>] — one group is shown at a time.
//   The URL hash picks the tab (#photos, #stats…; redirects rely on it); any other #id opens the tab containing it.
//   The first button is the default tab. [data-stats-url] (inside the "stats" tab) is fetched on first open as an
//   HTML fragment (views/photo/admin/_content-stats.pug); its [data-stats-days] links reload it for another period.
//   Fires 'admin-tab:shown' (detail = tab name) — e.g. a Leaflet map in a hidden tab needs invalidateSize().
(function() {
  var buttons = Array.from(document.querySelectorAll('[data-tab-btn]'));
  if (!buttons.length) return;
  var TABS = buttons.map(function(b) { return b.getAttribute('data-tab-btn'); });
  var DEFAULT = TABS[0];
  var blocks = Array.from(document.querySelectorAll('[data-tab]'));
  var statsBox = document.querySelector('[data-stats-url]');
  var statsDays = null;

  function loadStats(days) {
    if (!statsBox || statsDays === days) return;
    statsDays = days;
    statsBox.style.opacity = '.5';
    fetch(statsBox.getAttribute('data-stats-url') + '?days=' + days)
      .then(function(r) { return r.text(); })
      .then(function(html) { statsBox.innerHTML = html; })
      .catch(function() { statsBox.innerHTML = '<p class="admin-notice admin-notice--error">Ошибка сети</p>'; statsDays = null; })
      .finally(function() { statsBox.style.opacity = ''; });
  }
  if (statsBox) statsBox.addEventListener('click', function(e) {
    var a = e.target.closest('[data-stats-days]');
    if (!a) return;
    e.preventDefault();
    loadStats(parseInt(a.getAttribute('data-stats-days'), 10));
  });

  function show(tab, scrollTo) {
    if (TABS.indexOf(tab) === -1) tab = DEFAULT;
    buttons.forEach(function(b) { b.setAttribute('aria-selected', b.getAttribute('data-tab-btn') === tab ? 'true' : 'false'); });
    blocks.forEach(function(el) { el.hidden = el.getAttribute('data-tab') !== tab; });
    if (statsBox && statsBox.closest('[data-tab]') && statsBox.closest('[data-tab]').getAttribute('data-tab') === tab) loadStats(statsDays || 30);
    document.dispatchEvent(new CustomEvent('admin-tab:shown', { detail: tab }));
    if (scrollTo) scrollTo.scrollIntoView();
  }

  function fromHash() {
    var h = decodeURIComponent(location.hash.slice(1));
    if (TABS.indexOf(h) !== -1) return show(h);
    var el = h && document.getElementById(h);
    var block = el && el.closest('[data-tab]');
    show(block ? block.getAttribute('data-tab') : DEFAULT, el);
  }

  buttons.forEach(function(b) {
    b.addEventListener('click', function() {
      var tab = b.getAttribute('data-tab-btn');
      history.replaceState(null, '', tab === DEFAULT ? location.pathname + location.search : '#' + tab);
      show(tab);
    });
  });
  window.addEventListener('hashchange', fromHash);
  fromHash();
}());
