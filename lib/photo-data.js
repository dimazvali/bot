var fs = require('fs');
var path = require('path');

var DATA_PATH = path.join(__dirname, '../data/photo.json');
var _cache = null;
var _db = null;
var _env = null;

function clean(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function toDocuments(obj, env) {
  var docs = [];
  for (var countryKey of Object.keys(obj)) {
    var country = obj[countryKey];
    var series = country.series || {};
    docs.push({
      collection: 'countries',
      id: env + '_' + countryKey,
      data: clean({
        key: countryKey,
        env,
        label: country.label,
        archived: country.archived || false,
        seriesOrder: country.seriesOrder || Object.keys(series),
      }),
    });
    for (var seriesKey of Object.keys(series)) {
      var ser = series[seriesKey];
      var photos = ser.photos || [];
      docs.push({
        collection: 'series',
        id: env + '_' + countryKey + '_' + seriesKey,
        data: clean({
          key: seriesKey,
          env,
          countryKey,
          label: ser.label,
          archived: ser.archived || false,
          photoOrder: photos.map(function (p) { return p.id; }),
        }),
      });
      for (var photo of photos) {
        docs.push({
          collection: 'photos',
          id: env + '_' + countryKey + '_' + seriesKey + '_' + photo.id,
          data: clean({ env, countryKey, seriesKey, ...photo }),
        });
      }
    }
  }
  return docs;
}

function fromDocuments(countryDocs, seriesDocs, photoDocs) {
  var data = {};

  countryDocs.forEach(function (doc) {
    var d = doc.data();
    data[d.key] = {
      label: d.label,
      ...(d.archived ? { archived: true } : {}),
      ...(d.seriesOrder && d.seriesOrder.length ? { seriesOrder: d.seriesOrder } : {}),
      series: {},
    };
  });

  var photoMap = {};
  photoDocs.forEach(function (doc) {
    var d = doc.data();
    var mapKey = d.countryKey + '/' + d.seriesKey + '/' + d.id;
    var photo = Object.assign({}, d);
    delete photo.env;
    delete photo.countryKey;
    delete photo.seriesKey;
    photoMap[mapKey] = photo;
  });

  seriesDocs.forEach(function (doc) {
    var d = doc.data();
    if (!data[d.countryKey]) return;
    var photos = (d.photoOrder || []).map(function (id) {
      return photoMap[d.countryKey + '/' + d.key + '/' + id] || null;
    }).filter(Boolean);
    data[d.countryKey].series[d.key] = {
      label: d.label,
      ...(d.archived ? { archived: true } : {}),
      photos,
    };
  });

  return data;
}

async function _syncToFirestore(obj) {
  var newDocs = toDocuments(obj, _env);
  var newDocIds = new Set(newDocs.map(function (d) { return d.collection + '/' + d.id; }));

  var [countrySnap, seriesSnap, photoSnap] = await Promise.all([
    _db.collection('countries').where('env', '==', _env).get(),
    _db.collection('series').where('env', '==', _env).get(),
    _db.collection('photos').where('env', '==', _env).get(),
  ]);

  var toDelete = [];
  countrySnap.docs.concat(seriesSnap.docs).concat(photoSnap.docs).forEach(function (doc) {
    var key = doc.ref.parent.id + '/' + doc.id;
    if (!newDocIds.has(key)) toDelete.push(doc.ref);
  });

  var allOps = newDocs.map(function (d) { return { type: 'set', collection: d.collection, id: d.id, data: d.data }; })
    .concat(toDelete.map(function (ref) { return { type: 'delete', ref }; }));

  for (var i = 0; i < allOps.length; i += 490) {
    var batch = _db.batch();
    allOps.slice(i, i + 490).forEach(function (op) {
      if (op.type === 'set') {
        batch.set(_db.collection(op.collection).doc(op.id), op.data);
      } else {
        batch.delete(op.ref);
      }
    });
    await batch.commit();
  }
}

async function initFromFirestore(db) {
  _db = db;
  _env = process.env.PHOTO_ENV || 'dev';
  try {
    var [countrySnap, seriesSnap, photoSnap] = await Promise.all([
      db.collection('countries').where('env', '==', _env).get(),
      db.collection('series').where('env', '==', _env).get(),
      db.collection('photos').where('env', '==', _env).get(),
    ]);
    if (countrySnap.empty) {
      _cache = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
      await _syncToFirestore(_cache);
      console.log('[photo-data] seeded flat Firestore (env=' + _env + ')');
    } else {
      _cache = fromDocuments(countrySnap.docs, seriesSnap.docs, photoSnap.docs);
      console.log('[photo-data] loaded from flat Firestore (env=' + _env
        + ', countries=' + countrySnap.size
        + ', series=' + seriesSnap.size
        + ', photos=' + photoSnap.size + ')');
    }
  } catch (err) {
    console.error('[photo-data] Firestore init error, using local file:', err.message);
    if (!_cache) _cache = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  }
}

function getData() {
  if (!_cache) _cache = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  return _cache;
}

function saveData(obj) {
  _cache = obj;
  fs.writeFileSync(DATA_PATH, JSON.stringify(obj, null, 2), 'utf8');
  if (_db) {
    _syncToFirestore(obj).catch(function (err) {
      console.error('[photo-data] Firestore save error:', err.message);
    });
  }
}

module.exports = { getData, saveData, initFromFirestore };
