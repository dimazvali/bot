var express = require('express');
var router = express.Router();
var path = require('path');
var axios = require('axios');
var { getData } = require('../lib/photo-data');
var { getTags } = require('../lib/photo-tags');
var { trackView, BOT_UA_RE } = require('../lib/photo-stats');
var { COLOR_FAMILIES } = require('../lib/color-utils');
var subscriptions = require('../lib/photo-subscriptions');
var photoUsers = require('../lib/photo-users');
var { OAuth2Client } = require('google-auth-library');
var { buildPageKeywords, BASE_KEYWORDS } = require('../lib/photo-seo');
var crypto = require('crypto');
var archiver = require('archiver');
var shoots = require('../lib/photo-shoots');
var photoPeople = require('../lib/photo-people');
var i18n = require('../lib/photo-i18n');

function shootCookieToken(password, slug) {
  var secret = process.env.papersToken;
  return crypto.createHmac('sha256', secret).update(slug + ':' + password).digest('hex');
}

var DIMA_CHAT_ID = 144489840;
var shootNotifLastSent = {};

function tgSend(text) {
  var token = process.env.dimazvaliToken;
  if (!token) return;
  axios.post('https://api.telegram.org/bot' + token + '/sendMessage', {
    chat_id: DIMA_CHAT_ID,
    text: text,
    parse_mode: 'HTML',
  }).catch(function(e) { console.error('tg:', e.message); });
}

router.use(express.static(path.join(__dirname, '../public')));

// Admin router must be mounted BEFORE wildcard routes
var photoAdmin = require('./photo-admin');
router.use('/admin', photoAdmin);
router.use('/og', require('./photo-og'));
router.use('/photo-comments', require('./photo-comments'));

// EN lives at /en/*, RU stays exactly where it is (no prefix — so nothing about
// the existing, already-indexed RU URLs changes). Strip the /en prefix from
// req.url here so every route below stays written once and serves both
// languages; req.lang says which. See lib/photo-i18n.js for the localization
// helpers and UI strings, and views/photo/layout.pug for the resulting
// canonical/hreflang tags and language switcher.
router.use(function(req, res, next) {
  var m = req.url.match(/^\/en(\/.*)?$/);
  if (m) {
    req.lang = 'en';
    req.url = m[1] || '/';
  } else {
    req.lang = 'ru';
  }

  // One-time, first-visit nudge: if this browser has never been through this check
  // before and Accept-Language clearly prefers English, send it to the /en version
  // once and remember we've decided (cookie) — never repeats, skips bots/crawlers
  // and non-page requests, and never redirects a *returning* visitor away from a
  // URL they specifically navigated to (that would break bookmarks/shared links and
  // fight the self-referencing canonical each language version relies on).
  if (
    req.method === 'GET' &&
    req.lang === 'ru' &&
    !(req.signedCookies && req.signedCookies.photoLangSeen) &&
    !BOT_UA_RE.test(req.headers['user-agent'] || '') &&
    (req.headers.accept || '').indexOf('text/html') !== -1 &&
    !/\.(xml|txt)$/i.test(req.path)
  ) {
    var preferred = i18n.pickPreferredLang(req.headers['accept-language']);
    res.cookie('photoLangSeen', preferred, { signed: true, httpOnly: true, maxAge: 180 * 24 * 60 * 60 * 1000 });
    if (preferred === 'en') {
      return res.redirect(302, '/en' + req.url);
    }
  }

  res.locals.lang = req.lang;
  res.locals.ui = i18n.UI[req.lang];
  res.locals.currentPath = req.path;
  res.locals.colorFamilies = i18n.localizeColorFamilies(COLOR_FAMILIES, req.lang);
  res.locals.activeColorFamily = null;
  res.locals.isAdmin = !!(req.signedCookies && req.signedCookies.photoAdminToken);
  res.locals.subStatus = req.query.sub || null;
  try {
    var raw = req.signedCookies && req.signedCookies.photoUser;
    res.locals.photoUser = raw ? JSON.parse(raw) : null;
  } catch (e) { res.locals.photoUser = null; }
  res.locals.googleClientId = process.env.GOOGLE_CLIENT_ID || '';
  next();
});

var BASE = 'https://photo.dimazvali.com';

// Full URL of the given (unprefixed) path in the given language.
function pageUrl(lang, p) { return BASE + i18n.langPrefix(lang) + p; }

function ogImg(photo) {
  return photo && photo.urls ? photo.urls.preview : null;
}

function getActiveSeries(country) {
  var order = country.seriesOrder || Object.keys(country.series);
  return order.filter(k => country.series[k] && !country.series[k].archived);
}

// data must already be localized (i18n.localizeDataTree) by the caller.
function getAllPhotos(data) {
  var list = [];
  for (var countryKey of Object.keys(data)) {
    var country = data[countryKey];
    if (country.archived || country.hiddenFromFeed) continue;
    for (var seriesKey of getActiveSeries(country)) {
      var series = country.series[seriesKey];
      for (var photo of series.photos) {
        list.push({ countryKey, seriesKey, ...photo });
      }
    }
  }
  return list;
}

