'use strict';
var builtinSources = require('./tbilisi-events-sources');
var VALID_SOURCE_TYPES = ['telegram', 'website', 'facebook', 'facebook_group', 'instagram', 'tkt'];

var _db = null;

function init(db) {
  _db = db;
}

function eventsCollection() {
  return _db.collection('tbilisiEvents');
}

function sourcesCollection() {
  return _db.collection('tbilisiEventsSources');
}

function sourceKey(type, value) {
  return type + '::' + String(value).trim().toLowerCase();
}

async function getCustomSources() {
  var snap = await sourcesCollection().get();
  return snap.docs.map(function(d) { return Object.assign({ id: d.id, custom: true }, d.data()); });
}

async function getAllSources() {
  var custom = await getCustomSources();
  return builtinSources.concat(custom);
}

async function addSource(source) {
  var type = source.type;
  var value = (source.value || '').trim();
  var label = (source.label || '').trim() || value;
  if (VALID_SOURCE_TYPES.indexOf(type) === -1) throw new Error('Неизвестный тип источника: ' + type);
  if (!value) throw new Error('Укажите значение источника');

  var all = await getAllSources();
  var key = sourceKey(type, value);
  var dup = all.some(function(s) { return sourceKey(s.type, s.value) === key; });
  if (dup) throw new Error('Такой источник уже добавлен');

  var doc = { type: type, value: value, label: label, createdAt: new Date() };
  var ref = await sourcesCollection().add(doc);
  return Object.assign({ id: ref.id, custom: true }, doc);
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

async function getEventsByDate(date) {
  var snap = await eventsCollection().where('date', '==', date).get();
  return snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
}

function logsCollection() {
  return _db.collection('tbilisiEventsLogs');
}

async function addLog(summary) {
  var doc = Object.assign({}, summary, { createdAt: new Date() });
  await logsCollection().add(doc);
}

async function getRecentLogs(limitCount) {
  var snap = await logsCollection().orderBy('createdAt', 'desc').limit(limitCount || 20).get();
  return snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
}

module.exports = { init, findByDedupeKey, insertEvent, addSourceToEvent, getAllEvents, getEventsByDate, getAllSources, addSource, addLog, getRecentLogs };
