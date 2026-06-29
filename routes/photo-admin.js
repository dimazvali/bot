var express = require('express');
var router = express.Router();
var path = require('path');
var multer = require('multer');
var sharp = require('sharp');
var exifr = require('exifr');
var { getData, saveData, initFromFirestore } = require('../lib/photo-data');
var { getTags, saveTags, initTagsFromFirestore } = require('../lib/photo-tags');
var photoStats = require('../lib/photo-stats');
var { extractColorFamily } = require('../lib/color-utils');
var subscriptions = require('../lib/photo-subscriptions');
var mailer = require('../lib/photo-mailer');
var copyright = require('../lib/photo-copyright');
var copyrightCheck = require('../lib/photo-copyright-check');
var shoots = require('../lib/photo-shoots');
var photoUsers = require('../lib/photo-users');
var tgNotifier = require('../lib/photo-tg-notifier');

var axios = require('axios');

var { initializeApp, getApps, cert } = require('firebase-admin/app');
var { getFirestore } = require('firebase-admin/firestore');
var { getStorage } = require('firebase-admin/storage');

var photoApp = getApps().find(a => a.name === 'photo') || initializeApp({
  credential: cert({
    type: 'service_account',
    project_id: 'dimazvalimisc',
    private_key_id: '5eb5025afc0fe53b63f518ba071f89e7b7ce03af',
    private_key: process.env.sssGCPKey.replace(/\\n/g, '\n'),
    client_email: 'firebase-adminsdk-4iwd4@dimazvalimisc.iam.gserviceaccount.com',
    client_id: '110523994931477712119',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-4iwd4%40dimazvalimisc.iam.gserviceaccount.com',
  }),
  storageBucket: process.env.PHOTO_BUCKET,
}, 'photo');

var fb = getFirestore(photoApp);
var bucket = getStorage(photoApp).bucket();
var adminTokens = fb.collection('PHOTOadminTokens');

initFromFirestore(fb).catch(console.error);
initTagsFromFirestore(fb).catch(console.error);
photoStats.init(fb);
subscriptions.init(fb);
photoUsers.init(fb);
mailer.init();
copyright.init(fb);
shoots.initFromFirestore(fb).catch(console.error);

var upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.originalname) return cb(null, false);
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only images allowed'));
    cb(null, true);
  },
});

var SITEMAP_URL = 'https://photo.dimazvali.com/sitemap.xml';
var INDEX_NOW_KEY = process.env.INDEX_NOW_KEY || '3d8e3d1e2ccb44dab475e7949fc9fcc8';

function pingSitemaps() {
  axios.get('https://www.bing.com/ping?sitemap=' + encodeURIComponent(SITEMAP_URL), { timeout: 8000 })
    .catch(function(e) { console.error('[sitemap-ping]', e.message); });
}

function indexNowSubmit(urls) {
  axios.post('https://api.indexnow.org/indexnow', {
    host: 'photo.dimazvali.com',
    key: INDEX_NOW_KEY,
    keyLocation: 'https://photo.dimazvali.com/' + INDEX_NOW_KEY + '.txt',
    urlList: Array.isArray(urls) ? urls : [urls],
  }, { timeout: 8000 }).catch(function(e) { console.error('[indexnow]', e.message); });
}

