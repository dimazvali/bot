// Firestore is the sole source of truth — no local file, no fallback. An env
// with no 'tags' docs yet just starts empty; populate it via the admin UI.
var _cache = null;
var _db = null;
var _env = null;

async function _syncTagsToFirestore(obj) {
  var snap = await _db.collection('tags').where('env', '==', _env).get();
  var newIds = new Set(Object.keys(obj).map(function (k) { return _env + '_' + k; }));

  var batch = _db.batch();
  var ops = 0;

  snap.docs.forEach(function (doc) {
    if (!newIds.has(doc.id)) {
      batch.delete(doc.ref);
      ops++;
    }
  });

  for (var key of Object.keys(obj)) {
    batch.set(_db.collection('tags').doc(_env + '_' + key), {
      key,
      env: _env,
      label: obj[key].label,
      label_en: obj[key].label_en || '',
      type: obj[key].type || 'misc',
      desc: obj[key].desc || '',
      desc_en: obj[key].desc_en || '',
    });
    ops++;
  }

  if (ops > 0) await batch.commit();
}

async function initTagsFromFirestore(db) {
  _db = db;
  _env = process.env.PHOTO_ENV || 'dev';
  try {
    var snap = await db.collection('tags').where('env', '==', _env).get();
    if (snap.empty) {
      _cache = {};
      console.log('[photo-tags] no tags for env=' + _env + ' yet — starting empty');
    } else {
      _cache = {};
      snap.forEach(function (doc) {
        var d = doc.data();
        _cache[d.key] = { label: d.label, label_en: d.label_en || '', type: d.type || 'misc', desc: d.desc || '', desc_en: d.desc_en || '' };
      });
      console.log('[photo-tags] loaded from Firestore (env=' + _env + ', tags=' + snap.size + ')');
    }
  } catch (err) {
    console.error('[photo-tags] Firestore init error:', err.message);
    if (!_cache) _cache = {};
  }
}

function getTags() {
  return _cache || {};
}

function saveTags(obj) {
  _cache = obj;
  if (_db) {
    _syncTagsToFirestore(obj).catch(function (err) {
      console.error('[photo-tags] Firestore save error:', err.message);
    });
  }
}

module.exports = { getTags, saveTags, initTagsFromFirestore };
