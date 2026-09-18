'use strict';
var slugify = require('./tbilisi-events-slug').slugify;

var _db = null;
function init(db) { _db = db; }

function memoriesCollection() { return _db.collection('memories'); }
function photosCollection() { return _db.collection('memoryPhotos'); }
function adminsCollection() { return _db.collection('memoriesAdmins'); }
function settingsCollection() { return _db.collection('memoriesSettings'); }

// Human-readable latin slug, unique within one collection. `base` is a
// slugify() result; '' -> returns null (caller falls back to the doc id).
async function uniqueSlug(collRef, base, excludeId) {
  if (!base) return null;
  async function taken(cand) {
    var snap = await collRef.where('slug', '==', cand).limit(2).get();
    return snap.docs.some(function(d) { return d.id !== excludeId; });
  }
  if (!(await taken(base))) return base;
  for (var n = 2; n <= 30; n++) {
    var cand = base + '-' + n;
    if (!(await taken(cand))) return cand;
  }
  return base + '-' + Math.random().toString(16).slice(2, 6);
}

// ---------------- memories ----------------
var MEMORY_DEFAULTS = { description: '', ownerId: null, active: true };

async function insertMemory(memory) {
  var now = new Date();
  var doc = Object.assign({}, MEMORY_DEFAULTS, memory, { createdAt: now, updatedAt: now });
  if (!doc.slug) doc.slug = await uniqueSlug(memoriesCollection(), slugify(doc.name));
  var ref = await memoriesCollection().add(doc);
  return ref.id;
}

async function getMemoryById(id) {
  var snap = await memoriesCollection().doc(id).get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

async function getMemoryBySlug(slug) {
  if (!slug) return null;
  var snap = await memoriesCollection().where('slug', '==', slug).limit(1).get();
  if (snap.empty) return null;
  return Object.assign({ id: snap.docs[0].id }, snap.docs[0].data());
}

async function getAllMemories() {
  var snap = await memoriesCollection().orderBy('createdAt', 'desc').get();
  return snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
}

async function getPublicMemories() {
  var all = await getAllMemories();
  return all.filter(function(m) { return m.active !== false; });
}

// Slug is intentionally never touched here — it's the public URL and must
// stay stable once shared.
async function updateMemory(id, patch) {
  await memoriesCollection().doc(id).update(Object.assign({}, patch, { updatedAt: new Date() }));
}

// ---------------- memory photos ----------------
var PHOTO_DEFAULTS = { caption: '' };

async function getMemoryPhotos(memoryId) {
  var snap = await photosCollection().where('memoryId', '==', memoryId).get();
  var list = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
  list.sort(function(a, b) { return (a.order || 0) - (b.order || 0); });
  return list;
}

async function insertMemoryPhoto(photo) {
  var siblings = await getMemoryPhotos(photo.memoryId);
  var doc = Object.assign({}, PHOTO_DEFAULTS, photo, { order: siblings.length, createdAt: new Date() });
  var ref = await photosCollection().add(doc);
  return ref.id;
}

async function getMemoryPhotoById(id) {
  var snap = await photosCollection().doc(id).get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

async function updateMemoryPhoto(id, patch) {
  await photosCollection().doc(id).update(patch);
}

async function deleteMemoryPhoto(id) {
  await photosCollection().doc(id).delete();
}

// Swaps `order` with the previous/next sibling within the same memory; a
// no-op at either end of the list.
async function moveMemoryPhoto(id, direction) {
  var photo = await getMemoryPhotoById(id);
  if (!photo) return;
  var siblings = await getMemoryPhotos(photo.memoryId);
  var idx = siblings.findIndex(function(p) { return p.id === id; });
  var swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= siblings.length) return;
  var other = siblings[swapIdx];
  await updateMemoryPhoto(photo.id, { order: other.order });
  await updateMemoryPhoto(other.id, { order: photo.order });
}

async function deleteMemory(id) {
  var photos = await getMemoryPhotos(id);
  await Promise.all(photos.map(function(p) { return photosCollection().doc(p.id).delete(); }));
  await memoriesCollection().doc(id).delete();
}

// ---------------- AR settings ----------------
var AR_SETTINGS_DEFAULTS = { minVisibleDistance: 200, fullSizeDistance: 50 };

async function getArSettings() {
  var snap = await settingsCollection().doc('ar').get();
  if (!snap.exists) return Object.assign({}, AR_SETTINGS_DEFAULTS);
  return Object.assign({}, AR_SETTINGS_DEFAULTS, snap.data());
}

async function updateArSettings(patch) {
  await settingsCollection().doc('ar').set(Object.assign({}, AR_SETTINGS_DEFAULTS, patch));
}

// ---------------- admins ----------------
async function getAdminByPasswordHash(hash) {
  var snap = await adminsCollection().where('password_hash', '==', hash).limit(1).get();
  if (snap.empty) return null;
  return Object.assign({ id: snap.docs[0].id }, snap.docs[0].data());
}

async function getAdmins() {
  var snap = await adminsCollection().orderBy('createdAt').get();
  return snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
}

async function insertAdmin(admin) {
  var doc = Object.assign({ superadmin: false }, admin, { createdAt: new Date() });
  var ref = await adminsCollection().add(doc);
  return ref.id;
}

async function deleteAdmin(id) {
  await adminsCollection().doc(id).delete();
}

module.exports = {
  init: init,
  insertMemory: insertMemory,
  getMemoryById: getMemoryById,
  getMemoryBySlug: getMemoryBySlug,
  getAllMemories: getAllMemories,
  getPublicMemories: getPublicMemories,
  updateMemory: updateMemory,
  deleteMemory: deleteMemory,
  getMemoryPhotos: getMemoryPhotos,
  insertMemoryPhoto: insertMemoryPhoto,
  getMemoryPhotoById: getMemoryPhotoById,
  updateMemoryPhoto: updateMemoryPhoto,
  deleteMemoryPhoto: deleteMemoryPhoto,
  moveMemoryPhoto: moveMemoryPhoto,
  getArSettings: getArSettings,
  updateArSettings: updateArSettings,
  getAdminByPasswordHash: getAdminByPasswordHash,
  getAdmins: getAdmins,
  insertAdmin: insertAdmin,
  deleteAdmin: deleteAdmin,
};
