'use strict';
var _db = null;
var _directionsCache = null;
var _toursCache = null;

// ── CACHE ────────────────────────────────────────────────
var _cache = {};

function cached(key, fn) {
  if (_cache[key] !== undefined) return Promise.resolve(_cache[key]);
  return fn().then(function(val) {
    _cache[key] = val;
    return val;
  });
}

function clearCached(prefix) {
  Object.keys(_cache).forEach(function(k) {
    if (!prefix || k === prefix || k.startsWith(prefix + ':')) delete _cache[k];
  });
}

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
      if (d.tourType === 'individual') return false;
      var dt = d.date && d.date.toDate ? d.date.toDate() : new Date(d.date);
      return dt >= now;
    });
  }
  if (opts.individualOnly) {
    docs = docs.filter(function(d) { return d.tourType === 'individual'; });
  }
  if (opts.groupOnly) {
    docs = docs.filter(function(d) { return d.tourType !== 'individual'; });
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
  var key = 'images:' + (opts.ownerId || '') + ':' + (opts.role || '');
  return cached(key, async function() {
    var query = _db.collection('eka_images');
    if (opts.ownerId) query = query.where('ownerId', '==', opts.ownerId);
    if (opts.role) query = query.where('role', '==', opts.role);
    var snap = await query.get();
    var docs = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
    docs.sort(function(a, b) { return (a.order || 0) - (b.order || 0); });
    return docs;
  });
}

async function saveImage(id, data) {
  if (id) {
    await _db.collection('eka_images').doc(id).set(data, { merge: true });
    clearCached('images');
    return id;
  }
  var ref = await _db.collection('eka_images').add(data);
  clearCached('images');
  return ref.id;
}

async function deleteImage(id) {
  await _db.collection('eka_images').doc(id).delete();
  clearCached('images');
}

async function reorderImages(ids) {
  var batch = _db.batch();
  ids.forEach(function(id, i) {
    batch.update(_db.collection('eka_images').doc(id), { order: i });
  });
  await batch.commit();
  clearCached('images');
}

// ── GALLERIES (reusable, embeddable via shortcode) ───────

async function getGalleries() {
  return cached('galleries', async function() {
    var snap = await _db.collection('eka_galleries').get();
    var docs = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
    docs.sort(function(a, b) { return (a.title || '').localeCompare(b.title || '', 'ru'); });
    return docs;
  });
}

async function getGallery(id) {
  return cached('gallery:' + id, async function() {
    var snap = await _db.collection('eka_galleries').doc(id).get();
    if (!snap.exists) return null;
    return Object.assign({ id: snap.id }, snap.data());
  });
}

async function saveGallery(id, data) {
  if (id) {
    await _db.collection('eka_galleries').doc(id).set(data, { merge: true });
    clearCached('galleries');
    clearCached('gallery:' + id);
    return id;
  }
  var ref = await _db.collection('eka_galleries').add(data);
  clearCached('galleries');
  return ref.id;
}

async function deleteGallery(id) {
  await _db.collection('eka_galleries').doc(id).delete();
  clearCached('galleries');
  clearCached('gallery:' + id);
}

// ── PROFILE ──────────────────────────────────────────────

async function getProfile() {
  return cached('profile', async function() {
    var snap = await _db.collection('eka_settings').doc('profile').get();
    return snap.exists ? snap.data() : {};
  });
}

async function saveProfile(data) {
  await _db.collection('eka_settings').doc('profile').set(data, { merge: true });
  clearCached('profile');
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
  if (opts.clientId) docs = docs.filter(function(d) { return d.clientId === opts.clientId; });
  return docs;
}

async function updateRequestStatus(id, status) {
  await _db.collection('eka_requests').doc(id).update({ status: status });
  clearCached('booked');
  clearCached('reviews');
}

async function updateRequest(id, data) {
  await _db.collection('eka_requests').doc(id).update(data);
  if (data.reviewText !== undefined || data.reviewPublished !== undefined) clearCached('reviews');
  if (data.status !== undefined) clearCached('booked');
}

async function getBookedCount(tourId) {
  return cached('booked:' + tourId, async function() {
    var snap = await _db.collection('eka_requests')
      .where('tourId', '==', tourId)
      .where('status', 'in', ['new', 'contacted'])
      .get();
    return snap.docs.reduce(function(sum, d) { return sum + (d.data().participants || 1); }, 0);
  });
}

