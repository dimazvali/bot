(function() {
  'use strict';
  var DICT = window.QR_INDEX_DICT || {};
  var ENTRY_COUNT = window.QR_INDEX_ENTRY_COUNT || 0;

  function pluralRu(n, one, few, many) {
    var mod10 = n % 10, mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
    return many;
  }

  // Mirrors lib/qr-index-dict.js's countText — duplicated (not shared) since
  // that copy runs server-side only; kept deliberately tiny to stay in sync.
  function countText(lang) {
    var n = ENTRY_COUNT;
    if (lang === 'ru') return n + ' ' + pluralRu(n, 'точка', 'точки', 'точек') + ' · Тбилиси';
    if (lang === 'ka') return n + ' წერტილი · თბილისი';
    return n + ' ' + (n === 1 ? 'point' : 'points') + ' · Tbilisi';
  }

  function resolve(obj, path) {
    return path.split('.').reduce(function(o, k) { return o == null ? undefined : o[k]; }, obj);
  }

  function applyLang(lang) {
    var t = DICT[lang] || DICT.ru;
    if (!t) return;
    document.querySelectorAll('[data-i18n]').forEach(function(el) {
      var key = el.getAttribute('data-i18n');
      var val = key === '__count' ? countText(lang) : resolve(t, key);
      if (val != null) el.textContent = val;
    });
    document.documentElement.lang = lang === 'ka' ? 'ka' : lang;
    document.querySelectorAll('[data-lang-tab]').forEach(function(btn) {
      var on = btn.getAttribute('data-lang-tab') === lang;
      btn.style.background = on ? '#17140f' : 'transparent';
      btn.style.color = on ? '#f6f0e2' : '#8a7c62';
    });
    try { localStorage.setItem('qrLang', lang); } catch (e) { /* private mode etc — fine to skip */ }
  }

  document.querySelectorAll('[data-lang-tab]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      applyLang(btn.getAttribute('data-lang-tab'));
    });
  });

  var saved = null;
  try { saved = localStorage.getItem('qrLang'); } catch (e) { /* fine, just stay on the server-rendered default */ }
  if (saved && DICT[saved]) applyLang(saved);

  var points = window.QR_MAP_POINTS;
  var mapEl = document.getElementById('arMap');
  if (points && points.length && mapEl && window.L) {
    var map = L.map('arMap', { scrollWheelZoom: false, zoomControl: true });
    var tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors', maxZoom: 19,
    }).addTo(map);
    var markers = points.map(function(p) {
      var m = L.marker([p.lat, p.lng], {
        icon: L.divIcon({ className: '', html: '<div class="ar-pin"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }),
      }).addTo(map);
      m.bindPopup(
        '<div style="font-family:\'PT Serif\',Georgia,serif;font-size:16px">' + p.title + '</div>' +
        '<div style="font:11px/1 \'IBM Plex Mono\',monospace;letter-spacing:.08em;color:#8a7f72;margin-top:5px">' + (p.year || '') + '</div>' +
        '<a href="/' + p.slug + '" style="display:inline-block;margin-top:9px;font:11px/1 \'IBM Plex Mono\',monospace;letter-spacing:.08em;text-transform:uppercase;color:#b03e18">открыть →</a>'
      );
      return m;
    });
    if (markers.length > 1) {
      map.fitBounds(L.featureGroup(markers).getBounds().pad(0.4));
    } else {
      map.setView([points[0].lat, points[0].lng], 16);
    }
    // leaflet.css loads async (a <link>, not blocking the script that
    // follows it) — if it's still applying when L.map() first measures the
    // container, tiles get positioned for the wrong size and the map looks
    // blank until an interaction forces a relayout. Re-measure once the
    // stylesheet is definitely in, and again after full page load as a
    // fallback for slower connections.
    setTimeout(function() { map.invalidateSize(); }, 0);
    window.addEventListener('load', function() { map.invalidateSize(); });
  }
})();
