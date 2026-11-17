'use strict';
// High scores for the /blackout mini-game, stored in Firestore.
//   it_blackout_scores/{deviceId}  — one row per device (random id from the player's localStorage): its best score
//   it_blackout_sessions/{sid}     — shifts already used for a submission (a token is single-use)
//
// Anti-cheat (the game runs in the browser, so this raises the cost rather than making cheating impossible):
//   * every shift starts with a server-signed token (HMAC) carrying the start time; no token, no score;
//   * a score needs at least the real time the game takes to spawn that many outages;
//   * the score can't exceed the maximum the scoring rules allow for that many fixes;
//   * a token can be redeemed once; plus a per-IP rate limit in the route.
var crypto = require('crypto');

var COL = 'it_blackout_scores';
var SESSIONS = 'it_blackout_sessions';
var TOP = 10;
var DEVICE_RE = /^[A-Za-z0-9-]{16,64}$/;
var NICK_MAX = 20;
var TOKEN_MAX_AGE = 3 * 60 * 60 * 1000;

// ── game rules, keep in sync with public/javascripts/it/blackout.js ──
var FIXES_PER_LEVEL = 10;
var COMBO_CAP = 4;
function spawnEvery(level) { return Math.max(450, 1900 - (level - 1) * 160); }
function comboMult(combo) { return Math.min(COMBO_CAP, 1 + Math.floor(combo / 5)); }

// best possible score for n fixes: every fix instant (10 + 10 speed bonus), combo never broken
function maxScore(fixes) {
  var s = 0;
  for (var i = 1; i <= fixes; i++) s += 20 * comboMult(i);
  return s;
}

// least time the game needs to spawn n outages: shortest jittered gap (×0.7),
// two at once from level 4, plus 20% slack for timer drift
function minDurationMs(fixes) {
  var t = 0;
  for (var i = 0; i < fixes; i++) {
    var level = 1 + Math.floor(i / FIXES_PER_LEVEL);
    var gap = spawnEvery(level) * 0.7;
    t += level >= 4 ? gap / 2 : gap;
  }
  return t * 0.8;
}

var db = null;
var secret = null;

function sign(payload) { return crypto.createHmac('sha256', secret).update(payload).digest('base64url'); }

function newSession() {
  var sid = crypto.randomBytes(12).toString('base64url');
  var payload = sid + '.' + Date.now();
  return { token: payload + '.' + sign(payload) };
}

function readToken(token) {
  var parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  var payload = parts[0] + '.' + parts[1];
  var expected = Buffer.from(sign(payload));
  var given = Buffer.from(parts[2]);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  var startedAt = Number(parts[1]);
  if (!Number.isFinite(startedAt)) return null;
  return { sid: parts[0], startedAt: startedAt };
}

function cleanNick(s) {
  var chars = Array.from(String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim());
  return chars.slice(0, NICK_MAX).join('').trim();
}

function isInt(n, min, max) { return Number.isInteger(n) && n >= min && n <= max; }

async function top(deviceId) {
  var snap = await db.collection(COL).orderBy('score', 'desc').limit(TOP).get();
  return snap.docs.map(function (d, i) {
    var x = d.data();
    return { rank: i + 1, nick: x.nick, score: x.score, level: x.level, me: !!deviceId && d.id === deviceId };
  });
}

// Returns { error } for bad input, otherwise { ok, improved }.
async function submit(body, now) {
  body = body || {};
  now = now || Date.now();
  var deviceId = String(body.deviceId || '');
  var nick = cleanNick(body.nick);
  var score = Number(body.score), level = Number(body.level), fixes = Number(body.fixes);
  if (!DEVICE_RE.test(deviceId)) return { error: 'device' };
  if (!nick) return { error: 'nick' };
  if (!isInt(score, 1, 1e7) || !isInt(fixes, 1, 1e5) || !isInt(level, 1, 1e4)) return { error: 'score' };
  if (level !== 1 + Math.floor(fixes / FIXES_PER_LEVEL) || score > maxScore(fixes)) return { error: 'score' };
  var session = readToken(body.token);
  if (!session) return { error: 'token' };
  var elapsed = now - session.startedAt;
  if (elapsed > TOKEN_MAX_AGE || elapsed < 0) return { error: 'token' };
  if (elapsed < minDurationMs(fixes)) return { error: 'time' };

  var ref = db.collection(COL).doc(deviceId);
  var sessRef = db.collection(SESSIONS).doc(session.sid);
  return db.runTransaction(async function (t) {
    var used = await t.get(sessRef);
    if (used.exists) return { error: 'used' };
    var cur = await t.get(ref);
    var at = new Date(now);
    t.set(sessRef, { deviceId: deviceId, score: score, at: at });
    if (cur.exists && cur.data().score >= score) {
      t.update(ref, { nick: nick, updatedAt: at });
      return { ok: true, improved: false };
    }
    t.set(ref, { nick: nick, score: score, level: level, fixes: fixes, durationMs: elapsed,
      createdAt: cur.exists ? cur.data().createdAt : at, updatedAt: at });
    return { ok: true, improved: true, durationMs: elapsed };
  });
}

module.exports = {
  init: function (firestore, signingSecret) {
    if (!signingSecret) throw new Error('blackout scores: signing secret is required');
    db = firestore;
    secret = signingSecret;
    return module.exports;
  },
  newSession: newSession,
  readToken: readToken,
  top: top,
  // admin: the top with row ids (device ids stay server-side) and removing a row (moderation)
  adminTop: async function () {
    var snap = await db.collection(COL).orderBy('score', 'desc').limit(TOP).get();
    return snap.docs.map(function (d, i) {
      var x = d.data();
      return { id: d.id, rank: i + 1, nick: x.nick, score: x.score, level: x.level, fixes: x.fixes,
        durationMs: x.durationMs, updatedAt: x.updatedAt && x.updatedAt.toDate ? x.updatedAt.toDate() : null };
    });
  },
  remove: function (id) { return db.collection(COL).doc(String(id)).delete(); },
  submit: submit,
  // exported for tests
  cleanNick: cleanNick, maxScore: maxScore, minDurationMs: minDurationMs,
};
