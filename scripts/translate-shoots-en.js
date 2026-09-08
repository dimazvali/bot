'use strict';
// Writes hand-translated English shoot labels/descriptions into Firestore.
// Unlike an earlier version of this script, this does NOT call any translation
// API — the TRANSLATIONS table below was translated directly by Claude in the
// conversation that authored it. Only fills fields that are currently empty
// (skips anything that already has a label_en/desc_en) — safe to re-run.
// Run: PHOTO_ENV=prod node scripts/translate-shoots-en.js
require('dotenv').config();

var { initializeApp, getApps, cert } = require('firebase-admin/app');
var { getFirestore } = require('firebase-admin/firestore');
var shoots = require('../lib/photo-shoots');

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

// slug -> { label_en?, desc_en? }. Only the fields actually needing translation
// are listed per slug (shoots/photos already in English are left alone).
var TRANSLATIONS = {
  '9line': { desc_en: '9line concert at Deda Ena park' },
  'apps': { label_en: 'aksenov and ponomarev at the paper garden' },
  'asiko-260725': { label_en: 'Asya at Chronicles', desc_en: 'Chronicles of Georgia' },
  'asiko-260726': { label_en: 'Asya 260726' },
  'asiko-2608-misc': { label_en: 'Asya 2608 (misc)' },
  'asiko-260806': { label_en: 'Asya 260806' },
  'asiko-260807': { label_en: 'Asya at Tbilisi Sea' },
  'asiko-260812': { label_en: 'Asya in Mtskheta' },
  'chronicles-260725': { label_en: 'Asya in Chronicles' },
  'goodminton': { label_en: 'holy badmintonita' },
  'hurmoed': { label_en: 'Artem Gol @ papers 260804' },
  'kvartirnik-pelamushi-260720': { desc_en: "Charity concert by Andrey Aksenov and Alexey Ponomarev at Tbilisi's Pelamushi café, July 20, 2026." },
  'libolibo-bd-260718': { label_en: 'libolibo at the paper garden 260718' },
  'lions-of-rock-26': { desc_en: 'Rock festival, August 13-16, 2026, in Poti, Adjara.' },
  'menyazovutmasha': { desc_en: "Concert by Masha Rodicheva (menyazovutmasha) at Tbilisi's Pelamushi café, August 2, 2026." },
  'mtatsminda-260625': { label_en: 'Vanya on the mountain' },
  'papers-160711': { label_en: 'norway-england 260711 @papers' },
  'papers-260725': { label_en: 'hangout at papers 260725' },
  'papers-k4': { label_en: '4 years of papers kartuli' },
  'tbilisea-26-06-06': { label_en: 'Peaches', desc_en: 'Tbilisi Sea' },
  'world-cup-final': { desc_en: 'Central Tbilisi, an hour and a half before kickoff of the World Cup final (Spain vs Argentina)' },
  'zrya-2607-done': { label_en: 'Alexey Ponomarev — promo for Israeli concerts' },
};

async function run() {
  await shoots.initFromFirestore(fb);
  var data = shoots.getData();

  var done = 0, skipped = 0, missing = 0;

  for (var slug of Object.keys(TRANSLATIONS)) {
    var shoot = data[slug];
    if (!shoot) { console.log('[skip] ' + slug + ': not found in Firestore'); missing++; continue; }

    var wanted = TRANSLATIONS[slug];
    var patch = {};
    if (wanted.label_en && !shoot.label_en) patch.label_en = wanted.label_en;
    if (wanted.desc_en && !shoot.desc_en) patch.desc_en = wanted.desc_en;

    if (!Object.keys(patch).length) { console.log('[skip] ' + slug + ': already translated'); skipped++; continue; }

    await shoots.saveShoot(slug, patch);
    done++;
    console.log('[done] ' + slug + ': ' + JSON.stringify(patch));
  }

  console.log('Done. Written: ' + done + ', already had translations: ' + skipped + ', not found: ' + missing);
}

run().then(function() { process.exit(0); }).catch(function(e) { console.error(e); process.exit(1); });
