'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var makeFakeDb = require('./helpers/fake-firestore.js');
var data = require('../lib/tbilisi-events-data.js');
var { FieldValue } = require('firebase-admin/firestore');

test('getEvents status=pending returns only pending submissions', async function() {
  var db = makeFakeDb();
  data.init(db);
  await db.collection('tbilisiEvents').add({ title: 'A', date: '2026-09-10', hidden: true, active: false, submission: { userId: 'u1', status: 'pending' } });
  await db.collection('tbilisiEvents').add({ title: 'B', date: '2026-09-11', hidden: false, active: true });
  await db.collection('tbilisiEvents').add({ title: 'C', date: '2026-09-12', hidden: true, active: false, submission: { userId: 'u1', status: 'approved' } });
  var pend = await data.getEvents({ status: 'pending' });
  assert.deepEqual(pend.map(function(e) { return e.title; }), ['A']);
});

test('countSubmissionsByUser counts pending only', async function() {
  var db = makeFakeDb();
  data.init(db);
  await db.collection('tbilisiEvents').add({ title: 'A', date: '2026-09-01', submission: { userId: 'u1', status: 'pending' } });
  await db.collection('tbilisiEvents').add({ title: 'B', date: '2026-09-02', submission: { userId: 'u1', status: 'pending' } });
  await db.collection('tbilisiEvents').add({ title: 'C', date: '2026-09-03', submission: { userId: 'u1', status: 'approved' } });
  await db.collection('tbilisiEvents').add({ title: 'D', date: '2026-09-04', submission: { userId: 'u2', status: 'pending' } });
  assert.equal(await data.countSubmissionsByUser('u1'), 2);
});

test('organizer claim lifecycle: insert, dedup, list, decide, set on doc', async function() {
  var db = makeFakeDb();
  data.init(db);
  var ev = await db.collection('tbilisiEvents').add({ title: 'Show', date: '2026-09-01' });
  var c1 = await data.insertOrganizerClaim({ uid: 'u1', targetType: 'event', targetId: ev.id, message: 'me' });
  assert.equal(c1.status, 'new');
  assert.ok(await data.getActiveClaim('u1', 'event', ev.id));
  assert.equal(await data.getActiveClaim('u2', 'event', ev.id), null);

  var list = await data.getOrganizerClaims({});
  assert.equal(list.length, 1);

  await data.decideOrganizerClaim(c1.id, 'approved');
  var got = await data.getOrganizerClaimById(c1.id);
  assert.equal(got.status, 'approved');
  assert.ok(got.decidedAt);

  await data.setEventOrganizer(ev.id, 'u1');
  assert.equal((await data.getEventById(ev.id)).organizerUserId, 'u1');

  assert.ok(await data.getActiveClaim('u1', 'event', ev.id));
});

test('insertSubmission builds the event doc shape', async function() {
  var db = makeFakeDb();
  data.init(db);
  var id = await data.insertSubmission({ userId: 'u9', title: 'T', date: '2026-10-01', time: '19:00', place: 'Hall', type: 'concert', description: 'text here', url: 'https://x.com/e', imageSourceUrl: 'https://x.com/i.jpg', contactNote: 'tg @me' });
  var e = await data.getEventById(id);
  assert.equal(e.active, false);
  assert.equal(e.hidden, true);
  assert.equal(e.submission.userId, 'u9');
  assert.equal(e.submission.status, 'pending');
  assert.ok(e.submission.submittedAt);
  assert.equal(e.rawExcerpt, 'text here');
  assert.equal(e.imageSourceUrl, 'https://x.com/i.jpg');
  assert.deepEqual(e.sources, [{ label: 'User submission', url: 'https://x.com/e' }]);
  assert.equal(e.type, 'concert');
});

test('fake-firestore update() applies FieldValue.increment sentinels', async function() {
  var db = makeFakeDb();
  await db.collection('c').doc('a').set({ n: 5, other: 'x' });
  await db.collection('c').doc('a').update({ n: FieldValue.increment(3) });
  var snap = await db.collection('c').doc('a').get();
  assert.equal(snap.data().n, 8);
  assert.equal(snap.data().other, 'x');
});

test('fake-firestore update() increment creates field from 0 when missing', async function() {
  var db = makeFakeDb();
  await db.collection('c').doc('a').set({ other: 'x' });
  await db.collection('c').doc('a').update({ n: FieldValue.increment(1) });
  var snap = await db.collection('c').doc('a').get();
  assert.equal(snap.data().n, 1);
});
