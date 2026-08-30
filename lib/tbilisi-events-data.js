'use strict';
var builtinSources = require('./tbilisi-events-sources');
var VALID_SOURCE_TYPES = ['telegram', 'website', 'facebook', 'facebook_group', 'instagram', 'tkt'];
var URL_SOURCE_TYPES = ['website', 'facebook', 'facebook_group', 'instagram'];

var _db = null;

function init(db) { _db = db; }

function eventsCollection() { return _db.collection('tbilisiEvents'); }
function sourcesCollection() { return _db.collection('tbilisiEventsSources'); }
function venuesCollection() { return _db.collection('tbilisiEventsVenues'); }
function logsCollection() { return _db.collection('tbilisiEventsLogs'); }

// ---------------- sources (unchanged behaviour) ----------------
function sourceKey(type, value) { return type + '::' + String(value).trim().toLowerCase(); }

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
  if (URL_SOURCE_TYPES.indexOf(type) !== -1 && !/^https?:\/\//i.test(value)) {
    throw new Error('Для типа "' + type + '" нужна полная ссылка (начинается с http:// или https://), а не название страницы/группы');
  }
  var all = await getAllSources();
  var key = sourceKey(type, value);
  if (all.some(function(s) { return sourceKey(s.type, s.value) === key; })) throw new Error('Такой источник уже добавлен');
  var doc = { type: type, value: value, label: label, createdAt: new Date() };
  var ref = await sourcesCollection().add(doc);
  return Object.assign({ id: ref.id, custom: true }, doc);
}

// ---------------- events ----------------
var EVENT_DEFAULTS = {
  type: null, language: [], description: null,
  imageUrl: null, imageSourceUrl: null, venueId: null,
  rawExcerpt: null, hidden: false, enrichedAt: null,
};

async function findByDedupeKey(dedupeKey) {
  var snap = await eventsCollection().where('dedupeKey', '==', dedupeKey).limit(1).get();
  if (snap.empty) return null;
  return Object.assign({ id: snap.docs[0].id }, snap.docs[0].data());
}

async function insertEvent(event) {
  var now = new Date();
  var doc = Object.assign({}, EVENT_DEFAULTS, event, { createdAt: now, updatedAt: now });
  var ref = await eventsCollection().add(doc);
  return ref.id;
}

async function updateEvent(id, patch) {
  await eventsCollection().doc(id).update(Object.assign({}, patch, { updatedAt: new Date() }));
}

async function deleteEvent(id) {
  await eventsCollection().doc(id).delete();
}

async function setEventHidden(id, hidden) {
  await updateEvent(id, { hidden: !!hidden });
}

