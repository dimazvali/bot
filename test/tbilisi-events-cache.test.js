'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var makeFakeDb = require('./helpers/fake-firestore.js');
var data = require('../lib/tbilisi-events-data.js');

// Wraps the fake db so tests can see how many collection reads actually reach "Firestore".
function countingDb() {
  var db = makeFakeDb();
  var reads = {};
  var origCollection = db.collection.bind(db);
  db.collection = function(name) {
    var c = origCollection(name);
    var origGet = c.get && c.get.bind(c);
    if (origGet) c.get = function() { reads[name] = (reads[name] || 0) + 1; return origGet.apply(null, arguments); };
    var origOrderBy = c.orderBy && c.orderBy.bind(c);
    if (origOrderBy) {
      c.orderBy = function() {
        var q = origOrderBy.apply(null, arguments);
        var qGet = q.get.bind(q);
        q.get = function() { reads[name] = (reads[name] || 0) + 1; return qGet.apply(null, arguments); };
        return q;
      };
    }
    return c;
  };
  return { db: db, reads: reads };
}

test('full lists are read from Firestore once, then served from memory', async function() {
  var t = countingDb();
  data.init(t.db);
  await t.db.collection('tbilisiEvents').add({ title: 'A', date: '2026-10-10' });
  await t.db.collection('tbilisiEventsVenues').add({ name: 'V' });

  for (var i = 0; i < 5; i++) {
    await data.getPublicEvents();
    await data.getAllEvents();
    await data.getVenues();
  }
  assert.equal(t.reads.tbilisiEvents, 1);
  assert.equal(t.reads.tbilisiEventsVenues, 1);
});

test('concurrent first calls share a single read', async function() {
  var t = countingDb();
  data.init(t.db);
  await t.db.collection('tbilisiEvents').add({ title: 'A', date: '2026-10-10' });
  await Promise.all([data.getAllEvents(), data.getAllEvents(), data.getPublicEvents()]);
  assert.equal(t.reads.tbilisiEvents, 1);
});

test('writes through the module invalidate the cached list', async function() {
  var t = countingDb();
  data.init(t.db);
  var id = await data.insertEvent({ title: 'Old', date: '2026-10-10' });
  assert.equal((await data.getAllEvents())[0].title, 'Old');

  await data.updateEvent(id, { title: 'New' });
  assert.equal((await data.getAllEvents())[0].title, 'New');

  await data.insertEvent({ title: 'Second', date: '2026-10-11' });
  assert.equal((await data.getAllEvents()).length, 2);

  await data.deleteEvent(id);
  assert.deepEqual((await data.getAllEvents()).map(function(e) { return e.title; }), ['Second']);

  var vId = await data.insertVenue({ name: 'Bar' });
  assert.equal((await data.getVenues()).length, 1);
  await data.updateVenue(vId, { name: 'Bar 2' });
  assert.equal((await data.getVenues())[0].name, 'Bar 2');
});

test('callers get copies: decorating a returned entity does not leak into the cache', async function() {
  var t = countingDb();
  data.init(t.db);
  await data.insertEvent({ title: 'A', date: '2026-10-10' });

  var first = await data.getAllEvents();
  first[0].href = '/en/e/a';           // what route handlers do per request / language
  first.push({ id: 'junk' });

  var second = await data.getAllEvents();
  assert.equal(second.length, 1);
  assert.equal(second[0].href, undefined);
  assert.notEqual(second, first);
});

test('a view bumps the cached counter instead of dropping the cache', async function() {
  var t = countingDb();
  data.init(t.db);
  var id = await data.insertEvent({ title: 'A', date: '2026-10-10' });
  await data.getAllEvents(); // warm
  var before = t.reads.tbilisiEvents;

  await data.bumpViewCount('event', id);
  await data.bumpViewCount('event', id);
  var list = await data.getAllEvents();

  assert.equal(list[0].viewCount, 2);
  assert.equal(t.reads.tbilisiEvents, before, 'no re-read after views');
});

test('init() starts with an empty cache (fresh db per test)', async function() {
  var t1 = countingDb();
  data.init(t1.db);
  await data.insertEvent({ title: 'From db 1', date: '2026-10-10' });
  await data.getAllEvents();

  var t2 = countingDb();
  data.init(t2.db);
  assert.equal((await data.getAllEvents()).length, 0);
});
