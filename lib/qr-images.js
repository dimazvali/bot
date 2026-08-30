'use strict';
var sharp = require('sharp');
var qrFirebase = require('./qr-firebase');

function createImageStore(bucket, storagePrefix) {
  var prefix = storagePrefix || 'qr';

  async function savePhoto(slug, buffer) {
    var resized = await sharp(buffer)
      .resize({ width: 2000, withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toBuffer();
    var storagePath = prefix + '/' + slug + '/photo.jpg';
    var file = bucket.file(storagePath);
    await file.save(resized, { metadata: { contentType: 'image/jpeg' } });
    await file.makePublic();
    return 'https://storage.googleapis.com/' + bucket.name + '/' + storagePath;
  }

  async function deletePhoto(slug) {
    var storagePath = prefix + '/' + slug + '/photo.jpg';
    try {
      await bucket.file(storagePath).delete();
    } catch (e) {
      if (e.code !== 404) throw e;
    }
  }

  return { savePhoto: savePhoto, deletePhoto: deletePhoto };
}

function unavailableBucket() {
  function fail() { throw new Error('QR Storage недоступен: dimazvali Firebase app не инициализирован'); }
  return { name: '', file: fail };
}

// Separate path prefix for local/dev (process.env.develop=true) — same
// bucket as prod, but test uploads never land at the same path a real
// qr.dimazvali.com slug would use. Only the default wired-up instance
// knows about this; createImageStore itself stays env-agnostic (a plain
// bucket + optional prefix in, a store out), same as createStore in
// qr-data.js.
var defaultStore = createImageStore(qrFirebase.bucket || unavailableBucket(), qrFirebase.isDev ? 'qr-dev' : 'qr');

module.exports = Object.assign({}, defaultStore, { createImageStore: createImageStore });
