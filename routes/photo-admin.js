var express = require('express');
var router = express.Router();
var path = require('path');
var cron = require('node-cron');
var multer = require('multer');
var sharp = require('sharp');
var exifr = require('exifr');
var { getData, saveData, initFromFirestore } = require('../lib/photo-data');
var { getTags, saveTags, initTagsFromFirestore } = require('../lib/photo-tags');
var photoStats = require('../lib/photo-stats');
var { extractColorFamily, COLOR_FAMILIES } = require('../lib/color-utils');
var subscriptions = require('../lib/photo-subscriptions');
var mailer = require('../lib/photo-mailer');
var copyright = require('../lib/photo-copyright');
var copyrightCheck = require('../lib/photo-copyright-check');
var shoots = require('../lib/photo-shoots');
var photoPeople = require('../lib/photo-people');
var photoUsers = require('../lib/photo-users');
var tgNotifier = require('../lib/photo-tg-notifier');
var photoComments = require('../lib/photo-comments');

var axios = require('axios');

var { initializeApp, getApps, cert } = require('firebase-admin/app');
var { getFirestore } = require('firebase-admin/firestore');
var { getStorage } = require('firebase-admin/storage');
var { JWT } = require('google-auth-library');

var GCP_SERVICE_ACCOUNT_EMAIL = 'firebase-adminsdk-4iwd4@dimazvalimisc.iam.gserviceaccount.com';

var photoApp = getApps().find(a => a.name === 'photo') || initializeApp({
  credential: cert({
    type: 'service_account',
    project_id: 'dimazvalimisc',
    private_key_id: '5eb5025afc0fe53b63f518ba071f89e7b7ce03af',
    private_key: process.env.sssGCPKey.replace(/\\n/g, '\n'),
    client_email: GCP_SERVICE_ACCOUNT_EMAIL,
    client_id: '110523994931477712119',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-4iwd4%40dimazvalimisc.iam.gserviceaccount.com',
  }),
  storageBucket: process.env.PHOTO_BUCKET,
}, 'photo');

// Reuses the Firebase service account key — it must also be added as an
// Owner of the photo.dimazvali.com property in Search Console, and the
// "Web Search Indexing API" must be enabled on the dimazvalimisc GCP project.
// Note: this API is only officially sanctioned for JobPosting/BroadcastEvent
// pages; using it for regular photo pages works in practice but is unsupported
// by Google and could stop working or get the account rate-limited without notice.
var indexingAuth = new JWT({
  email: GCP_SERVICE_ACCOUNT_EMAIL,
  key: process.env.sssGCPKey.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/indexing'],
});

var fb = getFirestore(photoApp);
var bucket = getStorage(photoApp).bucket();
var adminTokens = fb.collection('PHOTOadminTokens');

initFromFirestore(fb).catch(console.error);
initTagsFromFirestore(fb).catch(console.error);
photoStats.init(fb);
subscriptions.init(fb);
photoUsers.init(fb);
photoComments.init(fb);
mailer.init();
copyright.init(fb);
shoots.initFromFirestore(fb).catch(console.error);
photoPeople.initFromFirestore(fb).catch(console.error);

// Daily copyright/usage scan, chunked to stay within Vision Web Detection's
// 1000-unit/month free tier (see photo-copyright-check.js#runQuotaBatch for
// the cursor + monthly-budget bookkeeping). Skips silently if a manual scan
// (admin button) is already running.
cron.schedule('0 4 * * *', function() {
  copyrightCheck.runQuotaBatch(fb, getData(), process.env.PHOTO_ENV || 'dev', shoots.getData())
    .catch(function(e) { console.error('[copyright-check cron]', e.message); });
});

