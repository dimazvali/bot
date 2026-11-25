'use strict';
var test = require('node:test');
var assert = require('node:assert');
var fs = require('fs');
var path = require('path');
var page = require('../lib/lab-streets-page');

var HTML = fs.readFileSync(path.join(__dirname, '../public/lab/streets/index.html'), 'utf8');
var DATA = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/lab/streets/data.json'), 'utf8'));
var P = page.create(DATA);

function between(html, a, b) { var i = html.indexOf(a); return i < 0 ? null : html.slice(i + a.length, html.indexOf(b, i + a.length)); }

test('every view renders in every language with its own canonical, hreflang and boot state', function () {
  [''].concat(Object.keys(page.VIEWS)).forEach(function (slug) {
    page.LANGS.forEach(function (lang) {
      var out = P.render(HTML, lang, slug);
      var self = 'https://dimazvali.com/lab/streets/' + (slug ? slug + '/' : '') + '?lang=' + lang;
      assert.ok(out.indexOf('<html lang="' + lang + '">') >= 0, slug + ' ' + lang);
      assert.ok(out.indexOf('<link rel="canonical" href="' + self + '">') >= 0, slug + ' ' + lang + ' canonical');
      assert.ok(out.indexOf('hreflang="x-default"') >= 0);
      ['<!--META-->', '<!--SIDE-->', '<!--VIEW-->'].forEach(function (m) { assert.strictEqual(out.indexOf(m), -1, m); });
      var boot = JSON.parse(between(out, 'window.STREETS_VIEW = ', ';</script>'));
      assert.strictEqual(boot.slug, slug);
      assert.strictEqual(boot.slugs.artists, 'artists');
      assert.strictEqual(boot.slugs.female, 'women');
    });
  });
});

test('the artists view: SEO title, description with real names, crawlable street list', function () {
  var out = P.render(HTML, 'ru', 'artists');
  var title = between(out, '<title>', '</title>');
  assert.match(title, /^Тбилиси художников: \d+ улиц[аы]?, [\d,]+ км — Чьи улицы Тбилиси$/);
  var desc = between(out, '<meta name="description" content="', '">');
  assert.match(desc, /^Улицы Тбилиси, названные в честь художников и архитекторов: .+ и ещё \d+\. Карта всех \d+ улиц/);
  assert.ok(desc.indexOf('Пиросмани') >= 0, desc);
  var side = between(out, '<aside id="side">', '</aside>');
  assert.ok(side.indexOf('<h1>Тбилиси художников</h1>') >= 0);
  assert.ok(side.indexOf('href="https://dimazvali.com/lab/streets/writers/?lang=ru"') >= 0, 'links to other views');
  assert.ok((side.match(/<li>/g) || []).length > 20);
  var en = P.render(HTML, 'en', 'artists');
  assert.match(between(en, '<title>', '</title>'), /^Artists’ Tbilisi: \d+ streets, [\d.]+ km — Whose Streets, Tbilisi\?$/);
  assert.ok(between(en, '<meta name="description" content="', '">').indexOf('Pirosmani') >= 0);
  var ka = P.render(HTML, 'ka', 'artists');
  assert.match(between(ka, '<title>', '</title>'), /^მხატვრების თბილისი: \d+ ქუჩა/);
});

test('flag views and non-people categories', function () {
  var women = P.meta('women', 'en');
  assert.strictEqual(women.h1, 'Women’s Tbilisi');
  assert.match(women.desc, /^Tbilisi streets named after women: /);
  var places = P.meta('georgian-places', 'ru');
  assert.match(places.desc, /в честь краёв и городов Грузии: .*(шоссе|улица|проспект)/i); // places list street names, not people
  assert.match(P.meta('plain-streets', 'ka').desc, /განსაკუთრებულ არაფერს ეძღვნება/);
});

test('unknown slugs are refused; markers missing from the page fail loudly', function () {
  assert.strictEqual(P.render(HTML, 'ru', 'data.json'), null);
  assert.strictEqual(P.render(HTML, 'ru', 'constructor'), null);
  assert.throws(function () { P.render('<html lang="ru"><!--META-->', 'en', ''); }, /marker not found/);
});

test('sitemap lists every view in every language with alternates', function () {
  var xml = P.sitemap();
  var n = (1 + Object.keys(page.VIEWS).length) * page.LANGS.length;
  assert.strictEqual((xml.match(/<url>/g) || []).length, n);
  assert.ok(xml.indexOf('<loc>https://dimazvali.com/lab/streets/artists/?lang=ka</loc>') >= 0);
});

