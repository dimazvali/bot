'use strict';
var crypto = require('crypto');

// Minimal Firestore stand-in: enough of the surface that lib/tbilisi-events-users.js
// uses. Data is per-collection plain objects. Supports one where('field','==',value)
// followed by an optional limit(n).
// data() returns a SHALLOW copy of the stored doc (nested objects are shared) —
// fine for current use; do not rely on it for deep mutation.
module.exports = function makeFakeDb() {
  var store = {}; // { collectionName: { docId: data } }

  function coll(name) {
    if (!store[name]) store[name] = {};
    return store[name];
  }

  function docApi(name, id) {
    return {
      id: id,
      get: async function() {
        var data = coll(name)[id];
        return { exists: !!data, id: id, data: function() { return data ? Object.assign({}, data) : undefined; } };
      },
      set: async function(data) { coll(name)[id] = Object.assign({}, data); },
      update: async function(patch) {
        if (!coll(name)[id]) throw new Error('update on missing doc ' + name + '/' + id);
        coll(name)[id] = Object.assign({}, coll(name)[id], patch);
      },
      delete: async function() { delete coll(name)[id]; },
    };
  }

  function queryApi(name, field, value, lim) {
    return {
      limit: function(n) { return queryApi(name, field, value, n); },
      get: async function() {
        var c = coll(name);
        var ids = Object.keys(c).filter(function(k) { return c[k][field] === value; });
        if (typeof lim === 'number') ids = ids.slice(0, lim);
        var docs = ids.map(function(k) {
          return { id: k, exists: true, data: function() { return Object.assign({}, c[k]); }, ref: docApi(name, k) };
        });
        return { empty: docs.length === 0, docs: docs, size: docs.length };
      },
    };
  }

  return {
    collection: function(name) {
      return {
        doc: function(id) { return docApi(name, id); },
        add: async function(data) {
          var id = crypto.randomBytes(10).toString('hex');
          coll(name)[id] = Object.assign({}, data);
          return { id: id };
        },
        where: function(field, op, value) {
          if (op !== '==') throw new Error('fake firestore only supports ==');
          return queryApi(name, field, value);
        },
      };
    },
    _store: store,
  };
};
