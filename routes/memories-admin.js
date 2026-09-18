'use strict';
var express = require('express');
var router = express.Router();
var { getApps } = require('firebase-admin/app');
var multer = require('multer');
var memoriesData = require('../lib/memories-data');
var memoriesPhotos = require('../lib/memories-photos');
var { cookieToken } = require('../lib/memories-auth');

var upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: function(req, file, cb) {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only images allowed'));
    cb(null, true);
  },
});

// Only used to assert the app exists — memoriesData was already init()'d
// with its Firestore handle by routes/memories.js (loaded first, see app.js).
var memoriesApp = getApps().find(function(a) { return a.name === 'memories'; });
if (!memoriesApp) throw new Error('memories-admin: Firebase "memories" app not initialized — load routes/memories.js first');

async function requireAuth(req, res, next) {
  var val = req.cookies && req.cookies.memoriesAdminToken;
  if (!val) return res.redirect('/admin/login');
  var envPass = process.env.MEMORIES_ADMIN_PASS;
  if (envPass && val === cookieToken(envPass)) {
    res.locals.adminName = 'admin';
    res.locals.adminId = null;
    res.locals.isSuperadmin = true;
    return next();
  }
  try {
    var admin = await memoriesData.getAdminByPasswordHash(val);
    if (admin) {
      res.locals.adminName = admin.name || 'admin';
      res.locals.adminId = admin.id;
      res.locals.isSuperadmin = !!admin.superadmin;
      return next();
    }
  } catch (e) {}
  res.redirect('/admin/login');
}

function requireSuperAdmin(req, res, next) {
  if (res.locals.isSuperadmin) return next();
  res.status(403).send('Доступ запрещён — только для суперадминистратора');
}

router.get('/login', function(req, res) {
  res.render('memories/admin/login', { title: 'Вход — Memories Admin', error: null });
});

router.post('/login', express.urlencoded({ extended: false }), async function(req, res) {
  var pass = (req.body.pass || '').trim();
  if (!pass) return res.render('memories/admin/login', { title: 'Вход — Memories Admin', error: 'Введите пароль' });
  var hash = cookieToken(pass);
  var envPass = process.env.MEMORIES_ADMIN_PASS;
  var ok = !!(envPass && pass === envPass);
  if (!ok) {
    var admin = await memoriesData.getAdminByPasswordHash(hash).catch(function() { return null; });
    ok = !!admin;
  }
  if (!ok) return res.render('memories/admin/login', { title: 'Вход — Memories Admin', error: 'Неверный пароль' });
  res.cookie('memoriesAdminToken', hash, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 });
  res.redirect('/admin/');
});

router.get('/logout', function(req, res) {
  res.clearCookie('memoriesAdminToken');
  res.redirect('/admin/login');
});

router.get('/', requireAuth, async function(req, res, next) {
  try {
    var memories = await memoriesData.getAllMemories();
    var withCounts = await Promise.all(memories.map(async function(m) {
      var photos = await memoriesData.getMemoryPhotos(m.id);
      return Object.assign({}, m, { photoCount: photos.length });
    }));
    res.render('memories/admin/memories', { title: 'Воспоминания — Memories Admin', memories: withCounts, saved: req.query.saved });
  } catch (e) { next(e); }
});

router.post('/', requireAuth, express.urlencoded({ extended: false }), async function(req, res, next) {
  try {
    var name = (req.body.name || '').trim();
    if (!name) return res.redirect('/admin/');
    var id = await memoriesData.insertMemory({ name: name, description: (req.body.description || '').trim() });
    res.redirect('/admin/' + id);
  } catch (e) { next(e); }
});

router.get('/settings', requireAuth, async function(req, res, next) {
  try {
    var settings = await memoriesData.getArSettings();
    res.render('memories/admin/settings', { title: 'Настройки AR — Memories Admin', settings: settings, saved: req.query.saved, error: req.query.error });
  } catch (e) { next(e); }
});

router.post('/settings', requireAuth, express.urlencoded({ extended: false }), async function(req, res, next) {
  try {
    var minVisibleDistance = parseFloat(req.body.minVisibleDistance);
    var fullSizeDistance = parseFloat(req.body.fullSizeDistance);
    if (isNaN(minVisibleDistance) || isNaN(fullSizeDistance) || fullSizeDistance >= minVisibleDistance) {
      return res.redirect('/admin/settings?error=1');
    }
    await memoriesData.updateArSettings({ minVisibleDistance: minVisibleDistance, fullSizeDistance: fullSizeDistance });
    res.redirect('/admin/settings?saved=1');
  } catch (e) { next(e); }
});

router.get('/admins', requireAuth, requireSuperAdmin, async function(req, res, next) {
  try {
    var admins = await memoriesData.getAdmins();
    res.render('memories/admin/admins', { title: 'Администраторы — Memories Admin', admins: admins, saved: req.query.saved, currentAdminId: res.locals.adminId });
  } catch (e) { next(e); }
});

router.post('/admins', requireAuth, requireSuperAdmin, express.urlencoded({ extended: false }), async function(req, res, next) {
  try {
    var name = (req.body.name || '').trim();
    var pass = (req.body.password || '').trim();
    if (!name || !pass) return res.redirect('/admin/admins');
    await memoriesData.insertAdmin({ name: name, password_hash: cookieToken(pass), superadmin: req.body.superadmin === 'on' });
    res.redirect('/admin/admins?saved=1');
  } catch (e) { next(e); }
});

