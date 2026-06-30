'use strict';
// Usage:
//   PHOTO_ENV=dev node scripts/backfill-dimensions.js
//   PHOTO_ENV=prod node scripts/backfill-dimensions.js
require('dotenv').config();

var https = require('https');
var sharp = require('sharp');
var { initializeApp, getApps, cert } = require('firebase-admin/app');
var { getFirestore } = require('firebase-admin/firestore');
var { initFromFirestore, getData, saveData } = require('../lib/photo-data');

var photoApp = getApps().find(function(a) { return a.name === 'photo'; }) || initializeApp({
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

var fb = getFirestore(photoApp);
var env = process.env.PHOTO_ENV || 'dev';

function downloadBuffer(url) {
  return new Promise(function(resolve, reject) {
    https.get(url, function(res) {
      if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
      var chunks = [];
      res.on('data', function(c) { chunks.push(c); });
      res.on('end', function() { resolve(Buffer.concat(chunks)); });
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function getDimensions(url) {
  var buf = await downloadBuffer(url);
  var meta = await sharp(buf).metadata();
  return { width: meta.width, height: meta.height };
}

async function processBatch(items, fn) {
  var done = 0, errors = 0;
  for (var i = 0; i < items.length; i += 5) {
    var batch = items.slice(i, i + 5);
    await Promise.all(batch.map(async function(item) {
      try {
        await fn(item);
        done++;
      } catch (e) {
        errors++;
        process.stderr.write('\n  skip ' + item.id + ': ' + e.message + '\n');
      }
      process.stdout.write('\r  [' + (done + errors) + '/' + items.length + '] processed');
    }));
  }
  return { done, errors };
}

async function runRegularPhotos() {
  console.log('\n── Regular photos (env=' + env + ') ──');
  await initFromFirestore(fb);
  var data = getData();

  var todos = [];
  for (var countryKey of Object.keys(data)) {
    for (var seriesKey of Object.keys(data[countryKey].series || {})) {
      for (var photo of data[countryKey].series[seriesKey].photos) {
        if (!photo.width && photo.urls && (photo.urls.thumb || photo.urls.preview)) {
          todos.push(photo);
        }
      }
    }
  }

  console.log('  Found ' + todos.length + ' photos without dimensions');
  if (!todos.length) return;

  var result = await processBatch(todos, async function(photo) {
    var url = photo.urls.thumb || photo.urls.preview;
    var dims = await getDimensions(url);
    photo.width = dims.width;
    photo.height = dims.height;
  });

  console.log('\n  Done: ' + result.done + ', errors: ' + result.errors);
  saveData(data);
  console.log('  Saved. Waiting for Firestore sync...');
  await new Promise(function(r) { setTimeout(r, 6000); });
}

async function runShoots() {
  console.log('\n── Shoot photos (env=' + env + ') ──');
  var snap = await fb.collection('shootPhotos').where('env', '==', env).get();
  var todos = snap.docs.filter(function(doc) {
    var d = doc.data();
    return !d.width && d.urls && (d.urls.thumb || d.urls.preview);
  });

  console.log('  Found ' + todos.length + ' shoot photos without dimensions');
  if (!todos.length) return;

  var result = await processBatch(todos, async function(doc) {
    var d = doc.data();
    var url = d.urls.thumb || d.urls.preview;
    var dims = await getDimensions(url);
    await doc.ref.update({ width: dims.width, height: dims.height });
  });

  console.log('\n  Done: ' + result.done + ', errors: ' + result.errors);
}

async function run() {
  console.log('Backfilling dimensions for env=' + env);
  await runRegularPhotos();
  await runShoots();
  console.log('\nAll done.');
}

run().then(function() { process.exit(0); }).catch(function(e) { console.error(e); process.exit(1); });
