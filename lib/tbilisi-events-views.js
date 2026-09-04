'use strict';
var crypto = require('crypto');
var data = require('./tbilisi-events-data');
var i18n = require('./tbilisi-events-i18n');

var isbot = require('isbot');
if (typeof isbot !== 'function') isbot = isbot.isbot;

var IP_SALT = process.env.TBILISI_EVENTS_VIEW_SALT || 'te-views-v1';

// A request counts as a human view unless it is an admin preview, a bot, has no
// User-Agent, or is not asking for HTML (link unfurlers, JSON clients, curl).
function isCountableView(req) {
  if (req.cookies && req.cookies.tbilisiEventsAdminToken) return false;
  var ua = (req.get('user-agent') || '').trim();
  if (!ua) return false;
  if (isbot(ua)) return false;
  var accept = req.get('accept') || '';
  if (accept.indexOf('text/html') === -1) return false;
  return true;
}

function clientIp(req) {
  var xff = req.get && req.get('x-forwarded-for');
  if (xff) {
    var first = String(xff).split(',')[0].trim();
    if (first) return first;
  }
  if (req.ip) return req.ip;
  return (req.socket && req.socket.remoteAddress) || '';
}

// sha256(ip + salt), first 16 hex chars. Not reversible to a raw IP; for coarse
// uniqueness / abuse analysis only.
function hashIp(req) {
  var ip = clientIp(req);
  if (!ip) return null;
  return crypto.createHash('sha256').update(ip + IP_SALT).digest('hex').slice(0, 16);
}

// Referer host, or null when absent, unparseable, or same-site.
function refHost(req) {
  var raw = req.get('referer') || req.get('referrer');
  if (!raw) return null;
  try {
    var host = new URL(raw).hostname;
    if (!host || host === req.hostname) return null;
    return host;
  } catch (e) {
    return null;
  }
}

// Fire-and-forget: callers MUST NOT await in a way that blocks the response.
// Never rejects — a failed write must not affect the page.
async function recordView(type, entityId, req) {
  try {
    await Promise.all([
      data.bumpViewCount(type, entityId),
      data.addViewRecord({
        type: type,
        entityId: entityId,
        ipHash: hashIp(req),
        ref: refHost(req),
        lang: i18n.normalizeLang(req.query && req.query.lang),
        path: req.path || null,
      }),
    ]);
  } catch (e) {
    console.error('[te views] ' + type + '/' + entityId + ': ' + e.message);
  }
}

module.exports = {
  isCountableView: isCountableView,
  hashIp: hashIp,
  recordView: recordView,
};
