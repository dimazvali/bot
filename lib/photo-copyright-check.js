'use strict';
var https = require('https');
var crypto = require('crypto');
var { google } = require('googleapis');

// Our own site + the Storage bucket that holds the originals. Anything matching
// these is us re-hosting our own file, not an external use. Kept deliberately
// narrow — broad matches like "storage.googleapis.com" or "googleusercontent.com"
// also cover other people's buckets / Blogger / Google-cached copies and would
// hide real infringements.
var OWN_SUBSTRINGS = ['photo.dimazvali.com', 'dimazvalimisc'];
function ownSubstrings() {
  var list = OWN_SUBSTRINGS.slice();
  var bucket = (process.env.PHOTO_BUCKET || '').toLowerCase();
  if (bucket) list.push(bucket);
  return list;
}

// In-memory run state — single concurrent check allowed
var state = { running: false, startedAt: null, done: 0, total: 0, newHits: 0, errors: 0, finishedAt: null, lastError: null };

function getState() { return Object.assign({}, state); }

function urlHash(url) {
  return crypto.createHash('sha256').update(url).digest('hex').slice(0, 12);
}

function isOwnUrl(url) {
  if (!url) return true;
  var u = String(url).toLowerCase();
  return ownSubstrings().some(function(d) { return u.indexOf(d) !== -1; });
}

// New-format hit id: env + entity path + match-url hash. Includes country/series
// so that two photos sharing a slug (ids are only unique *within* a series/shoot)
// can't collide on the same external URL.
function hitDocId(env, countryKey, seriesKey, photoId, matchUrl) {
  return [env, countryKey, seriesKey, photoId, urlHash(matchUrl)].join('_');
}
// Pre-country/series id, still written by older runs — used to migrate in place.
function legacyDocId(env, photoId, matchUrl) {
  return env + '_' + photoId + '_' + urlHash(matchUrl);
}

function makeAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      type: 'service_account',
      project_id: 'dimazvalimisc',
      private_key: process.env.sssGCPKey.replace(/\\n/g, '\n'),
      client_email: 'firebase-adminsdk-4iwd4@dimazvalimisc.iam.gserviceaccount.com',
    },
    scopes: ['https://www.googleapis.com/auth/cloud-vision'],
  });
}

