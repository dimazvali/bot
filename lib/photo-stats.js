var { FieldValue } = require('firebase-admin/firestore');

var _db = null;
var _env = null;

function init(db) {
  _db = db;
  _env = process.env.PHOTO_ENV || 'dev';
}

function trackView(entityType, entityId, urlPath) {
  if (!_db) return;
  var ts = FieldValue.serverTimestamp();
  _db.collection('photo_views').add({
    env: _env,
    entityType,
    entityId,
    path: urlPath,
    timestamp: ts,
  }).catch(function (err) {
    console.error('[photo-stats] view log error:', err.message);
  });
  var docId = _env + ':' + entityType + ':' + entityId.replace(/\//g, '_');
  _db.collection('photo_stats').doc(docId).set(
    { views: FieldValue.increment(1), updatedAt: ts, entityType, entityId, env: _env },
    { merge: true }
  ).catch(function (err) {
    console.error('[photo-stats] counter error:', err.message);
  });
}

module.exports = { init, trackView };
