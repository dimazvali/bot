'use strict';
var express = require('express');
var router = express.Router();
var path = require('path');
var { getData } = require('../lib/photo-data');
var { getTags } = require('../lib/photo-tags');

router.use(express.static(path.join(__dirname, '../public')));

var TYPE_MAP = { copter: 'drone', camera: 'camera', mobile: 'phone' };
var TYPE_LABEL = { copter: 'Коптер', camera: 'Камера', mobile: 'Телефон' };

var COLORS = [
  { k: 'red',    hex: '#cc3b3b', l: 'Красный' },
  { k: 'orange', hex: '#dd8a2e', l: 'Оранжевый' },
  { k: 'yellow', hex: '#d8bd35', l: 'Жёлтый' },
  { k: 'green',  hex: '#4a9e54', l: 'Зелёный' },
  { k: 'teal',   hex: '#36a39c', l: 'Бирюзовый' },
  { k: 'blue',   hex: '#3a72c4', l: 'Синий' },
  { k: 'purple', hex: '#8a5ad0', l: 'Фиолетовый' },
  { k: 'mono',   hex: 'mono',    l: 'Монохром' },
];

var CAMS = [
  { k: 'все',    l: 'Все' },
  { k: 'drone',  l: 'Коптер' },
  { k: 'camera', l: 'Камера' },
  { k: 'phone',  l: 'Телефон' },
];

function buildPhotoList(data) {
  var cats = [];
  var photoList = [];

  for (var countryKey of Object.keys(data)) {
    var country = data[countryKey];
    if (country.archived) continue;
    var seriesKeys = country.seriesOrder || Object.keys(country.series);
    var seriesMap = {};
    var hasPhotos = false;

    for (var sk of seriesKeys) {
      var ser = country.series[sk];
      if (!ser || ser.archived || !ser.photos || !ser.photos.length) continue;
      hasPhotos = true;
      seriesMap[sk] = ser.label || sk;
      for (var photo of ser.photos) {
        photoList.push({
          id: photo.id,
          t: photo.title || '',
          d: photo.date || '',
          src: photo.urls && photo.urls.preview ? photo.urls.preview : '',
          href: '/' + countryKey + '/' + sk + '/' + photo.id,
          cat: countryKey,
          catLabel: country.label,
          loc: ser.label || sk,
          locKey: sk,
          col: photo.colorFamily || '',
          cam: TYPE_MAP[photo.type] || '',
          tags: photo.tags || [],
        });
      }
    }
    if (hasPhotos) cats.push({ key: countryKey, label: country.label, series: seriesMap });
  }
  return { cats, photoList };
}

function renderGallery(res, data, tagDefs, opts) {
  var { cats, photoList } = buildPhotoList(data);
  res.render('photo2/gallery', {
    photos: JSON.stringify(photoList),
    cats: JSON.stringify(cats),
    colors: JSON.stringify(COLORS),
    cams: JSON.stringify(CAMS),
    tagDefs: JSON.stringify(tagDefs),
    initialCat: opts.initialCat || 'все',
    initialLoc: opts.initialLoc || 'все',
    initialTag: opts.initialTag || 'все',
    title: opts.title || 'photo.dimazvali.com',
    pageH1: opts.pageH1 || null,
    pageDesc: opts.pageDesc || null,
  });
}

// GET / — all photos
router.get('/', function(req, res) {
  var data = getData();
  renderGallery(res, data, getTags(), {
    initialTag: req.query.tag || 'все',
    title: 'photo.dimazvali.com',
  });
});

// GET /:country
router.get('/:country', function(req, res) {
  var data = getData();
  var countryKey = req.params.country;
  var country = data[countryKey];
  if (!country || country.archived) return res.status(404).send('Not found');
  renderGallery(res, data, getTags(), {
    initialCat: countryKey,
    initialTag: req.query.tag || 'все',
    title: country.label + ' — photo.dimazvali.com',
    pageH1: country.label,
  });
});

