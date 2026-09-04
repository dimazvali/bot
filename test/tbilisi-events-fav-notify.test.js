'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var data = require('../lib/tbilisi-events-data.js');
var teUsers = require('../lib/tbilisi-events-users.js');
var teNotify = require('../lib/tbilisi-events-notify.js');
var favNotify = require('../lib/tbilisi-events-fav-notify.js');

// notifyFavoritedVenue calls the real modules directly (like recordView calling
// data.bumpViewCount/addViewRecord) — monkey-patch their exports for the
// duration of each test and restore in `finally`.
function withStubs(stubs, fn) {
  var saved = {};
  Object.keys(stubs).forEach(function(mod) {
    saved[mod] = {};
    Object.keys(stubs[mod]).forEach(function(k) {
      saved[mod][k] = stubs[mod].__target[k];
      stubs[mod].__target[k] = stubs[mod][k];
    });
  });
  return Promise.resolve().then(fn).finally(function() {
    Object.keys(stubs).forEach(function(mod) {
      Object.keys(saved[mod]).forEach(function(k) { stubs[mod].__target[k] = saved[mod][k]; });
    });
  });
}

test('notifyFavoritedVenue: no venueId on the event -> no-op', async function() {
  var calls = [];
  await withStubs({
    data: { __target: data, getEventById: async function() { return { id: 'e1', venueId: null }; } },
    teNotify: { __target: teNotify, notifyUser: function() { calls.push('notify'); } },
  }, async function() {
    await favNotify.notifyFavoritedVenue('e1');
  });
  assert.deepEqual(calls, []);
});

test('notifyFavoritedVenue: already notified -> no-op', async function() {
  var calls = [];
  await withStubs({
    data: { __target: data, getEventById: async function() { return { id: 'e1', venueId: 'v1', favVenueNotifiedAt: new Date() }; } },
    teNotify: { __target: teNotify, notifyUser: function() { calls.push('notify'); } },
  }, async function() {
    await favNotify.notifyFavoritedVenue('e1');
  });
  assert.deepEqual(calls, []);
});

test('notifyFavoritedVenue: marks the event, notifies opted-in favoriters only', async function() {
  var updateCalls = [];
  var notifyCalls = [];
  await withStubs({
    data: {
      __target: data,
      getEventById: async function() { return { id: 'e1', venueId: 'v1', title: 'Jazz Night', date: '2026-09-20', slug: 'jazz-night', favVenueNotifiedAt: null }; },
      getVenueById: async function() { return { id: 'v1', name: 'Fabrika' }; },
      updateEvent: async function(id, patch) { updateCalls.push([id, patch]); },
      getFavoritingUsers: async function() { return ['u1', 'u2', 'u3']; },
    },
    teUsers: {
      __target: teUsers,
      getUserById: async function(id) {
        if (id === 'u1') return { id: 'u1', notifyFavVenues: true };
        if (id === 'u2') return { id: 'u2', notifyFavVenues: false };
        return null; // u3: no such user
      },
    },
    teNotify: { __target: teNotify, notifyUser: function(uid, key, vars) { notifyCalls.push([uid, key, vars]); } },
  }, async function() {
    await favNotify.notifyFavoritedVenue('e1');
  });
  assert.equal(updateCalls.length, 1);
  assert.equal(updateCalls[0][0], 'e1');
  assert.ok(updateCalls[0][1].favVenueNotifiedAt instanceof Date);
  assert.equal(notifyCalls.length, 1);
  assert.deepEqual(notifyCalls[0][0], 'u1');
  assert.equal(notifyCalls[0][1], 'favVenueEvent');
  assert.equal(notifyCalls[0][2].venueName, 'Fabrika');
  assert.equal(notifyCalls[0][2].eventTitle, 'Jazz Night');
  assert.match(notifyCalls[0][2].link, /\/e\/jazz-night$/);
});

test('notifyFavoritedVenue: one user lookup throwing does not stop the others', async function() {
  var notifyCalls = [];
  await withStubs({
    data: {
      __target: data,
      getEventById: async function() { return { id: 'e1', venueId: 'v1', title: 'T', date: 'd', favVenueNotifiedAt: null }; },
      getVenueById: async function() { return { id: 'v1', name: 'V' }; },
      updateEvent: async function() {},
      getFavoritingUsers: async function() { return ['u1', 'u2']; },
    },
    teUsers: {
      __target: teUsers,
      getUserById: async function(id) {
        if (id === 'u1') throw new Error('boom');
        return { id: 'u2', notifyFavVenues: true };
      },
    },
    teNotify: { __target: teNotify, notifyUser: function(uid) { notifyCalls.push(uid); } },
  }, async function() {
    await favNotify.notifyFavoritedVenue('e1');
  });
  assert.deepEqual(notifyCalls, ['u2']);
});
