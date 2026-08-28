var _cache = null;
var _db = null;
var _env = null;

function getEnv() { return _env || process.env.PHOTO_ENV || 'prod'; }

async function initFromFirestore(db) {
  _db = db;
  _env = process.env.PHOTO_ENV || 'prod';
  var env = _env;

  var [shootSnap, photoSnap, collectionSnap] = await Promise.all([
    db.collection('shoots').where('env', '==', env).get(),
    db.collection('shootPhotos').where('env', '==', env).get(),
    db.collection('shootCollections').where('env', '==', env).get(),
  ]);

  var result = {};
  shootSnap.docs.forEach(function(doc) {
    var d = doc.data();
    // derive slug from doc ID if key field is missing
    var slug = d.key || doc.id.substring(doc.id.indexOf('_') + 1);
    result[slug] = {
      key: slug,
      label: d.label || '',
      desc: d.desc || '',
      password: d.password || '',
      public: !!d.public,
      showFaces: !!d.showFaces,
      relatedShoots: d.relatedShoots || [],
      // Firestore stamps every doc with a creation time automatically, so this works
      // retroactively for shoots created before this field existed — no backfill needed.
      createdAt: d.createdAt || (doc.createTime ? doc.createTime.toDate().toISOString() : null),
      photoOrder: d.photoOrder || [],
      photos: [],
      collections: [],
    };
  });
  console.log('[photo-shoots] loaded', Object.keys(result).length, 'shoots:', Object.keys(result));

  var photosBySlug = {};
  photoSnap.docs.forEach(function(doc) {
    var d = doc.data();
    if (!photosBySlug[d.shootSlug]) photosBySlug[d.shootSlug] = {};
    photosBySlug[d.shootSlug][d.id] = d;
  });

  Object.keys(result).forEach(function(slug) {
    var shoot = result[slug];
    var byId = photosBySlug[slug] || {};
    shoot.photos = shoot.photoOrder.map(function(id) { return byId[id]; }).filter(Boolean);
  });

  var collectionsBySlug = {};
  collectionSnap.docs.forEach(function(doc) {
    var d = doc.data();
    if (!collectionsBySlug[d.shootSlug]) collectionsBySlug[d.shootSlug] = [];
    collectionsBySlug[d.shootSlug].push(Object.assign({ id: doc.id }, d));
  });
  Object.keys(result).forEach(function(slug) {
    var list = collectionsBySlug[slug] || [];
    list.sort(function(a, b) {
      var ta = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
      var tb = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
      return tb - ta;
    });
    result[slug].collections = list;
  });

  _cache = result;
}

function getData() { return _cache || {}; }

function getShoot(slug) {
  var shoot = (_cache || {})[slug] || null;
  if (!shoot) console.log('[photo-shoots] getShoot miss:', slug, '| cache keys:', Object.keys(_cache || {}));
  return shoot;
}

async function createShoot(slug, label, desc, password, isPublic) {
  if (getShoot(slug)) throw new Error('Shoot already exists: ' + slug);
  var env = getEnv();
  var doc = { key: slug, env, label, desc: desc || '', password: password || '', public: !!isPublic, photoOrder: [] };
  await _db.collection('shoots').doc(env + '_' + slug).set(doc);
  if (!_cache) _cache = {};
  _cache[slug] = { ...doc, photos: [], collections: [] };
}

async function saveShoot(slug, fields) {
  var env = getEnv();
  var safe = Object.assign({}, fields);
  delete safe.photoOrder;
  delete safe.key;
  delete safe.env;
  await _db.collection('shoots').doc(env + '_' + slug).update(safe);
  if (_cache && _cache[slug]) Object.assign(_cache[slug], safe);
}