// GET /:country/:series
router.get('/:country/:series', function(req, res) {
  var data = getData();
  var countryKey = req.params.country;
  var seriesKey = req.params.series;
  var country = data[countryKey];
  if (!country || country.archived) return res.status(404).send('Not found');
  var series = country.series[seriesKey];
  if (!series || series.archived) return res.status(404).send('Not found');
  renderGallery(res, data, getTags(), {
    initialCat: countryKey,
    initialLoc: seriesKey,
    initialTag: req.query.tag || 'все',
    title: series.label + ' · ' + country.label + ' — photo.dimazvali.com',
    pageH1: series.label,
    pageDesc: country.label,
  });
});

// GET /:country/:series/:id — photo detail
router.get('/:country/:series/:id', function(req, res) {
  var data = getData();
  var tagDefs = getTags();
  var { country: countryKey, series: seriesKey, id } = req.params;
  var country = data[countryKey];
  if (!country || country.archived) return res.status(404).send('Not found');
  var series = country.series[seriesKey];
  if (!series || series.archived) return res.status(404).send('Not found');
  var photos = series.photos;
  var idx = photos.findIndex(function(p) { return p.id === id; });
  if (idx === -1) return res.status(404).send('Not found');
  var photo = photos[idx];

  var prev = idx > 0 ? photos[idx - 1] : null;
  var next = idx < photos.length - 1 ? photos[idx + 1] : null;

  var photoTags = (photo.tags || []).map(function(slug) {
    return tagDefs[slug] ? { slug, label: tagDefs[slug].label } : { slug, label: slug };
  });

  // related = other photos in same series
  var related = photos.filter(function(p) { return p.id !== id; }).slice(0, 2).map(function(p) {
    return {
      id: p.id,
      t: p.title || '',
      src: p.urls && p.urls.preview ? p.urls.preview : '',
      href: '/' + countryKey + '/' + seriesKey + '/' + p.id,
      meta: series.label + (p.date ? ' · ' + p.date : ''),
    };
  });

  res.render('photo2/photo', {
    photo,
    countryKey,
    countryLabel: country.label,
    seriesKey,
    seriesLabel: series.label,
    photoTags,
    typeLabel: TYPE_LABEL[photo.type] || '',
    prev: prev ? '/' + countryKey + '/' + seriesKey + '/' + prev.id : null,
    next: next ? '/' + countryKey + '/' + seriesKey + '/' + next.id : null,
    related,
    backUrl: '/' + countryKey + '/' + seriesKey,
    inquiry: req.query.inquiry || null,
    title: (photo.title || id) + ' — photo.dimazvali.com',
  });
});

// POST /:country/:series/:id/inquiry
router.post('/:country/:series/:id/inquiry', express.urlencoded({ extended: false }), function(req, res) {
  var { country: countryKey, series: seriesKey, id } = req.params;
  var data = getData();
  var country = data[countryKey];
  if (!country) return res.status(404).send('Not found');
  var series = country.series && country.series[seriesKey];
  if (!series) return res.status(404).send('Not found');
  var photo = series.photos.find(function(p) { return p.id === id; });
  if (!photo) return res.status(404).send('Not found');

  var name    = (req.body.name    || '').trim().slice(0, 200);
  var email   = (req.body.email   || '').trim().slice(0, 200);
  var type    = req.body.type || 'other';
  var message = (req.body.message || '').trim().slice(0, 1000);

  if (name && email) {
    try {
      var { sendMessage2 } = require('./methods');
      var typeLabel = { print: 'Отпечаток', license: 'Лицензия', other: 'Вопрос' }[type] || type;
      var photoUrl = 'https://photo2.dimazvali.com/' + countryKey + '/' + seriesKey + '/' + id;
      var text = '📷 <b>' + typeLabel + '</b>\n'
        + 'Фото: <a href="' + photoUrl + '">' + (photo.title || id) + '</a>\n'
        + 'Имя: ' + name + '\n' + 'Email: ' + email
        + (message ? '\n\n' + message : '');
      sendMessage2({ chat_id: 144489840, text, parse_mode: 'HTML' }, false, process.env.dimazvaliToken).catch(function(){});
    } catch(e) {}
  }
  res.redirect('/' + countryKey + '/' + seriesKey + '/' + id + '?inquiry=ok');
});

module.exports = router;
