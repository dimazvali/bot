'use strict';
// photo.dimazvali.com — redesign v2, served side by side with the live site.
//
// This router does NOT reimplement anything: it mounts the existing
// routes/photo.js untouched (same data, same URLs, same POST endpoints, same
// admin) and only changes what gets *rendered*:
//   • res.render('photo/<page>')  →  views/photo-v2/<page>.pug  (when it exists;
//     admin pages and anything without a v2 twin keep using the old views)
//   • extra template locals (`t` for the new UI strings, `photoColors`, `allTags`)
//   • static assets of the new look live under /stylesheets/photo-v2 and
//     /javascripts/photo-v2 — the old ones stay where they are.
//
// Switching the redesign on for the real address later = pointing the
// 'photo.*.*' vhost in app.js at this router instead of ./photo (and back
// to roll it off). Until then this only answers on photo-v2.*.
var express = require('express');
var fs = require('fs');
var path = require('path');
var { getTags } = require('../lib/photo-tags');
var { getPhotoColorFamilies } = require('../lib/color-utils');
var i18n = require('../lib/photo-i18n');
var V2_UI = require('../lib/photo-v2-strings');
var siteTexts = require('../lib/photo-site-texts');
var shoots = require('../lib/photo-shoots');
var { getData } = require('../lib/photo-data');
var notFound = require('../lib/photo-404');
var downloads = require('../lib/photo-downloads');

var router = express.Router();

var OTHER_SHOOTS_LIMIT = 12; // how many open shoots the "Other shoots" block shows (routes/photo.js gives 3)

// The preview host (photo-v2.*) must never compete with the real site in search results. The same router
// also serves photo.* (production) — there nothing is blocked and routes/photo.js answers robots.txt/sitemap.
function isPreviewHost(req) {
  return /^photo-v2\./i.test(req.hostname || '');
}
router.use(function(req, res, next) {
  if (isPreviewHost(req)) res.set('X-Robots-Tag', 'noindex, nofollow');
  next();
});
router.get(['/robots.txt', '/en/robots.txt'], function(req, res, next) {
  if (!isPreviewHost(req)) return next();
  res.type('text/plain').send('User-agent: *\nDisallow: /\n');
});

