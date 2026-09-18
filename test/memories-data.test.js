'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var makeFakeDb = require('./helpers/fake-firestore.js');
var data = require('../lib/memories-data.js');

test('insertMemory assigns a unique slug from the name', async function() {
  var db = makeFakeDb();
  data.init(db);
  var id = await data.insertMemory({ name: 'Trip to Svaneti' });
  var m = await data.getMemoryById(id);
  assert.equal(m.slug, 'trip-to-svaneti');
  assert.equal(m.active, true);
  assert.equal(m.ownerId, null);
});

test('insertMemory de-dupes slugs', async function() {
  var db = makeFakeDb();
  data.init(db);
  await data.insertMemory({ name: 'Trip' });
  var id2 = await data.insertMemory({ name: 'Trip' });
  assert.equal((await data.getMemoryById(id2)).slug, 'trip-2');
});

test('getMemoryBySlug finds it, returns null when missing', async function() {
  var db = makeFakeDb();
  data.init(db);
  await data.insertMemory({ name: 'Findable' });
  assert.ok(await data.getMemoryBySlug('findable'));
  assert.equal(await data.getMemoryBySlug('nope'), null);
});

test('getPublicMemories excludes inactive ones', async function() {
  var db = makeFakeDb();
  data.init(db);
  var id1 = await data.insertMemory({ name: 'Visible' });
  var id2 = await data.insertMemory({ name: 'Hidden' });
  await data.updateMemory(id2, { active: false });
  var pub = await data.getPublicMemories();
  assert.deepEqual(pub.map(function(m) { return m.id; }), [id1]);
});

test('updateMemory does not change the slug', async function() {
  var db = makeFakeDb();
  data.init(db);
  var id = await data.insertMemory({ name: 'Original' });
  await data.updateMemory(id, { name: 'Renamed' });
  var m = await data.getMemoryById(id);
  assert.equal(m.name, 'Renamed');
  assert.equal(m.slug, 'original');
});

test('deleteMemory removes the doc', async function() {
  var db = makeFakeDb();
  data.init(db);
  var id = await data.insertMemory({ name: 'Gone soon' });
  await data.deleteMemory(id);
  assert.equal(await data.getMemoryById(id), null);
});
