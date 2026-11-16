'use strict';
// Backfills seo_desc/seo_keywords for previously uploaded shoot photos that don't have them yet.
// Run: PHOTO_ENV=prod node scripts/generate-shoot-seo.js
// Page titles only (frames named by file, caption already there): PHOTO_ENV=prod TITLES=1 [DRY_RUN=1] [LIMIT=n] node scripts/generate-shoot-seo.js
require('dotenv').config();

var { initializeApp, getApps, cert } = require('firebase-admin/app');
var { getFirestore } = require('firebase-admin/firestore');
var shoots = require('../lib/photo-shoots');
var { generatePhotoSeo, generateTitleFromCaption, shootSeoOptions } = require('../lib/photo-seo');
var { isPlaceholder } = require('../lib/photo-title');

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

  // TITLES=1: only the page titles of frames still named by file (_MG_…, IMG_…) that already have a caption
  // — text-only, cheap model, captions untouched. DRY_RUN=1 prints instead of saving.
  if (process.env.TITLES === '1') {
    var dry = process.env.DRY_RUN === '1';
    var need = todos.filter(function(t) {
      // only frames that go to search: public shoot, and with author's pick on — the picked ones
      return shoots.isPhotoIndexable(t.shoot, t.photo)
        && isPlaceholder(t.photo.title) && !t.photo.seo_title && (t.photo.desc || t.photo.seo_desc);
    });
    if (!isNaN(limit)) need = need.slice(0, limit);
    console.log('Generating titles for ' + need.length + ' shoot photos' + (dry ? ' (dry run)' : '') + '...');
    var ok = 0, bad = 0;
    var titlesBySlug = {}; // recent titles per shoot → the model avoids repeating them
    todos.forEach(function(x) { if (x.photo.seo_title) (titlesBySlug[x.slug] = titlesBySlug[x.slug] || []).push(x.photo.seo_title); });
    for (var j = 0; j < need.length; j++) {
      var t = need[j];
      var prevTitles = titlesBySlug[t.slug] || (titlesBySlug[t.slug] = []);
      try {
        // names recognised on the frame are already in its caption (generatePhotoSeo got knownPeople)
        var tt = await generateTitleFromCaption(t.photo, { shootLabel: t.shoot.label, shootDesc: t.shoot.desc, previousTitles: prevTitles.slice(-12) });
        prevTitles.push(tt.title);
        if (!dry) await shoots.updatePhotoSeoTitle(t.slug, t.photo.id, tt.title, tt.titleEn);
        ok++;
        console.log('[' + (ok + bad) + '/' + need.length + '] ' + t.slug + '/' + t.photo.title + ' → ' + tt.title + ' | ' + tt.titleEn);
      } catch (e) {
        bad++;
        console.error('[' + (ok + bad) + '/' + need.length + '] ERROR ' + t.slug + '/' + t.photo.id + ': ' + e.message);
      }
      await new Promise(function(r) { setTimeout(r, 150); });
    }
    console.log('Done: ' + ok + ', errors: ' + bad);
    return;
  }

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
      var result = await generatePhotoSeo(item.photo, shootSeoOptions(item.shoot, item.photo, {
        previousCaptions: captionsBySlug[item.slug].slice(-CONTEXT_WINDOW),
      }));
      await shoots.updatePhotoSeo(item.slug, item.photo.id, result.desc, result.keywords, result.descEn, result.keywordsEn, result.title, result.titleEn);
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