router.post('/admins/:id/delete', requireAuth, requireSuperAdmin, async function(req, res, next) {
  try {
    await memoriesData.deleteAdmin(req.params.id);
    res.redirect('/admin/admins');
  } catch (e) { next(e); }
});

router.get('/:id', requireAuth, async function(req, res, next) {
  try {
    var memory = await memoriesData.getMemoryById(req.params.id);
    if (!memory) return next();
    var photos = await memoriesData.getMemoryPhotos(memory.id);
    // Feeds the draggable existing-photo markers on the point-picker map —
    // `<` escaped so a caption can never break out of the <script type=json> tag.
    var photosMapData = JSON.stringify(photos.map(function(p) {
      return { id: p.id, lat: p.lat, lng: p.lng, caption: p.caption || '' };
    })).replace(/</g, '\\u003c');
    res.render('memories/admin/memory-detail', { title: memory.name + ' — Memories Admin', memory: memory, photos: photos, photosMapData: photosMapData, saved: req.query.saved });
  } catch (e) { next(e); }
});

router.post('/:id/edit', requireAuth, express.urlencoded({ extended: false }), async function(req, res, next) {
  try {
    var startLat = parseFloat(req.body.startLat);
    var startLng = parseFloat(req.body.startLng);
    await memoriesData.updateMemory(req.params.id, {
      name: (req.body.name || '').trim(),
      description: (req.body.description || '').trim(),
      active: req.body.active === 'on',
      startLat: isNaN(startLat) ? null : startLat,
      startLng: isNaN(startLng) ? null : startLng,
    });
    res.redirect('/admin/' + req.params.id + '?saved=1');
  } catch (e) { next(e); }
});

// Accepts either an ISO datetime (client sends EXIF DateTimeOriginal this
// way) or a plain YYYY-MM-DD (the admin's manual <input type=date>); '' or
// anything unparseable means "not set" / "cleared".
function parseTakenAt(v) {
  if (!v) return null;
  var d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

router.post('/:id/photos', requireAuth, upload.single('photo'), async function(req, res, next) {
  try {
    var memory = await memoriesData.getMemoryById(req.params.id);
    if (!memory) return next();
    var lat = parseFloat(req.body.lat);
    var lng = parseFloat(req.body.lng);
    if (!req.file || isNaN(lat) || isNaN(lng)) {
      if (req.get('X-Requested-With') === 'fetch') return res.sendStatus(400);
      return res.redirect('/admin/' + memory.id + '?error=missing');
    }
    var urls = await memoriesPhotos.uploadMemoryPhoto(req.file.buffer, memory.id);
    await memoriesData.insertMemoryPhoto({
      memoryId: memory.id, lat: lat, lng: lng,
      caption: (req.body.caption || '').trim(), urls: urls,
      takenAt: parseTakenAt(req.body.takenAt),
    });
    // The bulk-upload queue on memory-detail.pug calls this via fetch() once
    // per file and doesn't need the redirect a normal <form> submit expects.
    if (req.get('X-Requested-With') === 'fetch') return res.sendStatus(204);
    res.redirect('/admin/' + memory.id + '?saved=1');
  } catch (e) { next(e); }
});

router.post('/photos/:id/edit', requireAuth, express.urlencoded({ extended: false }), async function(req, res, next) {
  try {
    var photo = await memoriesData.getMemoryPhotoById(req.params.id);
    if (!photo) return next();
    var patch = { caption: (req.body.caption || '').trim() };
    var lat = parseFloat(req.body.lat);
    var lng = parseFloat(req.body.lng);
    if (!isNaN(lat)) patch.lat = lat;
    if (!isNaN(lng)) patch.lng = lng;
    if (req.body.takenAt !== undefined) patch.takenAt = parseTakenAt(req.body.takenAt);
    await memoriesData.updateMemoryPhoto(photo.id, patch);
    // The drag-to-reposition marker on memory-detail.pug calls this via
    // fetch() and just needs a status, not the redirect a normal <form>
    // submit expects (the inline caption field still submits as a form).
    if (req.get('X-Requested-With') === 'fetch') return res.sendStatus(204);
    res.redirect('/admin/' + photo.memoryId + '?saved=1');
  } catch (e) { next(e); }
});

router.post('/photos/:id/move', requireAuth, express.urlencoded({ extended: false }), async function(req, res, next) {
  try {
    var photo = await memoriesData.getMemoryPhotoById(req.params.id);
    if (!photo) return next();
    await memoriesData.moveMemoryPhoto(photo.id, req.body.direction === 'up' ? 'up' : 'down');
    res.redirect('/admin/' + photo.memoryId);
  } catch (e) { next(e); }
});

router.post('/photos/:id/delete', requireAuth, async function(req, res, next) {
  try {
    var photo = await memoriesData.getMemoryPhotoById(req.params.id);
    if (!photo) return next();
    await memoriesPhotos.deleteMemoryPhotoFiles(photo.urls).catch(function() {});
    await memoriesData.deleteMemoryPhoto(photo.id);
    res.redirect('/admin/' + photo.memoryId);
  } catch (e) { next(e); }
});

router.post('/:id/delete', requireAuth, async function(req, res, next) {
  try {
    await memoriesData.deleteMemory(req.params.id);
    res.redirect('/admin/');
  } catch (e) { next(e); }
});

module.exports = router;
