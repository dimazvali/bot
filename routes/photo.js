var express = require('express');
var router = express.Router();
var path = require('path');
var { getData } = require('../lib/photo-data');
var { getTags } = require('../lib/photo-tags');
var { trackView } = require('../lib/photo-stats');
var { COLOR_FAMILIES } = require('../lib/color-utils');
var subscriptions = require('../lib/photo-subscriptions');
var { buildPageKeywords, BASE_KEYWORDS } = require('../lib/photo-seo');

router.use(express.static(path.join(__dirname, '../public')));

// Admin router must be mounted BEFORE wildcard routes
router.use('/admin', require('./photo-admin'));

router.use(function(req, res, next) {
  res.locals.colorFamilies = COLOR_FAMILIES;
  res.locals.activeColorFamily = null;
  res.locals.isAdmin = !!(req.signedCookies && req.signedCookies.photoAdminToken);
  res.locals.subStatus = req.query.sub || null;
  next();
});

var BASE = 'https://photo.dimazvali.com';

function ogImg(photo) {
  return photo && photo.urls ? photo.urls.preview : null;
}

function getActiveSeries(country) {
  var order = country.seriesOrder || Object.keys(country.series);
  return order.filter(k => country.series[k] && !country.series[k].archived);
}

function getAllPhotos() {
  var data = getData();
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
  var data = getData();
  var photos = getAllPhotos();
  res.render('photo/gallery', {
    data,
    activeCountry: null,
    activeSeries: null,
    photos,
    title: 'photo.dimazvali.com',
    desc: 'Аэрофотосъёмка — Дмитрий Шестаков. Серийная документальная фотография с воздуха.',
    keywords: buildPageKeywords(photos, getTags(), Object.keys(data).map(k => data[k].label)),
    ogImage: ogImg(photos[0]),
    ogUrl: BASE + '/',
    breadcrumbs: null,
  });
});

// GET /about
router.get('/about', (req, res) => {
  res.render('photo/about', {
    data: getData(),
    title: 'О себе — photo.dimazvali.com',
    desc: 'Дмитрий Шестаков — аэрофотограф. Снимаю документальные серии с воздуха.',
    ogImage: null,
    ogUrl: BASE + '/about',
    breadcrumbs: [{ name: 'О себе', url: BASE + '/about' }],
  });
});

// GET /tag/:slug — gallery filtered by tag
router.get('/tag/:slug', (req, res) => {
  var { slug } = req.params;
  var tags = getTags();
  if (!tags[slug]) return res.status(404).render('error', { message: 'Not found', error: {} });
  var photos = getAllPhotos().filter(p => p.tags && p.tags.includes(slug));
  res.render('photo/tag-gallery', {
    data: getData(),
    activeCountry: null,
    activeSeries: null,
    tagLabel: tags[slug].label,
    tagSlug: slug,
    photos,
    title: `${tags[slug].label} — photo.dimazvali.com`,
    desc: `${photos.length} аэрофотоснимков по теме «${tags[slug].label}» — Дмитрий Шестаков`,
    keywords: tags[slug].label + ', ' + BASE_KEYWORDS,
    ogImage: ogImg(photos[0]),
    ogUrl: `${BASE}/tag/${slug}`,
    breadcrumbs: [{ name: tags[slug].label, url: `${BASE}/tag/${slug}` }],
  });
});

// GET /color/:family — gallery filtered by color
router.get('/color/:family', function(req, res) {
  var { family } = req.params;
  if (!COLOR_FAMILIES[family]) return res.status(404).render('error', { message: 'Not found', error: {} });
  var photos = getAllPhotos().filter(function(p) { return p.colorFamily === family; });
  var info = COLOR_FAMILIES[family];
  res.render('photo/color-gallery', {
    data: getData(),
    activeCountry: null,
    activeSeries: null,
    activeColorFamily: family,
    colorLabel: info.label,
    photos,
    title: info.label + ' — photo.dimazvali.com',
    desc: info.label + ' — аэрофотосъёмка Дмитрия Шестакова',
    keywords: info.label + ', ' + BASE_KEYWORDS,
    ogImage: ogImg(photos[0]),
    ogUrl: BASE + '/color/' + family,
    breadcrumbs: [{ name: info.label, url: BASE + '/color/' + family }],
  });
});

// POST /:country/:series/:id/inquiry — photo inquiry form
router.post('/:country/:series/:id/inquiry', express.urlencoded({ extended: false }), async (req, res) => {
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
    return res.redirect(`/${countryKey}/${seriesKey}/${id}?inquiry=err`);
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

  res.redirect(`/${countryKey}/${seriesKey}/${id}?inquiry=ok`);
});

