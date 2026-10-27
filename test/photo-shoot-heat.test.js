'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var heat = require('../lib/photo-shoot-heat.js');

var NOW = Date.parse('2026-10-26T12:00:00Z');
var DAY = 24 * 60 * 60 * 1000;

function e(kind, unit, visitor, ageMs, target) {
  return { kind: kind, unit: unit, target: target || (kind === 'shoot' ? unit : unit + '/a'), visitor: visitor, ms: NOW - (ageMs || 0) };
}

test('weights by intent, fresh events count in full', function() {
  var h = heat.compute([
    e('shoot', 'w', 'v1'),
    e('shoot-photo', 'w', 'v1'),
    e('ig', 'w', 'v1', 0, 'ig:a'),
    e('sel', 'w', 'v1', 0, 'sel:w'),
  ], { now: NOW });
  assert.equal(h.w.score, 1 + 2 + 5 + 8);
  assert.deepEqual(h.w.parts, { page: 1, frames: 2, downloads: 13, actions: 0 });
});

test('same action of the same visitor counts once a day', function() {
  var h = heat.compute([e('shoot', 'w', 'v1'), e('shoot', 'w', 'v1'), e('shoot', 'w', 'v2')], { now: NOW });
  assert.equal(h.w.score, 2);
});

test('events without a visitor are not deduped', function() {
  var h = heat.compute([e('zip', 'w', null, 0, 'zip:w'), e('zip', 'w', null, 0, 'zip:w')], { now: NOW });
  assert.equal(h.w.score, 20);
});

test('one visitor gives a unit at most DAILY_CAP points a day', function() {
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
  // 10 units: s0 gets 30 visitors' zips (huge), s1 gets 2 zips, the rest a few page views each
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

test('fromView: shoots, gallery pages, inquiries, Instagram clicks', function() {
  assert.deepEqual(heat.fromView({ entityType: 'shoot-photo', entityId: 'w/a', ip: '1', ms: 5 }),
    { kind: 'shoot-photo', unit: 'shoot:w', photo: 'shoot:w/a', target: 'w/a', visitor: '1', ms: 5 });
  assert.deepEqual(heat.fromView({ entityType: 'photo', entityId: 'ge/tb/a', ms: 5 }),
    { kind: 'photo', unit: 'series:ge/tb', photo: 'ge/tb/a', target: 'ge/tb/a', visitor: null, ms: 5 });
  assert.equal(heat.fromView({ entityType: 'inquiry', entityId: 'ge/tb/a', ms: 5 }).kind, 'inquiry');
  assert.deepEqual(heat.fromView({ entityType: 'series', entityId: 'ge/tb', ms: 5 }).unit, 'series:ge/tb');
  assert.deepEqual(heat.fromView({ entityType: 'country', entityId: 'ge', ms: 5 }).unit, 'country:ge');
  var ig = heat.fromView({ entityType: 'instagram', entityId: '/en/ge/tb/a', ms: 5 });
  assert.deepEqual([ig.kind, ig.unit, ig.photo], ['igclick', 'series:ge/tb', 'ge/tb/a']);
  assert.equal(heat.fromView({ entityType: 'instagram', entityId: '/about', ms: 5 }), null);
  assert.equal(heat.fromView({ entityType: 'shoot', entityId: 'w', ms: 5, bot: true }), null);
});

test('unitOfPath', function() {
  assert.deepEqual(heat.unitOfPath('/shoot/wed/a?x=1'), { unit: 'shoot:wed', photo: 'shoot:wed/a' });
  assert.deepEqual(heat.unitOfPath('/ge/tb'), { unit: 'series:ge/tb', photo: null });
  assert.equal(heat.unitOfPath('/tag/sea/x'), null);
  assert.equal(heat.unitOfPath('/ge'), null);
});

test('fromDownload / fromComment', function() {
  assert.deepEqual(heat.fromDownload({ kind: 'ig', slug: 'w', photoId: 'a', ms: 5 }),
    { kind: 'ig', unit: 'shoot:w', photo: 'shoot:w/a', target: 'ig:a', visitor: null, ms: 5 });
  assert.equal(heat.fromDownload({ kind: 'other', slug: 'w', ms: 5 }), null);
  assert.deepEqual(heat.fromComment({ photoId: 'ge_tb_a', userId: 'u1', ms: 5 }),
    { kind: 'comment', unit: 'series:ge/tb', photo: 'ge/tb/a', target: 'ge_tb_a', visitor: 'g:u1', ms: 5 });
  assert.equal(heat.fromComment({ photoId: 'shoot_w_a', userId: 'u1', ms: 5 }).unit, 'shoot:w');
  assert.equal(heat.fromComment({ photoId: 'ge_tb_a', ms: 5, hidden: true }), null);
});

test('computeAll: kinds ranked apart, country = own page + its series, hot frames', function() {
  var v = function(type, id, ip) { return heat.fromView({ entityType: type, entityId: id, ip: ip, ms: NOW }); };
  var evs = [
    v('shoot', 'wed', '1'), v('shoot-photo', 'wed/a', '1'),
    v('country', 'ge', '1'),
    v('series', 'ge/tb', '1'), v('photo', 'ge/tb/x', '1'), v('photo', 'ge/tb/x', '2'), v('inquiry', 'ge/tb/x', '2'),
    v('series', 'ge/kh', '3'),
  ].filter(Boolean);
  var all = heat.computeAll(evs, { now: NOW });
  assert.deepEqual(Object.keys(all.shoots), ['wed']);
  assert.equal(all.series['ge/tb'].score, 1 + 2 + 2 + 10);
  assert.equal(all.series['ge/tb'].parts.actions, 10);
  assert.equal(all.countries.ge.score, 1 + 15 + 1);
  assert.equal(all.countries.ge.parts.page, 3);
  assert.equal(all.photos['ge/tb/x'].score, 14);
  assert.equal(all.photos['shoot:wed/a'].score, 2);
  assert.equal(all.series['ge/tb'].level, 2); // top of its kind, but 15 < the 🔥🔥🔥 floor
  assert.equal(all.series['ge/kh'].level, 0);
  assert.deepEqual(heat.rankOf(all.series, 'ge/tb'), { rank: 1, of: 2 });
  assert.deepEqual(heat.rankOf(all.series, 'nope'), { rank: null, of: 2 });
});
