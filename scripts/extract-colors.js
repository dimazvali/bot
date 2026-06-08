'use strict';
var https = require('https');
var { initializeApp, getApps, cert } = require('firebase-admin/app');
var { getFirestore } = require('firebase-admin/firestore');
var { initFromFirestore, getData, saveData } = require('../lib/photo-data');
var { extractColorFamily } = require('../lib/color-utils');

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

function downloadBuffer(url) {
  return new Promise(function(resolve, reject) {
    https.get(url, function(res) {
      var chunks = [];
      res.on('data', function(c) { chunks.push(c); });
      res.on('end', function() { resolve(Buffer.concat(chunks)); });
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function run() {
  await initFromFirestore(fb);
  var data = getData();

  var todos = [];
  for (var countryKey of Object.keys(data)) {
    var country = data[countryKey];
    for (var seriesKey of Object.keys(country.series)) {
      for (var photo of country.series[seriesKey].photos) {
        if (!photo.colorFamily && photo.urls && photo.urls.preview) {
          todos.push(photo);
        }
      }
    }
  }

  console.log('Processing ' + todos.length + ' photos...');
  var done = 0, skipped = 0;

  for (var i = 0; i < todos.length; i += 5) {
    var batch = todos.slice(i, i + 5);
    await Promise.all(batch.map(async function(photo) {
      try {
        var buf = await downloadBuffer(photo.urls.preview);
        photo.colorFamily = await extractColorFamily(buf);
        done++;
      } catch (e) {
        skipped++;
        process.stderr.write('\nSkipped ' + photo.id + ': ' + e.message + '\n');
      }
    }));
    process.stdout.write('\r[' + (done + skipped) + '/' + todos.length + '] processed');
  }

  console.log('\nDone: ' + done + ', skipped: ' + skipped);
  saveData(data);
  console.log('Saved. Waiting for Firestore sync...');
  await new Promise(function(r) { setTimeout(r, 5000); });
  console.log('Migration complete.');
}

run().then(function() { process.exit(0); }).catch(function(e) { console.error(e); process.exit(1); });
