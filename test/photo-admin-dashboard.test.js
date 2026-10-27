'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var dash = require('../lib/photo-admin-dashboard.js');

var NOW = Date.parse('2026-10-15T12:00:00Z');
var DAY = 24 * 60 * 60 * 1000;

function shoot(label, createdAt, extra) {
  return Object.assign({ label: label, public: true, password: '', createdAt: createdAt, photos: [
    { id: 'a', urls: { thumb: label + '-a.webp', preview: label + '-a-800.webp' } },
    { id: 'b', urls: { thumb: label + '-b.webp' } },
  ] }, extra || {});
}

function deps(over) {
  return Object.assign({
    now: NOW,
    shootsData: {
      old: shoot('Old', '2026-01-01T00:00:00Z'),
      fresh: shoot('Fresh', '2026-10-10T00:00:00Z', { heroPhotoId: 'b', public: false }),
    },
    getCopyrightHits: async function(opts) { assert.deepEqual(opts, { onlyNew: true }); return [{}, {}]; },
    getComments: async function() {
      return [{ createdAt: new Date(NOW - DAY).toISOString() }, { createdAt: new Date(NOW - 10 * DAY).toISOString() }, { createdAt: null }];
    },
    listLeads: async function(f) {
      assert.deepEqual(f, { zone: 'hot' });
      return [{ foundAt: NOW - 3600 * 1000 }, { foundAt: NOW - 2 * DAY }];
    },
    countAnonFaceGroups: function() { return 5; },
    getRecentViews: async function() { return []; },
  }, over || {});
}

test('attention counters', async function() {
  var d = await dash.buildDashboard(deps({
    shootsData: { s: shoot('S', '2026-10-01T00:00:00Z', { photos: [{ id: 'p', urls: {}, annotations: [
      { source: 'client', createdAt: '2026-10-14' },
      { source: 'client', createdAt: '2026-09-01' },
      { source: 'admin', createdAt: '2026-10-14' },
    ] }] }) },
  }));
  var byKey = {};
  d.attention.forEach(function(a) { byKey[a.key] = a; });
  assert.equal(byKey.copyright.count, 2);
  assert.equal(byKey.feedback.count, 2); // 1 recent comment + 1 recent guest point
  assert.equal(byKey.leads.count, 1);
  assert.equal(byKey.faces.count, 5);
  assert.equal(byKey.copyright.href, '/admin/copyright?filter=new');
  assert.equal(byKey.faces.href, '/admin/people');
});

test('a failing source gives null instead of throwing', async function() {
  var d = await dash.buildDashboard(deps({ getCopyrightHits: async function() { throw new Error('firestore down'); } }));
  assert.equal(d.attention.find(function(a) { return a.key === 'copyright'; }).count, null);
  assert.equal(d.attention.find(function(a) { return a.key === 'leads'; }).count, 1);
});

test('recent shoots: newest first, hero photo as cover, first photo otherwise', async function() {
  var d = await dash.buildDashboard(deps());
  assert.deepEqual(d.recentShoots.map(function(s) { return s.slug; }), ['fresh', 'old']);
  assert.equal(d.recentShoots[0].cover, 'Fresh-b.webp');
  assert.equal(d.recentShoots[0].public, false);
  assert.equal(d.recentShoots[1].cover, 'Old-a.webp');
  assert.equal(d.recentShoots[1].photoCount, 2);
});

test('recent shoots are capped at 12', async function() {
  var many = {};
  for (var i = 0; i < 20; i++) many['s' + i] = shoot('S' + i, new Date(NOW - i * DAY).toISOString());
  var d = await dash.buildDashboard(deps({ shootsData: many }));
  assert.equal(d.recentShoots.length, 12);
  assert.equal(d.recentShoots[0].slug, 's0');
});

