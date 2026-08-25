'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var { createStore, validateSlug } = require('../lib/qr-data.js');

function createFakeCollection() {
  var docs = {};
  return {
    doc: function(id) {
      return {
        get: async function() {
          var data = docs[id];
          return { exists: !!data, data: function() { return data; } };
        },
        set: async function(data) {
          docs[id] = data;
        },
        delete: async function() {
          delete docs[id];
        },
      };
    },
    get: async function() {
      return {
        docs: Object.keys(docs).map(function(id) {
          return { id: id, data: function() { return docs[id]; } };
        }),
      };
    },
  };
}

test('validateSlug accepts lowercase-latin-hyphen slugs only', function() {
  assert.equal(validateSlug('erekle-square'), true);
  assert.equal(validateSlug('Erekle-Square'), false);
  assert.equal(validateSlug('плошадь'), false);
  assert.equal(validateSlug('has spaces'), false);
  assert.equal(validateSlug(''), false);
  assert.equal(validateSlug('-leading-hyphen'), false);
});

test('getAll() on an empty collection returns an empty array', async function() {
  var store = createStore(createFakeCollection());
  assert.deepEqual(await store.getAll(), []);
});

test('create() writes a new record and getBySlug() finds it', async function() {
  var store = createStore(createFakeCollection());
  var record = await store.create({ slug: 'test-place', title: 'Test Place', photo: 'https://example.com/test-place/photo.jpg' });
  assert.equal(record.slug, 'test-place');
  assert.ok(record.createdAt);
  assert.ok(record.updatedAt);
  var found = await store.getBySlug('test-place');
  assert.equal(found.title, 'Test Place');
});

test('create() rejects an invalid slug', async function() {
  var store = createStore(createFakeCollection());
  await assert.rejects(function() { return store.create({ slug: 'Bad Slug', title: 'x' }); });
});

test('create() rejects a duplicate slug', async function() {
  var store = createStore(createFakeCollection());
  await store.create({ slug: 'dup', title: 'A' });
  await assert.rejects(function() { return store.create({ slug: 'dup', title: 'B' }); });
});

test('update() merges a patch, keeps the slug, and bumps updatedAt', async function() {
  var store = createStore(createFakeCollection());
  var created = await store.create({ slug: 'up', title: 'Old' });
  var updated = await store.update('up', { title: 'New' });
  assert.equal(updated.title, 'New');
  assert.equal(updated.slug, 'up');
  assert.ok(updated.updatedAt >= created.updatedAt);
});

test('update() throws for an unknown slug', async function() {
  var store = createStore(createFakeCollection());
  await assert.rejects(function() { return store.update('nope', { title: 'x' }); });
});

test('remove() deletes the record', async function() {
  var store = createStore(createFakeCollection());
  await store.create({ slug: 'gone', title: 'X' });
  await store.remove('gone');
  assert.equal(await store.getBySlug('gone'), null);
});

test('remove() throws for an unknown slug', async function() {
  var store = createStore(createFakeCollection());
  await assert.rejects(function() { return store.remove('nope'); });
});

test('getAll() reflects multiple created records', async function() {
  var store = createStore(createFakeCollection());
  await store.create({ slug: 'a', title: 'A' });
  await store.create({ slug: 'b', title: 'B' });
  var all = await store.getAll();
  assert.equal(all.length, 2);
  assert.deepEqual(all.map(function(e) { return e.slug; }).sort(), ['a', 'b']);
});
