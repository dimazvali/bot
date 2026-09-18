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

test('insertMemoryPhoto appends to the end of the order', async function() {
  var db = makeFakeDb();
  data.init(db);
  var mid = await data.insertMemory({ name: 'M' });
  var p1 = await data.insertMemoryPhoto({ memoryId: mid, lat: 41.7, lng: 44.8, urls: {} });
  var p2 = await data.insertMemoryPhoto({ memoryId: mid, lat: 41.71, lng: 44.81, urls: {} });
  var photos = await data.getMemoryPhotos(mid);
  assert.deepEqual(photos.map(function(p) { return p.id; }), [p1, p2]);
  assert.equal(photos[0].order, 0);
  assert.equal(photos[1].order, 1);
});

test('getMemoryPhotos returns only photos for that memory, sorted by order', async function() {
  var db = makeFakeDb();
  data.init(db);
  var m1 = await data.insertMemory({ name: 'A' });
  var m2 = await data.insertMemory({ name: 'B' });
  await data.insertMemoryPhoto({ memoryId: m1, lat: 1, lng: 1, urls: {} });
  await data.insertMemoryPhoto({ memoryId: m2, lat: 2, lng: 2, urls: {} });
  assert.equal((await data.getMemoryPhotos(m1)).length, 1);
  assert.equal((await data.getMemoryPhotos(m2)).length, 1);
});

test('moveMemoryPhoto swaps order with the previous sibling', async function() {
  var db = makeFakeDb();
  data.init(db);
  var mid = await data.insertMemory({ name: 'M' });
  var p1 = await data.insertMemoryPhoto({ memoryId: mid, lat: 1, lng: 1, urls: {} });
  var p2 = await data.insertMemoryPhoto({ memoryId: mid, lat: 2, lng: 2, urls: {} });
  await data.moveMemoryPhoto(p2, 'up');
  var photos = await data.getMemoryPhotos(mid);
  assert.deepEqual(photos.map(function(p) { return p.id; }), [p2, p1]);
});

test('moveMemoryPhoto is a no-op at the boundary', async function() {
  var db = makeFakeDb();
  data.init(db);
  var mid = await data.insertMemory({ name: 'M' });
  var p1 = await data.insertMemoryPhoto({ memoryId: mid, lat: 1, lng: 1, urls: {} });
  await data.moveMemoryPhoto(p1, 'up'); // already first
  var photos = await data.getMemoryPhotos(mid);
  assert.equal(photos[0].id, p1);
});

test('deleteMemory also deletes its photos', async function() {
  var db = makeFakeDb();
  data.init(db);
  var mid = await data.insertMemory({ name: 'M' });
  await data.insertMemoryPhoto({ memoryId: mid, lat: 1, lng: 1, urls: {} });
  await data.deleteMemory(mid);
  assert.equal((await data.getMemoryPhotos(mid)).length, 0);
});

test('updateMemoryPhoto patches fields', async function() {
  var db = makeFakeDb();
  data.init(db);
  var mid = await data.insertMemory({ name: 'M' });
  var pid = await data.insertMemoryPhoto({ memoryId: mid, lat: 1, lng: 1, urls: {} });
  await data.updateMemoryPhoto(pid, { caption: 'Hello', lat: 1.5 });
  var photo = await data.getMemoryPhotoById(pid);
  assert.equal(photo.caption, 'Hello');
  assert.equal(photo.lat, 1.5);
});

test('deleteMemoryPhoto removes just that photo', async function() {
  var db = makeFakeDb();
  data.init(db);
  var mid = await data.insertMemory({ name: 'M' });
  var p1 = await data.insertMemoryPhoto({ memoryId: mid, lat: 1, lng: 1, urls: {} });
  var p2 = await data.insertMemoryPhoto({ memoryId: mid, lat: 2, lng: 2, urls: {} });
  await data.deleteMemoryPhoto(p1);
  var photos = await data.getMemoryPhotos(mid);
  assert.deepEqual(photos.map(function(p) { return p.id; }), [p2]);
});

test('getArSettings returns defaults when unset', async function() {
  var db = makeFakeDb();
  data.init(db);
  var s = await data.getArSettings();
  assert.equal(s.minVisibleDistance, 200);
  assert.equal(s.fullSizeDistance, 50);
});

test('updateArSettings persists and getArSettings reflects it', async function() {
  var db = makeFakeDb();
  data.init(db);
  await data.updateArSettings({ minVisibleDistance: 300, fullSizeDistance: 80 });
  var s = await data.getArSettings();
  assert.equal(s.minVisibleDistance, 300);
  assert.equal(s.fullSizeDistance, 80);
});

test('insertAdmin + getAdminByPasswordHash finds it', async function() {
  var db = makeFakeDb();
  data.init(db);
  await data.insertAdmin({ name: 'Dima', password_hash: 'abc123', superadmin: true });
  var admin = await data.getAdminByPasswordHash('abc123');
  assert.equal(admin.name, 'Dima');
  assert.equal(admin.superadmin, true);
  assert.equal(await data.getAdminByPasswordHash('nope'), null);
});

test('getAdmins lists all admins', async function() {
  var db = makeFakeDb();
  data.init(db);
  await data.insertAdmin({ name: 'A', password_hash: 'a' });
  await data.insertAdmin({ name: 'B', password_hash: 'b' });
  assert.equal((await data.getAdmins()).length, 2);
});

test('deleteAdmin removes it', async function() {
  var db = makeFakeDb();
  data.init(db);
  var id = await data.insertAdmin({ name: 'A', password_hash: 'a' });
  await data.deleteAdmin(id);
  assert.equal((await data.getAdmins()).length, 0);
});
