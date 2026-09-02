'use strict';
var express = require('express');
var router = express.Router();
var { OAuth2Client } = require('google-auth-library');
var users = require('../lib/tbilisi-events-users');
var mailer = require('../lib/tbilisi-events-mailer');
var i18n = require('../lib/tbilisi-events-i18n');
var eventsData = require('../lib/tbilisi-events-data');
var teNotify = require('../lib/tbilisi-events-notify');
var taxonomy = require('../lib/tbilisi-events-taxonomy');

function escapeHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// scheme+host for links inside emails; the mount path is appended per-request.
var BASE_ORIGIN = process.env.TBILISI_EVENTS_BASE_URL || 'https://events.tbiliseli.com';

var _google = null;
function googleClient() {
  if (!_google) _google = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  return _google;
}

// req.teBase / res.locals.base / attachUser are already applied by the parent
// router in routes/tbilisi-events.js.
// These account pages are per-user — never shared-cache. Scope this to the
// router's own paths: the router is mounted path-less, so this middleware also
// sees pass-through public requests, whose Cache-Control the parent set.
router.use(function(req, res, next) {
  if (/^\/(login|auth|me|suggest)(\/|$)/.test(req.path)) res.set('Cache-Control', 'private, no-cache');
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
  // The magic link always lands on the subdomain; drop a legacy path-mount prefix
  // so `next` resolves there after redeem.
  var nextPath = users.safeNext(req.body.next, req.teBase + '/').replace(/^\/tbilisi-events(?=\/|$)/, '') || '/';
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

function isHttpUrl(u) { return typeof u === 'string' && /^https?:\/\//i.test(u.trim()); }

router.get('/suggest', users.requireUser, function(req, res) {
  var lang = i18n.normalizeLang(req.query.lang);
  res.render('tbilisi-events/suggest', {
    title: 'Suggest an event — events.tbiliseli.com',
    lang: lang, t: i18n.UI[lang], base: req.teBase,
    typeSlugs: taxonomy.EVENT_TYPE_SLUGS, typeLabels: i18n.EVENT_TYPE_LABELS[lang] || i18n.EVENT_TYPE_LABELS.en,
    error: null, values: {},
  });
});

router.post('/suggest', users.requireUser, guardCsrf, express.urlencoded({ extended: false }), async function(req, res, next) {
  var lang = i18n.normalizeLang(req.body.lang);
  var b = req.body;
  var values = { title: (b.title || '').trim(), date: (b.date || '').trim(), time: (b.time || '').trim(), place: (b.place || '').trim(), type: b.type || '', description: (b.description || '').trim(), url: (b.url || '').trim(), imageSourceUrl: (b.imageSourceUrl || '').trim(), contactNote: (b.contactNote || '').trim() };
  var bad = function(msg) {
    res.render('tbilisi-events/suggest', { title: 'Suggest an event', lang: lang, t: i18n.UI[lang], base: req.teBase, typeSlugs: taxonomy.EVENT_TYPE_SLUGS, typeLabels: i18n.EVENT_TYPE_LABELS[lang] || i18n.EVENT_TYPE_LABELS.en, error: msg, values: values });
  };
  if (!values.title || !values.date || !values.description) return bad('Title, date and description are required.');
  if (values.url && !isHttpUrl(values.url)) return bad('The link must start with http:// or https://.');
  if (values.imageSourceUrl && !isHttpUrl(values.imageSourceUrl)) return bad('The image URL must start with http:// or https://.');
  try {
    if (await eventsData.countSubmissionsByUser(res.locals.user.uid) >= 5) return bad('You already have 5 events awaiting review. Please wait for those first.');
    var id = await eventsData.insertSubmission({
      userId: res.locals.user.uid,
      title: values.title, date: values.date, time: values.time, place: values.place,
      type: taxonomy.isValidEventType(values.type) ? values.type : null,
      description: values.description, url: values.url || null, imageSourceUrl: values.imageSourceUrl || null,
      contactNote: values.contactNote || null,
    });
    var adminLink = 'https://events.tbiliseli.com' + '/tbilisi-events/admin/events/' + id + '/edit';
    teNotify.notifyAdmins('📥 <b>Новая заявка на событие</b>\n' + escapeHtml(values.title) + '\nот ' + escapeHtml(res.locals.user.email) + '\n<a href="' + adminLink + '">Открыть</a>');
    res.redirect(req.teBase + '/suggest/thanks');
  } catch (e) { next(e); }
});

router.get('/suggest/thanks', users.requireUser, async function(req, res, next) {
  try {
    var lang = i18n.normalizeLang(req.query.lang);
    var u = await users.getUserById(res.locals.user.uid);
    var tg = u ? await users.ensureTgLinkToken(u.id) : { linked: true };
    res.render('tbilisi-events/suggest-thanks', {
      title: 'Thank you', lang: lang, t: i18n.UI[lang], base: req.teBase,
      tgDeepLink: (tg && tg.token) ? users.deepLink(tg.token) : null,
    });
  } catch (e) { next(e); }
});

module.exports = router;
