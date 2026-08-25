'use strict';
var fs = require('fs');
var path = require('path');

var SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function validateSlug(slug) {
  return typeof slug === 'string' && SLUG_RE.test(slug);
}

function createStore(dataPath) {
  function readAll() {
    if (!fs.existsSync(dataPath)) return [];
    var raw = fs.readFileSync(dataPath, 'utf8').trim();
    if (!raw) return [];
    return JSON.parse(raw);
  }

  function writeAll(list) {
    fs.writeFileSync(dataPath, JSON.stringify(list, null, 2), 'utf8');
  }

  function getAll() {
    return readAll();
  }

  function getBySlug(slug) {
    return readAll().find(function(e) { return e.slug === slug; }) || null;
  }

  function create(entry) {
    if (!validateSlug(entry.slug)) throw new Error('Некорректный slug: используйте латиницу, цифры и дефисы');
    var list = readAll();
    if (list.some(function(e) { return e.slug === entry.slug; })) {
      throw new Error('Запись с таким slug уже существует');
    }
    var now = Date.now();
    var record = {
      slug: entry.slug,
      title: entry.title || '',
      year: entry.year || '',
      description: entry.description || '',
      address: entry.address || '',
      photo: entry.photo || '',
      createdAt: now,
      updatedAt: now,
    };
    list.push(record);
    writeAll(list);
    return record;
  }

  function update(slug, patch) {
    var list = readAll();
    var idx = list.findIndex(function(e) { return e.slug === slug; });
    if (idx === -1) throw new Error('Запись не найдена: ' + slug);
    var updated = Object.assign({}, list[idx], patch, { slug: list[idx].slug, updatedAt: Date.now() });
    list[idx] = updated;
    writeAll(list);
    return updated;
  }

  function remove(slug) {
    var list = readAll();
    var next = list.filter(function(e) { return e.slug !== slug; });
    if (next.length === list.length) throw new Error('Запись не найдена: ' + slug);
    writeAll(next);
  }

  return { getAll: getAll, getBySlug: getBySlug, create: create, update: update, remove: remove };
}

var defaultStore = createStore(path.join(__dirname, '../data/qr-photos.json'));

module.exports = Object.assign({}, defaultStore, { createStore: createStore, validateSlug: validateSlug });
