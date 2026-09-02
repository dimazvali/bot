'use strict';
var express = require('express');
var router = express.Router();
var { OAuth2Client } = require('google-auth-library');
var users = require('../lib/tbilisi-events-users');
var mailer = require('../lib/tbilisi-events-mailer');
var i18n = require('../lib/tbilisi-events-i18n');

// scheme+host for links inside emails; the mount path is appended per-request.
var BASE_ORIGIN = process.env.TBILISI_EVENTS_BASE_URL || 'https://events.tbiliseli.com';

var _google = null;
function googleClient() {
  if (!_google) _google = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  return _google;
}

// req.teBase / res.locals.base / attachUser are already applied by the parent
// router in routes/tbilisi-events.js. These pages are per-user — never shared-cache.
router.use(function(req, res, next) {
  res.set('Cache-Control', 'private, no-cache');
  next();
});

function guardCsrf(req, res, next) {
  if (!users.sameOrigin(req)) return res.status(403).send('bad origin');
  next();
}

router.get('/login', function(req, res) {
  var lang = i18n.normalizeLang(req.query.lang);
  res.render('tbilisi-events/login', {
    title: 'Sign in — events.tbiliseli.com',
    lang: lang,
    t: i18n.UI[lang],
    base: req.teBase,
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    next: users.safeNext(req.query.next, req.teBase + '/'),
    error: req.query.error || null,
  });
});

router.post('/auth/google', express.json(), guardCsrf, async function(req, res) {
  var credential = req.body && req.body.credential;
  var lang = i18n.normalizeLang(req.body && req.body.lang);
  if (!credential) return res.status(400).json({ ok: false });
  try {
    var ticket = await googleClient().verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    var p = ticket.getPayload();
    if (!p.email || !p.email_verified) return res.status(401).json({ ok: false });
    var user = await users.upsertGoogleUser({ sub: p.sub, email: p.email, name: p.name, picture: p.picture, lang: lang });
    users.setSessionCookie(res, user);
    res.json({ ok: true, next: users.safeNext(req.body && req.body.next, req.teBase + '/') });
  } catch (e) {
    console.error('[te-account] google', e.message);
    res.status(401).json({ ok: false });
  }
});

router.post('/auth/email', guardCsrf, async function(req, res) {
  var lang = i18n.normalizeLang(req.body.lang);
  var email = users.normalizeEmail(req.body.email);
  var nextPath = users.safeNext(req.body.next, req.teBase + '/');
  var okView = function() {
    res.render('tbilisi-events/check-email', { title: 'Check your email', lang: lang, t: i18n.UI[lang], base: req.teBase, email: email });
  };
  if (!email || email.indexOf('@') === -1) return okView();
  users.recentLoginTokenFor(email).then(function(recent) {
    if (recent) return;
    return users.issueLoginToken(email, nextPath).then(function(token) {
      return mailer.sendMagicLink(email, BASE_ORIGIN + '/auth/magic?token=' + token, lang);
    });
  }).catch(function(e) { console.error('[te-account] email', e.message); });
  okView();
});

router.get('/auth/magic', function(req, res) {
  // Corporate mail scanners GET links before the human clicks; render a confirm
  // page whose button POSTs the token, so a bare GET can't consume it.
  res.render('tbilisi-events/magic-confirm', {
    title: 'Confirm sign-in', lang: i18n.normalizeLang(req.query.lang),
    t: i18n.UI[i18n.normalizeLang(req.query.lang)], base: req.teBase,
    token: String(req.query.token || ''),
  });
});

router.post('/auth/magic', guardCsrf, async function(req, res) {
  var lang = i18n.normalizeLang(req.body.lang);
  try {
    var result = await users.redeemLoginToken(req.body.token);
    if (!result.ok) return res.redirect(req.teBase + '/login?error=' + encodeURIComponent(result.reason));
    var user = await users.upsertEmailUser(result.email, lang);
    users.setSessionCookie(res, user);
    res.redirect(users.safeNext(result.next, req.teBase + '/'));
  } catch (e) {
    console.error('[te-account] magic', e.message);
    res.redirect(req.teBase + '/login?error=server');
  }
});

router.post('/auth/logout', guardCsrf, function(req, res) {
  users.clearSessionCookie(res);
  res.redirect(users.safeNext(req.body.next, req.teBase + '/'));
});

router.get('/me', users.requireUser, async function(req, res, next) {
  try {
    var lang = i18n.normalizeLang(req.query.lang);
    var user = await users.getUserById(res.locals.user.uid);
    if (!user) { users.clearSessionCookie(res); return res.redirect(req.teBase + '/login'); }
    var tg = await users.ensureTgLinkToken(user.id);
    res.render('tbilisi-events/me', {
      title: 'Your account — events.tbiliseli.com',
      lang: lang, t: i18n.UI[lang], base: req.teBase,
      user: user,
      tgLinked: !!user.tgUserId,
      tgBlocked: !!user.tgBlocked,
      tgDeepLink: tg.token ? users.deepLink(tg.token) : null,
    });
  } catch (e) { console.error('[te-account] me', e.message); next(e); }
});

router.post('/me/telegram/unlink', users.requireUser, guardCsrf, async function(req, res, next) {
  try {
    await users.unlinkTelegram(res.locals.user.uid);
    res.redirect(req.teBase + '/me');
  } catch (e) { console.error('[te-account] unlink', e.message); next(e); }
});

module.exports = router;
