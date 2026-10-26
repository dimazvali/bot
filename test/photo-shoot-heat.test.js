'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var heat = require('../lib/photo-shoot-heat.js');

var NOW = Date.parse('2026-10-26T12:00:00Z');
var DAY = 24 * 60 * 60 * 1000;

function e(kind, slug, visitor, ageMs, target) {
  return { kind: kind, slug: slug, target: target || (kind === 'shoot' ? slug : slug + '/a'), visitor: visitor, ms: NOW - (ageMs || 0) };
}

test('weights by intent, fresh events count in full', function() {
  var h = heat.compute([
    e('shoot', 'w', 'v1'),
    e('shoot-photo', 'w', 'v1'),
    e('ig', 'w', 'v1', 0, 'ig:a'),
    e('sel', 'w', 'v1', 0, 'sel:w'),
  ], { now: NOW });
  assert.equal(h.w.score, 1 + 2 + 5 + 8);
  assert.deepEqual(h.w.parts, { page: 1, frames: 2, downloads: 13 });
});

test('same action of the same visitor counts once a day', function() {
  var h = heat.compute([e('shoot', 'w', 'v1'), e('shoot', 'w', 'v1'), e('shoot', 'w', 'v2')], { now: NOW });
  assert.equal(h.w.score, 2);
});

test('events without a visitor are not deduped', function() {
  var h = heat.compute([e('zip', 'w', null, 0, 'zip:w'), e('zip', 'w', null, 0, 'zip:w')], { now: NOW });
  assert.equal(h.w.score, 20);
});

test('one visitor gives a shoot at most DAILY_CAP points a day', function() {
  var evs = [];
  for (var i = 0; i < 50; i++) evs.push(e('shoot-photo', 'w', 'v1', 0, 'w/p' + i));
  var h = heat.compute(evs, { now: NOW });
  assert.equal(h.w.score, heat.DAILY_CAP);
  assert.equal(h.w.week, heat.DAILY_CAP);
});

test('points halve every 7 days, events outside the window are ignored', function() {
  var h = heat.compute([e('zip', 'w', 'v1', 7 * DAY, 'zip:w'), e('zip', 'old', 'v1', 29 * DAY, 'zip:old')], { now: NOW });
  assert.equal(h.w.score, 5);
  assert.equal(h.old, undefined);
});

test('trend compares last 7 days with the 7 before', function() {
  var evs = [];
  for (var i = 0; i < 6; i++) evs.push(e('shoot', 'up', 'v' + i, DAY));
  evs.push(e('shoot', 'up', 'x', 10 * DAY));
  for (var j = 0; j < 6; j++) evs.push(e('shoot', 'down', 'v' + j, 10 * DAY));
  evs.push(e('shoot', 'flat', 'v1', DAY), e('shoot', 'flat', 'v2', 10 * DAY));
  var h = heat.compute(evs, { now: NOW });
  assert.equal(h.up.trend, 'up');
  assert.equal(h.down.trend, 'down');
  assert.equal(h.flat.trend, 'flat');
  assert.deepEqual([h.up.week, h.up.prevWeek], [6, 1]);
});

test('levels: relative rank with absolute floors', function() {
  var evs = [];
  // 10 shoots: s0 gets 30 visitors' zips (huge), s1 gets 2 zips, the rest a few page views each
  for (var i = 0; i < 30; i++) evs.push(e('zip', 's0', 'v' + i, 0, 'zip:s0'));
  evs.push(e('zip', 's1', 'a', 0, 'zip:s1'), e('zip', 's1', 'b', 0, 'zip:s1'));
  for (var k = 2; k < 9; k++) evs.push(e('shoot', 's' + k, 'v1'), e('shoot', 's' + k, 'v2'), e('shoot', 's' + k, 'v3'));
  evs.push(e('shoot', 's9', 'v1'));
  var h = heat.compute(evs, { now: NOW });
  assert.equal(h.s0.level, 3);
  assert.equal(h.s1.level, 2);   // top 30% and score 20 ≥ floor 8
  assert.equal(h.s2.level, 1);   // top 30% by rank, but score 3 < floor 8
  assert.equal(h.s8.level, 1);
  assert.equal(h.s9.level, 0);   // a single view is below the 🔥 floor
  assert.equal(heat.of(h, 'nothing').level, 0);
});

test('fromView / fromDownload map raw rows', function() {
  assert.deepEqual(heat.fromView({ entityType: 'shoot-photo', entityId: 'w/a', ip: '1', ms: 5 }),
    { kind: 'shoot-photo', slug: 'w', target: 'w/a', visitor: '1', ms: 5 });
  assert.equal(heat.fromView({ entityType: 'photo', entityId: 'ge/tb/a', ms: 5 }), null);
  assert.equal(heat.fromView({ entityType: 'shoot', entityId: 'w', ms: 5, bot: true }), null);
  assert.deepEqual(heat.fromDownload({ kind: 'ig', slug: 'w', photoId: 'a', ms: 5 }),
    { kind: 'ig', slug: 'w', target: 'ig:a', visitor: null, ms: 5 });
  assert.equal(heat.fromDownload({ kind: 'other', slug: 'w', ms: 5 }), null);
});
