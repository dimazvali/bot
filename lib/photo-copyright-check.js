'use strict';
var https = require('https');
var crypto = require('crypto');
var axios = require('axios');
var { google } = require('googleapis');

// Same admin bot/chat as routes/photo.js's tgSend (photo.dimazvali.com's other
// admin-facing alerts: comments, points, collections) — kept as a local copy
// here to avoid a circular require (photo.js -> photo-admin.js -> this file).
var DIMA_CHAT_ID = 144489840;
var MAX_TG_ITEMS = 12;

function escHtml(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function sendTelegramAlert(newHits) {
  var token = process.env.dimazvaliToken;
  if (!token) return Promise.resolve();

  var grouped = {};
  var order = [];
  newHits.forEach(function(h) {
    var key = h.countryKey + '/' + h.seriesKey + '/' + h.photoId;
    if (!grouped[key]) { grouped[key] = { h: h, matches: [] }; order.push(key); }
    grouped[key].matches.push(h);
  });

  var lines = order.slice(0, MAX_TG_ITEMS).map(function(key) {
    var g = grouped[key];
    var loc = g.h.countryKey === 'shoot' ? ('съёмка: ' + g.h.seriesKey) : (g.h.countryKey + '/' + g.h.seriesKey);
    var matchLines = g.matches.map(function(m) {
      var tag = (m.matchType === 'page' ? '📄' : '🖼') + (m.partial ? ' частично' : '');
      var url = m.pageUrl || m.matchUrl;
      return '  ' + tag + ' <a href="' + escHtml(url) + '">' + escHtml(m.pageTitle || url) + '</a>';
    }).join('\n');
    return '<b>' + escHtml(g.h.photoTitle) + '</b> (' + escHtml(loc) + ')\n' + matchLines;
  });

  var extra = order.length - lines.length;
  var text = '🔎 <b>Копирайт — новые случаи использования (' + newHits.length + ')</b>\n\n'
    + lines.join('\n\n')
    + (extra > 0 ? '\n\n…и ещё ' + extra + ' фото, см. админку' : '');

  return axios.post('https://api.telegram.org/bot' + token + '/sendMessage', {
    chat_id: DIMA_CHAT_ID,
    text: text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  }).catch(function(e) { console.error('[copyright-check] tg error:', e.message); });
}

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

// opts.limit / opts.cursorKey let a caller (the monthly-quota cron) scan the
// catalog in bounded chunks instead of all at once: todos are sorted into a
// stable order, rotated to start right after cursorKey, then capped at
// `limit`. state.nextCursor (the key of the last item processed) tells the
// caller where to resume next time; it wraps back to the start once the
// whole catalog has been swept.
function todoKey(item) {
  return item.countryKey + '_' + item.seriesKey + '_' + item.photo.id;
}

function run(fb, data, env, shootsData, opts) {
  if (state.running) return false;
  opts = opts || {};
  var shootSlug = opts.shootSlug || null;

  state = { running: true, startedAt: new Date(), done: 0, total: 0, newHits: 0, errors: 0, finishedAt: null, lastError: null, nextCursor: opts.cursorKey || null, scope: shootSlug ? ('shoot:' + shootSlug) : 'all' };

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

  if (opts.cursorKey || opts.limit) {
    todos.sort(function(a, b) { var ka = todoKey(a), kb = todoKey(b); return ka < kb ? -1 : ka > kb ? 1 : 0; });
  }
  if (opts.cursorKey) {
    var idx = todos.findIndex(function(t) { return todoKey(t) === opts.cursorKey; });
    if (idx !== -1) todos = todos.slice(idx + 1).concat(todos.slice(0, idx + 1));
  }
  if (opts.limit) todos = todos.slice(0, opts.limit);

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
      state.nextCursor = todoKey(item);
      await new Promise(function(r) { setTimeout(r, 1100); });
    }

    if (newHits.length > 0) {
      try {
        var mailer = require('./photo-mailer');
        await Promise.all([mailer.sendCopyrightAlert(newHits), sendTelegramAlert(newHits)]);
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

// Cron entry point: scans a bounded daily slice of the catalog so the month's
// total stays under Vision's Web Detection free tier (1000 units), leaving
// headroom for the admin's manual "▶ ПРОВЕРИТЬ" button. Progress (cursor +
// units used this month) is persisted in `photo_copyright_meta/cronState` so
// runs pick up where the last one left off and the whole catalog gets swept
// on rotation. No-ops (returns false) if a scan is already running or the
// month's budget is already spent.
var META_DOC_PATH = ['photo_copyright_meta', 'cronState'];

async function runQuotaBatch(fb, data, env, shootsData, opts) {
  opts = opts || {};
  var monthlyBudget = opts.monthlyBudget || 900; // safety margin under the 1000/month free tier
  var dailyChunk = opts.dailyChunk || 30;

  if (state.running) return false;

  var ref = fb.collection(META_DOC_PATH[0]).doc(META_DOC_PATH[1]);
  var snap = await ref.get();
  var meta = snap.exists ? snap.data() : {};
  var curMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  var usedThisMonth = (meta.month === curMonth) ? (meta.usedThisMonth || 0) : 0;

  var remaining = monthlyBudget - usedThisMonth;
  if (remaining <= 0) return false;

  var limit = Math.min(dailyChunk, remaining);
  var cursorKey = meta.cursorKey || null;

  var started = run(fb, data, env, shootsData, { limit: limit, cursorKey: cursorKey });
  if (!started) return false;

  while (state.running) {
    await new Promise(function(r) { setTimeout(r, 2000); });
  }

  await ref.set({
    month: curMonth,
    usedThisMonth: usedThisMonth + state.done,
    cursorKey: state.nextCursor || cursorKey,
    lastRunAt: new Date(),
  });

  return true;
}

module.exports = { run, runQuotaBatch, getState, extractUses, isOwnUrl };
