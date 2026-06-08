'use strict';
var express = require('express');
var router = express.Router();
var path = require('path');
var { initializeApp, getApps, cert } = require('firebase-admin/app');
var { getFirestore } = require('firebase-admin/firestore');
var ekaData = require('../lib/eka-data');
var mailer = require('../lib/eka-mailer');

var ekaApp = getApps().find(function(a) { return a.name === 'eka'; }) || initializeApp({
  credential: cert({
    type: 'service_account',
    project_id: 'dimazvalimisc',
    private_key_id: '5eb5025afc0fe53b63f518ba071f89e7b7ce03af',
    private_key: process.env.sssGCPKey.replace(/\\n/g, '\n'),
    client_email: 'firebase-adminsdk-4iwd4@dimazvalimisc.iam.gserviceaccount.com',
    client_id: '110523994931477712119',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-4iwd4%40dimazvalimisc.iam.gserviceaccount.com',
  }),
  storageBucket: process.env.PHOTO_BUCKET,
}, 'eka');

var fb = getFirestore(ekaApp);
ekaData.init(fb);
mailer.init();

router.use('/admin', require('./eka-admin'));
router.use(express.static(path.join(__dirname, '../public')));

router.get('/', function(req, res) {
  var accept = req.headers['accept-language'] || '';
  var lang = accept.toLowerCase().indexOf('ru') === 0 ? 'ru' : 'en';
  res.redirect('/' + lang + '/');
});

router.use('/:lang(ru|en)', function(req, res, next) {
  res.locals.lang = req.params.lang;
  next();
});

// ── HOME ────────────────────────────────────────────────
router.get('/:lang(ru|en)/', async function(req, res, next) {
  var lang = req.params.lang;
  try {
    var allDirections = await ekaData.getDirections();
    var allTours = await ekaData.getTours({ publishedOnly: true, upcomingOnly: true });
    var directions = allDirections.filter(function(d) { return d.published; });
    var upcomingTours = allTours.slice(0, 5);
    res.render('eka/home', {
      lang, directions, upcomingTours,
      title: lang === 'ru' ? 'Эка Елисеева — Гид по Грузии' : 'Eka Eliseeva — Georgia Guide',
      currentPath: '/' + lang + '/',
    });
  } catch (e) { next(e); }
});

// ── DIRECTION ────────────────────────────────────────────
router.get('/:lang(ru|en)/directions/:slug', async function(req, res, next) {
  var lang = req.params.lang;
  var slug = req.params.slug;
  try {
    var direction = await ekaData.getDirectionBySlug(slug);
    if (!direction || !direction.published) return res.status(404).render('eka/error', { lang, message: 'Not found', error: {}, title: '404' });
    var tours = await ekaData.getTours({ directionId: direction.id, publishedOnly: true, upcomingOnly: true });
    var title = (lang === 'ru' ? direction.titleRu : direction.titleEn) + ' — Эка Елисеева';
    var url = 'https://eka.dimazvali.com/' + lang + '/directions/' + slug;
    res.render('eka/direction', { lang, direction, tours, title, currentPath: '/' + lang + '/directions/' + slug, ogUrl: url });
  } catch (e) { next(e); }
});

// ── TOUR ─────────────────────────────────────────────────
router.get('/:lang(ru|en)/tours/:id', async function(req, res, next) {
  var lang = req.params.lang;
  var id = req.params.id;
  try {
    var tour = await ekaData.getTour(id);
    if (!tour || !tour.published) return res.status(404).render('eka/error', { lang, message: 'Not found', error: {}, title: '404' });
    var direction = tour.directionId ? await ekaData.getDirection(tour.directionId) : null;
    var title = (lang === 'ru' ? tour.titleRu : tour.titleEn) + ' — Эка Елисеева';
    res.render('eka/tour', { lang, tour, direction, title, currentPath: '/' + lang + '/tours/' + id });
  } catch (e) { next(e); }
});

// ── ABOUT ────────────────────────────────────────────────
router.get('/:lang(ru|en)/about', function(req, res) {
  var lang = req.params.lang;
  res.render('eka/about', {
    lang,
    title: lang === 'ru' ? 'Об Эке — Гид по Грузии' : 'About Eka — Georgia Guide',
    currentPath: '/' + lang + '/about',
  });
});

// ── REQUEST SENT ─────────────────────────────────────────
router.get('/:lang(ru|en)/request-sent', function(req, res) {
  var lang = req.params.lang;
  var err = req.query.err;
  res.render('eka/request-sent', {
    lang, err,
    title: lang === 'ru' ? 'Заявка отправлена' : 'Request sent',
  });
});

// ── POST REQUEST ─────────────────────────────────────────
router.post('/:lang(ru|en)/request', express.urlencoded({ extended: false }), async function(req, res, next) {
  var lang = req.params.lang;
  var b = req.body;
  var name = (b.name || '').trim();
  var contact = (b.contact || '').trim();
  if (!name || !contact) return res.redirect('/' + lang + '/request-sent?err=1');
  try {
    var data = {
      type: b.type || 'direction',
      tourId: b.tourId || null,
      directionId: b.directionId || null,
      directionSlug: b.directionSlug || null,
      tourTitle: b.tourTitle || null,
      name: name,
      contactType: b.contactType || 'email',
      contact: contact,
      preferredDates: (b.preferredDates || '').trim(),
      message: (b.message || '').trim(),
      lang: lang,
    };
    await ekaData.saveRequest(data);
    mailer.sendRequestNotification(data).catch(function(e) { console.error('[eka-mailer]', e.message); });
    res.redirect('/' + lang + '/request-sent');
  } catch (e) { next(e); }
});

module.exports = router;
