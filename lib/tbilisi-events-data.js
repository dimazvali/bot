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
function seenCollection() { return _db.collection('tbilisiEventsSeen'); }
function adminsCollection() { return _db.collection('tbilisiEventsAdmins'); }
function heroesCollection() { return _db.collection('tbilisiEventsHeroes'); }
function collectionsCollection() { return _db.collection('tbilisiEventsCollections'); }
function organizerClaimsCollection() { return _db.collection('tbilisiEventsOrganizerClaims'); }

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
  editorsPick: false, active: true, cancelled: false,
  editorNote: null, price: null, titleI18n: null,
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
  return all.filter(function(e) { return !e.hidden && e.active !== false; });
}

async function getEventsByDate(date) {
  var snap = await eventsCollection().where('date', '==', date).get();
  return snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
}

async function getEventsByVenue(venueId) {
  var snap = await eventsCollection().where('venueId', '==', venueId).get();
  return snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
}

function eventMatchesFilters(e, f) {
  if (f.source && !(e.sources || []).some(function(s) { return s.label === f.source; })) return false;
  if (f.type && e.type !== f.type) return false;
  if (f.dateFrom && (e.date || '') < f.dateFrom) return false;
  if (f.dateTo && (e.date || '') > f.dateTo) return false;
  if (f.status === 'visible' && e.hidden) return false;
  if (f.status === 'hidden' && !e.hidden) return false;
  if (f.status === 'pending' && !(e.submission && e.submission.status === 'pending')) return false;
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
  eventCount: 0, origin: 'auto', researchedAt: null, researchNote: null,
  editorVerified: false,
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

// ---------------- seen source items (per-post ingest dedup) ----------------
// Keyed by dedup.seenItemKey(url, text). Its presence means "this exact post,
// with this exact text, has already been turned into events" — so the pipeline
// can skip re-extracting it. An edited post yields a different key and a fresh doc.
async function getSeenItem(key) {
  var snap = await seenCollection().doc(key).get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

async function markSeenItem(key, info) {
  var now = new Date();
  await seenCollection().doc(key).set({
    url: (info && info.url) || null,
    contentHash: (info && info.contentHash) || null,
    eventIds: (info && info.eventIds) || [],
    sourceLabel: (info && info.sourceLabel) || null,
    firstSeenAt: now,
    lastSeenAt: now,
  }, { merge: true });
}

// ---------------- admins ----------------
// Firestore docs { name, password_hash, superadmin, createdAt }, where
// password_hash === sha256('tbilisiEvents:' + password) (same transform as the
// login cookie). The env password TBILISI_EVENTS_ADMIN_PASS is the superadmin
// and needs no doc. Mirrors the ekaAdmins collection. Managed from the Админы tab.
async function getAdminByPasswordHash(hash) {
  if (!hash) return null;
  var snap = await adminsCollection().where('password_hash', '==', hash).limit(1).get();
  if (snap.empty) return null;
  var d = snap.docs[0];
  return Object.assign({ id: d.id }, d.data());
}

async function getAdmins() {
  var snap = await adminsCollection().orderBy('createdAt').get();
  return snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
}

async function addAdmin(admin) {
  var name = (admin.name || '').trim();
  if (!name) throw new Error('Укажите имя админа');
  if (!admin.passwordHash) throw new Error('Укажите пароль');
  var doc = {
    name: name,
    password_hash: admin.passwordHash,
    superadmin: !!admin.superadmin,
    createdAt: new Date(),
  };
  var ref = await adminsCollection().add(doc);
  return Object.assign({ id: ref.id }, doc);
}

async function updateAdmin(id, patch) {
  var update = {};
  if (typeof patch.name === 'string' && patch.name.trim()) update.name = patch.name.trim();
  if (patch.passwordHash) update.password_hash = patch.passwordHash;
  if (typeof patch.superadmin === 'boolean') update.superadmin = patch.superadmin;
  if (Object.keys(update).length) await adminsCollection().doc(id).update(update);
}

async function deleteAdmin(id) {
  await adminsCollection().doc(id).delete();
}

// ---------------- heroes & curated collections ----------------
// A "hero" is a known person who fronts one or more curated event collections.
// Kept as its own entity so photo/bio are reused across collections (and, later,
// can be linked to the events they organise themselves).
var HERO_DEFAULTS = {
  name: { ru: '', en: '', ka: '' },
  description: { ru: '', en: '', ka: '' },
  imageUrl: null,
};

// A collection is a titled, ordered list of event ids curated under one hero.
// `curatorNote` is the hero's own framing of the selection ("от куратора").
var COLLECTION_DEFAULTS = {
  title: { ru: '', en: '', ka: '' },
  curatorNote: { ru: '', en: '', ka: '' },
  heroId: null,
  eventIds: [],
  published: false,
};

function i18nField(obj) {
  var o = obj || {};
  return { ru: (o.ru || '').trim(), en: (o.en || '').trim(), ka: (o.ka || '').trim() };
}

async function getHeroes() {
  var snap = await heroesCollection().get();
  return snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
}

async function getHeroById(id) {
  var snap = await heroesCollection().doc(id).get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

async function insertHero(hero) {
  var now = new Date();
  var doc = Object.assign({}, HERO_DEFAULTS, {
    name: i18nField(hero.name),
    description: i18nField(hero.description),
  }, { createdAt: now, updatedAt: now });
  var ref = await heroesCollection().add(doc);
  return ref.id;
}

async function updateHero(id, patch) {
  var update = { updatedAt: new Date() };
  if (patch.name) update.name = i18nField(patch.name);
  if (patch.description) update.description = i18nField(patch.description);
  if ('imageUrl' in patch) update.imageUrl = patch.imageUrl || null;
  await heroesCollection().doc(id).update(update);
}

async function deleteHero(id) {
  // Detach from any collections that reference this hero, then remove it.
  var linked = await collectionsCollection().where('heroId', '==', id).get();
  if (!linked.empty) {
    var batch = _db.batch();
    linked.docs.forEach(function(d) { batch.update(d.ref, { heroId: null, updatedAt: new Date() }); });
    await batch.commit();
  }
  await heroesCollection().doc(id).delete();
}

async function getCollections() {
  var snap = await collectionsCollection().get();
  return snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
}

async function getPublishedCollections() {
  var all = await getCollections();
  return all.filter(function(c) { return c.published; });
}

async function getCollectionById(id) {
  var snap = await collectionsCollection().doc(id).get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

async function insertCollection(collection) {
  var now = new Date();
  var doc = Object.assign({}, COLLECTION_DEFAULTS, {
    title: i18nField(collection.title),
    curatorNote: i18nField(collection.curatorNote),
    heroId: collection.heroId || null,
  }, { createdAt: now, updatedAt: now });
  var ref = await collectionsCollection().add(doc);
  return ref.id;
}

async function updateCollection(id, patch) {
  var update = { updatedAt: new Date() };
  if (patch.title) update.title = i18nField(patch.title);
  if (patch.curatorNote) update.curatorNote = i18nField(patch.curatorNote);
  if ('heroId' in patch) update.heroId = patch.heroId || null;
  if ('published' in patch) update.published = !!patch.published;
  if ('eventIds' in patch) update.eventIds = (patch.eventIds || []).filter(Boolean);
  await collectionsCollection().doc(id).update(update);
}

async function deleteCollection(id) {
  await collectionsCollection().doc(id).delete();
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

// ---------------- submissions & organizer claims ----------------
function tsMs(v) {
  if (v && typeof v.toDate === 'function') return v.toDate().getTime();
  if (v instanceof Date) return v.getTime();
  var n = new Date(v).getTime();
  return isNaN(n) ? 0 : n;
}

// Iterates the raw collection (NOT getAllEvents, which orderBy('date') would
// drop date-less docs).
async function countSubmissionsByUser(userId) {
  var snap = await eventsCollection().get();
  return snap.docs.filter(function(d) {
    var e = d.data();
    return e.submission && e.submission.userId === userId && e.submission.status === 'pending';
  }).length;
}

async function insertSubmission(f) {
  var now = new Date();
  return await insertEvent({
    title: (f.title || '').trim(),
    date: (f.date || '').trim(),
    time: (f.time || '').trim() || null,
    place: (f.place || '').trim() || null,
    type: f.type || null,
    rawExcerpt: (f.description || '').trim() || null,
    imageSourceUrl: (f.imageSourceUrl || '').trim() || null,
    active: false,
    hidden: true,
    sources: (f.url ? [{ label: 'User submission', url: f.url }] : []),
    submission: { userId: f.userId, status: 'pending', submittedAt: now, contactNote: (f.contactNote || '').trim() || null },
  });
}

async function insertOrganizerClaim(c) {
  var now = new Date();
  var doc = { uid: c.uid, targetType: c.targetType, targetId: c.targetId, message: (c.message || '').trim() || null, status: 'new', createdAt: now };
  var ref = await organizerClaimsCollection().add(doc);
  return Object.assign({ id: ref.id }, doc);
}

async function getActiveClaim(uid, targetType, targetId) {
  var snap = await organizerClaimsCollection().where('uid', '==', uid).get();
  var hit = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); })
    .filter(function(c) { return c.targetType === targetType && c.targetId === targetId && (c.status === 'new' || c.status === 'approved'); })[0];
  return hit || null;
}

async function getOrganizerClaims(filter) {
  var f = filter || {};
  var snap = await organizerClaimsCollection().get();
  var list = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
  if (f.status) list = list.filter(function(c) { return c.status === f.status; });
  list.sort(function(a, b) { return tsMs(b.createdAt) - tsMs(a.createdAt); });
  return list;
}

async function getOrganizerClaimById(id) {
  var snap = await organizerClaimsCollection().doc(id).get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

async function decideOrganizerClaim(id, status) {
  await organizerClaimsCollection().doc(id).update({ status: status, decidedAt: new Date() });
}

async function setEventOrganizer(eventId, uid) {
  await eventsCollection().doc(eventId).update({ organizerUserId: uid, updatedAt: new Date() });
}

async function setVenueOrganizer(venueId, uid) {
  await venuesCollection().doc(venueId).update({ organizerUserId: uid, updatedAt: new Date() });
}

module.exports = {
  init: init,
  countSubmissionsByUser: countSubmissionsByUser,
  insertSubmission: insertSubmission,
  insertOrganizerClaim: insertOrganizerClaim,
  getActiveClaim: getActiveClaim,
  getOrganizerClaims: getOrganizerClaims,
  getOrganizerClaimById: getOrganizerClaimById,
  decideOrganizerClaim: decideOrganizerClaim,
  setEventOrganizer: setEventOrganizer,
  setVenueOrganizer: setVenueOrganizer,
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
  getEventsByVenue: getEventsByVenue,
  getEvents: getEvents,
  getSeenItem: getSeenItem,
  markSeenItem: markSeenItem,
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
  getAdminByPasswordHash: getAdminByPasswordHash,
  getAdmins: getAdmins,
  addAdmin: addAdmin,
  updateAdmin: updateAdmin,
  deleteAdmin: deleteAdmin,
  getHeroes: getHeroes,
  getHeroById: getHeroById,
  insertHero: insertHero,
  updateHero: updateHero,
  deleteHero: deleteHero,
  getCollections: getCollections,
  getPublishedCollections: getPublishedCollections,
  getCollectionById: getCollectionById,
  insertCollection: insertCollection,
  updateCollection: updateCollection,
  deleteCollection: deleteCollection,
};
