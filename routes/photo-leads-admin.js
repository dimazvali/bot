'use strict';
var express = require('express');
var cron = require('node-cron');
var data = require('../lib/photo-leads-data');
var pipeline = require('../lib/photo-leads-pipeline');
var digest = require('../lib/photo-leads-digest');
var SOURCE_TYPES = require('../lib/photo-leads-collectors').SOURCE_TYPES;

// Mounted by routes/photo-admin.js at /admin/leads behind its requireAuth.
module.exports = function createLeadsAdmin(fb) {
  var router = express.Router();
  data.init(fb);
  data.ensureDefaultSources().catch(function(e) { console.error('[photo-leads] seed', e.message); });

  function send(text) { return digest.sendToAdmins(fb, process.env.dimazvaliToken, text); }

  function runAndReport(opts) {
    return pipeline.run(Object.assign({ deps: { send: send } }, opts)).then(function(r) {
      if (r.skipped) console.log('[photo-leads] run skipped: already running');
      else console.log('[photo-leads] run done', JSON.stringify(r.stats));
    }).catch(function(e) {
      console.error('[photo-leads] run failed', e);
      return send('❌ <b>Лиды на фото — сбор упал</b>\n' + digest.esc(e.message)).catch(function() {});
    });
  }

  cron.schedule('0 9 * * *', function() { runAndReport(); }, { timezone: 'Asia/Tbilisi' });

  function wrap(fn) { return function(req, res, next) { Promise.resolve(fn(req, res, next)).catch(next); }; }

  router.get('/', wrap(async function(req, res) {
    var filters = { zone: req.query.zone || '', status: req.query.status || '', source: req.query.source || '' };
    res.render('photo/admin/leads', {
      title: 'Лиды — photo.dimazvali.com Admin',
      leads: await data.listLeads(filters), filters: filters, sourceTypes: SOURCE_TYPES,
      statuses: data.EDITABLE_STATUSES, running: pipeline.isRunning(), flash: req.query.flash || null,
    });
  }));

  router.post('/run', function(req, res) {
    if (pipeline.isRunning()) return res.redirect('/admin/leads?flash=running');
    runAndReport();
    res.redirect('/admin/leads?flash=started');
  });

  router.get('/sources', wrap(async function(req, res) {
    res.render('photo/admin/lead-sources', {
      title: 'Источники лидов — photo.dimazvali.com Admin',
      sources: (await data.listSources()).sort(function(a, b) { return (a.type + a.value).localeCompare(b.type + b.value); }),
      sourceTypes: SOURCE_TYPES, running: pipeline.isRunning(), error: req.query.error || null,
    });
  }));

  router.post('/sources', wrap(async function(req, res) {
    try {
      await data.addSource({ type: req.body.type, value: req.body.value, city: req.body.city });
      res.redirect('/admin/leads/sources');
    } catch (e) {
      res.redirect('/admin/leads/sources?error=' + encodeURIComponent(e.message));
    }
  }));

  router.post('/sources/:id/toggle', wrap(async function(req, res) {
    await data.setSourceActive(req.params.id, req.body.active === '1');
    res.redirect('/admin/leads/sources');
  }));

  router.post('/sources/:id/delete', wrap(async function(req, res) {
    await data.deleteSource(req.params.id);
    res.redirect('/admin/leads/sources');
  }));

  router.post('/sources/:id/run', function(req, res) {
    if (pipeline.isRunning()) return res.redirect('/admin/leads?flash=running');
    runAndReport({ sourceIds: [req.params.id] });
    res.redirect('/admin/leads?flash=started');
  });

  router.post('/:id', wrap(async function(req, res) {
    var patch = req.body.notLead ? { feedback: 'not_lead', status: 'dismissed' } : { status: req.body.status };
    await data.updateLead(req.params.id, patch);
    res.redirect(req.get('referer') || '/admin/leads');
  }));

  return router;
};
