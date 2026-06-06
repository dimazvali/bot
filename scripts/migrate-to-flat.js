/**
 * Migrates Firestore from single-document format to flat collections.
 * Deletes: photo_data/dev, photo_data/prod, photo_tags/dev, photo_tags/prod
 * Creates: countries/*, series/*, photos/*, tags/* for dev and prod
 *
 * Usage: node scripts/migrate-to-flat.js
 */

require('dotenv').config();

var fs = require('fs');
var path = require('path');
var { initializeApp, getApps, cert } = require('firebase-admin/app');
var { getFirestore } = require('firebase-admin/firestore');

var photoApp = getApps().find(function (a) { return a.name === 'photo'; }) || initializeApp({
  credential: cert({
    type: 'service_account',
    project_id: 'dimazvalimisc',
    private_key_id: '5eb5025afc0fe53b63f518ba071f89e7b7ce03af',
    private_key: process.env.sssGCPKey.replace(/\\n/g, '\n'),
    client_email: 'firebase-adminsdk-4iwd4@dimazvalimisc.iam.gserviceaccount.com',
    client_id: '110523994931477712119',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-4iwd4%40dimazvalimisc.iam.gserviceaccount.com',
  }),
  storageBucket: process.env.PHOTO_BUCKET,
}, 'photo');

var db = getFirestore(photoApp);

var photoData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/photo.json'), 'utf8'));
var tagsData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/photo-tags.json'), 'utf8'));

function clean(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function toPhotoDocs(obj, env) {
  var docs = [];
  for (var countryKey of Object.keys(obj)) {
    var country = obj[countryKey];
    var series = country.series || {};
    docs.push({
      collection: 'countries',
      id: env + '_' + countryKey,
      data: clean({
        key: countryKey, env,
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
          key: seriesKey, env, countryKey,
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

function toTagDocs(obj, env) {
  return Object.keys(obj).map(function (key) {
    return {
      collection: 'tags',
      id: env + '_' + key,
      data: { key, env, label: obj[key].label },
    };
  });
}

async function batchWrite(docs) {
  for (var i = 0; i < docs.length; i += 490) {
    var batch = db.batch();
    docs.slice(i, i + 490).forEach(function (d) {
      batch.set(db.collection(d.collection).doc(d.id), d.data);
    });
    await batch.commit();
  }
}

async function deleteOldDocs() {
  var refs = [
    db.collection('photo_data').doc('dev'),
    db.collection('photo_data').doc('prod'),
    db.collection('photo_tags').doc('dev'),
    db.collection('photo_tags').doc('prod'),
  ];
  var batch = db.batch();
  refs.forEach(function (ref) { batch.delete(ref); });
  await batch.commit();
  console.log('deleted old photo_data/* and photo_tags/* documents');
}

async function clearFlatCollections(env) {
  var snaps = await Promise.all([
    db.collection('countries').where('env', '==', env).get(),
    db.collection('series').where('env', '==', env).get(),
    db.collection('photos').where('env', '==', env).get(),
    db.collection('tags').where('env', '==', env).get(),
  ]);
  var allDocs = snaps.flatMap(function (s) { return s.docs; });
  for (var i = 0; i < allDocs.length; i += 490) {
    var batch = db.batch();
    allDocs.slice(i, i + 490).forEach(function (d) { batch.delete(d.ref); });
    await batch.commit();
  }
  if (allDocs.length) console.log('cleared ' + allDocs.length + ' existing flat docs for env=' + env);
}

async function migrate() {
  await deleteOldDocs();

  for (var env of ['dev', 'prod']) {
    await clearFlatCollections(env);

    var photoDocs = toPhotoDocs(photoData, env);
    await batchWrite(photoDocs);
    console.log(env + ': wrote ' + photoDocs.length + ' photo docs (countries/series/photos)');

    var tagDocs = toTagDocs(tagsData, env);
    await batchWrite(tagDocs);
    console.log(env + ': wrote ' + tagDocs.length + ' tag docs');
  }

  console.log('\nMigration complete.');
  process.exit(0);
}

migrate().catch(function (err) {
  console.error('Migration failed:', err);
  process.exit(1);
});