// NOW is 2026-10-15 16:00 in Tbilisi (UTC+4): "today" started at 2026-10-14T20:00Z.
test('views: today vs yesterday up to the same time, 7 days vs the 7 before; bots excluded', async function() {
  var askedSince = null;
  function v(iso, bot) { return { ms: Date.parse(iso), bot: !!bot }; }
  var d = await dash.buildDashboard(deps({
    getRecentViews: async function(since) {
      askedSince = since;
      return [
        v('2026-10-15T10:00:00Z'), v('2026-10-14T21:00:00Z'), // today (after Tbilisi midnight)
        v('2026-10-15T11:00:00Z', true),                      // bot — never counted
        v('2026-10-14T11:00:00Z'),                            // yesterday, before "this time yesterday"
        v('2026-10-14T13:00:00Z'),                            // yesterday, but after this time → not in "prev today"
        v('2026-10-13T19:00:00Z'),                            // before yesterday's Tbilisi midnight
        v(new Date(NOW - 8 * DAY).toISOString()), v(new Date(NOW - 9 * DAY).toISOString()), // previous week
        v(new Date(NOW - 15 * DAY).toISOString()),            // outside both weeks
      ];
    },
  }));
  assert.equal(askedSince, NOW - 14 * DAY);
  assert.deepEqual(d.views.today, { count: 2, prev: 1, deltaPct: 100 });
  assert.deepEqual(d.views.week, { count: 5, prev: 2, deltaPct: 150 });
});

test('views: no previous views → deltaPct null; failing source → views null', async function() {
  var d = await dash.buildDashboard(deps({
    getRecentViews: async function() { return [{ ms: NOW - 3600 * 1000, bot: false }]; },
  }));
  assert.deepEqual(d.views.today, { count: 1, prev: 0, deltaPct: null });
  var failed = await dash.buildDashboard(deps({ getRecentViews: async function() { throw new Error('x'); } }));
  assert.equal(failed.views, null);
});

test('hot content: only units with a level, hottest first, existing content only', async function() {
  var lvl = function(score, level) { return { score: score, level: level, trend: 'flat' }; };
  var d = await dash.buildDashboard(deps({
    photoData: {
      ge: { label: 'Грузия', series: { tb: { label: 'Тбилиси', photos: [{ id: 'x', title: 'Мост', urls: { thumb: 'x.webp' } }] } } },
    },
    getHeat: async function() {
      return {
        shoots: { old: lvl(3, 1), fresh: lvl(30, 3), gone: lvl(99, 3), cold: lvl(0.4, 0) },
        series: { 'ge/tb': lvl(12, 2), 'ge/nope': lvl(50, 3) },
        photos: { 'ge/tb/x': lvl(9, 2), 'shoot:fresh/b': lvl(20, 3), 'shoot:fresh/zz': lvl(40, 3) },
      };
    },
  }));
  assert.deepEqual(d.hot.shoots.map(function(s) { return [s.slug, s.label, s.level]; }), [['fresh', 'Fresh', 3], ['old', 'Old', 1]]);
  assert.equal(d.hot.shoots[0].cover, 'Fresh-b.webp');
  assert.deepEqual(d.hot.series.map(function(s) { return [s.key, s.label, s.sub, s.cover, s.href]; }),
    [['ge/tb', 'Тбилиси', 'Грузия', 'x.webp', '/admin/ge/tb/edit#stats']]);
  assert.deepEqual(d.hot.frames.map(function(f) { return [f.key, f.label, f.sub, f.href]; }), [
    ['shoot:fresh/b', 'b', 'Fresh', '/admin/shoots/fresh/photos/b/edit#frame-stats'],
    ['ge/tb/x', 'Мост', 'Тбилиси', '/admin/ge/tb/x/edit#frame-stats'],
  ]);
});

test('hot content: no heat source → empty lists', async function() {
  var d = await dash.buildDashboard(deps());
  assert.deepEqual(d.hot, { shoots: [], series: [], frames: [] });
});
