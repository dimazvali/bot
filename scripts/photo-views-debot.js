'use strict';
// Reclassify historical bot/crawler hits in `photo_views` and remove their
// contribution from the `photo_stats` counters.
//
//   Dry run (default, writes nothing):
//     PHOTO_ENV=prod node scripts/photo-views-debot.js
//   Apply:
//     PHOTO_ENV=prod node scripts/photo-views-debot.js --commit
//
// Flags:
//   --commit         actually write (flag docs + adjust counters). Without it: report only.
//   --no-heuristic   only reclassify docs that stored a raw `ua` string (authoritative).
//                    Default: also flag UA-less legacy docs via a derived-field heuristic
//                    (browser=Other, os in {Other,Linux}, deviceType=desktop) — marked
//                    with `botGuess: true` so they stay distinguishable / reversible.
//   --no-rebuild     skip the photo_stats counter adjustment (only flag photo_views docs).
//   --env=<env>      override PHOTO_ENV.
require('dotenv').config();

var { initializeApp, getApps, cert } = require('firebase-admin/app');
var { getFirestore, FieldValue, FieldPath } = require('firebase-admin/firestore');
var { isBot } = require('../lib/photo-stats');

var args = process.argv.slice(2);
var COMMIT = args.includes('--commit');
var HEURISTIC = !args.includes('--no-heuristic');
var REBUILD = !args.includes('--no-rebuild');
var envArg = (args.find(function(a) { return a.indexOf('--env=') === 0; }) || '').split('=')[1];
var env = envArg || process.env.PHOTO_ENV || 'dev';

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

function heuristicIsBot(d) {
  return d.browser === 'Other' &&
    (d.os === 'Other' || d.os === 'Linux' || d.os === undefined) &&
    d.deviceType === 'desktop';
}

