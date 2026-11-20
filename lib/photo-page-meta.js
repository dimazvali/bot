'use strict';

// Editable <title> + meta description of the main static pages of photo.dimazvali.com (home, about, shoots list),
// RU and EN. Stored in Firestore `photoPageMeta/{env}` = { ru: { home: { title, desc }, ... }, en: {...}, updatedAt },
// kept in memory and read by routes/photo.js. Only overrides are stored: a field that is empty or equal to the
// built-in default below is dropped on save, so the site renders the defaults until something is changed.
// Without a Firestore handle (local fixture preview) it simply lives in memory. Same shape as lib/photo-site-texts.js.
var COLLECTION = 'photoPageMeta';
var FIELDS = ['title', 'desc'];
var MAX_LEN = { title: 200, desc: 500 };

// The values routes/photo.js used to hard-code — what the site shows when nothing was saved.
var PAGES = [
  { key: 'home', label: 'Главная', path: '/' },
  { key: 'about', label: 'О себе', path: '/about' },
  { key: 'shoots', label: 'Съёмки', path: '/shoot' },
];
var DEFAULTS = {
  ru: {
    home: { title: 'photo.dimazvali.com', desc: 'Фотография — Дмитрий Шестаков. Серийная документальная фотография и портреты.' },
    about: { title: 'О себе — photo.dimazvali.com', desc: 'Дмитрий Шестаков — фотограф. Снимаю документальные серии и портреты.' },
    shoots: { title: 'Съёмки — photo.dimazvali.com', desc: 'Открытые съёмки — Дмитрий Шестаков' },
  },
  en: {
    home: { title: 'photo.dimazvali.com', desc: 'Photography — Dmitry Shestakov. Documentary series and portraits.' },
    about: { title: 'About — photo.dimazvali.com', desc: 'Dmitry Shestakov — photographer. I shoot documentary series and portraits.' },
    shoots: { title: 'Shoots — photo.dimazvali.com', desc: 'Open shoots — Dmitry Shestakov' },
  },
};

var _db = null;
var _env = 'dev';
var _cache = { ru: {}, en: {} };

function langOf(lang) { return lang === 'en' ? 'en' : 'ru'; }

function normalize(raw) {
  var out = { ru: {}, en: {} };
  ['ru', 'en'].forEach(function(lang) {
    PAGES.forEach(function(p) {
      var src = (raw && raw[lang] && raw[lang][p.key]) || {};
      FIELDS.forEach(function(f) {
        var v = typeof src[f] === 'string' ? src[f].trim().slice(0, MAX_LEN[f]) : '';
        if (v && v !== DEFAULTS[lang][p.key][f]) {
          out[lang][p.key] = out[lang][p.key] || {};
          out[lang][p.key][f] = v;
        }
      });
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
    console.log('[photo-page-meta] loaded (env=' + _env + ')');
  } catch (e) {
    console.error('[photo-page-meta] load failed:', e.message);
  }
}

// { title, desc } actually used for the page: the saved override, else the default
function get(lang, pageKey) {
  var l = langOf(lang);
  var def = DEFAULTS[l][pageKey];
  if (!def) throw new Error('photo-page-meta: unknown page ' + pageKey);
  return Object.assign({}, def, _cache[l][pageKey] || {});
}

// only the overridden fields, for the admin form ({} when the page uses its defaults)
function overrides(lang, pageKey) {
  return Object.assign({}, _cache[langOf(lang)][pageKey] || {});
}

async function save(raw) {
  var next = normalize(raw);
  if (_db) {
    await _db.collection(COLLECTION).doc(_env).set(Object.assign({}, next, { updatedAt: new Date().toISOString() }));
  }
  _cache = next;
  return next;
}

module.exports = {
  PAGES: PAGES, FIELDS: FIELDS, MAX_LEN: MAX_LEN, DEFAULTS: DEFAULTS,
  init: init, get: get, overrides: overrides, save: save,
};
