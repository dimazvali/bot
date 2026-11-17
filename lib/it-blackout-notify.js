'use strict';
// Telegram alerts for the /blackout mini-game (same bot and chat as the photo.dimazvali.com alerts):
//   • a new shift started — at most once per device per 30 min (players hit "another shift" a lot),
//     and at most 30 launch alerts an hour overall;
//   • a score went into the top-10 (only when it improved the device's row), flagging a new leader.
// Production host only: it.localhost and local previews stay silent.
var tg = require('./photo-404');
var ipInfo = require('./ip-info');

var LAUNCH_DEDUPE_MS = 30 * 60 * 1000;
var WINDOW_MS = 60 * 60 * 1000;
var MAX_LAUNCHES_PER_WINDOW = 30;
var GAME_URL = 'https://it.dimazvali.com/blackout';

function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function isProduction(req) { return /^it\.dimazvali\.com$/i.test((req && req.hostname) || ''); }

function deviceKind(ua) { return /Mobi|Android|iPhone|iPad/i.test(ua || '') ? '📱 телефон' : '💻 компьютер'; }

function minutes(ms) {
  var s = Math.round((ms || 0) / 1000);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

// opts (for tests): send(text), ipLine(ip) → Promise<string>, now() → ms, production(req) → bool
function create(opts) {
  opts = opts || {};
  var send = opts.send || tg.sendTelegram;
  var ipLine = opts.ipLine || ipInfo.htmlLine;
  var now = opts.now || Date.now;
  var production = opts.production || isProduction;
  var seen = new Map(); // device (or ip) -> last launch alert
  var sent = [];        // launch alerts in the current window

  function dispatch(head, req) {
    return Promise.resolve(ipLine(ipInfo.fromReq(req))).catch(function () { return ''; })
      .then(function (line) { return send(head + line); })
      .catch(function (e) { console.error('[blackout-notify]', e && e.message); });
  }

  // returns true when an alert goes out
  function launch(req, body) {
    if (!production(req)) return false;
    body = body || {};
    var t = now();
    var key = String(body.deviceId || '').slice(0, 64) || ipInfo.fromReq(req);
    var last = seen.get(key);
    if (last && t - last < LAUNCH_DEDUPE_MS) return false;
    sent = sent.filter(function (x) { return t - x < WINDOW_MS; });
    if (sent.length >= MAX_LAUNCHES_PER_WINDOW) return false;
    seen.set(key, t);
    sent.push(t);
    if (seen.size > 2000) seen.forEach(function (v, k) { if (t - v > LAUNCH_DEDUPE_MS) seen.delete(k); });

    var plays = Number(body.plays);
    var which = plays === 1 ? 'первая смена на этом устройстве'
      : Number.isInteger(plays) && plays > 1 ? 'смена №' + plays + ' на этом устройстве' : 'новая смена';
    var head = '<b>🎮 Тбилиси без света: ' + which + '</b>\n'
      + (body.lang === 'en' ? 'EN' : 'RU') + ' · ' + deviceKind(req.headers && req.headers['user-agent']) + '\n'
      + GAME_URL;
    dispatch(head, req);
    return true;
  }

  // r: { nick, score, level, fixes, durationMs, rank } — rank in the top-10 after saving (null if outside)
  function record(req, r) {
    if (!production(req)) return false;
    var leader = r.rank === 1;
    var head = '<b>' + (leader ? '🥇 Тбилиси без света: новый лидер!' : '🏆 Тбилиси без света: рекорд в топ-10') + '</b>\n'
      + '<b>' + esc(r.nick) + '</b> — ' + r.score + ' очк., уровень ' + r.level + ', починок ' + r.fixes
      + ', смена ' + minutes(r.durationMs) + '\n'
      + (r.rank ? 'Место в таблице: ' + r.rank : 'В топ-10 не попал') + '\n'
      + GAME_URL;
    dispatch(head, req);
    return true;
  }

  return { launch: launch, record: record };
}

module.exports = { create: create, isProduction: isProduction };
