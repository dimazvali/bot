'use strict';
// Indexes faces for previously uploaded shoot photos that don't have them yet.
// Run: PHOTO_ENV=prod node scripts/index-shoot-faces.js
// Optional: LIMIT=5 to cap how many photos to process, PUBLIC_ONLY=1 to scope to public shoots.
require('dotenv').config();

var { initializeApp, getApps, cert } = require('firebase-admin/app');
var { getFirestore } = require('firebase-admin/firestore');
var axios = require('axios');
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

  var publicOnly = process.env.PUBLIC_ONLY === '1';
  var todos = [];
  Object.keys(data).forEach(function(slug) {
    var shoot = data[slug];
    if (publicOnly && !shoot.public) return;
    shoot.photos.forEach(function(photo) {
      if (photo.urls && !photo.faces) todos.push({ slug: slug, photo: photo });
    });
  });

  var limit = parseInt(process.env.LIMIT, 10);
  if (!isNaN(limit)) todos = todos.slice(0, limit);

  console.log('Indexing faces for ' + todos.length + ' shoot photos...');
  var done = 0, errors = 0;

  for (var i = 0; i < todos.length; i++) {
    var item = todos[i];
    try {
      var response = await axios.get(item.photo.urls.preview, { responseType: 'arraybuffer', timeout: 20000 });
      var buf = Buffer.from(response.data);
      var faces = await photoPeople.indexAndMatchFaces(buf);
      await shoots.updatePhotoFaces(item.slug, item.photo.id, faces);
      done++;
      var names = photoPeople.resolvePhotoPeopleNames({ faces: faces });
      console.log('[' + (done + errors) + '/' + todos.length + '] ' + item.slug + '/' + item.photo.id + ': ' + faces.length + ' faces' + (names.length ? ' (' + names.join(', ') + ')' : ''));
    } catch (e) {
      errors++;
      console.error('[' + (done + errors) + '/' + todos.length + '] ERROR ' + item.slug + '/' + item.photo.id + ': ' + e.message);
    }
    await new Promise(function(r) { setTimeout(r, 300); });
  }

  console.log('Done: ' + done + ', errors: ' + errors);
}

run().then(function() { process.exit(0); }).catch(function(e) { console.error(e); process.exit(1); });
