'use strict';
// Backfills seo_desc/seo_keywords for previously uploaded shoot photos that don't have them yet.
// Run: PHOTO_ENV=prod node scripts/generate-shoot-seo.js
require('dotenv').config();

var { initializeApp, getApps, cert } = require('firebase-admin/app');
var { getFirestore } = require('firebase-admin/firestore');
var shoots = require('../lib/photo-shoots');
var { generatePhotoSeo } = require('../lib/photo-seo');

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

var CONTEXT_WINDOW = 6;

async function run() {
  await shoots.initFromFirestore(fb);
  var data = shoots.getData();

  // Flatten in shoot -> photo order, so processing preserves sequence within each shoot.
  var publicOnly = process.env.PUBLIC_ONLY === '1';
  var todos = [];
  Object.keys(data).forEach(function(slug) {
    var shoot = data[slug];
    if (publicOnly && !shoot.public) return;
    shoot.photos.forEach(function(photo) {
      if (photo.urls) todos.push({ slug: slug, shoot: shoot, photo: photo });
    });
  });

  var limit = parseInt(process.env.LIMIT, 10);
  var toGenerate = todos.filter(function(t) { return !t.photo.seo_desc; });
  if (!isNaN(limit)) toGenerate = toGenerate.slice(0, limit);
  var generateIds = new Set(toGenerate.map(function(t) { return t.slug + '/' + t.photo.id; }));

  console.log('Generating SEO for ' + toGenerate.length + ' shoot photos...');
  var done = 0, errors = 0;
  var captionsBySlug = {};

  for (var i = 0; i < todos.length; i++) {
    var item = todos[i];
    var key = item.slug + '/' + item.photo.id;
    if (!captionsBySlug[item.slug]) captionsBySlug[item.slug] = [];

    if (!generateIds.has(key)) {
      // Already has a caption — keep it as context for later photos, skip generation.
      if (item.photo.seo_desc) captionsBySlug[item.slug].push(item.photo.seo_desc);
      continue;
    }

    try {
      var result = await generatePhotoSeo(item.photo, {
        countryLabel: item.shoot.label,
        seriesLabel: item.shoot.label,
        allTags: {},
        shootDesc: item.shoot.desc,
        previousCaptions: captionsBySlug[item.slug].slice(-CONTEXT_WINDOW),
      });
      await shoots.updatePhotoSeo(item.slug, item.photo.id, result.desc, result.keywords);
      captionsBySlug[item.slug].push(result.desc);
      done++;
      console.log('[' + (done + errors) + '/' + toGenerate.length + '] ' + key + ': ' + result.desc);
    } catch (e) {
      errors++;
      console.error('[' + (done + errors) + '/' + toGenerate.length + '] ERROR ' + key + ': ' + e.message);
    }
    await new Promise(function(r) { setTimeout(r, 300); });
  }

  console.log('Done: ' + done + ', errors: ' + errors);
}

run().then(function() { process.exit(0); }).catch(function(e) { console.error(e); process.exit(1); });
