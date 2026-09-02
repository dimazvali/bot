'use strict';
var crypto = require('crypto');

var _db = null;
function init(db) { _db = db; }

var LOGIN_TOKEN_TTL_MS = 30 * 60 * 1000;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

// A post-login redirect target is only honoured if it is a path inside this app.
function safeNext(next) {
  var s = String(next || '');
  if (s !== '/tbilisi-events' && !s.startsWith('/tbilisi-events/')) return '/tbilisi-events';
  if (s.indexOf('//') !== -1 || s.indexOf('\\') !== -1) return '/tbilisi-events';
  return s;
}

// The blob stored in the signed session cookie — small, no secrets.
function sessionPayload(user) {
  return {
    uid: user.id,
    email: user.email || '',
    name: user.name || '',
    picture: user.picture || null,
    tg: !!user.tgUserId,
  };
}

// CSRF guard for state-changing POSTs. sameSite:lax already blocks cross-site
// cookie sends; this rejects requests whose Origin/Referer host is not ours,
// and requests that carry neither header.
function sameOrigin(req) {
  var host = req.get('host') || '';
  var origin = req.get('origin') || '';
  var referer = req.get('referer') || '';
  var candidate = origin || referer;
  if (!candidate) return false;
  try { return new URL(candidate).host === host; } catch (e) { return false; }
}

function deepLink(tgLinkToken) {
  return 'https://t.me/' + (process.env.EKA_BOT_NAME || '') + '?start=te_' + tgLinkToken;
}

module.exports = {
  init: init,
  LOGIN_TOKEN_TTL_MS: LOGIN_TOKEN_TTL_MS,
  normalizeEmail: normalizeEmail,
  safeNext: safeNext,
  sessionPayload: sessionPayload,
  sameOrigin: sameOrigin,
  deepLink: deepLink,
};
