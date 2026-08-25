'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('fs');
var os = require('os');
var path = require('path');
var sharp = require('sharp');
var { createImageStore } = require('../lib/qr-images.js');

test('savePhoto writes a resized jpeg and returns its public path', async function() {
  var tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'qr-images-'));
  var store = createImageStore(tmpBase);
  var input = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: { r: 10, g: 20, b: 30 } } }).png().toBuffer();
  var publicPath = await store.savePhoto('demo-slug', input);
  assert.equal(publicPath, '/qr/demo-slug/photo.jpg');
  var diskPath = path.join(tmpBase, 'demo-slug', 'photo.jpg');
  assert.ok(fs.existsSync(diskPath));
  var meta = await sharp(diskPath).metadata();
  assert.equal(meta.width, 2000);
  assert.equal(meta.format, 'jpeg');
  fs.rmSync(tmpBase, { recursive: true, force: true });
});

test('savePhoto does not enlarge images smaller than the target width', async function() {
  var tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'qr-images-'));
  var store = createImageStore(tmpBase);
  var input = await sharp({ create: { width: 400, height: 300, channels: 3, background: { r: 1, g: 2, b: 3 } } }).png().toBuffer();
  await store.savePhoto('small-slug', input);
  var meta = await sharp(path.join(tmpBase, 'small-slug', 'photo.jpg')).metadata();
  assert.equal(meta.width, 400);
  fs.rmSync(tmpBase, { recursive: true, force: true });
});

test('deletePhoto removes the slug directory', function() {
  var tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'qr-images-'));
  var store = createImageStore(tmpBase);
  fs.mkdirSync(path.join(tmpBase, 'x'), { recursive: true });
  fs.writeFileSync(path.join(tmpBase, 'x', 'photo.jpg'), 'x');
  store.deletePhoto('x');
  assert.equal(fs.existsSync(path.join(tmpBase, 'x')), false);
  fs.rmSync(tmpBase, { recursive: true, force: true });
});

test('deletePhoto on a missing slug does not throw', function() {
  var tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'qr-images-'));
  var store = createImageStore(tmpBase);
  assert.doesNotThrow(function() { store.deletePhoto('never-existed'); });
  fs.rmSync(tmpBase, { recursive: true, force: true });
});