// GET / — full gallery (all photos)
router.get('/', (req, res) => {
  var lang = req.lang;
  var data = i18n.localizeDataTree(getData(), lang);
  var photos = getAllPhotos(data);
  var tags = i18n.localizeTags(getTags(), lang);
  res.render('photo/gallery', {
    data,
    activeCountry: null,
    activeSeries: null,
    photos,
    title: 'photo.dimazvali.com',
    desc: lang === 'en'
      ? 'Aerial photography — Dmitry Shestakov. Documentary series shot from the air.'
      : 'Аэрофотосъёмка — Дмитрий Шестаков. Серийная документальная фотография с воздуха.',
    keywords: buildPageKeywords(photos, tags, Object.keys(data).map(k => data[k].label)),
    ogImage: ogImg(photos[0]),
    ogUrl: pageUrl(lang, '/'),
    breadcrumbs: null,
  });
});

// GET /about
router.get('/about', (req, res) => {
  var lang = req.lang;
  res.render('photo/about', {
    data: i18n.localizeDataTree(getData(), lang),
    title: lang === 'en' ? 'About — photo.dimazvali.com' : 'О себе — photo.dimazvali.com',
    desc: lang === 'en'
      ? 'Dmitry Shestakov — aerial photographer. I shoot documentary series from the air.'
      : 'Дмитрий Шестаков — аэрофотограф. Снимаю документальные серии с воздуха.',
    ogImage: null,
    ogUrl: pageUrl(lang, '/about'),
    breadcrumbs: [{ name: lang === 'en' ? 'About' : 'О себе', url: pageUrl(lang, '/about') }],
    sent: req.query.sent || null,
  });
});

// POST /contact
router.post('/contact', express.urlencoded({ extended: false }), (req, res) => {
  var email = (req.body.email || '').trim().slice(0, 200);
  var message = (req.body.message || '').trim().slice(0, 2000);
  if (message) {

    tgSend('<b>📬 Сообщение с photo.dimazvali.com</b>\n' + (email ? 'От: ' + email + '\n' : '') + '\n' + message);
  }
  res.redirect(i18n.langPrefix(req.lang) + '/about?sent=contact');
});

// POST /review
router.post('/review', express.urlencoded({ extended: false }), (req, res) => {
  var name = (req.body.name || '').trim().slice(0, 100);
  var text = (req.body.text || '').trim().slice(0, 2000);
  if (text) {
    tgSend('<b>⭐ Отзыв с photo.dimazvali.com</b>\n' + (name ? 'Автор: ' + name + '\n' : '') + '\n' + text);
  }
  res.redirect(i18n.langPrefix(req.lang) + '/about?sent=review');
});

// GET /tag/:slug — gallery filtered by tag
router.get('/tag/:slug', (req, res) => {
  var lang = req.lang;
  var { slug } = req.params;
  var tags = i18n.localizeTags(getTags(), lang);
  if (!tags[slug]) return res.status(404).render('error', { message: 'Not found', error: {} });
  var data = i18n.localizeDataTree(getData(), lang);
  var photos = getAllPhotos(data).filter(p => p.tags && p.tags.includes(slug));
  res.render('photo/tag-gallery', {
    data,
    activeCountry: null,
    activeSeries: null,
    tagLabel: tags[slug].label,
    tagDesc: tags[slug].desc || null,
    tagSlug: slug,
    photos,
    title: `${tags[slug].label} — photo.dimazvali.com`,
    desc: tags[slug].desc || (lang === 'en'
      ? `${photos.length} aerial photos on "${tags[slug].label}" — Dmitry Shestakov`
      : `${photos.length} аэрофотоснимков по теме «${tags[slug].label}» — Дмитрий Шестаков`),
    keywords: tags[slug].label + ', ' + BASE_KEYWORDS,
    ogImage: ogImg(photos[0]),
    ogUrl: pageUrl(lang, `/tag/${slug}`),
    breadcrumbs: [{ name: tags[slug].label, url: pageUrl(lang, `/tag/${slug}`) }],
  });
});

// GET /color/:family — gallery filtered by color
router.get('/color/:family', function(req, res) {
  var lang = req.lang;
  var { family } = req.params;
  if (!COLOR_FAMILIES[family]) return res.status(404).render('error', { message: 'Not found', error: {} });
  var data = i18n.localizeDataTree(getData(), lang);
  var photos = getAllPhotos(data).filter(function(p) { return p.colorFamily === family; });
  var info = i18n.localizeColorFamilies(COLOR_FAMILIES, lang)[family];
  res.render('photo/color-gallery', {
    data,
    activeCountry: null,
    activeSeries: null,
    activeColorFamily: family,
    colorLabel: info.label,
    photos,
    title: info.label + ' — photo.dimazvali.com',
    desc: lang === 'en' ? info.label + ' — aerial photography by Dmitry Shestakov' : info.label + ' — аэрофотосъёмка Дмитрия Шестакова',
    keywords: info.label + ', ' + BASE_KEYWORDS,
    ogImage: ogImg(photos[0]),
    ogUrl: pageUrl(lang, '/color/' + family),
    breadcrumbs: [{ name: info.label, url: pageUrl(lang, '/color/' + family) }],
  });
});

