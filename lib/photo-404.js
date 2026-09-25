'use strict';

// Telegram heads-up for dead links on photo.dimazvali.com ("404 hits").
//
// Only real, interesting traffic is reported — a dead link somebody actually followed:
//   • production host only (photo.<domain>); the preview host, photo.localhost and local previews stay silent;
//   • a page view (GET, Accept: text/html) — not images/scripts, not POSTs;
//   • not a crawler (photo-stats' BOT_UA_RE) and not the logged-in owner;
//   • not a vulnerability-scanner probe (/wp-login.php, /.env, …);
//   • each path at most once per 6 hours, and at most 12 messages an hour overall.
// The message says where the visitor came from (Referer), which is the useful part: it points at the
// page/post that still carries the old link.
var axios = require('axios');
var { BOT_UA_RE } = require('./photo-stats');

var DIMA_CHAT_ID = 144489840; // same chat as the other photo.dimazvali.com alerts (routes/photo.js)
var DEDUPE_MS = 6 * 60 * 60 * 1000;
var WINDOW_MS = 60 * 60 * 1000;
var MAX_PER_WINDOW = 12;

var SCANNER_RE = /\.(php\d?|asp|aspx|jsp|cgi|env|git|svn|sql|bak|old|zip|tar|gz|rar|ini|ya?ml|log)(\/|$)|wp-|wordpress|xmlrpc|phpmyadmin|\.ds_store|\/(cgi-bin|vendor|node_modules|actuator|owa|solr|boaform)(\/|$)/i;
var ASSET_RE = /\.(js|css|map|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|eot|mp4|txt|json)$/i;

var _seen = new Map(); // path -> last notified at
var _sent = [];        // timestamps of the messages sent in the current window

function isProductionHost(req) {
  return /^photo\.(?!localhost)/i.test(req.hostname || '');
}

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function shouldNotify(req, opts) {
  opts = opts || {};
  if (opts.isAdmin) return false;
  if (!isProductionHost(req)) return false;
  if (req.method !== 'GET') return false;
  if ((req.headers.accept || '').indexOf('text/html') === -1) return false;
  var ua = req.headers['user-agent'] || '';
  if (!ua || BOT_UA_RE.test(ua)) return false;
  var p = req.path || '';
  if (SCANNER_RE.test(p) || ASSET_RE.test(p)) return false;
  return true;
}

function defaultSend(text) {
  var token = process.env.dimazvaliToken;
  if (!token) return Promise.resolve();
  return axios.post('https://api.telegram.org/bot' + token + '/sendMessage', {
    chat_id: DIMA_CHAT_ID,
    text: text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  }).catch(function(e) { console.error('[photo-404] telegram:', e.message); });
}

// returns true when a message was (or, with a stub sender, would be) sent
function notifyNotFound(req, opts) {
  opts = opts || {};
  if (!shouldNotify(req, opts)) return false;

  var now = Date.now();
  var key = req.path;
  var last = _seen.get(key);
  if (last && now - last < DEDUPE_MS) return false;
  _sent = _sent.filter(function(t) { return now - t < WINDOW_MS; });
  if (_sent.length >= MAX_PER_WINDOW) return false;
  _seen.set(key, now);
  _sent.push(now);
  if (_seen.size > 500) { // keep the dedupe map small
    _seen.forEach(function(t, k) { if (now - t > DEDUPE_MS) _seen.delete(k); });
  }

  var full = (req.originalUrl || req.url || key).slice(0, 300);
  var referer = req.headers.referer || req.headers.referrer || '';
  var ua = (req.headers['user-agent'] || '').slice(0, 140);
  var text = '<b>🧭 404 на photo.dimazvali.com</b>\n'
    + esc(full) + '\n\n'
    + 'Откуда: ' + (referer ? esc(referer.slice(0, 300)) : 'прямой заход / без реферера') + '\n'
    + 'Язык: ' + (opts.lang === 'en' ? 'EN' : 'RU') + '\n'
    + 'Браузер: ' + esc(ua);
  var send = opts.send || defaultSend;
  Promise.resolve(send(text)).catch(function() {});
  return true;
}

module.exports = { notifyNotFound: notifyNotFound, shouldNotify: shouldNotify, sendTelegram: defaultSend };
