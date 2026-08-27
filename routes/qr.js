'use strict';
var express = require('express');
var router = express.Router();
var path = require('path');
var qrData = require('../lib/qr-data');

router.use(express.static(path.join(__dirname, '../public')));

// Admin router must be mounted BEFORE the wildcard :slug route
router.use('/admin', require('./qr-admin'));

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
