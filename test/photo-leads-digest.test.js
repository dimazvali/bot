'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var makeFakeDb = require('./helpers/fake-firestore.js');
var dg = require('../lib/photo-leads-digest.js');

var DATE = new Date('2026-10-07T05:00:00Z');
var STATS = { sources: 7, seen: 120, matched: 9, classified: 9 };

function hot(score, over) {
  return Object.assign({ url: 'https://t.me/c/' + score, source: 'telegram',
    classification: { score: score, city: 'Tbilisi', genre: 'food', summaryRu: 'Ресторан <Mtsvane> ищет фотографа', budget: null } }, over);
}

test('formatDigest lists hot leads by score, escapes HTML, shows maybe count', function() {
  var t = dg.formatDigest({ hot: [hot(80), hot(95, { classification: { score: 95, city: 'Batumi', genre: null, summaryRu: 'Свадьба', budget: '500 GEL' } })], maybeCount: 3, stats: STATS, failing: [], date: DATE });
  assert.ok(t.indexOf('07.10') !== -1);
  assert.ok(t.indexOf('HOT: 2') !== -1);
  assert.ok(t.indexOf('<b>95</b>') < t.indexOf('<b>80</b>'));
  assert.ok(t.indexOf('&lt;Mtsvane&gt;') !== -1);
  assert.ok(t.indexOf('💰 500 GEL') !== -1);
  assert.ok(t.indexOf('MAYBE: 3') !== -1);
  assert.ok(t.indexOf('https://photo.dimazvali.com/admin/leads?zone=maybe') !== -1);
  assert.ok(t.indexOf('Источников: 7') !== -1);
});

test('formatDigest truncates to top 10 hot', function() {
  var many = [];
  for (var i = 0; i < 13; i++) many.push(hot(80 + i));
  var t = dg.formatDigest({ hot: many, maybeCount: 0, stats: STATS, failing: [], date: DATE });
  assert.equal(t.split('<b>9').length - 1 + t.split('<b>8').length - 1, 10);
  assert.ok(t.indexOf('и ещё 3') !== -1);
});

test('formatDigest says "Лидов нет" on an empty day and lists failing sources', function() {
  var t = dg.formatDigest({ hot: [], maybeCount: 0, stats: STATS, date: DATE,
    failing: [{ type: 'hrge', value: 'photographer', consecutiveFailures: 3, lastError: 'ng-state not found' }] });
  assert.ok(t.indexOf('Лидов нет') !== -1);
  assert.ok(t.indexOf('⚠️') !== -1);
  assert.ok(t.indexOf('hrge:photographer — 3') !== -1);
});

test('splitMessage keeps chunks under the limit on paragraph boundaries', function() {
  var text = ['a'.repeat(30), 'b'.repeat(30), 'c'.repeat(30)].join('\n\n');
  var parts = dg.splitMessage(text, 70);
  assert.deepEqual(parts, ['a'.repeat(30) + '\n\n' + 'b'.repeat(30), 'c'.repeat(30)]);
  assert.ok(dg.splitMessage('x'.repeat(150), 70).every(function(p) { return p.length <= 70; }));
});

test('sendToAdmins sends every chunk to every DIMAZVALIusers admin', async function() {
  var db = makeFakeDb();
  await db.collection('DIMAZVALIusers').doc('111').set({ admin: true });
  await db.collection('DIMAZVALIusers').doc('222').set({ admin: false });
  var posts = [];
  var n = await dg.sendToAdmins(db, 'TOKEN', 'hello', { post: async function(url, body) { posts.push([url, body]); } });
  assert.equal(n, 1);
  assert.equal(posts.length, 1);
  assert.equal(posts[0][0], 'https://api.telegram.org/botTOKEN/sendMessage');
  assert.deepEqual(posts[0][1], { chat_id: '111', text: 'hello', parse_mode: 'HTML', disable_web_page_preview: true });
});
