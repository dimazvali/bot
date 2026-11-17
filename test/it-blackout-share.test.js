'use strict';
var test = require('node:test');
var assert = require('node:assert');
var sharp = require('sharp');
var share = require('../lib/it-blackout-share');
var scores = require('../lib/it-blackout-scores');

var RULES = { maxScore: scores.maxScore, minDurationMs: scores.minDurationMs, fixesPerLevel: 10 };

test('card text: clock, plural, district and cause', function () {
  assert.deepStrictEqual(share.cardText({ durationMs: 267000, fixes: 23, district: 'vake', cause: 'light' }),
    { time: '4:27', fixed: '23 outages', lost: 'Vake, block 9' });
  var t = share.cardText({ durationMs: 754400, fixes: 1, district: 'nadzaladevi', cause: 'water' });
  assert.strictEqual(t.time, '12:34');
  assert.strictEqual(t.fixed, '1 outage');
  assert.strictEqual(t.lost, 'Nadzaladevi, no water');
  assert.strictEqual(share.cardText({ durationMs: 0, fixes: 0, district: 'nowhere', cause: 'x' }).lost, 'Tbilisi, block 9');
});

test('the same shift always maps to the same share id', function () {
  assert.strictEqual(share.shareId('abc'), share.shareId('abc'));
  assert.notStrictEqual(share.shareId('abc'), share.shareId('abd'));
  assert.match(share.shareId('abc'), /^[A-Za-z0-9_-]{10}$/);
});

test('plausible: accepts an honest shift', function () {
  var start = 1e12, now = start + 200000;
  var r = share.plausible({ fixes: 23, score: 700, level: 3, durationMs: 190000, district: 'vake', cause: 'gas' }, start, now, RULES);
  assert.deepStrictEqual(r, { fixes: 23, score: 700, level: 3, durationMs: 190000, district: 'vake', cause: 'gas' });
});

test('plausible: rejects impossible or inconsistent results', function () {
  var start = 1e12, now = start + 200000;
  var ok = { fixes: 23, score: 700, level: 3, durationMs: 190000 };
  var bad = function (patch) { return share.plausible(Object.assign({}, ok, patch), start, now, RULES); };
  assert.strictEqual(bad({ durationMs: 5000 }), null, 'faster than outages can spawn');
  assert.strictEqual(bad({ durationMs: 300000 }), null, 'longer than the real time since the token');
  assert.strictEqual(bad({ score: scores.maxScore(23) + 1 }), null, 'score above the rules');
  assert.strictEqual(bad({ level: 7 }), null, 'level does not match fixes');
  assert.strictEqual(bad({ fixes: 'lots' }), null, 'not a number');
});

test('renders a 1200×630 PNG card', async function () {
  var png = await share.renderCard({ durationMs: 267000, fixes: 23, district: 'vake', cause: 'light' });
  var meta = await sharp(png).metadata();
  assert.strictEqual(meta.format, 'png');
  assert.strictEqual(meta.width, 1200);
  assert.strictEqual(meta.height, 630);
});