// Keeps "related shoots" symmetric: linking A -> [B, C] also links B -> A and C -> A,
// and unlinking removes the reverse link too. Reciprocal writes are best-effort (a stale
// or already-deleted slug in the list shouldn't block saving the shoot being edited).
async function setRelatedShoots(slug, newRelated) {
  var env = getEnv();
  var { FieldValue } = require('firebase-admin/firestore');
  var current = getShoot(slug);
  var oldRelated = (current && current.relatedShoots) || [];
  var newSet = newRelated.filter(function(s) { return s && s !== slug; });

  var added = newSet.filter(function(s) { return oldRelated.indexOf(s) === -1; });
  var removed = oldRelated.filter(function(s) { return newSet.indexOf(s) === -1; });

  await _db.collection('shoots').doc(env + '_' + slug).update({ relatedShoots: newSet });
  if (_cache && _cache[slug]) _cache[slug].relatedShoots = newSet;

  function updateReciprocal(otherSlug, op) {
    return _db.collection('shoots').doc(env + '_' + otherSlug).update({
      relatedShoots: op === 'add' ? FieldValue.arrayUnion(slug) : FieldValue.arrayRemove(slug),
    }).then(function() {
      if (_cache && _cache[otherSlug]) {
        var list = _cache[otherSlug].relatedShoots || [];
        _cache[otherSlug].relatedShoots = op === 'add'
          ? (list.indexOf(slug) === -1 ? list.concat([slug]) : list)
          : list.filter(function(s) { return s !== slug; });
      }
    }).catch(function(e) {
      console.error('[photo-shoots] reciprocal relatedShoots update failed for', otherSlug, ':', e.message);
    });
  }

  await Promise.all(
    added.map(function(s) { return updateReciprocal(s, 'add'); })
      .concat(removed.map(function(s) { return updateReciprocal(s, 'remove'); }))
  );
}

async function addPhoto(slug, photoEntry) {
  var env = getEnv();
  var { FieldValue } = require('firebase-admin/firestore');
  await _db.collection('shootPhotos').doc(env + '_' + slug + '_' + photoEntry.id).set(
    { env, shootSlug: slug, ...photoEntry }
  );
  await _db.collection('shoots').doc(env + '_' + slug).update({
    photoOrder: FieldValue.arrayUnion(photoEntry.id),
  });
  if (_cache && _cache[slug]) {
    if (!_cache[slug].photoOrder.includes(photoEntry.id)) {
      _cache[slug].photoOrder.push(photoEntry.id);
      _cache[slug].photos.push(photoEntry);
    }
  }
}

async function removePhoto(slug, photoId) {
  var env = getEnv();
  var { FieldValue } = require('firebase-admin/firestore');
  await _db.collection('shootPhotos').doc(env + '_' + slug + '_' + photoId).delete();
  await _db.collection('shoots').doc(env + '_' + slug).update({
    photoOrder: FieldValue.arrayRemove(photoId),
  });
  if (_cache && _cache[slug]) {
    _cache[slug].photoOrder = _cache[slug].photoOrder.filter(function(id) { return id !== photoId; });
    _cache[slug].photos = _cache[slug].photos.filter(function(p) { return p.id !== photoId; });
  }
}

async function reorderPhotos(slug, order) {
  var env = getEnv();
  await _db.collection('shoots').doc(env + '_' + slug).update({ photoOrder: order });
  if (_cache && _cache[slug]) {
    _cache[slug].photoOrder = order;
    var byId = {};
    _cache[slug].photos.forEach(function(p) { byId[p.id] = p; });
    _cache[slug].photos = order.map(function(id) { return byId[id]; }).filter(Boolean);
  }
}

async function updatePhoto(slug, photoId, fields) {
  var env = getEnv();
  var safe = { title: fields.title || '', date: fields.date || '', desc: fields.desc || '', type: ['copter','camera','mobile'].includes(fields.type) ? fields.type : 'camera' };
  await _db.collection('shootPhotos').doc(env + '_' + slug + '_' + photoId).update(safe);
  if (_cache && _cache[slug]) {
    var photo = _cache[slug].photos.find(function(p) { return p.id === photoId; });
    if (photo) Object.assign(photo, safe);
  }
}

async function updatePhotoSeo(slug, photoId, seoDesc, seoKeywords) {
  var env = getEnv();
  var safe = { seo_desc: seoDesc || '', seo_keywords: seoKeywords || '' };
  await _db.collection('shootPhotos').doc(env + '_' + slug + '_' + photoId).update(safe);
  if (_cache && _cache[slug]) {
    var photo = _cache[slug].photos.find(function(p) { return p.id === photoId; });
    if (photo) Object.assign(photo, safe);
  }
}

