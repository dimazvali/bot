'use strict';
// Local preview of the photo.dimazvali.com redesign (routes/photo-v2.js) on fixture data —
// no Firebase, no Telegram, no network calls to anything but the photo CDN images.
//
//   node scripts/photo-v2-preview.js            → http://localhost:3600
//   PORT=3700 node scripts/photo-v2-preview.js
//   node scripts/photo-v2-preview.js --prod     → the REAL collections (PHOTO_ENV=prod, read-only, see below)
//
// The data comes from design_handoff_photo_v2/gallery-data.js (a real export of the portfolio);
// shoots, faces and comments are made up. The real routes/photo.js runs on top of stubbed
// data libs, so every URL behaves exactly as on the live site.
var path = require('path');
var fs = require('fs');
var vm = require('vm');
var express = require('express');
var cookieParser = require('cookie-parser');

var ROOT = path.join(__dirname, '..');

// --prod: real Firestore data through the real routes/photo.js + routes/photo-admin.js (credentials from
// .env). Everything that would WRITE or NOTIFY is switched off first, so browsing the preview leaves
// no trace on the live site: no view stats, no Telegram/e-mail, no cron jobs, no Google sign-in
// (so no comments / subscriptions / guest points). Admin login still works but do not edit anything.
var PROD = process.argv.indexOf('--prod') !== -1;
if (PROD) {
  require('dotenv').config({ path: path.join(ROOT, '.env') });
  process.env.PHOTO_ENV = 'prod';
  ['dimazvaliToken', 'GMAIL_USER', 'GMAIL_PASS', 'GOOGLE_CLIENT_ID'].forEach(function(k) { delete process.env[k]; });
}
process.env.papersToken = process.env.papersToken || 'preview-secret';
delete process.env.dimazvaliToken; // tgSend() becomes a no-op

function stub(rel, exports) {
  var p = require.resolve(path.join(ROOT, rel));
  require.cache[p] = { id: p, filename: p, loaded: true, exports: exports, children: [], paths: [] };
}

if (PROD) {
  // view counter would write to photo_views(env=prod); tg notifier / cron are the other side effects
  stub('lib/photo-stats.js', {
    init: function() {},
    trackView: function() {},
    getStatsByType: async function() { return {}; },
    BOT_UA_RE: /bot|crawl|spider|slurp|preview|fetch|curl|wget|headlesschrome|lighthouse/i,
  });
  stub('lib/photo-tg-notifier.js', { init: function() {}, queue: function() {} });
  require.cache[require.resolve('node-cron')] = { id: 'node-cron', filename: 'node-cron', loaded: true, exports: { schedule: function() {} }, children: [], paths: [] };
}

if (!PROD) {
// ── fixture ────────────────────────────────────────────────────────────────
var sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'design_handoff_photo_v2/gallery-data.js'), 'utf8'), sandbox);
var G = sandbox.window.GALLERY;

function typeFor(id, i) {
  if (/^dji/.test(id)) return 'copter';
  return i % 3 === 0 ? 'mobile' : 'camera';
}

var data = {};
G.countries.forEach(function(c) {
  data[c.key] = { label: c.label, seriesOrder: c.series.map(function(s) { return s.key; }), series: {} };
  c.series.forEach(function(s) { data[c.key].series[s.key] = { label: s.label, photos: [] }; });
});
G.photos.forEach(function(p, i) {
  var ser = data[p.country] && data[p.country].series[p.series];
  if (!ser) return;
  ser.photos.push({
    id: p.id, title: p.title, date: p.date, desc: p.desc || '', tags: p.tags || [],
    colorFamily: p.colorFamily, width: p.w, height: p.h, type: typeFor(p.id, i),
    urls: { thumb: p.thumb, preview: p.preview, full: p.preview },
  });
});
// a few extras so annotations / panorama / coordinates / series intro can be eyeballed
var firstCountry = data[G.countries[0].key];
var firstSeries = firstCountry.series[firstCountry.seriesOrder[0]];
firstSeries.intro = 'Город, который не сидит на месте: мосты, склоны, крыши и люди между ними.';
if (firstSeries.photos[0]) {
  firstSeries.photos[0].desc = 'Кадр с коптера над старым городом — тот случай, когда хочется висеть в воздухе часами.';
  firstSeries.photos[0].annotations = [
    { id: 'a1', x: 30, y: 44, text: 'Метехский мост, вид с Авлабари.' },
    { id: 'a2', x: 62, y: 30, text: 'Фундаменты домов, затопленных при строительстве набережной.', source: 'client', authorName: 'Нино' },
  ];
  firstSeries.photos[0].coords = { lat: 41.6938, lng: 44.8118 };
  firstSeries.photos[1] && (firstSeries.photos[1].coords = { lat: 41.7, lng: 44.79 });
  firstSeries.photos[1] && (firstSeries.photos[1].desc = 'Второй кадр серии с длинным описанием: несколько предложений, чтобы подпись не помещалась в одну строку и её можно было раскрыть. Так видно, что состояние виджета переезжает вместе с пользователем от кадра к кадру.');
}

