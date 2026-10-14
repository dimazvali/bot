'use strict';
// Re-runs face recognition for what isn't recognised yet, across all shoots:
//   • photos never indexed (no `faces` field) — detected from the 800px preview, as on upload;
//   • faces not tied to a person and not hand-set — fresh match list, linked to the first named
//     person among ALL matches (photoPeople.refreshFaceMatches).
// Named / hand-set faces are left alone. ~$0.001 per Rekognition call.
// The running server caches shoots + people in memory: restart it after this, and don't edit
// faces in the admin meanwhile (its stale copy would overwrite the new links).
// Run: PHOTO_ENV=prod node scripts/rerun-unrecognized-faces.js   (optional SHOOT=<slug>)
require('dotenv').config();

var axios = require('axios');
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
  var slugs = process.env.SHOOT ? [process.env.SHOOT] : Object.keys(data);
  var total = { indexed: 0, newFaces: 0, searched: 0, linked: 0, errors: 0 };

  for (var slug of slugs) {
    var shoot = data[slug];
    if (!shoot) { console.error('No shoot ' + slug); continue; }
    var before = photoPeople.groupShootFaces(slug, shoot).length;
    var s = { indexed: 0, newFaces: 0, searched: 0, linked: 0, errors: 0 };
    for (var photo of shoot.photos) {
      try {
        if (!photo.faces) {
          var src = photo.urls && (photo.urls.preview || photo.urls.full);
          if (!src) continue;
          var img = await axios.get(src, { responseType: 'arraybuffer', timeout: 20000 });
          var found = await photoPeople.indexAndMatchFaces(Buffer.from(img.data));
          await shoots.updatePhotoFaces(slug, photo.id, found);
          s.indexed++; s.newFaces += found.length;
          s.linked += found.filter(function(f) { return f.personId; }).length;
          continue;
        }
        var todo = photo.faces.filter(function(f) { return !f.personId && !f.manual; });
        if (!todo.length) continue;
        var refreshed = {};
        (await photoPeople.refreshFaceMatches(todo)).forEach(function(f) { refreshed[f.faceId] = f; });
        s.searched += todo.length;
        s.linked += Object.values(refreshed).filter(function(f) { return f.personId; }).length;
        await shoots.updatePhotoFaces(slug, photo.id, photo.faces.map(function(f) { return refreshed[f.faceId] || f; }));
      } catch (e) {
        s.errors++;
        console.error('  ' + slug + '/' + photo.id + ': ' + e.message);
      }
    }
    Object.keys(s).forEach(function(k) { total[k] += s[k]; });
    if (s.indexed || s.searched) {
      console.log(slug + ': indexed ' + s.indexed + ' photos (+' + s.newFaces + ' faces), searched ' + s.searched
        + ', linked to people ' + s.linked + ', groups ' + before + ' -> ' + photoPeople.groupShootFaces(slug, shoot).length
        + (s.errors ? ', errors ' + s.errors : ''));
    }
  }
  console.log('TOTAL', JSON.stringify(total), '≈ $' + ((total.indexed + total.searched + total.newFaces) * 0.001).toFixed(2));
}

run().then(function() { process.exit(0); }).catch(function(e) { console.error(e); process.exit(1); });
