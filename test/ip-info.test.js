'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var ipInfo = require('../lib/ip-info.js');

test('fromReq: first X-Forwarded-For hop, else socket address', function() {
  assert.equal(ipInfo.fromReq({ headers: { 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }, socket: {} }), '1.2.3.4');
  assert.equal(ipInfo.fromReq({ headers: {}, socket: { remoteAddress: '::ffff:5.6.7.8' } }), '::ffff:5.6.7.8');
  assert.equal(ipInfo.fromReq({ headers: {} }), '');
});

test('htmlLine: IP with geo, bare IP on lookup failure, empty without IP', async function() {
  var geo = { city: 'Тбилиси', regionName: 'Тбилиси', country: 'Грузия', isp: 'Magti<com>' };
  assert.equal(await ipInfo.htmlLine('::ffff:1.2.3.4', async function() { return geo; }),
    '\nIP: <code>1.2.3.4</code> — Тбилиси, Грузия · Magti&lt;com&gt;');
  assert.equal(await ipInfo.htmlLine('1.2.3.4', async function() { throw new Error('down'); }), '\nIP: <code>1.2.3.4</code>');
  assert.equal(await ipInfo.htmlLine('', function() { throw new Error('must not be called'); }), '');
});