var _viewExists = {};
function v2ViewFor(view) {
  // only the public 'photo/<page>' views have v2 twins; 'photo/admin/*' stays as is
  if (!/^photo\/(?!admin\/)/.test(view)) return view;
  var candidate = view.replace(/^photo\//, 'photo-v2/');
  if (_viewExists[candidate] === undefined) {
    _viewExists[candidate] = fs.existsSync(path.join(__dirname, '../views', candidate + '.pug'));
  }
  return _viewExists[candidate] ? candidate : view;
}

// Every dead link ends up here: routes/photo.js renders the shared 'error' view with status 404 (unknown tag,
// colour, shoot…) or nothing matches at all (see the catch-all at the bottom). Both get the redesigned 404 page,
// plus a Telegram heads-up (lib/photo-404.js) for real visitors on the production host.
function random(list, n) {
  var a = list.slice();
  for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
  return a.slice(0, n);
}
function notFoundLocals(res, lang) {
  var LP = i18n.langPrefix(lang);
  var data = i18n.localizeDataTree(getData(), lang);
  var series = [], frames = [];
  Object.keys(data).forEach(function(ck) {
    var c = data[ck];
    if (c.archived || c.hiddenFromFeed) return;
    (c.seriesOrder || Object.keys(c.series)).forEach(function(sk) {
      var s = c.series[sk];
      if (!s || s.archived || !s.photos || !s.photos.length) return;
      var cover = s.photos[0];
      series.push({ href: LP + '/' + ck + '/' + sk, label: s.label, sub: c.label + ' · ' + s.photos.length + ' ' + res.locals.ui.photosSuffix,
                    cover: cover.urls ? cover.urls.preview : '/images/photo/' + ck + '/' + sk + '/' + cover.file });
      s.photos.forEach(function(p) { frames.push(LP + '/' + ck + '/' + sk + '/' + p.id); });
    });
  });
  return { data: data, activeCountry: null, activeSeries: null, nfTiles: random(series, 4), randomHref: frames.length ? random(frames, 1)[0] : null };
}

router.use(function(req, res, next) {
  var origRender = res.render;
  res.render = function(view, options, cb) {
    if (typeof options === 'function') { cb = options; options = {}; }
    var lang = res.locals.lang === 'en' ? 'en' : 'ru';
    if (view === 'error' && res.statusCode === 404) {
      notFound.notifyNotFound(req, { lang: lang, isAdmin: !!res.locals.isAdmin });
      var nfOpts = Object.assign({
        v2: true, t: Object.assign({}, V2_UI[lang], siteTexts.get(lang)), title: V2_UI[lang].notFoundTitle + ' — photo.dimazvali.com',
        noindex: true, isShoot: false, hasFilterbar: false, breadcrumbs: null, ogUrl: null, ogImage: null,
        allTags: {}, photoColors: getPhotoColorFamilies,
      }, notFoundLocals(res, lang));
      return origRender.call(res, 'photo-v2/404', nfOpts, cb);
    }
    var v2view = v2ViewFor(view);
    if (v2view === view) return origRender.call(res, view, options, cb);
    var opts = Object.assign({
      v2: true,
      t: Object.assign({}, V2_UI[lang], siteTexts.get(lang)),
      allTags: i18n.localizeTags(getTags(), lang),
      photoColors: getPhotoColorFamilies,
      // layout needs to know up front whether this page carries the unified filter bar
      // (child-template variables aren't visible to the layout)
      hasFilterbar: /^photo\/(gallery|tag-gallery|color-gallery)$/.test(view) && !(options && options.isShoot && options.shootSlug),
    }, options);
    // shoot photo page: minimal list (id + urls) of the shoot's frames, for the neighbour preloader
    if (view === 'photo/photo' && options && options.isShoot && options.shootSlug) {
      var sh = shoots.getShoot(options.shootSlug);
      opts.nearList = sh ? sh.photos.map(function(p) { return { id: p.id, urls: p.urls }; }) : [];
    }
    // "Other shoots" under a shoot gallery: routes/photo.js hands over only the 3 biggest. When no curated
    // "related shoots" are set (that list wins and stays as is), show more of the open ones.
    if (view === 'photo/gallery' && options && options.isShoot && options.shootSlug && !options.otherShootsAreRelated) {
      var allShoots = shoots.getData();
      opts.otherShoots = Object.keys(allShoots)
        .map(function(k) { return allShoots[k]; })
        .filter(function(s) { return s.key !== options.shootSlug && s.public && s.photos && s.photos.length; })
        .sort(function(a, b) { return b.photos.length - a.photos.length; })
        .slice(0, OTHER_SHOOTS_LIMIT)
        .map(function(s) { return i18n.localizeShoot(s, lang); });
    }
    // shoot pages, admin only: download counters (zip / selection / Instagram JPG)
    if (options && options.isShoot && options.shootSlug && res.locals.isAdmin && (view === 'photo/gallery' || view === 'photo/photo')) {
      opts.downloadStats = downloads.stats(options.shootSlug, options.photo && options.photo.id);
    }
    return origRender.call(res, v2view, opts, cb);
  };
  next();
});

var photoAdmin = require('./photo-admin');

// Firestore handle: photo-admin has just created the 'photo' firebase app; none in the local fixture preview
// (texts then live in memory only).
try {
  var fbApp = require('firebase-admin/app').getApps().find(function(a) { return a.name === 'photo'; });
  var fsDb = fbApp ? require('firebase-admin/firestore').getFirestore(fbApp) : null;
  siteTexts.init(fsDb).catch(console.error);
  downloads.init(fsDb).catch(console.error);
} catch (e) { console.error('[photo-v2] site texts init:', e.message); }

// /admin/site-texts — edit the home page copy. Lives only in this router (the live photo-admin is untouched),
// same admin cookie/auth as the rest of /admin.
async function requireAdmin(req, res, next) {
  if (await photoAdmin.checkAdminToken(req)) return next();
  res.redirect('/admin/login');
}
router.get('/admin/site-texts', requireAdmin, function(req, res) {
  res.render('photo-v2/admin-site-texts', {
    title: 'Тексты главной — photo.dimazvali.com Admin',
    saved: !!req.query.saved,
    values: { ru: siteTexts.get('ru'), en: siteTexts.get('en') },
    defaults: { ru: V2_UI.ru, en: V2_UI.en },
    max: siteTexts.MAX_LEN,
  });
});
router.post('/admin/site-texts', requireAdmin, express.urlencoded({ extended: false }), async function(req, res) {
  var raw = { ru: {}, en: {} };
  ['ru', 'en'].forEach(function(lang) {
    siteTexts.KEYS.forEach(function(k) { raw[lang][k] = req.body[lang + '_' + k]; });
  });
  try {
    await siteTexts.save(raw);
    res.redirect('/admin/site-texts?saved=1');
  } catch (e) {
    console.error('[site-texts] save failed:', e.message);
    res.status(500).send('Не удалось сохранить');
  }
});

// count shoot downloads (the handlers themselves live in routes/photo.js and run untouched right after these)
router.get(/^(?:\/en)?\/shoot\/[^/]+\/download$/, downloads.middleware('zip', shoots.getShoot));
router.get(/^(?:\/en)?\/shoot\/[^/]+\/[^/]+\/download-instagram$/, downloads.middleware('ig', shoots.getShoot));

router.use(require('./photo'));

// nothing above matched (unknown path, deeper URLs, missing files): same 404 page
router.use(function(req, res) {
  res.status(404).render('error', { message: 'Not found', error: {} });
});

module.exports = router;
