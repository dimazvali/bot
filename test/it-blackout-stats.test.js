'use strict';
var test = require('node:test');
var assert = require('node:assert');
var stats = require('../lib/it-blackout-stats');

var NOW = new Date('2026-11-17T12:00:00Z'); // 16:00 in Tbilisi
function at(iso) { return new Date(iso); }

var launches = [
  // today (Tbilisi): 3 shifts, 2 devices, one new; two finished
  { at: at('2026-11-17T11:00:00Z'), deviceId: 'a', lang: 'ru', plays: 5, mobile: true, score: 900, level: 4 },
  { at: at('2026-11-17T10:00:00Z'), deviceId: 'a', lang: 'ru', plays: 4, mobile: true },
  { at: at('2026-11-16T20:30:00Z'), deviceId: 'b', lang: 'en', plays: 1, mobile: false, score: 300, level: 2 }, // 00:30 Tbilisi, Nov 17
  // yesterday (Tbilisi)
  { at: at('2026-11-16T19:30:00Z'), deviceId: 'c', lang: 'ru', plays: 1, mobile: true, score: 100, level: 1 }, // 23:30 Tbilisi, Nov 16
  // 10 days ago: inside "all", outside "7 days"
  { at: at('2026-11-07T09:00:00Z'), deviceId: 'd', lang: 'ru', plays: 1, mobile: false, score: 2000, level: 6 },
];

test('day boundaries follow Tbilisi time (UTC+4)', function () {
  assert.strictEqual(stats.dayKey(at('2026-11-16T20:30:00Z')), '2026-11-17');
  assert.strictEqual(stats.dayKey(at('2026-11-16T19:30:00Z')), '2026-11-16');
});

test('today / 7 days / all time', function () {
  var s = stats.aggregate(launches, NOW, 14);
  assert.deepStrictEqual(
    [s.today.shifts, s.today.devices, s.today.newDevices, s.today.finished, s.today.finishedPct],
    [3, 2, 1, 2, 67]);
  assert.strictEqual(s.today.en, 1);
  assert.strictEqual(s.today.mobile, 2);
  assert.strictEqual(s.week.shifts, 4);
  assert.strictEqual(s.all.shifts, 5);
  assert.strictEqual(s.all.devices, 4);
  assert.strictEqual(s.all.bestScore, 2000);
});

test('score median and average use finished shifts only', function () {
  var s = stats.aggregate(launches, NOW, 14);
  assert.strictEqual(s.today.medianScore, 600); // 300, 900
  assert.strictEqual(s.today.avgScore, 600);
  assert.strictEqual(s.all.medianScore, 600);   // 100, 300, 900, 2000
});

test('daily rows: newest first, empty days kept', function () {
  var s = stats.aggregate(launches, NOW, 14);
  assert.strictEqual(s.daily.length, 14);
  assert.strictEqual(s.daily[0].day, '2026-11-17');
  assert.strictEqual(s.daily[0].shifts, 3);
  assert.strictEqual(s.daily[1].day, '2026-11-16');
  assert.strictEqual(s.daily[1].shifts, 1);
  assert.strictEqual(s.daily[2].shifts, 0);
  assert.strictEqual(s.daily[2].medianScore, null);
  assert.strictEqual(s.daily[10].shifts, 1); // Nov 7
});

test('level distribution of finished shifts', function () {
  var s = stats.aggregate(launches, NOW, 14);
  assert.deepStrictEqual(s.levels, [
    { level: 1, count: 1 }, { level: 2, count: 1 }, { level: 4, count: 1 }, { level: 6, count: 1 },
  ]);
});

test('no data at all', function () {
  var s = stats.aggregate([], NOW, 7);
  assert.strictEqual(s.all.shifts, 0);
  assert.strictEqual(s.all.finishedPct, null);
  assert.strictEqual(s.since, null);
  assert.deepStrictEqual(s.levels, []);
});
