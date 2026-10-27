'use strict';

// Sign-in via Telegram deep link for photo.dimazvali.com (used to gate the full-archive download).
//
//   1. the page asks for a token: create() stores { status: 'pending' } in Firestore and returns
//      https://t.me/<bot>?start=photodl_<token>; the browser also gets the token in a signed cookie
//   2. the visitor presses Start in @dimazvalibot; the bot webhook (routes/dimazvali.js) calls
//      confirm() with the Telegram user → status 'ok'
//   3. the page polls; claim() hands out the Telegram user once and deletes the token
//
// The token alone is not enough to sign in: claim() only runs for the browser holding it in a signed
// cookie, so a forwarded/leaked link signs in nobody but the person who pressed Start and that browser.
// Firestore is shared: the bot and the photo site are separate firebase apps of the same project.

var crypto = require('crypto');

var COL = 'photoTgLogins';
var TTL_MS = 10 * 60 * 1000;
var START_PREFIX = 'photodl_';
var TOKEN_RE = /^[a-f0-9]{32}$/;

function botName() {
  return process.env.PHOTO_TG_BOT || 'dimazvalibot';
}

function deepLink(token) {
  return 'https://t.me/' + botName() + '?start=' + START_PREFIX + token;
}

// "/start photodl_<token>" → token, anything else → null
function tokenFromStart(text) {
  var m = /^\/start\s+photodl_([a-f0-9]{32})$/.exec(String(text || '').trim());
  return m ? m[1] : null;
}

async function create(db, meta) {
  var token = crypto.randomBytes(16).toString('hex');
  await db.collection(COL).doc(token).set(Object.assign({ status: 'pending', createdAt: Date.now() }, meta || {}));
  return { token: token, link: deepLink(token) };
}

// Bot side. from = Telegram message.from. → the stored doc (meta like the shoot slug), or null when unknown/expired.
async function confirm(db, token, from, now) {
  if (!TOKEN_RE.test(token || '') || !from || !from.id) return null;
  var ref = db.collection(COL).doc(token);
  var doc = await ref.get();
  if (!doc.exists) return null;
  var d = doc.data();
  if ((now || Date.now()) - d.createdAt > TTL_MS) return null;
  var name = [from.first_name, from.last_name].filter(Boolean).join(' ') || from.username || String(from.id);
  await ref.update({ status: 'ok', tgId: String(from.id), name: name, username: from.username || null, confirmedAt: now || Date.now() });
  return d;
}

// Site side. → { status: 'pending' } | { status: 'expired' } | { status: 'ok', user: { tgId, name, username } }
async function claim(db, token, now) {
  if (!TOKEN_RE.test(token || '')) return { status: 'expired' };
  var ref = db.collection(COL).doc(token);
  var doc = await ref.get();
  if (!doc.exists) return { status: 'expired' };
  var d = doc.data();
  if ((now || Date.now()) - d.createdAt > TTL_MS) {
    await ref.delete().catch(function() {});
    return { status: 'expired' };
  }
  if (d.status !== 'ok') return { status: 'pending' };
  await ref.delete(); // one-time
  return { status: 'ok', user: { tgId: d.tgId, name: d.name, username: d.username || null } };
}

module.exports = { create: create, confirm: confirm, claim: claim, tokenFromStart: tokenFromStart, deepLink: deepLink, TTL_MS: TTL_MS };