function statsDocId(entityType, entityId) {
  return env + ':' + entityType + ':' + String(entityId).replace(/\//g, '_');
}

function pct(n, total) {
  return total ? (Math.round(n / total * 1000) / 10) + '%' : '0%';
}

async function run() {
  console.log('photo-views-debot  env=' + env +
    '  mode=' + (COMMIT ? 'COMMIT' : 'dry-run') +
    '  heuristic=' + (HEURISTIC ? 'on' : 'off') +
    '  rebuild-stats=' + (REBUILD ? 'on' : 'off') + '\n');

  var scanned = 0;
  var alreadyFlagged = 0;
  var flagByUa = 0;
  var flagByHeuristic = 0;
  var newlyFlaggedByEntity = {};   // "type:id" -> count (docs that previously bumped a counter)
  var breakdown = {};              // "browser/os/device" -> count  (of newly-flagged)
  var toUpdate = [];               // { ref, botGuess }

  var skippedOtherEnv = 0;
  var pageSize = 2000;
  var last = null;
  // Paginate the whole collection by document id (no composite index required);
  // filter by env in code.
  /* eslint-disable no-constant-condition */
  while (true) {
    var q = fb.collection('photo_views')
      .orderBy(FieldPath.documentId())
      .limit(pageSize);
    if (last) q = q.startAfter(last);
    var snap = await q.get();
    if (snap.empty) break;

    snap.docs.forEach(function(doc) {
      var d = doc.data();
      if (d.env !== env) { skippedOtherEnv++; return; }
      scanned++;
      var wasFlagged = d.bot === true;

      var isBotHit = false;
      var viaHeuristic = false;
      if (typeof d.ua === 'string' && d.ua) {
        isBotHit = isBot(d.ua);
      } else if (HEURISTIC) {
        isBotHit = heuristicIsBot(d);
        viaHeuristic = isBotHit;
      }

      if (wasFlagged) {
        alreadyFlagged++;
        return; // already excluded from counters; nothing to do
      }
      if (!isBotHit) return;

      if (viaHeuristic) flagByHeuristic++; else flagByUa++;

      var ekey = d.entityType + ':' + d.entityId;
      newlyFlaggedByEntity[ekey] = (newlyFlaggedByEntity[ekey] || 0) + 1;
      var bkey = (d.browser || '?') + ' / ' + (d.os || '?') + ' / ' + (d.deviceType || '?');
      breakdown[bkey] = (breakdown[bkey] || 0) + 1;

      toUpdate.push({ ref: doc.ref, botGuess: viaHeuristic });
    });

    last = snap.docs[snap.docs.length - 1];
    process.stdout.write('\r  scanned ' + scanned + ', newly-detected bot hits ' + toUpdate.length);
    if (snap.size < pageSize) break;
  }
  process.stdout.write('\n\n');

  var newlyFlagged = toUpdate.length;
  console.log('Skipped (other env) .. ' + skippedOtherEnv);
  console.log('Scanned .............. ' + scanned);
  console.log('Already flagged ...... ' + alreadyFlagged);
  console.log('Newly detected ....... ' + newlyFlagged +
    '  (' + pct(newlyFlagged, scanned) + ' of scanned)');
  console.log('  via raw UA ......... ' + flagByUa);
  console.log('  via heuristic ...... ' + flagByHeuristic + '  (marked botGuess:true)');

  console.log('\nNewly-flagged hits by device signature:');
  Object.keys(breakdown).sort(function(a, b) { return breakdown[b] - breakdown[a]; })
    .forEach(function(k) { console.log('  ' + String(breakdown[k]).padStart(7) + '  ' + k); });

  var entities = Object.keys(newlyFlaggedByEntity)
    .sort(function(a, b) { return newlyFlaggedByEntity[b] - newlyFlaggedByEntity[a]; });
  console.log('\nTop entities losing bot views (' + entities.length + ' total):');
  entities.slice(0, 20).forEach(function(k) {
    console.log('  -' + String(newlyFlaggedByEntity[k]).padStart(6) + '  ' + k);
  });

  if (!COMMIT) {
    console.log('\nDry run — nothing written. Re-run with --commit to apply.');
    return;
  }

  // 1) flag photo_views docs
  console.log('\nFlagging ' + newlyFlagged + ' photo_views docs...');
  for (var i = 0; i < toUpdate.length; i += 400) {
    var batch = fb.batch();
    toUpdate.slice(i, i + 400).forEach(function(u) {
      var payload = { bot: true };
      if (u.botGuess) payload.botGuess = true;
      batch.update(u.ref, payload);
    });
    await batch.commit();
    process.stdout.write('\r  ' + Math.min(i + 400, newlyFlagged) + ' / ' + newlyFlagged);
  }
  process.stdout.write('\n');

  if (!REBUILD) {
    console.log('\n--no-rebuild: photo_stats counters left untouched.');
    return;
  }

  // 2) subtract the bot contribution from photo_stats counters
  console.log('\nAdjusting ' + entities.length + ' photo_stats counters...');
  var adjusted = 0, missing = 0, clamped = 0;
  for (var j = 0; j < entities.length; j++) {
    var ekey = entities[j];
    var sep = ekey.indexOf(':');
    var entityType = ekey.slice(0, sep);
    var entityId = ekey.slice(sep + 1);
    var n = newlyFlaggedByEntity[ekey];
    var ref = fb.collection('photo_stats').doc(statsDocId(entityType, entityId));
    var cur = await ref.get();
    if (!cur.exists) { missing++; continue; }
    var views = cur.data().views || 0;
    var next = views - n;
    if (next < 0) { next = 0; clamped++; }
    await ref.update({ views: next, updatedAt: FieldValue.serverTimestamp(), debotAt: FieldValue.serverTimestamp() });
    adjusted++;
  }
  console.log('  adjusted ' + adjusted + ', counter doc missing ' + missing + ', clamped-to-0 ' + clamped);
  console.log('\nDone.');
}

run().then(function() { process.exit(0); }).catch(function(e) { console.error('\n' + e.stack || e); process.exit(1); });
