'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var cl = require('../lib/photo-leads-classifier.js');

test('zoneFor thresholds: hot >75, maybe 45–75, ignore <45', function() {
  assert.equal(cl.zoneFor(76), 'hot');
  assert.equal(cl.zoneFor(75), 'maybe');
  assert.equal(cl.zoneFor(45), 'maybe');
  assert.equal(cl.zoneFor(44), 'ignore');
});

test('parseClassification normalizes fields and tolerates fences', function() {
  var c = cl.parseClassification('```json\n{"isLead":true,"score":"87.4","kind":"direct","city":"Tbilisi","genre":"portrait","budget":"200 GEL","summaryRu":"Нужен портрет","reason":"explicit paid"}\n```');
  assert.deepEqual(c, { isLead: true, score: 87, kind: 'direct', city: 'Tbilisi', genre: 'portrait', budget: '200 GEL', summaryRu: 'Нужен портрет', reason: 'explicit paid' });
});

test('parseClassification clamps score, defaults unknown enums, caps non-leads at 44', function() {
  var c = cl.parseClassification('{"isLead":false,"score":140,"kind":"weird","city":"Paris"}');
  assert.equal(c.score, 44);
  assert.equal(c.kind, 'indirect');
  assert.equal(c.city, 'unknown');
  assert.equal(c.genre, null);
  assert.equal(c.budget, null);
  assert.equal(c.summaryRu, '');
});

test('parseClassification throws on garbage', function() {
  assert.throws(function() { cl.parseClassification('no json here'); }, /classifier/);
  assert.throws(function() { cl.parseClassification('{"isLead":true,"score":"abc"}'); }, /score/);
});

test('buildPrompt includes source, prefilter level and truncated text', function() {
  var p = cl.buildPrompt(
    { source: 'reddit', author: '/u/a', publishedAt: '2026-10-06T10:00:00Z', text: 'x'.repeat(5000) },
    { level: 2, matched: ['new menu'] });
  assert.ok(p.indexOf('Source: reddit (/u/a)') !== -1);
  assert.ok(p.indexOf('level 2') !== -1);
  assert.ok(p.indexOf('x'.repeat(4000)) !== -1);
  assert.equal(p.indexOf('x'.repeat(4001)), -1);
});

test('classify sends the prompt to Haiku and parses the reply', async function() {
  var sent;
  var client = { messages: { create: async function(req) {
    sent = req;
    return { content: [{ type: 'text', text: '{"isLead":true,"score":80,"kind":"direct","city":"Batumi","summaryRu":"ок"}' }] };
  } } };
  var c = await cl.classify({ source: 'telegram', text: 'нужен фотограф' }, { level: 1, matched: ['нужен фотограф'] }, { client: client });
  assert.equal(sent.model, 'claude-haiku-4-5-20251001');
  assert.equal(c.score, 80);
  assert.equal(c.city, 'Batumi');
});
