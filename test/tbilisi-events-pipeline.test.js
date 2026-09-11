'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var makeFakeDb = require('./helpers/fake-firestore.js');
var data = require('../lib/tbilisi-events-data.js');
var dedup = require('../lib/tbilisi-events-dedup.js');
var pipeline = require('../lib/tbilisi-events-pipeline.js');

function daysFromToday(n) {
  return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
}

test('resolveSeriesId returns null when nothing shares the title', async function() {
  var db = makeFakeDb();
  data.init(db);
  var seriesId = await pipeline.resolveSeriesId({ title: 'Stand-up Vecher', date: daysFromToday(3), place: 'Fabrika' });
  assert.equal(seriesId, null);
});

test('resolveSeriesId links a second occurrence to the first (same title, no place on either side)', async function() {
  var db = makeFakeDb();
  data.init(db);
  var firstId = await data.insertEvent({
    title: 'Stand-up Vecher', date: daysFromToday(3),
    titleKey: dedup.normalizeTitle('Stand-up Vecher'),
  });

  var seriesId = await pipeline.resolveSeriesId({ title: 'Stand-up Vecher', date: daysFromToday(10), place: null });
  assert.equal(seriesId, firstId);

  var first = await data.getEventById(firstId);
  assert.equal(first.seriesId, firstId); // retro-tagged so both occurrences share it
});

test('resolveSeriesId reuses an already-minted seriesId instead of minting a new one', async function() {
  var db = makeFakeDb();
  data.init(db);
  var firstId = await data.insertEvent({
    title: 'Jazz Night', date: daysFromToday(1),
    titleKey: dedup.normalizeTitle('Jazz Night'),
  });
  await data.updateEvent(firstId, { seriesId: firstId });
  await data.insertEvent({
    title: 'Jazz Night', date: daysFromToday(5),
    titleKey: dedup.normalizeTitle('Jazz Night'), seriesId: firstId,
  });

  var seriesId = await pipeline.resolveSeriesId({ title: 'Jazz Night', date: daysFromToday(12), place: null });
  assert.equal(seriesId, firstId);
});

test('resolveSeriesId requires matching venues when both sides state one', async function() {
  var db = makeFakeDb();
  data.init(db);
  await data.insertEvent({
    title: 'Halloween Party', date: daysFromToday(3), place: 'Fabrika',
    titleKey: dedup.normalizeTitle('Halloween Party'),
  });

  var linked = await pipeline.resolveSeriesId({ title: 'Halloween Party', date: daysFromToday(4), place: 'Fabrika' });
  var notLinked = await pipeline.resolveSeriesId({ title: 'Halloween Party', date: daysFromToday(4), place: 'Bassiani' });
  assert.notEqual(linked, null);
  assert.equal(notLinked, null);
});

test('resolveSeriesId ignores occurrences already in the past', async function() {
  var db = makeFakeDb();
  data.init(db);
  await data.insertEvent({
    title: 'Old Series', date: daysFromToday(-5),
    titleKey: dedup.normalizeTitle('Old Series'),
  });
  var seriesId = await pipeline.resolveSeriesId({ title: 'Old Series', date: daysFromToday(2), place: null });
  assert.equal(seriesId, null);
});

test('resolveSeriesId ignores the exact same date (handled by the same-day dedup match, not here)', async function() {
  var db = makeFakeDb();
  data.init(db);
  var sameDate = daysFromToday(3);
  await data.insertEvent({
    title: 'Twin Peaks Screening', date: sameDate,
    titleKey: dedup.normalizeTitle('Twin Peaks Screening'),
  });
  var seriesId = await pipeline.resolveSeriesId({ title: 'Twin Peaks Screening', date: sameDate, place: null });
  assert.equal(seriesId, null);
});
