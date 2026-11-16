'use strict';
// High scores for the /blackout mini-game. One document per device (doc id = random device id
// kept in the player's localStorage), so a device holds at most one row: its best score.
var COL = 'it_blackout_scores';
var TOP = 10;
var DEVICE_RE = /^[A-Za-z0-9-]{16,64}$/;
var NICK_MAX = 20;
var MAX_POINTS_PER_FIX = 80; // (10 base + 10 speed) × combo cap 4 — keep in sync with blackout.js
var FIXES_PER_LEVEL = 10;

var db = null;

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
async function submit(body) {
  body = body || {};
  var deviceId = String(body.deviceId || '');
  var nick = cleanNick(body.nick);
  var score = Number(body.score), level = Number(body.level), fixes = Number(body.fixes);
  if (!DEVICE_RE.test(deviceId)) return { error: 'device' };
  if (!nick) return { error: 'nick' };
  if (!isInt(score, 1, 1e6) || !isInt(fixes, 1, 1e5) || !isInt(level, 1, 1e4)) return { error: 'score' };
  // cheap sanity checks: the client can't be trusted, but this rules out typed-in nonsense
  if (score > fixes * MAX_POINTS_PER_FIX || level !== 1 + Math.floor(fixes / FIXES_PER_LEVEL)) return { error: 'score' };

  var ref = db.collection(COL).doc(deviceId);
  return db.runTransaction(async function (t) {
    var cur = await t.get(ref);
    var now = new Date();
    if (cur.exists && cur.data().score >= score) {
      t.update(ref, { nick: nick, updatedAt: now });
      return { ok: true, improved: false };
    }
    t.set(ref, { nick: nick, score: score, level: level, fixes: fixes, createdAt: cur.exists ? cur.data().createdAt : now, updatedAt: now });
    return { ok: true, improved: true };
  });
}

module.exports = {
  init: function (firestore) { db = firestore; return module.exports; },
  top: top,
  submit: submit,
  cleanNick: cleanNick,
};