// GET /sitemap.xml
router.get('/sitemap.xml', (req, res) => {
  var base = 'https://photo.dimazvali.com';
  var data = getData();
  var tags = getTags();
  var urls = [base + '/', base + '/about'];

  for (var slug of Object.keys(tags)) {
    urls.push(base + '/tag/' + slug);
  }

  for (var family of Object.keys(COLOR_FAMILIES)) {
    urls.push(base + '/color/' + family);
  }

  for (var countryKey of Object.keys(data)) {
    var country = data[countryKey];
    if (country.archived) continue;
    urls.push(base + '/' + countryKey);
    for (var seriesKey of getActiveSeries(country)) {
      var series = country.series[seriesKey];
      urls.push(base + '/' + countryKey + '/' + seriesKey);
      for (var photo of series.photos) {
        urls.push(base + '/' + countryKey + '/' + seriesKey + '/' + photo.id);
      }
    }
  }

  // Build photo URL → image metadata map
  var photoImageMap = {};
  for (var ck of Object.keys(data)) {
    var co = data[ck];
    if (co.archived) continue;
    for (var sk of getActiveSeries(co)) {
      var se = co.series[sk];
      for (var ph of se.photos) {
        var pageUrl = base + '/' + ck + '/' + sk + '/' + ph.id;
        if (ph.urls && (ph.urls.full || ph.urls.preview)) {
          photoImageMap[pageUrl] = { loc: ph.urls.full || ph.urls.preview, title: ph.title };
        }
      }
    }
  }

  var xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n'
    + '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n';
  for (var url of urls) {
    var img = photoImageMap[url];
    if (img) {
      xml += '  <url>\n'
        + '    <loc>' + url + '</loc>\n'
        + '    <image:image>\n'
        + '      <image:loc>' + img.loc + '</image:loc>\n'
        + '      <image:title>' + img.title.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</image:title>\n'
        + '    </image:image>\n'
        + '  </url>\n';
    } else {
      xml += '  <url><loc>' + url + '</loc></url>\n';
    }
  }
  xml += '</urlset>';

  res.set('Content-Type', 'application/xml');
  res.send(xml);
});

// GET /robots.txt
router.get('/robots.txt', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send('User-agent: *\nAllow: /\nSitemap: https://photo.dimazvali.com/sitemap.xml\n');
});

// POST /subscribe
router.post('/subscribe', express.urlencoded({ extended: false }), async (req, res) => {
  var email = (req.body.email || '').trim().toLowerCase();
  var back = req.headers.referer || '/';
  var sep = back.includes('?') ? '&' : '?';
  if (!email || !email.includes('@')) return res.redirect(back + sep + 'sub=err');
  try {
    await subscriptions.subscribe(email);
    res.redirect(back + sep + 'sub=ok');
  } catch (e) {
    console.error('[subscribe]', e);
    res.redirect(back + sep + 'sub=err');
  }
});

// GET /unsubscribe
router.get('/unsubscribe', async (req, res) => {
  var { token } = req.query;
  var ok = false;
  if (token) ok = await subscriptions.unsubscribe(token).catch(() => false);
  res.render('photo/unsubscribe', {
    title: 'Отписка — photo.dimazvali.com',
    ok,
    data: getData(),
    ogImage: null, ogUrl: null, breadcrumbs: null,
  });
});

// GET /:country — all photos in a country
router.get('/:country', (req, res) => {
  var data = getData();
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

  var allTags = getTags();
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
    desc: `${country.label} — ${photos.length} аэрофотоснимков в ${seriesLabels.length} сери${seriesLabels.length === 1 ? 'и' : 'ях'}. Документальная съёмка с воздуха, Дмитрий Шестаков.`,
    keywords: buildPageKeywords(photos, getTags(), [country.label, ...seriesLabels]),
    ogImage: ogImg(photos[0]),
    ogUrl: `${BASE}/${countryKey}`,
    breadcrumbs: [{ name: country.label, url: `${BASE}/${countryKey}` }],
  });
});

// GET /:country/:series — filtered gallery
router.get('/:country/:series', (req, res) => {
  var data = getData();
  var { country: countryKey, series: seriesKey } = req.params;
  var country = data[countryKey];
  if (!country || country.archived) return res.status(404).render('error', { message: 'Not found', error: {} });
  var series = country.series[seriesKey];
  if (!series || series.archived) return res.status(404).render('error', { message: 'Not found', error: {} });

  trackView('series', countryKey + '/' + seriesKey, req.path, req);

  var photos = series.photos.map(p => ({ countryKey, seriesKey, ...p }));
  var allTagsSeries = getTags();
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
    desc: `${series.label}, ${country.label} — ${photos.length} аэрофотоснимков. Документальная съёмка с воздуха, Дмитрий Шестаков.`,
    keywords: buildPageKeywords(photos, getTags(), [country.label, series.label]),
    ogImage: ogImg(photos[0]),
    ogUrl: `${BASE}/${countryKey}/${seriesKey}`,
    breadcrumbs: [
      { name: country.label, url: `${BASE}/${countryKey}` },
      { name: series.label, url: `${BASE}/${countryKey}/${seriesKey}` },
    ],
  });
});

// GET /:country/:series/:id — single photo page
router.get('/:country/:series/:id', (req, res) => {
  var data = getData();
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

  var allTagsPhoto = getTags();
  var inquiryStatus = req.query.inquiry || null;
  res.render('photo/photo', {
    inquiryStatus,
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
    seriesUrl: `/${countryKey}/${seriesKey}`,
    title: `${photo.title} — photo.dimazvali.com`,
    desc: photo.seo_desc || photo.desc || `${photo.title} · ${series.label} · ${country.label} — аэрофотоснимок Дмитрия Шестакова`,
    keywords: photo.seo_keywords || buildPageKeywords([photo], allTagsPhoto, [country.label, series.label]),
    ogImage: photo.urls ? photo.urls.full : null,
    ogUrl: `${BASE}/${countryKey}/${seriesKey}/${photo.id}`,
    breadcrumbs: [
      { name: country.label, url: `${BASE}/${countryKey}` },
      { name: series.label, url: `${BASE}/${countryKey}/${seriesKey}` },
      { name: photo.title, url: `${BASE}/${countryKey}/${seriesKey}/${photo.id}` },
    ],
  });
});

module.exports = router;
