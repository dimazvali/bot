'use strict';
var express = require('express');
var router = express.Router();
var crypto = require('crypto');
var pipeline = require('../lib/tbilisi-events-pipeline');
var data = require('../lib/tbilisi-events-data');
var alertMe = require('./common').alertMe;

function formatSummary(summary) {
  var text = '📋 <b>Tbilisi Events — сбор завершён</b>\n'
    + 'Источников обработано: ' + summary.sourcesProcessed + '\n'
    + 'Событий найдено: ' + summary.eventsFound + '\n'
    + 'Новых: ' + summary.eventsNew + '\n'
    + 'Объединено: ' + summary.eventsMerged;
  if (summary.sourceErrors.length) {
    text += '\n⚠️ Ошибок: ' + summary.sourceErrors.length;
    text += '\n' + summary.sourceErrors.slice(0, 10).map(function(e) { return '• ' + e.source + ': ' + e.error; }).join('\n');
  }
  return text;
}

function runCollectInBackground() {
  pipeline.run().then(function(summary) {
    return data.addLog(summary).then(function() { return alertMe({ text: formatSummary(summary), parse_mode: 'HTML' }); });
  }).catch(function(e) {
    var failedSummary = { sourcesProcessed: 0, eventsFound: 0, eventsNew: 0, eventsMerged: 0, sourceErrors: [{ source: 'pipeline', error: e.message }] };
    data.addLog(failedSummary).catch(function() {});
    alertMe({ text: '❌ <b>Tbilisi Events — сбор упал с ошибкой</b>\n' + e.message, parse_mode: 'HTML' }).catch(function() {});
  });
}

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

async function renderIndex(res, extra) {
  var sources = await data.getAllSources().catch(function() { return []; });
  var logs = await data.getRecentLogs(20).catch(function() { return []; });
  res.render('tbilisi-events/admin/index', Object.assign({
    title: 'Tbilisi Events Admin', sources: sources, logs: logs, error: null, sourceError: null, started: false,
  }, extra));
}

router.get('/', requireAuth, async function(req, res) {
  await renderIndex(res, { started: req.query.started === '1' });
});

router.post('/collect', requireAuth, function(req, res) {
  runCollectInBackground();
  res.redirect('/tbilisi-events/admin/?started=1');
});

router.post('/sources', requireAuth, express.urlencoded({ extended: false }), async function(req, res) {
  var sourceError = null;
  try {
    await data.addSource({ type: req.body.type, value: req.body.value, label: req.body.label });
  } catch (e) {
    sourceError = e.message;
  }
  await renderIndex(res, { sourceError: sourceError });
});

module.exports = router;
