'use strict';
var test = require('node:test');
var assert = require('node:assert');
var scores = require('../lib/it-blackout-scores');

// minimal in-memory Firestore: collections of docs, orderBy/limit and transactions
function fakeDb() {
  var cols = {};
  function col(name) { return (cols[name] = cols[name] || new Map()); }
  return {
    cols: cols,
    collection: function (name) {
      return {
        doc: function (id) { return { col: name, id: id }; },
        orderBy: function () {
          return { limit: function (n) { return { get: async function () {
            var docs = Array.from(col(name).entries()).sort(function (a, b) { return b[1].score - a[1].score; }).slice(0, n);
            return { docs: docs.map(function (e) { return { id: e[0], data: function () { return e[1]; } }; }) };
          } }; } };
        },
      };
    },
    runTransaction: async function (fn) {
      return fn({
        get: async function (ref) { var m = col(ref.col); return { exists: m.has(ref.id), data: function () { return m.get(ref.id); } }; },
        set: function (ref, d) { col(ref.col).set(ref.id, d); },
        update: function (ref, d) { col(ref.col).set(ref.id, Object.assign({}, col(ref.col).get(ref.id), d)); },
      });
    },
  };
}

var DEVICE = 'device-aaaaaaaaaaaaaaaa';

function setup() {
  var db = fakeDb();
  scores.init(db, 'test-secret');
  return db;
}

// a token whose shift started `ago` ms before `now`
function tokenStartedAgo(ago, now) {
  var realNow = Date.now;
  Date.now = function () { return now - ago; };
  try { return scores.newSession().token; } finally { Date.now = realNow; }
}

test('maxScore follows the combo ramp: 20/fix, ×2 from the 5th, capped at ×4', function () {
  assert.strictEqual(scores.maxScore(1), 20);
  assert.strictEqual(scores.maxScore(5), 4 * 20 + 40);
  assert.strictEqual(scores.maxScore(100) - scores.maxScore(99), 80);
});

test('an honest-looking score is stored and shows up in the top', async function () {
  var db = setup();
  var now = 1e12;
  var r = await scores.submit({ deviceId: DEVICE, nick: ' Гиви ', score: 400, level: 2, fixes: 12, token: tokenStartedAgo(120000, now) }, now);
  assert.strictEqual(r.ok, true); assert.strictEqual(r.improved, true); assert.ok(r.durationMs >= 120000);
  var top = await scores.top(DEVICE);
  assert.strictEqual(top[0].nick, 'Гиви');
  assert.strictEqual(top[0].me, true);
  assert.strictEqual(db.cols.it_blackout_sessions.size, 1);
});

test('rejects a score without a token or with a forged one', async function () {
  setup();
  var now = 1e12;
  var base = { deviceId: DEVICE, nick: 'x', score: 100, level: 1, fixes: 5 };
  assert.strictEqual((await scores.submit(base, now)).error, 'token');
  var good = tokenStartedAgo(60000, now).split('.');
  var forgedTime = good[0] + '.' + (now - 3600000) + '.' + good[2];
  assert.strictEqual((await scores.submit(Object.assign({ token: forgedTime }, base), now)).error, 'token');
});

test('rejects a score reached faster than the game can spawn outages', async function () {
  setup();
  var now = 1e12;
  var r = await scores.submit({ deviceId: DEVICE, nick: 'x', score: 1000, level: 6, fixes: 50, token: tokenStartedAgo(10000, now) }, now);
  assert.strictEqual(r.error, 'time');
});

test('rejects scores above the rules maximum and inconsistent levels', async function () {
  setup();
  var now = 1e12;
  var token = tokenStartedAgo(600000, now);
  assert.strictEqual((await scores.submit({ deviceId: DEVICE, nick: 'x', score: scores.maxScore(12) + 1, level: 2, fixes: 12, token: token }, now)).error, 'score');
  assert.strictEqual((await scores.submit({ deviceId: DEVICE, nick: 'x', score: 100, level: 5, fixes: 12, token: token }, now)).error, 'score');
});

test('a shift token can be used once', async function () {
  setup();
  var now = 1e12;
  var token = tokenStartedAgo(120000, now);
  var body = { deviceId: DEVICE, nick: 'x', score: 300, level: 2, fixes: 12, token: token };
  assert.strictEqual((await scores.submit(body, now)).ok, true);
  assert.strictEqual((await scores.submit(Object.assign({}, body, { deviceId: 'device-bbbbbbbbbbbbbbbb' }), now)).error, 'used');
});

test('one row per device keeps the best score', async function () {
  var db = setup();
  var now = 1e12;
  await scores.submit({ deviceId: DEVICE, nick: 'first', score: 500, level: 2, fixes: 15, token: tokenStartedAgo(200000, now) }, now);
  var r = await scores.submit({ deviceId: DEVICE, nick: 'second', score: 50, level: 1, fixes: 3, token: tokenStartedAgo(100000, now) }, now);
  assert.deepStrictEqual(r, { ok: true, improved: false });
  var row = db.cols.it_blackout_scores.get(DEVICE);
  assert.strictEqual(row.score, 500);
  assert.strictEqual(row.nick, 'second');
});
