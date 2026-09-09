'use strict';
// Runs the same copyright/usage check as the admin "▶ ПРОВЕРИТЬ" button, from CLI.
// Scans every non-archived series photo AND every shoot photo via Google Vision
// Web Detection, stores new external uses in `photo_copyright_hits`, emails a
// digest. Requires Vision API enabled: console.cloud.google.com/apis/library/vision.googleapis.com
//
//   PHOTO_ENV=prod node scripts/copyright-check.js
require('dotenv').config();

var { initializeApp, getApps, cert } = require('firebase-admin/app');
var { getFirestore } = require('firebase-admin/firestore');
var photoData = require('../lib/photo-data');
var photoShoots = require('../lib/photo-shoots');
var copyrightCheck = require('../lib/photo-copyright-check');
var mailer = require('../lib/photo-mailer');

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

async function run() {
  await Promise.all([photoData.initFromFirestore(fb), photoShoots.initFromFirestore(fb)]);
  mailer.init();

  var started = copyrightCheck.run(fb, photoData.getData(), env, photoShoots.getData());
  if (!started) { console.error('Another check is already running.'); process.exit(1); }

  var lastDone = -1;
  while (true) {
    var s = copyrightCheck.getState();
    if (s.done !== lastDone) {
      lastDone = s.done;
      process.stdout.write('\r[' + s.done + '/' + s.total + '] new: ' + s.newHits + ', errors: ' + s.errors + '   ');
    }
    if (!s.running) {
      console.log('\nDone: ' + s.done + ' checked, ' + s.newHits + ' new uses, ' + s.errors + ' errors'
        + (s.lastError ? ' (last: ' + s.lastError + ')' : ''));
      process.exit(s.errors && !s.done ? 1 : 0);
    }
    await new Promise(function(r) { setTimeout(r, 2000); });
  }
}

run().catch(function(e) { console.error(e); process.exit(1); });