// POST /:country/:series/:id/inquiry — photo inquiry form
router.post('/:country/:series/:id/inquiry', express.urlencoded({ extended: false }), async (req, res) => {
  var lang = req.lang;
  var { country: countryKey, series: seriesKey, id } = req.params;
  var data = getData();
  var country = data[countryKey];
  if (!country || country.archived) return res.status(404).send('Not found');
  var series = country.series[seriesKey];
  if (!series || series.archived) return res.status(404).send('Not found');
  var photo = series.photos.find(function(p) { return p.id === id; });
  if (!photo) return res.status(404).send('Not found');

  var name    = (req.body.name    || '').trim();
  var email   = (req.body.email   || '').trim().toLowerCase();
  var type    = ['print', 'license', 'other'].includes(req.body.type) ? req.body.type : 'other';
  var message = (req.body.message || '').trim().substring(0, 1000);

  var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!name || !emailRe.test(email)) {
    return res.redirect(i18n.langPrefix(lang) + `/${countryKey}/${seriesKey}/${id}?inquiry=err`);
  }

  try {
    var { sendMessage2 } = require('./methods');
    var typeLabel = { print: 'Отпечаток', license: 'Лицензия', other: 'Вопрос' }[type] || type;
    var photoUrl = BASE + '/' + countryKey + '/' + seriesKey + '/' + id;
    var text = '📷 <b>Заявка: ' + typeLabel + '</b>\n'
      + 'Фото: <a href="' + photoUrl + '">' + photo.title + '</a>\n'
      + 'Имя: ' + name + '\n'
      + 'Email: ' + email
      + (message ? '\n\n' + message : '');
    await sendMessage2({ chat_id: 144489840, text, parse_mode: 'HTML' }, false, process.env.dimazvaliToken);
  } catch (e) {
    console.error('[inquiry]', e.message);
  }

  res.redirect(i18n.langPrefix(lang) + `/${countryKey}/${seriesKey}/${id}?inquiry=ok`);
});

// POST /:country/:series/:id/review — photo review
router.post('/:country/:series/:id/review', express.urlencoded({ extended: false }), async (req, res) => {
  var lang = req.lang;
  var { country: countryKey, series: seriesKey, id } = req.params;
  var data = getData();
  var country = data[countryKey];
  if (!country) return res.status(404).send('Not found');
  var series = country.series && country.series[seriesKey];
  if (!series) return res.status(404).send('Not found');
  var photo = series.photos.find(function(p) { return p.id === id; });
  if (!photo) return res.status(404).send('Not found');

  var name = (req.body.name || '').trim().slice(0, 100);
  var text = (req.body.text || '').trim().slice(0, 2000);
  if (text) {
    try {
      var { sendMessage2 } = require('./methods');
      var photoUrl = BASE + '/' + countryKey + '/' + seriesKey + '/' + id;
      var msg = '⭐ <b>Отзыв</b>\n'
        + 'Фото: <a href="' + photoUrl + '">' + photo.title + '</a>\n'
        + (name ? 'Автор: ' + name + '\n' : '')
        + '\n' + text;
      await sendMessage2({ chat_id: 144489840, text: msg, parse_mode: 'HTML' }, false, process.env.dimazvaliToken);
    } catch (e) { console.error('[review]', e.message); }
  }
  res.redirect(i18n.langPrefix(lang) + '/' + countryKey + '/' + seriesKey + '/' + id + '?review=ok');
});