test('St Petersburg: its own URLs, texts, languages and slugs; links to Tbilisi and back', function () {
  var SPB = page.create(JSON.parse(fs.readFileSync(path.join(__dirname, '../public/lab/streets/data-spb.json'), 'utf8')), 'spb');
  assert.deepStrictEqual(SPB.langs, ['ru', 'en']);
  assert.ok(SPB.hasView('russian-places') && !SPB.hasView('georgian-places') && SPB.hasView('writers') && !SPB.hasView('constructor'));
  var out = SPB.render(HTML, 'ru', 'writers');
  assert.match(between(out, '<title>', '</title>'), /^Петербург писателей: \d+ улиц[аы]?, [\d,]+ км — Чьи улицы Петербурга$/);
  assert.ok(out.indexOf('<link rel="canonical" href="https://dimazvali.com/lab/streets/spb/writers/?lang=ru">') >= 0);
  assert.strictEqual(out.indexOf('hreflang="ka"'), -1, 'no Georgian version of Petersburg');
  assert.ok(out.indexOf('href="https://dimazvali.com/lab/streets/?lang=ru"') >= 0, 'links to Tbilisi');
  var boot = JSON.parse(between(out, 'window.STREETS_VIEW = ', ';</script>'));
  assert.deepStrictEqual([boot.city, boot.base, boot.api, boot.slugs.georgia], ['spb', '/lab/streets/spb/', '/lab/streets/spb/', 'russian-places']);
  assert.match(SPB.meta('russian-places', 'en').desc, /^St Petersburg streets named after Russian towns and regions: /);
  var xml = SPB.sitemap();
  assert.ok(xml.indexOf('<loc>https://dimazvali.com/lab/streets/spb/russian-places/?lang=en</loc>') >= 0);
  assert.strictEqual(xml.indexOf('lang=ka'), -1);
  // and Tbilisi links to Petersburg (Georgian visitors land on its Russian version)
  assert.ok(P.render(HTML, 'ka', '').indexOf('href="https://dimazvali.com/lab/streets/spb/?lang=ru"') >= 0);
});

test('Russian plural for streets', function () {
  assert.deepStrictEqual([1, 2, 5, 11, 21, 22, 25, 112].map(function (n) { return page.streetsWord('ru', n); }),
    ['улица', 'улицы', 'улиц', 'улиц', 'улица', 'улицы', 'улиц', 'улиц']);
});

test('language: ?lang wins, then Accept-Language, then Russian', function () {
  var accepts = function (pref) { return function (langs) { return langs.indexOf(pref) >= 0 ? pref : false; }; };
  assert.strictEqual(page.pickLang({ lang: 'ka' }, accepts('en'), true), 'ka');
  assert.strictEqual(page.pickLang({ lang: 'fr' }, accepts('en'), true), 'en');
  assert.strictEqual(page.pickLang({}, accepts('ka'), true), 'ka');
  assert.strictEqual(page.pickLang({}, accepts('de'), true), 'en');
  assert.strictEqual(page.pickLang({}, accepts('de'), false), 'ru');
});

test('St Petersburg 1914: Russian only, its own views and texts, no people; linked from today\'s Petersburg', function () {
  var D14 = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/lab/streets/data-spb-1914.json'), 'utf8'));
  var P14 = page.create(D14, 'spb1914');
  assert.deepStrictEqual(P14.langs, ['ru']);
  assert.ok(P14.hasView('romanovs') && P14.hasView('churches-and-saints') && !P14.hasView('artists') && !P14.hasView('women'));
  var out = P14.render(HTML, 'ru', 'churches-and-saints');
  assert.match(between(out, '<title>', '</title>'), /^Петербург храмов и святых в 1914 году: \d+ улиц/);
  assert.ok(out.indexOf('<link rel="canonical" href="https://dimazvali.com/lab/streets/spb/1914/churches-and-saints/?lang=ru">') >= 0);
  var side = between(out, '<aside id="side">', '</aside>');
  assert.ok(side.indexOf('Знаменская улица') >= 0, 'lists 1914 names');
  assert.ok(side.indexOf('Петербург сегодня') >= 0, 'links back to today');
  var boot = JSON.parse(between(out, 'window.STREETS_VIEW = ', ';</script>'));
  assert.strictEqual(boot.city, 'spb1914');
  assert.ok(boot.quiz.indexOf('church') >= 0);
  // an English browser still gets the Russian page: there is no other
  assert.strictEqual(page.pickLang({}, function () { return false; }, true, P14.langs), 'ru');
  var SPB = page.create(JSON.parse(fs.readFileSync(path.join(__dirname, '../public/lab/streets/data-spb.json'), 'utf8')), 'spb');
  assert.ok(SPB.render(HTML, 'ru', '').indexOf('href="https://dimazvali.com/lab/streets/spb/1914/?lang=ru"') >= 0);
});
