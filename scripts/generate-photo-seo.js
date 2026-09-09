/**
 * Batch AI SEO generation for gallery photos (countries/series/photos in
 * Firestore) without seo_keywords. Reads and writes Firestore directly — no
 * local data file.
 * Usage:
 *   PHOTO_ENV=prod node scripts/generate-photo-seo.js           — process all without seo_keywords
 *   PHOTO_ENV=prod node scripts/generate-photo-seo.js --all      — regenerate everything
 *   PHOTO_ENV=prod node scripts/generate-photo-seo.js --dry-run  — preview only
 */
require('dotenv').config();

var { initializeApp, getApps, cert } = require('firebase-admin/app');
var { getFirestore } = require('firebase-admin/firestore');
var photoData = require('../lib/photo-data');
var photoTags = require('../lib/photo-tags');
var { generatePhotoSeo } = require('../lib/photo-seo');

var DRY_RUN = process.argv.includes('--dry-run');
var FORCE_ALL = process.argv.includes('--all');
var DELAY_MS = 300; // avoid hammering the API

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

function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set');
    process.exit(1);
  }

  await Promise.all([photoData.initFromFirestore(fb), photoTags.initTagsFromFirestore(fb)]);
  var data = photoData.getData();
  var allTags = photoTags.getTags();

  var total = 0, processed = 0, skipped = 0, errors = 0;

  for (var countryKey of Object.keys(data)) {
    var country = data[countryKey];
    if (country.archived) continue;

    for (var seriesKey of Object.keys(country.series || {})) {
      var series = country.series[seriesKey];
      if (series.archived) continue;

      for (var photo of (series.photos || [])) {
        total++;
        var needsSeo = FORCE_ALL || !photo.seo_keywords;
        if (!needsSeo) { skipped++; continue; }

        var label = photo.title + ' / ' + series.label + ' / ' + country.label;
        if (DRY_RUN) {
          console.log('[dry-run] would generate:', label);
          processed++;
          continue;
        }

        process.stdout.write('  ' + label + ' … ');
        try {
          var result = await generatePhotoSeo(photo, {
            countryLabel: country.label,
            seriesLabel: series.label,
            allTags,
          });
          var descPatch = photo.desc ? {} : { desc: result.desc };
          Object.assign(photo, descPatch, { seo_keywords: result.keywords });
          console.log('ok');
          processed++;
          await sleep(DELAY_MS);
        } catch (e) {
          console.log('ERROR:', e.message);
          errors++;
          await sleep(1000);
        }
      }
    }
  }

  if (!DRY_RUN && processed > 0) {
    photoData.saveData(data);
    console.log('\nSaved to Firestore (env=' + (process.env.PHOTO_ENV || 'dev') + ')');
    await sleep(2000); // let the async Firestore sync in saveData() flush before exit
  }

  console.log(`\nИтого: ${total} фото | обработано: ${processed} | пропущено: ${skipped} | ошибок: ${errors}`);
}

main().then(function() { process.exit(0); }).catch(function(e) { console.error(e); process.exit(1); });