// GET /sitemap.xml — RU (unprefixed) and EN (/en/...) URLs, cross-linked with hreflang
router.get('/sitemap.xml', (req, res) => {
  var base = 'https://photo.dimazvali.com';
  var data = getData();
  var tags = getTags();

  // entries: { url(lang), lastmod?, image? }
  var entries = [];
  function addPair(p, lastmod, image) {
    entries.push({ url: p, ru: base + p, en: base + '/en' + p, lastmod, image });
  }

  addPair('/', null);
  addPair('/about', null);

  for (var slug of Object.keys(tags)) addPair('/tag/' + slug, null);
  for (var family of Object.keys(COLOR_FAMILIES)) addPair('/color/' + family, null);

  for (var countryKey of Object.keys(data)) {
    var country = data[countryKey];
    if (country.archived) continue;
    var countryDates = [];
    for (var seriesKey of getActiveSeries(country)) {
      var series = country.series[seriesKey];
      var seriesDates = series.photos.map(function(p) { return p.createdAt || ''; }).filter(Boolean);
      var seriesLastmod = seriesDates.length ? seriesDates.sort().pop() : null;
      if (seriesLastmod) countryDates.push(seriesLastmod);
      addPair('/' + countryKey + '/' + seriesKey, seriesLastmod);
      for (var photo of series.photos) {
        var img = (photo.urls && (photo.urls.full || photo.urls.preview))
          ? { loc: photo.urls.full || photo.urls.preview, title: photo.title }
          : null;
        addPair('/' + countryKey + '/' + seriesKey + '/' + photo.id, photo.createdAt || null, img);
      }
    }
    addPair('/' + countryKey, countryDates.length ? countryDates.sort().pop() : null);
  }

  var allShoots = shoots.getData();
  for (var shootSlug of Object.keys(allShoots)) {
    var shoot = allShoots[shootSlug];
    if (!shoot.public) continue;
    var shootDates = shoot.photos.map(function(p) { return p.createdAt || ''; }).filter(Boolean).sort();
    var shootLastmod = shootDates.length ? shootDates[shootDates.length - 1] : null;
    addPair('/shoot/' + shootSlug, shootLastmod);
    for (var sp of shoot.photos) {
      var spImg = (sp.urls && sp.urls.full) ? { loc: sp.urls.full, title: sp.title } : null;
      addPair('/shoot/' + shootSlug + '/' + sp.id, sp.createdAt || null, spImg);
    }
  }

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  var xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n'
    + '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"\n'
    + '        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';
  entries.forEach(function(e) {
    [['ru', e.ru], ['en', e.en]].forEach(function(pair) {
      var loc = pair[1];
      xml += '  <url>\n    <loc>' + loc + '</loc>\n';
      if (e.lastmod) xml += '    <lastmod>' + e.lastmod + '</lastmod>\n';
      xml += '    <xhtml:link rel="alternate" hreflang="ru" href="' + e.ru + '"/>\n';
      xml += '    <xhtml:link rel="alternate" hreflang="en" href="' + e.en + '"/>\n';
      xml += '    <xhtml:link rel="alternate" hreflang="x-default" href="' + e.ru + '"/>\n';
      if (e.image) {
        xml += '    <image:image>\n'
          + '      <image:loc>' + e.image.loc + '</image:loc>\n'
          + '      <image:title>' + esc(e.image.title) + '</image:title>\n'
          + '    </image:image>\n';
      }
      xml += '  </url>\n';
    });
  });
  xml += '</urlset>';

  res.set('Content-Type', 'application/xml');
  res.send(xml);
});

// GET /robots.txt
router.get('/robots.txt', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send('User-agent: *\nAllow: /\nSitemap: https://photo.dimazvali.com/sitemap.xml\n');
});

// GET /{indexnow-key}.txt — IndexNow key verification
var INDEX_NOW_KEY = process.env.INDEX_NOW_KEY || '3d8e3d1e2ccb44dab475e7949fc9fcc8';
router.get('/' + INDEX_NOW_KEY + '.txt', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(INDEX_NOW_KEY);
});

// POST /subscribe/google
var _googleClient = null;
function getGoogleClient() {
  if (!_googleClient) _googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  return _googleClient;
}

router.post('/subscribe/google', express.json(), async (req, res) => {
  var credential = req.body && req.body.credential;
  if (!credential) return res.status(400).json({ ok: false });
  try {
    var ticket = await getGoogleClient().verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    var payload = ticket.getPayload();
    var user = { googleId: payload.sub, email: payload.email, name: payload.name, picture: payload.picture, subscribed: true };
    await photoUsers.upsertSubscriber(user);
    res.cookie('photoUser', JSON.stringify(user), { signed: true, httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 });
    res.json({ ok: true });
  } catch (e) {
    console.error('[subscribe/google]', e.message);
    res.status(401).json({ ok: false });
  }
});

// POST /unsubscribe/google
router.post('/unsubscribe/google', async (req, res) => {
  var user = res.locals.photoUser;
  if (user && user.googleId) {
    await photoUsers.unsubscribe(user.googleId).catch(() => {});
    var updated = Object.assign({}, user, { subscribed: false });
    res.cookie('photoUser', JSON.stringify(updated), { signed: true, httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 });
  }
  res.json({ ok: true });
});

// GET /unsubscribe
router.get('/unsubscribe', async (req, res) => {
  var lang = req.lang;
  var { token } = req.query;
  var ok = false;
  if (token) {
    var r1 = await subscriptions.unsubscribe(token).catch(() => false);
    var r2 = await photoUsers.unsubscribeByToken(token).catch(() => false);
    ok = r1 || r2;
  }
  res.render('photo/unsubscribe', {
    title: (lang === 'en' ? 'Unsubscribe' : 'Отписка') + ' — photo.dimazvali.com',
    ok,
    data: i18n.localizeDataTree(getData(), lang),
    ogImage: null, ogUrl: null, breadcrumbs: null,
  });
});

