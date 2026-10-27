'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var tgLogin = require('../lib/photo-tg-login.js');

// minimal in-memory Firestore: collection(name).doc(id).{get,set,update,delete}
function fakeDb() {
  var store = {};
  return {
    store: store,
    collection: function() {
      return {
        doc: function(id) {
          return {
            get: async function() { return { exists: id in store, data: function() { return Object.assign({}, store[id]); } }; },
            set: async function(v) { store[id] = Object.assign({}, v); },
            update: async function(v) { Object.assign(store[id], v); },
            delete: async function() { delete store[id]; },
          };
        },
      };
    },
  };
}

var FROM = { id: 42, first_name: 'Ася', last_name: 'К', username: 'asya' };

test('full flow: create → pending → confirm → claim once', async function() {
  var db = fakeDb();
  var r = await tgLogin.create(db, { slug: 'wed' });
  assert.match(r.token, /^[a-f0-9]{32}$/);
  assert.equal(r.link, 'https://t.me/dimazvalibot?start=photodl_' + r.token);
  assert.deepEqual(await tgLogin.claim(db, r.token), { status: 'pending' });

  var meta = await tgLogin.confirm(db, r.token, FROM);
  assert.equal(meta.slug, 'wed');
  assert.deepEqual(await tgLogin.claim(db, r.token), { status: 'ok', user: { tgId: '42', name: 'Ася К', username: 'asya' } });
  assert.deepEqual(await tgLogin.claim(db, r.token), { status: 'expired' });
});

test('expired tokens can be neither confirmed nor claimed', async function() {
  var db = fakeDb();
  var r = await tgLogin.create(db);
  var later = Date.now() + tgLogin.TTL_MS + 1000;
  assert.equal(await tgLogin.confirm(db, r.token, FROM, later), null);
  assert.deepEqual(await tgLogin.claim(db, r.token, later), { status: 'expired' });
  assert.equal(Object.keys(db.store).length, 0);
});

test('unknown / malformed tokens', async function() {
  var db = fakeDb();
  assert.equal(await tgLogin.confirm(db, 'nope', FROM), null);
  assert.equal(await tgLogin.confirm(db, 'a'.repeat(32), FROM), null);
  assert.deepEqual(await tgLogin.claim(db, '../x'), { status: 'expired' });
});

test('tokenFromStart parses only the photodl deep link', function() {
  var t = 'ab'.repeat(16);
  assert.equal(tgLogin.tokenFromStart('/start photodl_' + t), t);
  assert.equal(tgLogin.tokenFromStart('/start photo_sub'), null);
  assert.equal(tgLogin.tokenFromStart('/start photodl_xyz'), null);
  assert.equal(tgLogin.tokenFromStart('hello'), null);
});
