'use strict';
// One-off: enrich + classify + venue-link every existing tbilisiEvents doc that
// has no enrichedAt yet. Idempotent — re-running skips already-enriched events.
// Images are NOT backfilled (that needs re-fetching every source post); populate
// images via go-forward collection or the admin "Подтянуть картинку" button.
//
// Run:  node scripts/tbilisi-events-backfill.js
require('dotenv').config();
var { initializeApp, getApps, cert } = require('firebase-admin/app');
var { getFirestore } = require('firebase-admin/firestore');
var data = require('../lib/tbilisi-events-data');
var venues = require('../lib/tbilisi-events-venues');
var enricher = require('../lib/tbilisi-events-enricher');

var app = getApps().find(function(a) { return a.name === 'tbilisiEvents'; }) || initializeApp({
  credential: cert({
    type: 'service_account',
    project_id: 'dimazvalimisc',
    private_key_id: '5eb5025afc0fe53b63f518ba071f89e7b7ce03af',
    private_key: (process.env.sssGCPKey || '').replace(/\\n/g, '\n'),
    client_email: 'firebase-adminsdk-4iwd4@dimazvalimisc.iam.gserviceaccount.com',
    client_id: '110523994931477712119',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-4iwd4%40dimazvalimisc.iam.gserviceaccount.com',
  }),
}, 'tbilisiEvents');

data.init(getFirestore(app));

(async function() {
  var all = await data.getAllEvents();
  var done = 0, skipped = 0, failed = 0;
  for (var i = 0; i < all.length; i++) {
    var e = all[i];
    var tag = '[' + (i + 1) + '/' + all.length + '] ' + e.title;
    if (e.enrichedAt) { skipped++; continue; }
    try {
      if (!e.venueId) {
        var vid = await venues.resolveVenue(e.place);
        if (vid) await data.updateEvent(e.id, { venueId: vid });
      }
      var enr = await enricher.enrichEvent({
        title: e.title, place: e.place, rawExcerpt: e.rawExcerpt || '',
        type: e.type, language: e.language,
      });
      await data.updateEvent(e.id, {
        description: enr.description, type: enr.type, language: enr.language, enrichedAt: new Date(),
      });
      done++;
      console.log(tag + ' — ok');
    } catch (err) {
      failed++;
      console.error(tag + ' — FAILED: ' + err.message);
    }
  }
  console.log('\ndone=' + done + ' skipped=' + skipped + ' failed=' + failed);
  process.exit(0);
})();
