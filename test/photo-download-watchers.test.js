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

var tick = function() { return new Promise(function(r) { setTimeout(r, 10); }); };
function reqFrom(ip) {
  return { hostname: 'photo.dimazvali.com', headers: { 'user-agent': 'Mozilla/5.0', 'x-forwarded-for': ip }, socket: {} };
}

test('record: preview photo — URL once, then the cached file_id for watchers and later alerts', async function() {
  var calls = [], texts = [];
  var url = 'https://img/test/a-instagram.jpg?v=1';
  var shoot = { label: 'S', photos: [{ id: 'a', urls: { instagram: url } }], downloadWatchers: [{ username: 'x', tgId: '111' }] };
  var opts = {
    send: function(t) { texts.push(t); }, sendTo: function(id, t) { texts.push(t); },
    sendPhoto: async function(chat, photo) { calls.push([String(chat), photo]); return 'FILE1'; },
    lookupIp: async function() { return null; },
  };
  downloads.record(reqFrom('5.5.5.1'), 'zip', 'preview-a', shoot, {}, opts);
  await tick();
  downloads.record(reqFrom('5.5.5.2'), 'ig', 'preview-a', shoot, { photo: shoot.photos[0] }, opts);
  await tick();
  assert.deepEqual(calls, [['144489840', url], ['111', 'FILE1'], ['144489840', 'FILE1'], ['111', 'FILE1']]);
  assert.equal(texts.length, 0);
});

test('record: stale cached file_id is retried with the URL; total failure falls back to text', async function() {
  var calls = [], texts = [];
  var url = 'https://img/test/b-instagram.jpg?v=1';
  var shoot = { label: 'S', photos: [{ id: 'b', urls: { instagram: url } }] };
  var mode = 'ok';
  var opts = {
    send: function(t) { texts.push(t); },
    sendPhoto: async function(chat, photo) {
      calls.push(photo);
      if (mode === 'fail' || (mode === 'stale' && photo !== url)) throw new Error('bad');
      return mode === 'stale' ? 'FILE_NEW' : 'FILE_OLD';
    },
    lookupIp: async function() { return null; },
  };
  downloads.record(reqFrom('6.6.6.1'), 'zip', 'preview-b', shoot, {}, opts); await tick();
  mode = 'stale';
  downloads.record(reqFrom('6.6.6.2'), 'zip', 'preview-b', shoot, {}, opts); await tick();
  mode = 'fail';
  downloads.record(reqFrom('6.6.6.3'), 'zip', 'preview-b', shoot, {}, opts); await tick();
  assert.deepEqual(calls, [url, 'FILE_OLD', url, 'FILE_NEW', url]);
  assert.equal(texts.length, 1);
});
