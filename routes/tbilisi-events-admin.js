'use strict';
var express = require('express');
var router = express.Router();
var crypto = require('crypto');
var pipeline = require('../lib/tbilisi-events-pipeline');
var sources = require('../lib/tbilisi-events-sources');

function cookieToken(pass) {
  return crypto.createHash('sha256').update('tbilisiEvents:' + pass).digest('hex');
}

function requireAuth(req, res, next) {
  var val = req.cookies && req.cookies.tbilisiEventsAdminToken;
  var envPass = process.env.TBILISI_EVENTS_ADMIN_PASS;
  if (val && envPass && val === cookieToken(envPass)) return next();
  res.redirect('/tbilisi-events/admin/login');
}

router.get('/login', function(req, res) {
  res.render('tbilisi-events/admin/login', { title: 'Вход — Tbilisi Events Admin', error: null });
});

router.post('/login', express.urlencoded({ extended: false }), function(req, res) {
  var pass = (req.body.pass || '').trim();
  var envPass = process.env.TBILISI_EVENTS_ADMIN_PASS;
  if (!pass || !envPass || pass !== envPass) {
    return res.render('tbilisi-events/admin/login', { title: 'Вход — Tbilisi Events Admin', error: 'Неверный пароль' });
  }
  res.cookie('tbilisiEventsAdminToken', cookieToken(pass), { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 });
  res.redirect('/tbilisi-events/admin/');
});

router.get('/logout', function(req, res) {
  res.clearCookie('tbilisiEventsAdminToken');
  res.redirect('/tbilisi-events/admin/login');
});

router.get('/', requireAuth, function(req, res) {
  res.render('tbilisi-events/admin/index', { title: 'Tbilisi Events Admin', sourceCount: sources.length, summary: null, error: null });
});

router.post('/collect', requireAuth, async function(req, res) {
  try {
    var summary = await pipeline.run();
    res.render('tbilisi-events/admin/index', { title: 'Tbilisi Events Admin', sourceCount: sources.length, summary: summary, error: null });
  } catch (e) {
    res.render('tbilisi-events/admin/index', { title: 'Tbilisi Events Admin', sourceCount: sources.length, summary: null, error: e.message });
  }
});

module.exports = router;