// ── Shoots ──────────────────────────────────────────────────────────────────

async function isAdmin(req) {
  return photoAdmin.checkAdminToken(req);
}

function getOtherOpenShoots(currentSlug, limit) {
  var allShoots = shoots.getData();
  return Object.keys(allShoots)
    .map(function(key) { return allShoots[key]; })
    .filter(function(shoot) { return shoot.key !== currentSlug && shoot.public && shoot.photos.length; })
    .sort(function(a, b) { return b.photos.length - a.photos.length; })
    .slice(0, limit || 3);
}

// Curated "related shoots" (e.g. other sessions with the same model) win over the
// generic "other open shoots" fallback, once filtered down to what's actually public.
function getRelatedShoots(shoot, currentSlug) {
  var allShoots = shoots.getData();
  var related = (shoot.relatedShoots || [])
    .map(function(slug) { return allShoots[slug]; })
    .filter(function(s) { return s && s.key !== currentSlug && s.public && s.photos.length; });
  if (related.length) return { shoots: related.slice(0, 6), related: true };
  return { shoots: getOtherOpenShoots(currentSlug), related: false };
}

function requireShootAuth(shoot, slug, req, res, adminUser, next) {
  if (!shoot.password || adminUser) return next();
  var cookieKey = 'shoot_' + slug;
  if (req.signedCookies && req.signedCookies[cookieKey] === shootCookieToken(shoot.password, slug)) return next();
  return res.render('photo/shoot-password', {
    title: shoot.label + ' — photo.dimazvali.com',
    slug,
    label: i18n.pickField(shoot, 'label', req.lang),
    error: false,
    data: i18n.localizeDataTree(getData(), req.lang),
    activeCountry: null,
    activeSeries: null,
    ogImage: null,
    ogUrl: null,
    breadcrumbs: null,
    noindex: true,
  });
}

// GET /shoot — список открытых съёмок (без пароля)
router.get('/shoot', (req, res) => {
  var lang = req.lang;
  var allShoots = shoots.getData();
  var openShoots = Object.keys(allShoots)
    .map(function(slug) { return i18n.localizeShoot(allShoots[slug], lang); })
    .filter(function(shoot) { return shoot.public; });

  res.render('photo/shoots', {
    data: i18n.localizeDataTree(getData(), lang),
    activeCountry: null,
    activeSeries: null,
    isShoot: true,
    shoots: openShoots,
    title: (lang === 'en' ? 'Shoots' : 'Съёмки') + ' — photo.dimazvali.com',
    desc: lang === 'en' ? 'Open shoots — Dmitry Shestakov' : 'Открытые съёмки — Дмитрий Шестаков',
    keywords: null,
    ogImage: openShoots.length ? ogImg(openShoots[0].photos[0]) : null,
    ogUrl: pageUrl(lang, '/shoot'),
    breadcrumbs: [{ name: lang === 'en' ? 'Shoots' : 'Съёмки', url: pageUrl(lang, '/shoot') }],
  });
});

// GET /shoot/:slug — галерея съёмки
router.get('/shoot/:slug', async (req, res) => {
  var lang = req.lang;
  var { slug } = req.params;
  var rawShoot = shoots.getShoot(slug);
  if (!rawShoot) return res.status(404).render('error', { message: 'Not found', error: {} });
  var adminUser = await isAdmin(req);

  requireShootAuth(rawShoot, slug, req, res, adminUser, function() {
    var shoot = i18n.localizeShoot(rawShoot, lang);
    trackView('shoot', slug, req.path, req);
    if (!adminUser && !BOT_UA_RE.test(req.headers['user-agent'] || '')) {
      var now = Date.now();
      if (!shootNotifLastSent[slug] || now - shootNotifLastSent[slug] > 60 * 60 * 1000) {
        shootNotifLastSent[slug] = now;
        tgSend('<b>👁 Съёмка открыта</b>\n' + rawShoot.label + '\n/shoot/' + slug);
      }
    }
    var relatedInfo = getRelatedShoots(rawShoot, slug);
    res.render('photo/gallery', {
      data: i18n.localizeDataTree(getData(), lang),
      activeCountry: null,
      activeSeries: null,
      isShoot: true,
      shootSlug: slug,
      shootLabel: shoot.label,
      photos: shoot.photos,
      activeTags: [],
      title: shoot.label + ' — photo.dimazvali.com',
      desc: shoot.desc || null,
      keywords: null,
      ogImage: shoot.photos.length ? `${BASE}/og/shoot/${slug}.jpg` : null,
      ogUrl: shoot.public ? pageUrl(lang, `/shoot/${slug}`) : null,
      noindex: !shoot.public,
      breadcrumbs: [
        { name: lang === 'en' ? 'Shoots' : 'Съёмки', url: pageUrl(lang, '/shoot') },
        { name: shoot.label, url: pageUrl(lang, `/shoot/${slug}`) },
      ],
      otherShoots: relatedInfo.shoots.map(function(s) { return i18n.localizeShoot(s, lang); }),
      otherShootsAreRelated: relatedInfo.related,
      peopleGroups: rawShoot.showFaces ? photoPeople.groupShootFaces(slug, rawShoot) : [],
    });
  });
});

