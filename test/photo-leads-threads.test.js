'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var makeFakeDb = require('./helpers/fake-firestore.js');
var c = require('../lib/photo-leads-collectors.js');
var token = require('../lib/photo-leads-threads-token.js');

var DAY = 24 * 3600 * 1000;
var SINCE = Date.parse('2026-10-10T00:00:00Z');

test('threads without a token goes through Apify and drops old posts', async function() {
  var call;
  var items = await c.collect({ id: 'th1', type: 'threads', value: 'photographer tbilisi' }, SINCE, {
    getThreadsToken: async function() { return null; },
    apify: async function(actor, input) {
      call = [actor, input];
      return [
        { url: 'https://www.threads.com/@ann/post/A1', text: 'Need a photographer in Tbilisi', username: 'ann', createdUtc: Date.parse('2026-10-12T08:00:00Z') / 1000 },
        { url: 'https://www.threads.com/@bob/post/B1', text: 'old', username: 'bob', createdUtc: Date.parse('2026-10-01T08:00:00Z') / 1000 },
      ];
    },
    get: async function() { throw new Error('API must not be called without a token'); },
  });
  assert.equal(call[0], 'getanyapi/threads-search-scraper');
  assert.deepEqual(call[1], { query: 'photographer tbilisi', startDate: '2026-10-10', maxItems: 25 });
  assert.equal(items.length, 1);
  assert.deepEqual(items[0], {
    source: 'threads', sourceId: 'th1', url: 'https://www.threads.com/@ann/post/A1',
    text: 'Need a photographer in Tbilisi', author: '@ann', publishedAt: '2026-10-12T08:00:00.000Z',
  });
});

test('threads with a token uses the official keyword_search (RECENT, since)', async function() {
  var url;
  var items = await c.collect({ id: 'th2', type: 'threads', value: 'фотограф тбилиси' }, SINCE, {
    getThreadsToken: async function() { return 'TOK'; },
    apify: async function() { throw new Error('Apify must not be called with a token'); },
    get: async function(u) {
      url = u;
      return { data: { data: [{ id: '1', text: 'ищу фотографа', permalink: 'https://www.threads.com/@k/post/X', timestamp: '2026-10-12T08:00:00+0000', username: 'k' }] } };
    },
  });
  assert.ok(url.indexOf('https://graph.threads.net/v1.0/keyword_search?q=' + encodeURIComponent('фотограф тбилиси')) === 0);
  assert.ok(url.indexOf('search_type=RECENT') !== -1);
  assert.ok(url.indexOf('since=' + SINCE / 1000) !== -1);
  assert.ok(url.indexOf('access_token=TOK') !== -1);
  assert.equal(items.length, 1);
  assert.equal(items[0].author, '@k');
  assert.equal(items[0].url, 'https://www.threads.com/@k/post/X');
});

test('token: none configured → null', async function() {
  delete process.env.THREADS_ACCESS_TOKEN;
  token.init(makeFakeDb());
  assert.equal(await token.get({ now: function() { return 0; } }), null);
});

test('token: seeded from env, refreshed after a week, re-seeded when env changes', async function() {
  var db = makeFakeDb();
  token.init(db);
  process.env.THREADS_ACCESS_TOKEN = 'ENV1';
  var t0 = Date.parse('2026-10-14T00:00:00Z');
  var calls = [];
  var http = async function(url, opts) { calls.push(opts.params.access_token); return { data: { access_token: 'REFRESHED' } }; };
  try {
    assert.equal(await token.get({ get: http, now: function() { return t0; } }), 'ENV1');
    assert.equal(await token.get({ get: http, now: function() { return t0 + 3 * DAY; } }), 'ENV1');
    assert.equal(calls.length, 0);
    assert.equal(await token.get({ get: http, now: function() { return t0 + 8 * DAY; } }), 'REFRESHED');
    assert.deepEqual(calls, ['ENV1']);
    // stored refreshed token survives while env still holds the old value
    assert.equal(await token.get({ get: http, now: function() { return t0 + 9 * DAY; } }), 'REFRESHED');
    process.env.THREADS_ACCESS_TOKEN = 'ENV2';
    assert.equal(await token.get({ get: http, now: function() { return t0 + 10 * DAY; } }), 'ENV2');
  } finally {
    delete process.env.THREADS_ACCESS_TOKEN;
  }
});

test('token: refresh failure keeps the old token', async function() {
  var db = makeFakeDb();
  token.init(db);
  process.env.THREADS_ACCESS_TOKEN = 'OLD';
  try {
    await token.get({ now: function() { return 0; } });
    var t = await token.get({ get: async function() { throw new Error('400'); }, now: function() { return 8 * DAY; } });
    assert.equal(t, 'OLD');
  } finally {
    delete process.env.THREADS_ACCESS_TOKEN;
  }
});