function slugify(str) {
  var map = {
    а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'yo',ж:'zh',з:'z',и:'i',й:'j',
    к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',
    х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya',
  };
  return str.toLowerCase()
    .split('').map(c => map[c] !== undefined ? map[c] : c).join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function uniqueId(base, existingIds) {
  if (!existingIds.includes(base)) return base;
  var n = 2;
  while (existingIds.includes(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

async function requireAuth(req, res, next) {
  var tokenId = req.signedCookies && req.signedCookies.photoAdminToken;
  if (!tokenId) return res.redirect('/admin/login');
  try {
    var doc = await adminTokens.doc(tokenId).get();
    if (!doc.exists) return res.redirect('/admin/login');
    next();
  } catch (e) {
    res.redirect('/admin/login');
  }
}

router.get('/login', (req, res) => {
  res.render('photo/admin/login', { title: 'Вход — photo.dimazvali.com Admin', error: null });
});

router.post('/login', async (req, res) => {
  var { pass } = req.body;
  if (!pass || pass !== process.env.PHOTO_ADMIN_PASS) {
    return res.render('photo/admin/login', { title: 'Вход — photo.dimazvali.com Admin', error: 'Неверный пароль' });
  }
  var doc = await adminTokens.add({ createdAt: new Date() });
  res.cookie('photoAdminToken', doc.id, { signed: true, httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 });
  res.redirect('/admin');
});

router.get('/logout', async (req, res) => {
  var tokenId = req.signedCookies && req.signedCookies.photoAdminToken;
  if (tokenId) {
    try { await adminTokens.doc(tokenId).delete(); } catch (e) {}
  }
  res.clearCookie('photoAdminToken');
  res.redirect('/admin/login');
});

router.get('/', requireAuth, (req, res) => {
  res.render('photo/admin/index', { data: getData(), title: 'photo.dimazvali.com Admin' });
});

router.get('/stats', requireAuth, async (req, res) => {
  var days = Math.min(parseInt(req.query.days) || 30, 90);
  var env = process.env.PHOTO_ENV || 'dev';
  var since = new Date();
  since.setDate(since.getDate() - days);
  try {
    var snap = await fb.collection('photo_views')
      .where('env', '==', env)
      .where('timestamp', '>=', since)
      .orderBy('timestamp', 'desc')
      .limit(10000)
      .get();
    var byDay = {}, byEntity = {}, byDevice = { desktop: 0, mobile: 0, tablet: 0, unknown: 0 };
    snap.docs.forEach(function(doc) {
      var d = doc.data();
      var ts = d.timestamp ? d.timestamp.toDate() : null;
      if (!ts) return;
      var day = ts.toISOString().slice(0, 10);
      byDay[day] = (byDay[day] || 0) + 1;
      var key = d.entityType + ':' + d.entityId;
      byEntity[key] = (byEntity[key] || 0) + 1;
      if (d.deviceType && byDevice[d.deviceType] !== undefined) byDevice[d.deviceType]++;
    });
    var allDays = [];
    for (var i = days - 1; i >= 0; i--) {
      var dt = new Date(); dt.setDate(dt.getDate() - i);
      var dayStr = dt.toISOString().slice(0, 10);
      allDays.push({ day: dayStr, count: byDay[dayStr] || 0 });
    }
    var maxCount = Math.max.apply(null, allDays.map(function(d) { return d.count; }).concat([1]));
    var topEntities = Object.entries(byEntity).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 20).map(function(e) { return { key: e[0], count: e[1] }; });
    res.render('photo/admin/stats', { title: 'Статистика — Admin', days: days, total: snap.size, allDays: allDays, maxCount: maxCount, topEntities: topEntities, byDevice: byDevice, error: null });
  } catch (err) {
    res.render('photo/admin/stats', { title: 'Статистика — Admin', days: days, total: 0, allDays: [], maxCount: 1, topEntities: [], byDevice: {}, error: err.message });
  }
});

router.post('/country', requireAuth, (req, res) => {
  var { key, label } = req.body;
  if (!key || !label) return res.redirect('/admin');
  var data = getData();
  var k = slugify(key);
  if (!data[k]) {
    data[k] = { label, series: {}, createdAt: new Date().toISOString().slice(0, 10) };
    saveData(data);
  }
  res.redirect('/admin');
});

router.get('/country/:key/edit', requireAuth, (req, res) => {
  var { key } = req.params;
  if (!/^[a-z0-9-]+$/.test(key)) return res.redirect('/admin');
  var data = getData();
  var country = data[key];
  if (!country) return res.redirect('/admin');
  var seriesKeys = country.seriesOrder || Object.keys(country.series);
  res.render('photo/admin/country-edit', {
    title: `${country.label} — AERO Admin`,
    countryKey: key,
    country,
    seriesKeys,
    canDelete: Object.keys(country.series).length === 0,
    error: req.query.error || null,
  });
});

router.post('/country/:key/edit', requireAuth, (req, res) => {
  var { key } = req.params;
  if (!/^[a-z0-9-]+$/.test(key)) return res.redirect('/admin');
  var { label } = req.body;
  if (!label || !label.trim()) return res.redirect(`/admin/country/${key}/edit`);
  var data = getData();
  if (!data[key]) return res.redirect('/admin');
  data[key].label = label.trim();
  var defaultPhotoType = req.body.defaultPhotoType;
  if (['copter', 'camera', 'mobile'].includes(defaultPhotoType)) {
    data[key].defaultPhotoType = defaultPhotoType;
  } else {
    delete data[key].defaultPhotoType;
  }
  saveData(data);
  res.redirect(`/admin/country/${key}/edit`);
});

router.post('/country/:key/toggle-feed', requireAuth, (req, res) => {
  var { key } = req.params;
  if (!/^[a-z0-9-]+$/.test(key)) return res.redirect('/admin');
  var data = getData();
  if (!data[key]) return res.redirect('/admin');
  data[key].hiddenFromFeed = !data[key].hiddenFromFeed;
  saveData(data);
  res.redirect(`/admin/country/${key}/edit`);
});

router.post('/country/:key/archive', requireAuth, (req, res) => {
  var { key } = req.params;
  if (!/^[a-z0-9-]+$/.test(key)) return res.redirect('/admin');
  var data = getData();
  if (!data[key]) return res.redirect('/admin');
  data[key].archived = !data[key].archived;
  saveData(data);
  res.redirect(`/admin/country/${key}/edit`);
});

router.post('/country/:key/delete', requireAuth, (req, res) => {
  var { key } = req.params;
  if (!/^[a-z0-9-]+$/.test(key)) return res.redirect('/admin');
  var data = getData();
  if (!data[key]) return res.redirect('/admin');
  if (Object.keys(data[key].series).length > 0) {
    return res.redirect(`/admin/country/${key}/edit?error=Удалите все серии перед удалением страны`);
  }
  delete data[key];
  saveData(data);
  res.redirect('/admin');
});

router.post('/country/:key/reorder-series', requireAuth, express.json(), (req, res) => {
  var { key } = req.params;
  if (!/^[a-z0-9-]+$/.test(key)) return res.status(400).json({ ok: false });
  var { order } = req.body;
  var data = getData();
  if (!data[key] || !Array.isArray(order)) return res.status(400).json({ ok: false });
  var validKeys = Object.keys(data[key].series);
  if (!order.every(k => validKeys.includes(k))) return res.status(400).json({ ok: false });
  if (order.length !== validKeys.length) return res.status(400).json({ ok: false });
  if (new Set(order).size !== order.length) return res.status(400).json({ ok: false });
  data[key].seriesOrder = order;
  saveData(data);
  res.json({ ok: true });
});

router.post('/series/:country', requireAuth, (req, res) => {
  var { country } = req.params;
  var { key, label } = req.body;
  if (!key || !label) return res.redirect('/admin');
  var data = getData();
  if (!data[country]) return res.redirect('/admin');
  var k = slugify(key);
  if (!data[country].series[k]) {
    data[country].series[k] = { label, photos: [], createdAt: new Date().toISOString().slice(0, 10) };
    if (data[country].seriesOrder) {
      data[country].seriesOrder.push(k);
    }
    saveData(data);
  }
  res.redirect('/admin');
});

router.get('/:country/:series/upload', requireAuth, function(req, res, next) { if (req.params.country === 'shoots') return next('route'); next(); }, (req, res) => {
  var { country, series } = req.params;
  if (!/^[a-z0-9-]+$/.test(country) || !/^[a-z0-9-]+$/.test(series)) return res.redirect('/admin');
  var data = getData();
  if (!data[country] || !data[country].series[series]) return res.redirect('/admin');
  res.render('photo/admin/upload', {
    title: 'Загрузка — photo.dimazvali.com Admin',
    country,
    series,
    seriesLabel: data[country].series[series].label,
    countryLabel: data[country].label,
    photos: data[country].series[series].photos,
    tags: getTags(),
    defaultPhotoType: data[country].defaultPhotoType || 'copter',
  });
});

router.post('/:country/:series/upload', requireAuth, function(req, res, next) { if (req.params.country === 'shoots') return next('route'); next(); }, upload.single('photo'), async (req, res) => {
  var { country, series } = req.params;
  if (!/^[a-z0-9-]+$/.test(country) || !/^[a-z0-9-]+$/.test(series)) return res.redirect('/admin');
  var { title, date, desc } = req.body;
  var photoType = ['copter', 'camera', 'mobile'].includes(req.body.type) ? req.body.type : 'copter';
  var instagramUrl = req.body.instagram ? req.body.instagram.trim() : '';
  if (instagramUrl && !instagramUrl.startsWith('https://')) instagramUrl = '';
  var data = getData();

  if (!data[country] || !data[country].series[series]) return res.redirect('/admin');
  if (!req.file) return res.redirect(`/admin/${country}/${series}/upload`);

  var knownTags = getTags();
  var rawTags = req.body.tags ? (Array.isArray(req.body.tags) ? req.body.tags : [req.body.tags]) : [];
  var tags = rawTags.filter(s => knownTags[s]);
  var latRaw = parseFloat(req.body.lat);
  var lngRaw = parseFloat(req.body.lng);
  var altRaw = parseFloat(req.body.altitude);
  var coords = null;
  var altitude = !isNaN(altRaw) && altRaw >= 0 ? Math.round(altRaw) : null;
  if (!isNaN(latRaw) && !isNaN(lngRaw) && Math.abs(latRaw) <= 90 && Math.abs(lngRaw) <= 180) {
    coords = { lat: latRaw, lng: lngRaw };
  }
  var shotAt = null;
  if (!coords || altitude === null) {
    try {
      var exifData = await exifr.parse(req.file.buffer, { gps: true, pick: ['DateTimeOriginal', 'CreateDate'] });
      if (exifData) {
        if (!coords && exifData.latitude != null) coords = { lat: exifData.latitude, lng: exifData.longitude };
        if (altitude === null && exifData.GPSAltitude != null) altitude = Math.round(exifData.GPSAltitude);
        var exifDate = exifData.DateTimeOriginal || exifData.CreateDate;
        if (exifDate instanceof Date && !isNaN(exifDate)) shotAt = exifDate.toISOString();
      }
    } catch (e) {}
  }

  try {
    var baseName = path.basename(req.file.originalname, path.extname(req.file.originalname));
    var existingIds = data[country].series[series].photos.map(p => p.id);
    var id = uniqueId(slugify((title && title.trim()) || baseName), existingIds);

    var [buf400, buf800, buf2400, colorFamily] = await Promise.all([
      sharp(req.file.buffer).resize({ width: 400, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(),
      sharp(req.file.buffer).resize({ width: 800, withoutEnlargement: true }).webp({ quality: 85 }).toBuffer(),
      sharp(req.file.buffer).resize({ width: 2400, withoutEnlargement: true }).webp({ quality: 90 }).toBuffer(),
      extractColorFamily(req.file.buffer),
    ]);

    var path400 = `${country}/${series}/${id}-400.webp`;
    var path800 = `${country}/${series}/${id}-800.webp`;
    var path2400 = `${country}/${series}/${id}-2400.webp`;

    await Promise.all([
      bucket.file(path400).save(buf400, { contentType: 'image/webp' }).then(() => bucket.file(path400).makePublic()),
      bucket.file(path800).save(buf800, { contentType: 'image/webp' }).then(() => bucket.file(path800).makePublic()),
      bucket.file(path2400).save(buf2400, { contentType: 'image/webp' }).then(() => bucket.file(path2400).makePublic()),
    ]);

    var base = `https://storage.googleapis.com/${process.env.PHOTO_BUCKET}`;
    var photoEntry = {
      id,
      title: title || baseName,
      date: date || '',
      desc: desc || '',
      type: photoType,
      createdAt: new Date().toISOString().slice(0, 10),
      urls: {
        thumb: `${base}/${path400}`,
        preview: `${base}/${path800}`,
        full: `${base}/${path2400}`,
      },
    };
    if (tags.length) photoEntry.tags = tags;
    if (coords) photoEntry.coords = coords;
    if (altitude !== null) photoEntry.altitude = altitude;
    if (shotAt) photoEntry.shotAt = shotAt;
    if (instagramUrl) photoEntry.instagram = instagramUrl;
    if (colorFamily) photoEntry.colorFamily = colorFamily;
    data[country].series[series].photos.push(photoEntry);
    saveData(data);
    pingSitemaps();
    indexNowSubmit('https://photo.dimazvali.com/' + country + '/' + series + '/' + id);

    // Auto-generate SEO desc+keywords async (fire-and-forget)
    (function() {
      var { generatePhotoSeo } = require('../lib/photo-seo');
      generatePhotoSeo(photoEntry, {
        countryLabel: data[country].label,
        seriesLabel: data[country].series[series].label,
        allTags: getTags(),
      }).then(function(result) {
        var d2 = getData();
        var p = d2[country] && d2[country].series[series] && d2[country].series[series].photos.find(function(x) { return x.id === photoEntry.id; });
        if (p) {
          p.seo_desc = result.desc;
          p.seo_keywords = result.keywords;
          saveData(d2);
        }
      }).catch(function(e) { console.error('[auto-seo]', e.message); });
    }());

    mailer.sendPhotoNotification(photoEntry, {
      countryLabel: data[country].label,
      seriesLabel: data[country].series[series].label,
      countryKey: country,
      seriesKey: series,
    }).catch(err => console.error('[mailer] notification error:', err.message));

    tgNotifier.queue(photoEntry, country, series);

    res.redirect(`/admin/${country}/${series}/upload`);
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).send('Ошибка при загрузке: ' + err.message);
  }
});

router.post('/:country/:series/:id/delete', requireAuth, async (req, res) => {
  var { country, series, id } = req.params;
  if (!/^[a-z0-9-]+$/.test(country) || !/^[a-z0-9-]+$/.test(series) || !/^[a-z0-9-]+$/.test(id)) return res.redirect('/admin');
  var data = getData();
  if (!data[country] || !data[country].series[series]) return res.redirect('/admin');

  var photos = data[country].series[series].photos;
  var idx = photos.findIndex(p => p.id === id);
  if (idx === -1) return res.redirect('/admin');

  var photo = photos[idx];
  if (photo.urls) {
    try {
      await Promise.all([
        bucket.file(`${country}/${series}/${id}-400.webp`).delete().catch(() => {}),
        bucket.file(`${country}/${series}/${id}-800.webp`).delete(),
        bucket.file(`${country}/${series}/${id}-2400.webp`).delete(),
      ]);
    } catch (e) {}
  }

  data[country].series[series].photos.splice(idx, 1);
  saveData(data);
  res.redirect(`/admin/${country}/${series}/edit`);
});

// ── Shoots ──────────────────────────────────────────────────────────────────

router.get('/shoots', requireAuth, async (req, res) => {
  var stats = await photoStats.getStatsByType('shoot').catch(function() { return {}; });
  res.render('photo/admin/shoots', {
    title: 'Съёмки — AERO Admin',
    shoots: shoots.getData(),
    stats,
    error: req.query.error || null,
  });
});

router.post('/shoots', requireAuth, express.urlencoded({ extended: false }), async (req, res) => {
  var { slug, label, password } = req.body;
  if (!slug || !label) return res.redirect('/admin/shoots');
  var cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '');
  if (!cleanSlug) return res.redirect('/admin/shoots');
  if (shoots.getShoot(cleanSlug)) return res.redirect('/admin/shoots?error=' + encodeURIComponent('Съёмка с таким ключом уже существует'));
  try {
    await shoots.createShoot(cleanSlug, label.trim(), '', (password || '').trim());
    res.redirect('/admin/shoots/' + cleanSlug + '/edit');
  } catch (e) {
    console.error('[shoots] create error:', e);
    res.redirect('/admin/shoots?error=' + encodeURIComponent(e.message));
  }
});

router.get('/shoots/:slug/edit', requireAuth, (req, res) => {
  var { slug } = req.params;
  if (!/^[a-z0-9-]+$/.test(slug)) return res.redirect('/admin/shoots');
  var shoot = shoots.getShoot(slug);
  if (!shoot) return res.redirect('/admin/shoots');
  res.render('photo/admin/shoot-edit', {
    title: shoot.label + ' — AERO Admin',
    slug,
    shoot,
  });
});

router.post('/shoots/:slug/edit', requireAuth, express.urlencoded({ extended: false }), async (req, res) => {
  var { slug } = req.params;
  if (!/^[a-z0-9-]+$/.test(slug)) return res.redirect('/admin/shoots');
  if (!shoots.getShoot(slug)) return res.redirect('/admin/shoots');
  var { label, desc, password } = req.body;
  if (!label || !label.trim()) return res.redirect('/admin/shoots/' + slug + '/edit');
  try {
    await shoots.saveShoot(slug, {
      label: label.trim(),
      desc: (desc || '').trim(),
      password: (password || '').trim(),
    });
    res.redirect('/admin/shoots/' + slug + '/edit');
  } catch (e) {
    console.error('[shoots] save error:', e);
    res.redirect('/admin/shoots/' + slug + '/edit?error=' + encodeURIComponent(e.message));
  }
});

router.post('/shoots/:slug/upload', requireAuth, upload.single('photo'), async (req, res) => {
  var { slug } = req.params;
  if (!/^[a-z0-9-]+$/.test(slug)) return res.redirect('/admin/shoots');
  var shoot = shoots.getShoot(slug);
  if (!shoot) return res.redirect('/admin/shoots');
  if (!req.file) return res.redirect('/admin/shoots/' + slug + '/edit');

  var { title, date, desc } = req.body;
  var shootType = ['copter', 'camera', 'mobile'].includes(req.body.type) ? req.body.type : 'camera';
  var shootCoords = null;
  var shootShotAt = null;
  try {
    var shootExif = await exifr.parse(req.file.buffer, { gps: true, pick: ['DateTimeOriginal', 'CreateDate'] });
    if (shootExif) {
      if (shootExif.latitude != null) shootCoords = { lat: shootExif.latitude, lng: shootExif.longitude };
      var shootExifDate = shootExif.DateTimeOriginal || shootExif.CreateDate;
      if (shootExifDate instanceof Date && !isNaN(shootExifDate)) shootShotAt = shootExifDate.toISOString();
    }
  } catch (e) {}

  try {
    var baseName = path.basename(req.file.originalname, path.extname(req.file.originalname));
    var existingIds = shoot.photos.map(function(p) { return p.id; });
    var id = uniqueId(slugify((title && title.trim()) || baseName), existingIds);

    var [buf400, buf800, buf2400, colorFamily] = await Promise.all([
      sharp(req.file.buffer).resize({ width: 400, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(),
      sharp(req.file.buffer).resize({ width: 800, withoutEnlargement: true }).webp({ quality: 85 }).toBuffer(),
      sharp(req.file.buffer).resize({ width: 2400, withoutEnlargement: true }).webp({ quality: 90 }).toBuffer(),
      extractColorFamily(req.file.buffer),
    ]);

    var p400  = 'shoots/' + slug + '/' + id + '-400.webp';
    var p800  = 'shoots/' + slug + '/' + id + '-800.webp';
    var p2400 = 'shoots/' + slug + '/' + id + '-2400.webp';

    await Promise.all([
      bucket.file(p400).save(buf400,   { contentType: 'image/webp' }).then(function() { return bucket.file(p400).makePublic(); }),
      bucket.file(p800).save(buf800,   { contentType: 'image/webp' }).then(function() { return bucket.file(p800).makePublic(); }),
      bucket.file(p2400).save(buf2400, { contentType: 'image/webp' }).then(function() { return bucket.file(p2400).makePublic(); }),
    ]);

    var base = 'https://storage.googleapis.com/' + process.env.PHOTO_BUCKET;
    var photoEntry = {
      id,
      title: (title && title.trim()) || baseName,
      date: date || '',
      desc: desc || '',
      type: shootType,
      createdAt: new Date().toISOString().slice(0, 10),
      urls: {
        thumb:   base + '/' + p400,
        preview: base + '/' + p800,
        full:    base + '/' + p2400,
      },
    };
    if (colorFamily) photoEntry.colorFamily = colorFamily;
    if (shootCoords) photoEntry.coords = shootCoords;
    if (shootShotAt) photoEntry.shotAt = shootShotAt;

    await shoots.addPhoto(slug, photoEntry);
    pingSitemaps();
    indexNowSubmit('https://photo.dimazvali.com/shoot/' + slug);
    res.redirect('/admin/shoots/' + slug + '/edit');
  } catch (err) {
    console.error('[shoots] upload error:', err);
    res.status(500).send('Ошибка при загрузке: ' + err.message);
  }
});

router.get('/shoots/:slug/photos/:id/edit', requireAuth, (req, res) => {
  var { slug, id } = req.params;
  if (!/^[a-z0-9-]+$/.test(slug) || !/^[a-z0-9-]+$/.test(id)) return res.redirect('/admin/shoots');
  var shoot = shoots.getShoot(slug);
  if (!shoot) return res.redirect('/admin/shoots');
  var photo = shoot.photos.find(function(p) { return p.id === id; });
  if (!photo) return res.redirect('/admin/shoots/' + slug + '/edit');
  res.render('photo/admin/shoot-photo-edit', {
    title: photo.title + ' — AERO Admin',
    slug,
    shootLabel: shoot.label,
    photo,
  });
});

router.post('/shoots/:slug/photos/:id/edit', requireAuth, express.urlencoded({ extended: false }), async (req, res) => {
  var { slug, id } = req.params;
  if (!/^[a-z0-9-]+$/.test(slug) || !/^[a-z0-9-]+$/.test(id)) return res.redirect('/admin/shoots');
  if (!shoots.getShoot(slug)) return res.redirect('/admin/shoots');
  var { title, date, desc } = req.body;
  var photoType = req.body.type;
  if (!title || !title.trim()) return res.redirect('/admin/shoots/' + slug + '/photos/' + id + '/edit');
  try {
    await shoots.updatePhoto(slug, id, {
      title: title.trim(),
      date: (date || '').trim(),
      desc: (desc || '').trim(),
      type: photoType,
    });
  } catch (e) {
    console.error('[shoots] update photo error:', e);
  }
  res.redirect('/admin/shoots/' + slug + '/edit');
});

router.post('/shoots/:slug/photos/:id/annotation/add', requireAuth, express.json(), async (req, res) => {
  var { slug, id } = req.params;
  if (!/^[a-z0-9-]+$/.test(slug) || !/^[a-z0-9-]+$/.test(id)) return res.status(400).json({ ok: false });
  var { x, y, text } = req.body;
  if (typeof x !== 'number' || typeof y !== 'number' || !text || !text.trim()) return res.status(400).json({ ok: false, error: 'invalid params' });
  if (x < 0 || x > 100 || y < 0 || y > 100) return res.status(400).json({ ok: false });
  if (!shoots.getShoot(slug)) return res.status(404).json({ ok: false });
  var annot = { id: Date.now().toString(), x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, text: text.trim(), createdAt: new Date().toISOString().slice(0, 10) };
  try {
    await shoots.addAnnotation(slug, id, annot);
    res.json({ ok: true, annotation: annot });
  } catch (e) {
    console.error('[shoots] addAnnotation error:', e);
    res.status(500).json({ ok: false });
  }
});

router.post('/shoots/:slug/photos/:id/annotation/:annotId/move', requireAuth, express.json(), async (req, res) => {
  var { slug, id, annotId } = req.params;
  if (!/^[a-z0-9-]+$/.test(slug) || !/^[a-z0-9-]+$/.test(id)) return res.status(400).json({ ok: false });
  var { x, y } = req.body;
  if (typeof x !== 'number' || typeof y !== 'number' || x < 0 || x > 100 || y < 0 || y > 100) return res.status(400).json({ ok: false });
  try {
    await shoots.moveAnnotation(slug, id, annotId, Math.round(x * 100) / 100, Math.round(y * 100) / 100);
    res.json({ ok: true });
  } catch (e) {
    console.error('[shoots] moveAnnotation error:', e);
    res.status(500).json({ ok: false });
  }
});

router.post('/shoots/:slug/photos/:id/annotation/:annotId/delete', requireAuth, async (req, res) => {
  var { slug, id, annotId } = req.params;
  if (!/^[a-z0-9-]+$/.test(slug) || !/^[a-z0-9-]+$/.test(id)) return res.redirect('/admin/shoots');
  try {
    await shoots.removeAnnotation(slug, id, annotId);
  } catch (e) {
    console.error('[shoots] removeAnnotation error:', e);
  }
  res.redirect('/admin/shoots/' + slug + '/photos/' + id + '/edit');
});

router.post('/shoots/:slug/photos/reorder', requireAuth, express.json(), async (req, res) => {
  var { slug } = req.params;
  if (!/^[a-z0-9-]+$/.test(slug)) return res.status(400).json({ ok: false });
  var shoot = shoots.getShoot(slug);
  if (!shoot) return res.status(404).json({ ok: false });
  var { order } = req.body;
  if (!Array.isArray(order)) return res.status(400).json({ ok: false });
  var validIds = shoot.photos.map(function(p) { return p.id; });
  if (order.length !== validIds.length ||
    new Set(order).size !== order.length ||
    !order.every(function(id) { return validIds.includes(id); })) {
    return res.status(400).json({ ok: false });
  }
  try {
    await shoots.reorderPhotos(slug, order);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false });
  }
});

router.post('/shoots/:slug/photos/:id/delete', requireAuth, async (req, res) => {
  var { slug, id } = req.params;
  if (!/^[a-z0-9-]+$/.test(slug) || !/^[a-z0-9-]+$/.test(id)) return res.redirect('/admin/shoots');
  if (!shoots.getShoot(slug)) return res.redirect('/admin/shoots');
  try {
    await Promise.all([
      bucket.file('shoots/' + slug + '/' + id + '-400.webp').delete().catch(function() {}),
      bucket.file('shoots/' + slug + '/' + id + '-800.webp').delete().catch(function() {}),
      bucket.file('shoots/' + slug + '/' + id + '-2400.webp').delete().catch(function() {}),
    ]);
    await shoots.removePhoto(slug, id);
  } catch (e) {
    console.error('[shoots] delete photo error:', e);
  }
  res.redirect('/admin/shoots/' + slug + '/edit');
});

router.post('/shoots/:slug/delete', requireAuth, async (req, res) => {
  var { slug } = req.params;
  if (!/^[a-z0-9-]+$/.test(slug)) return res.redirect('/admin/shoots');
  var shoot = shoots.getShoot(slug);
  if (!shoot) return res.redirect('/admin/shoots');
  try {
    await Promise.all(
      shoot.photos.map(function(photo) {
        return Promise.all([
          bucket.file('shoots/' + slug + '/' + photo.id + '-400.webp').delete().catch(function() {}),
          bucket.file('shoots/' + slug + '/' + photo.id + '-800.webp').delete().catch(function() {}),
          bucket.file('shoots/' + slug + '/' + photo.id + '-2400.webp').delete().catch(function() {}),
        ]);
      })
    );
    await shoots.deleteShoot(slug);
  } catch (e) {
    console.error('[shoots] delete shoot error:', e);
  }
  res.redirect('/admin/shoots');
});

router.get('/tags', requireAuth, (req, res) => {
  var error = req.query.error || null;
  res.render('photo/admin/tags', { tags: getTags(), title: 'Теги — photo.dimazvali.com Admin', error });
});

router.post('/tags', requireAuth, (req, res) => {
  var { slug, label } = req.body;
  if (!slug || !label) return res.redirect('/admin/tags');
  var clean = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '');
  if (!clean) return res.redirect('/admin/tags');
  var tags = getTags();
  if (!tags[clean]) {
    tags[clean] = { label, createdAt: new Date().toISOString().slice(0, 10) };
    saveTags(tags);
  }
  res.redirect('/admin/tags');
});

router.post('/tags/:slug/delete', requireAuth, (req, res) => {
  var { slug } = req.params;
  var data = getData();
  var inUse = Object.values(data).some(country =>
    Object.values(country.series).some(series =>
      series.photos.some(p => p.tags && p.tags.includes(slug))
    )
  );
  if (inUse) return res.redirect('/admin/tags?error=inuse');
  var tags = getTags();
  delete tags[slug];
  saveTags(tags);
  res.redirect('/admin/tags');
});

async function listUploadedImages() {
  var base = `https://storage.googleapis.com/${process.env.PHOTO_BUCKET}`;
  var [files] = await bucket.getFiles({ prefix: 'images/' });
  return files
    .filter(f => f.name.endsWith('-400.webp'))
    .map(f => {
      var stem = f.name.replace(/-400\.webp$/, '');
      var name = stem.replace(/^images\//, '');
      return {
        name,
        thumb: `${base}/${f.name}`,
        sm:  `${base}/${stem}-400.webp`,
        md:  `${base}/${stem}-800.webp`,
        lg:  `${base}/${stem}-2400.webp`,
      };
    })
    .reverse();
}

router.get('/images', requireAuth, async (req, res) => {
  try {
    var images = await listUploadedImages();
    res.render('photo/admin/images', {
      title: 'Изображения — AERO Admin',
      images,
      uploaded: req.query.uploaded || null,
      error: req.query.error || null,
    });
  } catch (err) {
    console.error('Images list error:', err);
    res.render('photo/admin/images', { title: 'Изображения — AERO Admin', images: [], uploaded: null, error: err.message });
  }
});

router.post('/images/upload', requireAuth, upload.single('image'), async (req, res) => {
  if (!req.file) return res.redirect('/admin/images?error=' + encodeURIComponent('Файл не выбран'));
  try {
    var rawName = req.body.name ? req.body.name.trim() : '';
    var basePart = rawName
      ? slugify(rawName)
      : slugify(path.basename(req.file.originalname, path.extname(req.file.originalname))) || 'image';
    var baseName = basePart + '-' + Date.now();

    var [buf400, buf800, buf2400] = await Promise.all([
      sharp(req.file.buffer).resize({ width: 400, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(),
      sharp(req.file.buffer).resize({ width: 800, withoutEnlargement: true }).webp({ quality: 85 }).toBuffer(),
      sharp(req.file.buffer).resize({ width: 2400, withoutEnlargement: true }).webp({ quality: 90 }).toBuffer(),
    ]);

    var p400  = `images/${baseName}-400.webp`;
    var p800  = `images/${baseName}-800.webp`;
    var p2400 = `images/${baseName}-2400.webp`;

    await Promise.all([
      bucket.file(p400).save(buf400,   { contentType: 'image/webp' }).then(() => bucket.file(p400).makePublic()),
      bucket.file(p800).save(buf800,   { contentType: 'image/webp' }).then(() => bucket.file(p800).makePublic()),
      bucket.file(p2400).save(buf2400, { contentType: 'image/webp' }).then(() => bucket.file(p2400).makePublic()),
    ]);

    res.redirect('/admin/images?uploaded=' + encodeURIComponent(baseName));
  } catch (err) {
    console.error('Image upload error:', err);
    res.redirect('/admin/images?error=' + encodeURIComponent(err.message));
  }
});

router.get('/:country/:series/edit', requireAuth, (req, res) => {
  var { country, series: seriesKey } = req.params;
  if (!/^[a-z0-9-]+$/.test(country) || !/^[a-z0-9-]+$/.test(seriesKey)) return res.redirect('/admin');
  var data = getData();
  if (!data[country] || !data[country].series[seriesKey]) return res.redirect('/admin');
  res.render('photo/admin/series-edit', {
    title: `${data[country].series[seriesKey].label} — AERO Admin`,
    countryKey: country,
    countryLabel: data[country].label,
    seriesKey,
    series: data[country].series[seriesKey],
  });
});

router.post('/:country/:series/edit', requireAuth, (req, res) => {
  var { country, series: seriesKey } = req.params;
  if (!/^[a-z0-9-]+$/.test(country) || !/^[a-z0-9-]+$/.test(seriesKey)) return res.redirect('/admin');
  var { label } = req.body;
  if (!label || !label.trim()) return res.redirect(`/admin/${country}/${seriesKey}/edit`);
  var data = getData();
  if (!data[country] || !data[country].series[seriesKey]) return res.redirect('/admin');
  data[country].series[seriesKey].label = label.trim();
  saveData(data);
  res.redirect(`/admin/${country}/${seriesKey}/edit`);
});

router.post('/:country/:series/archive', requireAuth, (req, res) => {
  var { country, series: seriesKey } = req.params;
  if (!/^[a-z0-9-]+$/.test(country) || !/^[a-z0-9-]+$/.test(seriesKey)) return res.redirect('/admin');
  var data = getData();
  if (!data[country] || !data[country].series[seriesKey]) return res.redirect('/admin');
  data[country].series[seriesKey].archived = !data[country].series[seriesKey].archived;
  saveData(data);
  res.redirect(`/admin/${country}/${seriesKey}/edit`);
});

router.post('/:country/:series/delete', requireAuth, async (req, res) => {
  var { country, series: seriesKey } = req.params;
  if (!/^[a-z0-9-]+$/.test(country) || !/^[a-z0-9-]+$/.test(seriesKey)) return res.redirect('/admin');
  var data = getData();
  if (!data[country] || !data[country].series[seriesKey]) return res.redirect('/admin');
  try {
    var photos = data[country].series[seriesKey].photos;
    await Promise.all(photos.map(function(p) {
      return Promise.all([
        bucket.file(`${country}/${seriesKey}/${p.id}-400.webp`).delete().catch(function() {}),
        bucket.file(`${country}/${seriesKey}/${p.id}-800.webp`).delete().catch(function() {}),
        bucket.file(`${country}/${seriesKey}/${p.id}-2400.webp`).delete().catch(function() {}),
      ]);
    }));
    if (data[country].seriesOrder) {
      data[country].seriesOrder = data[country].seriesOrder.filter(function(k) { return k !== seriesKey; });
    }
    delete data[country].series[seriesKey];
    saveData(data);
    res.redirect('/admin');
  } catch (err) {
    console.error('Series delete error:', err);
    res.status(500).send('Ошибка при удалении серии: ' + err.message);
  }
});

router.post('/:country/:series/reorder-photos', requireAuth, express.json(), (req, res) => {
  var { country, series: seriesKey } = req.params;
  if (!/^[a-z0-9-]+$/.test(country) || !/^[a-z0-9-]+$/.test(seriesKey)) {
    return res.status(400).json({ ok: false });
  }
  var { order } = req.body;
  var data = getData();
  if (!data[country] || !data[country].series[seriesKey] || !Array.isArray(order)) {
    return res.status(400).json({ ok: false });
  }
  var photos = data[country].series[seriesKey].photos;
  var photoMap = {};
  photos.forEach(function(p) { photoMap[p.id] = p; });
  var validIds = photos.map(function(p) { return p.id; });
  if (!order.every(function(id) { return validIds.includes(id); })) {
    return res.status(400).json({ ok: false });
  }
  if (order.length !== photos.length) {
    return res.status(400).json({ ok: false });
  }
  if (new Set(order).size !== order.length) {
    return res.status(400).json({ ok: false });
  }
  data[country].series[seriesKey].photos = order.map(function(id) { return photoMap[id]; });
  saveData(data);
  res.json({ ok: true });
});

router.get('/:country/:series/:id/edit', requireAuth, (req, res) => {
  var { country, series: seriesKey, id } = req.params;
  if (!/^[a-z0-9-]+$/.test(country) || !/^[a-z0-9-]+$/.test(seriesKey) || !/^[a-z0-9-]+$/.test(id)) {
    return res.redirect('/admin');
  }
  var data = getData();
  if (!data[country] || !data[country].series[seriesKey]) return res.redirect('/admin');
  var photo = data[country].series[seriesKey].photos.find(function(p) { return p.id === id; });
  if (!photo) return res.redirect('/admin');
  res.render('photo/admin/photo-edit', {
    title: `${photo.title} — AERO Admin`,
    countryKey: country,
    seriesKey,
    photo,
    tags: getTags(),
  });
});

router.post('/:country/:series/:id/edit', requireAuth, upload.single('photo'), async (req, res) => {
  var { country, series: seriesKey, id } = req.params;
  if (!/^[a-z0-9-]+$/.test(country) || !/^[a-z0-9-]+$/.test(seriesKey) || !/^[a-z0-9-]+$/.test(id)) {
    return res.redirect('/admin');
  }
  var { title, date, desc } = req.body;
  var seoDesc = (req.body.seo_desc || '').trim();
  var seoKeywords = (req.body.seo_keywords || '').trim();
  var photoType = ['copter', 'camera', 'mobile'].includes(req.body.type) ? req.body.type : 'copter';
  if (!title || !title.trim()) return res.redirect(`/admin/${country}/${seriesKey}/${id}/edit`);
  var instagramUrl = req.body.instagram ? req.body.instagram.trim() : '';
  if (instagramUrl && !instagramUrl.startsWith('https://')) instagramUrl = '';
  var data = getData();
  if (!data[country] || !data[country].series[seriesKey]) return res.redirect('/admin');
  var photos = data[country].series[seriesKey].photos;
  var idx = photos.findIndex(function(p) { return p.id === id; });
  if (idx === -1) return res.redirect('/admin');
  var photo = photos[idx];
  var knownTags = getTags();
  var rawTags = req.body.tags ? (Array.isArray(req.body.tags) ? req.body.tags : [req.body.tags]) : [];
  var tags = rawTags.filter(function(s) { return knownTags[s]; });
  var latRaw = parseFloat(req.body.lat);
  var lngRaw = parseFloat(req.body.lng);
  var altEditRaw = parseFloat(req.body.altitude);
  photo.title = title.trim();
  photo.date = date ? date.trim() : '';
  photo.desc = desc ? desc.trim() : '';
  if (instagramUrl) { photo.instagram = instagramUrl; } else { delete photo.instagram; }
  if (!isNaN(latRaw) && !isNaN(lngRaw) && Math.abs(latRaw) <= 90 && Math.abs(lngRaw) <= 180) {
    photo.coords = { lat: latRaw, lng: lngRaw };
  } else {
    delete photo.coords;
  }
  if (!isNaN(altEditRaw) && altEditRaw >= 0) { photo.altitude = Math.round(altEditRaw); } else { delete photo.altitude; }
  if (tags.length) { photo.tags = tags; } else { delete photo.tags; }
  if (seoDesc) { photo.seo_desc = seoDesc; } else { delete photo.seo_desc; }
  if (seoKeywords) { photo.seo_keywords = seoKeywords; } else { delete photo.seo_keywords; }
  photo.type = photoType;
  try {
    if (req.file) {
      var [buf400, buf800, buf2400, colorFamily] = await Promise.all([
        sharp(req.file.buffer).resize({ width: 400, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(),
        sharp(req.file.buffer).resize({ width: 800, withoutEnlargement: true }).webp({ quality: 85 }).toBuffer(),
        sharp(req.file.buffer).resize({ width: 2400, withoutEnlargement: true }).webp({ quality: 90 }).toBuffer(),
        extractColorFamily(req.file.buffer),
      ]);
      var path400 = `${country}/${seriesKey}/${id}-400.webp`;
      var path800 = `${country}/${seriesKey}/${id}-800.webp`;
      var path2400 = `${country}/${seriesKey}/${id}-2400.webp`;
      await Promise.all([
        bucket.file(path400).save(buf400, { contentType: 'image/webp' }).then(() => bucket.file(path400).makePublic()),
        bucket.file(path800).save(buf800, { contentType: 'image/webp' }).then(() => bucket.file(path800).makePublic()),
        bucket.file(path2400).save(buf2400, { contentType: 'image/webp' }).then(() => bucket.file(path2400).makePublic()),
      ]);
      var base = `https://storage.googleapis.com/${process.env.PHOTO_BUCKET}`;
      photo.urls = { thumb: `${base}/${path400}`, preview: `${base}/${path800}`, full: `${base}/${path2400}` };
      if (colorFamily) photo.colorFamily = colorFamily;
    }
    saveData(data);
    res.redirect(`/admin/${country}/${seriesKey}/edit`);
  } catch (err) {
    console.error('Photo edit error:', err);
    res.status(500).send('Ошибка при замене фото: ' + err.message);
  }
});

// ── Copyright hits ────────────────────────────────────────────────────────────

router.get('/copyright', requireAuth, async (req, res) => {
  var onlyNew = req.query.filter !== 'all';
  try {
    var hits = await copyright.getHits({ onlyNew });
    var total = hits.length;
    // group by photo
    var byPhoto = {};
    hits.forEach(function(h) {
      var key = h.countryKey + '/' + h.seriesKey + '/' + h.photoId;
      if (!byPhoto[key]) byPhoto[key] = { photoTitle: h.photoTitle, countryKey: h.countryKey, seriesKey: h.seriesKey, photoId: h.photoId, imageUrl: h.imageUrl, hits: [] };
      byPhoto[key].hits.push(h);
    });
    res.render('photo/admin/copyright', {
      title: 'Использования — AERO Admin',
      groups: Object.values(byPhoto),
      total,
      onlyNew,
      error: null,
    });
  } catch (err) {
    res.render('photo/admin/copyright', { title: 'Использования — AERO Admin', groups: [], total: 0, onlyNew, error: err.message });
  }
});

router.post('/copyright/run', requireAuth, (req, res) => {
  var started = copyrightCheck.run(fb, getData(), process.env.PHOTO_ENV || 'dev', shoots.getData());
  res.json({ ok: true, started });
});

router.get('/copyright/run/status', requireAuth, (req, res) => {
  res.json(copyrightCheck.getState());
});

router.post('/copyright/clear-photo', requireAuth, express.urlencoded({ extended: false }), async (req, res) => {
  var photoId = (req.body.photoId || '').trim();
  if (photoId) {
    try { await copyright.clearPhoto(photoId); } catch (e) { console.error(e.message); }
  }
  res.redirect(req.headers.referer || '/admin/copyright');
});

router.post('/copyright/:id/dismiss', requireAuth, async (req, res) => {
  try { await copyright.dismissHit(req.params.id); } catch (e) { console.error(e.message); }
  res.redirect(req.headers.referer || '/admin/copyright');
});

router.post('/copyright/:id/undismiss', requireAuth, async (req, res) => {
  try { await copyright.undismissHit(req.params.id); } catch (e) { console.error(e.message); }
  res.redirect(req.headers.referer || '/admin/copyright');
});

router.post('/copyright/:id/delete', requireAuth, async (req, res) => {
  try { await copyright.deleteHit(req.params.id); } catch (e) { console.error(e.message); }
  res.redirect(req.headers.referer || '/admin/copyright');
});

// ── Annotations ──────────────────────────────────────────────────────────────

router.post('/:country/:series/:id/annotation/add', requireAuth, express.json(), (req, res) => {
  var { country, series: seriesKey, id } = req.params;
  if (!/^[a-z0-9-]+$/.test(country) || !/^[a-z0-9-]+$/.test(seriesKey) || !/^[a-z0-9-]+$/.test(id)) {
    return res.status(400).json({ ok: false, error: 'invalid params' });
  }
  var x = parseFloat(req.body.x);
  var y = parseFloat(req.body.y);
  var text = (req.body.text || '').trim();
  if (!text || isNaN(x) || isNaN(y) || x < 0 || x > 100 || y < 0 || y > 100) {
    return res.status(400).json({ ok: false, error: 'invalid data' });
  }
  var data = getData();
  if (!data[country] || !data[country].series[seriesKey]) return res.status(404).json({ ok: false });
  var photo = data[country].series[seriesKey].photos.find(function(p) { return p.id === id; });
  if (!photo) return res.status(404).json({ ok: false });
  var annot = { id: Date.now().toString(), x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, text, createdAt: new Date().toISOString().slice(0, 10) };
  if (!photo.annotations) photo.annotations = [];
  photo.annotations.push(annot);
  saveData(data);
  res.json({ ok: true, annotation: annot });
});

router.post('/:country/:series/:id/annotation/:annotId/move', requireAuth, express.json(), (req, res) => {
  var { country, series: seriesKey, id, annotId } = req.params;
  if (!/^[a-z0-9-]+$/.test(country) || !/^[a-z0-9-]+$/.test(seriesKey) || !/^[a-z0-9-]+$/.test(id)) {
    return res.status(400).json({ ok: false });
  }
  var x = parseFloat(req.body.x);
  var y = parseFloat(req.body.y);
  if (isNaN(x) || isNaN(y) || x < 0 || x > 100 || y < 0 || y > 100) {
    return res.status(400).json({ ok: false, error: 'invalid coords' });
  }
  var data = getData();
  if (!data[country] || !data[country].series[seriesKey]) return res.status(404).json({ ok: false });
  var photo = data[country].series[seriesKey].photos.find(function(p) { return p.id === id; });
  if (!photo || !photo.annotations) return res.status(404).json({ ok: false });
  var annot = photo.annotations.find(function(a) { return a.id === annotId; });
  if (!annot) return res.status(404).json({ ok: false });
  annot.x = Math.round(x * 100) / 100;
  annot.y = Math.round(y * 100) / 100;
  saveData(data);
  res.json({ ok: true });
});

router.post('/:country/:series/:id/annotation/:annotId/delete', requireAuth, (req, res) => {
  var { country, series: seriesKey, id, annotId } = req.params;
  if (!/^[a-z0-9-]+$/.test(country) || !/^[a-z0-9-]+$/.test(seriesKey) || !/^[a-z0-9-]+$/.test(id)) {
    return res.redirect('/admin');
  }
  var data = getData();
  if (!data[country] || !data[country].series[seriesKey]) return res.redirect('/admin');
  var photo = data[country].series[seriesKey].photos.find(function(p) { return p.id === id; });
  if (photo && photo.annotations) {
    photo.annotations = photo.annotations.filter(function(a) { return a.id !== annotId; });
    if (!photo.annotations.length) delete photo.annotations;
    saveData(data);
  }
  res.redirect('/admin/' + country + '/' + seriesKey + '/' + id + '/edit');
});

// POST /admin/:country/:series/:id/generate-seo — AI SEO generation for single photo
router.post('/:country/:series/:id/generate-seo', requireAuth, express.json(), async (req, res) => {
  var { country, series: seriesKey, id } = req.params;
  if (!/^[a-z0-9-]+$/.test(country) || !/^[a-z0-9-]+$/.test(seriesKey) || !/^[a-z0-9-]+$/.test(id)) {
    return res.status(400).json({ error: 'Invalid params' });
  }
  var data = getData();
  if (!data[country] || !data[country].series[seriesKey]) return res.status(404).json({ error: 'Not found' });
  var photo = data[country].series[seriesKey].photos.find(function(p) { return p.id === id; });
  if (!photo) return res.status(404).json({ error: 'Not found' });

  try {
    var { generatePhotoSeo } = require('../lib/photo-seo');
    var result = await generatePhotoSeo(photo, {
      countryLabel: data[country].label,
      seriesLabel: data[country].series[seriesKey].label,
      allTags: getTags(),
    });
    photo.seo_desc = result.desc;
    photo.seo_keywords = result.keywords;
    saveData(data);
    res.json({ ok: true, desc: photo.seo_desc, keywords: photo.seo_keywords });
  } catch (err) {
    console.error('[generate-seo]', err.message);
    res.status(500).json({ error: err.message });
  }
});

async function checkAdminToken(req) {
  var tokenId = req.signedCookies && req.signedCookies.photoAdminToken;
  if (!tokenId) return false;
  try {
    var doc = await adminTokens.doc(tokenId).get();
    return doc.exists;
  } catch (e) {
    return false;
  }
}

module.exports = router;
module.exports.checkAdminToken = checkAdminToken;
module.exports.indexNowSubmit = indexNowSubmit;
module.exports.bucket = bucket;