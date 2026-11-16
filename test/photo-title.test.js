'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var { isPlaceholder, display } = require('../lib/photo-title.js');
var { cleanTitle } = require('../lib/photo-seo.js');
var i18n = require('../lib/photo-i18n.js');

test('isPlaceholder: camera / phone / drone file names', function() {
  ['_MG_6876', 'IMG_4086', 'img-4086', 'mg-3545', '_img_0012', 'IMG_4086 (1)', 'IMG_4086.JPG', 'DSC01234', 'DSCF0012',
   'DJI_0042', 'PXL_20260812_101010', 'P1010203', 'GOPR0001', '20260812_101010', '6876', 'IMG_4086-edit', '', '  ', null]
    .forEach(function(t) { assert.equal(isPlaceholder(t), true, String(t)); });
});

test('isPlaceholder: real titles are kept', function() {
  ['Гитарист на сцене', 'Imagine Dragons', 'Mgeli 2', 'Photo booth', 'DJ set at Bassiani', 'Pxl art wall', 'Tbilisi 2026']
    .forEach(function(t) { assert.equal(isPlaceholder(t), false, t); });
});

test('display: generated title only replaces a file name', function() {
  assert.equal(display({ title: '_MG_6876', seo_title: 'Клоун-гитарист на сцене Elektroverk' }), 'Клоун-гитарист на сцене Elektroverk');
  assert.equal(display({ title: '_MG_6876' }), '_MG_6876');
  assert.equal(display({ title: 'Свой заголовок', seo_title: 'Сгенерированный' }), 'Свой заголовок');
  assert.equal(display({ id: 'mg-1', title: '' , seo_title: '' }), 'mg-1');
});

test('display + localizePhoto: EN picks seo_title_en, falls back to RU', function() {
  var p = { title: '_MG_6876', title_en: '_MG_6876', seo_title: 'Клоун-гитарист', seo_title_en: 'Clown guitarist on stage' };
  assert.equal(display(i18n.localizePhoto(p, 'en')), 'Clown guitarist on stage');
  assert.equal(display(i18n.localizePhoto({ title: 'IMG_1', seo_title: 'Клоун' }, 'en')), 'Клоун');
});

test('cleanTitle: quotes, final dot, length', function() {
  assert.equal(cleanTitle('«Клоун-гитарист на сцене».'), 'Клоун-гитарист на сцене');
  assert.ok(cleanTitle('слово '.repeat(30)).length <= 70);
  assert.equal(cleanTitle(undefined), '');
});

test('isPhotoIndexable: author\'s pick on → only picked frames; private shoots never', function() {
  var shoots = require('../lib/photo-shoots.js');
  var a = { id: 'a', curatorPick: true }, b = { id: 'b' };
  var on = { public: true, showCuratorSelection: true, photos: [a, b] };
  assert.equal(shoots.isPhotoIndexable(on, a), true);
  assert.equal(shoots.isPhotoIndexable(on, b), false);
  var off = { public: true, showCuratorSelection: false, photos: [a, b] };
  assert.equal(shoots.isPhotoIndexable(off, b), true);
  var noPicks = { public: true, showCuratorSelection: true, photos: [{ id: 'x' }] }; // nothing picked → gallery shows all
  assert.equal(shoots.isPhotoIndexable(noPicks, noPicks.photos[0]), true);
  assert.equal(shoots.isPhotoIndexable({ public: false, photos: [a] }, a), false);
});
