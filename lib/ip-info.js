'use strict';

// IP → "Tbilisi, Georgia · Magticom" for Telegram alerts. ip-api.com free tier (no key, 45 req/min, HTTP
// only) — alert volume is far below that. Cached for a day; any failure resolves to null so the caller can
// still show the bare IP.
var axios = require('axios');

var TTL_MS = 24 * 60 * 60 * 1000;
var _cache = new Map(); // ip -> { at, info }

var PRIVATE_RE = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd|fe80:)/i;

function clean(ip) { return String(ip || '').trim().replace(/^::ffff:/i, ''); }

async function lookup(ip) {
  ip = clean(ip);
  if (!ip || PRIVATE_RE.test(ip)) return null;
  var hit = _cache.get(ip);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.info;
  var info = null;
  try {
    var r = await axios.get('http://ip-api.com/json/' + encodeURIComponent(ip), {
      params: { fields: 'status,country,regionName,city,isp,org,mobile,proxy,hosting', lang: 'ru' },
      timeout: 2000,
    });
    if (r.data && r.data.status === 'success') info = r.data;
  } catch (e) {
    console.error('[ip-info]', e.message);
  }
  _cache.set(ip, { at: Date.now(), info: info });
  if (_cache.size > 1000) _cache.forEach(function(v, k) { if (Date.now() - v.at > TTL_MS) _cache.delete(k); });
  return info;
}

// "Тбилиси, Грузия · Magticom (моб., VPN/прокси)" or '' when unknown
function describe(info) {
  if (!info) return '';
  var place = [info.city, info.regionName !== info.city ? info.regionName : null, info.country].filter(Boolean).join(', ');
  var net = info.org && info.org !== info.isp ? info.isp + ' / ' + info.org : info.isp;
  var flags = [info.mobile ? 'моб.' : null, info.proxy ? 'VPN/прокси' : null, info.hosting ? 'хостинг' : null].filter(Boolean);
  return [place, net].filter(Boolean).join(' · ') + (flags.length ? ' (' + flags.join(', ') + ')' : '');
}

module.exports = { lookup: lookup, describe: describe, clean: clean };
