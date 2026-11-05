'use strict';
var express = require('express');
var router = express.Router();
var multer = require('multer');
var { getApps } = require('firebase-admin/app');
var { getFirestore } = require('firebase-admin/firestore');
var { getStorage } = require('firebase-admin/storage');
var itData = require('../lib/it-data');
var storageCache = require('../lib/storage-cache');

var itApp = getApps().find(function(a) { return a.name === 'it'; });
if (!itApp) throw new Error('it-admin: Firebase "it" app not initialized — load it.js first');
var fb = getFirestore(itApp);
var bucket = getStorage(itApp).bucket();
var adminTokens = fb.collection('it_admin_tokens');

var upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: function(req, file, cb) {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Images only'));
    cb(null, true);
  },
});

// ── AUTH ────────────────────────────────────────────────
async function isAdmin(req) {
  var tokenId = req.signedCookies && req.signedCookies.itAdminToken;
  if (!tokenId) return false;
  try {
    return (await adminTokens.doc(tokenId).get()).exists;
  } catch (e) { return false; }
}

async function requireAuth(req, res, next) {
  if (await isAdmin(req)) return next();
  res.redirect('/admin/login');
}
router.isAdmin = isAdmin; // routes/it.js: draft preview of /cv

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
router.get('/projects/new', requireAuth, async function(req, res, next) {
  try {
    var companies = await itData.getCompanies();
    res.render('it/admin/project-edit', { projectId: null, project: {}, companies });
  } catch (e) { next(e); }
});

// ── EDIT PROJECT ─────────────────────────────────────────
router.get('/projects/:id/edit', requireAuth, async function(req, res, next) {
  try {
    var [project, companies] = await Promise.all([
      itData.getProject(req.params.id),
      itData.getCompanies(),
    ]);
    if (!project) return res.status(404).send('Not found');
    res.render('it/admin/project-edit', { projectId: req.params.id, project, companies });
  } catch (e) { next(e); }
});

