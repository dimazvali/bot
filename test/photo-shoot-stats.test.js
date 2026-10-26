'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var ss = require('../lib/photo-shoot-stats.js');

var NOW = Date.parse('2026-10-25T12:00:00Z');
var DAY = 24 * 60 * 60 * 1000;

function ev(over) {
  return Object.assign({ entityType: 'shoot', entityId: 'wed', ms: NOW, deviceType: 'desktop', path: '/shoot/wed', ip: '1.1.1.1' }, over);
}

test('summarize: totals, days, visitors, bots', function() {
  var s = ss.summarize([
    ev({}),
    ev({ ip: '2.2.2.2', ms: NOW - DAY }),
    ev({ entityType: 'shoot-photo', entityId: 'wed/a', path: '/shoot/wed/a' }),
    ev({ entityType: 'shoot-photo', entityId: 'wed/a', path: '/shoot/wed/a', ip: '3.3.3.3' }),
    ev({ entityType: 'shoot-photo', entityId: 'wed/b', path: '/shoot/wed/b' }),
    ev({ bot: true }),
  ], { days: 7, slug: 'wed', now: NOW });
  assert.deepEqual(s.total, { page: 2, photos: 3 });
  assert.equal(s.bots, 1);
  assert.equal(s.visitors, 3);
  assert.equal(s.allDays.length, 7);
  assert.deepEqual(s.allDays[6], { day: '2026-10-25', page: 1, photos: 3 });
  assert.deepEqual(s.allDays[5], { day: '2026-10-24', page: 1, photos: 0 });
  assert.equal(s.maxDay, 4);
  assert.deepEqual(s.topPhotos, [{ id: 'a', count: 2 }, { id: 'b', count: 1 }]);
});

test('summarize: language, devices, referers skip own site', function() {
  var s = ss.summarize([
    ev({ path: '/en/shoot/wed', deviceType: 'mobile', referer: 'https://www.instagram.com/x' }),
    ev({ referer: 'https://l.instagram.com/?u=1' }),
    ev({ referer: 'https://photo.dimazvali.com/shoot' }),
    ev({ deviceType: 'weird' }),
  ], { days: 1, slug: 'wed', now: NOW });
  assert.deepEqual(s.lang, { ru: 3, en: 1 });
  assert.equal(s.devices.mobile, 1);
  assert.equal(s.devices.unknown, 1);
  assert.deepEqual(s.referers, [
    { key: 'instagram.com', count: 1 },
    { key: 'l.instagram.com', count: 1 },
    { key: 'прямые / без referer', count: 1 },
  ]);
});

test('loadEvents: chunks frame ids by 30 and maps docs', async function() {
  var calls = [];
  function query() {
    var w = [];
    var api = {
      where: function(f, op, v) { w.push([f, op, v]); return api; },
      orderBy: function() { return api; }, limit: function() { return api; }, select: function() { return api; },
      get: async function() {
        calls.push(w);
        return { docs: [{ data: function() { return { entityType: 'shoot', entityId: 'wed', timestamp: { toMillis: function() { return NOW; } } }; } }] };
      },
    };
    return api;
  }
  var db = { collection: function(name) { assert.equal(name, 'photo_views'); return query(); } };
  var ids = Array.from({ length: 31 }, function(_, i) { return 'p' + i; });
  var events = await ss.loadEvents(db, 'prod', 'wed', ids, 30, NOW);
  assert.equal(calls.length, 3);
  assert.deepEqual(calls[1][2], ['entityId', 'in', ids.slice(0, 30).map(function(id) { return 'wed/' + id; })]);
  assert.deepEqual(calls[2][2], ['entityId', 'in', ['wed/p30']]);
  assert.equal(events.length, 3);
  assert.equal(events[0].ms, NOW);
});
