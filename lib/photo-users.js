'use strict';
var crypto = require('crypto');
var { FieldValue } = require('firebase-admin/firestore');

var _db = null;

function init(db) { _db = db; }

async function upsertSubscriber({ googleId, email, name, picture }) {
  var col = _db.collection('photo_users');
  var snap = await col.where('googleId', '==', googleId).limit(1).get();
  if (!snap.empty) {
    await snap.docs[0].ref.update({ email, name, picture, active: true, updatedAt: FieldValue.serverTimestamp() });
    return;
  }
  var token = crypto.randomBytes(24).toString('hex');
  await col.add({ googleId, email, name, picture, token, active: true, createdAt: FieldValue.serverTimestamp() });
}

async function unsubscribe(googleId) {
  var col = _db.collection('photo_users');
  var snap = await col.where('googleId', '==', googleId).limit(1).get();
  if (snap.empty) return false;
  await snap.docs[0].ref.update({ active: false });
  return true;
}

async function unsubscribeByToken(token) {
  var col = _db.collection('photo_users');
  var snap = await col.where('token', '==', token).limit(1).get();
  if (snap.empty) return false;
  await snap.docs[0].ref.update({ active: false });
  return true;
}

async function getSubscribers() {
  var snap = await _db.collection('photo_users').where('active', '==', true).get();
  return snap.docs.map(function(d) { return d.data(); });
}

async function listAll() {
  var snap = await _db.collection('photo_users').orderBy('createdAt', 'desc').get();
  return snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
}

async function toggleActive(id) {
  var ref = _db.collection('photo_users').doc(id);
  var doc = await ref.get();
  if (!doc.exists) return false;
  await ref.update({ active: !doc.data().active });
  return true;
}

function toMs(v) {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  return v.toMillis ? v.toMillis() : 0;
}

// One list of everyone who signed in on the site, newest activity first.
//   googleUsers – photo_users docs; tgUsers – photoTgUsers docs (lib/photo-tg-login.js);
//   downloads – lib/photo-downloads.js byUser() (also fills in Telegram visitors from before photoTgUsers)
// → [{ via, id, name, contact, picture, firstMs, lastMs, downloads }]
function mergeAuthorized(googleUsers, tgUsers, downloads) {
  downloads = downloads || {};
  var rows = {};
  (googleUsers || []).forEach(function(u) {
    if (!u.googleId) return;
    rows['google~' + u.googleId] = {
      via: 'google', id: u.googleId, name: u.name || '', contact: u.email || '', picture: u.picture || null,
      firstMs: toMs(u.createdAt), lastMs: toMs(u.updatedAt) || toMs(u.createdAt), downloads: 0,
    };
  });
  (tgUsers || []).forEach(function(u) {
    if (!u.tgId) return;
    rows['telegram~' + u.tgId] = {
      via: 'telegram', id: u.tgId, name: u.name || '', contact: u.username ? '@' + u.username : '', picture: null,
      firstMs: toMs(u.createdAt), lastMs: toMs(u.lastLoginAt), downloads: 0,
    };
  });
  Object.keys(downloads).forEach(function(key) {
    var d = downloads[key];
    var row = rows[key];
    if (!row) {
      var u = d.user;
      row = rows[key] = {
        via: u.via, id: u.id, name: u.name || '', picture: null, firstMs: 0, lastMs: 0, downloads: 0,
        contact: u.via === 'telegram' ? (u.username ? '@' + u.username : '') : (u.email || ''),
      };
    }
    row.downloads = d.count;
    if (d.lastMs > row.lastMs) row.lastMs = d.lastMs;
  });
  return Object.values(rows).sort(function(a, b) { return b.lastMs - a.lastMs; });
}

module.exports = { init, upsertSubscriber, unsubscribe, unsubscribeByToken, getSubscribers, listAll, toggleActive, mergeAuthorized };
