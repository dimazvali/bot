'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var variants = require('../lib/photo-variants.js');

var photo = {
  id: 'tower',
  urls: { thumb: 'm-400', preview: 'm-800', full: 'm-2400' },
  width: 3000, height: 2000,
  variants: [
    { id: 'abc', label: 'Ч/Б', label_en: 'B&W', urls: { thumb: 'v-400', preview: 'v-800', full: 'v-2400' }, width: 3000, height: 2000 },
  ],
};

test('storagePaths keeps variant files next to the main ones and distinct from them', function() {
  var p = variants.storagePaths('ge', 'tbilisi', 'tower', 'abc');
  assert.deepEqual(p, {
    p400: 'ge/tbilisi/tower--abc-400.webp',
    p800: 'ge/tbilisi/tower--abc-800.webp',
    p2400: 'ge/tbilisi/tower--abc-2400.webp',
  });
});

test('switcherItems is empty for a frame without copies', function() {
  assert.deepEqual(variants.switcherItems({ id: 'x', urls: {} }, 'ru'), []);
  assert.deepEqual(variants.switcherItems(Object.assign({}, photo, { variants: [] }), 'ru'), []);
});

test('switcherItems lists the main version first, then the copies, with localized labels', function() {
  var ru = variants.switcherItems(photo, 'ru');
  assert.equal(ru.length, 2);
  assert.equal(ru[0].id, '');
  assert.equal(ru[0].label, 'оригинал');
  assert.equal(ru[0].src, 'm-2400');
  assert.equal(ru[0].srcset, 'm-800 800w, m-2400 2400w');
  assert.equal(ru[1].id, 'abc');
  assert.equal(ru[1].label, 'Ч/Б');
  assert.equal(ru[1].src, 'v-2400');
  assert.equal(ru[1].srcset, 'v-800 800w, v-2400 2400w');

  var en = variants.switcherItems(Object.assign({}, photo, { variantLabel: 'Цвет', variantLabel_en: 'Colour' }), 'en');
  assert.equal(en[0].label, 'Colour');
  assert.equal(en[1].label, 'B&W');
});

test('switcherItems falls back to the Russian label when there is no English one', function() {
  var p = Object.assign({}, photo, { variantLabel: 'Цвет', variants: [Object.assign({}, photo.variants[0], { label_en: '' })] });
  var en = variants.switcherItems(p, 'en');
  assert.equal(en[0].label, 'Цвет');
  assert.equal(en[1].label, 'Ч/Б');
});
