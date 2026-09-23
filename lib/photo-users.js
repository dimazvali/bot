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

module.exports = { init, upsertSubscriber, unsubscribe, unsubscribeByToken, getSubscribers, listAll, toggleActive };
