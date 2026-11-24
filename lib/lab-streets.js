'use strict';
// "Чьи улицы Тбилиси" (dimazvali.com/lab/streets/): the endless quiz run and its top-10.
//
// The 10-question warm-up runs in the browser. The endless run is served from here: the server
// picks each question and checks each answer, keeping run state in memory, so the table only
// shows streaks the server counted itself. (data.json is public, so a bot can still look answers
// up; a minimum think time per answer and per-IP limits in the route raise the cost.)
//   <prefix>_scores/{deviceId} (lab_streets_scores for Tbilisi, lab_streets_spb_scores for SPb) — one row per device (random id from the player's localStorage): its best streak
var crypto = require('crypto');

var SUGGEST_MAX = 1000;
var TOP = 10;
var DEVICE_RE = /^[A-Za-z0-9-]{16,64}$/;
var NICK_MAX = 20;
var MIN_ANSWER_MS = 700;           // faster than this and the run can't go into the table
var RUN_TTL_MS = 2 * 60 * 60 * 1000;
var MAX_RUNS = 5000;
var PEOPLE = ['writers', 'royals', 'science', 'military', 'politics', 'stage', 'artists', 'music', 'sport'];

// questions: people with a known occupation (not heuristic guesses), on streets longer than 250 m
function buildPool(data) {
  var len = data.names.map(function () { return 0; });
  data.ways.forEach(function (w) {
    var f = w[2], s = 0;
    for (var i = 2; i < f.length; i += 2) s += Math.hypot(f[i], f[i + 1]);
    len[w[0]] += s * data.q / 1000;
  });
  var seen = {};
  var pool = [];
  data.names.forEach(function (r, i) {
    var cat = data.cats[r[0]], who = r[2] || r[3];
    if (PEOPLE.indexOf(cat) < 0 || (r[1] & 4) || !who || len[i] <= 0.25 || seen[who]) return;
    seen[who] = 1;
    pool.push({ n: i, cat: cat, who: who, len: len[i] });
  });
  return pool;
}

// early questions favour long (well-known) streets, later ones get more obscure
function weight(item, streak) {
  if (streak < 10) return Math.sqrt(item.len);
  if (streak < 25) return Math.pow(item.len, 0.25);
  return 1;
}

