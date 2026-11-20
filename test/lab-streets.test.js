'use strict';
var test = require('node:test');
var assert = require('node:assert');
var streets = require('../lib/lab-streets');

// minimal in-memory Firestore: collections of docs, orderBy/limit and transactions
function fakeDb() {
  var cols = {};
  function col(name) { return (cols[name] = cols[name] || new Map()); }
  return {
    cols: cols,
    collection: function (name) {
      return {
        doc: function (id) { return { col: name, id: id }; },
        orderBy: function (field) {
          return { limit: function (n) { return { get: async function () {
            var docs = Array.from(col(name).entries()).sort(function (a, b) { return b[1][field] - a[1][field]; }).slice(0, n);
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

// cats like data.json; each name has one 1 km way (500 units × q=2 m)
var CATS = ['writers', 'royals', 'science', 'military', 'politics', 'stage', 'artists', 'music', 'sport', 'person', 'georgia'];
function data(rows) {
  return {
    q: 2, cats: CATS,
    names: rows.map(function (r) { return [CATS.indexOf(r.cat), r.flags || 0, r.who, null, null, null, 'ka', null, null]; }),
    ways: rows.map(function (r, i) { return [i, 1, [0, 0, r.units == null ? 500 : r.units, 0]]; }),
  };
}
var ROWS = [
  { cat: 'writers', who: 'A' }, { cat: 'science', who: 'B' }, { cat: 'royals', who: 'C' },
  { cat: 'georgia', who: null },                 // not a person
  { cat: 'person', who: 'Unknown' },             // unknown occupation
  { cat: 'music', who: 'Guess', flags: 4 },      // heuristic guess
  { cat: 'sport', who: 'Short', units: 50 },     // 100 m street
  { cat: 'writers', who: 'A' },                  // same person, second street name
];
var DEV = 'device-0123456789abcdef';

function engine(t0) {
  var clock = { t: t0 || 1e12 };
  var db = fakeDb();
  var e = streets.create({ data: data(ROWS), db: db, now: function () { return clock.t; } });
  return { e: e, clock: clock, db: db };
}
function rightCat(e, n) { return CATS[data(ROWS).names[n][0]]; }

test('pool: only known people on long streets, once per person', function () {
  var pool = streets.buildPool(data(ROWS));
  assert.deepStrictEqual(pool.map(function (p) { return p.who; }).sort(), ['A', 'B', 'C']);
});

test('a question has the right answer among four distinct people categories', function () {
  var x = engine();
  var s = x.e.start(DEV);
  assert.strictEqual(s.q.opts.length, 4);
  assert.strictEqual(new Set(s.q.opts).size, 4);
  assert.ok(s.q.opts.indexOf(rightCat(x.e, s.q.n)) >= 0);
  s.q.opts.forEach(function (c) { assert.ok(streets.PEOPLE.indexOf(c) >= 0); });
});

test('right answers grow the streak, a wrong one ends the run; questions never repeat', function () {
  var x = engine();
  var s = x.e.start(DEV), q = s.q, seen = {};
  for (var i = 1; i <= 2; i++) {
    assert.ok(!seen[q.n]); seen[q.n] = 1;
    x.clock.t += 2000;
    var r = x.e.answer(s.run, rightCat(x.e, q.n));
    assert.strictEqual(r.correct, true);
    assert.strictEqual(r.streak, i);
    q = r.q;
  }
  x.clock.t += 2000;
  var wrong = streets.PEOPLE.filter(function (c) { return c !== rightCat(x.e, q.n); })[0];
  var end = x.e.answer(s.run, wrong);
  assert.deepStrictEqual([end.correct, end.streak, end.q, end.cat], [false, 2, null, rightCat(x.e, q.n)]);
  assert.deepStrictEqual(x.e.answer(s.run, wrong), { error: 'over' });
});

test('answering every question in the pool ends the run as a perfect streak', function () {
  var x = engine();
  var s = x.e.start(DEV), q = s.q, r;
  for (var i = 0; i < 3; i++) { x.clock.t += 2000; r = x.e.answer(s.run, rightCat(x.e, q.n)); q = r.q; }
  assert.deepStrictEqual([r.correct, r.streak, r.q], [true, 3, null]);
});

async function finishRun(x, answers, gap) {
  var s = x.e.start(DEV), q = s.q;
  for (var i = 0; i < answers; i++) { x.clock.t += gap; q = x.e.answer(s.run, rightCat(x.e, q.n)).q; }
  x.clock.t += gap;
  x.e.answer(s.run, streets.PEOPLE.filter(function (c) { return c !== rightCat(x.e, q.n); })[0]);
  return s.run;
}

test('a finished run goes into the table once; the best streak per device is kept', async function () {
  var x = engine();
  var run = await finishRun(x, 2, 2000);
  assert.deepStrictEqual(await x.e.submit({ run: run, deviceId: DEV, nick: 'Нино' }), { ok: true, improved: true, streak: 2, durationMs: 6000 });
  assert.deepStrictEqual(await x.e.submit({ run: run, deviceId: DEV, nick: 'Нино' }), { error: 'used' });
  var run2 = await finishRun(x, 1, 2000);
  var r2 = await x.e.submit({ run: run2, deviceId: DEV, nick: 'Нино 2' });
  assert.strictEqual(r2.improved, false);
  assert.deepStrictEqual(await x.e.top(DEV), [{ rank: 1, nick: 'Нино 2', streak: 2, me: true }]);
});

test('submit refuses unfinished, foreign, too fast and empty runs', async function () {
  var x = engine();
  var open = x.e.start(DEV).run;
  assert.deepStrictEqual(await x.e.submit({ run: open, deviceId: DEV, nick: 'a' }), { error: 'run' });
  var run = await finishRun(x, 1, 2000);
  assert.deepStrictEqual(await x.e.submit({ run: run, deviceId: 'other-device-0123456789', nick: 'a' }), { error: 'device' });
  assert.deepStrictEqual(await x.e.submit({ run: run, deviceId: DEV, nick: '   ' }), { error: 'nick' });
  assert.deepStrictEqual(await x.e.submit({ run: run, deviceId: 'bad', nick: 'a' }), { error: 'device' });
  var fast = await finishRun(x, 2, 100);
  assert.deepStrictEqual(await x.e.submit({ run: fast, deviceId: DEV, nick: 'bot' }), { error: 'time' });
  var zero = await finishRun(x, 0, 2000);
  assert.deepStrictEqual(await x.e.submit({ run: zero, deviceId: DEV, nick: 'a' }), { error: 'score' });
});

test('cleanNick strips markup and control chars and caps the length', function () {
  assert.strictEqual(streets.cleanNick('  <b>Гела</b>\n '), 'bГела/b');
  assert.strictEqual(Array.from(streets.cleanNick('ა'.repeat(40))).length, 20);
});
