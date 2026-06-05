var express = require('express');
var router = express.Router();
var path = require('path');
var multer = require('multer');
var sharp = require('sharp');
var exifr = require('exifr');
var { getData, saveData } = require('../lib/photo-data');
var { getTags, saveTags } = require('../lib/photo-tags');

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

var upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only images allowed'));
    cb(null, true);
  },
});

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

router.post('/country', requireAuth, (req, res) => {
  var { key, label } = req.body;
  if (!key || !label) return res.redirect('/admin');
  var data = getData();
  var k = slugify(key);
  if (!data[k]) {
    data[k] = { label, series: {} };
    saveData(data);
  }
  res.redirect('/admin');
});

router.get('/country/:key/edit', requireAuth, (req, res) => {
  var { key } = req.params;
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
  var { label } = req.body;
  if (!label || !label.trim()) return res.redirect(`/admin/country/${key}/edit`);
  var data = getData();
  if (!data[key]) return res.redirect('/admin');
  data[key].label = label.trim();
  saveData(data);
  res.redirect(`/admin/country/${key}/edit`);
});

router.post('/country/:key/archive', requireAuth, (req, res) => {
  var { key } = req.params;
  var data = getData();
  if (!data[key]) return res.redirect('/admin');
  data[key].archived = !data[key].archived;
  saveData(data);
  res.redirect(`/admin/country/${key}/edit`);
});

router.post('/country/:key/delete', requireAuth, (req, res) => {
  var { key } = req.params;
  var data = getData();
  if (!data[key]) return res.redirect('/admin');
  if (Object.keys(data[key].series).length > 0) {
    return res.redirect(`/admin/country/${key}/edit?error=Удалите все серии перед удалением страны`);
  }
  delete data[key];
  saveData(data);
  res.redirect('/admin');
});

router.post('/series/:country', requireAuth, (req, res) => {
  var { country } = req.params;
  var { key, label } = req.body;
  if (!key || !label) return res.redirect('/admin');
  var data = getData();
  if (!data[country]) return res.redirect('/admin');
  var k = slugify(key);
  if (!data[country].series[k]) {
    data[country].series[k] = { label, photos: [] };
    saveData(data);
  }
  res.redirect('/admin');
});

router.get('/:country/:series/upload', requireAuth, (req, res) => {
  var { country, series } = req.params;
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
  });
});

router.post('/:country/:series/upload', requireAuth, upload.single('photo'), async (req, res) => {
  var { country, series } = req.params;
  var { title, date, desc } = req.body;
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
  var coords = null;
  if (!isNaN(latRaw) && !isNaN(lngRaw) && Math.abs(latRaw) <= 90 && Math.abs(lngRaw) <= 180) {
    coords = { lat: latRaw, lng: lngRaw };
  } else {
    try {
      var gps = await exifr.gps(req.file.buffer);
      if (gps) coords = { lat: gps.latitude, lng: gps.longitude };
    } catch (e) {}
  }

  try {
    var baseName = path.basename(req.file.originalname, path.extname(req.file.originalname));
    var existingIds = data[country].series[series].photos.map(p => p.id);
    var id = uniqueId(slugify(baseName), existingIds);

    var [buf800, buf2400] = await Promise.all([
      sharp(req.file.buffer).resize({ width: 800, withoutEnlargement: true }).webp({ quality: 85 }).toBuffer(),
      sharp(req.file.buffer).resize({ width: 2400, withoutEnlargement: true }).webp({ quality: 90 }).toBuffer(),
    ]);

    var path800 = `${country}/${series}/${id}-800.webp`;
    var path2400 = `${country}/${series}/${id}-2400.webp`;

    await Promise.all([
      bucket.file(path800).save(buf800, { contentType: 'image/webp' }).then(() => bucket.file(path800).makePublic()),
      bucket.file(path2400).save(buf2400, { contentType: 'image/webp' }).then(() => bucket.file(path2400).makePublic()),
    ]);

    var base = `https://storage.googleapis.com/${process.env.PHOTO_BUCKET}`;
    var photoEntry = {
      id,
      title: title || baseName,
      date: date || '',
      desc: desc || '',
      urls: {
        preview: `${base}/${path800}`,
        full: `${base}/${path2400}`,
      },
    };
    if (tags.length) photoEntry.tags = tags;
    if (coords) photoEntry.coords = coords;
    if (instagramUrl) photoEntry.instagram = instagramUrl;
    data[country].series[series].photos.push(photoEntry);
    saveData(data);

    res.redirect(`/admin/${country}/${series}/upload`);
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).send('Ошибка при загрузке: ' + err.message);
  }
});

router.post('/:country/:series/:id/delete', requireAuth, async (req, res) => {
  var { country, series, id } = req.params;
  var data = getData();
  if (!data[country] || !data[country].series[series]) return res.redirect('/admin');

  var photos = data[country].series[series].photos;
  var idx = photos.findIndex(p => p.id === id);
  if (idx === -1) return res.redirect('/admin');

  var photo = photos[idx];
  if (photo.urls) {
    try {
      await Promise.all([
        bucket.file(`${country}/${series}/${id}-800.webp`).delete(),
        bucket.file(`${country}/${series}/${id}-2400.webp`).delete(),
      ]);
    } catch (e) {}
  }

  data[country].series[series].photos.splice(idx, 1);
  saveData(data);
  res.redirect('/admin');
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
    tags[clean] = { label };
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

module.exports = router;