'use strict';
var express = require('express');
var router = express.Router();
var { cookieToken } = require('../lib/qr-auth');

router.use(express.urlencoded({ extended: false }));

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

module.exports = router;
module.exports.requireAuth = requireAuth;
