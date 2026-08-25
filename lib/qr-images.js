'use strict';
var sharp = require('sharp');
var qrFirebase = require('./qr-firebase');

function createImageStore(bucket) {
  async function savePhoto(slug, buffer) {
    var resized = await sharp(buffer)
      .resize({ width: 2000, withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toBuffer();
    var storagePath = 'qr/' + slug + '/photo.jpg';
    var file = bucket.file(storagePath);
    await file.save(resized, { metadata: { contentType: 'image/jpeg' } });
    await file.makePublic();
    return 'https://storage.googleapis.com/' + bucket.name + '/' + storagePath;
  }

  async function deletePhoto(slug) {
    var storagePath = 'qr/' + slug + '/photo.jpg';
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

var defaultStore = createImageStore(qrFirebase.bucket || unavailableBucket());

module.exports = Object.assign({}, defaultStore, { createImageStore: createImageStore });
