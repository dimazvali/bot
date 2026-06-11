'use strict';
var https = require('https');
var crypto = require('crypto');
var { google } = require('googleapis');

var SKIP_DOMAINS = ['photo.dimazvali.com', 'dimazvalimisc', 'storage.googleapis.com', 'googleusercontent.com'];

// In-memory run state — single concurrent check allowed
var state = { running: false, startedAt: null, done: 0, total: 0, newHits: 0, errors: 0, finishedAt: null, lastError: null };

function getState() { return Object.assign({}, state); }

function urlHash(url) {
  return crypto.createHash('sha256').update(url).digest('hex').slice(0, 12);
}

function isOwnUrl(url) {
  return SKIP_DOMAINS.some(function(d) { return url.includes(d); });
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
      requests: [{ image: { source: { imageUri: imageUrl } }, features: [{ type: 'WEB_DETECTION', maxResults: 20 }] }],
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

async function processPhoto(auth, fb, photo, countryKey, seriesKey, env, newHits) {
  var imageUrl = photo.urls && (photo.urls.full || photo.urls.preview);
  if (!imageUrl) return;

  var detection = await detectWeb(auth, imageUrl);
  var now = new Date();
  var seen = new Set();

  for (var img of (detection.fullMatchingImages || [])) {
    if (isOwnUrl(img.url) || seen.has(img.url)) continue;
    seen.add(img.url);

    var docId = env + '_' + photo.id + '_' + urlHash(img.url);
    var ref = fb.collection('photo_copyright_hits').doc(docId);
    var snap = await ref.get();
    if (!snap.exists) {
      await ref.set({
        env, photoId: photo.id, photoTitle: photo.title || '',
        countryKey, seriesKey, imageUrl,
        matchUrl: img.url, pageUrl: null, pageTitle: null, matchType: 'full_image',
        firstSeen: now, lastSeen: now, notified: false,
      });
      newHits.push({ photo, countryKey, seriesKey, matchUrl: img.url, pageTitle: null, matchType: 'full_image' });
    } else {
      await ref.update({ lastSeen: now });
    }
  }
}

function run(fb, data, env) {
  if (state.running) return false;

  state = { running: true, startedAt: new Date(), done: 0, total: 0, newHits: 0, errors: 0, finishedAt: null, lastError: null };

  var todos = [];
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
        var crypto2 = require('crypto');
        function uh(u) { return crypto2.createHash('sha256').update(u).digest('hex').slice(0, 12); }
        await Promise.all(newHits.map(function(h) {
          return fb.collection('photo_copyright_hits').doc(env + '_' + h.photo.id + '_' + uh(h.matchUrl)).update({ notified: true });
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

module.exports = { run, getState };
