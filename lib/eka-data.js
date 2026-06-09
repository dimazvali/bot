'use strict';
var _db = null;
var _directionsCache = null;
var _toursCache = null;

function init(db) {
  _db = db;
}

// ── DIRECTIONS ──────────────────────────────────────────

async function getDirections() {
  if (_directionsCache) return _directionsCache;
  var snap = await _db.collection('eka_directions').get();
  var docs = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
  docs.sort(function(a, b) { return (a.order || 0) - (b.order || 0); });
  _directionsCache = docs;
  return docs;
}

async function getDirection(id) {
  var snap = await _db.collection('eka_directions').doc(id).get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

async function getDirectionBySlug(slug) {
  var snap = await _db.collection('eka_directions').where('slug', '==', slug).limit(1).get();
  if (snap.empty) return null;
  return Object.assign({ id: snap.docs[0].id }, snap.docs[0].data());
}

async function saveDirection(id, data) {
  _directionsCache = null;
  _toursCache = null;
  if (id) {
    await _db.collection('eka_directions').doc(id).set(data, { merge: true });
    return id;
  }
  var ref = await _db.collection('eka_directions').add(data);
  return ref.id;
}

async function deleteDirection(id) {
  _directionsCache = null;
  _toursCache = null;
  await _db.collection('eka_directions').doc(id).delete();
}

async function reorderDirections(ids) {
  _directionsCache = null;
  _toursCache = null;
  var batch = _db.batch();
  ids.forEach(function(id, i) {
    batch.update(_db.collection('eka_directions').doc(id), { order: i });
  });
  await batch.commit();
}

// ── TOURS ────────────────────────────────────────────────

async function getTours(opts) {
  opts = opts || {};
  var docs;
  if (!_toursCache) {
    var snap = await _db.collection('eka_tours').get();
    _toursCache = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
  }
  docs = _toursCache.slice();
  if (opts.directionId) {
    docs = docs.filter(function(d) { return d.directionId === opts.directionId; });
  }
  if (opts.publishedOnly) {
    docs = docs.filter(function(d) { return d.published; });
  }
  if (opts.upcomingOnly) {
    var now = new Date();
    docs = docs.filter(function(d) {
      var dt = d.date && d.date.toDate ? d.date.toDate() : new Date(d.date);
      return dt >= now;
    });
  }
  docs.sort(function(a, b) {
    var da = a.date ? (a.date.toDate ? a.date.toDate() : new Date(a.date)) : new Date(8640000000000000);
    var db2 = b.date ? (b.date.toDate ? b.date.toDate() : new Date(b.date)) : new Date(8640000000000000);
    return da - db2;
  });
  return docs;
}

async function getTour(id) {
  var snap = await _db.collection('eka_tours').doc(id).get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

async function saveTour(id, data) {
  _toursCache = null;
  if (id) {
    await _db.collection('eka_tours').doc(id).set(data, { merge: true });
    return id;
  }
  var ref = await _db.collection('eka_tours').add(data);
  return ref.id;
}

async function deleteTour(id) {
  _toursCache = null;
  await _db.collection('eka_tours').doc(id).delete();
}

// ── IMAGES ──────────────────────────────────────────────

async function getImages(opts) {
  opts = opts || {};
  var query = _db.collection('eka_images');
  if (opts.ownerId) query = query.where('ownerId', '==', opts.ownerId);
  if (opts.role) query = query.where('role', '==', opts.role);
  var snap = await query.get();
  var docs = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
  docs.sort(function(a, b) { return (a.order || 0) - (b.order || 0); });
  return docs;
}

async function saveImage(id, data) {
  if (id) {
    await _db.collection('eka_images').doc(id).set(data, { merge: true });
    return id;
  }
  var ref = await _db.collection('eka_images').add(data);
  return ref.id;
}

async function deleteImage(id) {
  await _db.collection('eka_images').doc(id).delete();
}

async function reorderImages(ids) {
  var batch = _db.batch();
  ids.forEach(function(id, i) {
    batch.update(_db.collection('eka_images').doc(id), { order: i });
  });
  await batch.commit();
}

// ── PROFILE ──────────────────────────────────────────────

async function getProfile() {
  var snap = await _db.collection('eka_settings').doc('profile').get();
  return snap.exists ? snap.data() : {};
}

async function saveProfile(data) {
  await _db.collection('eka_settings').doc('profile').set(data, { merge: true });
}

// ── REQUESTS ─────────────────────────────────────────────

async function getRequest(id) {
  var snap = await _db.collection('eka_requests').doc(id).get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

async function saveRequest(data) {
  var ref = await _db.collection('eka_requests').add(
    Object.assign({}, data, { createdAt: new Date(), status: 'new' })
  );
  return ref.id;
}

async function getRequests(opts) {
  opts = opts || {};
  var snap = await _db.collection('eka_requests').orderBy('createdAt', 'desc').get();
  var docs = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
  if (opts.status) docs = docs.filter(function(d) { return d.status === opts.status; });
  if (opts.statuses) docs = docs.filter(function(d) { return opts.statuses.includes(d.status || 'new'); });
  if (opts.tourId) docs = docs.filter(function(d) { return d.tourId === opts.tourId; });
  return docs;
}

async function updateRequestStatus(id, status) {
  await _db.collection('eka_requests').doc(id).update({ status: status });
}

async function updateRequest(id, data) {
  await _db.collection('eka_requests').doc(id).update(data);
}

async function getBookedCount(tourId) {
  var snap = await _db.collection('eka_requests')
    .where('tourId', '==', tourId)
    .where('status', 'in', ['new', 'contacted'])
    .get();
  return snap.size;
}

async function getReviews(opts) {
  opts = opts || {};
  var snap = await _db.collection('eka_requests').orderBy('createdAt', 'desc').get();
  var docs = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
  docs = docs.filter(function(d) { return d.reviewText && d.reviewText.trim(); });
  if (opts.publishedOnly) docs = docs.filter(function(d) { return !!d.reviewPublished; });
  if (opts.directionId || opts.tourIds) {
    var tourIdSet = opts.tourIds ? new Set(opts.tourIds) : null;
    docs = docs.filter(function(d) {
      return (opts.directionId && d.directionId === opts.directionId) ||
             (tourIdSet && d.tourId && tourIdSet.has(d.tourId));
    });
  }
  return docs;
}

module.exports = {
  init,
  getDirections, getDirection, getDirectionBySlug, saveDirection, deleteDirection, reorderDirections,
  getTours, getTour, saveTour, deleteTour,
  getRequest, saveRequest, getRequests, updateRequestStatus, updateRequest, getBookedCount,
  getReviews,
  getImages, saveImage, deleteImage, reorderImages,
  getProfile, saveProfile,
};
