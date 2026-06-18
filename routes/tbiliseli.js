'use strict';
var express = require('express');
var router = express.Router();
var path = require('path');
var { getApps, initializeApp, cert } = require('firebase-admin/app');
var { getFirestore } = require('firebase-admin/firestore');
var { getStorage } = require('firebase-admin/storage');
var ekaData = require('../lib/eka-data');
var mailer = require('../lib/eka-mailer');
var ekaNotify = require('../lib/eka-notify');
var ekaBot = require('../lib/eka-bot');

var ekaApp = getApps().find(function(a) { return a.name === 'eka'; }) || initializeApp({
  credential: cert({
    type: 'service_account',
    project_id: 'dimazvalimisc',
    private_key_id: '5eb5025afc0fe53b63f518ba071f89e7b7ce03af',
    private_key: (process.env.sssGCPKey || '').replace(/\\n/g, '\n'),
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
ekaNotify.init(fb);
ekaBot.init(fb, process.env.EKA_BOT_TOKEN, getStorage(ekaApp).bucket());
if (process.env.develop !== 'true' && process.env.EKA_BOT_TOKEN && process.env.EKA_BOT_WEBHOOK_URL) {
  ekaBot.setWebhook(process.env.EKA_BOT_WEBHOOK_URL)
    .then(function(r) { console.log('[eka-bot] webhook set:', r.description); })
    .catch(function(e) { console.error('[eka-bot] setWebhook failed:', e.message); });
}

async function sendToursReply(msg) {
  var isRu = msg.from && (msg.from.language_code || '').startsWith('ru');
  var lang = isRu ? 'ru' : 'en';
  var siteUrl = (process.env.EKA_SITE_URL || 'https://tbiliseli.dimazvali.com').replace(/\/$/, '');
  try {
    var tours = await ekaData.getTours({ publishedOnly: true, upcomingOnly: true });
    if (!tours.length) {
      await ekaBot.sendMessage(msg.chat.id, isRu ? 'На ближайшее время туров не запланировано 🙁' : 'No upcoming tours at the moment 🙁');
      return;
    }
    for (var i = 0; i < Math.min(tours.length, 6); i++) {
      var tour = tours[i];
      var title = (isRu ? tour.titleRu : tour.titleEn) || '';
      var desc = (isRu ? tour.descRu : tour.descEn) || '';
      var tourDate = tour.date ? (tour.date.toDate ? tour.date.toDate() : new Date(tour.date)) : null;
      var dateStr = tourDate ? tourDate.toLocaleDateString(isRu ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
      var text = '<b>' + title + '</b>';
      if (dateStr) text += '\n📅 ' + dateStr;
      if (tour.price) text += '\n💰 ' + tour.price + ' ' + (tour.currency || 'USD');
      if (desc) text += '\n\n' + desc.replace(/<[^>]*>/g, '').slice(0, 280) + (desc.length > 280 ? '…' : '');
      var keyboard = { inline_keyboard: [[{ text: isRu ? '🎒 Подробнее и запись' : '🎒 Learn more & book', url: siteUrl + '/' + lang + '/tours/' + tour.id }]] };
      var images = await ekaData.getImages({ ownerId: tour.id });
      var img = images[0];
      var imgUrl = img && (img.w800 || img.w1400 || img.w400);
      if (imgUrl) {
        await ekaBot.sendMedia(msg.chat.id, 'photo', imgUrl, text, { reply_markup: keyboard }).catch(function() {
          return ekaBot.sendMessage(msg.chat.id, text, { reply_markup: keyboard });
        });
      } else {
        await ekaBot.sendMessage(msg.chat.id, text, { reply_markup: keyboard });
      }
    }
  } catch(e) {
    console.error('[bot /tours]', e.message);
    await ekaBot.sendMessage(msg.chat.id, isRu ? 'Не удалось загрузить туры 😔' : 'Could not load tours 😔').catch(function(){});
  }
}

async function forwardMediaToAdmins(msg) {
  var snap = await fb.collection('ekaAdmins').where('notify_messages', '==', true).get();
  var admins = snap.docs.map(function(d) { return d.data(); }).filter(function(a) { return a.tg_id; });
  for (var i = 0; i < admins.length; i++) {
    await ekaBot.forwardMessage(admins[i].tg_id, msg.chat.id, msg.message_id).catch(function(){});
  }
}

router.post('/bot', express.json(), function(req, res) {
  res.sendStatus(200);
  ekaBot.handleUpdate(
    req.body,
    function(fromId, fromLabel, text, rawMsg) {
      var isMedia = rawMsg && !rawMsg.text;
      if (isMedia) {
        forwardMediaToAdmins(rawMsg).catch(function(){});
      } else {
        var notifText = '💬 <b>Сообщение от подписчика</b>\n<b>От:</b> ' + fromLabel + '\n<b>Текст:</b> ' + (text.length > 1000 ? text.slice(0, 1000) + '…' : text) + '\n#user_' + fromId;
        ekaNotify.notify('messages', notifText).catch(function(){});
      }
    },
    async function(command, msg) {
      if (command === 'tours') await sendToursReply(msg);
    },
    function(user) {
      var name = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Без имени';
      var tag = user.username ? ' @' + user.username : ' id:' + user.id;
      ekaNotify.notify('messages', '🆕 <b>Новый подписчик бота</b>\n' + name + tag + '\n#user_' + user.id).catch(function(){});
    }
  ).catch(function(e) { console.error('[eka-bot webhook]', e.message); });
});

router.use('/admin', require('./eka-admin'));
router.use(express.static(path.join(__dirname, '../public')));

router.get('/', function(req, res) {
  var accept = (req.headers['accept-language'] || '').split(',')[0].trim().toLowerCase();
  var lang = accept.startsWith('ru') ? 'ru' : 'en';
  res.redirect('/' + lang + '/');
});

router.use('/:lang(ru|en)', async function(req, res, next) {
  res.locals.lang = req.params.lang;
  try { res.locals.siteProfile = await ekaData.getProfile(); } catch(e) { res.locals.siteProfile = {}; }
  try { res.locals.activeDiscounts = await ekaData.getActiveDiscounts(); } catch(e) { res.locals.activeDiscounts = []; }
  res.locals.botUsername = process.env.EKA_BOT_NAME || '';
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
    var profile = await ekaData.getProfile();
    res.render('tbiliseli/home', {
      lang, directions, upcomingTours, profile,
      title: lang === 'ru' ? 'TbiLiSELi — Туры по Тбилиси' : 'TbiLiSELi — Tbilisi Tours',
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
    if (!direction || !direction.published) return res.status(404).render('tbiliseli/error', { lang, message: 'Not found', error: {}, title: '404' });
    var tours = await ekaData.getTours({ directionId: direction.id, publishedOnly: true, upcomingOnly: true });
    var individualTours = await ekaData.getTours({ directionId: direction.id, publishedOnly: true, individualOnly: true });
    var allDirectionTours = await ekaData.getTours({ directionId: direction.id });
    var directionTourIds = allDirectionTours.map(function(t) { return t.id; });
    var reviews = await ekaData.getReviews({ publishedOnly: true, directionId: direction.id, tourIds: directionTourIds });
    var images = await ekaData.getImages({ ownerId: direction.id });
    var attractions = await ekaData.getAttractions({ directionId: direction.id, publishedOnly: true });
    var attrHeroes = await Promise.all(attractions.map(function(a) { return ekaData.getImages({ ownerId: a.id, role: 'hero' }); }));
    attractions.forEach(function(a, i) { a.heroImg = attrHeroes[i][0] || null; });
    var title = (lang === 'ru' ? direction.titleRu : direction.titleEn) + ' — TbiLiSELi';
    var url = 'https://tbiliseli.dimazvali.com/' + lang + '/directions/' + slug;
    res.render('tbiliseli/direction', { lang, direction, tours, individualTours, reviews, images, attractions, title, currentPath: '/' + lang + '/directions/' + slug, ogUrl: url });
  } catch (e) { next(e); }
});

// ── ATTRACTION ───────────────────────────────────────────
router.get('/:lang(ru|en)/attractions/:slug', async function(req, res, next) {
  var lang = req.params.lang;
  try {
    var attraction = await ekaData.getAttractionBySlug(req.params.slug) || await ekaData.getAttraction(req.params.slug);
    if (!attraction || !attraction.published) return res.status(404).render('tbiliseli/error', { lang, message: 'Not found', error: {}, title: '404' });
    var images = await ekaData.getImages({ ownerId: attraction.id });
    var direction = attraction.directionId ? await ekaData.getDirection(attraction.directionId) : null;
    var title = (lang === 'ru' ? attraction.titleRu : attraction.titleEn) + ' — TbiLiSELi';
    var url = 'https://tbiliseli.dimazvali.com/' + lang + '/attractions/' + req.params.slug;
    res.render('tbiliseli/attraction', { lang, attraction, images, direction, title, currentPath: req.path, ogUrl: url });
  } catch (e) { next(e); }
});

// ── TOUR ─────────────────────────────────────────────────
router.get('/:lang(ru|en)/tours/:id', async function(req, res, next) {
  var lang = req.params.lang;
  var id = req.params.id;
  try {
    var tour = await ekaData.getTour(id);
    if (!tour || !tour.published) return res.status(404).render('tbiliseli/error', { lang, message: 'Not found', error: {}, title: '404' });
    var direction = tour.directionId ? await ekaData.getDirection(tour.directionId) : null;
    var bookedCount = tour.maxParticipants ? await ekaData.getBookedCount(id) : 0;
    var remainingSpots = tour.maxParticipants ? Math.max(0, tour.maxParticipants - bookedCount) : null;
    var title = (lang === 'ru' ? tour.titleRu : tour.titleEn) + ' — TbiLiSELi';
    res.render('tbiliseli/tour', { lang, tour, direction, remainingSpots, title, currentPath: '/' + lang + '/tours/' + id });
  } catch (e) { next(e); }
});

// ── ABOUT ────────────────────────────────────────────────
router.get('/:lang(ru|en)/about', async function(req, res, next) {
  try {
    var lang = req.params.lang;
    var profile = await ekaData.getProfile();
    res.render('tbiliseli/about', {
      lang,
      profile,
      title: lang === 'ru' ? 'О гиде — TbiLiSELi' : 'About — TbiLiSELi',
      currentPath: '/' + lang + '/about',
    });
  } catch (e) { next(e); }
});

// ── REQUEST SENT ─────────────────────────────────────────
router.get('/:lang(ru|en)/request-sent', function(req, res) {
  var lang = req.params.lang;
  var err = req.query.err;
  res.render('tbiliseli/request-sent', {
    lang, err,
    title: lang === 'ru' ? 'Заявка отправлена' : 'Request sent',
  });
});

// ── TICKET ───────────────────────────────────────────────
router.get('/:lang(ru|en)/ticket/:requestId', async function(req, res, next) {
  var lang = req.params.lang;
  try {
    var booking = await ekaData.getRequest(req.params.requestId);
    if (!booking) return res.status(404).render('tbiliseli/error', { lang, message: 'Бронь не найдена', error: {}, title: '404' });
    var tour = booking.tourId ? await ekaData.getTour(booking.tourId) : null;
    var direction = tour && tour.directionId ? await ekaData.getDirection(tour.directionId) : null;
    var cost = tour && tour.price && booking.participants ? tour.price * booking.participants : null;
    var tourDate = tour && tour.date ? (tour.date.toDate ? tour.date.toDate() : new Date(tour.date)) : null;
    var isCancelled = booking.status === 'declined' || booking.status === 'cancelled';
    res.render('tbiliseli/ticket', {
      lang, booking, tour, direction, cost, tourDate, isCancelled,
      botUsername: process.env.EKA_BOT_NAME || '',
      asked: req.query.asked === '1',
      reviewed: req.query.reviewed === '1',
      title: (function() {
        var tourTitle = tour ? (lang === 'ru' ? tour.titleRu : tour.titleEn) : null;
        var dateStr = tourDate ? tourDate.toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'long' }) : null;
        var parts = [tourTitle, dateStr].filter(Boolean);
        return (parts.length ? parts.join(', ') : (lang === 'ru' ? 'Ваш тур' : 'Your tour')) + ' — TbiLiSELi';
      })(),
    });
  } catch (e) { next(e); }
});

router.post('/:lang(ru|en)/ticket/:requestId/question', express.urlencoded({ extended: false }), async function(req, res, next) {
  var lang = req.params.lang;
  try {
    var booking = await ekaData.getRequest(req.params.requestId);
    if (!booking) return res.status(404).render('tbiliseli/error', { lang, message: 'Бронь не найдена', error: {}, title: '404' });
    var text = (req.body.questionText || '').trim();
    if (text) {
      await ekaData.updateRequest(req.params.requestId, { questionText: text, questionSentAt: new Date() });
      var tour = booking.tourId ? await ekaData.getTour(booking.tourId) : null;
      var tourTitle = tour ? (tour.titleRu || tour.titleEn || '') : '';
      mailer.sendQuestionNotification(booking, text, tourTitle).catch(function(e) { console.error('[tbiliseli-mailer question]', e.message); });
      var notifQuestion = text.length > 1000 ? text.slice(0, 1000) + '…' : text;
      var notifText = '❓ <b>Вопрос от участника</b>\n<b>Имя:</b> ' + (booking.name || '?') + (tourTitle ? '\n<b>Тур:</b> ' + tourTitle : '') + '\n<b>Вопрос:</b> ' + notifQuestion;
      ekaNotify.notify('messages', notifText).catch(function(){});
    }
    res.redirect('/' + lang + '/ticket/' + req.params.requestId + '?asked=1');
  } catch (e) { next(e); }
});

router.post('/:lang(ru|en)/ticket/:requestId/review', express.urlencoded({ extended: false }), async function(req, res, next) {
  var lang = req.params.lang;
  try {
    var booking = await ekaData.getRequest(req.params.requestId);
    if (!booking) return res.status(404).render('tbiliseli/error', { lang, message: 'Бронь не найдена', error: {}, title: '404' });
    var text = (req.body.reviewText || '').trim();
    if (text) {
      await ekaData.updateRequest(req.params.requestId, { reviewText: text, reviewPublished: false });
    }
    res.redirect('/' + lang + '/ticket/' + req.params.requestId + '?reviewed=1');
  } catch (e) { next(e); }
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
      participants: parseInt(b.participants, 10) || 1,
      preferredDates: (b.preferredDates || '').trim(),
      message: (b.message || '').trim(),
      lang: lang,
      utm: {
        source: (b.utm_source || '').trim(),
        medium: (b.utm_medium || '').trim(),
        campaign: (b.utm_campaign || '').trim(),
        content: (b.utm_content || '').trim(),
        term: (b.utm_term || '').trim(),
      },
    };
    var requestId = await ekaData.saveRequest(data);
    mailer.sendRequestNotification(data).catch(function(e) { console.error('[tbiliseli-mailer]', e.message); });
    var isTourBooking = data.type === 'tour' && data.tourId;
    res.redirect(isTourBooking ? '/' + lang + '/ticket/' + requestId : '/' + lang + '/request-sent');
  } catch (e) { next(e); }
});

module.exports = router;
