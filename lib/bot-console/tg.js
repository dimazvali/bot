'use strict';
// Thin Bot API client for the bot console (ported from libo-guides-bot src/tg.js).
// Unlike routes/methods.js sendMessage2, failures throw TgError with Telegram's
// error_code / description / retry_after — broadcasts and the chat need them
// (403 = user blocked the bot, 429 = slow down).
//
// onSent(method, payload, result, meta) is called after every successful send —
// the chat history hooks in there (lib/bot-console/chats.js recordOut).

var axios = require('axios');

class TgError extends Error {
  constructor(code, description, retryAfter) {
    super(description || ('Telegram error ' + code));
    this.code = code;
    this.description = description || null;
    this.retryAfter = retryAfter || null;
  }
}

function toTgError(err) {
  var d = err && err.response && err.response.data;
  if (d && d.ok === false) {
    return new TgError(d.error_code, d.description, d.parameters && d.parameters.retry_after);
  }
  return err;
}

function createTg(token, opts) {
  opts = opts || {};
  var http = opts.http || axios;
  var onSent = opts.onSent || null;
  var base = 'https://api.telegram.org/bot' + token + '/';

  async function call(method, payload, callOpts) {
    var meta = callOpts && callOpts.meta;
    var res;
    try {
      res = await http.post(base + method, payload || {}, { headers: { 'Content-Type': 'application/json' } });
    } catch (err) {
      throw toTgError(err);
    }
    if (!res.data || !res.data.ok) {
      var d = res.data || {};
      throw new TgError(d.error_code, d.description, d.parameters && d.parameters.retry_after);
    }
    if (onSent) {
      try { onSent(method, payload, res.data.result, meta || {}); } catch (e) { console.warn('[bot-console] onSent:', e.message); }
    }
    return res.data.result;
  }

  // file: { buf: Buffer, name, type }
  async function sendUpload(method, chatId, field, file, extra, meta) {
    var form = new FormData();
    form.append('chat_id', String(chatId));
    Object.keys(extra || {}).forEach(function(k) { form.append(k, String(extra[k])); });
    form.append(field, new Blob([file.buf], { type: file.type || 'application/octet-stream' }), file.name || 'file');
    var res;
    try {
      res = await http.post(base + method, form);
    } catch (err) {
      throw toTgError(err);
    }
    if (!res.data || !res.data.ok) {
      var d = res.data || {};
      throw new TgError(d.error_code, d.description);
    }
    var payload = Object.assign({ chat_id: chatId }, extra || {});
    if (onSent) {
      try { onSent(method, payload, res.data.result, meta || {}); } catch (e) { console.warn('[bot-console] onSent:', e.message); }
    }
    return res.data.result;
  }

  // Stream of a Telegram file (for previews in the chat): { stream, contentType }
  async function fileStream(fileId) {
    var info = await call('getFile', { file_id: fileId });
    var res = await http.get('https://api.telegram.org/file/bot' + token + '/' + info.file_path, { responseType: 'stream' });
    return { stream: res.data, contentType: res.headers['content-type'] || null, path: info.file_path };
  }

  return { call: call, sendUpload: sendUpload, fileStream: fileStream };
}

// 123456:ABC…xyz → 123456:…wxyz — identifies the bot without leaking the token
function maskToken(token) {
  var parts = String(token || '').split(':');
  return parts[1] ? parts[0] + ':…' + parts[1].slice(-4) : '—';
}

module.exports = { createTg: createTg, TgError: TgError, maskToken: maskToken };
