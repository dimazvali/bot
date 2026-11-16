'use strict';

// Telegram file_id cache for photos the bot sends by URL (download alerts' previews, lib/photo-downloads.js).
// The first send hands Telegram the image URL; the file_id it returns is reused for every later send, so
// the image is fetched by Telegram once. A file_id belongs to the bot, not the chat — fine for all
// recipients of @dimazvalibot. Keyed by the full image URL: shoot image URLs carry ?v=, so a re-uploaded
// frame gets a new key. Stored in Firestore `photoTgFileIds` (doc id = url hash), mirrored in memory.
var crypto = require('crypto');

var COL = 'photoTgFileIds';
var _db = null;
var _mem = new Map();

function init(db) { _db = db || null; }

function keyOf(url) { return crypto.createHash('sha1').update(String(url)).digest('hex').slice(0, 24); }

async function get(url) {
  if (!url) return null;
  if (_mem.has(url)) return _mem.get(url);
  if (!_db) return null;
  try {
    var doc = await _db.collection(COL).doc(keyOf(url)).get();
    var id = doc.exists ? doc.data().fileId : null;
    if (id) _mem.set(url, id);
    return id;
  } catch (e) {
    console.error('[tg-filecache] get:', e.message);
    return null;
  }
}

function set(url, fileId) {
  if (!url || !fileId) return;
  _mem.set(url, fileId);
  if (!_db) return;
  _db.collection(COL).doc(keyOf(url)).set({ url: url, fileId: fileId, at: Date.now() })
    .catch(function(e) { console.error('[tg-filecache] set:', e.message); });
}

function forget(url) {
  _mem.delete(url);
  if (_db) _db.collection(COL).doc(keyOf(url)).delete().catch(function() {});
}

module.exports = { init: init, get: get, set: set, forget: forget };
