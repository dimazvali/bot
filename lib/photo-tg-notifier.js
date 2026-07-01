'use strict';
var axios = require('axios');

var _db = null;
var _token = null;
var _pending = [];
var _lastSentAt = 0;
var _timer = null;
var HOUR_MS = 60 * 60 * 1000;
var DEBOUNCE_MS = 30 * 1000;
var BASE = 'https://photo.dimazvali.com';

function init(db, token) {
  _db = db;
  _token = token;
  console.log('[tg-notifier] initialized, db=' + !!db + ' token=' + !!token);
}

function queue(photo, countryKey, seriesKey) {
  var url = BASE + '/' + countryKey + '/' + seriesKey + '/' + photo.id;
  _pending.push({ photo: photo, url: url });
  console.log('[tg-notifier] queued "' + photo.title + '", pending=' + _pending.length + ', db=' + !!_db);
  schedule();
}

function schedule() {
  if (_timer) clearTimeout(_timer);
  var elapsed = Date.now() - _lastSentAt;
  var delay = elapsed >= HOUR_MS ? DEBOUNCE_MS : (HOUR_MS - elapsed);
  _timer = setTimeout(flush, delay);
}

async function flush() {
  _timer = null;
  console.log('[tg-notifier] flush: pending=' + _pending.length + ' db=' + !!_db + ' token=' + !!_token);
  if (!_db || !_token || !_pending.length) return;

  var batch = _pending.slice();
  _pending = [];
  _lastSentAt = Date.now();

  var snap;
  try {
    snap = await _db.collection('DIMAZVALIusers').where('photoSubscribed', '==', true).get();
  } catch (e) {
    console.error('[tg-notifier] db error:', e.message);
    return;
  }
  console.log('[tg-notifier] subscribers found:', snap.size);
  if (snap.empty) return;

  var first = batch[0];
  var extra = batch.length - 1;
  var caption = '*' + escMd(first.photo.title || '') + '*'
    + (extra > 0 ? ' — и ещё ' + extra + ' ' + plural(extra) : '')
    + '\n[смотреть →](' + first.url + ')';

  var previewUrl = first.photo.urls && (first.photo.urls.preview || first.photo.urls.full);

  for (var doc of snap.docs) {
    var chatId = doc.id;
    try {
      if (previewUrl) {
        await axios.post('https://api.telegram.org/bot' + _token + '/sendPhoto', {
          chat_id: chatId,
          photo: previewUrl,
          caption: caption,
          parse_mode: 'Markdown',
        }, { timeout: 8000 });
      } else {
        await axios.post('https://api.telegram.org/bot' + _token + '/sendMessage', {
          chat_id: chatId,
          text: caption,
          parse_mode: 'Markdown',
        }, { timeout: 8000 });
      }
    } catch (e) {
      console.error('[tg-notifier] send error for', chatId, e.message);
    }
  }
  console.log('[tg-notifier] sent to', snap.size, 'subscribers, photos:', batch.length);
}

function escMd(s) {
  return s.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

function plural(n) {
  if (n % 10 === 1 && n % 100 !== 11) return 'фото';
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return 'фото';
  return 'фото';
}

module.exports = { init, queue, flush };
