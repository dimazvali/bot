'use strict';
var express = require('express');
var router = express.Router();
var path = require('path');
var { initializeApp, getApps, cert } = require('firebase-admin/app');
var { getFirestore } = require('firebase-admin/firestore');
var itData = require('../lib/it-data');

var itApp = getApps().find(function(a) { return a.name === 'it'; }) || initializeApp({
  credential: cert({
    type: 'service_account',
    project_id: 'dimazvalimisc',
    private_key_id: '5eb5025afc0fe53b63f518ba071f89e7b7ce03af',
    private_key: (process.env.sssGCPKey || '').replace(/\\n/g, '\n'),
    client_email: 'firebase-adminsdk-4iwd4@dimazvalimisc.iam.gserviceaccount.com',
    client_id: '110523994931477712119',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-4iwd4%40dimazvalimisc.iam.gserviceaccount.com',
  }),
  storageBucket: process.env.PHOTO_BUCKET,
}, 'it');

var fb = getFirestore(itApp);
itData.init(fb);
var cvStore = require('../lib/it-cv-store').init(fb);
var cvEditor = require('../lib/it-cv-editor');

router.use(express.static(path.join(__dirname, '../public')));
var itAdmin = require('./it-admin');
router.use('/admin', itAdmin);

router.get('/', async function(req, res, next) {
  try {
    var projects = await itData.getProjects({ publishedOnly: true, parse: true });
    res.render('it/home', { projects });
  } catch (e) { next(e); }
});

// English CV quest: static file with the same node ids as the RU tree (not editable in /admin/cv yet)
var cvQuestEn = require('../lib/it-cv-quest-en.json');

// ?lang=ru|en wins; otherwise RU has priority: Russian anywhere in Accept-Language
// (any position, any q>0) → RU; no Russian at all → EN. No header (most crawlers) → RU.
function cvLang(req) {
  if (req.query.lang === 'en' || req.query.lang === 'ru') return req.query.lang;
  if (!req.get('accept-language')) return 'ru';
  return req.acceptsLanguages('ru') ? 'ru' : 'en';
}

// Interface strings around the quest content (page chrome + client-side renderer)
var CV_UI = {
  ru: {
    htmlLang: 'ru',
    title: 'Дмитрий Шестаков — резюме-квест · it.dimazvali.com',
    description: 'Интерактивное резюме Дмитрия Шестакова: выберите, что вам важно — продукт, delivery, разработка, медиа, ивенты или фото — и получите бриф за три шага.',
    ogTitle: 'Дмитрий Шестаков — резюме за три вопроса',
    ogDescription: 'Выберите, кто вам нужен, — и получите короткий бриф под вашу задачу.',
    step: 'шаг', done: 'готово',
    noscript: 'Без JavaScript квест не работает — вот', noscriptLink: 'резюме в PDF',
    contactLabel: 'Связаться', contactTitle: 'Обсудить работу', fullPdf: 'резюме целиком',
    switchHref: '/cv?lang=en', switchLabel: 'EN',
    js: {
      step: 'шаг', done: 'готово', youChose: 'вы выбрали', back: '← назад', restart: '↺ начать заново',
      briefReady: 'Ваш бриф готов', outro: 'Если откликается — давайте поговорим. Полная версия резюме — в PDF.',
      telegram: 'Написать в Telegram ↗', email: 'Email', pdf: 'Резюме PDF ↓', projects: 'Все проекты →',
      subject: 'По резюме: ',
    },
  },
  en: {
    htmlLang: 'en',
    title: 'Dmitry Shestakov — interactive CV · it.dimazvali.com',
    description: 'Interactive CV of Dmitry Shestakov: pick what matters to you — product, delivery, engineering, media, events or photo — and get a brief in three steps.',
    ogTitle: 'Dmitry Shestakov — a CV in three questions',
    ogDescription: 'Pick who you need and get a short brief tailored to your task.',
    step: 'step', done: 'done',
    noscript: 'The quest needs JavaScript — here is the', noscriptLink: 'CV as a PDF',
    contactLabel: 'Get in touch', contactTitle: 'Let’s talk work', fullPdf: 'full CV',
    switchHref: '/cv?lang=ru', switchLabel: 'RU',
    js: {
      step: 'step', done: 'done', youChose: 'you chose', back: '← back', restart: '↺ start over',
      briefReady: 'Your brief is ready', outro: 'If this resonates, let’s talk. The full CV is in the PDF.',
      telegram: 'Message on Telegram ↗', email: 'Email', pdf: 'CV PDF ↓', projects: 'All projects →',
      subject: 'Re your CV: ',
    },
  },
};

