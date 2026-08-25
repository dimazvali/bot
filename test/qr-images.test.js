'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var sharp = require('sharp');
var { createImageStore } = require('../lib/qr-images.js');

function createFakeBucket() {
  var files = {};
  return {
    name: 'fake-bucket',
    _files: files,
    file: function(storagePath) {
      return {
        save: async function(buffer, opts) {
          files[storagePath] = {
            buffer: buffer,
            contentType: opts && opts.metadata && opts.metadata.contentType,
            public: false,
          };
        },
        makePublic: async function() {
          if (files[storagePath]) files[storagePath].public = true;
        },
        delete: async function() {
          if (!files[storagePath]) {
            var e = new Error('not found');
            e.code = 404;
            throw e;
          }
          delete files[storagePath];
        },
      };
    },
  };
}

test('savePhoto uploads a resized jpeg and returns its public googleapis URL', async function() {
  var bucket = createFakeBucket();
  var store = createImageStore(bucket);
  var input = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: { r: 10, g: 20, b: 30 } } }).png().toBuffer();
  var url = await store.savePhoto('demo-slug', input);
  assert.equal(url, 'https://storage.googleapis.com/fake-bucket/qr/demo-slug/photo.jpg');
  var stored = bucket._files['qr/demo-slug/photo.jpg'];
  assert.ok(stored);
  assert.equal(stored.public, true);
  assert.equal(stored.contentType, 'image/jpeg');
  var meta = await sharp(stored.buffer).metadata();
  assert.equal(meta.width, 2000);
  assert.equal(meta.format, 'jpeg');
});

test('savePhoto does not enlarge images smaller than the target width', async function() {
  var bucket = createFakeBucket();
  var store = createImageStore(bucket);
  var input = await sharp({ create: { width: 400, height: 300, channels: 3, background: { r: 1, g: 2, b: 3 } } }).png().toBuffer();
  await store.savePhoto('small-slug', input);
  var meta = await sharp(bucket._files['qr/small-slug/photo.jpg'].buffer).metadata();
  assert.equal(meta.width, 400);
});

test('deletePhoto removes the uploaded file', async function() {
  var bucket = createFakeBucket();
  var store = createImageStore(bucket);
  var input = await sharp({ create: { width: 100, height: 100, channels: 3, background: { r: 1, g: 2, b: 3 } } }).png().toBuffer();
  await store.savePhoto('x', input);
  assert.ok(bucket._files['qr/x/photo.jpg']);
  await store.deletePhoto('x');
  assert.equal(bucket._files['qr/x/photo.jpg'], undefined);
});

test('deletePhoto on a missing slug does not throw', async function() {
  var bucket = createFakeBucket();
  var store = createImageStore(bucket);
  await assert.doesNotReject(function() { return store.deletePhoto('never-existed'); });
});
