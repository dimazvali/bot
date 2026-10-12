'use strict';
// Fills face.matchedFaceIds (every match above MATCH_THRESHOLD, not just the best one)
// for already-indexed shoot faces, so groupShootFaces can cluster faces whose single
// best match happened to be in another shoot.
// Run: PHOTO_ENV=prod node scripts/backfill-face-matches.js
// Optional: SHOOT=<slug> to limit to one shoot, DRY=1 to only print the resulting groups.
require('dotenv').config();

var { initializeApp, getApps, cert } = require('firebase-admin/app');
var { getFirestore } = require('firebase-admin/firestore');
var shoots = require('../lib/photo-shoots');
var photoPeople = require('../lib/photo-people');

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
var DRY = !!process.env.DRY;

async function run() {
  await shoots.initFromFirestore(fb);
  await photoPeople.initFromFirestore(fb);
  var data = shoots.getData();
  var slugs = process.env.SHOOT ? [process.env.SHOOT] : Object.keys(data);

  for (var slug of slugs) {
    var shoot = data[slug];
    if (!shoot) { console.error('No shoot ' + slug); continue; }
    var before = photoPeople.groupShootFaces(slug, shoot).length;
    var errors = 0;
    for (var photo of shoot.photos) {
      if (!photo.faces || !photo.faces.length) continue;
      var faces = [];
      for (var f of photo.faces) {
        try {
          var matches = await photoPeople.findMatches(f.faceId);
          faces.push(Object.assign({}, f, { matchedFaceIds: matches.map(function(m) { return m.faceId; }) }));
        } catch (e) {
          errors++;
          console.error(slug + '/' + photo.id + '/' + f.faceId + ': ' + e.message);
          faces.push(f);
        }
        await new Promise(function(r) { setTimeout(r, 200); });
      }
      if (DRY) photo.faces = faces; // in-memory only, for the group count below
      else await shoots.updatePhotoFaces(slug, photo.id, faces);
    }
    var after = photoPeople.groupShootFaces(slug, shoot).length;
    if (before || after) console.log(slug + ': groups ' + before + ' -> ' + after + (errors ? ' (' + errors + ' errors)' : '') + (DRY ? ' [dry]' : ''));
  }
}

run().then(function() { process.exit(0); }).catch(function(e) { console.error(e); process.exit(1); });
