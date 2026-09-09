var _db = null;
var _env = null;
var COL = 'photo_copyright_hits';

function init(db, env) {
  _db = db;
  _env = env || process.env.PHOTO_ENV || 'dev';
}

async function getHits({ onlyNew } = {}) {
  if (!_db) return [];
  var q = _db.collection(COL).where('env', '==', _env).orderBy('firstSeen', 'desc').limit(500);
  var snap = await q.get();
  var hits = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
  if (onlyNew) hits = hits.filter(function(h) { return !h.dismissed; });
  return hits;
}

async function dismissHit(id) {
  if (!_db) throw new Error('db not init');
  await _db.collection(COL).doc(id).update({ dismissed: true, dismissedAt: new Date() });
}

async function undismissHit(id) {
  if (!_db) throw new Error('db not init');
  await _db.collection(COL).doc(id).update({ dismissed: false, dismissedAt: null });
}

async function deleteHit(id) {
  if (!_db) throw new Error('db not init');
  await _db.collection(COL).doc(id).delete();
}

// photoId is only unique within a series/shoot, so scope by country/series too
// when the caller knows them (older hits may lack the fields — then fall back to
// photoId alone).
async function clearPhoto(photoId, countryKey, seriesKey) {
  if (!_db) throw new Error('db not init');
  var snap = await _db.collection(COL).where('env', '==', _env).where('photoId', '==', photoId).get();
  var batch = _db.batch();
  var n = 0;
  snap.docs.forEach(function(d) {
    var h = d.data();
    if (countryKey && h.countryKey && h.countryKey !== countryKey) return;
    if (seriesKey && h.seriesKey && h.seriesKey !== seriesKey) return;
    batch.delete(d.ref);
    n++;
  });
  await batch.commit();
  return n;
}

module.exports = { init, getHits, dismissHit, undismissHit, deleteHit, clearPhoto };
