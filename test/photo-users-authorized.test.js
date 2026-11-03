'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var { mergeAuthorized } = require('../lib/photo-users.js');

function ts(ms) { return { toMillis: function() { return ms; } }; }

test('mergeAuthorized: Google + Telegram + Telegram known only from downloads, newest first', function() {
  var google = [{ googleId: 'g1', name: 'Боб', email: 'bob@x.com', picture: 'p.jpg', createdAt: ts(100), updatedAt: ts(300) }];
  var tg = [{ tgId: '42', name: 'Ася К', username: 'asya', createdAt: 200, lastLoginAt: 400 }];
  var downloads = {
    'google~g1': { count: 3, lastMs: 900, user: { via: 'google', id: 'g1' } },
    'telegram~7': { count: 1, lastMs: 50, user: { via: 'telegram', id: '7', name: 'Старый', username: null } },
  };
  assert.deepEqual(mergeAuthorized(google, tg, downloads), [
    { via: 'google', id: 'g1', name: 'Боб', contact: 'bob@x.com', picture: 'p.jpg', firstMs: 100, lastMs: 900, downloads: 3 },
    { via: 'telegram', id: '42', name: 'Ася К', contact: '@asya', picture: null, firstMs: 200, lastMs: 400, downloads: 0 },
    { via: 'telegram', id: '7', name: 'Старый', contact: '', picture: null, firstMs: 0, lastMs: 50, downloads: 1 },
  ]);
});

test('mergeAuthorized: empty inputs', function() {
  assert.deepEqual(mergeAuthorized([], [], {}), []);
  assert.deepEqual(mergeAuthorized(null, null, null), []);
});