// GET /shoot/:slug/download — скачать архив всех фото, либо только выбранных (?ids=a,b,c)
// (маршрут должен идти до /:id, чтобы не перехватило)
router.get('/shoot/:slug/download', async (req, res) => {
  var { slug } = req.params;
  var shoot = shoots.getShoot(slug);
  if (!shoot) return res.status(404).send('Not found');
  var adminUser = await isAdmin(req);

  requireShootAuth(shoot, slug, req, res, adminUser, function() {
    var idsParam = req.query.ids;
    var photos;
    if (idsParam) {
      var wanted = new Set(String(idsParam).split(',').map(function(s) { return s.trim(); }).filter(Boolean));
      photos = shoot.photos.filter(function(p) { return p && p.id && wanted.has(p.id); });
    } else {
      photos = shoot.photos.filter(function(p) { return p && p.id; });
    }
    if (!photos.length) return res.status(404).send('No photos');

    var bucket = photoAdmin.bucket;
    var filename = slug + (idsParam ? '-selection' : '') + '.zip';
    res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
    res.setHeader('Content-Type', 'application/zip');

    var archive = archiver('zip', { store: true });
    archive.on('error', function(err) {
      console.error('[shoot/download] archiver error:', err);
      if (!res.headersSent) res.status(500).send('Archive error');
    });
    archive.pipe(res);

    photos.forEach(function(photo) {
      var filePath = 'shoots/' + slug + '/' + photo.id + '-2400.webp';
      var entryName = (photo.title ? photo.title.replace(/[/\\?%*:|"<>]/g, '_') : photo.id) + '.webp';
      var stream = bucket.file(filePath).createReadStream();
      archive.append(stream, { name: entryName });
    });

    archive.finalize();
  });
});

// GET /shoot/:slug/:id — страница фото
router.get('/shoot/:slug/:id', async (req, res) => {
  var lang = req.lang;
  var { slug, id } = req.params;
  var rawShoot = shoots.getShoot(slug);
  if (!rawShoot) return res.status(404).render('error', { message: 'Not found', error: {} });
  var adminUser = await isAdmin(req);

  requireShootAuth(rawShoot, slug, req, res, adminUser, function() {
    var shoot = i18n.localizeShoot(rawShoot, lang);
    var photos = shoot.photos;
    var idx = photos.findIndex(function(p) { return p.id === id; });
    if (idx === -1) return res.status(404).render('error', { message: 'Not found', error: {} });

    var photo = photos[idx];
    var prev = idx > 0 ? photos[idx - 1] : null;
    var next = idx < photos.length - 1 ? photos[idx + 1] : null;

    trackView('shoot-photo', slug + '/' + id, req.path, req);
    res.render('photo/photo', {
      data: i18n.localizeDataTree(getData(), lang),
      activeCountry: null,
      activeSeries: null,
      isShoot: true,
      shootSlug: slug,
      backLabel: shoot.label,
      photo,
      prev,
      next,
      countryKey: null,
      seriesKey: null,
      countryLabel: shoot.label,
      seriesLabel: shoot.label,
      allTags: i18n.localizeTags(getTags(), lang),
      related: [],
      seriesUrl: i18n.langPrefix(lang) + '/shoot/' + slug,
      inquiryStatus: null,
      reviewStatus: null,
      title: photo.title + ' — ' + shoot.label,
      desc: photo.seo_desc || photo.desc || null,
      keywords: photo.seo_keywords || null,
      ogImage: photo.urls ? photo.urls.full : null,
      ogUrl: shoot.public ? pageUrl(lang, `/shoot/${slug}/${id}`) : null,
      noindex: !shoot.public,
      breadcrumbs: [
        { name: lang === 'en' ? 'Shoots' : 'Съёмки', url: pageUrl(lang, '/shoot') },
        { name: shoot.label, url: pageUrl(lang, `/shoot/${slug}`) },
        { name: photo.title, url: pageUrl(lang, `/shoot/${slug}/${id}`) },
      ],
    });
  });
});

// POST /shoot/:slug/auth — сабмит пароля
router.post('/shoot/:slug/auth', express.urlencoded({ extended: false }), (req, res) => {
  var lang = req.lang;
  var { slug } = req.params;
  var shoot = shoots.getShoot(slug);
  if (!shoot) return res.status(404).render('error', { message: 'Not found', error: {} });

  var { password } = req.body;
  if (password && shoot.password &&
    password.length === shoot.password.length &&
    crypto.timingSafeEqual(Buffer.from(password), Buffer.from(shoot.password))) {
    res.cookie('shoot_' + slug, shootCookieToken(shoot.password, slug), {
      signed: true,
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    return res.redirect(i18n.langPrefix(lang) + '/shoot/' + slug);
  }

  res.render('photo/shoot-password', {
    title: shoot.label + ' — photo.dimazvali.com',
    slug,
    label: i18n.pickField(shoot, 'label', lang),
    error: true,
    data: i18n.localizeDataTree(getData(), lang),
    activeCountry: null,
    activeSeries: null,
    ogImage: null,
    ogUrl: null,
    breadcrumbs: null,
    noindex: true,
  });
});

// POST /shoot/:slug/collections — клиент сохраняет собственную подборку фото
router.post('/shoot/:slug/collections', express.json(), async (req, res) => {
  var { slug } = req.params;
  var shoot = shoots.getShoot(slug);
  if (!shoot) return res.status(404).json({ error: 'Not found' });

  var adminUser = await isAdmin(req);
  var cookieKey = 'shoot_' + slug;
  var authed = adminUser || !shoot.password ||
    (req.signedCookies && req.signedCookies[cookieKey] === shootCookieToken(shoot.password, slug));
  if (!authed) return res.status(401).json({ error: 'Unauthorized' });

  var name = String((req.body && req.body.name) || '').trim().slice(0, 200);
  if (!name) return res.status(400).json({ error: 'Name required' });

  var validIds = {};
  shoot.photoOrder.forEach(function(id) { validIds[id] = true; });
  var seen = {};
  var photoIds = (Array.isArray(req.body && req.body.photoIds) ? req.body.photoIds : [])
    .filter(function(id) { return typeof id === 'string' && validIds[id] && !seen[id] && (seen[id] = true); });
  if (!photoIds.length) return res.status(400).json({ error: 'No photos selected' });

  var collection = await shoots.addCollection(slug, name, photoIds);

  tgSend('<b>🗂 Новая подборка от клиента</b>\n' + shoot.label + ' — «' + name + '»\n' + photoIds.length + ' фото\n' + BASE + '/admin/shoots/' + slug + '/edit');

  res.json({ ok: true, id: collection.id });
});

// GET /:country — all photos in a country
router.get('/:country', (req, res) => {
  var lang = req.lang;
  var data = i18n.localizeDataTree(getData(), lang);
  var { country: countryKey } = req.params;
  var country = data[countryKey];
  if (!country || country.archived) return res.status(404).render('error', { message: 'Not found', error: {} });

  trackView('country', countryKey, req.path, req);

  var photos = [];
  for (var seriesKey of getActiveSeries(country)) {
    for (var photo of country.series[seriesKey].photos) {
      photos.push({ countryKey, seriesKey, ...photo });
    }
  }

  var allTags = i18n.localizeTags(getTags(), lang);
  var tagSet = new Set();
  photos.forEach(function (p) { if (p.tags) p.tags.forEach(function (t) { tagSet.add(t); }); });
  var activeTags = Array.from(tagSet).filter(function (k) { return allTags[k]; }).map(function (k) { return { key: k, label: allTags[k].label }; });

  var seriesLabels = getActiveSeries(country).map(k => country.series[k].label);
  res.render('photo/gallery', {
    data,
    activeCountry: countryKey,
    activeSeries: null,
    photos,
    activeTags,
    title: `${country.label} — photo.dimazvali.com`,
    desc: lang === 'en'
      ? `${country.label} — ${photos.length} aerial photos in ${seriesLabels.length} series. Documentary aerial photography by Dmitry Shestakov.`
      : `${country.label} — ${photos.length} аэрофотоснимков в ${seriesLabels.length} сери${seriesLabels.length === 1 ? 'и' : 'ях'}. Документальная съёмка с воздуха, Дмитрий Шестаков.`,
    keywords: buildPageKeywords(photos, allTags, [country.label, ...seriesLabels]),
    ogImage: photos.length ? `${BASE}/og/country/${countryKey}.jpg` : null,
    ogUrl: pageUrl(lang, `/${countryKey}`),
    breadcrumbs: [{ name: country.label, url: pageUrl(lang, `/${countryKey}`) }],
  });
});

// GET /:country/:series — filtered gallery
router.get('/:country/:series', (req, res) => {
  var lang = req.lang;
  var data = i18n.localizeDataTree(getData(), lang);
  var { country: countryKey, series: seriesKey } = req.params;
  var country = data[countryKey];
  if (!country || country.archived) return res.status(404).render('error', { message: 'Not found', error: {} });
  var series = country.series[seriesKey];
  if (!series || series.archived) return res.status(404).render('error', { message: 'Not found', error: {} });

  trackView('series', countryKey + '/' + seriesKey, req.path, req);

  var photos = series.photos.map(p => ({ countryKey, seriesKey, ...p }));
  var allTagsSeries = i18n.localizeTags(getTags(), lang);
  var tagSetSeries = new Set();
  photos.forEach(function (p) { if (p.tags) p.tags.forEach(function (t) { tagSetSeries.add(t); }); });
  var activeTags = Array.from(tagSetSeries).filter(function (k) { return allTagsSeries[k]; }).map(function (k) { return { key: k, label: allTagsSeries[k].label }; });

  res.render('photo/gallery', {
    data,
    activeCountry: countryKey,
    activeSeries: seriesKey,
    photos,
    activeTags,
    title: `${series.label} · ${country.label} — photo.dimazvali.com`,
    desc: lang === 'en'
      ? `${series.label}, ${country.label} — ${photos.length} aerial photos. Documentary aerial photography by Dmitry Shestakov.`
      : `${series.label}, ${country.label} — ${photos.length} аэрофотоснимков. Документальная съёмка с воздуха, Дмитрий Шестаков.`,
    keywords: buildPageKeywords(photos, allTagsSeries, [country.label, series.label]),
    ogImage: photos.length ? `${BASE}/og/series/${countryKey}/${seriesKey}.jpg` : null,
    ogUrl: pageUrl(lang, `/${countryKey}/${seriesKey}`),
    breadcrumbs: [
      { name: country.label, url: pageUrl(lang, `/${countryKey}`) },
      { name: series.label, url: pageUrl(lang, `/${countryKey}/${seriesKey}`) },
    ],
  });
});

// GET /:country/:series/:id — single photo page
router.get('/:country/:series/:id', (req, res) => {
  var lang = req.lang;
  var data = i18n.localizeDataTree(getData(), lang);
  var { country: countryKey, series: seriesKey, id } = req.params;
  var country = data[countryKey];
  if (!country || country.archived) return res.status(404).render('error', { message: 'Not found', error: {} });
  var series = country.series[seriesKey];
  if (!series || series.archived) return res.status(404).render('error', { message: 'Not found', error: {} });

  var photos = series.photos;
  var idx = photos.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).render('error', { message: 'Not found', error: {} });

  var photo = photos[idx];
  var prev = idx > 0 ? photos[idx - 1] : null;
  var next = idx < photos.length - 1 ? photos[idx + 1] : null;

  trackView('photo', countryKey + '/' + seriesKey + '/' + id, req.path, req);

  var photoTags = new Set(photo.tags || []);
  var related = [];
  if (photoTags.size > 0) {
    for (var sk of getActiveSeries(country)) {
      for (var rp of country.series[sk].photos) {
        if (rp.id === id) continue;
        if (!rp.urls) continue;
        if (!rp.tags || !rp.tags.some(t => photoTags.has(t))) continue;
        related.push({ countryKey, seriesKey: sk, id: rp.id, title: rp.title, urls: rp.urls });
        if (related.length >= 5) break;
      }
      if (related.length >= 5) break;
    }
  }

  var allTagsPhoto = i18n.localizeTags(getTags(), lang);
  var inquiryStatus = req.query.inquiry || null;
  var reviewStatus  = req.query.review  || null;

  var sourceShootUrl = null;
  var sourceShootLabel = null;
  if (photo.sourceShoot) {
    var sourceShoot = shoots.getShoot(photo.sourceShoot);
    if (sourceShoot && sourceShoot.public) {
      sourceShootUrl = i18n.langPrefix(lang) + `/shoot/${photo.sourceShoot}`;
      sourceShootLabel = i18n.pickField(sourceShoot, 'label', lang);
    }
  }

  res.render('photo/photo', {
    inquiryStatus,
    reviewStatus,
    data,
    activeCountry: countryKey,
    activeSeries: seriesKey,
    photo,
    prev,
    next,
    countryKey,
    seriesKey,
    countryLabel: country.label,
    seriesLabel: series.label,
    allTags: allTagsPhoto,
    related,
    sourceShootUrl,
    sourceShootLabel,
    seriesUrl: i18n.langPrefix(lang) + `/${countryKey}/${seriesKey}`,
    title: `${photo.title} — photo.dimazvali.com`,
    desc: photo.seo_desc || photo.desc || (lang === 'en'
      ? `${photo.title} · ${series.label} · ${country.label} — an aerial photo by Dmitry Shestakov`
      : `${photo.title} · ${series.label} · ${country.label} — аэрофотоснимок Дмитрия Шестакова`),
    keywords: photo.seo_keywords || buildPageKeywords([photo], allTagsPhoto, [country.label, series.label]),
    ogImage: photo.urls ? photo.urls.full : null,
    ogUrl: pageUrl(lang, `/${countryKey}/${seriesKey}/${photo.id}`),
    breadcrumbs: [
      { name: country.label, url: pageUrl(lang, `/${countryKey}`) },
      { name: series.label, url: pageUrl(lang, `/${countryKey}/${seriesKey}`) },
      { name: photo.title, url: pageUrl(lang, `/${countryKey}/${seriesKey}/${photo.id}`) },
    ],
  });
});

module.exports = router;
