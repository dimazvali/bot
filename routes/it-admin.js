'use strict';
var express = require('express');
var router = express.Router();
var multer = require('multer');
var { getApps } = require('firebase-admin/app');
var { getFirestore } = require('firebase-admin/firestore');
var { getStorage } = require('firebase-admin/storage');
var itData = require('../lib/it-data');

var itApp = getApps().find(function(a) { return a.name === 'it'; });
if (!itApp) throw new Error('it-admin: Firebase "it" app not initialized — load it.js first');
var fb = getFirestore(itApp);
var bucket = getStorage(itApp).bucket();
var adminTokens = fb.collection('it_admin_tokens');

var upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: function(req, file, cb) {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Images only'));
    cb(null, true);
  },
});

// ── AUTH ────────────────────────────────────────────────
async function requireAuth(req, res, next) {
  var tokenId = req.signedCookies && req.signedCookies.itAdminToken;
  if (!tokenId) return res.redirect('/admin/login');
  try {
    var doc = await adminTokens.doc(tokenId).get();
    if (!doc.exists) return res.redirect('/admin/login');
    next();
  } catch (e) { res.redirect('/admin/login'); }
}

router.get('/login', function(req, res) {
  res.render('it/admin/login', { error: null });
});

router.post('/login', express.urlencoded({ extended: false }), async function(req, res) {
  var pass = req.body.pass || '';
  if (pass !== process.env.IT_ADMIN_PASS) {
    return res.render('it/admin/login', { error: 'Неверный пароль' });
  }
  var doc = await adminTokens.add({ createdAt: new Date() });
  res.cookie('itAdminToken', doc.id, { signed: true, httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 });
  res.redirect('/admin/');
});

router.get('/logout', async function(req, res) {
  var tokenId = req.signedCookies && req.signedCookies.itAdminToken;
  if (tokenId) { try { await adminTokens.doc(tokenId).delete(); } catch (e) {} }
  res.clearCookie('itAdminToken');
  res.redirect('/admin/login');
});

// ── PROJECT LIST ────────────────────────────────────────
router.get('/', requireAuth, async function(req, res, next) {
  try {
    var projects = await itData.getProjects();
    res.render('it/admin/index', { projects });
  } catch (e) { next(e); }
});

// ── NEW PROJECT ─────────────────────────────────────────
router.get('/projects/new', requireAuth, function(req, res) {
  res.render('it/admin/project-edit', { projectId: null, project: {} });
});

// ── EDIT PROJECT ─────────────────────────────────────────
router.get('/projects/:id/edit', requireAuth, async function(req, res, next) {
  try {
    var project = await itData.getProject(req.params.id);
    if (!project) return res.status(404).send('Not found');
    res.render('it/admin/project-edit', { projectId: req.params.id, project });
  } catch (e) { next(e); }
});

// ── SAVE PROJECT ─────────────────────────────────────────
router.post('/projects/:id/edit', requireAuth, upload.single('coverImage'), async function(req, res, next) {
  try {
    var id = req.params.id === 'new' ? null : req.params.id;
    var b = req.body;

    var data = {
      name:      b.name      || '',
      slug:      (b.slug     || '').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''),
      short:     b.short     || '',
      tags:      (b.tags     || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean),
      order:     parseInt(b.order, 10) || 0,
      published: b.published === 'on',
      full:      b.full      === 'on',
      role:      b.role      || '',
      period:    b.period    || '',
      stack:     b.stack     || '',
      link:      b.link      || '',
      context:   b.context   || '',
      quote:     b.quote     || '',
      actions:   b.actions   || '',
      result:    b.result    || '',
      metrics:   b.metrics   || '',
    };

    var savedId = await itData.saveProject(id, data);

    // Cover image upload
    if (req.file) {
      var ts = Date.now();
      var ext = 'webp';
      var path = 'it/projects/' + savedId + '/cover-' + ts + '.' + ext;
      var sharp = require('sharp');
      var webp = await sharp(req.file.buffer).resize(1600, null, { withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
      var fileRef = bucket.file(path);
      await fileRef.save(webp, { metadata: { contentType: 'image/webp' } });
      await fileRef.makePublic();
      var coverUrl = 'https://storage.googleapis.com/' + bucket.name + '/' + path;
      await itData.saveProject(savedId, { cover: coverUrl });
    }

    res.redirect('/admin/projects/' + savedId + '/edit');
  } catch (e) { next(e); }
});

// ── DELETE PROJECT ───────────────────────────────────────
router.post('/projects/:id/delete', requireAuth, async function(req, res, next) {
  try {
    await itData.deleteProject(req.params.id);
    res.redirect('/admin/');
  } catch (e) { next(e); }
});

module.exports = router;
