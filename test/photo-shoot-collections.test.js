'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var { isCollectionAuthor } = require('../lib/photo-shoots.js');

function google(id, email) { return { via: 'google', id: id, email: email || null }; }
function tg(id) { return { via: 'telegram', id: id }; }

test('isCollectionAuthor: the Google account that saved it', function() {
  var col = { authorGoogleId: 'g1', authorEmail: 'a@x.com' };
  assert.equal(isCollectionAuthor(col, google('g1')), true);
  // same email, other account: no — the id wins once it is stored
  assert.equal(isCollectionAuthor(col, google('g2', 'a@x.com')), false);
  assert.equal(isCollectionAuthor(col, tg('g1')), false);
});

test('isCollectionAuthor: older Google collections without the id fall back to the email', function() {
  var col = { authorEmail: 'Asya@Gmail.com' };
  assert.equal(isCollectionAuthor(col, google('g9', 'asya@gmail.com')), true);
  assert.equal(isCollectionAuthor(col, google('g9', 'other@gmail.com')), false);
  assert.equal(isCollectionAuthor(col, google('g9')), false);
});

test('isCollectionAuthor: the Telegram account that saved it', function() {
  var col = { authorTgId: '42', authorTgUsername: 'asya' };
  assert.equal(isCollectionAuthor(col, tg('42')), true);
  assert.equal(isCollectionAuthor(col, tg(42)), true);
  assert.equal(isCollectionAuthor(col, tg('43')), false);
  assert.equal(isCollectionAuthor(col, google('42')), false);
});

test('isCollectionAuthor: no author / no visitor', function() {
  assert.equal(isCollectionAuthor({}, google('g1', 'a@x.com')), false);
  assert.equal(isCollectionAuthor({}, tg('42')), false);
  assert.equal(isCollectionAuthor({ authorGoogleId: 'g1' }, null), false);
  assert.equal(isCollectionAuthor(null, google('g1')), false);
});