async function getEventById(id) {
  var snap = await eventsCollection().doc(id).get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

async function addSourceToEvent(id, source) {
  await _db.runTransaction(async function(t) {
    var ref = eventsCollection().doc(id);
    var snap = await t.get(ref);
    if (!snap.exists) return;
    var sources = snap.data().sources || [];
    if (!sources.some(function(s) { return s.url === source.url; })) sources.push(source);
    t.update(ref, { sources: sources, updatedAt: new Date() });
  });
}

async function getAllEvents() {
  var snap = await eventsCollection().orderBy('date').get();
  return snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
}

async function getPublicEvents() {
  var all = await getAllEvents();
  return all.filter(function(e) { return !e.hidden; });
}

async function getEventsByDate(date) {
  var snap = await eventsCollection().where('date', '==', date).get();
  return snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
}

function eventMatchesFilters(e, f) {
  if (f.source && !(e.sources || []).some(function(s) { return s.label === f.source; })) return false;
  if (f.type && e.type !== f.type) return false;
  if (f.dateFrom && (e.date || '') < f.dateFrom) return false;
  if (f.dateTo && (e.date || '') > f.dateTo) return false;
  if (f.status === 'visible' && e.hidden) return false;
  if (f.status === 'hidden' && !e.hidden) return false;
  if (f.q) {
    var hay = ((e.title || '') + ' ' + (e.place || '')).toLowerCase();
    if (hay.indexOf(String(f.q).toLowerCase()) === -1) return false;
  }
  return true;
}

async function getEvents(filters) {
  var f = filters || {};
  var all = await getAllEvents();
  return all.filter(function(e) { return eventMatchesFilters(e, f); });
}

// ---------------- venues ----------------
var VENUE_DEFAULTS = {
  aliases: [], address: null, area: null, lat: null, lng: null,
  type: null, description: null, imageUrl: null, website: null,
  eventCount: 0, origin: 'auto',
};

async function getVenues() {
  var snap = await venuesCollection().get();
  return snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
}

async function getVenueById(id) {
  var snap = await venuesCollection().doc(id).get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

async function insertVenue(venue) {
  var now = new Date();
  var doc = Object.assign({}, VENUE_DEFAULTS, venue, { createdAt: now, updatedAt: now });
  var ref = await venuesCollection().add(doc);
  return ref.id;
}

async function updateVenue(id, patch) {
  await venuesCollection().doc(id).update(Object.assign({}, patch, { updatedAt: new Date() }));
}

async function deleteVenue(id) {
  await venuesCollection().doc(id).delete();
}

async function bumpVenueEventCount(id, delta) {
  await _db.runTransaction(async function(t) {
    var ref = venuesCollection().doc(id);
    var snap = await t.get(ref);
    if (!snap.exists) return;
    var next = (snap.data().eventCount || 0) + delta;
    t.update(ref, { eventCount: next < 0 ? 0 : next, updatedAt: new Date() });
  });
}

async function mergeVenues(fromId, toId) {
  if (fromId === toId) throw new Error('Нельзя слить площадку саму с собой');
  var from = await getVenueById(fromId);
  var to = await getVenueById(toId);
  if (!from || !to) throw new Error('Одна из площадок не найдена');

  var linkedSnap = await eventsCollection().where('venueId', '==', fromId).get();
  var batch = _db.batch();
  linkedSnap.docs.forEach(function(d) { batch.update(d.ref, { venueId: toId, updatedAt: new Date() }); });

  var aliases = (to.aliases || []).slice();
  [from.name].concat(from.aliases || []).forEach(function(a) {
    if (a && aliases.indexOf(a) === -1) aliases.push(a);
  });
  batch.update(venuesCollection().doc(toId), {
    aliases: aliases,
    eventCount: (to.eventCount || 0) + (from.eventCount || 0),
    updatedAt: new Date(),
  });
  batch.delete(venuesCollection().doc(fromId));
  await batch.commit();
}

// ---------------- logs (unchanged) ----------------
async function addLog(summary) {
  var doc = Object.assign({}, summary, { createdAt: new Date() });
  await logsCollection().add(doc);
}

async function getRecentLogs(limitCount) {
  var snap = await logsCollection().orderBy('createdAt', 'desc').limit(limitCount || 20).get();
  return snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
}

module.exports = {
  init: init,
  findByDedupeKey: findByDedupeKey,
  insertEvent: insertEvent,
  updateEvent: updateEvent,
  deleteEvent: deleteEvent,
  setEventHidden: setEventHidden,
  getEventById: getEventById,
  addSourceToEvent: addSourceToEvent,
  getAllEvents: getAllEvents,
  getPublicEvents: getPublicEvents,
  getEventsByDate: getEventsByDate,
  getEvents: getEvents,
  getVenues: getVenues,
  getVenueById: getVenueById,
  insertVenue: insertVenue,
  updateVenue: updateVenue,
  deleteVenue: deleteVenue,
  bumpVenueEventCount: bumpVenueEventCount,
  mergeVenues: mergeVenues,
  getAllSources: getAllSources,
  addSource: addSource,
  addLog: addLog,
  getRecentLogs: getRecentLogs,
};
