var fs = require('fs');
var path = require('path');

var DATA_PATH = path.join(__dirname, '../data/photo.json');
var _cache = null;

function getData() {
  if (!_cache) {
    _cache = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  }
  return _cache;
}

function saveData(obj) {
  _cache = obj;
  fs.writeFileSync(DATA_PATH, JSON.stringify(obj, null, 2), 'utf8');
}

module.exports = { getData, saveData };
