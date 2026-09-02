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

module.exports = {
  init: init,
  LOGIN_TOKEN_TTL_MS: LOGIN_TOKEN_TTL_MS,
  normalizeEmail: normalizeEmail,
  safeNext: safeNext,
  sessionPayload: sessionPayload,
  sameOrigin: sameOrigin,
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
};
