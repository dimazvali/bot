'use strict';

// Download counters + Telegram heads-up for shoot downloads on photo.dimazvali.com.
//
// Counted (only COMPLETED responses — the zip stream ended / the JPG was fully sent, an aborted download
// never reaches 'finish'):
//   zip   – the archive with all frames of a shoot        (GET /shoot/:slug/download)
//   sel   – the archive of the frames a client selected   (GET /shoot/:slug/download?ids=a,b,c)
//   ig    – the 2400px JPG "for Instagram" of one frame    (GET /shoot/:slug/:id/download-instagram)
// Not counted: crawlers, the logged-in owner, wrong-password responses (they are HTML, not a file).
//
// Storage: Firestore `photoDownloads` (one small doc per download — analysis) and `photoDownloadStats/{env}`
// (running counters: zip~slug, sel~slug, ig~slug~photoId), mirrored in memory so admins see the numbers on
// the pages without a query. Kept apart from photo_views/photo_stats on purpose: /admin/stats sums those
// into "page views", downloads would inflate them.
//
// Telegram (same bot/chat as the other photo alerts): production host only, deduped per kind+shoot+visitor
// for 30 minutes, at most 20 messages an hour.
var { BOT_UA_RE } = require('./photo-stats');
var telegram = require('./photo-404');

var LOG = 'photoDownloads';
var STATS = 'photoDownloadStats';
var DEDUPE_MS = 30 * 60 * 1000;
var WINDOW_MS = 60 * 60 * 1000;
var MAX_PER_WINDOW = 20;

var ZIP_RE = /^(?:\/en)?\/shoot\/([^/]+)\/download$/;
var IG_RE = /^(?:\/en)?\/shoot\/([^/]+)\/([^/]+)\/download-instagram$/;

var _db = null;
var _env = 'dev';
var _counts = {};
var _seen = new Map();
var _sent = [];

async function init(db, env) {
  _db = db || null;
  _env = env || process.env.PHOTO_ENV || 'dev';
  if (!_db) return;
  try {
    var doc = await _db.collection(STATS).doc(_env).get();
    _counts = doc.exists ? doc.data() : {};
    console.log('[photo-downloads] loaded (env=' + _env + ')');
  } catch (e) {
    console.error('[photo-downloads] load failed:', e.message);
  }
}

// numbers for one shoot (and, when photoId is given, for that frame's Instagram JPG)
function stats(slug, photoId) {
  var out = { zip: _counts['zip~' + slug] || 0, sel: _counts['sel~' + slug] || 0, ig: 0, igPhoto: 0 };
  var prefix = 'ig~' + slug + '~';
  Object.keys(_counts).forEach(function(k) { if (k.indexOf(prefix) === 0) out.ig += _counts[k] || 0; });
  if (photoId) out.igPhoto = _counts[prefix + photoId] || 0;
  return out;
}

function bump(key) {
  _counts[key] = (_counts[key] || 0) + 1;
  if (!_db) return;
  var { FieldValue } = require('firebase-admin/firestore');
  var patch = {}; patch[key] = FieldValue.increment(1);
  _db.collection(STATS).doc(_env).set(patch, { merge: true }).catch(function(e) { console.error('[photo-downloads] counter:', e.message); });
}

function deviceOf(ua) {
  return /iPad|Tablet/i.test(ua) ? 'tablet' : /Mobile|Android|iPhone/i.test(ua) ? 'mobile' : 'desktop';
}

function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function isProductionHost(req) { return /^photo\.(?!localhost)/i.test(req.hostname || ''); }

