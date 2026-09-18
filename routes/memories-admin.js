'use strict';
var express = require('express');
var router = express.Router();
var { getApps } = require('firebase-admin/app');
var memoriesData = require('../lib/memories-data');
var { cookieToken } = require('../lib/memories-auth');

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

router.get('/', requireAuth, function(req, res) {
  res.send('Logged in as ' + (res.locals.adminName || 'admin'));
});

module.exports = router;
