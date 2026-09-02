'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var ekaBot = require('../lib/eka-bot.js');

function fakeDb() {
  var doc = {
    get: async function() { return { exists: true, data: function() { return {}; } }; },
    set: async function() {}, update: async function() {},
    collection: function() { return { add: async function() {} }; },
  };
  return { collection: function() { return { doc: function() { return doc; } }; } };
}

test('handleUpdate consults onStartPayload for a /start argument and skips welcome when it returns true', async function() {
  ekaBot.init(fakeDb(), 'TESTTOKEN', null);
  var seen = null;
  var update = { message: { from: { id: 111, is_bot: false, first_name: 'X' }, chat: { id: 111 }, text: '/start te_abc' } };

  await ekaBot.handleUpdate(update, function() {}, function() {}, function() {}, async function(payload, msg) {
    seen = { payload: payload, chatId: msg.chat.id };
    return true; // handled
  });

  assert.deepEqual(seen, { payload: 'te_abc', chatId: 111 });
});

test('handleUpdate still works when onStartPayload is omitted (backward compatible)', async function() {
  ekaBot.init(fakeDb(), 'TESTTOKEN', null);
  var update = { message: { from: { id: 222, is_bot: false, first_name: 'Y' }, chat: { id: 222 }, text: '/start' } };
  await ekaBot.handleUpdate(update, function() {}, function() {}, function() {}); // 4 args, no throw
});
