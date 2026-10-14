// Drag-and-drop face groups board (admin): markup in views/photo/admin/_face-board.pug.
// Drag a group's circle onto another group → merge into one person (/admin/faces/merge);
// drag a single face (inside an opened group) onto a group or "new group" → move it (/admin/faces/move).
// The page reloads after each change and comes back to the same scroll position.
(function () {
  try {
    var y = sessionStorage.getItem('fgScroll');
    if (y) { sessionStorage.removeItem('fgScroll'); window.scrollTo(0, +y); }
  } catch (e) {}

  var board = document.getElementById('fg-board');
  if (!board) return;
  var drag = null; // { type: 'group', ref, name, tile } | { type: 'face', faceId }

  function ref(tile) { return { key: tile.dataset.key, slug: tile.dataset.slug || null }; }

  board.querySelectorAll('.fg-toggle').forEach(function (b) {
    b.addEventListener('click', function () { b.closest('.fg-tile').classList.toggle('is-open'); });
  });

  board.addEventListener('dragstart', function (e) {
    var face = e.target.closest('.fg-face');
    var avatar = e.target.closest('.fg-avatar');
    if (face) {
      drag = { type: 'face', faceId: face.dataset.faceId };
    } else if (avatar && avatar.closest('.fg-tile:not(.fg-new)')) {
      var tile = avatar.closest('.fg-tile');
      drag = { type: 'group', ref: ref(tile), name: tile.dataset.name, tile: tile };
      tile.classList.add('is-dragging');
    } else {
      return;
    }
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', 'face-group'); // Firefox needs some data to start a drag
  });

  board.addEventListener('dragend', function () {
    if (drag && drag.tile) drag.tile.classList.remove('is-dragging');
    board.querySelectorAll('.is-over').forEach(function (t) { t.classList.remove('is-over'); });
    drag = null;
  });

  function target(e) {
    var tile = e.target.closest('.fg-tile');
    if (!tile || !drag) return null;
    if (drag.type === 'group' && (tile === drag.tile || tile.dataset.key === 'new')) return null;
    return tile;
  }

  board.addEventListener('dragover', function (e) {
    var tile = target(e);
    if (!tile) return;
    e.preventDefault();
    board.querySelectorAll('.is-over').forEach(function (t) { if (t !== tile) t.classList.remove('is-over'); });
    tile.classList.add('is-over');
  });

  board.addEventListener('dragleave', function (e) {
    var tile = e.target.closest('.fg-tile');
    if (tile && !tile.contains(e.relatedTarget)) tile.classList.remove('is-over');
  });

  board.addEventListener('drop', function (e) {
    var tile = target(e);
    if (!tile) return;
    e.preventDefault();
    var d = drag, url, body;
    if (d.type === 'group') {
      var a = d.name, b = tile.dataset.name;
      if (a && b && a !== b && !confirm('Объединить «' + a + '» и «' + b + '» в одного человека? Объединится во всех съёмках.')) return;
      url = board.dataset.mergeUrl; body = { from: d.ref, to: ref(tile) };
    } else {
      url = board.dataset.moveUrl; body = { faceId: d.faceId, to: tile.dataset.key === 'new' ? 'new' : ref(tile) };
    }
    board.style.opacity = '.5';
    board.style.pointerEvents = 'none';
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (r) {
        if (!r.ok) throw new Error(r.error || 'ошибка');
        try { sessionStorage.setItem('fgScroll', String(window.scrollY)); } catch (e) {}
        location.reload();
      })
      .catch(function (err) {
        board.style.opacity = '';
        board.style.pointerEvents = '';
        alert('Не получилось: ' + err.message);
      });
  });
}());
