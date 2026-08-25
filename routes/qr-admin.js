'use strict';
var express = require('express');
var router = express.Router();
var multer = require('multer');
var QRCode = require('qrcode');
var { cookieToken } = require('../lib/qr-auth');
var qrData = require('../lib/qr-data');
var qrImages = require('../lib/qr-images');

router.use(express.urlencoded({ extended: false }));

var upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: function(req, file, cb) {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Только изображения'));
    cb(null, true);
  },
});

function expectedToken() {
  return process.env.QR_ADMIN_PASS ? cookieToken(process.env.QR_ADMIN_PASS) : null;
}

function requireAuth(req, res, next) {
  var val = req.cookies && req.cookies.qrAdminToken;
  var expected = expectedToken();
  if (expected && val === expected) return next();
  res.redirect('/admin/login');
}

router.get('/login', function(req, res) {
  res.render('qr/admin/login', { title: 'Вход — qr.dimazvali.com Admin', error: null });
});

router.post('/login', function(req, res) {
  var pass = (req.body.pass || '').trim();
  var expected = expectedToken();
  if (!expected || cookieToken(pass) !== expected) {
    return res.render('qr/admin/login', { title: 'Вход — qr.dimazvali.com Admin', error: 'Неверный пароль' });
  }
  res.cookie('qrAdminToken', expected, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 });
  res.redirect('/admin');
});

router.post('/logout', function(req, res) {
  res.clearCookie('qrAdminToken');
  res.redirect('/admin/login');
});

router.get('/', requireAuth, function(req, res) {
  res.render('qr/admin/list', { title: 'qr.dimazvali.com Admin', entries: qrData.getAll() });
});

router.get('/new', requireAuth, function(req, res) {
  res.render('qr/admin/edit', { title: 'Новая запись', entry: null, error: null });
});

router.post('/new', requireAuth, upload.single('photo'), async function(req, res) {
  try {
    if (!req.file) throw new Error('Загрузите фотографию');
    var slug = (req.body.slug || '').trim();
    var photoPath = await qrImages.savePhoto(slug, req.file.buffer);
    qrData.create({
      slug: slug,
      title: (req.body.title || '').trim(),
      year: (req.body.year || '').trim(),
      description: (req.body.description || '').trim(),
      address: (req.body.address || '').trim(),
      photo: photoPath,
    });
    res.redirect('/admin');
  } catch (e) {
    res.render('qr/admin/edit', { title: 'Новая запись', entry: req.body, error: e.message });
  }
});

router.get('/:slug/edit', requireAuth, function(req, res) {
  var entry = qrData.getBySlug(req.params.slug);
  if (!entry) return res.status(404).send('Не найдено');
  res.render('qr/admin/edit', { title: 'Редактировать: ' + entry.title, entry: entry, error: null });
});

router.post('/:slug/edit', requireAuth, upload.single('photo'), async function(req, res) {
  try {
    var patch = {
      title: (req.body.title || '').trim(),
      year: (req.body.year || '').trim(),
      description: (req.body.description || '').trim(),
      address: (req.body.address || '').trim(),
    };
    if (req.file) {
      patch.photo = await qrImages.savePhoto(req.params.slug, req.file.buffer);
    }
    qrData.update(req.params.slug, patch);
    res.redirect('/admin');
  } catch (e) {
    var entry = qrData.getBySlug(req.params.slug);
    res.render('qr/admin/edit', { title: 'Редактировать', entry: entry, error: e.message });
  }
});

router.post('/:slug/delete', requireAuth, function(req, res) {
  qrData.remove(req.params.slug);
  qrImages.deletePhoto(req.params.slug);
  res.redirect('/admin');
});

router.get('/:slug/qr.png', requireAuth, function(req, res) {
  var entry = qrData.getBySlug(req.params.slug);
  if (!entry) return res.status(404).send('Не найдено');
  var url = 'https://qr.dimazvali.com/' + entry.slug;
  res.type('png');
  QRCode.toFileStream(res, url, { width: 800, margin: 2 });
});

module.exports = router;
module.exports.requireAuth = requireAuth;
