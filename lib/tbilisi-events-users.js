'use strict';
var crypto = require('crypto');

var _db = null;
function init(db) { _db = db; }

var LOGIN_TOKEN_TTL_MS = 30 * 60 * 1000;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

// Open-redirect guard for a post-login `next`. Accepts only a path rooted at a
// single "/" (so it can never leave this origin): rejects absolute URLs,
// protocol-relative "//", the "/\" trick, unrooted strings and C0 control chars / DEL.
// Works for both mounts — "/tbilisi-events/suggest" and bare "/suggest".
function safeNext(next, fallback) {
  fallback = fallback || '/';
  var s = String(next || '');
  if (s.charAt(0) !== '/') return fallback;
  if (s.charAt(1) === '/' || s.charAt(1) === '\\') return fallback;
  if (/[\x00-\x1f\x7f]/.test(s)) return fallback;
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

function usersCol() { return _db.collection('tbilisiEventsUsers'); }

function shape(doc) {
  return doc.exists ? Object.assign({ id: doc.id }, doc.data()) : null;
}

async function getUserById(id) {
  if (!id) return null;
  return shape(await usersCol().doc(id).get());
}

async function getUserByEmail(email) {
  var e = normalizeEmail(email);
  if (!e) return null;
  var q = await usersCol().where('email', '==', e).limit(1).get();
  return q.empty ? null : Object.assign({ id: q.docs[0].id }, q.docs[0].data());
}

async function getUserByGoogleId(googleId) {
  if (!googleId) return null;
  var q = await usersCol().where('googleId', '==', googleId).limit(1).get();
  return q.empty ? null : Object.assign({ id: q.docs[0].id }, q.docs[0].data());
}

async function touchLogin(id, lang) {
  var patch = { lastLoginAt: new Date() };
  if (lang) patch.lang = lang;
  await usersCol().doc(id).update(patch);
}

// NOTE: upsertEmailUser / upsertGoogleUser are read-then-write, not transactional.
// A truly concurrent first sign-in for the same identity could create two docs;
// lookups use .limit(1) so one would become a hidden orphan. Acceptable at this
// scale; the login route also guards against client double-submit. Revisit with
// _db.runTransaction (or deterministic doc ids) if duplicates show up.
async function upsertEmailUser(email, lang) {
  var e = normalizeEmail(email);
  var existing = await getUserByEmail(e);
  if (existing) {
    await touchLogin(existing.id, lang);
    return await getUserById(existing.id);
  }
  var now = new Date();
  var ref = await usersCol().add({
    email: e, name: '', picture: null,
    lang: lang || 'en', createdAt: now, lastLoginAt: now,
  });
  return await getUserById(ref.id);
}

async function upsertGoogleUser(profile) {
  var e = normalizeEmail(profile.email);
  var byGoogle = await getUserByGoogleId(profile.sub);
  var target = byGoogle || await getUserByEmail(e);
  if (target) {
    await usersCol().doc(target.id).update({
      googleId: profile.sub,
      email: e || target.email,
      name: profile.name || target.name || '',
      picture: profile.picture || target.picture || null,
      lang: profile.lang || target.lang || 'en',
      lastLoginAt: new Date(),
    });
    return await getUserById(target.id);
  }
  var now = new Date();
  var ref = await usersCol().add({
    googleId: profile.sub, email: e,
    name: profile.name || '', picture: profile.picture || null,
    lang: profile.lang || 'en', createdAt: now, lastLoginAt: now,
  });
  return await getUserById(ref.id);
}

var COOKIE_NAME = 'teUser';
var COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

// Express middleware: parse the signed `teUser` cookie into res.locals.user.
// Zero DB IO — the cookie blob is the session. Always resets res.locals.user
// first so a stale value from an earlier middleware can't leak through.
function attachUser(req, res, next) {
  res.locals.user = null;
  var raw = req.signedCookies && req.signedCookies[COOKIE_NAME];
  if (raw) {
    try {
      var parsed = JSON.parse(raw);
      if (parsed && parsed.uid) res.locals.user = parsed;
    } catch (e) { /* ignore malformed cookie */ }
  }
  next();
}

function wantsJson(req) {
  if (req.xhr) return true;
  var accept = (req.get('accept') || '').toLowerCase();
  return accept.indexOf('application/json') !== -1;
}

// Express middleware: gate a route on a signed-in session. Page requests get
// redirected to the mount-correct login page with a safe ?next=; XHR/JSON get 401.
function requireUser(req, res, next) {
  if (res.locals.user) return next();
  if (wantsJson(req)) return res.status(401).json({ error: 'auth_required' });
  var base = req.teBase || '';
  var back = safeNext(req.originalUrl, base + '/');
  return res.redirect(base + '/login?next=' + encodeURIComponent(back));
}

function setSessionCookie(res, user) {
  res.cookie(COOKIE_NAME, JSON.stringify(sessionPayload(user)), {
    signed: true, httpOnly: true, sameSite: 'lax',
    secure: process.env.develop !== 'true', // set develop=true for local http
    maxAge: COOKIE_MAX_AGE_MS,
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME);
}

function loginTokensCol() { return _db.collection('tbilisiEventsLoginTokens'); }

// Firestore reads return Timestamp (not Date); normalise to epoch ms. Mirrors
// the `.toDate` guard used across this repo (lib/eka-data.js, lib/pelamushi-bot.js).
function tsToMs(v) {
  if (v && typeof v.toDate === 'function') return v.toDate().getTime();
  if (v instanceof Date) return v.getTime();
  var d = new Date(v).getTime();
  return isNaN(d) ? 0 : d;
}

async function issueLoginToken(email, next) {
  var token = crypto.randomBytes(32).toString('hex');
  await loginTokensCol().doc(token).set({
    email: normalizeEmail(email),
    next: safeNext(next),
    createdAt: new Date(),
  });
  return token;
}

// True if a still-usable token for this email was created in the last 60s
// (used to rate-limit "send me a link").
async function recentLoginTokenFor(email, now) {
  now = now || Date.now();
  var e = normalizeEmail(email);
  var q = await loginTokensCol().where('email', '==', e).limit(200).get();
  return q.docs.some(function(d) {
    var t = d.data();
    if (t.usedAt) return false;
    var created = tsToMs(t.createdAt);
    return (now - created) < 60 * 1000;
  });
}

// NOTE: read-then-write, not transactional (same trade-off as the upserts above).
// A link pre-fetched by a mail scanner then clicked, or a double-click, can redeem
// twice -> two sessions for the same email. Acceptable at this scale.
async function redeemLoginToken(token, now) {
  now = now || Date.now();
  var snap = await loginTokensCol().doc(String(token || '')).get();
  if (!snap.exists) return { ok: false, reason: 'not_found' };
  var t = snap.data();
  if (t.usedAt) return { ok: false, reason: 'used' };
  var created = tsToMs(t.createdAt);
  if (now - created > LOGIN_TOKEN_TTL_MS) return { ok: false, reason: 'expired' };
  await loginTokensCol().doc(String(token || '')).update({ usedAt: new Date() });
  return { ok: true, email: t.email, next: safeNext(t.next) };
}

async function ensureTgLinkToken(uid) {
  var user = await getUserById(uid);
  if (!user) return { error: 'no_user' };
  if (user.tgUserId) return { linked: true };
  if (user.tgLinkToken) return { token: user.tgLinkToken, linked: false };
  var token = crypto.randomBytes(9).toString('hex');
  await usersCol().doc(uid).update({ tgLinkToken: token });
  return { token: token, linked: false };
}

async function getUserByTgUserId(tgUserId) {
  var q = await usersCol().where('tgUserId', '==', String(tgUserId)).limit(1).get();
  return q.empty ? null : Object.assign({ id: q.docs[0].id }, q.docs[0].data());
}

// payload is the raw /start argument, e.g. "te_<token>". tgFrom is msg.from.
// NOTE: read-then-write, not transactional (same trade-off as the upserts / token
// redeem above). Two concurrent /start calls could race the tg_taken check.
async function linkTelegram(payload, tgFrom) {
  var s = String(payload || '');
  if (!s.startsWith('te_')) return { ok: false, reason: 'bad_payload' };
  var token = s.slice(3);
  var q = await usersCol().where('tgLinkToken', '==', token).limit(1).get();
  if (q.empty) return { ok: false, reason: 'not_found' };
  if (!tgFrom || tgFrom.id == null) return { ok: false, reason: 'bad_payload' };
  var userId = q.docs[0].id;
  if (q.docs[0].data().tgUserId) return { ok: false, reason: 'already_linked' };
  var tgId = String(tgFrom && tgFrom.id);

  var other = await getUserByTgUserId(tgId);
  if (other && other.id !== userId) return { ok: false, reason: 'tg_taken' };

  await usersCol().doc(userId).update({
    tgUserId: tgId,
    tgLinkedAt: new Date(),
    tgLinkToken: null,
    tgBlocked: null,
  });
  return { ok: true, user: await getUserById(userId) };
}

async function unlinkTelegram(uid) {
  await usersCol().doc(uid).update({ tgUserId: null, tgLinkToken: null, tgLinkedAt: null, tgBlocked: null });
}

module.exports = {
  init: init,
  LOGIN_TOKEN_TTL_MS: LOGIN_TOKEN_TTL_MS,
  normalizeEmail: normalizeEmail,
  safeNext: safeNext,
  sessionPayload: sessionPayload,
  sameOrigin: sameOrigin,
  COOKIE_NAME: COOKIE_NAME,
  attachUser: attachUser,
  requireUser: requireUser,
  wantsJson: wantsJson,
  setSessionCookie: setSessionCookie,
  clearSessionCookie: clearSessionCookie,
  deepLink: deepLink,
  getUserById: getUserById,
  getUserByEmail: getUserByEmail,
  getUserByGoogleId: getUserByGoogleId,
  touchLogin: touchLogin,
  upsertEmailUser: upsertEmailUser,
  upsertGoogleUser: upsertGoogleUser,
  issueLoginToken: issueLoginToken,
  recentLoginTokenFor: recentLoginTokenFor,
  redeemLoginToken: redeemLoginToken,
  ensureTgLinkToken: ensureTgLinkToken,
  getUserByTgUserId: getUserByTgUserId,
  linkTelegram: linkTelegram,
  unlinkTelegram: unlinkTelegram,
};
