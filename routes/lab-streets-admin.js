'use strict';
// dimazvali.com/lab/streets/admin/ — reviewing the street labelling of every city (ok / not ok / later,
// plus corrections). Auth follows the repo's admin pattern: LAB_ADMIN_PASS is the superadmin, extra admins
// live in Firestore labAdmins with sha256('lab:' + password); the cookie carries the same hash.
// deps: { db, cities: { <id>: { prefix, name, baseData, data, reviews } }, refresh(cityId) → Promise }
var express = require('express');
var A = require('../lib/lab-streets-admin');

var BASE = '/lab/streets/admin';
var COOKIE = 'labAdminToken';

module.exports = function (deps) {
  var router = express.Router();
  var store = A.create(deps.db);
  var cities = deps.cities;

  async function requireAuth(req, res, next) {
    var val = req.cookies && req.cookies[COOKIE];
    var api = req.path.indexOf('/api/') === 0;
    var deny = function () { return api ? res.status(401).json({ error: 'auth' }) : res.redirect(BASE + '/login'); };
    if (!val) return deny();
    var envPass = process.env.LAB_ADMIN_PASS;
    if (envPass && val === A.cookieToken(envPass)) {
      res.locals.adminName = 'admin'; res.locals.adminId = null; res.locals.isSuperadmin = true;
      return next();
    }
    try {
      var admin = await store.getAdminByPasswordHash(val);
      if (admin) {
        res.locals.adminName = admin.name || 'admin'; res.locals.adminId = admin.id; res.locals.isSuperadmin = !!admin.superadmin;
        return next();
      }
    } catch (e) { console.error('[lab-admin] auth:', e.message); }
    deny();
  }
  function requireSuperAdmin(req, res, next) {
    if (res.locals.isSuperadmin) return next();
    res.status(403).send('Доступ запрещён — только для суперадминистратора');
  }
  function cityOf(req) { var id = String((req.query && req.query.city) || (req.body && req.body.city) || ''); return cities[id] ? id : null; }

  router.use(function (req, res, next) { res.set('Cache-Control', 'no-store'); res.set('X-Robots-Tag', 'noindex'); next(); });

  router.get('/login', function (req, res) { res.render('lab/admin/login', { error: null, base: BASE }); });
  router.post('/login', express.urlencoded({ extended: false }), async function (req, res) {
    var pass = String(req.body.pass || '').trim();
    var bad = function (msg) { res.status(401).render('lab/admin/login', { error: msg, base: BASE }); };
    if (!pass) return bad('Введите пароль');
    var hash = A.cookieToken(pass);
    var envPass = process.env.LAB_ADMIN_PASS;
    var ok = !!(envPass && pass === envPass);
    if (!ok) ok = !!(await store.getAdminByPasswordHash(hash).catch(function () { return null; }));
    if (!ok) return bad('Неверный пароль');
    res.cookie(COOKIE, hash, { httpOnly: true, sameSite: 'lax', secure: req.secure, maxAge: 30 * 24 * 60 * 60 * 1000, path: BASE });
    res.redirect(BASE + '/');
  });
  router.get('/logout', function (req, res) { res.clearCookie(COOKIE, { path: BASE }); res.redirect(BASE + '/login'); });

  router.get('/', requireAuth, function (req, res) {
    res.render('lab/admin/review', {
      base: BASE, adminName: res.locals.adminName, isSuperadmin: res.locals.isSuperadmin,
      cities: Object.keys(cities).map(function (id) { return { id: id, name: cities[id].name, cats: cities[id].baseData.cats }; }),
    });
  });

  // ── review API ──
  router.get('/api/stats', requireAuth, function (req, res) {
    var out = {};
    Object.keys(cities).forEach(function (id) { var c = cities[id]; out[id] = A.stats(c.baseData, c.reviews || {}, id); });
    res.json(out);
  });
  router.get('/api/streets', requireAuth, async function (req, res, next) {
    try {
      var id = cityOf(req);
      if (!id) return res.status(400).json({ error: 'city' });
      var c = cities[id];
      var sugg = {};
      (await store.loadSuggestions(c.prefix)).forEach(function (s) {
        // a suggestion stores the street's names, which are the review keys (indexes move between rebuilds)
        var key = id === 'spb' ? s.streetRu : s.streetKa || s.streetRu;
        if (!key) return;
        (sugg[key] = sugg[key] || []).push({ id: s.id, cat: s.cat, text: s.text, contact: s.contact, lang: s.lang, createdAt: s.createdAt });
      });
      // the queue shows the data as served (with corrections) next to what the pipeline produced
      var list = A.listRows(c.data, c.reviews || {}, sugg, id, req.query);
      list.rows.forEach(function (r) { r.originalCat = c.baseData.cats[c.baseData.names[r.idx][0]]; });
      res.json(list);
    } catch (e) { next(e); }
  });
  router.post('/api/review', requireAuth, express.json({ limit: '4kb' }), async function (req, res, next) {
    try {
      var id = cityOf(req);
      if (!id) return res.status(400).json({ error: 'city' });
      var c = cities[id];
      var key = String(req.body.key || '');
      var exists = c.baseData.names.some(function (r) { return A.streetKey(id, r) === key; });
      if (!exists) return res.status(400).json({ error: 'street' });
      var clean = A.cleanReview(req.body, c.baseData.cats);
      if (clean.error) return res.status(400).json(clean);
      var saved = await store.saveReview(id, key, clean, res.locals.adminName, (c.reviews || {})[key]);
      await deps.refresh(id);
      res.json({ ok: true, review: saved });
    } catch (e) { next(e); }
  });
  router.post('/api/suggestions/:id', requireAuth, express.json({ limit: '1kb' }), async function (req, res, next) {
    try {
      var id = cityOf(req);
      if (!id) return res.status(400).json({ error: 'city' });
      var status = req.body.status;
      if (['applied', 'dismissed'].indexOf(status) < 0) return res.status(400).json({ error: 'status' });
      await store.setSuggestionStatus(cities[id].prefix, req.params.id, status, res.locals.adminName);
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  // ── admins (superadmin only) ──
  router.get('/admins', requireAuth, requireSuperAdmin, async function (req, res, next) {
    try { res.render('lab/admin/admins', { base: BASE, admins: await store.getAdmins(), currentAdminId: res.locals.adminId }); } catch (e) { next(e); }
  });
  router.post('/admins', requireAuth, requireSuperAdmin, express.urlencoded({ extended: false }), async function (req, res, next) {
    try {
      var name = String(req.body.name || '').trim().slice(0, 60), pass = String(req.body.password || '').trim();
      if (name && pass.length >= 8) await store.insertAdmin(name, pass, req.body.superadmin === 'on');
      res.redirect(BASE + '/admins');
    } catch (e) { next(e); }
  });
  router.post('/admins/:id/delete', requireAuth, requireSuperAdmin, async function (req, res, next) {
    try { await store.deleteAdmin(req.params.id); res.redirect(BASE + '/admins'); } catch (e) { next(e); }
  });

  return router;
};
