'use strict';
// Shift log and stats for the /blackout mini-game (shown in the it admin).
//   it_blackout_launches/{sid} — one doc per shift: written when the shift token is issued,
//   completed with the result when the game reports the end of the shift (same signed token).
// Shifts started by a logged-in it admin are not logged at all.
var TZ_OFFSET_MS = 4 * 60 * 60 * 1000; // Tbilisi, UTC+4 all year
var COL = 'it_blackout_launches';
var FETCH_LIMIT = 10000;

var db = null;

function isMobile(ua) { return /Mobi|Android|iPhone|iPad/i.test(ua || ''); }

// "2026-11-17" in Tbilisi time
function dayKey(date) { return new Date(date.getTime() + TZ_OFFSET_MS).toISOString().slice(0, 10); }

function cleanInt(n, max) { n = Number(n); return Number.isInteger(n) && n >= 0 && n <= max ? n : null; }

async function logLaunch(sid, info) {
  await db.collection(COL).doc(sid).set({
    at: info.at || new Date(),
    deviceId: String(info.deviceId || '').slice(0, 64) || null,
    lang: info.lang === 'en' ? 'en' : 'ru',
    plays: cleanInt(info.plays, 1e6),
    mobile: isMobile(info.ua),
  });
}

// result of a finished shift; ignored when the shift was never logged (admin, or a stale token)
async function logFinish(sid, r) {
  var score = cleanInt(r.score, 1e7), level = cleanInt(r.level, 1e4), fixes = cleanInt(r.fixes, 1e5);
  if (score === null || level === null || fixes === null) return false;
  try {
    await db.collection(COL).doc(sid).update({ finishedAt: r.at || new Date(), score: score, level: level, fixes: fixes });
    return true;
  } catch (e) {
    return false; // NOT_FOUND: nothing to complete
  }
}

async function loadLaunches() {
  var snap = await db.collection(COL).orderBy('at', 'desc').limit(FETCH_LIMIT).get();
  return snap.docs.map(function (d) {
    var x = d.data();
    return Object.assign({}, x, { at: x.at && x.at.toDate ? x.at.toDate() : new Date(x.at) });
  });
}

function median(nums) {
  if (!nums.length) return null;
  var s = nums.slice().sort(function (a, b) { return a - b; });
  var m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

function summarize(list) {
  var devices = new Set();
  var finished = list.filter(function (l) { return typeof l.score === 'number'; });
  var scores = finished.map(function (l) { return l.score; });
  list.forEach(function (l) { if (l.deviceId) devices.add(l.deviceId); });
  return {
    shifts: list.length,
    devices: devices.size,
    newDevices: list.filter(function (l) { return l.plays === 1; }).length,
    finished: finished.length,
    finishedPct: list.length ? Math.round(finished.length / list.length * 100) : null,
    en: list.filter(function (l) { return l.lang === 'en'; }).length,
    mobile: list.filter(function (l) { return l.mobile; }).length,
    avgScore: scores.length ? Math.round(scores.reduce(function (a, b) { return a + b; }, 0) / scores.length) : null,
    medianScore: median(scores),
    bestScore: scores.length ? Math.max.apply(null, scores) : null,
  };
}

// launches: [{ at: Date, deviceId, lang, plays, mobile, score?, level? }]
function aggregate(launches, now, days) {
  now = now || new Date();
  days = days || 14;
  var today = dayKey(now);
  var weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  var byDay = {};
  launches.forEach(function (l) { (byDay[dayKey(l.at)] = byDay[dayKey(l.at)] || []).push(l); });
  var daily = [];
  for (var i = 0; i < days; i++) {
    var key = dayKey(new Date(now.getTime() - i * 24 * 60 * 60 * 1000));
    daily.push(Object.assign({ day: key }, summarize(byDay[key] || [])));
  }
  var levels = {};
  launches.forEach(function (l) { if (typeof l.level === 'number') levels[l.level] = (levels[l.level] || 0) + 1; });
  return {
    since: launches.length ? launches[launches.length - 1].at : null,
    today: summarize(byDay[today] || []),
    week: summarize(launches.filter(function (l) { return l.at >= weekAgo; })),
    all: summarize(launches),
    daily: daily,
    levels: Object.keys(levels).map(Number).sort(function (a, b) { return a - b; })
      .map(function (lv) { return { level: lv, count: levels[lv] }; }),
  };
}

module.exports = {
  init: function (firestore) { db = firestore; return module.exports; },
  logLaunch: logLaunch,
  logFinish: logFinish,
  loadLaunches: loadLaunches,
  aggregate: aggregate,
  dayKey: dayKey,
};
