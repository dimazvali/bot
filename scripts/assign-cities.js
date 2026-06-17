'use strict';
require('dotenv').config({ path: __dirname + '/../.env' });

var admin = require('firebase-admin');

var DRY_RUN = process.env.DRY_RUN !== 'false';

var gcp = admin.apps.find(function(a) { return a.name === 'dimazvali-script'; });
if (!gcp) {
  gcp = admin.initializeApp({
    credential: admin.credential.cert({
      type: 'service_account',
      project_id: 'dimazvalimisc',
      private_key_id: '5eb5025afc0fe53b63f518ba071f89e7b7ce03af',
      private_key: (process.env.sssGCPKey || '').replace(/\\n/g, '\n'),
      client_email: 'firebase-adminsdk-4iwd4@dimazvalimisc.iam.gserviceaccount.com',
      client_id: '110523994931477712119',
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
    }),
    databaseURL: 'https://rrspecialsapi.firebaseio.com',
  }, 'dimazvali-script');
}

var db = admin.firestore(gcp);
var cities = db.collection('DIMAZVALIcities');
var landMarks = db.collection('DIMAZVALIlandMarks');

var CENTERS = {
  'Москва':            { lat: 55.7558, lng: 37.6173 },
  'Санкт-Петербург':   { lat: 59.9311, lng: 30.3609 },
  'Тбилиси':           { lat: 41.6938, lng: 44.8015 },
};

function haversine(lat1, lng1, lat2, lng2) {
  var R = 6371;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLng = (lng2 - lng1) * Math.PI / 180;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function run() {
  var citySnap = await cities.get();
  var slugByName = {};
  citySnap.docs.forEach(function(d) {
    var data = d.data();
    slugByName[data.name] = d.id;
  });
  console.log('Cities found:', JSON.stringify(slugByName));

  var centerBySlug = {};
  Object.keys(CENTERS).forEach(function(name) {
    var slug = slugByName[name];
    if (slug) centerBySlug[slug] = CENTERS[name];
    else console.warn('WARNING: city not found in Firestore:', name);
  });

  var slugs = Object.keys(centerBySlug);
  if (!slugs.length) {
    console.error('No cities matched. Check city names in Firestore.');
    process.exit(1);
  }

  var landSnap = await landMarks.get();
  var updates = [];

  landSnap.docs.forEach(function(d) {
    var l = d.data();
    if (l.city) {
      console.log('SKIP (already set):', l.name, '→', l.city);
      return;
    }
    if (!l.lat || !l.lng) {
      console.log('SKIP (no coords):', l.name);
      return;
    }
    var lat = +l.lat, lng = +l.lng;
    var best = null, bestDist = Infinity;
    slugs.forEach(function(slug) {
      var c = centerBySlug[slug];
      var dist = haversine(lat, lng, c.lat, c.lng);
      if (dist < bestDist) { bestDist = dist; best = slug; }
    });
    updates.push({ id: d.id, name: l.name, city: best, dist: bestDist });
  });

  updates.forEach(function(u) {
    console.log(
      (u.name || u.id).padEnd(30),
      '→', u.city.padEnd(20),
      '(' + u.dist.toFixed(1) + ' km)'
    );
  });

  if (DRY_RUN) {
    console.log('\n[DRY_RUN=true] No writes. Run with DRY_RUN=false to apply.');
    process.exit(0);
  }

  await Promise.all(updates.map(function(u) {
    return landMarks.doc(u.id).update({ city: u.city });
  }));
  console.log('\nDone. Updated', updates.length, 'landmarks.');
  process.exit(0);
}

run().catch(function(err) { console.error(err); process.exit(1); });