// kind: 'zip' | 'sel' | 'ig'; shoot: the shoot object; info: { count, photo }
function record(req, kind, slug, shoot, info, opts) {
  opts = opts || {};
  info = info || {};
  var ua = req.headers['user-agent'] || '';
  if (opts.isAdmin || !ua || BOT_UA_RE.test(ua)) return false;

  var photoId = info.photo ? info.photo.id : null;
  bump(kind + '~' + slug + (photoId ? '~' + photoId : ''));
  if (_db) {
    var { FieldValue } = require('firebase-admin/firestore');
    _db.collection(LOG).add({
      env: _env, kind: kind, slug: slug, photoId: photoId, count: info.count || null,
      timestamp: FieldValue.serverTimestamp(), deviceType: deviceOf(ua),
      referer: req.headers.referer || null,
    }).catch(function(e) { console.error('[photo-downloads] log:', e.message); });
  }

  if (!isProductionHost(req)) return true;
  var now = Date.now();
  var who = (req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || '').toString().split(',')[0].trim();
  var key = kind + '|' + slug + '|' + who;
  var last = _seen.get(key);
  if (last && now - last < DEDUPE_MS) return true;
  _sent = _sent.filter(function(t) { return now - t < WINDOW_MS; });
  if (_sent.length >= MAX_PER_WINDOW) return true;
  _seen.set(key, now); _sent.push(now);
  if (_seen.size > 500) _seen.forEach(function(t, k) { if (now - t > DEDUPE_MS) _seen.delete(k); });

  var label = shoot ? (shoot.label || slug) : slug;
  var s = stats(slug, photoId);
  var title;
  if (kind === 'zip') title = '⬇️ Скачали архив всех кадров';
  else if (kind === 'sel') title = '⬇️ Скачали выбранные кадры (' + (info.count || '?') + ' из ' + (shoot ? shoot.photos.length : '?') + ')';
  else title = '⬇️ Скачали кадр для Instagram';
  var text = '<b>' + title + '</b>\n'
    + 'Съёмка: ' + esc(label)
    + (info.photo ? '\nКадр: ' + esc(info.photo.title || info.photo.id) : '')
    + '\n\nУстройство: ' + deviceOf(ua)
    + '\nВсего по съёмке: архивов ' + s.zip + ', подборок ' + s.sel + ', кадров для Instagram ' + s.ig;
  Promise.resolve((opts.send || telegram.sendTelegram)(text)).catch(function() {});
  return true;
}

// Express middleware factory: lets the original handler in routes/photo.js do the work and counts the
// download only once the response really was a file that finished sending.
function middleware(kind, getShoot, opts) {
  opts = opts || {};
  return function(req, res, next) {
    var m = req.path.match(kind === 'ig' ? IG_RE : ZIP_RE);
    if (!m) return next();
    var slug = m[1], photoId = kind === 'ig' ? m[2] : null;
    res.on('finish', function() {
      if (res.statusCode !== 200) return;
      var ct = String(res.getHeader('Content-Type') || '');
      if (kind === 'ig' ? ct.indexOf('image/jpeg') === -1 : ct.indexOf('application/zip') === -1) return; // e.g. the password page
      var shoot = getShoot(slug);
      if (!shoot) return;
      if (kind === 'ig') {
        var photo = (shoot.photos || []).find(function(p) { return p.id === photoId; });
        return record(req, 'ig', slug, shoot, { photo: photo || { id: photoId } }, { isAdmin: !!res.locals.isAdmin, send: opts.send });
      }
      var ids = req.query.ids ? String(req.query.ids).split(',').map(function(x) { return x.trim(); }).filter(Boolean) : null;
      if (ids) {
        var valid = {}; (shoot.photos || []).forEach(function(p) { valid[p.id] = true; });
        var n = ids.filter(function(id) { return valid[id]; }).length;
        return record(req, 'sel', slug, shoot, { count: n }, { isAdmin: !!res.locals.isAdmin, send: opts.send });
      }
      record(req, 'zip', slug, shoot, { count: (shoot.photos || []).length }, { isAdmin: !!res.locals.isAdmin, send: opts.send });
    });
    next();
  };
}

module.exports = { init: init, stats: stats, middleware: middleware, record: record };
