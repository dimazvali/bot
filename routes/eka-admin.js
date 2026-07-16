'use strict';
var express = require('express');
var router = express.Router();
var path = require('path');
var fs = require('fs');
var crypto = require('crypto');
var multer = require('multer');
var sharp = require('sharp');
var QRCode = require('qrcode');
var sanitizeHtml = require('sanitize-html');
var { getApps } = require('firebase-admin/app');
var { getFirestore } = require('firebase-admin/firestore');
var { getStorage } = require('firebase-admin/storage');
var ekaData = require('../lib/eka-data');
var ekaNotify = require('../lib/eka-notify');

// eka Firebase app initialized by eka.js (loaded first via router.use('/admin', ...))
var ekaApp = getApps().find(function(a) { return a.name === 'eka'; });
if (!ekaApp) throw new Error('eka-admin: Firebase "eka" app not initialized — load eka.js first');
var fb = getFirestore(ekaApp);
var bucket = getStorage(ekaApp).bucket();
var adminTokens = fb.collection('ekaAdminTokens');
var ekaAdmins = fb.collection('ekaAdmins');
ekaNotify.init(fb);
function cookieToken(pass) {
  return crypto.createHash('sha256').update('eka:' + pass).digest('hex');
}

function sanitizeDesc(html) {
  return sanitizeHtml(html || '', {
    allowedTags: ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 'a', 'ul', 'ol', 'li', 'h3', 'h4'],
    allowedAttributes: { a: ['href'], p: ['class'], h3: ['class'], h4: ['class'], li: ['class'] },
    allowedClasses: { p: ['tour-accent'], h3: ['tour-accent'], h4: ['tour-accent'], li: ['tour-accent'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: { a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }) },
  }).trim();
}

var upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: function(req, file, cb) {
    if (!file.mimetype.startsWith('image/') && !file.mimetype.startsWith('audio/')) return cb(new Error('Images and audio only'));
    cb(null, true);
  },
});

// ── IMAGE UPLOAD HELPER ─────────────────────────────────
var SIZES = [400, 800, 1400, 2400];

