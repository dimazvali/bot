'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var { createStore, validateSlug, validatePortalShape } = require('../lib/qr-data.js');

// Marker only this fake understands — mirrors how the real store is given
// FieldValue.increment, without depending on the real SDK's internals.
function fakeIncrementBy(n) {
  return { __fakeIncrement: n };
}

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
        update: async function(patch) {
          if (!docs[id]) throw new Error('No document to update: ' + id);
          var current = docs[id];
          var updated = Object.assign({}, current);
          Object.keys(patch).forEach(function(key) {
            var value = patch[key];
            updated[key] = (value && typeof value === 'object' && '__fakeIncrement' in value)
              ? (current[key] || 0) + value.__fakeIncrement
              : value;
          });
          docs[id] = updated;
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

function createStoreForTest(collection) {
  return createStore(collection, { incrementBy: fakeIncrementBy });
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
  assert.equal(record.views, 0);
  assert.ok(record.createdAt);
  assert.ok(record.updatedAt);
  var found = await store.getBySlug('test-place');
  assert.equal(found.title, 'Test Place');
});

test('incrementViews() bumps the view count by 1 each call', async function() {
  var store = createStoreForTest(createFakeCollection());
  await store.create({ slug: 'counted', title: 'X' });
  await store.incrementViews('counted');
  assert.equal((await store.getBySlug('counted')).views, 1);
  await store.incrementViews('counted');
  await store.incrementViews('counted');
  assert.equal((await store.getBySlug('counted')).views, 3);
});

test('incrementViews() does not lose updates when called concurrently', async function() {
  var store = createStoreForTest(createFakeCollection());
  await store.create({ slug: 'concurrent', title: 'X' });
  await Promise.all([
    store.incrementViews('concurrent'),
    store.incrementViews('concurrent'),
    store.incrementViews('concurrent'),
    store.incrementViews('concurrent'),
    store.incrementViews('concurrent'),
  ]);
  assert.equal((await store.getBySlug('concurrent')).views, 5);
});

test('incrementViews() on an unknown slug is a silent no-op', async function() {
  var store = createStoreForTest(createFakeCollection());
  await assert.doesNotReject(function() { return store.incrementViews('nope'); });
});

test('validatePortalShape accepts only the known shapes', function() {
  assert.equal(validatePortalShape('3:2'), true);
  assert.equal(validatePortalShape('2:3'), true);
  assert.equal(validatePortalShape('square'), true);
  assert.equal(validatePortalShape('circle'), true);
  assert.equal(validatePortalShape('triangle'), false);
  assert.equal(validatePortalShape(undefined), false);
});

test('create() defaults portalShape to "square" when omitted or invalid', async function() {
  var store = createStore(createFakeCollection());
  var record = await store.create({ slug: 'no-shape', title: 'X' });
  assert.equal(record.portalShape, 'square');
  var record2 = await store.create({ slug: 'bad-shape', title: 'Y', portalShape: 'hexagon' });
  assert.equal(record2.portalShape, 'square');
});

test('create() keeps a valid portalShape', async function() {
  var store = createStore(createFakeCollection());
  var record = await store.create({ slug: 'circle-place', title: 'Z', portalShape: 'circle' });
  assert.equal(record.portalShape, 'circle');
});

test('update() normalizes portalShape when patched, leaves it alone otherwise', async function() {
  var store = createStore(createFakeCollection());
  await store.create({ slug: 'shape-up', title: 'A', portalShape: '3:2' });
  var updated = await store.update('shape-up', { title: 'B' });
  assert.equal(updated.portalShape, '3:2');
  var updated2 = await store.update('shape-up', { portalShape: 'not-a-shape' });
  assert.equal(updated2.portalShape, 'square');
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
