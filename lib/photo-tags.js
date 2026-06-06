var fs = require('fs');
var path = require('path');

var TAGS_PATH = path.join(__dirname, '../data/photo-tags.json');
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
      _cache = JSON.parse(fs.readFileSync(TAGS_PATH, 'utf8'));
      await _syncTagsToFirestore(_cache);
      console.log('[photo-tags] seeded flat Firestore (env=' + _env + ')');
    } else {
      _cache = {};
      snap.forEach(function (doc) {
        var d = doc.data();
        _cache[d.key] = { label: d.label };
      });
      console.log('[photo-tags] loaded from Firestore (env=' + _env + ', tags=' + snap.size + ')');
    }
  } catch (err) {
    console.error('[photo-tags] Firestore init error, using local file:', err.message);
    if (!_cache) _cache = JSON.parse(fs.readFileSync(TAGS_PATH, 'utf8'));
  }
}

function getTags() {
  if (!_cache) _cache = JSON.parse(fs.readFileSync(TAGS_PATH, 'utf8'));
  return _cache;
}

function saveTags(obj) {
  _cache = obj;
  fs.writeFileSync(TAGS_PATH, JSON.stringify(obj, null, 2), 'utf8');
  if (_db) {
    _syncTagsToFirestore(obj).catch(function (err) {
      console.error('[photo-tags] Firestore save error:', err.message);
    });
  }
}

module.exports = { getTags, saveTags, initTagsFromFirestore };
