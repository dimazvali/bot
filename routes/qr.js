'use strict';
var express = require('express');
var router = express.Router();
var path = require('path');
var qrData = require('../lib/qr-data');
var qrIndexDict = require('../lib/qr-index-dict');

router.use(express.static(path.join(__dirname, '../public')));

// Admin router and /map must be mounted BEFORE the wildcard :slug route
router.use('/admin', require('./qr-admin'));

router.get('/map', function(req, res) {
  res.render('qr/map', { title: 'Карта — qr.dimazvali.com' });
});

router.get('/', async function(req, res, next) {
  try {
    var entries = await qrData.getAll();
    entries.sort(function(a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
    var mapEntries = entries.filter(function(e) { return e.lat != null && e.lng != null; });
    res.render('qr/index', {
      title: 'ARchive — окна в прошлое',
      entries: entries,
      mapEntries: mapEntries,
      dict: qrIndexDict,
      countText: qrIndexDict.countText('ru', entries.length),
    });
  } catch (e) {
    next(e);
  }
});

router.get('/:slug', async function(req, res, next) {
  try {
    var entry = await qrData.getBySlug(req.params.slug);
    if (!entry) return res.status(404).render('qr/not-found', { title: 'Не найдено' });
    var isAdminPreview = !!(req.cookies && req.cookies.qrAdminToken);
    if (!isAdminPreview) {
      qrData.incrementViews(entry.slug).catch(function(e) {
        console.error('[qr] incrementViews error:', e.message);
      });
    }
    res.render('qr/photo', { title: entry.title + ' — окно в прошлое', entry: entry });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
