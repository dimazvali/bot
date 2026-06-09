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

// ── Task 5: Homepage ──────────────────────────────────────────────────────────
router.get('/:lang', async (req, res, next) => {
  try {
    const { lang } = res.locals;

    let about = {};
    let upcomingEvent = null;

    if (col.about) {
      const aboutDoc = await col.about.doc('main').get();
      about = aboutDoc.exists ? aboutDoc.data() : {};

      const now = new Date();
      try {
        const eventsSnap = await col.news
          .where('registration_enabled', '==', true)
          .orderBy('event_date', 'asc')
          .limit(1)
          .get();
        eventsSnap.forEach(doc => {
          const d = doc.data();
          const eventDate = d.event_date ? d.event_date.toDate() : null;
          if (eventDate && eventDate >= now) upcomingEvent = { id: doc.id, ...d };
        });
      } catch {
        // Firestore index may not exist yet
      }
    }

    res.render('pelamushi/index', { about, upcomingEvent });
  } catch (err) {
    next(err);
  }
});

// ── Task 6: About page ────────────────────────────────────────────────────────
router.get('/:lang/about', async (req, res, next) => {
  try {
    const { lang } = res.locals;

    let about = {}, team = [], gallery = [];

    if (col.about) {
      const [aboutDoc, teamSnap, gallerySnap] = await Promise.all([
        col.about.doc('main').get(),
        col.team.where('active', '==', true).orderBy('order').get(),
        col.gallery.orderBy('order').get(),
      ]);

      about = aboutDoc.exists ? aboutDoc.data() : {};
      team = teamSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      gallery = gallerySnap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    res.render('pelamushi/about', { about, team, gallery, pageTitle: res.locals.t.about.title });
  } catch (err) {
    next(err);
  }
});

// ── Task 7: Menu pages ────────────────────────────────────────────────────────
router.get('/:lang/menu', async (req, res, next) => {
  try {
    const { lang } = res.locals;
    const now = new Date();
    let menus = [];

    if (col.menus) {
      const snap = await col.menus.where('active', '==', true).orderBy('order').get();
      menus = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(m => {
          if (m.type === 'event' && m.date_to) {
            return m.date_to.toDate() >= now;
          }
          return true;
        });
    }

    res.render('pelamushi/menu-list', { menus, pageTitle: res.locals.t.menu.title });
  } catch (err) {
    next(err);
  }
});

router.get('/:lang/menu/:slug', async (req, res, next) => {
  try {
    const { lang } = res.locals;
    const { slug } = req.params;

    if (!col.menus) return res.status(503).send('Unavailable');

    const menuSnap = await col.menus.where('slug', '==', slug).limit(1).get();
    if (menuSnap.empty) return res.status(404).send('Menu not found');

    const menuDoc = menuSnap.docs[0];
    const menu = { id: menuDoc.id, ...menuDoc.data() };

    const [catsSnap, itemsSnap] = await Promise.all([
      col.categories.where('menu_id', '==', menu.id).orderBy('order').get(),
      col.items.where('menu_id', '==', menu.id).where('active', '==', true).orderBy('order').get(),
    ]);

    const categories = catsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const itemsAll   = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const grouped = categories.map(cat => ({
      ...cat,
      items: itemsAll.filter(i => i.category_id === cat.id),
    }));
    const uncategorized = itemsAll.filter(i => !i.category_id);

    res.render('pelamushi/menu', {
      menu,
      grouped,
      uncategorized,
      pageTitle: menu['name_' + lang],
    });
  } catch (err) {
    next(err);
  }
});

// ── Task 8: News pages + registration ─────────────────────────────────────────
router.get('/:lang/news', async (req, res, next) => {
  try {
    const { lang } = res.locals;
    let articles = [];

    if (col.news) {
      const snap = await col.news.orderBy('published_at', 'desc').limit(20).get();
      articles = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    res.render('pelamushi/news-list', { articles, pageTitle: res.locals.t.news.title });
  } catch (err) {
    next(err);
  }
});

router.get('/:lang/news/:slug', async (req, res, next) => {
  try {
    const { lang } = res.locals;

    if (!col.news) return res.status(503).send('Unavailable');

    const snap = await col.news.where('slug', '==', req.params.slug).limit(1).get();
    if (snap.empty) return res.status(404).send('Not found');

    const article = { id: snap.docs[0].id, ...snap.docs[0].data() };
    const registered = req.query.registered === '1';

    res.render('pelamushi/news-item', {
      article,
      registered,
      pageTitle: article['title_' + lang],
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:lang/news/:slug/register', async (req, res, next) => {
  try {
    const { lang } = res.locals;
    const { name, email, phone } = req.body;

    if (!name || !email) return res.status(400).send('Missing fields');

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(email)) return res.status(400).send('Invalid email');

    if (!col.news) return res.status(503).send('Unavailable');

    const snap = await col.news.where('slug', '==', req.params.slug).limit(1).get();
    if (snap.empty) return res.status(404).send('Not found');

    if (!snap.docs[0].data().registration_enabled) return res.status(400).send('Registration not open');

    await col.registrations.add({
      news_id: snap.docs[0].id,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: (phone || '').trim(),
      created_at: Timestamp.now(),
    });

    res.redirect(`/${lang}/news/${req.params.slug}?registered=1`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
