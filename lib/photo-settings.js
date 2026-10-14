'use strict';
// Small admin-editable flags for photo.dimazvali.com, one Firestore doc per env:
// photoSettings/<env>. Cached in memory; get() returns DEFAULTS until init finishes.
var DEFAULTS = {
  seoTgPreview: true, // TEMPORARY: Telegram preview of each generated SEO caption (lib/photo-seo-tg-preview.js)
};

var _db = null;
var _cache = Object.assign({}, DEFAULTS);

function getEnv() { return process.env.PHOTO_ENV || 'prod'; }

async function initFromFirestore(db) {
  _db = db;
  var doc = await db.collection('photoSettings').doc(getEnv()).get();
  _cache = Object.assign({}, DEFAULTS, doc.exists ? doc.data() : {});
}

function get(key) { return _cache[key]; }

async function set(key, value) {
  if (!(key in DEFAULTS)) throw new Error('Unknown setting: ' + key);
  _cache[key] = value;
  if (_db) await _db.collection('photoSettings').doc(getEnv()).set({ [key]: value }, { merge: true });
}

module.exports = { initFromFirestore, get, set };
