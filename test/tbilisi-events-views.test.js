'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var views = require('../lib/tbilisi-events-views.js');
var data = require('../lib/tbilisi-events-data.js');

// Minimal Express-ish req. headers keyed lowercase; req.get is case-insensitive.
function fakeReq(opts) {
  var o = opts || {};
  var headers = {};
  Object.keys(o.headers || {}).forEach(function(k) { headers[k.toLowerCase()] = o.headers[k]; });
  return {
    headers: headers,
    cookies: o.cookies || {},
    query: o.query || {},
    path: o.path || '/e/abc',
    ip: o.ip || '203.0.113.7',
    socket: { remoteAddress: o.remoteAddress || '203.0.113.7' },
    hostname: o.hostname || 'events.tbiliseli.com',
    get: function(h) { return headers[String(h).toLowerCase()]; },
  };
}

var CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

test('isCountableView: real browser request counts', function() {
  var req = fakeReq({ headers: { 'user-agent': CHROME, accept: 'text/html,application/xhtml+xml' } });
  assert.equal(views.isCountableView(req), true);
});

test('isCountableView: googlebot does not count', function() {
  var req = fakeReq({ headers: { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', accept: 'text/html' } });
  assert.equal(views.isCountableView(req), false);
});

test('isCountableView: empty user-agent does not count', function() {
  var req = fakeReq({ headers: { 'user-agent': '   ', accept: 'text/html' } });
  assert.equal(views.isCountableView(req), false);
});

test('isCountableView: missing user-agent does not count', function() {
  var req = fakeReq({ headers: { accept: 'text/html' } });
  assert.equal(views.isCountableView(req), false);
});

test('isCountableView: non-html Accept does not count', function() {
  var req = fakeReq({ headers: { 'user-agent': CHROME, accept: 'application/json' } });
  assert.equal(views.isCountableView(req), false);
});

test('isCountableView: missing Accept does not count', function() {
  var req = fakeReq({ headers: { 'user-agent': CHROME } });
  assert.equal(views.isCountableView(req), false);
});

test('isCountableView: admin cookie does not count', function() {
  var req = fakeReq({
    headers: { 'user-agent': CHROME, accept: 'text/html' },
    cookies: { tbilisiEventsAdminToken: 'x' },
  });
  assert.equal(views.isCountableView(req), false);
});

test('hashIp: stable, 16 hex chars, differs by ip', function() {
  var a1 = views.hashIp(fakeReq({ ip: '1.2.3.4' }));
  var a2 = views.hashIp(fakeReq({ ip: '1.2.3.4' }));
  var b = views.hashIp(fakeReq({ ip: '9.9.9.9' }));
  assert.match(a1, /^[0-9a-f]{16}$/);
  assert.equal(a1, a2);
  assert.notEqual(a1, b);
});

test('hashIp: prefers first X-Forwarded-For token', function() {
  var viaXff = views.hashIp(fakeReq({ headers: { 'x-forwarded-for': '5.5.5.5, 10.0.0.1' }, ip: '10.0.0.1' }));
  var direct = views.hashIp(fakeReq({ ip: '5.5.5.5' }));
  assert.equal(viaXff, direct);
});

test('recordView: bumps count once and writes one row; never rejects on failure', async function() {
  var calls = [];
  var origBump = data.bumpViewCount;
  var origAdd = data.addViewRecord;
  data.bumpViewCount = async function(type, id) { calls.push(['bump', type, id]); };
  data.addViewRecord = async function(entry) { calls.push(['add', entry]); };
  try {
    await views.recordView('event', 'abc', fakeReq({
      headers: { 'user-agent': CHROME, accept: 'text/html', referer: 'https://www.google.com/search?q=x' },
      query: { lang: 'en' }, path: '/e/abc',
    }));
    assert.deepEqual(calls[0], ['bump', 'event', 'abc']);
    assert.equal(calls[1][0], 'add');
    var entry = calls[1][1];
    assert.equal(entry.type, 'event');
    assert.equal(entry.entityId, 'abc');
    assert.match(entry.ipHash, /^[0-9a-f]{16}$/);
    assert.equal(entry.ref, 'www.google.com');
    assert.equal(entry.lang, 'en');
    assert.equal(entry.path, '/e/abc');

    // failure is swallowed
    data.bumpViewCount = async function() { throw new Error('firestore down'); };
    await assert.doesNotReject(function() {
      return views.recordView('venue', 'v1', fakeReq({ headers: { 'user-agent': CHROME, accept: 'text/html' } }));
    });
  } finally {
    data.bumpViewCount = origBump;
    data.addViewRecord = origAdd;
  }
});

test('recordView: same-site referer is recorded as null', async function() {
  var seen = null;
  var origAdd = data.addViewRecord;
  var origBump = data.bumpViewCount;
  data.bumpViewCount = async function() {};
  data.addViewRecord = async function(entry) { seen = entry; };
  try {
    await views.recordView('event', 'abc', fakeReq({
      headers: { 'user-agent': CHROME, accept: 'text/html', referer: 'https://events.tbiliseli.com/' },
      hostname: 'events.tbiliseli.com',
    }));
    assert.equal(seen.ref, null);
  } finally {
    data.addViewRecord = origAdd;
    data.bumpViewCount = origBump;
  }
});
