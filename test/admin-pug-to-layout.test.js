'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var cm = require('../scripts/admin-pug-to-layout.js');

var SRC = [
  'include _face-board.pug',
  'doctype html',
  "html(data-theme='dark')",
  '  head',
  '    title= title',
  "    meta(name='viewport' content='width=device-width, initial-scale=1.0')",
  "    link(rel='stylesheet' href='/stylesheets/photo/style.css')",
  "    script(src='https://example.com/lib.js')",
  '  body',
  '    .admin-wrap',
  '      .admin-header',
  "        a.admin-back(href='/admin') ← назад",
  '        span.admin-logo СЪЁМКИ',
  '        .copyright-filter',
  "          a.admin-link(href='?filter=new') новые",
  '      if error',
  '        p.admin-hint= error',
  '      .admin-section',
  '        h2.admin-title A',
  '',
  '        p text',
  '    script.',
  '      var x = 1;',
  '        var y = 2;',
  '    style.',
  '      .a { color: red; }',
  '',
].join('\r\n');

test('converts a standalone admin page to extends layout', function() {
  var r = cm.convert(SRC, 'shoots');
  assert.equal(r.pug, [
    'extends layout',
    'block vars',
    '  include _face-board.pug',
    "  - var nav = 'shoots'",
    'block head',
    "  script(src='https://example.com/lib.js')",
    'block content',
    '  if error',
    '    p.admin-hint= error',
    '  .admin-section',
    '    h2.admin-title A',
    '',
    '    p text',
    'block scripts',
    '  script.',
    '    var x = 1;',
    '      var y = 2;',
    '  style.',
    '    .a { color: red; }',
    '',
  ].join('\n'));
  assert.deepEqual(r.header, [
    "a.admin-back(href='/admin') ← назад",
    'span.admin-logo СЪЁМКИ',
    '.copyright-filter',
    "  a.admin-link(href='?filter=new') новые",
  ]);
});

test('refuses a page that is already converted', function() {
  assert.throws(function() { cm.convert('extends layout\nblock content\n  p x\n', 'shoots'); }, /already/);
});
