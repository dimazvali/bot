'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('fs');
var path = require('path');
var pug = require('pug');
var nav = require('../lib/photo-admin-nav.js');

var ADMIN_DIR = path.join(__dirname, '..', 'views', 'photo', 'admin');

// Pages already converted to the layout. Each migration task appends its pages here.
var MIGRATED = [];

function renderStub(navKey, extra) {
  var src = 'extends layout\nblock vars\n  - var nav = \'' + navKey + '\'\n'
    + 'block breadcrumbs\n  a(href=\'/admin/shoots\') Съёмки\n  span Тест\n'
    + 'block actions\n  a.admin-btn(href=\'#\') act\n'
    + 'block content\n  p#stub-content content\n'
    + (extra || '');
  return pug.render(src, { filename: path.join(ADMIN_DIR, '__stub.pug'), adminNav: nav.navFor, title: 'T' });
}

test('layout renders menu, exactly one active item, breadcrumbs, actions and content', function() {
  var html = renderStub('people');
  assert.equal((html.match(/adm-nav-link is-active/g) || []).length, 1);
  assert.match(html, /<a class="adm-nav-link is-active" href="\/admin\/people">Люди<\/a>/);
  assert.match(html, /href="\/admin\/logout"/);
  assert.match(html, /<a href="\/admin\/shoots">Съёмки<\/a><span>Тест<\/span>/);
  assert.match(html, /<a class="admin-btn" href="#">act<\/a>/);
  assert.match(html, /<p id="stub-content">content<\/p>/);
  assert.match(html, /\/stylesheets\/photo\/style\.css[\s\S]*\/stylesheets\/photo\/admin\.css/);
  assert.match(html, /<title>T<\/title>/);
});

test('layout without a nav key renders no active item', function() {
  var src = 'extends layout\nblock content\n  p x\n';
  var html = pug.render(src, { filename: path.join(ADMIN_DIR, '__stub.pug'), adminNav: nav.navFor, title: 'T' });
  assert.equal((html.match(/is-active/g) || []).length, 0);
});

MIGRATED.forEach(function(file) {
  test('migrated page ' + file + ' extends the layout with a valid nav key and compiles', function() {
    var full = path.join(file.indexOf('/') === -1 ? ADMIN_DIR : path.join(__dirname, '..', 'views'), file);
    var src = fs.readFileSync(full, 'utf8');
    assert.match(src, /^(include [^\n]+\n)*extends (layout|\.\.\/photo\/admin\/layout)\b/);
    var m = src.match(/- var nav = '([a-z-]+)'/);
    assert.ok(m, 'no nav key');
    assert.ok(nav.NAV_KEYS.indexOf(m[1]) !== -1, 'unknown nav key ' + m[1]);
    pug.compileFile(full);
  });
});
