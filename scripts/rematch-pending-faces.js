'use strict';
// Re-runs face matching (at the current MATCH_THRESHOLD) for already-indexed
// faces that aren't linked to a named person yet, in case the threshold
// changed since they were originally indexed, or a person got named after.
// Run: PHOTO_ENV=prod node scripts/rematch-pending-faces.js
// Optional: LIMIT=5 to cap how many pending faces to check.
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

async function run() {
  await shoots.initFromFirestore(fb);
  await photoPeople.initFromFirestore(fb);
  var data = shoots.getData();

  var todos = [];
  Object.keys(data).forEach(function(slug) {
    data[slug].photos.forEach(function(photo) {
      (photo.faces || []).forEach(function(face) {
        if (!face.personId) todos.push({ slug: slug, photo: photo, faceId: face.faceId });
      });
    });
  });

  var limit = parseInt(process.env.LIMIT, 10);
  if (!isNaN(limit)) todos = todos.slice(0, limit);

  console.log('Re-checking ' + todos.length + ' pending faces at threshold ' + photoPeople.MATCH_THRESHOLD + '...');
  var linked = 0, unchanged = 0, errors = 0;

  for (var i = 0; i < todos.length; i++) {
    var item = todos[i];
    try {
      var match = await photoPeople.findMatch(item.faceId);
      var person = match ? photoPeople.getPersonByFaceId(match.faceId) : null;
      if (person) await photoPeople.linkFaceToPerson(person.id, item.faceId);
      if (match) {
        var faces = item.photo.faces.map(function(f) {
          if (f.faceId !== item.faceId) return f;
          var updated = Object.assign({}, f, { matchedFaceId: match.faceId });
          if (person) updated.personId = person.id;
          return updated;
        });
        await shoots.updatePhotoFaces(item.slug, item.photo.id, faces);
        item.photo.faces = faces; // keep in-memory copy consistent for any later iterations on the same photo
      }
      if (person) {
        linked++;
        console.log('[' + (linked + unchanged + errors) + '/' + todos.length + '] ' + item.slug + '/' + item.photo.id + '/' + item.faceId + ' -> ' + person.name);
      } else {
        unchanged++;
      }
    } catch (e) {
      errors++;
      console.error('[' + (linked + unchanged + errors) + '/' + todos.length + '] ERROR ' + item.slug + '/' + item.photo.id + '/' + item.faceId + ': ' + e.message);
    }
    await new Promise(function(r) { setTimeout(r, 300); });
  }

  console.log('Done: ' + linked + ' newly linked, ' + unchanged + ' still unmatched, ' + errors + ' errors.');
}

run().then(function() { process.exit(0); }).catch(function(e) { console.error(e); process.exit(1); });