var upload = multer({
  storage: multer.memoryStorage(),
  // Panoramas keep an unresized original-size copy (see savePanoAsset) — those
  // source files routinely exceed the old 30MB cap, so give plenty of headroom.
  limits: { fileSize: 200 * 1024 * 1024 },
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

function googleIndexingSubmit(urls) {
  (Array.isArray(urls) ? urls : [urls]).forEach(function(url) {
    indexingAuth.request({
      url: 'https://indexing.googleapis.com/v3/urlNotifications:publish',
      method: 'POST',
      data: { url: url, type: 'URL_UPDATED' },
    }).catch(function(e) { console.error('[google-indexing]', e.message); });
  });
}

function slugify(str) {
  var map = {
    а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'yo',ж:'zh',з:'z',и:'i',й:'j',
    к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',
    х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya',
    // Georgian (Mkhedruli) — no case, safe to list alongside the (already lower) Cyrillic map
    ა:'a',ბ:'b',გ:'g',დ:'d',ე:'e',ვ:'v',ზ:'z',თ:'t',ი:'i',კ:'k',ლ:'l',
    მ:'m',ნ:'n',ო:'o',პ:'p',ჟ:'zh',რ:'r',ს:'s',ტ:'t',უ:'u',ფ:'f',ქ:'k',
    ღ:'gh',ყ:'q',შ:'sh',ჩ:'ch',ც:'ts',ძ:'dz',წ:'ts',ჭ:'ch',ხ:'kh',ჯ:'j',ჰ:'h',
  };
  return str.toLowerCase()
    .split('').map(c => map[c] !== undefined ? map[c] : c).join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function uniqueId(base, existingIds) {
  // slugify() can legitimately return '' — a title in a script it has no transliteration
  // table for (or emoji-only) leaves nothing after the [^a-z0-9]+ strip. Never hand back
  // an empty id: it breaks every link built from it (/country/series/ with a trailing
  // slash and nothing after).
  if (!base) base = 'photo-' + Date.now().toString(36);
  if (!existingIds.includes(base)) return base;
  var n = 2;
  while (existingIds.includes(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

// Panoramas get one extra asset: a full-resolution (unresized) webp, used by the
// zoom/pan viewer instead of the 2400px "full" copy. Re-encoded (not stored raw)
// to keep it a reasonable size while staying pixel-original.
async function savePanoAsset(fileBuffer, storagePath) {
  var buf = await sharp(fileBuffer).webp({ quality: 90 }).toBuffer();
  await bucket.file(storagePath).save(buf, { contentType: 'image/webp' });
  await bucket.file(storagePath).makePublic();
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

// Resolves a comment's opaque photoId ("country_series_id" for gallery photos,
// "shoot_slug_id" for shoot photos — no part contains "_", validateSlug enforces
// it) to a human label + public URL.
function resolveCommentPhoto(photoId, photoData, shootsData) {
  var parts = String(photoId || '').split('_');
  if (parts[0] === 'shoot') {
    var slug = parts[1], pid = parts.slice(2).join('_');
    var sh = shootsData[slug];
    var ph = sh && (sh.photos || []).find(function(x) { return x.id === pid; });
    return {
      kind: 'shoot',
      label: (sh ? sh.label : slug) + ' · ' + (ph ? ph.title : pid),
      url: '/shoot/' + slug + '/' + pid,
      editUrl: sh ? '/admin/shoots/' + slug + '/photos/' + pid + '/edit' : null,
    };
  }
  var country = parts[0], series = parts[1], pid2 = parts.slice(2).join('_');
  var c = photoData[country];
  var s = c && c.series && c.series[series];
  var ph2 = s && s.photos.find(function(x) { return x.id === pid2; });
  return {
    kind: 'gallery',
    label: (c ? c.label : country) + ' · ' + (s ? s.label : series) + ' · ' + (ph2 ? ph2.title : pid2),
    url: '/' + country + '/' + series + '/' + pid2,
    editUrl: s ? '/admin/' + country + '/' + series + '/' + pid2 + '/edit' : null,
  };
}

// GET /admin/feedback — all visitor comments + all visitor marks in one place
router.get('/feedback', requireAuth, async (req, res) => {
  var photoData = getData();
  var shootsData = shoots.getData();

  var rawComments = await photoComments.getAllComments(500).catch(function(e) {
    console.error('[feedback] getAllComments:', e.message);
    return [];
  });
  var comments = rawComments.map(function(c) {
    var loc = resolveCommentPhoto(c.photoId, photoData, shootsData);
    return Object.assign({}, c, { photoLabel: loc.label, photoUrl: loc.url, photoEditUrl: loc.editUrl });
  });

  var marks = [];
  Object.keys(shootsData).forEach(function(slug) {
    var sh = shootsData[slug];
    (sh.photos || []).forEach(function(photo) {
      (photo.annotations || []).forEach(function(a) {
        if (a.source !== 'client') return;
        marks.push({
          slug: slug,
          shootLabel: sh.label,
          photoId: photo.id,
          photoTitle: photo.title,
          annotId: a.id,
          text: a.text,
          authorName: a.authorName || '',
          authorPicture: a.authorPicture || '',
          createdAt: a.createdAt || '',
          photoUrl: '/shoot/' + slug + '/' + photo.id,
          photoEditUrl: '/admin/shoots/' + slug + '/photos/' + photo.id + '/edit',
        });
      });
    });
  });
  marks.sort(function(a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });

  res.render('photo/admin/feedback', {
    title: 'Комментарии и отметки — AERO Admin',
    comments: comments,
    marks: marks,
  });
});

router.post('/feedback/comment-hide', requireAuth, express.urlencoded({ extended: false }), async (req, res) => {
  var id = (req.body.commentId || '').trim();
  if (/^[A-Za-z0-9]+$/.test(id)) await photoComments.hideComment(id).catch(function(e) { console.error('[feedback hide]', e.message); });
  res.redirect('/admin/feedback');
});

router.post('/feedback/comment-unhide', requireAuth, express.urlencoded({ extended: false }), async (req, res) => {
  var id = (req.body.commentId || '').trim();
  if (/^[A-Za-z0-9]+$/.test(id)) await photoComments.unhideComment(id).catch(function(e) { console.error('[feedback unhide]', e.message); });
  res.redirect('/admin/feedback');
});

router.post('/feedback/mark-delete', requireAuth, express.urlencoded({ extended: false }), async (req, res) => {
  var slug = (req.body.slug || '').trim();
  var photoId = (req.body.photoId || '').trim();
  var annotId = (req.body.annotId || '').trim();
  if (/^[a-z0-9-]+$/.test(slug) && /^[a-z0-9-]+$/.test(photoId) && annotId) {
    await shoots.removeAnnotation(slug, photoId, annotId).catch(function(e) { console.error('[feedback mark-delete]', e.message); });
  }
  res.redirect('/admin/feedback');
});

router.get('/subscribers', requireAuth, async (req, res) => {
  try {
    var [emailSubs, googleUsers] = await Promise.all([
      subscriptions.listAll(),
      photoUsers.listAll(),
    ]);
    res.render('photo/admin/subscribers', { title: 'Подписчики — AERO Admin', emailSubs, googleUsers, error: null });
  } catch (err) {
    console.error('[subscribers] list error:', err.message);
    res.render('photo/admin/subscribers', { title: 'Подписчики — AERO Admin', emailSubs: [], googleUsers: [], error: err.message });
  }
});

router.post('/subscribers/email/:id/toggle', requireAuth, async (req, res) => {
  await subscriptions.toggleActive(req.params.id).catch(function(e) { console.error('[subscribers] toggle email error:', e.message); });
  res.redirect('/admin/subscribers');
});

router.post('/subscribers/google/:id/toggle', requireAuth, async (req, res) => {
  await photoUsers.toggleActive(req.params.id).catch(function(e) { console.error('[subscribers] toggle google error:', e.message); });
  res.redirect('/admin/subscribers');
});

var ENTITY_TYPE_ORDER = ['country', 'series', 'photo', 'shoot', 'shoot-photo'];
var ENTITY_TYPE_LABELS = { country: 'СТРАНЫ', series: 'СЕРИИ', photo: 'ФОТО', shoot: 'СЪЁМКИ', 'shoot-photo': 'КАДРЫ СЪЁМОК' };

function resolveEntityInfo(typeStr, idStr, photoData, shootsData) {
  var label = idStr;
  var url = null;
  if (typeStr === 'country') {
    url = '/' + idStr;
    label = (photoData[idStr] || {}).label || idStr;
  } else if (typeStr === 'series') {
    var p = idStr.split('/');
    url = '/' + idStr;
    var c = photoData[p[0]];
    if (c && c.series && c.series[p[1]]) label = c.label + ' · ' + c.series[p[1]].label;
  } else if (typeStr === 'photo') {
    var p = idStr.split('/');
    url = '/' + idStr;
    var c = photoData[p[0]];
    if (c && c.series && c.series[p[1]]) {
      var ph = c.series[p[1]].photos.find(function(x) { return x.id === p[2]; });
      if (ph) label = ph.title || idStr;
    }
  } else if (typeStr === 'shoot') {
    url = '/shoot/' + idStr;
    label = ((shootsData[idStr] || {}).label) || idStr;
  } else if (typeStr === 'shoot-photo') {
    var p = idStr.split('/');
    url = '/shoot/' + idStr;
    var sh = shootsData[p[0]];
    if (sh) {
      var ph = (sh.photos || []).find(function(x) { return x.id === p[1]; });
      if (ph) label = ph.title || idStr;
    }
  }
  return { type: typeStr, id: idStr, label: label, url: url };
}

function buildEntityGroups(byEntity, photoData, shootsData) {
  var byType = {};
  Object.entries(byEntity).forEach(function(entry) {
    var colon = entry[0].indexOf(':');
    var t = entry[0].slice(0, colon);
    var id = entry[0].slice(colon + 1);
    if (!byType[t]) byType[t] = {};
    byType[t][id] = entry[1];
  });
  return ENTITY_TYPE_ORDER.filter(function(t) { return byType[t]; }).map(function(t) {
    var items = Object.entries(byType[t])
      .sort(function(a, b) { return b[1] - a[1]; })
      .slice(0, 15)
      .map(function(e) {
        var info = resolveEntityInfo(t, e[0], photoData, shootsData);
        return { type: t, id: e[0], count: e[1], label: info.label, url: info.url };
      });
    return { type: t, typeLabel: ENTITY_TYPE_LABELS[t] || t.toUpperCase(), items: items };
  });
}

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
    var botTotal = 0;
    snap.docs.forEach(function(doc) {
      var d = doc.data();
      if (d.bot) { botTotal++; return; }
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
    var entityGroups = buildEntityGroups(byEntity, getData(), shoots.getData());
    res.render('photo/admin/stats', { title: 'Статистика — Admin', days: days, total: snap.size - botTotal, botTotal: botTotal, allDays: allDays, maxCount: maxCount, entityGroups: entityGroups, byDevice: byDevice, error: null });
  } catch (err) {
    res.render('photo/admin/stats', { title: 'Статистика — Admin', days: days, total: 0, botTotal: 0, allDays: [], maxCount: 1, entityGroups: [], byDevice: {}, error: err.message });
  }
});

router.get('/stats/entity', requireAuth, async (req, res) => {
  var entityType = req.query.type || '';
  var entityId = req.query.id || '';
  var days = Math.min(parseInt(req.query.days) || 30, 90);
  var env = process.env.PHOTO_ENV || 'dev';
  var since = new Date();
  since.setDate(since.getDate() - days);
  try {
    var snap = await fb.collection('photo_views')
      .where('env', '==', env)
      .where('entityType', '==', entityType)
      .where('entityId', '==', entityId)
      .where('timestamp', '>=', since)
      .orderBy('timestamp', 'desc')
      .limit(5000)
      .get();
    var byDay = {}, byDevice = { desktop: 0, mobile: 0, tablet: 0, unknown: 0 };
    var botTotal = 0;
    snap.docs.forEach(function(doc) {
      var d = doc.data();
      if (d.bot) { botTotal++; return; }
      var ts = d.timestamp ? d.timestamp.toDate() : null;
      if (!ts) return;
      var day = ts.toISOString().slice(0, 10);
      byDay[day] = (byDay[day] || 0) + 1;
      if (d.deviceType && byDevice[d.deviceType] !== undefined) byDevice[d.deviceType]++;
    });
    var allDays = [];
    for (var i = days - 1; i >= 0; i--) {
      var dt = new Date(); dt.setDate(dt.getDate() - i);
      var dayStr = dt.toISOString().slice(0, 10);
      allDays.push({ day: dayStr, count: byDay[dayStr] || 0 });
    }
    var maxCount = Math.max.apply(null, allDays.map(function(d) { return d.count; }).concat([1]));
    var entityInfo = resolveEntityInfo(entityType, entityId, getData(), shoots.getData());
    res.render('photo/admin/stats-entity', {
      title: 'Статистика · ' + entityInfo.label,
      entityType, entityId, entityInfo, days,
      total: snap.size - botTotal, botTotal, allDays, maxCount, byDevice, error: null,
    });
  } catch (err) {
    var entityInfo = { type: entityType, id: entityId, label: entityId, url: null };
    res.render('photo/admin/stats-entity', {
      title: 'Статистика', entityType, entityId, entityInfo, days,
      total: 0, botTotal: 0, allDays: [], maxCount: 1, byDevice: {}, error: err.message,
    });
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
  var { label, label_en } = req.body;
  if (!label || !label.trim()) return res.redirect(`/admin/country/${key}/edit`);
  var data = getData();
  if (!data[key]) return res.redirect('/admin');
  data[key].label = label.trim();
  if (label_en && label_en.trim()) { data[key].label_en = label_en.trim(); } else { delete data[key].label_en; }
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

router.get('/:country/:series/upload', requireAuth, function(req, res, next) { if (req.params.country === 'shoots') return next('route'); next(); }, async (req, res) => {
  var { country, series } = req.params;
  if (!/^[a-z0-9-]+$/.test(country) || !/^[a-z0-9-]+$/.test(series)) return res.redirect('/admin');
  var data = getData();
  if (!data[country] || !data[country].series[series]) return res.redirect('/admin');
  var sort = req.query.sort === 'views' ? 'views' : 'manual';
  var stats = await photoStats.getStatsByType('photo').catch(function() { return {}; });
  var photos = data[country].series[series].photos.map(function(photo, index) {
    var entityId = country + '/' + series + '/' + photo.id;
    return Object.assign({}, photo, {
      views: stats[entityId] || 0,
      _adminIndex: index,
    });
  });
  if (sort === 'views') {
    photos.sort(function(a, b) {
      return (b.views || 0) - (a.views || 0) || a._adminIndex - b._adminIndex;
    });
  }
  res.render('photo/admin/upload', {
    title: 'Загрузка — photo.dimazvali.com Admin',
    country,
    series,
    seriesLabel: data[country].series[series].label,
    countryLabel: data[country].label,
    photos,
    sort,
    tags: getTags(),
    defaultPhotoType: data[country].defaultPhotoType || 'copter',
  });
});

router.post('/:country/:series/upload', requireAuth, function(req, res, next) { if (req.params.country === 'shoots') return next('route'); next(); }, upload.single('photo'), async (req, res) => {
  var { country, series } = req.params;
  if (!/^[a-z0-9-]+$/.test(country) || !/^[a-z0-9-]+$/.test(series)) return res.redirect('/admin');
  var { title, date, desc } = req.body;
  var photoType = ['copter', 'camera', 'mobile'].includes(req.body.type) ? req.body.type : 'copter';
  var isPanorama = !!req.body.panorama;
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
  try {
    var exifData = await exifr.parse(req.file.buffer, { gps: true, pick: ['DateTimeOriginal', 'CreateDate'] });
    if (exifData) {
      if (!coords && exifData.latitude != null) coords = { lat: exifData.latitude, lng: exifData.longitude };
      if (altitude === null && exifData.GPSAltitude != null) altitude = Math.round(exifData.GPSAltitude);
      var exifDate = exifData.DateTimeOriginal || exifData.CreateDate;
      if (exifDate instanceof Date && !isNaN(exifDate)) shotAt = exifDate.toISOString();
    }
  } catch (e) {}

  try {
    var baseName = path.basename(req.file.originalname, path.extname(req.file.originalname));
    var existingIds = data[country].series[series].photos.map(p => p.id);
    var id = uniqueId(slugify((title && title.trim()) || baseName), existingIds);

    var [buf400, buf800, buf2400, colorFamily, imgMeta] = await Promise.all([
      sharp(req.file.buffer).resize({ width: 400, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(),
      sharp(req.file.buffer).resize({ width: 800, withoutEnlargement: true }).webp({ quality: 85 }).toBuffer(),
      sharp(req.file.buffer).resize({ width: 2400, withoutEnlargement: true }).webp({ quality: 90 }).toBuffer(),
      extractColorFamily(req.file.buffer),
      sharp(req.file.buffer).metadata(),
    ]);

    var path400 = `${country}/${series}/${id}-400.webp`;
    var path800 = `${country}/${series}/${id}-800.webp`;
    var path2400 = `${country}/${series}/${id}-2400.webp`;
    var pathPano = `${country}/${series}/${id}-orig.webp`;

    await Promise.all([
      bucket.file(path400).save(buf400, { contentType: 'image/webp' }).then(() => bucket.file(path400).makePublic()),
      bucket.file(path800).save(buf800, { contentType: 'image/webp' }).then(() => bucket.file(path800).makePublic()),
      bucket.file(path2400).save(buf2400, { contentType: 'image/webp' }).then(() => bucket.file(path2400).makePublic()),
      isPanorama ? savePanoAsset(req.file.buffer, pathPano) : Promise.resolve(),
    ]);

    var base = `https://storage.googleapis.com/${process.env.PHOTO_BUCKET}`;
    var photoEntry = {
      id,
      title: title || baseName,
      date: date || '',
      desc: desc || '',
      type: photoType,
      createdAt: new Date().toISOString().slice(0, 10),
      width: imgMeta.width,
      height: imgMeta.height,
      urls: {
        thumb: `${base}/${path400}`,
        preview: `${base}/${path800}`,
        full: `${base}/${path2400}`,
      },
    };
    if (isPanorama) {
      photoEntry.panorama = true;
      photoEntry.urls.pano = `${base}/${pathPano}`;
    }
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
    googleIndexingSubmit('https://photo.dimazvali.com/' + country + '/' + series + '/' + id);

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
  var shootEntries = Object.entries(shoots.getData()).reverse();
  res.render('photo/admin/shoots', {
    title: 'Съёмки — AERO Admin',
    shootEntries,
    stats,
    error: req.query.error || null,
  });
});

router.post('/shoots', requireAuth, express.urlencoded({ extended: false }), async (req, res) => {
  var { slug, label, password, public: isPublic } = req.body;
  if (!slug || !label) return res.redirect('/admin/shoots');
  var cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '');
  if (!cleanSlug) return res.redirect('/admin/shoots');
  if (shoots.getShoot(cleanSlug)) return res.redirect('/admin/shoots?error=' + encodeURIComponent('Съёмка с таким ключом уже существует'));
  try {
    await shoots.createShoot(cleanSlug, label.trim(), '', (password || '').trim(), !!isPublic);
    res.redirect('/admin/shoots/' + cleanSlug + '/edit');
  } catch (e) {
    console.error('[shoots] create error:', e);
    res.redirect('/admin/shoots?error=' + encodeURIComponent(e.message));
  }
});

router.get('/shoots/:slug/edit', requireAuth, async (req, res) => {
  var { slug } = req.params;
  if (!/^[a-z0-9-]+$/.test(slug)) return res.redirect('/admin/shoots');
  var shoot = shoots.getShoot(slug);
  if (!shoot) return res.redirect('/admin/shoots');
  var stats = await photoStats.getStatsByType('shoot-photo').catch(function() { return {}; });
  var photoViews = {};
  (shoot.photos || []).forEach(function(photo) {
    photoViews[photo.id] = stats[slug + '/' + photo.id] || 0;
  });
  res.render('photo/admin/shoot-edit', {
    title: shoot.label + ' — AERO Admin',
    slug,
    shoot,
    photoViews,
    data: getData(),
    allShoots: shoots.getData(),
    error: req.query.error || null,
  });
});

// Copyright / usage check scoped to a single shoot
router.post('/shoots/:slug/copyright/run', requireAuth, (req, res) => {
  var { slug } = req.params;
  if (!/^[a-z0-9-]+$/.test(slug)) return res.status(400).json({ started: false });
  if (!shoots.getShoot(slug)) return res.status(404).json({ started: false });
  var started = copyrightCheck.run(fb, getData(), process.env.PHOTO_ENV || 'dev', shoots.getData(), { shootSlug: slug });
  res.json({ started });
});

router.post('/shoots/:slug/edit', requireAuth, express.urlencoded({ extended: false }), async (req, res) => {
  var { slug } = req.params;
  if (!/^[a-z0-9-]+$/.test(slug)) return res.redirect('/admin/shoots');
  if (!shoots.getShoot(slug)) return res.redirect('/admin/shoots');
  var { label, desc, label_en, desc_en, password, public: isPublic, showFaces, showCuratorSelection, relatedShoots } = req.body;
  if (!label || !label.trim()) return res.redirect('/admin/shoots/' + slug + '/edit');
  var knownSlugs = Object.keys(shoots.getData());
  var relatedList = Array.isArray(relatedShoots) ? relatedShoots : (relatedShoots ? [relatedShoots] : []);
  relatedList = relatedList.filter(function(s) { return s && s !== slug && knownSlugs.indexOf(s) !== -1; });
  try {
    await shoots.saveShoot(slug, {
      label: label.trim(),
      label_en: (label_en || '').trim(),
      desc: (desc || '').trim(),
      desc_en: (desc_en || '').trim(),
      password: (password || '').trim(),
      public: !!isPublic,
      showFaces: !!showFaces,
      showCuratorSelection: !!showCuratorSelection,
    });
    await shoots.setRelatedShoots(slug, relatedList);
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
  var isPanorama = !!req.body.panorama;
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

    var [buf400, buf800, buf2400, bufInstagram, colorFamily, imgMeta] = await Promise.all([
      sharp(req.file.buffer).resize({ width: 400, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(),
      sharp(req.file.buffer).resize({ width: 800, withoutEnlargement: true }).webp({ quality: 85 }).toBuffer(),
      sharp(req.file.buffer).resize({ width: 2400, withoutEnlargement: true }).webp({ quality: 90 }).toBuffer(),
      sharp(req.file.buffer).resize({ width: 2400, withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer(),
      extractColorFamily(req.file.buffer),
      sharp(req.file.buffer).metadata(),
    ]);

    var p400  = 'shoots/' + slug + '/' + id + '-400.webp';
    var p800  = 'shoots/' + slug + '/' + id + '-800.webp';
    var p2400 = 'shoots/' + slug + '/' + id + '-2400.webp';
    var pInstagram = 'shoots/' + slug + '/' + id + '-instagram.jpg';
    var pPano = 'shoots/' + slug + '/' + id + '-orig.webp';

    await Promise.all([
      bucket.file(p400).save(buf400,   { contentType: 'image/webp' }).then(function() { return bucket.file(p400).makePublic(); }),
      bucket.file(p800).save(buf800,   { contentType: 'image/webp' }).then(function() { return bucket.file(p800).makePublic(); }),
      bucket.file(p2400).save(buf2400, { contentType: 'image/webp' }).then(function() { return bucket.file(p2400).makePublic(); }),
      bucket.file(pInstagram).save(bufInstagram, { contentType: 'image/jpeg' }).then(function() { return bucket.file(pInstagram).makePublic(); }),
      isPanorama ? savePanoAsset(req.file.buffer, pPano) : Promise.resolve(),
    ]);

    var base = 'https://storage.googleapis.com/' + process.env.PHOTO_BUCKET;
    var photoEntry = {
      id,
      title: (title && title.trim()) || baseName,
      date: date || '',
      desc: desc || '',
      type: shootType,
      createdAt: new Date().toISOString().slice(0, 10),
      width: imgMeta.width,
      height: imgMeta.height,
      urls: {
        thumb:     base + '/' + p400,
        preview:   base + '/' + p800,
        full:      base + '/' + p2400,
        instagram: base + '/' + pInstagram,
      },
    };
    if (isPanorama) {
      photoEntry.panorama = true;
      photoEntry.urls.pano = base + '/' + pPano;
    }
    if (colorFamily) photoEntry.colorFamily = colorFamily;
    if (shootCoords) photoEntry.coords = shootCoords;
    if (shootShotAt) photoEntry.shotAt = shootShotAt;

    await shoots.addPhoto(slug, photoEntry);
    pingSitemaps();
    indexNowSubmit('https://photo.dimazvali.com/shoot/' + slug);
    googleIndexingSubmit('https://photo.dimazvali.com/shoot/' + slug);

    // Index faces, then auto-generate SEO desc+keywords (fire-and-forget, faces first so names are known)
    (async function() {
      try {
        var faces = await photoPeople.indexAndMatchFaces(buf800);
        await shoots.updatePhotoFaces(slug, photoEntry.id, faces);
        var knownPeople = photoPeople.resolvePhotoPeopleNames({ faces: faces });

        var { generatePhotoSeo } = require('../lib/photo-seo');
        var previousCaptions = shoot.photos
          .filter(function(p) { return p.seo_desc; })
          .slice(-6)
          .map(function(p) { return p.seo_desc; });
        var result = await generatePhotoSeo(photoEntry, {
          countryLabel: shoot.label,
          seriesLabel: shoot.label,
          allTags: {},
          shootDesc: shoot.desc,
          previousCaptions: previousCaptions,
          knownPeople: knownPeople,
        });
        await shoots.updatePhotoSeo(slug, photoEntry.id, result.desc, result.keywords, result.descEn, result.keywordsEn);
      } catch (e) {
        console.error('[auto-faces+seo]', e.message);
      }
    }());

    res.redirect('/admin/shoots/' + slug + '/edit');
  } catch (err) {
    console.error('[shoots] upload error:', err);
    res.status(500).send('Ошибка при загрузке: ' + err.message);
  }
});

router.get('/shoots/:slug/photos/:id/edit', requireAuth, async (req, res) => {
  var { slug, id } = req.params;
  if (!/^[a-z0-9-]+$/.test(slug) || !/^[a-z0-9-]+$/.test(id)) return res.redirect('/admin/shoots');
  var shoot = shoots.getShoot(slug);
  if (!shoot) return res.redirect('/admin/shoots');
  var photo = shoot.photos.find(function(p) { return p.id === id; });
  if (!photo) return res.redirect('/admin/shoots/' + slug + '/edit');
  var viewStats = await photoStats.getStatsByType('shoot-photo').catch(function() { return {}; });
  res.render('photo/admin/shoot-photo-edit', {
    title: photo.title + ' — AERO Admin',
    slug,
    shootLabel: shoot.label,
    photo,
    photoViews: viewStats[slug + '/' + id] || 0,
    colorFamilies: COLOR_FAMILIES,
  });
});

router.post('/shoots/:slug/photos/:id/edit', requireAuth, express.urlencoded({ extended: false }), async (req, res) => {
  var { slug, id } = req.params;
  if (!/^[a-z0-9-]+$/.test(slug) || !/^[a-z0-9-]+$/.test(id)) return res.redirect('/admin/shoots');
  if (!shoots.getShoot(slug)) return res.redirect('/admin/shoots');
  var { title, date, desc, title_en, desc_en } = req.body;
  var photoType = req.body.type;
  var seoDesc = (req.body.seo_desc || '').trim();
  var seoKeywords = (req.body.seo_keywords || '').trim();
  var seoDescEn = (req.body.seo_desc_en || '').trim();
  var seoKeywordsEn = (req.body.seo_keywords_en || '').trim();
  if (!title || !title.trim()) return res.redirect('/admin/shoots/' + slug + '/photos/' + id + '/edit');
  var latRaw = parseFloat(req.body.lat);
  var lngRaw = parseFloat(req.body.lng);
  var coords = (!isNaN(latRaw) && !isNaN(lngRaw) && Math.abs(latRaw) <= 90 && Math.abs(lngRaw) <= 180)
    ? { lat: latRaw, lng: lngRaw }
    : null;
  var colorFamily = COLOR_FAMILIES[req.body.colorFamily] ? req.body.colorFamily : null;
  var titleTrim = title.trim();
  var descTrim = (desc || '').trim();
  var titleEnTrim = (title_en || '').trim();
  var descEnTrim = (desc_en || '').trim();
  try {
    if (!titleEnTrim || (descTrim && !descEnTrim)) {
      try {
        var { translateTitleDesc } = require('../lib/photo-seo');
        var translated = await translateTitleDesc({
          title: !titleEnTrim ? titleTrim : null,
          desc: (descTrim && !descEnTrim) ? descTrim : null,
        });
        if (translated.title) titleEnTrim = translated.title;
        if (translated.desc) descEnTrim = translated.desc;
      } catch (e) {
        console.error('[shoots] auto-translate error:', e.message);
      }
    }
    await shoots.updatePhoto(slug, id, {
      title: titleTrim,
      title_en: titleEnTrim,
      date: (date || '').trim(),
      desc: descTrim,
      desc_en: descEnTrim,
      type: photoType,
      panorama: !!req.body.panorama,
      curatorPick: !!req.body.curatorPick,
      coords: coords,
      colorFamily: colorFamily,
    });
    await shoots.updatePhotoSeo(slug, id, seoDesc, seoKeywords, seoDescEn, seoKeywordsEn);
  } catch (e) {
    console.error('[shoots] update photo error:', e);
  }
  res.redirect('/admin/shoots/' + slug + '/edit');
});

// POST /admin/shoots/:slug/photos/:id/replace-file — swap the source image, keep id/title/desc/SEO/annotations
router.post('/shoots/:slug/photos/:id/replace-file', requireAuth, upload.single('photo'), async (req, res) => {
  var { slug, id } = req.params;
  if (!/^[a-z0-9-]+$/.test(slug) || !/^[a-z0-9-]+$/.test(id)) return res.redirect('/admin/shoots');
  var shoot = shoots.getShoot(slug);
  if (!shoot) return res.redirect('/admin/shoots');
  var photo = shoot.photos.find(function(p) { return p.id === id; });
  if (!photo) return res.redirect('/admin/shoots/' + slug + '/edit');
  if (!req.file) return res.redirect('/admin/shoots/' + slug + '/photos/' + id + '/edit');

  try {
    var [buf400, buf800, buf2400, bufInstagram, colorFamily, imgMeta] = await Promise.all([
      sharp(req.file.buffer).resize({ width: 400, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(),
      sharp(req.file.buffer).resize({ width: 800, withoutEnlargement: true }).webp({ quality: 85 }).toBuffer(),
      sharp(req.file.buffer).resize({ width: 2400, withoutEnlargement: true }).webp({ quality: 90 }).toBuffer(),
      sharp(req.file.buffer).resize({ width: 2400, withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer(),
      extractColorFamily(req.file.buffer),
      sharp(req.file.buffer).metadata(),
    ]);

    var p400  = 'shoots/' + slug + '/' + id + '-400.webp';
    var p800  = 'shoots/' + slug + '/' + id + '-800.webp';
    var p2400 = 'shoots/' + slug + '/' + id + '-2400.webp';
    var pInstagram = 'shoots/' + slug + '/' + id + '-instagram.jpg';
    var pPano = 'shoots/' + slug + '/' + id + '-orig.webp';

    await Promise.all([
      bucket.file(p400).save(buf400,   { contentType: 'image/webp' }).then(function() { return bucket.file(p400).makePublic(); }),
      bucket.file(p800).save(buf800,   { contentType: 'image/webp' }).then(function() { return bucket.file(p800).makePublic(); }),
      bucket.file(p2400).save(buf2400, { contentType: 'image/webp' }).then(function() { return bucket.file(p2400).makePublic(); }),
      bucket.file(pInstagram).save(bufInstagram, { contentType: 'image/jpeg' }).then(function() { return bucket.file(pInstagram).makePublic(); }),
      photo.panorama ? savePanoAsset(req.file.buffer, pPano) : Promise.resolve(),
    ]);

    var base = 'https://storage.googleapis.com/' + process.env.PHOTO_BUCKET;
    var fields = {
      width: imgMeta.width,
      height: imgMeta.height,
      urls: Object.assign({}, photo.urls, {
        thumb: base + '/' + p400,
        preview: base + '/' + p800,
        full: base + '/' + p2400,
        instagram: base + '/' + pInstagram,
      }),
    };
    if (photo.panorama) fields.urls.pano = base + '/' + pPano;
    if (colorFamily) fields.colorFamily = colorFamily;

    await shoots.updatePhotoAssets(slug, id, fields);

    // Faces were detected against the old image content — re-run so bounding boxes match.
    try {
      var faces = await photoPeople.indexAndMatchFaces(buf800);
      await shoots.updatePhotoFaces(slug, id, faces);
    } catch (e) {
      console.error('[shoots replace-file] face reindex:', e.message);
    }
  } catch (err) {
    console.error('[shoots] replace-file error:', err);
    return res.status(500).send('Ошибка при замене файла: ' + err.message);
  }
  res.redirect('/admin/shoots/' + slug + '/photos/' + id + '/edit');
});

// POST /admin/shoots/:slug/photos/:id/generate-seo — AI SEO generation for a shoot photo
router.post('/shoots/:slug/photos/:id/generate-seo', requireAuth, express.json(), async (req, res) => {
  var { slug, id } = req.params;
  if (!/^[a-z0-9-]+$/.test(slug) || !/^[a-z0-9-]+$/.test(id)) return res.status(400).json({ error: 'Invalid params' });
  var shoot = shoots.getShoot(slug);
  if (!shoot) return res.status(404).json({ error: 'Not found' });
  var photo = shoot.photos.find(function(p) { return p.id === id; });
  if (!photo) return res.status(404).json({ error: 'Not found' });

  try {
    var { generatePhotoSeo } = require('../lib/photo-seo');
    var idx = shoot.photos.findIndex(function(p) { return p.id === id; });
    var previousCaptions = shoot.photos
      .slice(0, idx)
      .filter(function(p) { return p.seo_desc; })
      .slice(-6)
      .map(function(p) { return p.seo_desc; });
    var result = await generatePhotoSeo(photo, {
      countryLabel: shoot.label,
      seriesLabel: shoot.label,
      allTags: {},
      shootDesc: shoot.desc,
      previousCaptions: previousCaptions,
      knownPeople: photoPeople.resolvePhotoPeopleNames(photo),
    });
    await shoots.updatePhotoSeo(slug, id, result.desc, result.keywords, result.descEn, result.keywordsEn);
    res.json({ ok: true, desc: result.desc, keywords: result.keywords, descEn: result.descEn, keywordsEn: result.keywordsEn });
  } catch (err) {
    console.error('[shoots generate-seo]', err.message);
    res.status(500).json({ error: err.message });
  }
});

var PENDING_PAGE_SIZE = 300;

router.get('/people', requireAuth, function(req, res) {
  var shootsData = shoots.getData();
  var pending = [];
  var facesByFaceId = {};
  Object.keys(shootsData).forEach(function(slug) {
    shootsData[slug].photos.forEach(function(photo) {
      (photo.faces || []).forEach(function(face) {
        var entry = { slug: slug, photoId: photo.id, thumb: photo.urls && photo.urls.preview, boundingBox: face.boundingBox, faceId: face.faceId };
        facesByFaceId[face.faceId] = entry;
        if (!face.personId) pending.push(entry);
      });
    });
  });
  var people = Object.values(photoPeople.getPeopleData()).map(function(p) {
    return Object.assign({}, p, {
      faces: p.faceIds.map(function(fid) { return facesByFaceId[fid]; }).filter(Boolean),
    });
  });
  var pageCount = Math.max(1, Math.ceil(pending.length / PENDING_PAGE_SIZE));
  var page = Math.min(pageCount, Math.max(1, parseInt(req.query.page, 10) || 1));
  var pendingPage = pending.slice((page - 1) * PENDING_PAGE_SIZE, page * PENDING_PAGE_SIZE);
  res.render('photo/admin/people', {
    title: 'Люди — AERO Admin',
    pending: pendingPage,
    pendingTotal: pending.length,
    page: page,
    pageCount: pageCount,
    people: people,
  });
});

router.post('/people/new', requireAuth, express.urlencoded({ extended: false }), async (req, res) => {
  var { slug, photoId, faceId, name } = req.body;
  if (!slug || !photoId || !faceId || !name || !name.trim()) return res.redirect('/admin/people');
  var shoot = shoots.getShoot(slug);
  var photo = shoot && shoot.photos.find(function(p) { return p.id === photoId; });
  if (!photo) return res.redirect('/admin/people');
  try {
    var person = await photoPeople.createPerson(name.trim(), faceId);
    var faces = (photo.faces || []).map(function(f) { return f.faceId === faceId ? Object.assign({}, f, { personId: person.id }) : f; });
    await shoots.updatePhotoFaces(slug, photoId, faces);
  } catch (e) {
    console.error('[people/new]', e);
  }
  res.redirect('/admin/people');
});

router.post('/people/link', requireAuth, express.urlencoded({ extended: false }), async (req, res) => {
  var { personId, slug, photoId, faceId } = req.body;
  if (!personId || !slug || !photoId || !faceId) return res.redirect('/admin/people');
  var shoot = shoots.getShoot(slug);
  var photo = shoot && shoot.photos.find(function(p) { return p.id === photoId; });
  if (!photo) return res.redirect('/admin/people');
  try {
    await photoPeople.linkFaceToPerson(personId, faceId);
    var faces = (photo.faces || []).map(function(f) { return f.faceId === faceId ? Object.assign({}, f, { personId: personId }) : f; });
    await shoots.updatePhotoFaces(slug, photoId, faces);
  } catch (e) {
    console.error('[people/link]', e);
  }
  res.redirect('/admin/people');
});

router.post('/people/:personId/rename', requireAuth, express.urlencoded({ extended: false }), async (req, res) => {
  var { personId } = req.params;
  var name = (req.body.name || '').trim();
  if (!name) return res.redirect('/admin/people');
  try {
    await photoPeople.renamePerson(personId, name);
  } catch (e) {
    console.error('[people/rename]', e);
  }
  res.redirect('/admin/people');
});

router.post('/shoots/:slug/photos/:id/faces/:faceId/unlink', requireAuth, async (req, res) => {
  var { slug, id, faceId } = req.params;
  var shoot = shoots.getShoot(slug);
  var photo = shoot && shoot.photos.find(function(p) { return p.id === id; });
  if (!photo) return res.redirect('/admin/people');
  try {
    var faces = (photo.faces || []).map(function(f) { return f.faceId === faceId ? Object.assign({}, f, { personId: null }) : f; });
    await shoots.updatePhotoFaces(slug, id, faces);
  } catch (e) {
    console.error('[shoots faces unlink]', e);
  }
  res.redirect('/admin/people');
});

router.post('/shoots/:slug/photos/:id/publish', requireAuth, express.urlencoded({ extended: false }), async (req, res) => {
  var { slug, id } = req.params;
  if (!/^[a-z0-9-]+$/.test(slug) || !/^[a-z0-9-]+$/.test(id)) return res.redirect('/admin/shoots');
  var shoot = shoots.getShoot(slug);
  if (!shoot) return res.redirect('/admin/shoots');
  var photo = shoot.photos.find(function(p) { return p.id === id; });
  if (!photo) return res.redirect('/admin/shoots/' + slug + '/edit');

  var target = String(req.body.target || '').split('/');
  var country = target[0], series = target[1];
  var data = getData();
  if (!country || !series || !data[country] || !data[country].series[series]) {
    return res.redirect('/admin/shoots/' + slug + '/edit?error=' + encodeURIComponent('Выберите раздел для публикации'));
  }

  var existingIds = data[country].series[series].photos.map(function(p) { return p.id; });
  var newId = uniqueId(slugify(photo.title) || photo.id, existingIds);

  var photoEntry = {
    id: newId,
    title: photo.title || '',
    date: photo.date || '',
    desc: photo.desc || '',
    type: photo.type || 'camera',
    createdAt: photo.createdAt || new Date().toISOString().slice(0, 10),
    width: photo.width,
    height: photo.height,
    urls: photo.urls,
    sourceShoot: slug,
  };
  if (photo.coords) photoEntry.coords = photo.coords;
  if (photo.altitude != null) photoEntry.altitude = photo.altitude;
  if (photo.shotAt) photoEntry.shotAt = photo.shotAt;
  if (photo.colorFamily) photoEntry.colorFamily = photo.colorFamily;

  data[country].series[series].photos.push(photoEntry);
  saveData(data);
  pingSitemaps();
  indexNowSubmit('https://photo.dimazvali.com/' + country + '/' + series + '/' + newId);
  googleIndexingSubmit('https://photo.dimazvali.com/' + country + '/' + series + '/' + newId);

  res.redirect('/admin/shoots/' + slug + '/edit');
});

router.post('/shoots/:slug/photos/:id/annotation/add', requireAuth, express.json(), async (req, res) => {
  var { slug, id } = req.params;
  if (!/^[a-z0-9-]+$/.test(slug) || !/^[a-z0-9-]+$/.test(id)) return res.status(400).json({ ok: false });
  var { x, y, text, text_en } = req.body;
  if (typeof x !== 'number' || typeof y !== 'number' || !text || !text.trim()) return res.status(400).json({ ok: false, error: 'invalid params' });
  if (x < 0 || x > 100 || y < 0 || y > 100) return res.status(400).json({ ok: false });
  if (!shoots.getShoot(slug)) return res.status(404).json({ ok: false });
  var annot = { id: Date.now().toString(), x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, text: text.trim(), createdAt: new Date().toISOString().slice(0, 10) };
  if (text_en && text_en.trim()) annot.text_en = text_en.trim();
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

router.post('/shoots/:slug/toggle-curator-selection', requireAuth, async (req, res) => {
  var { slug } = req.params;
  if (!/^[a-z0-9-]+$/.test(slug)) return res.redirect('/admin/shoots');
  var shoot = shoots.getShoot(slug);
  if (!shoot) return res.redirect('/admin/shoots');
  try {
    await shoots.saveShoot(slug, { showCuratorSelection: !shoot.showCuratorSelection });
  } catch (e) {
    console.error('[shoots] toggle-curator-selection error:', e);
  }
  res.redirect('/admin/shoots/' + slug + '/edit');
});

router.post('/shoots/:slug/photos/bulk-delete', requireAuth, express.json(), async (req, res) => {
  var { slug } = req.params;
  if (!/^[a-z0-9-]+$/.test(slug)) return res.status(400).json({ ok: false });
  var shoot = shoots.getShoot(slug);
  if (!shoot) return res.status(404).json({ ok: false });
  var validIds = new Set(shoot.photos.map(function(p) { return p.id; }));
  var ids = Array.isArray(req.body.ids) ? req.body.ids.filter(function(id) { return validIds.has(id); }) : [];
  if (!ids.length) return res.status(400).json({ ok: false });
  try {
    await Promise.all(ids.map(async function(id) {
      await Promise.all([
        bucket.file('shoots/' + slug + '/' + id + '-400.webp').delete().catch(function() {}),
        bucket.file('shoots/' + slug + '/' + id + '-800.webp').delete().catch(function() {}),
        bucket.file('shoots/' + slug + '/' + id + '-2400.webp').delete().catch(function() {}),
        bucket.file('shoots/' + slug + '/' + id + '-orig.webp').delete().catch(function() {}),
      ]);
      await shoots.removePhoto(slug, id);
    }));
    res.json({ ok: true });
  } catch (e) {
    console.error('[shoots] bulk-delete error:', e);
    res.status(500).json({ ok: false });
  }
});

router.post('/shoots/:slug/photos/bulk-curator-pick', requireAuth, express.json(), async (req, res) => {
  var { slug } = req.params;
  if (!/^[a-z0-9-]+$/.test(slug)) return res.status(400).json({ ok: false });
  var shoot = shoots.getShoot(slug);
  if (!shoot) return res.status(404).json({ ok: false });
  var validIds = new Set(shoot.photos.map(function(p) { return p.id; }));
  var ids = Array.isArray(req.body.ids) ? req.body.ids.filter(function(id) { return validIds.has(id); }) : [];
  if (!ids.length) return res.status(400).json({ ok: false });
  var value = !!req.body.value;
  try {
    await Promise.all(ids.map(function(id) { return shoots.updatePhotoCuratorPick(slug, id, value); }));
    res.json({ ok: true });
  } catch (e) {
    console.error('[shoots] bulk-curator-pick error:', e);
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

var TAG_TYPES = ['person', 'location', 'misc'];

router.post('/tags', requireAuth, (req, res) => {
  var { slug, label, desc, label_en, desc_en } = req.body;
  var type = TAG_TYPES.includes(req.body.type) ? req.body.type : 'misc';
  if (!slug || !label) return res.redirect('/admin/tags');
  var clean = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '');
  if (!clean) return res.redirect('/admin/tags');
  var tags = getTags();
  if (!tags[clean]) {
    tags[clean] = { label, label_en: (label_en || '').trim(), type, desc: (desc || '').trim(), desc_en: (desc_en || '').trim(), createdAt: new Date().toISOString().slice(0, 10) };
    saveTags(tags);
  }
  res.redirect('/admin/tags');
});

router.post('/tags/:slug/edit', requireAuth, (req, res) => {
  var { slug } = req.params;
  var tags = getTags();
  if (!tags[slug]) return res.redirect('/admin/tags');
  var { label, desc, label_en, desc_en } = req.body;
  var type = TAG_TYPES.includes(req.body.type) ? req.body.type : 'misc';
  if (!label || !label.trim()) return res.redirect('/admin/tags');
  tags[slug] = Object.assign({}, tags[slug], {
    label: label.trim(),
    label_en: (label_en || '').trim(),
    type,
    desc: (desc || '').trim(),
    desc_en: (desc_en || '').trim(),
  });
  saveTags(tags);
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
  var { label, label_en } = req.body;
  if (!label || !label.trim()) return res.redirect(`/admin/${country}/${seriesKey}/edit`);
  var data = getData();
  if (!data[country] || !data[country].series[seriesKey]) return res.redirect('/admin');
  data[country].series[seriesKey].label = label.trim();
  if (label_en && label_en.trim()) { data[country].series[seriesKey].label_en = label_en.trim(); } else { delete data[country].series[seriesKey].label_en; }
  var mapLatRaw = parseFloat(req.body.mapLat);
  var mapLngRaw = parseFloat(req.body.mapLng);
  if (!isNaN(mapLatRaw) && !isNaN(mapLngRaw) && Math.abs(mapLatRaw) <= 90 && Math.abs(mapLngRaw) <= 180) {
    data[country].series[seriesKey].mapCenter = { lat: mapLatRaw, lng: mapLngRaw };
  } else {
    delete data[country].series[seriesKey].mapCenter;
  }
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

router.get('/:country/:series/:id/edit', requireAuth, async (req, res) => {
  var { country, series: seriesKey, id } = req.params;
  if (!/^[a-z0-9-]+$/.test(country) || !/^[a-z0-9-]+$/.test(seriesKey) || !/^[a-z0-9-]+$/.test(id)) {
    return res.redirect('/admin');
  }
  var data = getData();
  if (!data[country] || !data[country].series[seriesKey]) return res.redirect('/admin');
  var photo = data[country].series[seriesKey].photos.find(function(p) { return p.id === id; });
  if (!photo) return res.redirect('/admin');
  var viewStats = await photoStats.getStatsByType('photo').catch(function() { return {}; });
  res.render('photo/admin/photo-edit', {
    title: `${photo.title} — AERO Admin`,
    countryKey: country,
    seriesKey,
    photo,
    photoViews: viewStats[country + '/' + seriesKey + '/' + id] || 0,
    seriesMapCenter: data[country].series[seriesKey].mapCenter || null,
    tags: getTags(),
    colorFamilies: COLOR_FAMILIES,
  });
});

router.post('/:country/:series/:id/edit', requireAuth, upload.single('photo'), async (req, res) => {
  var { country, series: seriesKey, id } = req.params;
  if (!/^[a-z0-9-]+$/.test(country) || !/^[a-z0-9-]+$/.test(seriesKey) || !/^[a-z0-9-]+$/.test(id)) {
    return res.redirect('/admin');
  }
  var { title, date, desc, title_en, desc_en } = req.body;
  var seoDesc = (req.body.seo_desc || '').trim();
  var seoKeywords = (req.body.seo_keywords || '').trim();
  var seoDescEn = (req.body.seo_desc_en || '').trim();
  var seoKeywordsEn = (req.body.seo_keywords_en || '').trim();
  var photoType = ['copter', 'camera', 'mobile'].includes(req.body.type) ? req.body.type : 'copter';
  var isPanorama = !!req.body.panorama;
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
  if (title_en && title_en.trim()) { photo.title_en = title_en.trim(); } else { delete photo.title_en; }
  if (desc_en && desc_en.trim()) { photo.desc_en = desc_en.trim(); } else { delete photo.desc_en; }
  if (instagramUrl) { photo.instagram = instagramUrl; } else { delete photo.instagram; }
  var needsTranslation = !photo.title_en || (photo.desc && !photo.desc_en);
  if (!isNaN(latRaw) && !isNaN(lngRaw) && Math.abs(latRaw) <= 90 && Math.abs(lngRaw) <= 180) {
    photo.coords = { lat: latRaw, lng: lngRaw };
  } else {
    delete photo.coords;
  }
  if (!isNaN(altEditRaw) && altEditRaw >= 0) { photo.altitude = Math.round(altEditRaw); } else { delete photo.altitude; }
  if (tags.length) { photo.tags = tags; } else { delete photo.tags; }
  if (seoDesc) { photo.seo_desc = seoDesc; } else { delete photo.seo_desc; }
  if (seoKeywords) { photo.seo_keywords = seoKeywords; } else { delete photo.seo_keywords; }
  if (seoDescEn) { photo.seo_desc_en = seoDescEn; } else { delete photo.seo_desc_en; }
  if (seoKeywordsEn) { photo.seo_keywords_en = seoKeywordsEn; } else { delete photo.seo_keywords_en; }
  photo.type = photoType;
  if (isPanorama) { photo.panorama = true; } else { delete photo.panorama; }
  try {
    if (req.file) {
      var [buf400, buf800, buf2400, colorFamily, imgMeta] = await Promise.all([
        sharp(req.file.buffer).resize({ width: 400, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(),
        sharp(req.file.buffer).resize({ width: 800, withoutEnlargement: true }).webp({ quality: 85 }).toBuffer(),
        sharp(req.file.buffer).resize({ width: 2400, withoutEnlargement: true }).webp({ quality: 90 }).toBuffer(),
        extractColorFamily(req.file.buffer),
        sharp(req.file.buffer).metadata(),
      ]);
      var path400 = `${country}/${seriesKey}/${id}-400.webp`;
      var path800 = `${country}/${seriesKey}/${id}-800.webp`;
      var path2400 = `${country}/${seriesKey}/${id}-2400.webp`;
      var pathPano = `${country}/${seriesKey}/${id}-orig.webp`;
      await Promise.all([
        bucket.file(path400).save(buf400, { contentType: 'image/webp' }).then(() => bucket.file(path400).makePublic()),
        bucket.file(path800).save(buf800, { contentType: 'image/webp' }).then(() => bucket.file(path800).makePublic()),
        bucket.file(path2400).save(buf2400, { contentType: 'image/webp' }).then(() => bucket.file(path2400).makePublic()),
        isPanorama ? savePanoAsset(req.file.buffer, pathPano) : Promise.resolve(),
      ]);
      var base = `https://storage.googleapis.com/${process.env.PHOTO_BUCKET}`;
      photo.urls = { thumb: `${base}/${path400}`, preview: `${base}/${path800}`, full: `${base}/${path2400}` };
      if (isPanorama) photo.urls.pano = `${base}/${pathPano}`;
      photo.width = imgMeta.width;
      photo.height = imgMeta.height;
      if (colorFamily) photo.colorFamily = colorFamily;
    } else if (COLOR_FAMILIES[req.body.colorFamily]) {
      photo.colorFamily = req.body.colorFamily;
    } else {
      delete photo.colorFamily;
    }
    if (needsTranslation) {
      try {
        var { translateTitleDesc } = require('../lib/photo-seo');
        var translated = await translateTitleDesc({
          title: !photo.title_en ? photo.title : null,
          desc: (photo.desc && !photo.desc_en) ? photo.desc : null,
        });
        if (translated.title) photo.title_en = translated.title;
        if (translated.desc) photo.desc_en = translated.desc;
      } catch (e) {
        console.error('[photo-edit] auto-translate error:', e.message);
      }
    }
    saveData(data);
    res.redirect(`/admin/${country}/${seriesKey}/edit`);
  } catch (err) {
    console.error('Photo edit error:', err);
    res.status(500).send('Ошибка при замене фото: ' + err.message);
  }
});

// ── TG notifier test ─────────────────────────────────────────────────────────

router.post('/test-tg', requireAuth, async (req, res) => {
  var data = getData();
  var countryKey = Object.keys(data)[0];
  var country = data[countryKey];
  var seriesKey = Object.keys(country.series)[0];
  var photo = country.series[seriesKey].photos[0];
  if (!photo) return res.json({ error: 'no photos found' });
  tgNotifier.queue(photo, countryKey, seriesKey);
  res.json({ queued: photo.title });
});

router.post('/test-tg-now', requireAuth, async (req, res) => {
  await tgNotifier.flush();
  res.json({ ok: true });
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
    // within a photo: exact before partial, pages before bare image files
    function hitRank(h) {
      return (h.partial ? 2 : 0) + (h.matchType === 'page' ? 0 : 1);
    }
    Object.values(byPhoto).forEach(function(g) {
      g.hits.sort(function(a, b) { return hitRank(a) - hitRank(b); });
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
  var countryKey = (req.body.countryKey || '').trim();
  var seriesKey = (req.body.seriesKey || '').trim();
  if (photoId) {
    try { await copyright.clearPhoto(photoId, countryKey, seriesKey); } catch (e) { console.error(e.message); }
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
  var text_en = (req.body.text_en || '').trim();
  if (!text || isNaN(x) || isNaN(y) || x < 0 || x > 100 || y < 0 || y > 100) {
    return res.status(400).json({ ok: false, error: 'invalid data' });
  }
  var data = getData();
  if (!data[country] || !data[country].series[seriesKey]) return res.status(404).json({ ok: false });
  var photo = data[country].series[seriesKey].photos.find(function(p) { return p.id === id; });
  if (!photo) return res.status(404).json({ ok: false });
  var annot = { id: Date.now().toString(), x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, text, createdAt: new Date().toISOString().slice(0, 10) };
  if (text_en) annot.text_en = text_en;
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
    photo.seo_desc_en = result.descEn;
    photo.seo_keywords_en = result.keywordsEn;
    saveData(data);
    res.json({ ok: true, desc: photo.seo_desc, keywords: photo.seo_keywords, descEn: photo.seo_desc_en, keywordsEn: photo.seo_keywords_en });
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
