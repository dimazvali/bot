'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var nav = require('../lib/photo-admin-nav.js');

test('menu keys are unique and cover the spec sections', function() {
  assert.equal(new Set(nav.NAV_KEYS).size, nav.NAV_KEYS.length);
  ['dashboard', 'shoots', 'series', 'images', 'people', 'tags', 'leads', 'feedback',
    'subscribers', 'stats', 'copyright', 'site-texts', 'settings'].forEach(function(k) {
    assert.ok(nav.NAV_KEYS.indexOf(k) !== -1, 'missing ' + k);
  });
});

test('navFor marks exactly the requested item active', function() {
  var items = nav.navFor('people').flatMap(function(g) { return g.items; });
  var active = items.filter(function(i) { return i.active; });
  assert.equal(active.length, 1);
  assert.equal(active[0].key, 'people');
  assert.equal(active[0].href, '/admin/people');
});

test('navFor with an unknown key marks nothing and does not mutate the config', function() {
  var items = nav.navFor('nope').flatMap(function(g) { return g.items; });
  assert.equal(items.filter(function(i) { return i.active; }).length, 0);
  nav.navFor('shoots');
  assert.equal(nav.NAV_GROUPS[0].items[1].active, undefined);
});
