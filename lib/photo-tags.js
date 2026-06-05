var fs = require('fs');
var path = require('path');
var TAGS_PATH = path.join(__dirname, '../data/photo-tags.json');
var _cache = null;

function getTags() {
  if (!_cache) { _cache = JSON.parse(fs.readFileSync(TAGS_PATH, 'utf8')); }
  return _cache;
}

function saveTags(obj) {
  _cache = obj;
  fs.writeFileSync(TAGS_PATH, JSON.stringify(obj, null, 2), 'utf8');
}

module.exports = { getTags, saveTags };
