'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var path = require('path');
var pug = require('pug');
var picker = require('../public/javascripts/photo/tag-picker.js');

var OPTIONS = [
  { slug: 'tbilisi', label: 'Тбилиси', label_en: 'Tbilisi', type: 'location', uses: 40 },
  { slug: 'old-tbilisi', label: 'Старый Тбилиси', label_en: 'Old Tbilisi', type: 'location', uses: 5 },
  { slug: 'sea', label: 'Море', label_en: 'Sea', type: 'misc', uses: 12 },
  { slug: 'yolka', label: 'Ёлка', label_en: '', type: 'misc', uses: 1 },
  { slug: 'mountains', label: 'Горы', label_en: 'Mountains', type: 'misc', uses: 30 },
];
function slugs(list) { return list.map(function(o) { return o.slug; }); }

test('empty query suggests the most used tags first', function() {
  assert.deepEqual(slugs(picker.filterTags(OPTIONS, '', [], 3)), ['tbilisi', 'mountains', 'sea']);
});

test('prefix of the label beats a match in the middle of a word', function() {
  assert.deepEqual(slugs(picker.filterTags(OPTIONS, 'тби', [], 10)), ['tbilisi', 'old-tbilisi']);
  assert.deepEqual(slugs(picker.filterTags(OPTIONS, 'или', [], 10)), ['tbilisi', 'old-tbilisi']);
});

test('matches the English label and the slug, case-insensitively', function() {
  assert.deepEqual(slugs(picker.filterTags(OPTIONS, 'SEA', [], 10)), ['sea']);
  assert.deepEqual(slugs(picker.filterTags(OPTIONS, 'mount', [], 10)), ['mountains']);
  assert.deepEqual(slugs(picker.filterTags(OPTIONS, 'old-t', [], 10)), ['old-tbilisi']);
});

test('ё and е are the same letter', function() {
  assert.deepEqual(slugs(picker.filterTags(OPTIONS, 'елк', [], 10)), ['yolka']);
  assert.deepEqual(slugs(picker.filterTags([{ slug: 'x', label: 'Елка', uses: 0 }], 'ёл', [], 10)), ['x']);
});

test('already selected tags are not suggested again', function() {
  assert.deepEqual(slugs(picker.filterTags(OPTIONS, 'тби', ['tbilisi'], 10)), ['old-tbilisi']);
});

test('the mixin renders selected tags as hidden inputs (form works without JS) and the options as JSON', function() {
  var src = 'include _tag-picker.pug\n+tagPicker(tags, selected, usage)\n';
  var html = pug.render(src, {
    filename: path.join(__dirname, '..', 'views', 'photo', 'admin', '__stub.pug'),
    tags: { sea: { label: 'Море', label_en: 'Sea', type: 'misc' }, tbilisi: { label: 'Тбилиси', type: 'location' } },
    selected: ['tbilisi', 'gone'],
    usage: { tbilisi: { photos: 3, shoots: ['a'] } },
  });
  assert.match(html, /<input type="hidden" name="tags" value="tbilisi"/);
  assert.doesNotMatch(html, /value="sea"/);
  assert.doesNotMatch(html, /value="gone"/); // deleted tag: dropped, as the server would drop it anyway
  var json = html.match(/<script type="application\/json" data-tag-options[^>]*>([\s\S]*?)<\/script>/);
  assert.ok(json, 'no options json');
  var opts = JSON.parse(json[1]);
  assert.deepEqual(opts.find(function(o) { return o.slug === 'tbilisi'; }), { slug: 'tbilisi', label: 'Тбилиси', label_en: '', type: 'location', uses: 4 });
});
