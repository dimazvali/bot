var express = require('express');
var router = express.Router();
var path = require('path');
var { getData } = require('../lib/photo-data');
var { getTags } = require('../lib/photo-tags');
var { trackView } = require('../lib/photo-stats');

router.use(express.static(path.join(__dirname, '../public')));

// Admin router must be mounted BEFORE wildcard routes
router.use('/admin', require('./photo-admin'));

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
    if (country.archived) continue;
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
    desc: `${tags[slug].label} — аэрофотосъёмка Дмитрия Шестакова`,
    ogImage: ogImg(photos[0]),
    ogUrl: `${BASE}/tag/${slug}`,
    breadcrumbs: [{ name: tags[slug].label, url: `${BASE}/tag/${slug}` }],
  });
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

  var xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  for (var url of urls) {
    xml += '  <url><loc>' + url + '</loc></url>\n';
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

// GET /:country — all photos in a country
router.get('/:country', (req, res) => {
  var data = getData();
  var { country: countryKey } = req.params;
  var country = data[countryKey];
  if (!country || country.archived) return res.status(404).render('error', { message: 'Not found', error: {} });

  trackView('country', countryKey, req.path);

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

  res.render('photo/gallery', {
    data,
    activeCountry: countryKey,
    activeSeries: null,
    photos,
    activeTags,
    title: `${country.label} — photo.dimazvali.com`,
    desc: `${country.label} — аэрофотосъёмка Дмитрия Шестакова`,
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

  trackView('series', countryKey + '/' + seriesKey, req.path);

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
    desc: `${series.label} · ${country.label} — аэрофотосъёмка Дмитрия Шестакова`,
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

  trackView('photo', countryKey + '/' + seriesKey + '/' + id, req.path);

  res.render('photo/photo', {
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
    allTags: getTags(),
    seriesUrl: `/${countryKey}/${seriesKey}`,
    title: `${photo.title} — photo.dimazvali.com`,
    desc: photo.desc || `${photo.title} · ${series.label} · ${country.label}`,
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
