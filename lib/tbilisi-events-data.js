'use strict';
var _db = null;

function init(db) {
  _db = db;
}

function eventsCollection() {
  return _db.collection('tbilisiEvents');
}

async function findByDedupeKey(dedupeKey) {
  var snap = await eventsCollection().where('dedupeKey', '==', dedupeKey).limit(1).get();
  if (snap.empty) return null;
  return Object.assign({ id: snap.docs[0].id }, snap.docs[0].data());
}

async function insertEvent(event) {
  var now = new Date();
  var doc = Object.assign({}, event, { createdAt: now, updatedAt: now });
  var ref = await eventsCollection().add(doc);
  return ref.id;
}

async function addSourceToEvent(id, source) {
  await _db.runTransaction(async function(t) {
    var ref = eventsCollection().doc(id);
    var snap = await t.get(ref);
    if (!snap.exists) return;
    var sources = snap.data().sources || [];
    var exists = sources.some(function(s) { return s.url === source.url; });
    if (!exists) sources.push(source);
    t.update(ref, { sources: sources, updatedAt: new Date() });
  });
}

async function getAllEvents() {
  var snap = await eventsCollection().orderBy('date').get();
  return snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
}

module.exports = { init, findByDedupeKey, insertEvent, addSourceToEvent, getAllEvents };
