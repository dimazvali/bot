'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var ekaBot = require('../lib/eka-bot.js');

function fakeDb(counters) {
  counters = counters || {};
  var settingsDoc = {
    get: async function() { counters.settingsGet = (counters.settingsGet || 0) + 1; return { exists: true, data: function() { return {}; } }; },
    set: async function() {}, update: async function() {},
    collection: function() { return { add: async function() {} }; },
  };
  var userDoc = {
    get: async function() { return { exists: true, data: function() { return {}; } }; },
    set: async function() {}, update: async function() {},
    collection: function() { return { add: async function() {} }; },
  };
  return { collection: function(name) { return { doc: function() { return name === 'eka_settings' ? settingsDoc : userDoc; } }; } };
}

test('handleUpdate consults onStartPayload and skips the welcome when it returns true', async function() {
  var counters = {};
  ekaBot.init(fakeDb(counters), 'TESTTOKEN', null);
  var seen = null;
  var update = { message: { from: { id: 111, is_bot: false, first_name: 'X' }, chat: { id: 111 }, text: '/start te_abc' } };
  await ekaBot.handleUpdate(update, function() {}, function() {}, function() {}, async function(payload, msg) {
    seen = { payload: payload, chatId: msg.chat.id };
    return true;
  });
  assert.deepEqual(seen, { payload: 'te_abc', chatId: 111 });
  assert.equal(counters.settingsGet || 0, 0, 'welcome path (getBotMessages) must not run when the hook handled it');
});

test('handleUpdate falls through to the welcome when onStartPayload returns false', async function() {
  var counters = {};
  ekaBot.init(fakeDb(counters), 'TESTTOKEN', null);
  var update = { message: { from: { id: 111, is_bot: false, first_name: 'X' }, chat: { id: 111 }, text: '/start te_abc' } };
  await ekaBot.handleUpdate(update, function() {}, function() {}, function() {}, async function() { return false; });
  assert.ok((counters.settingsGet || 0) > 0, 'welcome path should run when the hook declines');
});

test('handleUpdate still works when onStartPayload is omitted (backward compatible)', async function() {
  ekaBot.init(fakeDb({}), 'TESTTOKEN', null);
  var update = { message: { from: { id: 222, is_bot: false, first_name: 'Y' }, chat: { id: 222 }, text: '/start' } };
  await ekaBot.handleUpdate(update, function() {}, function() {}, function() {}); // 4 args, no throw
});
