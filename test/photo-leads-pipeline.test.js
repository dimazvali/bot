'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var makeFakeDb = require('./helpers/fake-firestore.js');
var data = require('../lib/photo-leads-data.js');
var pipeline = require('../lib/photo-leads-pipeline.js');

var NOW = Date.parse('2026-10-07T05:00:00Z');

async function setup() {
  var db = makeFakeDb();
  data.init(db);
  var good = await data.addSource({ type: 'telegram', value: 'chan' });
  var bad = await data.addSource({ type: 'reddit', value: 'tbilisi' });
  return { db: db, good: good, bad: bad };
}

function deps(over) {
  var sent = [];
  var d = Object.assign({
    now: function() { return NOW; },
    collect: async function(source) {
      if (source.type === 'reddit') throw new Error('403');
      return [
        { source: 'telegram', sourceId: source.id, url: 'https://t.me/chan/1', text: 'Ищу фотографа на свадьбу', author: '@chan', publishedAt: null },
        { source: 'telegram', sourceId: source.id, url: 'https://t.me/chan/2', text: 'Продаю диван', author: '@chan', publishedAt: null },
      ];
    },
    classify: async function() { return { isLead: true, score: 90, kind: 'direct', city: 'Tbilisi', genre: 'wedding', budget: null, summaryRu: 'Свадьба', reason: '' }; },
    send: async function(text) { sent.push(text); },
  }, over);
  d.sent = sent;
  return d;
}

test('run collects, prefilters, classifies, stores and sends one digest', async function() {
  var s = await setup();
  var d = deps();
  var r = await pipeline.run({ deps: d });
  assert.equal(r.stats.sources, 2);
  assert.equal(r.stats.seen, 2);
  assert.equal(r.stats.matched, 1);
  assert.equal(r.hot, 1);
  var leads = await data.listLeads({});
  assert.equal(leads.length, 1);
  assert.equal(leads[0].zone, 'hot');
  assert.equal(d.sent.length, 1);
  assert.ok(d.sent[0].indexOf('Свадьба') !== -1);
  var srcs = await data.listSources();
  assert.equal(srcs.find(function(x) { return x.id === s.good; }).lastRunAt, NOW);
  assert.equal(srcs.find(function(x) { return x.id === s.bad; }).consecutiveFailures, 1);
});

test('second run skips duplicates and does not reclassify', async function() {
  await setup();
  var calls = 0;
  var d = deps({ classify: async function() { calls++; return { isLead: true, score: 90, kind: 'direct', city: 'Tbilisi', summaryRu: 'x' }; } });
  await pipeline.run({ deps: d });
  var r2 = await pipeline.run({ deps: d });
  assert.equal(calls, 1);
  assert.equal(r2.stats.duplicates, 1);
  assert.equal(r2.hot, 0);
});

test('classifier failure keeps the lead unclassified and retries next run', async function() {
  await setup();
  var fail = true;
  var d = deps({ classify: async function() {
    if (fail) throw new Error('overloaded');
    return { isLead: true, score: 60, kind: 'indirect', city: 'Tbilisi', summaryRu: 'x' };
  } });
  var r1 = await pipeline.run({ deps: d });
  assert.equal(r1.stats.failed, 1);
  assert.equal((await data.listUnclassified()).length, 1);
  fail = false;
  var r2 = await pipeline.run({ deps: d });
  assert.equal(r2.maybe, 1);
  assert.equal((await data.listUnclassified()).length, 0);
});

test('sourceIds limits the run; inactive sources are skipped', async function() {
  var s = await setup();
  await data.setSourceActive(s.bad, false);
  var seenTypes = [];
  var d = deps({ collect: async function(source) { seenTypes.push(source.type); return []; } });
  await pipeline.run({ deps: d });
  assert.deepEqual(seenTypes, ['telegram']);
  seenTypes = [];
  await data.setSourceActive(s.bad, true);
  await pipeline.run({ deps: d, sourceIds: [s.bad] });
  assert.deepEqual(seenTypes, ['reddit']);
});

test('overlapping runs are refused', async function() {
  var s = await setup();
  await data.setSourceActive(s.bad, false); // one hanging source is enough
  var release;
  var d = deps({ collect: function() { return new Promise(function(r) { release = function() { r([]); }; }); } });
  var first = pipeline.run({ deps: d });
  while (!release) await new Promise(function(r) { setImmediate(r); });
  assert.equal(pipeline.isRunning(), true);
  assert.deepEqual(await pipeline.run({ deps: d }), { skipped: true });
  release();
  await first;
  assert.equal(pipeline.isRunning(), false);
});

test('a Firestore error while saving one source does not abort the run or advance its lastRunAt', async function() {
  var s = await setup();
  await data.setSourceActive(s.bad, false);
  var other = await data.addSource({ type: 'telegram', value: 'other' });
  var orig = data.saveLead;
  data.saveLead = async function(item) {
    if (item.sourceId === s.good) throw new Error('firestore down');
    return orig.apply(data, arguments);
  };
  var d = deps();
  var r;
  try { r = await pipeline.run({ deps: d }); } finally { data.saveLead = orig; }
  assert.equal(r.stats.sources, 2);
  assert.equal(r.stats.errors.length, 1);
  assert.equal(r.stats.errors[0].source, 'telegram:chan');
  assert.equal(r.hot, 1);
  assert.equal(d.sent.length, 1);
  var srcs = await data.listSources();
  assert.equal(srcs.find(function(x) { return x.id === s.good; }).lastRunAt || null, null);
  assert.equal(srcs.find(function(x) { return x.id === other; }).lastRunAt, NOW);
});

test('markSourceRun throwing while recording a failure does not abort the run', async function() {
  await setup();
  var orig = data.markSourceRun;
  data.markSourceRun = async function(id, r) { if (!r.ok) throw new Error('write failed'); return orig.apply(data, arguments); };
  var d = deps();
  var r;
  try { r = await pipeline.run({ deps: d }); } finally { data.markSourceRun = orig; }
  assert.equal(r.stats.errors.length, 1);
  assert.equal(d.sent.length, 1);
});

test('markClassifyFailed throwing does not stop purge and digest', async function() {
  await setup();
  var orig = data.markClassifyFailed;
  data.markClassifyFailed = async function() { throw new Error('write failed'); };
  var d = deps({ classify: async function() { throw new Error('overloaded'); } });
  var r;
  try { r = await pipeline.run({ deps: d }); } finally { data.markClassifyFailed = orig; }
  assert.equal(r.stats.failed, 1);
  assert.equal(d.sent.length, 1);
  assert.ok(d.sent[0].indexOf('Классификатор не справился: 1') !== -1);
});

test('prefilter runs before the duplicate check (non-matching items cost no reads)', async function() {
  await setup();
  var orig = data.isDuplicate;
  var calls = 0;
  data.isDuplicate = async function() { calls++; return orig.apply(data, arguments); };
  try { await pipeline.run({ deps: deps() }); } finally { data.isDuplicate = orig; }
  assert.equal(calls, 1);
});