async function updatePhotoFaces(slug, photoId, faces) {
  var env = getEnv();
  await _db.collection('shootPhotos').doc(env + '_' + slug + '_' + photoId).update({ faces: faces });
  if (_cache && _cache[slug]) {
    var photo = _cache[slug].photos.find(function(p) { return p.id === photoId; });
    if (photo) photo.faces = faces;
  }
}

async function addAnnotation(slug, photoId, annot) {
  var env = getEnv();
  var photo = _cache && _cache[slug] ? _cache[slug].photos.find(function(p) { return p.id === photoId; }) : null;
  var annotations = (photo ? (photo.annotations || []) : []).concat([annot]);
  await _db.collection('shootPhotos').doc(env + '_' + slug + '_' + photoId).update({ annotations });
  if (photo) photo.annotations = annotations;
}

async function moveAnnotation(slug, photoId, annotId, x, y) {
  var env = getEnv();
  var photo = _cache && _cache[slug] ? _cache[slug].photos.find(function(p) { return p.id === photoId; }) : null;
  if (!photo || !photo.annotations) return;
  var annot = photo.annotations.find(function(a) { return a.id === annotId; });
  if (!annot) return;
  annot.x = x;
  annot.y = y;
  await _db.collection('shootPhotos').doc(env + '_' + slug + '_' + photoId).update({ annotations: photo.annotations });
}

async function removeAnnotation(slug, photoId, annotId) {
  var env = getEnv();
  var photo = _cache && _cache[slug] ? _cache[slug].photos.find(function(p) { return p.id === photoId; }) : null;
  var annotations = photo && photo.annotations ? photo.annotations.filter(function(a) { return a.id !== annotId; }) : [];
  await _db.collection('shootPhotos').doc(env + '_' + slug + '_' + photoId).update({ annotations });
  if (photo) photo.annotations = annotations;
}

async function addCollection(slug, name, photoIds) {
  var env = getEnv();
  var { FieldValue } = require('firebase-admin/firestore');
  var doc = { env, shootSlug: slug, name: name, photoIds: photoIds, createdAt: FieldValue.serverTimestamp() };
  var ref = await _db.collection('shootCollections').add(doc);
  var withId = Object.assign({}, doc, { id: ref.id, createdAt: new Date() });
  if (_cache && _cache[slug]) {
    _cache[slug].collections = [withId].concat(_cache[slug].collections || []);
  }
  return withId;
}

function getCollections(slug) {
  var shoot = (_cache || {})[slug];
  return shoot ? (shoot.collections || []) : [];
}

async function deleteShoot(slug) {
  var env = getEnv();
  var shoot = getShoot(slug);
  var photoIds = shoot ? shoot.photoOrder : [];
  await Promise.all(
    photoIds.map(function(id) {
      return _db.collection('shootPhotos').doc(env + '_' + slug + '_' + id).delete();
    })
  );
  // clean up the reverse side of any "related shoots" links pointing at this one
  var relatedBack = (shoot && shoot.relatedShoots) || [];
  if (relatedBack.length) {
    var { FieldValue } = require('firebase-admin/firestore');
    await Promise.all(relatedBack.map(function(otherSlug) {
      return _db.collection('shoots').doc(env + '_' + otherSlug).update({
        relatedShoots: FieldValue.arrayRemove(slug),
      }).then(function() {
        if (_cache && _cache[otherSlug]) {
          _cache[otherSlug].relatedShoots = (_cache[otherSlug].relatedShoots || []).filter(function(s) { return s !== slug; });
        }
      }).catch(function() {});
    }));
  }
  await _db.collection('shoots').doc(env + '_' + slug).delete();
  if (_cache) delete _cache[slug];
}

module.exports = { initFromFirestore, getData, getShoot, createShoot, saveShoot, setRelatedShoots, addPhoto, updatePhoto, updatePhotoSeo, updatePhotoFaces, removePhoto, reorderPhotos, addAnnotation, moveAnnotation, removeAnnotation, deleteShoot, addCollection, getCollections };