// ── SAVE PROJECT ─────────────────────────────────────────
router.post('/projects/:id/edit', requireAuth, upload.single('coverImage'), async function(req, res, next) {
  try {
    var id = req.params.id === 'new' ? null : req.params.id;
    var b = req.body;

    var data = {
      name:             b.name             || '',
      slug:             (b.slug || '').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''),
      short:            b.short            || '',
      tags:             (b.tags || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean),
      order:            parseInt(b.order, 10) || 0,
      published:        b.published        === 'on',
      full:             b.full             === 'on',
      role:             b.role             || '',
      period:           b.period           || '',
      stack:            b.stack            || '',
      link:             b.link             || '',
      context:          b.context          || '',
      quote:            b.quote            || '',
      actions:          b.actions          || '',
      result:           b.result           || '',
      metrics:          b.metrics          || '',
      companyId:        b.companyId        || '',
      metaTitle:        b.metaTitle        || '',
      metaDescription:  b.metaDescription  || '',
    };

    var detailTitles = [].concat(b.detail_title || []);
    var detailDescs  = [].concat(b.detail_desc  || []);
    data.details = detailTitles
      .map(function(t, i) { return { title: t.trim(), desc: (detailDescs[i] || '').trim() }; })
      .filter(function(d) { return d.title || d.desc; });

    var savedId = await itData.saveProject(id, data);

    // Cover image upload
    if (req.file) {
      var ts = Date.now();
      var ext = 'webp';
      var path = 'it/projects/' + savedId + '/cover-' + ts + '.' + ext;
      var sharp = require('sharp');
      var webp = await sharp(req.file.buffer).resize(1600, null, { withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
      var fileRef = bucket.file(path);
      await fileRef.save(webp, storageCache.saveOptions('image/webp')); // path has a timestamp — never overwritten
      await fileRef.makePublic();
      var coverUrl = 'https://storage.googleapis.com/' + bucket.name + '/' + path;
      await itData.saveProject(savedId, { cover: coverUrl });
    }

    res.redirect('/admin/projects/' + savedId + '/edit');
  } catch (e) { next(e); }
});

// ── REORDER PROJECTS ─────────────────────────────────────
router.post('/projects/reorder', requireAuth, express.json(), async function(req, res, next) {
  try {
    var ids = req.body.ids;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids required' });
    await itData.reorderProjects(ids);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── DELETE PROJECT ───────────────────────────────────────
router.post('/projects/:id/delete', requireAuth, async function(req, res, next) {
  try {
    await itData.deleteProject(req.params.id);
    res.redirect('/admin/');
  } catch (e) { next(e); }
});

// ── COMPANIES LIST ───────────────────────────────────────
router.get('/companies', requireAuth, async function(req, res, next) {
  try {
    var companies = await itData.getCompanies();
    res.render('it/admin/companies', { companies });
  } catch (e) { next(e); }
});

// ── NEW COMPANY ──────────────────────────────────────────
router.get('/companies/new', requireAuth, function(req, res) {
  res.render('it/admin/company-edit', { companyId: null, company: {} });
});

// ── EDIT COMPANY ─────────────────────────────────────────
router.get('/companies/:id/edit', requireAuth, async function(req, res, next) {
  try {
    var company = await itData.getCompany(req.params.id);
    if (!company) return res.status(404).send('Not found');
    res.render('it/admin/company-edit', { companyId: req.params.id, company });
  } catch (e) { next(e); }
});

// ── SAVE COMPANY ─────────────────────────────────────────
router.post('/companies/:id/edit', requireAuth, express.urlencoded({ extended: false }), async function(req, res, next) {
  try {
    var id = req.params.id === 'new' ? null : req.params.id;
    var b = req.body;
    var data = {
      name:        b.name        || '',
      url:         b.url         || '',
      description: b.description || '',
    };
    var savedId = await itData.saveCompany(id, data);
    res.redirect('/admin/companies/' + savedId + '/edit');
  } catch (e) { next(e); }
});

// ── DELETE COMPANY ───────────────────────────────────────
router.post('/companies/:id/delete', requireAuth, express.urlencoded({ extended: false }), async function(req, res, next) {
  try {
    await itData.deleteCompany(req.params.id);
    res.redirect('/admin/companies');
  } catch (e) { next(e); }
});

// ── CV QUEST (it.dimazvali.com/cv) ───────────────────────
var cvEditor = require('../lib/it-cv-editor');
var cvStore = function() { return require('../lib/it-cv-store').store(); };
var form = express.urlencoded({ extended: false });

function back(res, path, kind, text) {
  res.redirect('/admin/cv' + path + (kind ? (path.indexOf('?') > -1 ? '&' : '?') + kind + '=' + encodeURIComponent(text) : ''));
}

router.get('/cv', requireAuth, async function(req, res, next) {
  try {
    var d = await cvStore().getDraft();
    res.render('it/admin/cv', {
      quest: d.quest, meta: d.meta, check: cvEditor.validate(d.quest), tree: cvEditor.tree(d.quest),
      optionsText: cvEditor.optionsToText(d.quest.intro.options),
      flash: { ok: req.query.ok || null, error: req.query.error || null },
    });
  } catch (e) { next(e); }
});

router.post('/cv/intro', requireAuth, form, async function(req, res, next) {
  try {
    var d = await cvStore().getDraft();
    var r = cvEditor.applyIntro(d.quest, req.body);
    if (r.error) return back(res, '', 'error', r.error);
    await cvStore().saveDraft(r.quest);
    back(res, '', 'ok', 'Черновик сохранён' + (r.created.length ? '. Новые узлы: ' + r.created.join(', ') + ' — заполните их' : ''));
  } catch (e) { next(e); }
});

router.post('/cv/nodes', requireAuth, form, async function(req, res, next) {
  try {
    var d = await cvStore().getDraft();
    var r = cvEditor.addNode(d.quest, req.body.id, req.body.kind);
    if (r.error) return back(res, '', 'error', r.error);
    await cvStore().saveDraft(r.quest);
    back(res, '/nodes/' + req.body.id.trim().toLowerCase(), 'ok', 'Узел создан');
  } catch (e) { next(e); }
});

router.get('/cv/nodes/:id', requireAuth, async function(req, res, next) {
  try {
    var d = await cvStore().getDraft();
    var node = d.quest.nodes[req.params.id];
    if (!node) return back(res, '', 'error', 'Нет узла «' + req.params.id + '»');
    var mode = node.final ? 'final' : node.next ? 'next' : 'question';
    var check = cvEditor.validate(d.quest);
    var mine = new RegExp('«' + req.params.id.replace(/[-]/g, '\\-') + '»');
    res.render('it/admin/cv-node', {
      id: req.params.id, node: node, mode: mode, quest: d.quest,
      refs: cvEditor.referencesTo(d.quest, req.params.id),
      optionsText: cvEditor.optionsToText(node.options),
      errors: check.errors.filter(function(e) { return mine.test(e); }),
      flash: { ok: req.query.ok || null, error: req.query.error || null },
    });
  } catch (e) { next(e); }
});

router.post('/cv/nodes/:id', requireAuth, form, async function(req, res, next) {
  try {
    var d = await cvStore().getDraft();
    var r = cvEditor.applyNode(d.quest, req.params.id, req.body);
    if (r.error) return back(res, '/nodes/' + req.params.id, 'error', r.error);
    await cvStore().saveDraft(r.quest);
    back(res, '/nodes/' + req.params.id, 'ok', 'Сохранено' + (r.created.length ? '. Новые узлы: ' + r.created.join(', ') : ''));
  } catch (e) { next(e); }
});

router.post('/cv/nodes/:id/delete', requireAuth, form, async function(req, res, next) {
  try {
    var d = await cvStore().getDraft();
    var r = cvEditor.deleteNode(d.quest, req.params.id);
    if (r.error) return back(res, '/nodes/' + req.params.id, 'error', r.error);
    await cvStore().saveDraft(r.quest);
    back(res, '', 'ok', 'Узел «' + req.params.id + '» удалён');
  } catch (e) { next(e); }
});

router.post('/cv/publish', requireAuth, form, async function(req, res, next) {
  try {
    var r = await cvStore().publish();
    if (r.errors) return back(res, '', 'error', 'Не опубликовано — в черновике ошибки (список ниже)');
    back(res, '', 'ok', 'Опубликовано: ' + r.steps + ' шага');
  } catch (e) { next(e); }
});

router.post('/cv/discard', requireAuth, form, async function(req, res, next) {
  try {
    await cvStore().discardDraft();
    back(res, '', 'ok', 'Черновик сброшен к опубликованной версии');
  } catch (e) { next(e); }
});

module.exports = router;
