'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var watchers = require('../lib/photo-download-watchers.js');
var downloads = require('../lib/photo-downloads.js');

function fakeDb(cols) {
  var reads = 0;
  return {
    get reads() { return reads; },
    collection: function(name) {
      var store = cols[name] || {};
      return {
        get: async function() {
          reads++;
          return { docs: Object.keys(store).map(function(id) { return { id: id, data: function() { return Object.assign({}, store[id]); } }; }) };
        },
      };
    },
  };
}

test('parseNicks: @, t.me links, separators, dedupe, invalid dropped', function() {
  assert.deepEqual(
    watchers.parseNicks('@asya, https://t.me/Bob_1\nkate; ASYA  x  @bad-nick'),
    ['asya', 'Bob_1', 'kate']
  );
  assert.deepEqual(watchers.parseNicks(''), []);
});

test('resolve: matches bot users and site users case-insensitively, keeps unknown', async function() {
  var db = fakeDb({
    DIMAZVALIusers: { '111': { username: 'Asya', first_name: 'Ася', last_name: 'К' } },
    photoTgUsers: { '222': { tgId: '222', username: 'bob_1', name: 'Боб' } },
  });
  var out = await watchers.resolve(db, ['asya', 'Bob_1', 'kate']);
  assert.deepEqual(out, [
    { username: 'asya', tgId: '111', name: 'Ася К' },
    { username: 'Bob_1', tgId: '222', name: 'Боб' },
    { username: 'kate', tgId: null, name: null },
  ]);
});

test('resolve: reuses already-resolved entries without reading collections', async function() {
  var db = fakeDb({});
  var prev = [{ username: 'asya', tgId: '111', name: 'Ася' }];
  var out = await watchers.resolve(db, ['ASYA'], prev);
  assert.deepEqual(out, prev);
  assert.equal(db.reads, 0);
});

test('record: download alert goes to the owner and every resolved watcher', async function() {
  var sentOwner = [], sentTo = [];
  var req = { hostname: 'photo.dimazvali.com', headers: { 'user-agent': 'Mozilla/5.0', 'x-forwarded-for': '1.2.3.4' }, socket: {} };
  var shoot = { label: 'Свадьба', photos: [], downloadWatchers: [
    { username: 'asya', tgId: '111' }, { username: 'kate', tgId: null }, { username: 'me', tgId: '144489840' },
  ] };
  downloads.record(req, 'zip', 'wed-watchers', shoot, { count: 3 }, {
    send: function(t) { sentOwner.push(t); },
    sendTo: function(id, t) { sentTo.push([id, t]); },
    lookupIp: async function() { return null; },
  });
  await new Promise(function(r) { setTimeout(r, 10); });
  assert.equal(sentOwner.length, 1);
  assert.deepEqual(sentTo.map(function(x) { return x[0]; }), ['111']);
  assert.equal(sentTo[0][1], sentOwner[0]);
  assert.match(sentOwner[0], /IP: <code>1\.2\.3\.4<\/code>/);
});
