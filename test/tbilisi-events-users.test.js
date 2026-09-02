'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var users = require('../lib/tbilisi-events-users.js');
var makeFakeDb = require('./helpers/fake-firestore.js');

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

test('fake firestore: add, get, query, update, delete', async function() {
  var db = makeFakeDb();
  var ref = await db.collection('c').add({ email: 'x@y.com', n: 1 });
  assert.ok(ref.id);
  var snap = await db.collection('c').doc(ref.id).get();
  assert.equal(snap.exists, true);
  assert.equal(snap.data().email, 'x@y.com');

  var q = await db.collection('c').where('email', '==', 'x@y.com').limit(1).get();
  assert.equal(q.empty, false);
  assert.equal(q.docs[0].id, ref.id);
  assert.equal(q.docs.length, 1);

  await db.collection('c').doc(ref.id).update({ n: 2, name: 'X' });
  var snap2 = await db.collection('c').doc(ref.id).get();
  assert.equal(snap2.data().n, 2);
  assert.equal(snap2.data().name, 'X');

  await db.collection('c').doc(ref.id).delete();
  var snap3 = await db.collection('c').doc(ref.id).get();
  assert.equal(snap3.exists, false);

  var empty = await db.collection('c').where('email', '==', 'nope').limit(1).get();
  assert.equal(empty.empty, true);
  assert.equal(empty.docs.length, 0);
});

test('upsertGoogleUser creates then updates by googleId', async function() {
  var db = makeFakeDb();
  users.init(db);
  var u1 = await users.upsertGoogleUser({ sub: 'g1', email: 'A@B.com', name: 'Ann', picture: 'p1', lang: 'en' });
  assert.ok(u1.id);
  assert.equal(u1.email, 'a@b.com');
  assert.equal(u1.googleId, 'g1');
  assert.equal(u1.lang, 'en');

  var u2 = await users.upsertGoogleUser({ sub: 'g1', email: 'A@B.com', name: 'Ann R', picture: 'p2', lang: 'ru' });
  assert.equal(u2.id, u1.id);
  assert.equal(u2.name, 'Ann R');
  assert.equal(u2.picture, 'p2');
  assert.equal(u2.lang, 'ru');
});

test('upsertGoogleUser merges into an existing email-only account', async function() {
  var db = makeFakeDb();
  users.init(db);
  var e = await users.upsertEmailUser('person@x.com', 'ru');
  assert.equal(e.googleId, undefined);
  var g = await users.upsertGoogleUser({ sub: 'g9', email: 'PERSON@x.com', name: 'P', picture: null, lang: 'en' });
  assert.equal(g.id, e.id);
  assert.equal(g.googleId, 'g9');
  assert.equal(g.name, 'P');
});

test('upsertEmailUser is idempotent by normalized email', async function() {
  var db = makeFakeDb();
  users.init(db);
  var a = await users.upsertEmailUser('  Foo@Bar.com ', 'en');
  var b = await users.upsertEmailUser('foo@bar.com', 'ka');
  assert.equal(a.id, b.id);
  assert.equal(b.lang, 'ka');
});

test('getUserById / getUserByEmail', async function() {
  var db = makeFakeDb();
  users.init(db);
  var u = await users.upsertEmailUser('z@z.com', 'en');
  assert.equal((await users.getUserById(u.id)).email, 'z@z.com');
  assert.equal((await users.getUserByEmail('Z@Z.com')).id, u.id);
  assert.equal(await users.getUserById('missing'), null);
  assert.equal(await users.getUserByEmail('missing@x.com'), null);
});
