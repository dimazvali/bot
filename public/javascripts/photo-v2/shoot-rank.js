// Shoot cards blocks with a limit (views/photo-v2/mixins.pug → shootCards): the server sends every
// candidate, most viewed first. Here shoots this visitor hasn't opened yet move to the front, keeping
// the server order inside both groups, and the first `data-limit` cards are shown — so once everything
// has been seen, the seen ones fill the block (no gaps).
// The script tag's data-current-shoot marks the shoot being viewed as seen (shoot gallery / shoot photo).
// localStorage only: per-visitor convenience, the page works the same without it.
(function () {
  var KEY = 'seenShoots';
  var seen = [];
  try { seen = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) {}
  if (!Array.isArray(seen)) seen = [];

  var me = document.currentScript;
  var current = me && me.dataset.currentShoot;
  if (current && seen.indexOf(current) === -1) {
    seen.push(current);
    try { localStorage.setItem(KEY, JSON.stringify(seen.slice(-500))); } catch (e) {}
  }

  document.querySelectorAll('.shoot-related[data-limit]').forEach(function (box) {
    var limit = parseInt(box.dataset.limit, 10) || 0;
    var cards = Array.prototype.slice.call(box.querySelectorAll('.shoot-related-card'));
    var fresh = cards.filter(function (c) { return seen.indexOf(c.dataset.slug) === -1; });
    var old = cards.filter(function (c) { return seen.indexOf(c.dataset.slug) !== -1; });
    fresh.concat(old).forEach(function (c, i) {
      box.appendChild(c);
      c.hidden = limit > 0 && i >= limit;
    });
  });
}());