async function detectWeb(auth, imageUrl) {
  var client = await auth.getClient();
  var token = (await client.getAccessToken()).token;

  return new Promise(function(resolve, reject) {
    var body = JSON.stringify({
      requests: [{ image: { source: { imageUri: imageUrl } }, features: [{ type: 'WEB_DETECTION', maxResults: 50 }] }],
    });
    var req = https.request({
      method: 'POST', hostname: 'vision.googleapis.com', path: '/v1/images:annotate',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, function(res) {
      var chunks = [];
      res.on('data', function(c) { chunks.push(c); });
      res.on('end', function() {
        try {
          var data = JSON.parse(Buffer.concat(chunks).toString());
          if (data.error) return reject(new Error(data.error.message));
          resolve(data.responses && data.responses[0] ? data.responses[0].webDetection || {} : {});
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Turn a raw webDetection payload into a flat list of external "uses":
//   { matchType: 'page'|'image', partial: bool, matchUrl, pageUrl, pageTitle, matchImageUrl }
// - 'page'  : a web page hosting our image (from pagesWithMatchingImages). The
//             actionable result — has a URL + title you can open / write to.
// - 'image' : a re-hosted image file with no discoverable page, that isn't
//             already listed on one of the pages above.
// partial=true means the match came from partialMatchingImages (crop / edit /
// heavy re-compression) — lower confidence, shown separately.
function extractUses(detection) {
  var uses = [];
  var coveredImgUrls = new Set(); // external image urls already attributed to a page

  for (var pg of (detection.pagesWithMatchingImages || [])) {
    if (!pg || !pg.url || isOwnUrl(pg.url)) continue;
    var fulls = (pg.fullMatchingImages || []).map(function(x) { return x.url; }).filter(function(u) { return u && !isOwnUrl(u); });
    var parts = (pg.partialMatchingImages || []).map(function(x) { return x.url; }).filter(function(u) { return u && !isOwnUrl(u); });
    if (!fulls.length && !parts.length) continue;
    fulls.concat(parts).forEach(function(u) { coveredImgUrls.add(u); });
    uses.push({
      matchType: 'page',
      partial: fulls.length === 0,
      matchUrl: pg.url,
      pageUrl: pg.url,
      pageTitle: pg.pageTitle || null,
      matchImageUrl: fulls[0] || parts[0] || null,
    });
  }

  var byImg = {}; // dedup; a full match outranks a partial one
  (detection.fullMatchingImages || []).forEach(function(x) {
    if (x.url && !isOwnUrl(x.url) && !coveredImgUrls.has(x.url)) byImg[x.url] = false;
  });
  (detection.partialMatchingImages || []).forEach(function(x) {
    if (x.url && !isOwnUrl(x.url) && !coveredImgUrls.has(x.url) && !(x.url in byImg)) byImg[x.url] = true;
  });
  Object.keys(byImg).forEach(function(u) {
    uses.push({ matchType: 'image', partial: byImg[u], matchUrl: u, pageUrl: null, pageTitle: null, matchImageUrl: u });
  });

  return uses;
}

async function processPhoto(auth, fb, photo, countryKey, seriesKey, env, newHits) {
  var imageUrl = photo.urls && (photo.urls.full || photo.urls.preview);
  if (!imageUrl) return;

  var detection = await detectWeb(auth, imageUrl);
  var now = new Date();
  var seen = new Set();

  for (var use of extractUses(detection)) {
    if (seen.has(use.matchUrl)) continue;
    seen.add(use.matchUrl);

    var docId = hitDocId(env, countryKey, seriesKey, photo.id, use.matchUrl);
    var ref = fb.collection('photo_copyright_hits').doc(docId);
    var snap = await ref.get();

    var common = {
      env, photoId: photo.id, photoTitle: photo.title || '',
      countryKey, seriesKey, imageUrl,
      matchType: use.matchType, partial: !!use.partial,
      matchUrl: use.matchUrl, pageUrl: use.pageUrl, pageTitle: use.pageTitle,
      matchImageUrl: use.matchImageUrl,
    };

    if (snap.exists) {
      await ref.update({
        lastSeen: now,
        matchType: use.matchType, partial: !!use.partial,
        pageUrl: use.pageUrl, pageTitle: use.pageTitle, matchImageUrl: use.matchImageUrl,
      });
      continue;
    }

    // Migrate a pre-country/series doc in place so its dismissed/firstSeen state
    // and "already notified" flag survive. Only exact re-hosted files ever had a
    // legacy doc (old runs only looked at fullMatchingImages).
    if (use.matchType === 'image' && !use.partial) {
      var legRef = fb.collection('photo_copyright_hits').doc(legacyDocId(env, photo.id, use.matchUrl));
      var legSnap = await legRef.get();
      if (legSnap.exists) {
        await ref.set(Object.assign({}, legSnap.data(), common, { lastSeen: now }));
        await legRef.delete();
        continue; // known use, not new
      }
    }

    await ref.set(Object.assign({}, common, { firstSeen: now, lastSeen: now, notified: false }));
    newHits.push(Object.assign({ docId: docId, photo: photo }, common));
  }
}

function run(fb, data, env, shootsData, opts) {
  if (state.running) return false;
  opts = opts || {};
  var shootSlug = opts.shootSlug || null;

  state = { running: true, startedAt: new Date(), done: 0, total: 0, newHits: 0, errors: 0, finishedAt: null, lastError: null, scope: shootSlug ? ('shoot:' + shootSlug) : 'all' };

  var todos = [];
  if (shootSlug) {
    var only = (shootsData || {})[shootSlug];
    for (var onlyPhoto of ((only || {}).photos || [])) {
      if (onlyPhoto.urls) todos.push({ photo: onlyPhoto, countryKey: 'shoot', seriesKey: shootSlug });
    }
  } else {
    for (var countryKey of Object.keys(data)) {
      var country = data[countryKey];
      if (country.archived) continue;
      for (var seriesKey of Object.keys(country.series || {})) {
        var series = country.series[seriesKey];
        if (series.archived) continue;
        for (var photo of (series.photos || [])) {
          if (photo.urls) todos.push({ photo, countryKey, seriesKey });
        }
      }
    }
    for (var shootKey of Object.keys(shootsData || {})) {
      for (var shootPhoto of ((shootsData[shootKey] || {}).photos || [])) {
        if (shootPhoto.urls) todos.push({ photo: shootPhoto, countryKey: 'shoot', seriesKey: shootKey });
      }
    }
  }
  state.total = todos.length;

  var auth = makeAuth();
  var newHits = [];

  (async function() {
    for (var i = 0; i < todos.length; i++) {
      if (!state.running) break; // allow cancel in future
      var item = todos[i];
      try {
        await processPhoto(auth, fb, item.photo, item.countryKey, item.seriesKey, env, newHits);
      } catch (e) {
        state.errors++;
        state.lastError = item.photo.id + ': ' + e.message;
      }
      state.done++;
      state.newHits = newHits.length;
      await new Promise(function(r) { setTimeout(r, 1100); });
    }

    if (newHits.length > 0) {
      try {
        var mailer = require('./photo-mailer');
        await mailer.sendCopyrightAlert(newHits);
        await Promise.all(newHits.map(function(h) {
          return fb.collection('photo_copyright_hits').doc(h.docId).update({ notified: true });
        }));
      } catch (e) { console.error('[copyright-check] notify error:', e.message); }
    }

    state.running = false;
    state.finishedAt = new Date();
  }()).catch(function(e) {
    state.running = false;
    state.lastError = e.message;
    state.finishedAt = new Date();
  });

  return true;
}

module.exports = { run, getState, extractUses, isOwnUrl };
