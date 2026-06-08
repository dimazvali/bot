var { FieldValue } = require('firebase-admin/firestore');

var _db = null;
var _env = null;

function init(db) {
  _db = db;
  _env = process.env.PHOTO_ENV || 'dev';
}

function parseDevice(ua) {
  if (!ua) return { deviceType: 'unknown', os: 'unknown', browser: 'unknown' };
  var isTablet  = /iPad|Tablet|PlayBook/i.test(ua);
  var isMobile  = !isTablet && /Mobile|Android|iPhone|iPod|Windows Phone/i.test(ua);
  var os = /Android/i.test(ua)           ? 'Android'
         : /iPhone|iPad|iPod/i.test(ua)  ? 'iOS'
         : /Windows/i.test(ua)           ? 'Windows'
         : /Mac OS X/i.test(ua)          ? 'macOS'
         : /Linux/i.test(ua)             ? 'Linux'
         : 'Other';
  var browser = /Edg\//i.test(ua)        ? 'Edge'
              : /YaBrowser/i.test(ua)    ? 'Yandex'
              : /OPR\//i.test(ua)        ? 'Opera'
              : /Chrome\//i.test(ua)     ? 'Chrome'
              : /Firefox\//i.test(ua)    ? 'Firefox'
              : /Safari\//i.test(ua)     ? 'Safari'
              : 'Other';
  return {
    deviceType: isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop',
    os,
    browser,
  };
}

function trackView(entityType, entityId, urlPath, req) {
  if (!_db) return;
  var ts = FieldValue.serverTimestamp();
  var doc = { env: _env, entityType, entityId, path: urlPath, timestamp: ts };
  if (req) {
    var ua = req.headers['user-agent'] || '';
    var device = parseDevice(ua);
    doc.deviceType = device.deviceType;
    doc.os         = device.os;
    doc.browser    = device.browser;
    var forwarded = req.headers['x-forwarded-for'];
    doc.ip = forwarded ? forwarded.split(',')[0].trim() : req.socket.remoteAddress;
    if (req.headers.referer) doc.referer = req.headers.referer;
  }
  _db.collection('photo_views').add(doc).catch(function (err) {
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
