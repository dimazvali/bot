'use strict';
var test = require('node:test');
var assert = require('node:assert');
var notify = require('../lib/it-blackout-notify');

function req(host, ua) {
  return { hostname: host, headers: { 'user-agent': ua || 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)', 'x-forwarded-for': '1.2.3.4' }, socket: {} };
}

// collects messages; clock is controllable
function setup() {
  var out = [];
  var clock = { t: 1e12 };
  var n = notify.create({
    send: function (text) { out.push(text); return Promise.resolve(); },
    ipLine: function (ip) { return Promise.resolve('\nIP: <code>' + ip + '</code>'); },
    now: function () { return clock.t; },
  });
  return { n: n, out: out, clock: clock };
}
var flush = function () { return new Promise(function (r) { setImmediate(r); }); };

test('only the production host sends alerts', function () {
  var s = setup();
  assert.strictEqual(s.n.launch(req('it.localhost'), { deviceId: 'd1' }), false);
  assert.strictEqual(s.n.record(req('localhost'), { nick: 'x', score: 1, level: 1, fixes: 1, rank: 1 }), false);
  assert.strictEqual(s.n.launch(req('it.dimazvali.com'), { deviceId: 'd1' }), true);
});

test('launch alert: first shift, language, device kind and IP', async function () {
  var s = setup();
  s.n.launch(req('it.dimazvali.com'), { deviceId: 'd1', lang: 'en', plays: 1 });
  await flush();
  assert.strictEqual(s.out.length, 1);
  assert.match(s.out[0], /первая смена/);
  assert.match(s.out[0], /EN · 📱 телефон/);
  assert.match(s.out[0], /IP: <code>1\.2\.3\.4<\/code>/);
});

test('one launch alert per device per 30 minutes', async function () {
  var s = setup();
  assert.strictEqual(s.n.launch(req('it.dimazvali.com'), { deviceId: 'd1', plays: 1 }), true);
  s.clock.t += 5 * 60 * 1000;
  assert.strictEqual(s.n.launch(req('it.dimazvali.com'), { deviceId: 'd1', plays: 2 }), false);
  assert.strictEqual(s.n.launch(req('it.dimazvali.com'), { deviceId: 'd2', plays: 1 }), true);
  s.clock.t += 31 * 60 * 1000;
  assert.strictEqual(s.n.launch(req('it.dimazvali.com'), { deviceId: 'd1', plays: 9 }), true);
  await flush();
  assert.match(s.out[2], /смена №9/);
});

test('launch alerts are capped per hour overall', function () {
  var s = setup();
  var sentCount = 0;
  for (var i = 0; i < 40; i++) if (s.n.launch(req('it.dimazvali.com'), { deviceId: 'dev' + i })) sentCount++;
  assert.strictEqual(sentCount, 30);
});

test('record alert: escapes the nick, shows place and flags a new leader', async function () {
  var s = setup();
  s.n.record(req('it.dimazvali.com'), { nick: '<b>Гиви</b>', score: 640, level: 3, fixes: 25, durationMs: 95000, rank: 1 });
  s.n.record(req('it.dimazvali.com'), { nick: 'Нино', score: 300, level: 2, fixes: 14, durationMs: 61000, rank: 4 });
  await flush();
  assert.match(s.out[0], /новый лидер/);
  assert.match(s.out[0], /&lt;b&gt;Гиви&lt;\/b&gt;/);
  assert.match(s.out[0], /640 очк\., уровень 3, починок 25, смена 1:35/);
  assert.match(s.out[1], /рекорд в топ-10/);
  assert.match(s.out[1], /Место в таблице: 4/);
});
