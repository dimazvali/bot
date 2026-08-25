'use strict';
var fs = require('fs');
var path = require('path');
var sharp = require('sharp');

function createImageStore(baseDir) {
  async function savePhoto(slug, buffer) {
    var dir = path.join(baseDir, slug);
    fs.mkdirSync(dir, { recursive: true });
    var dest = path.join(dir, 'photo.jpg');
    await sharp(buffer)
      .resize({ width: 2000, withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toFile(dest);
    return '/qr/' + slug + '/photo.jpg';
  }

  function deletePhoto(slug) {
    var dir = path.join(baseDir, slug);
    fs.rmSync(dir, { recursive: true, force: true });
  }

  return { savePhoto: savePhoto, deletePhoto: deletePhoto };
}

var defaultStore = createImageStore(path.join(__dirname, '../public/qr'));

module.exports = Object.assign({}, defaultStore, { createImageStore: createImageStore });
