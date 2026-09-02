'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var users = require('../lib/tbilisi-events-users.js');

test('normalizeEmail lowercases and trims', function() {
  assert.equal(users.normalizeEmail('  Foo.Bar@Example.COM '), 'foo.bar@example.com');
  assert.equal(users.normalizeEmail(''), '');
  assert.equal(users.normalizeEmail(undefined), '');
});

test('safeNext accepts only same-app absolute paths', function() {
  assert.equal(users.safeNext('/tbilisi-events/suggest'), '/tbilisi-events/suggest');
  assert.equal(users.safeNext('/tbilisi-events/e/abc?x=1'), '/tbilisi-events/e/abc?x=1');
  assert.equal(users.safeNext('/other/place'), '/tbilisi-events');
  assert.equal(users.safeNext('https://evil.com'), '/tbilisi-events');
  assert.equal(users.safeNext('//evil.com'), '/tbilisi-events');
  assert.equal(users.safeNext('/tbilisi-events/\\evil'), '/tbilisi-events');
  assert.equal(users.safeNext(''), '/tbilisi-events');
  assert.equal(users.safeNext(undefined), '/tbilisi-events');
});

test('sessionPayload keeps only the small public fields', function() {
  var payload = users.sessionPayload({
    id: 'u1', email: 'a@b.com', name: 'A', picture: 'p', googleId: 'g',
    tgUserId: '42', tgLinkToken: 'sekret', createdAt: new Date(),
  });
  assert.deepEqual(payload, { uid: 'u1', email: 'a@b.com', name: 'A', picture: 'p', tg: true });
});

test('sessionPayload marks tg:false when not linked', function() {
  var payload = users.sessionPayload({ id: 'u1', email: 'a@b.com', name: '', picture: null });
  assert.equal(payload.tg, false);
  assert.equal(payload.picture, null);
});

test('sameOrigin compares Origin/Referer host to Host header', function() {
  function req(headers) { return { get: function(h) { return headers[h.toLowerCase()]; } }; }
  assert.equal(users.sameOrigin(req({ host: 'events.tbiliseli.com', origin: 'https://events.tbiliseli.com' })), true);
  assert.equal(users.sameOrigin(req({ host: 'events.tbiliseli.com', origin: 'https://evil.com' })), false);
  assert.equal(users.sameOrigin(req({ host: 'events.tbiliseli.com', referer: 'https://events.tbiliseli.com/tbilisi-events/login' })), true);
  assert.equal(users.sameOrigin(req({ host: 'events.tbiliseli.com' })), false);
});

test('deepLink builds a t.me start link', function() {
  var prev = process.env.EKA_BOT_NAME;
  process.env.EKA_BOT_NAME = 'tbiliseli_bot';
  assert.equal(users.deepLink('abc123'), 'https://t.me/tbiliseli_bot?start=te_abc123');
  if (prev === undefined) delete process.env.EKA_BOT_NAME; else process.env.EKA_BOT_NAME = prev;
});