// Content is edited in /admin/cv; ?draft=1 previews the unpublished draft (admins only)
router.get('/cv', async function(req, res, next) {
  try {
    var quest;
    var draft = false;
    var lang = cvLang(req);
    if (req.query.draft && await itAdmin.isAdmin(req)) {
      quest = (await cvStore.getDraft()).quest;
      quest.STEPS = cvEditor.validate(quest).steps || quest.STEPS || 3;
      draft = true;
      lang = 'ru'; // the editor only has the RU tree
    } else if (lang === 'en') {
      quest = cvQuestEn;
    } else {
      quest = await cvStore.getPublished();
    }
    var questJson = JSON.stringify(quest).replace(/</g, '\\u003c');
    res.set('Cache-Control', draft ? 'no-store' : 'public, max-age=60');
    res.vary('Accept-Language');
    res.render('it/cv', { quest: quest, questJson: questJson, draft: draft, lang: lang, ui: CV_UI[lang] });
  } catch (e) { next(e); }
});

// Mini-game: whack-a-mole on the Tbilisi district map (district outlines from OSM)
var tbilisiMap = require('../lib/it-tbilisi-districts.json');
var blackoutUi = require('../lib/it-blackout-i18n');
router.get('/blackout', function(req, res) {
  var lang = cvLang(req); // same language rules as the CV page
  var ui = blackoutUi(lang);
  res.set('Cache-Control', 'public, max-age=300');
  res.vary('Accept-Language');
  res.render('it/blackout', {
    map: tbilisiMap, lang: lang, ui: ui,
    uiJson: JSON.stringify(ui.js).replace(/</g, '\\u003c'),
  });
});

// shift tokens are HMAC-signed; the secret is derived from the service-account key unless set explicitly
// (with neither, a per-process random secret: tokens just stop working after a restart)
var blackoutSecret = process.env.BLACKOUT_SECRET
  || (process.env.sssGCPKey && require('crypto').createHash('sha256').update('blackout:' + process.env.sssGCPKey).digest('hex'))
  || require('crypto').randomBytes(32).toString('hex');
var blackoutScores = require('../lib/it-blackout-scores').init(fb, blackoutSecret);
var blackoutStats = require('../lib/it-blackout-stats').init(fb); // the admin's /admin/blackout reads it too
router.get('/blackout/scores', async function(req, res, next) {
  try {
    res.set('Cache-Control', 'no-store');
    res.json({ top: await blackoutScores.top(String(req.query.d || '')) });
  } catch (e) { next(e); }
});

// naive per-IP limiter: plenty for honest play, stops a script from flooding the table
var scoreHits = new Map();
function scoreRateOk(ip) {
  var now = Date.now();
  var hits = (scoreHits.get(ip) || []).filter(function(t) { return now - t < 10 * 60 * 1000; });
  if (hits.length >= 20) return false;
  hits.push(now);
  scoreHits.set(ip, hits);
  if (scoreHits.size > 5000) scoreHits.clear();
  return true;
}

// a token per shift, requested when the game starts
var sessionHits = new Map();
var blackoutNotify = require('../lib/it-blackout-notify').create();
router.post('/blackout/session', express.json({ limit: '1kb' }), function(req, res) {
  var now = Date.now();
  var hits = (sessionHits.get(req.ip) || []).filter(function(t) { return now - t < 60 * 1000; });
  if (hits.length >= 30) return res.status(429).json({ error: 'rate' });
  hits.push(now);
  sessionHits.set(req.ip, hits);
  if (sessionHits.size > 5000) sessionHits.clear();
  res.set('Cache-Control', 'no-store');
  var session = blackoutScores.newSession();
  res.json(session);
  // the it admin's own shifts are neither logged nor announced
  itAdmin.isAdmin(req).then(function(admin) {
    if (admin) return;
    var body = req.body || {};
    blackoutNotify.launch(req, body); // Telegram: a shift started (deduped per device)
    return blackoutStats.logLaunch(blackoutScores.readToken(session.token).sid, {
      deviceId: body.deviceId, lang: body.lang, plays: body.plays, ua: req.get('user-agent'),
    });
  }).catch(function(e) { console.error('[blackout] launch log:', e.message); });
});

