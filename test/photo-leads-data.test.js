'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var makeFakeDb = require('./helpers/fake-firestore.js');
var data = require('../lib/photo-leads-data.js');

var DAY = 24 * 3600 * 1000;
var NOW = Date.parse('2026-10-07T05:00:00Z');

function item(over) {
  return Object.assign({ source: 'reddit', sourceId: 's1', url: 'https://r/1', text: 'Need a photographer', author: null, publishedAt: null }, over);
}

test('ensureDefaultSources seeds once', async function() {
  var db = makeFakeDb(); data.init(db);
  await data.ensureDefaultSources();
  var n = (await data.listSources()).length;
  assert.ok(n >= 5);
  await data.ensureDefaultSources();
  assert.equal((await data.listSources()).length, n);
  assert.ok((await data.listSources()).some(function(s) { return s.type === 'reddit' && s.value === 'Sakartvelo'; }));
});

test('addSource validates type and value', async function() {
  var db = makeFakeDb(); data.init(db);
  await assert.rejects(data.addSource({ type: 'myspace', value: 'x' }), /type/);
  await assert.rejects(data.addSource({ type: 'telegram', value: '  ' }), /value/);
  var id = await data.addSource({ type: 'telegram', value: '@tbilisi_work', city: '' });
  var s = (await data.listSources()).find(function(x) { return x.id === id; });
  assert.equal(s.value, 'tbilisi_work');
  assert.equal(s.city, null);
  assert.equal(s.active, true);
});

test('markSourceRun tracks consecutive failures and resets on success', async function() {
  var db = makeFakeDb(); data.init(db);
  var id = await data.addSource({ type: 'reddit', value: 'tbilisi' });
  await data.markSourceRun(id, { ok: false, error: 'boom', at: NOW });
  await data.markSourceRun(id, { ok: false, error: 'boom2', at: NOW });
  var s = (await data.listSources())[0];
  assert.equal(s.consecutiveFailures, 2);
  assert.equal(s.lastError, 'boom2');
  assert.equal(s.lastRunAt, null);
  await data.markSourceRun(id, { ok: true, at: NOW });
  s = (await data.listSources())[0];
  assert.equal(s.consecutiveFailures, 0);
  assert.equal(s.lastError, null);
  assert.equal(s.lastRunAt, NOW);
});

test('isDuplicate: same url, or same normalized text within 14 days', async function() {
  var db = makeFakeDb(); data.init(db);
  await data.saveLead(item(), { level: 1, matched: ['photographer'] }, NOW - 20 * DAY);
  assert.equal(await data.isDuplicate(item(), NOW), true);
  // same text, different url, but the original is older than 14 days
  assert.equal(await data.isDuplicate(item({ url: 'https://r/2' }), NOW), false);
  await data.saveLead(item({ url: 'https://r/3', text: 'NEED  a photographer ' }), { level: 1, matched: [] }, NOW - DAY);
  assert.equal(await data.isDuplicate(item({ url: 'https://r/4' }), NOW), true);
});

test('saveLead → unclassified; setClassification → new with zone', async function() {
  var db = makeFakeDb(); data.init(db);
  var id = await data.saveLead(item(), { level: 1, matched: ['photographer'] }, NOW);
  var pending = await data.listUnclassified();
  assert.equal(pending.length, 1);
  assert.equal(pending[0].id, id);
  assert.deepEqual(pending[0].prefilter, { level: 1, matched: ['photographer'] });
  await data.setClassification(id, { score: 80, isLead: true }, 'hot');
  assert.equal((await data.listUnclassified()).length, 0);
  var leads = await data.listLeads({});
  assert.equal(leads[0].status, 'new');
  assert.equal(leads[0].zone, 'hot');
});

test('markClassifyFailed gives up after 3 attempts', async function() {
  var db = makeFakeDb(); data.init(db);
  var id = await data.saveLead(item(), { level: 1, matched: [] }, NOW);
  await data.markClassifyFailed(id, 'e1');
  await data.markClassifyFailed(id, 'e2');
  assert.equal((await data.listUnclassified()).length, 1);
  await data.markClassifyFailed(id, 'e3');
  assert.equal((await data.listUnclassified()).length, 0);
  var all = await data.listLeads({ zone: 'all' });
  assert.equal(all[0].zone, 'ignore');
  assert.equal(all[0].classification.reason, 'classifier_failed: e3');
});

test('listLeads: default hides ignore, sorts by score desc, filters status/source', async function() {
  var db = makeFakeDb(); data.init(db);
  var a = await data.saveLead(item({ url: 'u/a', text: 'a' }), { level: 1, matched: [] }, NOW);
  var b = await data.saveLead(item({ url: 'u/b', text: 'b', source: 'telegram' }), { level: 1, matched: [] }, NOW);
  var c = await data.saveLead(item({ url: 'u/c', text: 'c' }), { level: 1, matched: [] }, NOW);
  await data.setClassification(a, { score: 50 }, 'maybe');
  await data.setClassification(b, { score: 90 }, 'hot');
  await data.setClassification(c, { score: 10 }, 'ignore');
  assert.deepEqual((await data.listLeads({})).map(function(l) { return l.id; }), [b, a]);
  assert.deepEqual((await data.listLeads({ zone: 'ignore' })).map(function(l) { return l.id; }), [c]);
  assert.deepEqual((await data.listLeads({ source: 'telegram' })).map(function(l) { return l.id; }), [b]);
  await data.updateLead(a, { status: 'contacted', zone: 'hot' });
  var la = (await data.listLeads({ status: 'contacted' }))[0];
  assert.equal(la.id, a);
  assert.equal(la.zone, 'maybe'); // zone is not editable through updateLead
});

test('purgeIgnored deletes ignore-zone leads older than 30 days only', async function() {
  var db = makeFakeDb(); data.init(db);
  var old = await data.saveLead(item({ url: 'u/old', text: 'old' }), { level: 1, matched: [] }, NOW - 31 * DAY);
  var fresh = await data.saveLead(item({ url: 'u/new', text: 'new' }), { level: 1, matched: [] }, NOW - DAY);
  await data.setClassification(old, { score: 5 }, 'ignore');
  await data.setClassification(fresh, { score: 5 }, 'ignore');
  assert.equal(await data.purgeIgnored(NOW), 1);
  assert.deepEqual((await data.listLeads({ zone: 'all' })).map(function(l) { return l.id; }), [fresh]);
});
