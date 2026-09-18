'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var sharp = require('sharp');
var photos = require('../lib/memories-photos.js');

function makeFakeBucket() {
  var saved = [];
  return {
    name: 'fake-bucket',
    _saved: saved,
    file: function(path) {
      return {
        name: path,
        save: async function(buf, opts) {
          saved.push({ path: path, size: buf.length, contentType: opts && opts.metadata && opts.metadata.contentType });
        },
        makePublic: async function() {},
        delete: async function() { saved.push({ path: path, deleted: true }); },
      };
    },
  };
}

test('uploadMemoryPhoto saves three webp sizes and returns their public URLs', async function() {
  var bucket = makeFakeBucket();
  photos.init(bucket);
  var buf = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: { r: 200, g: 50, b: 50 } } }).png().toBuffer();
  var urls = await photos.uploadMemoryPhoto(buf, 'mem1');
  assert.ok(urls.w400 && urls.w800 && urls.w2400);
  assert.equal(bucket._saved.length, 3);
  bucket._saved.forEach(function(s) { assert.equal(s.contentType, 'image/webp'); });
  assert.match(urls.w400, /^https:\/\/storage\.googleapis\.com\/fake-bucket\/memories\/mem1\//);
});

test('uploadMemoryPhoto does not enlarge a small source image beyond its size', async function() {
  var bucket = makeFakeBucket();
  photos.init(bucket);
  var buf = await sharp({ create: { width: 100, height: 80, channels: 3, background: { r: 0, g: 0, b: 0 } } }).png().toBuffer();
  var urls = await photos.uploadMemoryPhoto(buf, 'mem1');
  assert.ok(urls.w400);
});

test('deleteMemoryPhotoFiles deletes each stored file by name parsed from its URL', async function() {
  var bucket = makeFakeBucket();
  photos.init(bucket);
  var urls = {
    w400: 'https://storage.googleapis.com/fake-bucket/memories/mem1/abc-400.webp',
    w800: 'https://storage.googleapis.com/fake-bucket/memories/mem1/abc-800.webp',
  };
  await photos.deleteMemoryPhotoFiles(urls);
  assert.equal(bucket._saved.length, 2);
  assert.ok(bucket._saved.every(function(s) { return s.deleted; }));
});
