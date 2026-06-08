'use strict';
var express = require('express');
var router = express.Router();
var multer = require('multer');
var sharp = require('sharp');
var { getApps } = require('firebase-admin/app');
var { getFirestore } = require('firebase-admin/firestore');
var { getStorage } = require('firebase-admin/storage');
var ekaData = require('../lib/eka-data');

// eka Firebase app initialized by eka.js (loaded first via router.use('/admin', ...))
var ekaApp = getApps().find(function(a) { return a.name === 'eka'; });
var fb = getFirestore(ekaApp);
var bucket = getStorage(ekaApp).bucket();
var adminTokens = fb.collection('ekaAdminTokens');

var upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: function(req, file, cb) {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Images only'));
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

// ── AUTH ────────────────────────────────────────────────
async function requireAuth(req, res, next) {
  var tokenId = req.signedCookies && req.signedCookies.ekaAdminToken;
  if (!tokenId) return res.redirect('/admin/login');
  try {
    var doc = await adminTokens.doc(tokenId).get();
    if (!doc.exists) return res.redirect('/admin/login');
    next();
  } catch (e) { res.redirect('/admin/login'); }
}

router.get('/login', function(req, res) {
  res.render('eka/admin/login', { title: 'Вход — Eka Admin', error: null });
});

router.post('/login', express.urlencoded({ extended: false }), async function(req, res) {
  var pass = req.body.pass || '';
  if (pass !== process.env.EKA_ADMIN_PASS) {
    return res.render('eka/admin/login', { title: 'Вход — Eka Admin', error: 'Неверный пароль' });
  }
  var doc = await adminTokens.add({ createdAt: new Date() });
  res.cookie('ekaAdminToken', doc.id, { signed: true, httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 });
  res.redirect('/admin/');
});

router.get('/logout', async function(req, res) {
  var tokenId = req.signedCookies && req.signedCookies.ekaAdminToken;
  if (tokenId) { try { await adminTokens.doc(tokenId).delete(); } catch (e) {} }
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

router.post('/directions/reorder', requireAuth, express.json(), async function(req, res) {
  var ids = req.body.ids;
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids required' });
  await ekaData.reorderDirections(ids);
  res.json({ ok: true });
});

router.get('/directions/new', requireAuth, function(req, res) {
  res.render('eka/admin/direction-edit', { title: 'Новое направление', direction: null, directionId: null, error: null });
});

router.get('/directions/:id/edit', requireAuth, async function(req, res, next) {
  try {
    var direction = await ekaData.getDirection(req.params.id);
    if (!direction) return res.redirect('/admin/directions');
    res.render('eka/admin/direction-edit', { title: direction.titleRu + ' — Edit', direction: direction, directionId: req.params.id, error: null });
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
      metaSeasonRu: b.metaSeasonRu || '', metaSeasonEn: b.metaSeasonEn || '',
      metaDistanceRu: b.metaDistanceRu || '', metaDistanceEn: b.metaDistanceEn || '',
      published: b.published === 'on',
    };
    if (!id) data.order = 999;

    var savedId = await ekaData.saveDirection(id, data);

    // Hero image
    if (req.files && req.files.heroImage && req.files.heroImage[0]) {
      var heroSizes = await uploadImageSizes(req.files.heroImage[0].buffer, 'eka/directions/' + savedId + '/hero-{w}.webp');
      await ekaData.saveDirection(savedId, { heroImageSizes: heroSizes, heroImage: heroSizes.w1400 });
    }

    // Gallery images (append)
    if (req.files && req.files.galleryImages && req.files.galleryImages.length) {
      var existing = (await ekaData.getDirection(savedId)).gallery || [];
      var idx = existing.length;
      var newItems = await Promise.all(req.files.galleryImages.map(async function(f, i) {
        return uploadImageSizes(f.buffer, 'eka/directions/' + savedId + '/gallery-' + (idx + i) + '-{w}.webp');
      }));
      await ekaData.saveDirection(savedId, { gallery: existing.concat(newItems) });
    }

    res.redirect('/admin/directions/' + savedId + '/edit');
  } catch (e) { next(e); }
});

router.post('/directions/:id/delete', requireAuth, async function(req, res, next) {
  try { await ekaData.deleteDirection(req.params.id); res.redirect('/admin/directions'); } catch (e) { next(e); }
});

router.post('/directions/:id/gallery-delete', requireAuth, express.urlencoded({ extended: false }), async function(req, res, next) {
  try {
    var idx = parseInt(req.body.index);
    var direction = await ekaData.getDirection(req.params.id);
    var gallery = (direction.gallery || []).filter(function(_, i) { return i !== idx; });
    await ekaData.saveDirection(req.params.id, { gallery: gallery });
    res.redirect('/admin/directions/' + req.params.id + '/edit');
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
    res.render('eka/admin/tour-edit', { title: 'Новый тур', tour: null, tourId: null, directions: directions, error: null });
  } catch (e) { next(e); }
});

router.get('/tours/:id/edit', requireAuth, async function(req, res, next) {
  try {
    var tour = await ekaData.getTour(req.params.id);
    if (!tour) return res.redirect('/admin/tours');
    var directions = await ekaData.getDirections();
    res.render('eka/admin/tour-edit', { title: (tour.titleRu || '') + ' — Edit', tour: tour, tourId: req.params.id, directions: directions, error: null });
  } catch (e) { next(e); }
});

router.post('/tours/:id/edit', requireAuth, express.urlencoded({ extended: false }), async function(req, res, next) {
  var id = req.params.id === 'new' ? null : req.params.id;
  try {
    var b = req.body;
    var direction = b.directionId ? await ekaData.getDirection(b.directionId) : null;
    var data = {
      directionId: b.directionId || null,
      directionSlug: direction ? direction.slug : null,
      titleRu: b.titleRu || '', titleEn: b.titleEn || '',
      descRu: b.descRu || '', descEn: b.descEn || '',
      date: b.date ? new Date(b.date) : null,
      durationRu: b.durationRu || '', durationEn: b.durationEn || '',
      price: b.price ? parseInt(b.price) : 0,
      currency: b.currency || 'USD',
      maxParticipants: b.maxParticipants ? parseInt(b.maxParticipants) : 0,
      published: b.published === 'on',
    };
    var savedId = await ekaData.saveTour(id, data);
    res.redirect('/admin/tours/' + savedId + '/edit');
  } catch (e) { next(e); }
});

router.post('/tours/:id/delete', requireAuth, async function(req, res, next) {
  try { await ekaData.deleteTour(req.params.id); res.redirect('/admin/tours'); } catch (e) { next(e); }
});

// ── REQUESTS ─────────────────────────────────────────────
router.get('/requests', requireAuth, async function(req, res, next) {
  try {
    var status = req.query.status || null;
    var requests = await ekaData.getRequests(status ? { status: status } : {});
    res.render('eka/admin/requests', { title: 'Заявки — Eka Admin', requests: requests, activeStatus: status });
  } catch (e) { next(e); }
});

router.post('/requests/:id/status', requireAuth, express.urlencoded({ extended: false }), async function(req, res, next) {
  try {
    await ekaData.updateRequestStatus(req.params.id, req.body.status);
    res.redirect(req.headers.referer || '/admin/requests');
  } catch (e) { next(e); }
});

module.exports = router;
