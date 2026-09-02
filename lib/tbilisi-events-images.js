'use strict';
var axios = require('axios');
var sharp = require('sharp');

var BUCKET = 'dimazvalimisc.appspot.com';
var MAX_BYTES = 15 * 1024 * 1024;

var _storage = null;
function init(storage) { _storage = storage; }

async function downloadImage(url) {
  var res = await axios.get(url, {
    timeout: 20000,
    responseType: 'arraybuffer',
    maxContentLength: MAX_BYTES,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; tbilisi-events/1.0)' },
  });
  var ctype = String(res.headers['content-type'] || '');
  if (ctype.indexOf('image/') !== 0) throw new Error('not an image (content-type: ' + ctype + ')');
  return Buffer.from(res.data);
}

async function toWebp(buffer) {
  return sharp(buffer)
    .rotate()
    .resize(1200, null, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
}

async function saveBuffer(buffer, path) {
  if (!_storage) throw new Error('tbilisi-events images: storage not initialized');
  var file = _storage.bucket(BUCKET).file(path);
  // Object names carry a Date.now() segment and are never overwritten, so they
  // are safe to treat as immutable — let browsers and the GCS edge keep them
  // for a year instead of the default 1h.
  await file.save(buffer, {
    contentType: 'image/webp',
    public: true,
    metadata: { cacheControl: 'public, max-age=31536000, immutable' },
  });
  return 'https://storage.googleapis.com/' + BUCKET + '/' + path;
}

// Download a remote image, convert to webp, store it. Returns { imageUrl, imageSourceUrl }.
async function fetchAndStore(sourceUrl, eventId) {
  if (!sourceUrl) throw new Error('no source url');
  var raw = await downloadImage(sourceUrl);
  var webp = await toWebp(raw);
  var path = 'tbilisi-events/' + eventId + '/' + Date.now() + '.webp';
  var storedUrl = await saveBuffer(webp, path);
  return { imageUrl: storedUrl, imageSourceUrl: sourceUrl };
}

// Store an already-in-memory upload (admin venue image) as webp. Returns the URL.
async function storeVenueImage(buffer, venueId) {
  var webp = await toWebp(buffer);
  var path = 'tbilisi-events/venues/' + venueId + '/' + Date.now() + '.webp';
  return saveBuffer(webp, path);
}

// Store an admin-uploaded hero portrait as webp. Returns the URL.
async function storeHeroImage(buffer, heroId) {
  var webp = await toWebp(buffer);
  var path = 'tbilisi-events/heroes/' + heroId + '/' + Date.now() + '.webp';
  return saveBuffer(webp, path);
}

module.exports = { init: init, fetchAndStore: fetchAndStore, storeVenueImage: storeVenueImage, storeHeroImage: storeHeroImage };
