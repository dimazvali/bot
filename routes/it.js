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

// ?lang=ru|en wins; otherwise Accept-Language — ru (and uk/be/kk) → RU, anything else → EN.
// No header (most crawlers) → RU, the canonical version.
function cvLang(req) {
  if (req.query.lang === 'en' || req.query.lang === 'ru') return req.query.lang;
  if (!req.get('accept-language')) return 'ru';
  var best = req.acceptsLanguages('ru', 'uk', 'be', 'kk', 'en');
  return best && best !== 'en' ? 'ru' : 'en';
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

router.get('/sitemap.xml', async function(req, res) {
  var base = 'https://it.dimazvali.com';
  try {
    var projects = await itData.getProjects({ publishedOnly: true });
    var xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
      + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
      + '  <url><loc>' + base + '/</loc></url>\n'
      + '  <url><loc>' + base + '/cv</loc></url>\n'
      + '  <url><loc>' + base + '/cv?lang=en</loc></url>\n';
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
