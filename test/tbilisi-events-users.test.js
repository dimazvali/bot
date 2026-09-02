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

test('issueLoginToken stores a hex token with email + next', async function() {
  var db = makeFakeDb();
  users.init(db);
  var tok = await users.issueLoginToken('Me@Here.com', '/tbilisi-events/suggest');
  assert.match(tok, /^[0-9a-f]{64}$/);
  var stored = db._store.tbilisiEventsLoginTokens[tok];
  assert.equal(stored.email, 'me@here.com');
  assert.equal(stored.next, '/tbilisi-events/suggest');
  assert.ok(stored.createdAt instanceof Date);
  assert.equal(stored.usedAt, undefined);
});

test('recentLoginTokenFor finds an unexpired unused token within 60s', async function() {
  var db = makeFakeDb();
  users.init(db);
  await users.issueLoginToken('a@b.com', '/tbilisi-events');
  var now = Date.now();
  assert.equal(await users.recentLoginTokenFor('a@b.com', now + 30 * 1000), true);
  assert.equal(await users.recentLoginTokenFor('a@b.com', now + 120 * 1000), false);
  assert.equal(await users.recentLoginTokenFor('other@b.com', now), false);
});

test('redeemLoginToken: happy path returns email + next and marks used', async function() {
  var db = makeFakeDb();
  users.init(db);
  var tok = await users.issueLoginToken('c@d.com', '/tbilisi-events/me');
  var res = await users.redeemLoginToken(tok, Date.now());
  assert.equal(res.ok, true);
  assert.equal(res.email, 'c@d.com');
  assert.equal(res.next, '/tbilisi-events/me');
  assert.ok(db._store.tbilisiEventsLoginTokens[tok].usedAt instanceof Date);
});

test('redeemLoginToken: rejects unknown, used, and expired tokens', async function() {
  var db = makeFakeDb();
  users.init(db);
  assert.deepEqual(await users.redeemLoginToken('nope', Date.now()), { ok: false, reason: 'not_found' });

  var t1 = await users.issueLoginToken('e@f.com', '/tbilisi-events');
  await users.redeemLoginToken(t1, Date.now());
  assert.deepEqual(await users.redeemLoginToken(t1, Date.now()), { ok: false, reason: 'used' });

  var t2 = await users.issueLoginToken('g@h.com', '/tbilisi-events');
  var late = Date.now() + users.LOGIN_TOKEN_TTL_MS + 1;
  assert.deepEqual(await users.redeemLoginToken(t2, late), { ok: false, reason: 'expired' });
});

test('redeemLoginToken handles a Firestore Timestamp (not a Date) createdAt', async function() {
  var db = makeFakeDb();
  users.init(db);
  var tok = await users.issueLoginToken('ts@x.com', '/tbilisi-events');
  var old = new Date(Date.now() - users.LOGIN_TOKEN_TTL_MS - 60000);
  db._store.tbilisiEventsLoginTokens[tok].createdAt = { toDate: function() { return old; } };
  assert.deepEqual(await users.redeemLoginToken(tok, Date.now()), { ok: false, reason: 'expired' });

  var tok2 = await users.issueLoginToken('ts2@x.com', '/tbilisi-events');
  db._store.tbilisiEventsLoginTokens[tok2].createdAt = { toDate: function() { return new Date(Date.now() - 60000); } };
  var res = await users.redeemLoginToken(tok2, Date.now());
  assert.equal(res.ok, true);
});

test('ensureTgLinkToken: generates once, reuses, reports linked', async function() {
  var db = makeFakeDb();
  users.init(db);
  var u = await users.upsertEmailUser('t@t.com', 'en');

  var r1 = await users.ensureTgLinkToken(u.id);
  assert.match(r1.token, /^[0-9a-f]{18}$/);
  assert.equal(r1.linked, false);

  var r2 = await users.ensureTgLinkToken(u.id);
  assert.equal(r2.token, r1.token);

  await users.linkTelegram('te_' + r1.token, { id: 555, first_name: 'T' });
  var r3 = await users.ensureTgLinkToken(u.id);
  assert.equal(r3.linked, true);
  assert.equal(r3.token, undefined);
});

test('linkTelegram: happy path sets tgUserId and clears token', async function() {
  var db = makeFakeDb();
  users.init(db);
  var u = await users.upsertEmailUser('link@me.com', 'en');
  var { token } = await users.ensureTgLinkToken(u.id);

  var res = await users.linkTelegram('te_' + token, { id: 999, first_name: 'Z' });
  assert.equal(res.ok, true);
  assert.equal(res.user.id, u.id);

  var fresh = await users.getUserById(u.id);
  assert.equal(fresh.tgUserId, '999');
  assert.equal(fresh.tgLinkToken, null);
  assert.ok(fresh.tgLinkedAt instanceof Date);
});

test('linkTelegram: unknown token and bad prefix', async function() {
  var db = makeFakeDb();
  users.init(db);
  assert.deepEqual(await users.linkTelegram('te_deadbeef', { id: 1 }), { ok: false, reason: 'not_found' });
  assert.deepEqual(await users.linkTelegram('xx_whatever', { id: 1 }), { ok: false, reason: 'bad_payload' });
});

test('linkTelegram: telegram id already linked to another account', async function() {
  var db = makeFakeDb();
  users.init(db);
  var a = await users.upsertEmailUser('a@one.com', 'en');
  var b = await users.upsertEmailUser('b@two.com', 'en');
  var ta = (await users.ensureTgLinkToken(a.id)).token;
  var tb = (await users.ensureTgLinkToken(b.id)).token;
  await users.linkTelegram('te_' + ta, { id: 7, first_name: 'A' });
  assert.deepEqual(await users.linkTelegram('te_' + tb, { id: 7, first_name: 'B' }), { ok: false, reason: 'tg_taken' });
});

test('unlinkTelegram clears the fields', async function() {
  var db = makeFakeDb();
  users.init(db);
  var u = await users.upsertEmailUser('u@u.com', 'en');
  var { token } = await users.ensureTgLinkToken(u.id);
  await users.linkTelegram('te_' + token, { id: 3, first_name: 'U' });
  await users.unlinkTelegram(u.id);
  var fresh = await users.getUserById(u.id);
  assert.equal(fresh.tgUserId, null);
  assert.equal(fresh.tgBlocked, null);
  assert.equal(fresh.tgLinkToken, null);
  assert.equal(fresh.tgLinkedAt, null);
});

test('ensureTgLinkToken returns error for a missing user', async function() {
  var db = makeFakeDb();
  users.init(db);
  assert.deepEqual(await users.ensureTgLinkToken('nope'), { error: 'no_user' });
});
