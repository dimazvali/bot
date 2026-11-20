'use strict';
var test = require('node:test');
var assert = require('node:assert');
var fs = require('fs');
var path = require('path');
var page = require('../lib/lab-streets-page');

var HTML = fs.readFileSync(path.join(__dirname, '../public/lab/streets/index.html'), 'utf8');

test('the shipped page localizes into every language', function () {
  page.LANGS.forEach(function (lang) {
    var out = page.localize(HTML, lang);
    assert.ok(out.indexOf('<html lang="' + lang + '">') >= 0);
    assert.ok(out.indexOf('content="' + page.META[lang].ogTitle + '"') >= 0, lang + ' og:title');
    assert.ok(out.indexOf('og:url" content="https://dimazvali.com/lab/streets/?lang=' + lang + '"') >= 0);
  });
  var en = page.localize(HTML, 'en');
  assert.ok(en.indexOf('<title>Whose Streets, Tbilisi? — dimazvali.com</title>') >= 0);
  assert.ok(en.indexOf('Tbilisi’s road network split by who the streets are named after') >= 0);
  assert.strictEqual(en.indexOf('Дорожная сеть'), -1);
});

test('localize fails loudly when the page no longer has the Russian strings', function () {
  assert.throws(function () { page.localize('<html lang="en"><title>x</title>', 'en'); }, /not found/);
});

test('language: ?lang wins, then Accept-Language, then Russian', function () {
  var accepts = function (pref) { return function (langs) { return langs.indexOf(pref) >= 0 ? pref : false; }; };
  assert.strictEqual(page.pickLang({ lang: 'ka' }, accepts('en'), true), 'ka');
  assert.strictEqual(page.pickLang({ lang: 'fr' }, accepts('en'), true), 'en');
  assert.strictEqual(page.pickLang({}, accepts('ka'), true), 'ka');
  assert.strictEqual(page.pickLang({}, accepts('de'), true), 'en'); // a non-Russian speaker gets English
  assert.strictEqual(page.pickLang({}, accepts('de'), false), 'ru'); // no header at all (bots): Russian
});
