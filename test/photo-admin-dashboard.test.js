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
