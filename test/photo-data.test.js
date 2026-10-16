'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var pd = require('../lib/photo-data.js');

// toDocuments → (Firestore) → fromDocuments must not lose fields the admin edits.
function roundTrip(data) {
  var docs = pd.toDocuments(data, 'prod');
  function snap(collection) {
    return docs.filter(function(d) { return d.collection === collection; })
      .map(function(d) { return { data: function() { return d.data; } }; });
  }
  return pd.fromDocuments(snap('countries'), snap('series'), snap('photos'));
}

test('series description, EN description and map centre survive a save/load', function() {
  var out = roundTrip({
    georgia: {
      label: 'Грузия',
      series: {
        tbilisi: {
          label: 'Тбилиси', desc: 'Город', desc_en: 'The city', mapCenter: { lat: 41.7, lng: 44.8 },
          photos: [{ id: 'p1', title: 'P1' }],
        },
      },
    },
  });
  var s = out.georgia.series.tbilisi;
  assert.equal(s.desc, 'Город');
  assert.equal(s.desc_en, 'The city');
  assert.deepEqual(s.mapCenter, { lat: 41.7, lng: 44.8 });
  assert.deepEqual(s.photos.map(function(p) { return p.id; }), ['p1']);
});

test('country default photo type survives; shape of the basic fields is unchanged', function() {
  var out = roundTrip({
    georgia: { label: 'Грузия', label_en: 'Georgia', defaultPhotoType: 'camera', series: {
      tb: { label: 'Тб', archived: true, photos: [] },
      ba: { label: 'Батуми', photos: [] },
    } },
  });
  assert.equal(out.georgia.defaultPhotoType, 'camera');
  assert.equal(out.georgia.label_en, 'Georgia');
  assert.deepEqual(out.georgia.seriesOrder, ['tb', 'ba']);
  assert.equal(out.georgia.series.tb.archived, true);
  assert.equal('archived' in out.georgia.series.ba, false);  // false flags stay omitted, as before
  assert.equal('label_en' in out.georgia.series.ba, false);  // empty label_en stays omitted
  assert.equal('env' in out.georgia, false);
  assert.equal('countryKey' in out.georgia.series.tb, false);
  assert.equal('photoOrder' in out.georgia.series.tb, false);
});
