'use strict';
var express = require('express');
var router = express.Router();
var path = require('path');
var { initializeApp, getApps, cert } = require('firebase-admin/app');
var { getFirestore } = require('firebase-admin/firestore');
var itData = require('../lib/it-data');

var itApp = getApps().find(function(a) { return a.name === 'it'; }) || initializeApp({
  credential: cert({
    type: 'service_account',
    project_id: 'dimazvalimisc',
    private_key_id: '5eb5025afc0fe53b63f518ba071f89e7b7ce03af',
    private_key: (process.env.sssGCPKey || '').replace(/\\n/g, '\n'),
    client_email: 'firebase-adminsdk-4iwd4@dimazvalimisc.iam.gserviceaccount.com',
    client_id: '110523994931477712119',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-4iwd4%40dimazvalimisc.iam.gserviceaccount.com',
  }),
  storageBucket: process.env.PHOTO_BUCKET,
}, 'it');

var fb = getFirestore(itApp);
itData.init(fb);

router.use(express.static(path.join(__dirname, '../public')));
router.use('/admin', require('./it-admin'));

router.get('/', async function(req, res, next) {
  try {
    var projects = await itData.getProjects({ publishedOnly: true, parse: true });
    res.render('it/home', { projects });
  } catch (e) { next(e); }
});

router.get('/sitemap.xml', async function(req, res) {
  var base = 'https://it.dimazvali.com';
  try {
    var projects = await itData.getProjects({ publishedOnly: true });
    var xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
      + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
      + '  <url><loc>' + base + '/</loc></url>\n';
    for (var p of projects) {
      if (p.slug && p.full) {
        xml += '  <url><loc>' + base + '/' + p.slug + '</loc></url>\n';
      }
    }
    xml += '</urlset>';
    res.set('Content-Type', 'application/xml');
    res.send(xml);
  } catch (e) {
    res.status(500).send('Error generating sitemap');
  }
});

router.get('/robots.txt', function(req, res) {
  res.set('Content-Type', 'text/plain');
  res.send('User-agent: *\nAllow: /\nSitemap: https://it.dimazvali.com/sitemap.xml\n');
});

router.get('/:slug', async function(req, res, next) {
  try {
    var doc = await itData.getProjectBySlug(req.params.slug);
    if (!doc || !doc.full) return res.status(404).render('it/404');
    var project = itData.parseProject(doc);
    var related = [];
    if (doc.companyId) {
      related = await itData.getStoriesByCompany(doc.companyId, doc.id);
    }
    res.render('it/project', { project, related });
  } catch (e) { next(e); }
});

module.exports = router;