async function getReviews(opts) {
  opts = opts || {};
  var key = 'reviews:' + (opts.publishedOnly ? '1' : '0') + ':' + (opts.directionId || '') + ':' + (opts.tourIds ? opts.tourIds.join(',') : '');
  return cached(key, async function() {
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
  });
}

// ── CLIENTS ──────────────────────────────────────────────

async function getClients() {
  var snap = await _db.collection('eka_clients').orderBy('lastName').get();
  return snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
}

async function getClient(id) {
  var snap = await _db.collection('eka_clients').doc(id).get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

async function saveClient(id, data) {
  if (id) {
    await _db.collection('eka_clients').doc(id).set(data, { merge: true });
    return id;
  }
  var ref = await _db.collection('eka_clients').add(data);
  return ref.id;
}

async function deleteClient(id) {
  await _db.collection('eka_clients').doc(id).delete();
}

// ── ATTRACTIONS ──────────────────────────────────────────

async function getAttractions(opts) {
  opts = opts || {};
  var key = 'attractions:' + (opts.directionId || '') + ':' + (opts.publishedOnly ? '1' : '0');
  return cached(key, async function() {
    var snap = await _db.collection('eka_attractions').get();
    var docs = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
    if (opts.directionId) docs = docs.filter(function(d) { return d.directionId === opts.directionId; });
    if (opts.publishedOnly) docs = docs.filter(function(d) { return !!d.published; });
    docs.sort(function(a, b) { return (a.titleRu || '').localeCompare(b.titleRu || '', 'ru'); });
    return docs;
  });
}

async function getAttraction(id) {
  return cached('attraction:' + id, async function() {
    var snap = await _db.collection('eka_attractions').doc(id).get();
    if (!snap.exists) return null;
    return Object.assign({ id: snap.id }, snap.data());
  });
}

async function getAttractionBySlug(slug) {
  return cached('attraction:slug:' + slug, async function() {
    var snap = await _db.collection('eka_attractions').where('slug', '==', slug).limit(1).get();
    if (snap.empty) return null;
    return Object.assign({ id: snap.docs[0].id }, snap.docs[0].data());
  });
}

async function saveAttraction(id, data) {
  if (id) {
    await _db.collection('eka_attractions').doc(id).set(data, { merge: true });
    clearCached('attractions');
    clearCached('attraction:' + id);
    return id;
  }
  var ref = await _db.collection('eka_attractions').add(data);
  clearCached('attractions');
  return ref.id;
}

async function deleteAttraction(id) {
  await _db.collection('eka_attractions').doc(id).delete();
  clearCached('attractions');
  clearCached('attraction:' + id);
}

// ── DISCOUNTS ─────────────────────────────────────────────

async function getDiscounts() {
  return cached('discounts', async function() {
    var snap = await _db.collection('eka_discounts').orderBy('startDate', 'desc').get();
    return snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
  });
}

async function getActiveDiscounts() {
  return cached('discounts:active', async function() {
    var now = new Date();
    var snap = await _db.collection('eka_discounts').get();
    return snap.docs
      .map(function(d) { return Object.assign({ id: d.id }, d.data()); })
      .filter(function(d) {
        var start = d.startDate ? (d.startDate.toDate ? d.startDate.toDate() : new Date(d.startDate)) : null;
        var end = d.endDate ? (d.endDate.toDate ? d.endDate.toDate() : new Date(d.endDate)) : null;
        return (!start || start <= now) && (!end || end >= now);
      });
  });
}

async function saveDiscount(id, data) {
  if (id) {
    await _db.collection('eka_discounts').doc(id).set(data, { merge: true });
    clearCached('discounts');
    return id;
  }
  var ref = await _db.collection('eka_discounts').add(data);
  clearCached('discounts');
  return ref.id;
}

async function deleteDiscount(id) {
  await _db.collection('eka_discounts').doc(id).delete();
  clearCached('discounts');
}

module.exports = {
  init,
  getDirections, getDirection, getDirectionBySlug, saveDirection, deleteDirection, reorderDirections,
  getTours, getTour, saveTour, deleteTour,
  getRequest, saveRequest, getRequests, updateRequestStatus, updateRequest, getBookedCount,
  getReviews,
  getImages, saveImage, deleteImage, reorderImages,
  getProfile, saveProfile,
  getClients, getClient, saveClient, deleteClient,
  getAttractions, getAttraction, getAttractionBySlug, saveAttraction, deleteAttraction,
  getDiscounts, getActiveDiscounts, saveDiscount, deleteDiscount,
  getGalleries, getGallery, saveGallery, deleteGallery,
};
