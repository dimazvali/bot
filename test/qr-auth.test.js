'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var { cookieToken } = require('../lib/qr-auth.js');

test('cookieToken is deterministic for the same password', function() {
  assert.equal(cookieToken('secret'), cookieToken('secret'));
});

test('cookieToken differs for different passwords', function() {
  assert.notEqual(cookieToken('secret'), cookieToken('other'));
});

test('cookieToken returns a hex sha256 digest', function() {
  assert.match(cookieToken('x'), /^[0-9a-f]{64}$/);
});
