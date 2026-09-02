'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var mailer = require('../lib/tbilisi-events-mailer.js');

test('buildMagicLinkEmail: subject + link per language, en fallback', function() {
  var en = mailer.buildMagicLinkEmail('https://x/y?token=abc', 'en');
  assert.match(en.subject, /sign in|log in/i);
  assert.ok(en.html.indexOf('https://x/y?token=abc') !== -1);
  assert.ok(en.text.indexOf('https://x/y?token=abc') !== -1);

  var ru = mailer.buildMagicLinkEmail('https://x/y?token=abc', 'ru');
  assert.match(ru.subject, /вход/i);

  var fallback = mailer.buildMagicLinkEmail('https://x/y?token=abc', 'zz');
  assert.equal(fallback.subject, en.subject);
});

test('sendMagicLink is a no-op when transporter is not initialised', async function() {
  // init() not called → no throw, returns undefined
  await mailer.sendMagicLink('a@b.com', 'https://x/y', 'en');
});

test('buildMagicLinkEmail escapes the url in html but not in text', function() {
  var m = mailer.buildMagicLinkEmail('https://x/y?a=1&b=<2>', 'en');
  assert.ok(m.html.indexOf('a=1&amp;b=&lt;2&gt;') !== -1, 'html should be escaped');
  assert.ok(m.html.indexOf('a=1&b=<2>') === -1, 'html should not contain the raw url');
  assert.ok(m.text.indexOf('https://x/y?a=1&b=<2>') !== -1, 'text should contain the raw url');
});
test('buildMagicLinkEmail ka has a subject', function() {
  assert.match(mailer.buildMagicLinkEmail('https://x/y', 'ka').subject, /შესვლა/);
});
