var express = require('express');
var router = express.Router();
var path = require('path');
var fs = require('fs');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/photo.json'), 'utf8'));

// Build flat list of all photos for prev/next navigation
function getAllPhotos() {
  const list = [];
  for (const [countryKey, country] of Object.entries(data)) {
    for (const [seriesKey, series] of Object.entries(country.series)) {
      for (const photo of series.photos) {
        list.push({ countryKey, seriesKey, ...photo });
      }
    }
  }
  return list;
}

// GET / — full gallery (all photos)
router.get('/', (req, res) => {
  res.render('photo/gallery', {
    data,
    activeCountry: null,
    activeSeries: null,
    photos: getAllPhotos(),
    title: 'AERO',
  });
});

// GET /about
router.get('/about', (req, res) => {
  res.render('photo/about', { data, title: 'О себе — AERO' });
});

// GET /:country/:series — filtered gallery
router.get('/:country/:series', (req, res) => {
  const { country: countryKey, series: seriesKey } = req.params;
  const country = data[countryKey];
  if (!country) return res.status(404).render('error', { message: 'Not found', error: {} });
  const series = country.series[seriesKey];
  if (!series) return res.status(404).render('error', { message: 'Not found', error: {} });

  res.render('photo/gallery', {
    data,
    activeCountry: countryKey,
    activeSeries: seriesKey,
    photos: series.photos.map(p => ({ countryKey, seriesKey, ...p })),
    title: `${series.label} · ${country.label} — AERO`,
  });
});

// GET /:country/:series/:id — single photo page
router.get('/:country/:series/:id', (req, res) => {
  const { country: countryKey, series: seriesKey, id } = req.params;
  const country = data[countryKey];
  if (!country) return res.status(404).render('error', { message: 'Not found', error: {} });
  const series = country.series[seriesKey];
  if (!series) return res.status(404).render('error', { message: 'Not found', error: {} });

  const photos = series.photos;
  const idx = photos.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).render('error', { message: 'Not found', error: {} });

  const photo = photos[idx];
  const prev = idx > 0 ? photos[idx - 1] : null;
  const next = idx < photos.length - 1 ? photos[idx + 1] : null;

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
    title: `${photo.title} — AERO`,
  });
});

module.exports = router;
