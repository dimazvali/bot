'use strict';
var sharp = require('sharp');
var crypto = require('crypto');

var _bucket = null;
function init(bucket) { _bucket = bucket; }

var SIZES = [400, 800, 2400];

// Resizes to three webp sizes and uploads each to
// memories/<memoryId>/<photoId>-<width>.webp, public. Returns { w400, w800, w2400 }.
async function uploadMemoryPhoto(buffer, memoryId) {
  var photoId = crypto.randomBytes(10).toString('hex');
  var urls = {};
  await Promise.all(SIZES.map(async function(w) {
    var webp = await sharp(buffer).rotate().resize(w, w, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
    var file = _bucket.file('memories/' + memoryId + '/' + photoId + '-' + w + '.webp');
    await file.save(webp, { metadata: { contentType: 'image/webp' } });
    await file.makePublic();
    urls['w' + w] = 'https://storage.googleapis.com/' + _bucket.name + '/' + file.name;
  }));
  return urls;
}

// Best-effort cleanup: parses each stored file's path back out of its public
// URL and deletes it. Never throws — a missing/already-deleted file is fine.
async function deleteMemoryPhotoFiles(urls) {
  var prefix = 'https://storage.googleapis.com/' + _bucket.name + '/';
  var names = Object.keys(urls || {})
    .map(function(k) { return urls[k]; })
    .filter(function(url) { return url && url.indexOf(prefix) === 0; })
    .map(function(url) { return url.slice(prefix.length); });
  await Promise.all(names.map(function(name) {
    return _bucket.file(name).delete().catch(function() {});
  }));
}

module.exports = {
  init: init,
  uploadMemoryPhoto: uploadMemoryPhoto,
  deleteMemoryPhotoFiles: deleteMemoryPhotoFiles,
};
