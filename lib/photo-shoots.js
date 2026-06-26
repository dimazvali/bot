var _cache = null;
var _db = null;
var _env = null;

function getEnv() { return _env || process.env.PHOTO_ENV || 'prod'; }

async function initFromFirestore(db) {
  _db = db;
  _env = process.env.PHOTO_ENV || 'prod';
  var env = _env;

  var [shootSnap, photoSnap] = await Promise.all([
    db.collection('shoots').where('env', '==', env).get(),
    db.collection('shootPhotos').where('env', '==', env).get(),
  ]);

  var result = {};
  shootSnap.docs.forEach(function(doc) {
    var d = doc.data();
    result[d.key] = {
      key: d.key,
      label: d.label || '',
      desc: d.desc || '',
      password: d.password || '',
      photoOrder: d.photoOrder || [],
      photos: [],
    };
  });

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

  _cache = result;
}

function getData() { return _cache || {}; }

function getShoot(slug) { return (_cache || {})[slug] || null; }

async function createShoot(slug, label, desc, password) {
  var env = getEnv();
  var doc = { key: slug, env, label, desc: desc || '', password: password || '', photoOrder: [] };
  await _db.collection('shoots').doc(env + '_' + slug).set(doc);
  if (!_cache) _cache = {};
  _cache[slug] = { ...doc, photos: [] };
}

async function saveShoot(slug, fields) {
  var env = getEnv();
  await _db.collection('shoots').doc(env + '_' + slug).update(fields);
  if (_cache && _cache[slug]) Object.assign(_cache[slug], fields);
}

async function addPhoto(slug, photoEntry) {
  var env = getEnv();
  await _db.collection('shootPhotos').doc(env + '_' + slug + '_' + photoEntry.id).set(
    { env, shootSlug: slug, ...photoEntry }
  );
  if (_cache && _cache[slug]) {
    _cache[slug].photoOrder.push(photoEntry.id);
    _cache[slug].photos.push(photoEntry);
    await _db.collection('shoots').doc(env + '_' + slug).update({ photoOrder: _cache[slug].photoOrder });
  }
}

async function removePhoto(slug, photoId) {
  var env = getEnv();
  await _db.collection('shootPhotos').doc(env + '_' + slug + '_' + photoId).delete();
  if (_cache && _cache[slug]) {
    _cache[slug].photoOrder = _cache[slug].photoOrder.filter(function(id) { return id !== photoId; });
    _cache[slug].photos = _cache[slug].photos.filter(function(p) { return p.id !== photoId; });
    await _db.collection('shoots').doc(env + '_' + slug).update({ photoOrder: _cache[slug].photoOrder });
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

async function deleteShoot(slug) {
  var env = getEnv();
  var shoot = getShoot(slug);
  var photoIds = shoot ? shoot.photoOrder : [];
  await Promise.all(
    photoIds.map(function(id) {
      return _db.collection('shootPhotos').doc(env + '_' + slug + '_' + id).delete();
    })
  );
  await _db.collection('shoots').doc(env + '_' + slug).delete();
  if (_cache) delete _cache[slug];
}

module.exports = { initFromFirestore, getData, getShoot, createShoot, saveShoot, addPhoto, removePhoto, reorderPhotos, deleteShoot };
