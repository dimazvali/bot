// Firestore is the sole source of truth for photo.json's former content — no
// local file, no fallback. An env with no 'countries' docs yet just starts
// empty (see initFromFirestore below); populate it via the admin UI.
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
        label_en: country.label_en || '',
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
          label_en: ser.label_en || '',
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
      ...(d.label_en ? { label_en: d.label_en } : {}),
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
      ...(d.label_en ? { label_en: d.label_en } : {}),
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
      _cache = {};
      console.log('[photo-data] no countries for env=' + _env + ' yet — starting empty');
    } else {
      _cache = fromDocuments(countrySnap.docs, seriesSnap.docs, photoSnap.docs);
      console.log('[photo-data] loaded from flat Firestore (env=' + _env
        + ', countries=' + countrySnap.size
        + ', series=' + seriesSnap.size
        + ', photos=' + photoSnap.size + ')');
    }
  } catch (err) {
    console.error('[photo-data] Firestore init error:', err.message);
    if (!_cache) _cache = {};
  }
}

function getData() {
  return _cache || {};
}

function saveData(obj) {
  _cache = obj;
  if (_db) {
    _syncToFirestore(obj).catch(function (err) {
      console.error('[photo-data] Firestore save error:', err.message);
    });
  }
}

module.exports = { getData, saveData, initFromFirestore };