// end of a shift (sent by the game at game over): completes the shift's stats record
// and prepares the share card link when the result is believable
var blackoutShare = require('../lib/it-blackout-share').init(fb);
var SHARE_RULES = { maxScore: blackoutScores.maxScore, minDurationMs: blackoutScores.minDurationMs, fixesPerLevel: 10 };
router.post('/blackout/finish', express.json({ limit: '1kb' }), async function(req, res) {
  var session = blackoutScores.readToken(req.body && req.body.token);
  if (!session) return res.status(400).json({ error: 'token' });
  blackoutStats.logFinish(session.sid, req.body).catch(function(e) { console.error('[blackout] finish log:', e.message); });
  var result = blackoutShare.plausible(req.body, session.startedAt, Date.now(), SHARE_RULES);
  if (!result) return res.json({ share: null });
  try {
    result.lang = req.body.lang;
    var id = await blackoutShare.createShare(session.sid, result);
    res.json({ share: 'https://it.dimazvali.com/blackout/s/' + id });
  } catch (e) {
    console.error('[blackout] share:', e.message);
    res.json({ share: null });
  }
});

// a shared result: an og-card page for messengers, a link into the game for people
router.get('/blackout/s/:id', async function(req, res, next) {
  if (/\.png$/.test(req.params.id)) return next(); // the card image route below
  try {
    var share = await blackoutShare.getShare(req.params.id);
    if (!share) return res.redirect(302, '/blackout');
    res.set('Cache-Control', 'public, max-age=3600');
    res.render('it/blackout-share', { id: req.params.id, t: blackoutShare.cardText(share) });
  } catch (e) { next(e); }
});

var shareCards = new Map(); // id -> PNG; a result never changes, so cards are cached for good (bounded)
router.get('/blackout/s/:id.png', async function(req, res, next) {
  try {
    var png = shareCards.get(req.params.id);
    if (!png) {
      var share = await blackoutShare.getShare(req.params.id);
      if (!share) return res.status(404).end();
      png = await blackoutShare.renderCard(share);
      if (shareCards.size >= 300) shareCards.delete(shareCards.keys().next().value);
      shareCards.set(req.params.id, png);
    }
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(png);
  } catch (e) { next(e); }
});

router.post('/blackout/scores', express.json({ limit: '2kb' }), async function(req, res, next) {
  try {
    if (!scoreRateOk(req.ip)) return res.status(429).json({ error: 'rate' });
    var result = await blackoutScores.submit(req.body);
    if (result.error) return res.status(400).json(result);
    var top = await blackoutScores.top(req.body.deviceId);
    res.json({ ok: true, improved: result.improved, top: top });
    if (result.improved) { // Telegram: a new best for this device, with its place in the table
      var mine = top.filter(function(r) { return r.me; })[0];
      blackoutNotify.record(req, {
        nick: mine ? mine.nick : blackoutScores.cleanNick(req.body.nick),
        score: Number(req.body.score), level: Number(req.body.level), fixes: Number(req.body.fixes),
        durationMs: result.durationMs, rank: mine ? mine.rank : null,
      });
    }
  } catch (e) { next(e); }
});

router.get('/sitemap.xml', async function(req, res) {
  var base = 'https://it.dimazvali.com';
  try {
    var projects = await itData.getProjects({ publishedOnly: true });
    var xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
      + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
      + '  <url><loc>' + base + '/</loc></url>\n'
      + '  <url><loc>' + base + '/cv</loc></url>\n'
      + '  <url><loc>' + base + '/cv?lang=en</loc></url>\n'
      + '  <url><loc>' + base + '/blackout</loc></url>\n'
      + '  <url><loc>' + base + '/blackout?lang=en</loc></url>\n';
    for (var p of projects) {
      if (p.slug && p.full) {
        xml += '  <url><loc>' + base + '/' + p.slug + '</loc></url>\n';
      }
    }
    xml += '</urlset>';
    res.set('Content-Type', 'application/xml');
    res.send(xml);
  } catch (e) {
    res.status(500).send('Error generating sitemap');
  }
});

router.get('/robots.txt', function(req, res) {
  res.set('Content-Type', 'text/plain');
  res.send('User-agent: *\nAllow: /\nSitemap: https://it.dimazvali.com/sitemap.xml\n');
});

router.get('/:slug', async function(req, res, next) {
  try {
    var doc = await itData.getProjectBySlug(req.params.slug);
    if (!doc || !doc.full) return res.status(404).render('it/404');
    var project = itData.parseProject(doc);
    var related = [];
    if (doc.companyId) {
      related = await itData.getStoriesByCompany(doc.companyId, doc.id);
    }
    res.render('it/project', { project, related });
  } catch (e) { next(e); }
});

module.exports = router;
