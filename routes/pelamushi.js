const express = require('express');
const router = express.Router();
const { col, Timestamp } = require('../lib/pelamushi-firebase');

const LANGS = ['en', 'ka', 'ru'];

const locales = {
  en: require('../locales/pelamushi/en.json'),
  ka: require('../locales/pelamushi/ka.json'),
  ru: require('../locales/pelamushi/ru.json'),
};

// Mount admin router
router.use('/admin', require('./pelamushi-admin'));

// Language param middleware — fires for ANY route containing :lang
router.param('lang', (req, res, next, lang) => {
  if (!LANGS.includes(lang)) return res.status(404).send('Not found');
  res.locals.lang = lang;
  res.locals.t = locales[lang];
  next();
});

// Root redirect by Accept-Language
router.get('/', (req, res) => {
  const accept = req.headers['accept-language'] || '';
  let lang = 'en';
  if (accept.includes('ka')) lang = 'ka';
  else if (accept.includes('ru')) lang = 'ru';
  res.redirect(`/${lang}`);
});

// Language switcher
router.get('/lang/:code', (req, res) => {
  const code = req.params.code;
  if (!LANGS.includes(code)) return res.redirect('/');
  res.cookie('pelamushi_lang', code, { maxAge: 365 * 24 * 3600 * 1000 });
  const raw = req.headers.referer || `/${code}`;
  let ref;
  try { ref = new URL(raw).pathname; } catch { ref = `/${code}`; }
  // swap lang segment in the referring pathname
  const swapped = ref.replace(/\/(en|ka|ru)(\/|$)/, `/${code}$2`);
  res.redirect(swapped);
});

module.exports = router;
