'use strict';

// Editable copy of the v2 redesign (home hero kicker + lead, RU and EN).
// Stored in Firestore `photoSiteTexts/{env}` = { ru: {...}, en: {...}, updatedAt }, kept in memory and
// used by routes/photo-v2.js. An empty value means "use the built-in default from lib/photo-v2-strings.js",
// so the site renders fine before anything was ever saved. Without a Firestore handle (local fixture
// preview) it simply lives in memory.
var COLLECTION = 'photoSiteTexts';
var KEYS = ['homeKicker', 'homeLead'];
var MAX_LEN = 1000;

var _db = null;
var _env = 'dev';
var _cache = { ru: {}, en: {} };

function normalize(raw) {
  var out = { ru: {}, en: {} };
  ['ru', 'en'].forEach(function(lang) {
    var src = (raw && raw[lang]) || {};
    KEYS.forEach(function(k) {
      var v = typeof src[k] === 'string' ? src[k].trim().slice(0, MAX_LEN) : '';
      if (v) out[lang][k] = v;
    });
  });
  return out;
}

async function init(db, env) {
  _db = db || null;
  _env = env || process.env.PHOTO_ENV || 'dev';
  if (!_db) return;
  try {
    var doc = await _db.collection(COLLECTION).doc(_env).get();
    if (doc.exists) _cache = normalize(doc.data());
    console.log('[photo-site-texts] loaded (env=' + _env + ')');
  } catch (e) {
    console.error('[photo-site-texts] load failed:', e.message);
  }
}

// { homeKicker?, homeLead? } for the language — only the keys that were overridden
function get(lang) {
  return _cache[lang === 'en' ? 'en' : 'ru'];
}

async function save(raw) {
  var next = normalize(raw);
  if (_db) {
    await _db.collection(COLLECTION).doc(_env).set(Object.assign({}, next, { updatedAt: new Date().toISOString() }));
  }
  _cache = next;
  return next;
}

module.exports = { KEYS: KEYS, MAX_LEN: MAX_LEN, init: init, get: get, save: save };
