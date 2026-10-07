'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var t = require('../lib/photo-leads-triggers.js');

test('normalize lowercases, folds ё and collapses whitespace', function() {
  assert.equal(t.normalize('  Нужна   ФОТОСЪЁМКА\n\nсрочно '), 'нужна фотосъемка срочно');
  assert.equal(t.normalize(null), '');
});

test('level 1 matches direct requests in ru / en / ka', function() {
  assert.equal(t.prefilter('Посоветуйте фотографа на свадьбу в Тбилиси').level, 1);
  assert.equal(t.prefilter('Looking for a photographer in Batumi next week').level, 1);
  assert.equal(t.prefilter('ვეძებ ფოტოგრაფს დაბადების დღისთვის').level, 1);
  assert.equal(t.prefilter('кто может поснимать наш ужин?').level, 1);
});

test('level 1 also matches bare stems (classifier rejects self-promo later)', function() {
  var r = t.prefilter('Я фотограф, снимаю портреты, пишите');
  assert.equal(r.level, 1);
  assert.ok(r.matched.indexOf('фотограф') !== -1);
});

test('level 2 matches indirect demand', function() {
  assert.equal(t.prefilter('Мы открываем ресторан на Руставели в ноябре').level, 2);
  assert.equal(t.prefilter('Launching a brand of natural wine, need content').level, 2);
  assert.equal(t.prefilter('სოციალური მედია სპეციალისტი/კონტენტ კრეატორი').level, 2);
});

test('level 1 wins over level 2 when both match', function() {
  assert.equal(t.prefilter('Открываем ресторан, нужен фотограф для меню').level, 1);
});

test('no match returns null', function() {
  assert.equal(t.prefilter('How do I get from Asureti back to Tbilisi?'), null);
  assert.equal(t.prefilter(''), null);
});
