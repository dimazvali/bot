'use strict';
// Checks all photos via Google Vision Web Detection and stores new hits in Firestore.
// Requires Vision API to be enabled: console.cloud.google.com/apis/library/vision.googleapis.com
// Run: PHOTO_ENV=prod node scripts/copyright-check.js
require('dotenv').config();

var https = require('https');
var crypto = require('crypto');
var { google } = require('googleapis');
var { initializeApp, getApps, cert } = require('firebase-admin/app');
var { getFirestore } = require('firebase-admin/firestore');
var { initFromFirestore, getData } = require('../lib/photo-data');
var mailer = require('../lib/photo-mailer');

var SKIP_DOMAINS = ['photo.dimazvali.com', 'dimazvalimisc', 'storage.googleapis.com', 'googleusercontent.com'];

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

var auth = new google.auth.GoogleAuth({
  credentials: {
    type: 'service_account',
    project_id: 'dimazvalimisc',
    private_key: process.env.sssGCPKey.replace(/\\n/g, '\n'),
    client_email: 'firebase-adminsdk-4iwd4@dimazvalimisc.iam.gserviceaccount.com',
  },
  scopes: ['https://www.googleapis.com/auth/cloud-vision'],
});

function urlHash(url) {
  return crypto.createHash('sha256').update(url).digest('hex').slice(0, 12);
}

function isOwnUrl(url) {
  return SKIP_DOMAINS.some(function(d) { return url.includes(d); });
}

async function detectWeb(imageUrl) {
  var client = await auth.getClient();
  var token = (await client.getAccessToken()).token;

  return new Promise(function(resolve, reject) {
    var body = JSON.stringify({
      requests: [{
        image: { source: { imageUri: imageUrl } },
        features: [{ type: 'WEB_DETECTION', maxResults: 20 }],
      }],
    });

    var req = https.request({
      method: 'POST',
      hostname: 'vision.googleapis.com',
      path: '/v1/images:annotate',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, function(res) {
      var chunks = [];
      res.on('data', function(c) { chunks.push(c); });
      res.on('end', function() {
        try {
          var data = JSON.parse(Buffer.concat(chunks).toString());
          if (data.error) return reject(new Error(data.error.message));
          resolve(data.responses && data.responses[0] ? data.responses[0].webDetection || {} : {});
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function processPhoto(photo, countryKey, seriesKey, env, newHits) {
  var imageUrl = photo.urls && (photo.urls.full || photo.urls.preview);
  if (!imageUrl) return;

  var detection = await detectWeb(imageUrl);
  var now = new Date();
  var seen = new Set();

  var candidates = [];

  // Only exact image matches — pagesWithMatchingImages produces too many false positives
  for (var img of (detection.fullMatchingImages || [])) {
    if (!isOwnUrl(img.url) && !seen.has(img.url)) {
      seen.add(img.url);
      candidates.push({ matchUrl: img.url, pageUrl: null, pageTitle: null, matchType: 'full_image' });
    }
  }

  for (var match of candidates) {
    var docId = env + '_' + photo.id + '_' + urlHash(match.matchUrl);
    var ref = fb.collection('photo_copyright_hits').doc(docId);
    var snap = await ref.get();

    if (!snap.exists) {
      await ref.set({
        env,
        photoId: photo.id,
        photoTitle: photo.title || '',
        countryKey,
        seriesKey,
        imageUrl,
        matchUrl: match.matchUrl,
        pageUrl: match.pageUrl,
        pageTitle: match.pageTitle,
        matchType: match.matchType,
        firstSeen: now,
        lastSeen: now,
        notified: false,
      });
      newHits.push({ photo, countryKey, seriesKey, matchUrl: match.matchUrl, pageTitle: match.pageTitle, matchType: match.matchType });
    } else {
      await ref.update({ lastSeen: now });
    }
  }
}

async function run() {
  await initFromFirestore(fb);
  mailer.init();

  var data = getData();
  var env = process.env.PHOTO_ENV || 'dev';

  var todos = [];
  for (var countryKey of Object.keys(data)) {
    var country = data[countryKey];
    if (country.archived) continue;
    for (var seriesKey of Object.keys(country.series)) {
      var series = country.series[seriesKey];
      if (series.archived) continue;
      for (var photo of series.photos) {
        if (photo.urls) todos.push({ photo: photo, countryKey: countryKey, seriesKey: seriesKey });
      }
    }
  }

  console.log('Checking ' + todos.length + ' photos (env=' + env + ')...');
  var newHits = [];
  var done = 0, errors = 0;

  for (var i = 0; i < todos.length; i++) {
    var item = todos[i];
    try {
      await processPhoto(item.photo, item.countryKey, item.seriesKey, env, newHits);
      done++;
    } catch (e) {
      errors++;
      process.stderr.write('\nError [' + item.photo.id + ']: ' + e.message + '\n');
    }
    process.stdout.write('\r[' + (done + errors) + '/' + todos.length + '] done, ' + newHits.length + ' new hits');
    await new Promise(function(r) { setTimeout(r, 1100); });
  }

  console.log('\nDone: ' + done + ', errors: ' + errors + ', new hits: ' + newHits.length);

  if (newHits.length > 0) {
    await mailer.sendCopyrightAlert(newHits);
    var notifyOps = newHits.map(function(h) {
      var docId = env + '_' + h.photo.id + '_' + urlHash(h.matchUrl);
      return fb.collection('photo_copyright_hits').doc(docId).update({ notified: true });
    });
    await Promise.all(notifyOps);
    console.log('Hits marked as notified.');
  }
}

run().then(function() { process.exit(0); }).catch(function(e) { console.error(e); process.exit(1); });
