'use strict';
// Hand-translated EN labels for the real prod 'tags' Firestore collection.
// Only fills label_en/desc_en that are currently empty — safe to re-run.
// Run: PHOTO_ENV=prod node scripts/translate-prod-tags.js
require('dotenv').config();

var { initializeApp, getApps, cert } = require('firebase-admin/app');
var { getFirestore } = require('firebase-admin/firestore');
var photoTags = require('../lib/photo-tags');

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

var LABELS = {
  antoschenko: 'Egor Antoshchenko',
  asiko: 'Alisa Shestakova',
  cablecars: 'Cable cars',
  chronicles: 'Chronicles of Georgia',
  cocktails: 'cocktails',
  'kartvlis-deda': 'Mother Georgia',
  lilia: 'Lilia Yugova',
  mountains: 'Mountains',
  mtkvari: 'Mtkvari',
  mzm: 'My name is Masha',
  night: 'Night',
  peacebridge: 'Bridge of Peace',
  phil: 'Philip Parker',
  rufin: 'Aya Rufin',
  sameba: 'Sameba',
  simon: 'Ivan Simon',
  tavisupleba: 'Freedom',
  tbilisea: 'Tbilisi Sea',
  'tbilisi-protest': 'Tbilisi protests',
  tim: 'Timofey Khmelev',
  vake: 'Vake',
  winter: 'Winter',
  zarina: 'Zarina Khazrat',
};

async function run() {
  await photoTags.initTagsFromFirestore(fb);
  var tags = photoTags.getTags();
  var done = 0, skipped = 0, missing = [];

  Object.keys(LABELS).forEach(function(slug) {
    if (!tags[slug]) { missing.push(slug); return; }
    if (tags[slug].label_en) { skipped++; return; }
    tags[slug].label_en = LABELS[slug];
    done++;
  });

  photoTags.saveTags(tags);
  console.log('tags updated:', done, '| already translated:', skipped, '| not found:', missing.length);
  if (missing.length) console.log('missing:', missing.join(', '));
}

run().then(function() { setTimeout(function() { process.exit(0); }, 2000); }).catch(function(e) { console.error('ERROR', e); process.exit(1); });