async function uploadImageSizes(buffer, storagePath) {
  var urls = {};
  await Promise.all(SIZES.map(async function(w) {
    var webp = await sharp(buffer).resize(w, null, { withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
    var file = bucket.file(storagePath.replace('{w}', w));
    await file.save(webp, { metadata: { contentType: 'image/webp' } });
    await file.makePublic();
    urls['w' + w] = 'https://storage.googleapis.com/' + bucket.name + '/' + file.name;
  }));
  return urls; // { w400, w800, w1400, w2400 }
}

async function resizeBotPhoto(buffer, name) {
  var webp = await sharp(buffer).resize(1280, null, { withoutEnlargement: true }).webp({ quality: 88 }).toBuffer();
  var dest = bucket.file('bot/' + name + '.webp');
  await dest.save(webp, { metadata: { contentType: 'image/webp' }, public: true });
  await dest.makePublic();
  return 'https://storage.googleapis.com/' + bucket.name + '/' + dest.name;
}

// ── AUTH ────────────────────────────────────────────────
async function requireAuth(req, res, next) {
  var val = req.cookies && req.cookies.ekaAdminToken;
  if (!val) return res.redirect('/admin/login');
  var envPass = process.env.EKA_ADMIN_PASS;
  if (envPass && val === cookieToken(envPass)) {
    res.locals.adminName = 'admin';
    res.locals.adminId = null;
    res.locals.isSuperadmin = true;
    return next();
  }
  try {
    var snap = await ekaAdmins.where('password_hash', '==', val).limit(1).get();
    if (!snap.empty) {
      var d = snap.docs[0];
      res.locals.adminName = d.data().name || 'admin';
      res.locals.adminId = d.id;
      res.locals.isSuperadmin = !!d.data().superadmin;
      return next();
    }
  } catch(e) {}
  res.redirect('/admin/login');
}

function requireSuperAdmin(req, res, next) {
  if (res.locals.isSuperadmin) return next();
  res.status(403).send('Доступ запрещён — только для суперадминистратора');
}

router.get('/login', function(req, res) {
  res.render('eka/admin/login', { title: 'Вход — Eka Admin', error: null });
});

router.post('/login', express.urlencoded({ extended: false }), async function(req, res) {
  var pass = (req.body.pass || '').trim();
  if (!pass) return res.render('eka/admin/login', { title: 'Вход — Eka Admin', error: 'Введите пароль' });
  var hash = cookieToken(pass);
  var envPass = process.env.EKA_ADMIN_PASS;
  var ok = !!(envPass && pass === envPass);
  if (!ok) {
    try {
      var snap = await ekaAdmins.where('password_hash', '==', hash).limit(1).get();
      ok = !snap.empty;
    } catch(e) {}
  }
  if (!ok) return res.render('eka/admin/login', { title: 'Вход — Eka Admin', error: 'Неверный пароль' });
  res.cookie('ekaAdminToken', hash, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 });
  res.redirect('/admin/');
});

router.get('/logout', function(req, res) {
  res.clearCookie('ekaAdminToken');
  res.redirect('/admin/login');
});

// ── DASHBOARD ───────────────────────────────────────────
router.get('/', requireAuth, async function(req, res, next) {
  try {
    var newRequests = await ekaData.getRequests({ status: 'new' });
    var tours = await ekaData.getTours({ publishedOnly: true, upcomingOnly: true });
    res.render('eka/admin/index', {
      title: 'Eka Admin',
      newRequestCount: newRequests.length,
      upcomingTours: tours.slice(0, 5),
    });
  } catch (e) { next(e); }
});

// ── DIRECTIONS ──────────────────────────────────────────
router.get('/directions', requireAuth, async function(req, res, next) {
  try {
    var directions = await ekaData.getDirections();
    var allTours = await ekaData.getTours({});
    var tourCount = {};
    allTours.forEach(function(t) { tourCount[t.directionId] = (tourCount[t.directionId] || 0) + 1; });
    res.render('eka/admin/directions', { title: 'Направления — Eka Admin', directions: directions, tourCount: tourCount });
  } catch (e) { next(e); }
});

router.post('/directions/reorder', requireAuth, express.json(), async function(req, res, next) {
  try {
    var ids = req.body.ids;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids required' });
    await ekaData.reorderDirections(ids);
    res.json({ ok: true });
  } catch(e) { next(e); }
});

router.get('/directions/new', requireAuth, function(req, res) {
  res.render('eka/admin/direction-edit', { title: 'Новое направление', direction: null, directionId: null, error: null });
});

router.get('/directions/:id/edit', requireAuth, async function(req, res, next) {
  try {
    var direction = await ekaData.getDirection(req.params.id);
    if (!direction) return res.redirect('/admin/directions');
    var images = await ekaData.getImages({ ownerId: req.params.id });
    res.render('eka/admin/direction-edit', { title: direction.titleRu + ' — Edit', direction: direction, directionId: req.params.id, images: images, error: null });
  } catch (e) { next(e); }
});

router.post('/directions/:id/edit', requireAuth, upload.fields([{ name: 'heroImage', maxCount: 1 }, { name: 'galleryImages', maxCount: 20 }]), async function(req, res, next) {
  var id = req.params.id === 'new' ? null : req.params.id;
  try {
    var b = req.body;
    var data = {
      slug: (b.slug || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      titleRu: b.titleRu || '', titleEn: b.titleEn || '',
      descRu: b.descRu || '', descEn: b.descEn || '',
      extraTextRu: b.extraTextRu || '', extraTextEn: b.extraTextEn || '',
      metaDurationRu: b.metaDurationRu || '', metaDurationEn: b.metaDurationEn || '',
      metaGroupSize: b.metaGroupSize || '',
      metaGroupSizeRu: b.metaGroupSizeRu || '', metaGroupSizeEn: b.metaGroupSizeEn || '',
      metaSeasonRu: b.metaSeasonRu || '', metaSeasonEn: b.metaSeasonEn || '',
      metaDistanceRu: b.metaDistanceRu || '', metaDistanceEn: b.metaDistanceEn || '',
      startName: b.startName || '', startLat: parseFloat(b.startLat) || 0, startLng: parseFloat(b.startLng) || 0,
      finishName: b.finishName || '', finishLat: parseFloat(b.finishLat) || 0, finishLng: parseFloat(b.finishLng) || 0,
      published: b.published === 'on',
    };
    if (!id) data.order = 999;

    var savedId = await ekaData.saveDirection(id, data);
    var ts = Date.now();

    // Fetch real route polyline from Google Directions API (fire-and-forget)
    if (data.startLat && data.startLng && data.finishLat && data.finishLng && process.env.GOOGLE_MAPS_API_KEY) {
      (async function () {
        try {
          var https = require('https');
          var origin = data.startLat + ',' + data.startLng;
          var dest = data.finishLat + ',' + data.finishLng;
          var url = 'https://maps.googleapis.com/maps/api/directions/json?origin=' +
            encodeURIComponent(origin) + '&destination=' + encodeURIComponent(dest) +
            '&key=' + process.env.GOOGLE_MAPS_API_KEY + '&mode=driving';
          var poly = await new Promise(function (resolve, reject) {
            https.get(url, function (res) {
              var body = '';
              res.on('data', function (c) { body += c; });
              res.on('end', function () {
                try {
                  var json = JSON.parse(body);
                  resolve(json.routes && json.routes[0] ? json.routes[0].overview_polyline.points : null);
                } catch (e) { resolve(null); }
              });
            }).on('error', reject);
          });
          if (poly) await ekaData.saveDirection(savedId, { routePolyline: poly });
        } catch (e) {
          console.error('[eka] directions API:', e.message);
        }
      })();
    }

    // Hero image → eka_images
    if (req.files && req.files.heroImage && req.files.heroImage[0]) {
      var heroSizes = await uploadImageSizes(req.files.heroImage[0].buffer, 'eka/directions/' + savedId + '/hero-' + ts + '-{w}.webp');
      var existingHeroes = await ekaData.getImages({ ownerId: savedId, role: 'hero' });
      var heroId = existingHeroes.length ? existingHeroes[0].id : null;
      await ekaData.saveImage(heroId, { ownerId: savedId, ownerType: 'direction', role: 'hero', order: 0, createdAt: new Date(), w400: heroSizes.w400, w800: heroSizes.w800, w1400: heroSizes.w1400, w2400: heroSizes.w2400 });
    }

    // Gallery images → eka_images (append)
    if (req.files && req.files.galleryImages && req.files.galleryImages.length) {
      var existingGallery = await ekaData.getImages({ ownerId: savedId, role: 'gallery' });
      var maxOrder = existingGallery.reduce(function(m, img) { return Math.max(m, img.order || 0); }, -1);
      await Promise.all(req.files.galleryImages.map(async function(f, i) {
        var sizes = await uploadImageSizes(f.buffer, 'eka/directions/' + savedId + '/gallery-' + ts + '-' + i + '-{w}.webp');
        return ekaData.saveImage(null, { ownerId: savedId, ownerType: 'direction', role: 'gallery', order: maxOrder + 1 + i, createdAt: new Date(), w400: sizes.w400, w800: sizes.w800, w1400: sizes.w1400, w2400: sizes.w2400 });
      }));
    }

    res.redirect('/admin/directions/' + savedId + '/edit');
  } catch (e) { next(e); }
});

router.post('/directions/:id/delete', requireAuth, async function(req, res, next) {
  try { await ekaData.deleteDirection(req.params.id); res.redirect('/admin/directions'); } catch (e) { next(e); }
});

// ── IMAGE REORDER ────────────────────────────────────────
router.post('/images/reorder', requireAuth, express.json(), async function(req, res, next) {
  try {
    var ids = req.body.ids;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids required' });
    await ekaData.reorderImages(ids);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── IMAGE CAPTION ────────────────────────────────────────
router.post('/images/:imageId/caption', requireAuth, express.json(), async function(req, res, next) {
  try {
    await ekaData.saveImage(req.params.imageId, { caption: req.body.caption || '' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── IMAGE DELETE ─────────────────────────────────────────
router.post('/images/:imageId/delete', requireAuth, express.urlencoded({ extended: false }), async function(req, res, next) {
  try {
    await ekaData.deleteImage(req.params.imageId);
    var back = req.body.backUrl || (req.body.back ? '/admin/directions/' + req.body.back + '/edit' : '/admin/directions');
    res.redirect(back);
  } catch (e) { next(e); }
});

// ── TOURS ────────────────────────────────────────────────
router.get('/tours', requireAuth, async function(req, res, next) {
  try {
    var tours = await ekaData.getTours({});
    var directions = await ekaData.getDirections();
    var dirMap = {};
    directions.forEach(function(d) { dirMap[d.id] = d; });
    res.render('eka/admin/tours', { title: 'Туры — Eka Admin', tours: tours, dirMap: dirMap });
  } catch (e) { next(e); }
});

router.get('/tours/new', requireAuth, async function(req, res, next) {
  try {
    var directions = await ekaData.getDirections();
    var galleries = await ekaData.getGalleries();
    res.render('eka/admin/tour-edit', { title: 'Новый тур', tour: null, tourId: null, directions: directions, galleries: galleries, clients: [], clientMap: {}, error: null });
  } catch (e) { next(e); }
});

router.get('/tours/:id/edit', requireAuth, async function(req, res, next) {
  try {
    var tour = await ekaData.getTour(req.params.id);
    if (!tour) return res.redirect('/admin/tours');
    var directions = await ekaData.getDirections();
    var galleries = await ekaData.getGalleries();
    var requests = await ekaData.getRequests({ tourId: req.params.id });
    var clients = await ekaData.getClients();
    var clientMap = {};
    clients.forEach(function(c) { clientMap[c.id] = c; });
    res.render('eka/admin/tour-edit', { title: (tour.titleRu || '') + ' — Edit', tour: tour, tourId: req.params.id, directions: directions, galleries: galleries, requests: requests, clients: clients, clientMap: clientMap, error: null, guestsSent: req.query.guests_sent, guestsError: req.query.guests_error });
  } catch (e) { next(e); }
});

router.post('/tours/:id/message-guests', requireAuth, upload.single('photo'), async function(req, res, next) {
  try {
    var text = (req.body.text || '').trim();
    if (!text) return res.redirect('/admin/tours/' + req.params.id + '/edit?guests_error=empty');
    var requests = await ekaData.getRequests({ tourId: req.params.id });
    var seen = {};
    var targets = requests.filter(function(r) {
      if (!r.tg_user_id || r.status === 'declined' || r.status === 'cancelled') return false;
      if (seen[r.tg_user_id]) return false;
      seen[r.tg_user_id] = true;
      return true;
    });
    var photoUrl = null;
    if (req.file) {
      photoUrl = await resizeBotPhoto(req.file.buffer, 'tour_msg_' + req.params.id + '_' + Date.now());
    }
    var count = 0;
    for (var i = 0; i < targets.length; i++) {
      try {
        if (photoUrl) {
          await ekaBot.sendMedia(targets[i].tg_user_id, 'photo', photoUrl, text);
        } else {
          await ekaBot.sendMessage(targets[i].tg_user_id, text);
        }
        count++;
      } catch(e) {}
      if (i < targets.length - 1) await new Promise(function(r) { setTimeout(r, 50); });
    }
    res.redirect('/admin/tours/' + req.params.id + '/edit?guests_sent=' + count);
  } catch(e) { next(e); }
});

router.post('/tours/:id/edit', requireAuth, express.urlencoded({ extended: false }), async function(req, res, next) {
  var id = req.params.id === 'new' ? null : req.params.id;
  try {
    var b = req.body;
    var direction = b.directionId ? await ekaData.getDirection(b.directionId) : null;
    var isIndividual = b.tourType === 'individual';
    var data = {
      tourType: isIndividual ? 'individual' : 'group',
      directionId: b.directionId || null,
      directionSlug: direction ? direction.slug : null,
      titleRu: b.titleRu || '', titleEn: b.titleEn || '',
      descRu: sanitizeDesc(b.descRu), descEn: sanitizeDesc(b.descEn),
      date: (!isIndividual && b.date) ? new Date(b.date) : null,
      durationRu: b.durationRu || '', durationEn: b.durationEn || '',
      price: b.price ? (parseInt(b.price, 10) || 0) : 0,
      currency: b.currency || 'USD',
      minGroupPrice: b.minGroupPrice ? (parseInt(b.minGroupPrice, 10) || 0) : 0,
      maxParticipants: b.maxParticipants ? (parseInt(b.maxParticipants, 10) || 0) : 0,
      meetingPointRu: b.meetingPointRu || '',
      meetingPointEn: b.meetingPointEn || '',
      meetingPointLat: b.meetingPointLat ? parseFloat(b.meetingPointLat) : null,
      meetingPointLng: b.meetingPointLng ? parseFloat(b.meetingPointLng) : null,
      published: b.published === 'on',
    };
    var savedId = await ekaData.saveTour(id, data);
    res.redirect('/admin/tours/' + savedId + '/edit');
  } catch (e) { next(e); }
});

router.post('/tours/:id/copy', requireAuth, express.urlencoded({ extended: false }), async function(req, res, next) {
  try {
    var src = await ekaData.getTour(req.params.id);
    if (!src) return res.redirect('/admin/tours');
    var newDate = req.body.date ? new Date(req.body.date) : null;
    var copy = Object.assign({}, src);
    delete copy.id;
    copy.date = newDate;
    copy.published = false;
    var newId = await ekaData.saveTour(null, copy);
    res.redirect('/admin/tours/' + newId + '/edit');
  } catch (e) { next(e); }
});

router.post('/tours/:id/add-guest', requireAuth, express.urlencoded({ extended: false }), async function(req, res, next) {
  try {
    var b = req.body;
    var tour = await ekaData.getTour(req.params.id);
    if (!tour) return res.redirect('/admin/tours');
    var name = (b.name || '').trim();
    var contact = (b.contact || '').trim();
    if (!name || !contact) return res.redirect('/admin/tours/' + req.params.id + '/edit');
    await ekaData.saveRequest({
      type: 'tour',
      tourId: req.params.id,
      tourTitle: tour.titleRu || tour.titleEn || '',
      directionId: tour.directionId || null,
      directionSlug: tour.directionSlug || null,
      name: name,
      contactType: b.contactType || 'email',
      contact: contact,
      participants: parseInt(b.participants, 10) || 1,
      preferredDates: (b.preferredDates || '').trim(),
      message: (b.message || '').trim(),
      lang: 'ru',
      source: 'admin',
    });
    res.redirect('/admin/tours/' + req.params.id + '/edit');
  } catch (e) { next(e); }
});

router.post('/translate', requireAuth, express.json(), async function(req, res, next) {
  try {
    var texts = req.body && req.body.texts;
    if (!texts || !Object.keys(texts).length) return res.status(400).json({ error: 'No texts provided' });
    var Anthropic = require('@anthropic-ai/sdk');
    var apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' });
    var client = new Anthropic({ apiKey });
    var prompt = 'Translate the following Russian field values to English for a travel/tourism website about Georgia (the country in the Caucasus). Some values may contain simple HTML tags (e.g. <p>, <b>, <a href="">, <ul>, <li>) — preserve the tags and structure exactly, translate only the visible text. Return ONLY a valid JSON object with the same keys but "Ru" replaced with "En" in each key name. Be concise and natural.\n\nInput: ' + JSON.stringify(texts);
    var msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });
    var raw = msg.content[0].text.trim();
    var jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    var result;
    try {
      result = JSON.parse(jsonStr);
    } catch (parseErr) {
      return res.status(502).json({ error: 'Модель вернула некорректный ответ, попробуйте ещё раз' });
    }
    res.json(result);
  } catch (e) { next(e); }
});

router.post('/tours/:id/delete', requireAuth, async function(req, res, next) {
  try { await ekaData.deleteTour(req.params.id); res.redirect('/admin/tours'); } catch (e) { next(e); }
});

// ── REQUESTS ─────────────────────────────────────────────
var ACTIVE_STATUSES = ['new', 'contacted', 'ready'];
var ARCHIVE_STATUSES = ['declined', 'no_show', 'cancelled', 'completed'];
var ALL_STATUSES = ACTIVE_STATUSES.concat(ARCHIVE_STATUSES);

router.get('/requests', requireAuth, async function(req, res, next) {
  try {
    var filter = req.query.filter || 'active';
    var opts = filter === 'active' ? { statuses: ACTIVE_STATUSES }
             : filter === 'archive' ? { statuses: ARCHIVE_STATUSES }
             : {};
    var requests = await ekaData.getRequests(opts);
    var tours = await ekaData.getTours({});
    var tourMap = {};
    tours.forEach(function(t) { tourMap[t.id] = t; });
    var clients = await ekaData.getClients();
    var clientMap = {};
    clients.forEach(function(c) { clientMap[c.id] = c; });
    res.render('eka/admin/requests', { title: 'Заявки — Eka Admin', requests: requests, activeFilter: filter, tours: tours, tourMap: tourMap, clients: clients, clientMap: clientMap });
  } catch (e) { next(e); }
});

router.post('/requests/:id/status', requireAuth, express.urlencoded({ extended: false }), async function(req, res, next) {
  try {
    if (!ALL_STATUSES.includes(req.body.status)) return res.status(400).send('Bad status');
    var req2 = await ekaData.getRequest(req.params.id);
    await ekaData.updateRequestStatus(req.params.id, req.body.status);
    if (req2) {
      var STATUS_LABELS = { new: 'новая', contacted: 'связались', ready: 'к туру', declined: 'отказался', no_show: 'не пришел', cancelled: 'отмена', completed: 'состоялась' };
      var statusLabel = STATUS_LABELS[req.body.status] || req.body.status;
      ekaNotify.notify('updates', '✏️ <b>Статус заявки изменён</b>\n<b>Имя:</b> ' + (req2.name || '—') + '\n<b>Статус:</b> ' + statusLabel).catch(function(){});
      if (req2.tg_user_id) {
        var USER_STATUS_LABELS = { contacted: 'Мы свяжемся с вами в ближайшее время.', ready: 'Всё готово — ждём вас на туре! 🎉', declined: 'К сожалению, ваша заявка отклонена.', cancelled: 'Ваша заявка отменена.', completed: 'Спасибо, что были с нами! 🙏', no_show: null };
        var userMsg = USER_STATUS_LABELS[req.body.status];
        if (userMsg) ekaBot.sendMessage(req2.tg_user_id, '📋 <b>Обновление по вашей заявке</b>\n' + userMsg).catch(function(){});
      }
    }
    var back = req.body.back ? '/admin/tours/' + req.body.back + '/edit' : '/admin/requests';
    res.redirect(back);
  } catch (e) { next(e); }
});

router.post('/requests/:id/update', requireAuth, express.urlencoded({ extended: false }), async function(req, res, next) {
  try {
    var b = req.body;
    var update = {
      tourId: b.tourId || null,
      participants: parseInt(b.participants, 10) || 1,
      paid: b.paid === 'on',
    };
    if (typeof b.note !== 'undefined') update.note = (b.note || '').trim();
    var req2 = await ekaData.getRequest(req.params.id);
    await ekaData.updateRequest(req.params.id, update);
    if (req2) {
      var parts = [];
      parts.push('<b>Имя:</b> ' + (req2.name || '—'));
      parts.push('<b>Участников:</b> ' + update.participants);
      if (update.paid) parts.push('<b>Оплачено</b> ✓');
      if (update.note) parts.push('<b>Примечание:</b> ' + update.note);
      ekaNotify.notify('updates', '✏️ <b>Заявка обновлена</b>\n' + parts.join('\n')).catch(function(){});
    }
    var back = b.back ? '/admin/tours/' + b.back + '/edit' : '/admin/requests';
    res.redirect(back);
  } catch (e) { next(e); }
});

router.post('/requests/:id/message', requireAuth, express.urlencoded({ extended: false }), async function(req, res, next) {
  try {
    var text = (req.body.text || '').trim();
    var request = await ekaData.getRequest(req.params.id);
    if (text && request && request.tg_user_id) {
      await ekaBot.sendMessage(request.tg_user_id, text);
    }
    var back = req.body.back || '/admin/requests';
    res.redirect(back);
  } catch(e) { next(e); }
});

router.post('/requests/:id/review', requireAuth, express.urlencoded({ extended: false }), async function(req, res, next) {
  try {
    var b = req.body;
    await ekaData.updateRequest(req.params.id, {
      reviewText: (b.reviewText || '').trim(),
      reviewPublished: b.reviewPublished === 'on',
    });
    var back = b.tourId ? '/admin/tours/' + b.tourId + '/edit' : '/admin/requests';
    res.redirect(back);
  } catch (e) { next(e); }
});

// ── DISCOUNTS ─────────────────────────────────────────────
router.get('/discounts', requireAuth, async function(req, res, next) {
  try {
    var discounts = await ekaData.getDiscounts();
    res.render('eka/admin/discounts', { title: 'Скидки — Eka Admin', discounts: discounts });
  } catch (e) { next(e); }
});

router.post('/discounts/new', requireAuth, express.urlencoded({ extended: false }), async function(req, res, next) {
  try {
    var b = req.body;
    await ekaData.saveDiscount(null, {
      name: (b.name || '').trim(),
      percent: parseFloat(b.percent) || 0,
      utmCampaign: (b.utmCampaign || '').trim(),
      startDate: b.startDate ? new Date(b.startDate) : null,
      endDate: b.endDate ? new Date(b.endDate) : null,
      createdAt: new Date(),
    });
    res.redirect('/admin/discounts');
  } catch (e) { next(e); }
});

router.post('/discounts/:id/edit', requireAuth, express.urlencoded({ extended: false }), async function(req, res, next) {
  try {
    var b = req.body;
    await ekaData.saveDiscount(req.params.id, {
      name: (b.name || '').trim(),
      percent: parseFloat(b.percent) || 0,
      utmCampaign: (b.utmCampaign || '').trim(),
      startDate: b.startDate ? new Date(b.startDate) : null,
      endDate: b.endDate ? new Date(b.endDate) : null,
    });
    res.redirect('/admin/discounts');
  } catch (e) { next(e); }
});

router.post('/discounts/:id/delete', requireAuth, async function(req, res, next) {
  try {
    await ekaData.deleteDiscount(req.params.id);
    res.redirect('/admin/discounts');
  } catch (e) { next(e); }
});

// ── BOT SETTINGS ─────────────────────────────────────────
var ekaBot = require('../lib/eka-bot');
var ekaEvents = require('../lib/eka-events');

var _sseClients = new Map(); // userId -> Set<res>
ekaEvents.on('bot:message', function(data) {
  var clients = _sseClients.get(data.userId);
  if (!clients || !clients.size) return;
  var payload = 'data: ' + JSON.stringify(data.message) + '\n\n';
  clients.forEach(function(res) { res.write(payload); });
});

router.get('/bot', requireAuth, function(req, res) {
  res.redirect('/admin/bot/users');
});

router.get('/bot/messages', requireAuth, async function(req, res, next) {
  try {
    var messages = await ekaBot.getBotMessages();
    var users = await ekaBot.getUsers();
    var activeCount = users.filter(function(u) { return u.active; }).length;
    res.render('eka/admin/bot', { title: 'Бот — Eka Admin', messages: messages, totalUsers: users.length, activeUsers: activeCount, saved: req.query.saved });
  } catch(e) { next(e); }
});

var botPhotoFields = ['welcome_ru', 'welcome_en', 'return_ru', 'return_en'].map(function(k) { return { name: 'photo_' + k, maxCount: 1 }; });

router.post('/bot/messages', requireAuth, upload.fields(botPhotoFields), async function(req, res, next) {
  try {
    var existing = await ekaBot.getBotMessages();
    var data = {
      welcome_ru: (req.body.welcome_ru || '').trim(),
      welcome_en: (req.body.welcome_en || '').trim(),
      return_ru: (req.body.return_ru || '').trim(),
      return_en: (req.body.return_en || '').trim(),
    };
    var keys = ['welcome_ru', 'welcome_en', 'return_ru', 'return_en'];
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var photoKey = k + '_photo';
      if (req.body['delete_photo_' + k] === 'on') {
        data[photoKey] = null;
      } else if (req.files && req.files['photo_' + k] && req.files['photo_' + k][0]) {
        var f = req.files['photo_' + k][0];
        data[photoKey] = await resizeBotPhoto(f.buffer, 'msg_' + k);
      } else {
        data[photoKey] = existing[photoKey] || null;
      }
    }
    await ekaBot.saveBotMessages(data);
    res.redirect('/admin/bot?saved=1');
  } catch(e) { next(e); }
});

router.get('/bot/profile', requireAuth, async function(req, res, next) {
  try {
    var profile = await ekaBot.getBotProfile();
    var commandsText = profile.commands.map(function(c) { return c.command + ' - ' + c.description; }).join('\n');
    res.render('eka/admin/bot-profile', { title: 'Профиль бота — Eka Admin', profile: profile, commandsText: commandsText, saved: req.query.saved, error: req.query.error });
  } catch(e) { next(e); }
});

router.post('/bot/profile', requireAuth, async function(req, res, next) {
  try {
    var data = {
      name: (req.body.name || '').trim(),
      description: (req.body.description || '').trim(),
      short_description: (req.body.short_description || '').trim(),
    };
    var commandsRaw = (req.body.commands || '').trim();
    data.commands = commandsRaw
      ? commandsRaw.split('\n').map(function(l) { return l.trim(); }).filter(Boolean).map(function(line) {
          var sep = line.indexOf(' - ');
          return { command: line.slice(0, sep < 0 ? line.indexOf('-') : sep).trim().replace(/^\//, ''), description: line.slice((sep < 0 ? line.indexOf('-') : sep + 2) + 1).trim() };
        }).filter(function(c) { return c.command && c.description; })
      : [];
    await ekaBot.setBotProfile(data);
    res.redirect('/admin/bot/profile?saved=1');
  } catch(e) {
    var errMsg = (e.response && e.response.data && e.response.data.description) || e.message;
    console.error('[bot/profile]', errMsg);
    res.redirect('/admin/bot/profile?error=' + encodeURIComponent(errMsg));
  }
});

router.get('/bot/users/:id/stream', requireAuth, function(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (res.socket) res.socket.setNoDelay(true);
  res.flushHeaders();
  var userId = req.params.id;
  if (!_sseClients.has(userId)) _sseClients.set(userId, new Set());
  _sseClients.get(userId).add(res);
  var heartbeat = setInterval(function() { res.write(': ping\n\n'); }, 25000);
  req.on('close', function() {
    clearInterval(heartbeat);
    var s = _sseClients.get(userId);
    if (s) s.delete(res);
  });
});

router.get('/bot/users/:id', requireAuth, async function(req, res, next) {
  try {
    var userId = req.params.id;
    var userSnap = await fb.collection('eka_bot_users').doc(userId).get();
    if (!userSnap.exists) return res.redirect('/admin/bot/users');
    var user = Object.assign({ id: userId }, userSnap.data());
    var msgsSnap = await fb.collection('eka_bot_users').doc(userId).collection('messages')
      .orderBy('createdAt', 'asc').limit(200).get();
    var messages = msgsSnap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
    res.render('eka/admin/bot-user', {
      title: ([user.first_name, user.last_name].filter(Boolean).join(' ') || 'Пользователь') + ' — Бот',
      user: user, messages: messages, sent: !!req.query.sent
    });
  } catch(e) { next(e); }
});

router.get('/bot/users', requireAuth, async function(req, res, next) {
  try {
    var users = await ekaBot.getUsers();
    var clients = await ekaData.getClients();
    var clientMap = {};
    clients.forEach(function(c) { clientMap[c.id] = c; });
    res.render('eka/admin/bot-users', { title: 'Пользователи бота — Eka Admin', users: users, clients: clients, clientMap: clientMap, sent: req.query.sent });
  } catch(e) { next(e); }
});

router.post('/bot/users/:id/link-client', requireAuth, express.urlencoded({ extended: false }), async function(req, res, next) {
  try {
    var clientId = (req.body.clientId || '').trim();
    await fb.collection('eka_bot_users').doc(req.params.id).update({ client_id: clientId || null });
    res.redirect('/admin/bot/users');
  } catch(e) { next(e); }
});

router.post('/bot/users/:id/message', requireAuth, upload.single('photo'), async function(req, res, next) {
  try {
    var text = (req.body.text || '').trim();
    var chatId = req.params.id;
    var adminName = res.locals.adminName || 'admin';
    var outMsg = null;
    if (req.file) {
      var photoUrl = await resizeBotPhoto(req.file.buffer, 'msg_' + chatId + '_' + Date.now());
      await ekaBot.sendMedia(chatId, 'photo', photoUrl, text || undefined);
      outMsg = { direction: 'out', text: text || null, mediaType: 'photo', sentBy: adminName, createdAt: new Date() };
    } else if (text) {
      await ekaBot.sendMessage(chatId, text);
      outMsg = { direction: 'out', text: text, mediaType: null, sentBy: adminName, createdAt: new Date() };
    }
    if (outMsg) {
      ekaEvents.emit('bot:message', { userId: chatId, message: outMsg });
      ekaBot.saveMessage(chatId, outMsg).catch(function(){});
    }
    res.redirect('/admin/bot/users/' + chatId + '?sent=1');
  } catch(e) { next(e); }
});

router.get('/bot/broadcast', requireAuth, async function(req, res, next) {
  try {
    var users = await ekaBot.getUsers({ active: true });
    var histSnap = await fb.collection('eka_broadcasts').orderBy('createdAt', 'desc').limit(30).get();
    var history = histSnap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
    res.render('eka/admin/bot-broadcast', { title: 'Рассылка — Eka Admin', totalActive: users.length, sent: req.query.sent, error: req.query.error, history: history });
  } catch(e) { next(e); }
});

router.post('/bot/broadcast', requireAuth, upload.single('photo'), async function(req, res, next) {
  try {
    var text = (req.body.text || '').trim();
    if (!text) return res.redirect('/admin/bot/broadcast?error=empty');
    var lang = req.body.lang || 'all';
    var filters = { active: true };
    if (lang !== 'all') filters.lang = lang;
    var users = await ekaBot.getUsers(filters);
    var photoUrl = null;
    if (req.file) {
      photoUrl = await resizeBotPhoto(req.file.buffer, 'broadcast_' + Date.now());
    }
    var count = 0;
    for (var i = 0; i < users.length; i++) {
      try {
        if (photoUrl) {
          await ekaBot.sendMedia(users[i].id, 'photo', photoUrl, text);
        } else {
          await ekaBot.sendMessage(users[i].id, text);
        }
        count++;
      } catch(e) {
        var errData = e.response && e.response.data;
        if (errData && errData.error_code === 429) {
          var wait = ((errData.parameters && errData.parameters.retry_after) || 5) * 1000;
          await new Promise(function(r) { setTimeout(r, wait); });
          i--; // повторить этого пользователя
          continue;
        }
        if (errData && errData.error_code === 403) {
          await fb.collection('eka_bot_users').doc(users[i].id).update({ active: false }).catch(function(){});
        }
      }
      if (i < users.length - 1) await new Promise(function(r) { setTimeout(r, 50); });
    }
    await fb.collection('eka_broadcasts').add({
      createdAt: new Date(),
      sentBy: res.locals.adminName || 'admin',
      text: text,
      photoUrl: photoUrl || null,
      lang: lang,
      sent: count,
      total: users.length
    });
    res.redirect('/admin/bot/broadcast?sent=' + count);
  } catch(e) { next(e); }
});

// ── ADMINS ───────────────────────────────────────────────
router.get('/admins', requireAuth, async function(req, res, next) {
  try {
    var snap = await ekaAdmins.orderBy('createdAt').get();
    var admins = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
    res.render('eka/admin/admins', { title: 'Администраторы — Eka Admin', admins: admins, saved: req.query.saved, remind_ok: req.query.remind_ok, remind_err: req.query.remind_err, isSuperadmin: res.locals.isSuperadmin, currentAdminId: res.locals.adminId });
  } catch(e) { next(e); }
});

router.post('/admins/add', requireAuth, requireSuperAdmin, express.urlencoded({ extended: false }), async function(req, res, next) {
  try {
    var name = (req.body.name || '').trim();
    var pass = (req.body.password || '').trim();
    if (!name || !pass) return res.redirect('/admin/admins');
    await ekaAdmins.add({
      name: name,
      password_hash: cookieToken(pass),
      tg_id: (req.body.tg_id || '').trim(),
      notify_requests: req.body.notify_requests === 'on',
      notify_updates: req.body.notify_updates === 'on',
      notify_stats: req.body.notify_stats === 'on',
      notify_messages: req.body.notify_messages === 'on',
      createdAt: new Date(),
    });
    res.redirect('/admin/admins?saved=1');
  } catch(e) { next(e); }
});

router.post('/admins/:id/settings', requireAuth, express.urlencoded({ extended: false }), async function(req, res, next) {
  if (!res.locals.isSuperadmin && res.locals.adminId !== req.params.id) {
    return res.status(403).send('Нельзя редактировать чужой аккаунт');
  }
  try {
    var update = {
      tg_id: (req.body.tg_id || '').trim(),
      notify_requests: req.body.notify_requests === 'on',
      notify_updates: req.body.notify_updates === 'on',
      notify_stats: req.body.notify_stats === 'on',
      notify_messages: req.body.notify_messages === 'on',
    };
    if ((req.body.password || '').trim()) {
      update.password_hash = cookieToken(req.body.password.trim());
    }
    await ekaAdmins.doc(req.params.id).update(update);
    res.redirect('/admin/admins?saved=1');
  } catch(e) { next(e); }
});

router.post('/admins/:id/remind-password', requireAuth, async function(req, res, next) {
  try {
    var doc = await ekaAdmins.doc(req.params.id).get();
    if (!doc.exists) return res.redirect('/admin/admins');
    var admin = Object.assign({ id: doc.id }, doc.data());
    if (!admin.tg_id) return res.redirect('/admin/admins?remind_err=no_tg');
    var token = process.env.dimazvaliToken;
    if (!token) return res.redirect('/admin/admins?remind_err=no_token');
    var { sendMessage2 } = require('../routes/methods');
    var chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    var newPass = Array.from({ length: 12 }, function() { return chars[Math.floor(Math.random() * chars.length)]; }).join('');
    await ekaAdmins.doc(req.params.id).update({ password_hash: cookieToken(newPass) });
    await sendMessage2({ chat_id: String(admin.tg_id), text: '🔑 <b>Ваш новый пароль для TbiLiSELi Admin:</b>\n<code>' + newPass + '</code>\n\nВойдите и смените на свой.', parse_mode: 'HTML' }, false, token);
    res.redirect('/admin/admins?remind_ok=' + encodeURIComponent(admin.name));
  } catch(e) { next(e); }
});

router.post('/admins/:id/delete', requireAuth, requireSuperAdmin, async function(req, res, next) {
  try {
    await ekaAdmins.doc(req.params.id).delete();
    res.redirect('/admin/admins');
  } catch(e) { next(e); }
});

// ── STICKERS ─────────────────────────────────────────────
router.get('/stickers', requireAuth, async function(req, res, next) {
  try {
    var attractions = await ekaData.getAttractions({ publishedOnly: true });
    var stickers = attractions.filter(function(a) { return a.slug; }).map(function(a) {
      return { attraction: a, url: 'https://tbiliseli.com/ru/attractions/' + a.slug };
    });
    res.render('eka/admin/stickers', { title: 'Стикеры — Eka Admin', stickers });
  } catch(e) { next(e); }
});

router.get('/stickers/:slug/svg', requireAuth, async function(req, res, next) {
  try {
    var attractions = await ekaData.getAttractions({ publishedOnly: true });
    var attraction = attractions.find(function(a) { return a.slug === req.params.slug; });
    if (!attraction) return res.status(404).send('Not found');

    var stickerUrl = 'https://tbiliseli.com/ru/attractions/' + attraction.slug;
    var qrBuf = await QRCode.toBuffer(stickerUrl, { type: 'png', width: 200, margin: 1, color: { dark: '#111111', light: '#ffffff' } });
    var qrB64 = qrBuf.toString('base64');

    var logoPath = path.join(__dirname, '../public/images/eka/v2/logo.png');
    var logoB64 = fs.readFileSync(logoPath).toString('base64');

    // SVG canvas: 360×245 (≈90×61mm at 96dpi)
    // QR: y=14..176, text tops start at y=184 → 8px gap
    var cx = 271; // horizontal center of right column (190 + 162/2)
    var svg = [
      '<svg width="360" height="245" xmlns="http://www.w3.org/2000/svg">',
      '<rect width="360" height="245" fill="#E8000D"/>',
      '<image x="8" y="8" width="178" height="229" href="data:image/png;base64,' + logoB64 + '" preserveAspectRatio="xMidYMid meet"/>',
      '<image x="190" y="14" width="162" height="162" href="data:image/png;base64,' + qrB64 + '"/>',
      '<text x="' + cx + '" y="198" font-family="\'Barlow Condensed\',Arial,sans-serif" font-weight="900" font-size="17" fill="#ffffff" text-anchor="middle" letter-spacing="2">ВЫ ТОЛЬКО</text>',
      '<text x="' + cx + '" y="220" font-family="\'Barlow Condensed\',Arial,sans-serif" font-weight="900" font-size="17" fill="#ffffff" text-anchor="middle" letter-spacing="2">ПОСЛУШАЙТЕ</text>',
      '</svg>',
    ].join('\n');

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Content-Disposition', 'attachment; filename="' + attraction.slug + '-sticker.svg"');
    res.send(svg);
  } catch(e) { next(e); }
});

// ── HELP ─────────────────────────────────────────────────
router.get('/help', requireAuth, function(req, res) {
  res.render('eka/admin/help', { title: 'Справка — Eka Admin' });
});

// ── REVIEWS ──────────────────────────────────────────────
router.get('/reviews', requireAuth, async function(req, res, next) {
  try {
    var reviews = await ekaData.getReviews({});
    var tours = await ekaData.getTours({});
    var tourMap = {};
    tours.forEach(function(t) { tourMap[t.id] = t; });
    res.render('eka/admin/reviews', { title: 'Отзывы — Eka Admin', reviews: reviews, tourMap: tourMap });
  } catch (e) { next(e); }
});

// ── PROFILE ──────────────────────────────────────────────
router.get('/profile', requireAuth, async function(req, res, next) {
  try {
    var profile = await ekaData.getProfile();
    res.render('eka/admin/profile', { title: 'Профиль — Eka Admin', profile: profile });
  } catch (e) { next(e); }
});

router.post('/profile', requireAuth, upload.fields([{ name: 'photo', maxCount: 1 }]), async function(req, res, next) {
  try {
    var b = req.body;
    var data = { bioRu: b.bioRu || '', bioEn: b.bioEn || '', taglineRu: b.taglineRu || '', taglineEn: b.taglineEn || '',
      telegram: b.telegram || '', whatsapp: b.whatsapp || '', instagram: b.instagram || '', contactEmail: b.contactEmail || '' };
    if (req.files && req.files.photo && req.files.photo[0]) {
      var sizes = await uploadImageSizes(req.files.photo[0].buffer, 'eka/profile/photo-{w}.webp');
      data.photoSizes = sizes;
      data.photo = sizes.w800;
    }
    await ekaData.saveProfile(data);
    res.redirect('/admin/profile');
  } catch (e) { next(e); }
});

// ── CLIENTS ──────────────────────────────────────────────

router.get('/clients', requireAuth, async function(req, res, next) {
  try {
    var clients = await ekaData.getClients();
    var requests = await ekaData.getRequests({});
    var lastVisit = {};
    requests.forEach(function(r) {
      if (!r.clientId) return;
      var d = r.createdAt && r.createdAt.toDate ? r.createdAt.toDate() : new Date(r.createdAt || 0);
      if (!lastVisit[r.clientId] || d > lastVisit[r.clientId]) lastVisit[r.clientId] = d;
    });
    res.render('eka/admin/clients', { title: 'Клиенты — Eka Admin', clients: clients, lastVisit: lastVisit });
  } catch (e) { next(e); }
});

router.get('/clients/new', requireAuth, async function(req, res, next) {
  try {
    res.render('eka/admin/client-edit', { title: 'Новый клиент — Eka Admin', client: null, clientId: null, trips: [] });
  } catch (e) { next(e); }
});

router.get('/clients/:id/edit', requireAuth, async function(req, res, next) {
  try {
    var client = await ekaData.getClient(req.params.id);
    if (!client) return res.redirect('/admin/clients');
    var trips = await ekaData.getRequests({ clientId: req.params.id });
    var tours = await ekaData.getTours({});
    var tourMap = {};
    tours.forEach(function(t) { tourMap[t.id] = t; });
    trips.forEach(function(r) { r._tour = r.tourId ? tourMap[r.tourId] : null; });

    var linkedSnap = await fb.collection('eka_bot_users').where('client_id', '==', req.params.id).get();
    var linkedBotUsers = linkedSnap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
    var allBotUsers = [];
    if (!linkedBotUsers.length) {
      allBotUsers = await ekaBot.getUsers();
      allBotUsers = allBotUsers.filter(function(u) { return !u.client_id; });
      allBotUsers.sort(function(a, b) { return (a.first_name || '').localeCompare(b.first_name || ''); });
    }

    res.render('eka/admin/client-edit', { title: (client.firstName || '') + ' ' + (client.lastName || '') + ' — Eka Admin', client: client, clientId: req.params.id, trips: trips, linkedBotUsers: linkedBotUsers, allBotUsers: allBotUsers });
  } catch (e) { next(e); }
});

router.post('/clients/:id/edit', requireAuth, upload.fields([{ name: 'photo', maxCount: 1 }]), async function(req, res, next) {
  var id = req.params.id === 'new' ? null : req.params.id;
  try {
    var b = req.body;
    var createdAt = b.createdAt ? new Date(b.createdAt) : (id ? undefined : new Date());
    var data = {
      firstName: (b.firstName || '').trim(),
      lastName: (b.lastName || '').trim(),
      lang: b.lang || 'ru',
      notes: (b.notes || '').trim(),
      tgId: (b.tgId || '').trim(),
      email: (b.email || '').trim(),
      phone: (b.phone || '').trim(),
    };
    if (createdAt) data.createdAt = createdAt;
    if (req.files && req.files.photo && req.files.photo[0]) {
      var tmpId = id || ('tmp-' + Date.now());
      var sizes = await uploadImageSizes(req.files.photo[0].buffer, 'eka/clients/' + tmpId + '/photo-{w}.webp');
      data.photo = sizes.w400;
    }
    var savedId = await ekaData.saveClient(id, data);
    res.redirect('/admin/clients/' + savedId + '/edit');
  } catch (e) { next(e); }
});

router.post('/clients/:id/link-bot-user', requireAuth, express.urlencoded({ extended: false }), async function(req, res, next) {
  try {
    var botUserId = (req.body.botUserId || '').trim();
    if (botUserId) await fb.collection('eka_bot_users').doc(botUserId).update({ client_id: req.params.id });
    res.redirect('/admin/clients/' + req.params.id + '/edit');
  } catch (e) { next(e); }
});

router.post('/clients/:id/unlink-bot-user/:botUserId', requireAuth, async function(req, res, next) {
  try {
    await fb.collection('eka_bot_users').doc(req.params.botUserId).update({ client_id: null });
    res.redirect('/admin/clients/' + req.params.id + '/edit');
  } catch (e) { next(e); }
});

router.post('/clients/:id/delete', requireAuth, async function(req, res, next) {
  try { await ekaData.deleteClient(req.params.id); res.redirect('/admin/clients'); } catch (e) { next(e); }
});

router.post('/requests/:id/link-client', requireAuth, express.urlencoded({ extended: false }), async function(req, res, next) {
  try {
    var clientId = (req.body.clientId || '').trim() || null;
    await ekaData.updateRequest(req.params.id, { clientId: clientId });
    var back = req.body.back;
    res.redirect(back || '/admin/requests');
  } catch (e) { next(e); }
});

// ── ATTRACTIONS ──────────────────────────────────────────
router.get('/attractions', requireAuth, async function(req, res, next) {
  try {
    var attractions = await ekaData.getAttractions();
    var directions = await ekaData.getDirections();
    var dirMap = {};
    directions.forEach(function(d) { dirMap[d.id] = d; });
    res.render('eka/admin/attractions', { title: 'Места — Eka Admin', attractions: attractions, dirMap: dirMap });
  } catch (e) { next(e); }
});

router.get('/attractions/new', requireAuth, async function(req, res, next) {
  try {
    var directions = await ekaData.getDirections();
    res.render('eka/admin/attraction-edit', { title: 'Новое место', attraction: null, attractionId: null, directions: directions, images: [], error: null });
  } catch (e) { next(e); }
});

router.get('/attractions/:id/edit', requireAuth, async function(req, res, next) {
  try {
    var attraction = await ekaData.getAttraction(req.params.id);
    if (!attraction) return res.redirect('/admin/attractions');
    var directions = await ekaData.getDirections();
    var images = await ekaData.getImages({ ownerId: req.params.id });
    res.render('eka/admin/attraction-edit', { title: (attraction.titleRu || '') + ' — Edit', attraction: attraction, attractionId: req.params.id, directions: directions, images: images, error: null });
  } catch (e) { next(e); }
});

router.post('/attractions/:id/edit', requireAuth, upload.fields([{ name: 'heroImage', maxCount: 1 }, { name: 'galleryImages', maxCount: 20 }, { name: 'audioFileRu', maxCount: 1 }, { name: 'audioFileEn', maxCount: 1 }]), async function(req, res, next) {
  var id = req.params.id === 'new' ? null : req.params.id;
  try {
    var b = req.body;
    var slug = (b.slug || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-') || null;
    var data = {
      titleRu: b.titleRu || '', titleEn: b.titleEn || '',
      descRu: b.descRu || '', descEn: b.descEn || '',
      directionId: b.directionId || null,
      published: b.published === 'on',
    };
    if (slug) data.slug = slug;
    var savedId = await ekaData.saveAttraction(id, data);
    var ts = Date.now();
    if (req.files && req.files.heroImage && req.files.heroImage[0]) {
      var heroSizes = await uploadImageSizes(req.files.heroImage[0].buffer, 'eka/attractions/' + savedId + '/hero-' + ts + '-{w}.webp');
      var existingHeroes = await ekaData.getImages({ ownerId: savedId, role: 'hero' });
      var heroId = existingHeroes.length ? existingHeroes[0].id : null;
      await ekaData.saveImage(heroId, { ownerId: savedId, ownerType: 'attraction', role: 'hero', order: 0, createdAt: new Date(), w400: heroSizes.w400, w800: heroSizes.w800, w1400: heroSizes.w1400, w2400: heroSizes.w2400 });
    }
    if (req.files && req.files.galleryImages && req.files.galleryImages.length) {
      var existingGallery = await ekaData.getImages({ ownerId: savedId, role: 'gallery' });
      var maxOrder = existingGallery.reduce(function(m, img) { return Math.max(m, img.order || 0); }, -1);
      await Promise.all(req.files.galleryImages.map(async function(f, i) {
        var sizes = await uploadImageSizes(f.buffer, 'eka/attractions/' + savedId + '/gallery-' + ts + '-' + i + '-{w}.webp');
        return ekaData.saveImage(null, { ownerId: savedId, ownerType: 'attraction', role: 'gallery', order: maxOrder + 1 + i, createdAt: new Date(), w400: sizes.w400, w800: sizes.w800, w1400: sizes.w1400, w2400: sizes.w2400 });
      }));
    }
    var audioUpdate = {};
    for (var lang of ['Ru', 'En']) {
      var fieldName = 'audioFile' + lang;
      if (req.files && req.files[fieldName] && req.files[fieldName][0]) {
        var af = req.files[fieldName][0];
        var ext = (af.originalname.split('.').pop() || 'mp3').toLowerCase();
        var audioPath = 'eka/attractions/' + savedId + '/audio-' + lang.toLowerCase() + '-' + ts + '.' + ext;
        var audioRef = bucket.file(audioPath);
        await audioRef.save(af.buffer, { metadata: { contentType: af.mimetype } });
        await audioRef.makePublic();
        audioUpdate['audioUrl' + lang] = 'https://storage.googleapis.com/' + bucket.name + '/' + audioPath;
      }
    }
    if (Object.keys(audioUpdate).length) await ekaData.saveAttraction(savedId, audioUpdate);
    res.redirect('/admin/attractions/' + savedId + '/edit');
  } catch (e) { next(e); }
});

router.post('/attractions/:id/delete', requireAuth, async function(req, res, next) {
  try { await ekaData.deleteAttraction(req.params.id); res.redirect('/admin/attractions'); } catch (e) { next(e); }
});

// ── GALLERIES (reusable, embeddable via [gallery:id] shortcode) ──
router.get('/galleries', requireAuth, async function(req, res, next) {
  try {
    var galleries = await ekaData.getGalleries();
    await Promise.all(galleries.map(async function(g) {
      var imgs = await ekaData.getImages({ ownerId: g.id, role: 'gallery' });
      g.count = imgs.length;
      g.thumb = imgs[0] || null;
    }));
    res.render('eka/admin/galleries', { title: 'Галереи — Eka Admin', galleries: galleries });
  } catch (e) { next(e); }
});

router.get('/galleries/new', requireAuth, async function(req, res, next) {
  try {
    res.render('eka/admin/gallery-edit', { title: 'Новая галерея', gallery: null, galleryId: null, images: [] });
  } catch (e) { next(e); }
});

router.get('/galleries/:id/edit', requireAuth, async function(req, res, next) {
  try {
    var gallery = await ekaData.getGallery(req.params.id);
    if (!gallery) return res.redirect('/admin/galleries');
    var images = await ekaData.getImages({ ownerId: req.params.id, role: 'gallery' });
    res.render('eka/admin/gallery-edit', { title: (gallery.title || 'Галерея') + ' — Edit', gallery: gallery, galleryId: req.params.id, images: images });
  } catch (e) { next(e); }
});

router.post('/galleries/:id/edit', requireAuth, upload.fields([{ name: 'galleryImages', maxCount: 20 }]), async function(req, res, next) {
  var id = req.params.id === 'new' ? null : req.params.id;
  try {
    var b = req.body;
    var data = { title: (b.title || '').trim() };
    var savedId = await ekaData.saveGallery(id, data);
    if (req.files && req.files.galleryImages && req.files.galleryImages.length) {
      var ts = Date.now();
      var existingGallery = await ekaData.getImages({ ownerId: savedId, role: 'gallery' });
      var maxOrder = existingGallery.reduce(function(m, img) { return Math.max(m, img.order || 0); }, -1);
      await Promise.all(req.files.galleryImages.map(async function(f, i) {
        var sizes = await uploadImageSizes(f.buffer, 'eka/galleries/' + savedId + '/gallery-' + ts + '-' + i + '-{w}.webp');
        return ekaData.saveImage(null, { ownerId: savedId, ownerType: 'gallery', role: 'gallery', order: maxOrder + 1 + i, createdAt: new Date(), w400: sizes.w400, w800: sizes.w800, w1400: sizes.w1400, w2400: sizes.w2400 });
      }));
    }
    res.redirect('/admin/galleries/' + savedId + '/edit');
  } catch (e) { next(e); }
});

router.post('/galleries/:id/delete', requireAuth, async function(req, res, next) {
  try { await ekaData.deleteGallery(req.params.id); res.redirect('/admin/galleries'); } catch (e) { next(e); }
});

router.use(function(err, req, res, next) {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).send('Файл слишком большой (макс. 100 МБ). <a href="javascript:history.back()">Назад</a>');
  }
  next(err);
});

module.exports = router;
