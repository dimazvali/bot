'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('fs');
var os = require('os');
var path = require('path');
var { createStore, validateSlug } = require('../lib/qr-data.js');

function tempDataPath() {
  return path.join(os.tmpdir(), 'qr-data-test-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.json');
}

test('validateSlug accepts lowercase-latin-hyphen slugs only', function() {
  assert.equal(validateSlug('erekle-square'), true);
  assert.equal(validateSlug('Erekle-Square'), false);
  assert.equal(validateSlug('плошадь'), false);
  assert.equal(validateSlug('has spaces'), false);
  assert.equal(validateSlug(''), false);
  assert.equal(validateSlug('-leading-hyphen'), false);
});

test('getAll() on a missing file returns an empty array', function() {
  var store = createStore(tempDataPath());
  assert.deepEqual(store.getAll(), []);
});

test('create() writes a new record and getBySlug() finds it', function() {
  var dataPath = tempDataPath();
  var store = createStore(dataPath);
  var record = store.create({ slug: 'test-place', title: 'Test Place', photo: '/qr/test-place/photo.jpg' });
  assert.equal(record.slug, 'test-place');
  assert.ok(record.createdAt);
  assert.ok(record.updatedAt);
  var found = store.getBySlug('test-place');
  assert.equal(found.title, 'Test Place');
  fs.unlinkSync(dataPath);
});

test('create() rejects an invalid slug', function() {
  var store = createStore(tempDataPath());
  assert.throws(function() { store.create({ slug: 'Bad Slug', title: 'x' }); });
});

test('create() rejects a duplicate slug', function() {
  var dataPath = tempDataPath();
  var store = createStore(dataPath);
  store.create({ slug: 'dup', title: 'A' });
  assert.throws(function() { store.create({ slug: 'dup', title: 'B' }); });
  fs.unlinkSync(dataPath);
});

test('update() merges a patch, keeps the slug, and bumps updatedAt', function() {
  var dataPath = tempDataPath();
  var store = createStore(dataPath);
  var created = store.create({ slug: 'up', title: 'Old' });
  var updated = store.update('up', { title: 'New' });
  assert.equal(updated.title, 'New');
  assert.equal(updated.slug, 'up');
  assert.ok(updated.updatedAt >= created.updatedAt);
  fs.unlinkSync(dataPath);
});

test('update() throws for an unknown slug', function() {
  var store = createStore(tempDataPath());
  assert.throws(function() { store.update('nope', { title: 'x' }); });
});

test('remove() deletes the record', function() {
  var dataPath = tempDataPath();
  var store = createStore(dataPath);
  store.create({ slug: 'gone', title: 'X' });
  store.remove('gone');
  assert.equal(store.getBySlug('gone'), null);
  fs.unlinkSync(dataPath);
});

test('remove() throws for an unknown slug', function() {
  var store = createStore(tempDataPath());
  assert.throws(function() { store.remove('nope'); });
});
