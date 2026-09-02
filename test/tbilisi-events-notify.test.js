'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var notify = require('../lib/tbilisi-events-notify.js');

test('notifCopy: known key per lang, en fallback', function() {
  var en = notify.notifCopy('published', 'en', { title: 'Jazz Night', link: 'https://x/e/1' });
  assert.ok(en.tg.indexOf('Jazz Night') !== -1);
  assert.ok(en.email.subject.length > 0);
  assert.ok(en.email.html.indexOf('https://x/e/1') !== -1);
  var ru = notify.notifCopy('published', 'ru', { title: 'X', link: 'y' });
  assert.notEqual(ru.tg, en.tg);
  var fb = notify.notifCopy('published', 'zz', { title: 'X', link: 'y' });
  assert.equal(fb.tg, notify.notifCopy('published', 'en', { title: 'X', link: 'y' }).tg);
  var unknown = notify.notifCopy('nope', 'en', {});
  assert.equal(unknown, null);
});

test('notifCopy: every key renders for every lang', function() {
  var langs = ['en', 'ru', 'ka'];
  ['published', 'rejected', 'updated', 'organizer_approved', 'organizer_rejected'].forEach(function(key) {
    langs.forEach(function(lang) {
      var m = notify.notifCopy(key, lang, { title: 'T', link: 'https://x/e/1', reason: 'R' });
      assert.ok(m, key + '/' + lang + ' should render');
      assert.ok(m.tg.length > 0, key + '/' + lang + ' tg should render');
      assert.ok(m.email.subject.length > 0);
      assert.ok(m.email.html.length > 0);
    });
  });
});

test('routeNotify: telegram present -> sends TG, not email', async function() {
  var calls = { tg: [], email: [], blocked: [] };
  await notify.routeNotify(
    { id: 'u1', tgUserId: '55', email: 'u@x.com', lang: 'en' },
    { tg: 'hi', email: { subject: 's', html: '<p>h</p>', text: 't' } },
    { sendTg: async function(id, t) { calls.tg.push([id, t]); }, sendEmail: async function(e, m) { calls.email.push([e, m]); }, setBlocked: async function(id, b) { calls.blocked.push([id, b]); } }
  );
  assert.deepEqual(calls.tg, [['55', 'hi']]);
  assert.equal(calls.email.length, 0);
});

test('routeNotify: TG send throws -> falls back to email + marks blocked', async function() {
  var calls = { email: [], blocked: [] };
  await notify.routeNotify(
    { id: 'u1', tgUserId: '55', email: 'u@x.com', lang: 'en' },
    { tg: 'hi', email: { subject: 's', html: '<p>h</p>', text: 't' } },
    { sendTg: async function() { throw new Error('403'); }, sendEmail: async function(e, m) { calls.email.push([e, m]); }, setBlocked: async function(id, b) { calls.blocked.push([id, b]); } }
  );
  assert.equal(calls.email.length, 1);
  assert.deepEqual(calls.blocked, [['u1', true]]);
});

test('routeNotify: no TG -> email; no TG and no email -> swallowed', async function() {
  var sent = [];
  await notify.routeNotify({ id: 'u1', email: 'u@x.com', lang: 'en' }, { tg: 'hi', email: { subject: 's', html: '<p>h</p>', text: 't' } },
    { sendTg: async function() { throw new Error('should not'); }, sendEmail: async function(e) { sent.push(e); }, setBlocked: async function() {} });
  assert.deepEqual(sent, ['u@x.com']);
  await notify.routeNotify({ id: 'u1', lang: 'en' }, { tg: 'hi', email: { subject: 's', html: 'h', text: 't' } },
    { sendTg: async function() { throw new Error('x'); }, sendEmail: async function() { throw new Error('x'); }, setBlocked: async function() {} });
  // no throw
});