// free text from the suggestion form: no control chars (newlines kept), no angle brackets, capped
function cleanText(s, max) {
  var chars = Array.from(String(s || '').replace(/[\u0000-\u0009\u000b-\u001f\u007f<>]/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim());
  return chars.slice(0, max).join('').trim();
}

function cleanNick(s) {
  var chars = Array.from(String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim());
  return chars.slice(0, NICK_MAX).join('').trim();
}

// opts: { data, db, now() → ms, rand() → [0,1) }
function create(opts) {
  var pool = buildPool(opts.data);
  var db = opts.db;
  // collections: lab_streets_scores / lab_streets_suggestions for Tbilisi; another city passes its own prefix
  var prefix = opts.prefix || 'lab_streets';
  var COL = prefix + '_scores', SUGGESTIONS = prefix + '_suggestions';
  var now = opts.now || Date.now;
  var rand = opts.rand || Math.random;
  var runs = new Map();

  function sweep(t) {
    if (runs.size < MAX_RUNS) return;
    runs.forEach(function (r, id) { if (t - r.startedAt > RUN_TTL_MS) runs.delete(id); });
    if (runs.size >= MAX_RUNS) runs.delete(runs.keys().next().value);
  }

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rand() * (i + 1)); var x = a[i]; a[i] = a[j]; a[j] = x; }
    return a;
  }

  function nextQuestion(run) {
    var cand = pool.filter(function (p) { return !run.asked[p.who]; });
    if (!cand.length) return null; // the whole pool answered: nothing left to ask
    var tot = 0;
    cand.forEach(function (p) { tot += weight(p, run.streak); });
    var x = rand() * tot, item = cand[cand.length - 1];
    for (var i = 0; i < cand.length; i++) { x -= weight(cand[i], run.streak); if (x <= 0) { item = cand[i]; break; } }
    run.asked[item.who] = 1;
    var others = shuffle(PEOPLE.filter(function (c) { return c !== item.cat; })).slice(0, 3);
    run.q = { item: item, opts: shuffle(others.concat([item.cat])) };
    run.issuedAt = now();
    return { n: item.n, opts: run.q.opts };
  }

  function start(deviceId) {
    var t = now();
    sweep(t);
    var id = crypto.randomBytes(12).toString('base64url');
    var run = { deviceId: DEVICE_RE.test(String(deviceId || '')) ? String(deviceId) : null,
      startedAt: t, streak: 0, asked: {}, q: null, issuedAt: 0, over: false, fast: false, submitted: false };
    runs.set(id, run);
    return { run: id, q: nextQuestion(run) };
  }

  // → { error } | { correct, cat, streak, q } (q is null when the run is over)
  function answer(id, cat) {
    var run = runs.get(String(id || ''));
    if (!run) return { error: 'run' };
    if (run.over || !run.q) return { error: 'over' };
    if (now() - run.issuedAt < MIN_ANSWER_MS) run.fast = true;
    var right = run.q.item.cat;
    var correct = cat === right;
    if (correct) run.streak++;
    else run.over = true;
    var q = correct ? nextQuestion(run) : null;
    if (correct && !q) run.over = true; // ran out of questions: a perfect run
    return { correct: correct, cat: right, streak: run.streak, q: q };
  }

  async function top(deviceId) {
    var snap = await db.collection(COL).orderBy('streak', 'desc').limit(TOP).get();
    return snap.docs.map(function (d, i) {
      var x = d.data();
      return { rank: i + 1, nick: x.nick, streak: x.streak, me: !!deviceId && d.id === deviceId };
    });
  }

  // → { error } | { ok, improved, streak, durationMs }
  async function submit(body) {
    body = body || {};
    var deviceId = String(body.deviceId || '');
    var nick = cleanNick(body.nick);
    if (!DEVICE_RE.test(deviceId)) return { error: 'device' };
    if (!nick) return { error: 'nick' };
    var run = runs.get(String(body.run || ''));
    if (!run || !run.over) return { error: 'run' };
    if (run.deviceId !== deviceId) return { error: 'device' };
    if (run.submitted) return { error: 'used' };
    if (run.fast) return { error: 'time' };
    if (run.streak < 1) return { error: 'score' };
    run.submitted = true;
    var streak = run.streak, at = new Date(now()), durationMs = now() - run.startedAt;
    var ref = db.collection(COL).doc(deviceId);
    return db.runTransaction(async function (t) {
      var cur = await t.get(ref);
      if (cur.exists && cur.data().streak >= streak) {
        t.update(ref, { nick: nick, updatedAt: at });
        return { ok: true, improved: false, streak: streak, durationMs: durationMs };
      }
      t.set(ref, { nick: nick, streak: streak, durationMs: durationMs,
        createdAt: cur.exists ? cur.data().createdAt : at, updatedAt: at });
      return { ok: true, improved: true, streak: streak, durationMs: durationMs };
    });
  }

  // a visitor's suggestion for a street: who the person was and/or the right category.
  // → { error } | { ok, row } (row: what was stored, for the Telegram alert)
  var names = opts.data.names, cats = opts.data.cats;
  async function suggest(body) {
    body = body || {};
    var n = Number(body.n);
    if (!Number.isInteger(n) || n < 0 || n >= names.length) return { error: 'street' };
    var cat = body.cat == null || body.cat === '' ? null : String(body.cat);
    if (cat !== null && cats.indexOf(cat) < 0) return { error: 'cat' };
    var text = cleanText(body.text, SUGGEST_MAX);
    if (!cat && text.length < 3) return { error: 'empty' };
    var r = names[n];
    var row = {
      n: n, streetKa: r[6], streetRu: r[4] || null, streetEn: r[5] || null,
      currentCat: cats[r[0]], cat: cat, text: text, contact: cleanText(body.contact, 100) || null,
      lang: ['ru', 'en', 'ka'].indexOf(body.lang) >= 0 ? body.lang : null,
      deviceId: DEVICE_RE.test(String(body.deviceId || '')) ? String(body.deviceId) : null,
      status: 'new', createdAt: new Date(now()),
    };
    await db.collection(SUGGESTIONS).add(row);
    return { ok: true, row: row };
  }

  return { start: start, answer: answer, top: top, submit: submit, suggest: suggest, poolSize: pool.length,
    _runs: runs }; // _runs: for tests
}

module.exports = { create: create, buildPool: buildPool, cleanNick: cleanNick, cleanText: cleanText, MIN_ANSWER_MS: MIN_ANSWER_MS, PEOPLE: PEOPLE };
