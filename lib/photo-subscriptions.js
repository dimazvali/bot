var crypto = require('crypto');
var { FieldValue } = require('firebase-admin/firestore');

var _db = null;

function init(db) { _db = db; }

async function subscribe(email) {
  var col = _db.collection('photo_subscribers');
  var existing = await col.where('email', '==', email).limit(1).get();
  if (!existing.empty) {
    var doc = existing.docs[0];
    if (doc.data().active) return 'already';
    await doc.ref.update({ active: true });
    return 'ok';
  }
  var token = crypto.randomBytes(24).toString('hex');
  await col.add({ email, token, active: true, createdAt: FieldValue.serverTimestamp() });
  return 'ok';
}

async function unsubscribe(token) {
  var snap = await _db.collection('photo_subscribers').where('token', '==', token).limit(1).get();
  if (snap.empty) return false;
  await snap.docs[0].ref.update({ active: false });
  return true;
}

async function getSubscribers() {
  var snap = await _db.collection('photo_subscribers').where('active', '==', true).get();
  return snap.docs.map(d => d.data());
}

async function listAll() {
  var snap = await _db.collection('photo_subscribers').orderBy('createdAt', 'desc').get();
  return snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
}

async function toggleActive(id) {
  var ref = _db.collection('photo_subscribers').doc(id);
  var doc = await ref.get();
  if (!doc.exists) return false;
  await ref.update({ active: !doc.data().active });
  return true;
}

module.exports = { init, subscribe, unsubscribe, getSubscribers, listAll, toggleActive };
