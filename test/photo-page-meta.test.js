'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var meta = require('../lib/photo-page-meta.js');

test('without saved data every page returns its built-in defaults', async function() {
  await meta.save({});
  assert.deepEqual(meta.get('ru', 'home'), meta.DEFAULTS.ru.home);
  assert.deepEqual(meta.get('en', 'about'), meta.DEFAULTS.en.about);
  assert.deepEqual(meta.get('xx', 'shoots'), meta.DEFAULTS.ru.shoots, 'unknown lang falls back to ru');
});

test('a saved field overrides only that field; values equal to the default are not stored', async function() {
  var stored = await meta.save({
    ru: { home: { title: '  Новый заголовок  ', desc: meta.DEFAULTS.ru.home.desc } },
    en: { shoots: { title: '', desc: 'Custom' } },
  });
  assert.deepEqual(stored.ru, { home: { title: 'Новый заголовок' } });
  assert.deepEqual(stored.en, { shoots: { desc: 'Custom' } });
  assert.equal(meta.get('ru', 'home').title, 'Новый заголовок');
  assert.equal(meta.get('ru', 'home').desc, meta.DEFAULTS.ru.home.desc);
  assert.equal(meta.get('en', 'shoots').title, meta.DEFAULTS.en.shoots.title);
  assert.deepEqual(meta.overrides('en', 'shoots'), { desc: 'Custom' });
  await meta.save({});
});

test('long values are cut and unknown pages/fields ignored', async function() {
  var stored = await meta.save({ ru: { home: { title: 'x'.repeat(1000), junk: 'y' }, nope: { title: 'z' } } });
  assert.equal(stored.ru.home.title.length, meta.MAX_LEN.title);
  assert.equal(stored.ru.home.junk, undefined);
  assert.equal(stored.ru.nope, undefined);
  assert.throws(function() { meta.get('ru', 'nope'); });
  await meta.save({});
});