var tags = {};
G.tags.forEach(function(t) { tags[t.key] = { label: t.label, desc: '' }; });

var pool = firstSeries.photos.slice(0, 24);
function shootPhoto(p, i) {
  return Object.assign({}, p, {
    curatorPick: i % 3 === 0,
    faces: i % 4 === 0 ? [{ faceId: 'f1' }] : (i % 5 === 0 ? [{ faceId: 'f2' }] : []),
  });
}
var shoots = {
  'masha-retouch': {
    key: 'masha-retouch', label: 'Маша · летняя съёмка', desc: '', public: false, password: '',
    showCuratorSelection: true, showFaces: true, relatedShoots: [],
    photos: pool.map(shootPhoto), photoOrder: pool.map(function(p) { return p.id; }),
  },
  'open-city': {
    key: 'open-city', label: 'Городской репортаж', desc: 'Открытая съёмка', public: true, password: '',
    photos: pool.slice(4, 14), photoOrder: pool.slice(4, 14).map(function(p) { return p.id; }),
  },
  'locked': {
    key: 'locked', label: 'Закрытая съёмка', desc: '', public: false, password: 'secret',
    photos: pool.slice(0, 6), photoOrder: pool.slice(0, 6).map(function(p) { return p.id; }),
  },
};

// ── stubs for everything that would touch Firebase / Telegram / AWS ─────────
var noopRouter = function() { return express.Router(); };
stub('lib/photo-data.js', { getData: function() { return data; } });
stub('lib/photo-tags.js', { getTags: function() { return tags; } });
stub('lib/photo-stats.js', {
  trackView: function() {},
  getStatsByType: async function() { return {}; },
  BOT_UA_RE: /bot|crawl|spider|slurp|preview|fetch|curl|wget|headlesschrome|lighthouse/i,
});
stub('lib/photo-subscriptions.js', { unsubscribe: async function() { return false; } });
stub('lib/photo-users.js', {
  upsertSubscriber: async function() {}, unsubscribe: async function() {}, unsubscribeByToken: async function() { return false; },
});
stub('lib/photo-shoots.js', {
  getData: function() { return shoots; },
  getShoot: function(slug) { return shoots[slug] || null; },
  addCollection: async function() { return { id: 'preview' }; },
  addAnnotation: async function() {},
});
stub('lib/photo-people.js', {
  groupShootFaces: function(slug, shoot) {
    if (!shoot.showFaces) return [];
    var src = shoot.photos[0].urls.preview;
    return [
      { key: 'p1', name: 'Маша', faces: [{ faceId: 'f1', thumb: src, boundingBox: { Width: .4, Height: .5, Left: .3, Top: .1 } }] },
      { key: 'p2', name: '', faces: [{ faceId: 'f2', thumb: shoot.photos[1].urls.preview, boundingBox: { Width: .35, Height: .45, Left: .2, Top: .2 } }] },
    ];
  },
});
var adminRouter = express.Router();
adminRouter.checkAdminToken = async function(req) { return !!(req.signedCookies && req.signedCookies.photoAdminToken); };
adminRouter.bucket = {};
adminRouter.indexNowSubmit = function() {};
stub('routes/photo-admin.js', adminRouter);
stub('routes/photo-og.js', noopRouter());
var commentsRouter = express.Router();
commentsRouter.get('/:c/:s/:id', function(req, res) {
  res.json({ ok: true, comments: [
    { id: '1', userName: 'Нино', userPicture: '', text: 'Отличный кадр!', createdAt: new Date().toISOString() },
    { id: '2', userName: 'Георгий', userPicture: '', text: 'Где это снято?', createdAt: new Date().toISOString() },
  ] });
});
stub('routes/photo-comments.js', commentsRouter);
} // !PROD

// ── app ────────────────────────────────────────────────────────────────────
function makeApp(router) {
  var a = express();
  a.set('views', path.join(ROOT, 'views'));
  a.set('view engine', 'pug');
  a.use(cookieParser(process.env.papersToken));
  a.use(router);
  a.use(function(err, req, res, next) { console.error(err); res.status(500).send('<pre>' + (err.stack || err) + '</pre>'); });
  return a;
}
var app = makeApp(require('../routes/photo-v2'));

if (require.main !== module) {
  // required from a test/compare script: hand out the redesign app and the untouched live one on the same data
  module.exports = { v2: app, old: makeApp(require('../routes/photo')) };
} else {
  var port = process.env.PORT || 3600;
  app.listen(port, function() {
    console.log('photo-v2 preview: http://localhost:' + port);
    if (PROD) console.log('  PROD data (env=prod, read-only) — collections load in a few seconds; stats/telegram/cron are OFF');
    else console.log('  shoot (client mode):  /shoot/masha-retouch    password page: /shoot/locked (pw: secret)');
  });
}
