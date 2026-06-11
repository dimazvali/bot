const express = require('express');
const router = express.Router();
const { col, Timestamp } = require('../lib/pelamushi-firebase');
const cache = require('../lib/pelamushi-cache');

const LANGS = ['en', 'ka', 'ru'];

const locales = {
  en: require('../locales/pelamushi/en.json'),
  ka: require('../locales/pelamushi/ka.json'),
  ru: require('../locales/pelamushi/ru.json'),
};

// Mount admin router
router.use('/admin', require('./pelamushi-admin'));

const ASSET_VER = process.env.APP_VER || Date.now().toString(36);
router.use((req, res, next) => {
  res.locals.v = ASSET_VER;
  res.locals.isAdmin = !!(req.cookies && req.cookies.pelamushi_admin);
  next();
});

// Language param middleware — fires for ANY route containing :lang
router.param('lang', async (req, res, next, lang) => {
  if (!LANGS.includes(lang)) return res.status(404).send('Not found');
  res.locals.lang = lang;
  res.locals.t = locales[lang];
  res.locals.site = {};
  if (col.about) {
    try {
      let site = cache.get('site');
      if (site === undefined) {
        const doc = await col.about.doc('main').get();
        site = doc.exists ? doc.data() : {};
        cache.set('site', site);
      }
      res.locals.site = site;
      res.locals.ogImage = (site && site.hero_url) || '';
    } catch { /* ignore */ }
  }
  res.locals.basePath = req.path.replace(/^\/(en|ka|ru)/, '');
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
  const swapped = ref.replace(/\/(en|ka|ru)(\/|$)/, `/${code}$2`);
  res.redirect(swapped);
});

// ── Sitemap & robots ─────────────────────────────────────────────────────────
const BASE = 'https://pelamushi.ge';
const STATIC_PATHS = ['', '/about', '/menu', '/bar', '/shop', '/rental', '/news'];

router.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nSitemap: ${BASE}/sitemap.xml\n`);
});

router.get('/sitemap.xml', async (req, res, next) => {
  try {
    let xml = cache.get('sitemap');
    if (xml === undefined) {
      let menuSlugs = [], newsSlugs = [];

      if (col.menus) {
        const snap = await col.menus.where('active', '==', true).get();
        menuSlugs = snap.docs.map(d => d.data().slug).filter(Boolean);
      }
      if (col.news) {
        const snap = await col.news.orderBy('published_at', 'desc').get();
        newsSlugs = snap.docs.map(d => d.data().slug).filter(Boolean);
      }

      const allPaths = [
        ...STATIC_PATHS,
        ...menuSlugs.map(s => `/menu/${s}`),
        ...newsSlugs.map(s => `/news/${s}`),
      ];

      const rows = allPaths.map(path => {
        const alts = LANGS.map(l =>
          `    <xhtml:link rel="alternate" hreflang="${l}" href="${BASE}/${l}${path}"/>`
        ).join('\n');
        return LANGS.map(l =>
          `  <url>\n    <loc>${BASE}/${l}${path}</loc>\n${alts}\n  </url>`
        ).join('\n');
      });

      xml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
        '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
        ...rows,
        '</urlset>',
      ].join('\n');

      cache.set('sitemap', xml);
    }

    res.type('application/xml').send(xml);
  } catch (err) {
    next(err);
  }
});

// ── Homepage ──────────────────────────────────────────────────────────────────
router.get('/:lang', async (req, res, next) => {
  try {
    // site (about/main) already loaded and cached in router.param
    const about = res.locals.site;
    let upcomingEvent = null;

    if (col.news) {
      try {
        let evt = cache.get('upcoming_event');
        if (evt === undefined) {
          const now = new Date();
          const eventsSnap = await col.news
            .where('registration_enabled', '==', true)
            .orderBy('event_date', 'asc')
            .limit(1)
            .get();
          evt = null;
          eventsSnap.forEach(doc => {
            const d = doc.data();
            const eventDate = d.event_date ? d.event_date.toDate() : null;
            if (eventDate && eventDate >= now) evt = { id: doc.id, ...d };
          });
          cache.set('upcoming_event', evt, 15 * 60 * 1000); // 15 min — time-sensitive
        }
        upcomingEvent = evt;
      } catch {
        // Firestore index may not exist yet
      }
    }

    let sectionIcons = cache.get('section_icons');
    if (sectionIcons === undefined) {
      const [barDoc, shopDoc, rentalDoc] = await Promise.all([
        col.bar    ? col.bar.doc('main').get()    : Promise.resolve({ exists: false }),
        col.shop   ? col.shop.doc('main').get()   : Promise.resolve({ exists: false }),
        col.rental ? col.rental.doc('main').get() : Promise.resolve({ exists: false }),
      ]);
      sectionIcons = {
        about:  about.icon_url  || null,
        menu:   about.menu_icon_url  || null,
        bar:    barDoc.exists    ? (barDoc.data().icon_url    || null) : null,
        shop:   shopDoc.exists   ? (shopDoc.data().icon_url   || null) : null,
        rental: rentalDoc.exists ? (rentalDoc.data().icon_url || null) : null,
        news:   about.news_icon_url  || null,
      };
      cache.set('section_icons', sectionIcons);
    }

    const pageDesc = (about['quote_' + res.locals.lang] || '').replace(/<[^>]+>/g, '').substring(0, 160);
    res.render('pelamushi/index', { about, upcomingEvent, sectionIcons, pageDesc, ogImage: about.home_hero_url || about.hero_url || '', adminEditUrl: '/admin' });
  } catch (err) {
    next(err);
  }
});

// ── About page ────────────────────────────────────────────────────────────────
router.get('/:lang/about', async (req, res, next) => {
  try {
    let data = cache.get('about');
    if (data === undefined) {
      let about = {}, team = [], gallery = [], mentions = [];
      if (col.about) {
        const [aboutDoc, teamSnap, gallerySnap, mentionsSnap] = await Promise.all([
          col.about.doc('main').get(),
          col.team.where('active', '==', true).orderBy('order').get(),
          col.gallery.orderBy('order').get(),
          col.mentions ? col.mentions.orderBy('order').get() : Promise.resolve({ docs: [] }),
        ]);
        about = aboutDoc.exists ? aboutDoc.data() : {};
        team = teamSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        gallery = gallerySnap.docs.map(d => ({ id: d.id, ...d.data() }));
        mentions = mentionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
      data = { about, team, gallery, mentions };
      cache.set('about', data);
    }
    const pageDesc = (data.about['mission_' + res.locals.lang] || '').replace(/<[^>]+>/g, '').substring(0, 160);
    res.render('pelamushi/about', { ...data, pageTitle: res.locals.t.about.title, pageDesc, ogImage: data.about.hero_url || '', adminEditUrl: '/admin/about' });
  } catch (err) {
    next(err);
  }
});

// ── Menu list ─────────────────────────────────────────────────────────────────
router.get('/:lang/menu', async (req, res, next) => {
  try {
    let menus = cache.get('menus');
    if (menus === undefined) {
      menus = [];
      if (col.menus) {
        const now = new Date();
        const snap = await col.menus.where('active', '==', true).orderBy('order').get();
        menus = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(m => {
            if (m.type === 'bar' || m.type === 'shop') return false;
            if (m.type === 'event' && m.date_to) return m.date_to.toDate() >= now;
            return true;
          });

        if (col.items) {
          await Promise.all(menus.map(async m => {
            if (m.cover_url) return;
            const itemSnap = await col.items
              .where('menu_id', '==', m.id)
              .orderBy('order')
              .limit(5)
              .get();
            const withPhoto = itemSnap.docs.find(d => d.data().photo_url);
            if (withPhoto) m.cover_url = withPhoto.data().photo_url;
          }));
        }
      }
      cache.set('menus', menus);
    }
    res.render('pelamushi/menu-list', { menus, pageTitle: res.locals.t.menu.title, adminEditUrl: '/admin/menus' });
  } catch (err) {
    next(err);
  }
});

// ── Menu detail ───────────────────────────────────────────────────────────────
router.get('/:lang/menu/:slug', async (req, res, next) => {
  try {
    const { slug } = req.params;
    const cacheKey = `menu:${slug}`;

    let data = cache.get(cacheKey);
    if (data === undefined) {
      if (!col.menus) return res.status(503).send('Unavailable');

      const menuSnap = await col.menus.where('slug', '==', slug).limit(1).get();
      if (menuSnap.empty) return res.status(404).send('Menu not found');

      const menuDoc = menuSnap.docs[0];
      const menu = { id: menuDoc.id, ...menuDoc.data() };
      if (!menu.active) return res.status(404).send('Menu not found');

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

      data = { menu, grouped, uncategorized };
      cache.set(cacheKey, data);
    }

    res.render('pelamushi/menu', {
      ...data,
      pageTitle: data.menu['name_' + res.locals.lang],
      pageDesc: data.menu['desc_' + res.locals.lang] || '',
      ogImage: data.menu.cover_url || '',
      adminEditUrl: `/admin/menus/${data.menu.id}`,
    });
  } catch (err) {
    next(err);
  }
});

// ── News list ─────────────────────────────────────────────────────────────────
router.get('/:lang/news', async (req, res, next) => {
  try {
    let articles = cache.get('news');
    if (articles === undefined) {
      articles = [];
      if (col.news) {
        const snap = await col.news.orderBy('published_at', 'desc').limit(20).get();
        articles = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
      cache.set('news', articles);
    }
    res.render('pelamushi/news-list', { articles, pageTitle: res.locals.t.news.title, adminEditUrl: '/admin/news' });
  } catch (err) {
    next(err);
  }
});

// ── News article ──────────────────────────────────────────────────────────────
router.get('/:lang/news/:slug', async (req, res, next) => {
  try {
    const { slug } = req.params;
    const cacheKey = `news-item:${slug}`;

    let article = cache.get(cacheKey);
    if (article === undefined) {
      if (!col.news) return res.status(503).send('Unavailable');
      const snap = await col.news.where('slug', '==', slug).limit(1).get();
      if (snap.empty) return res.status(404).send('Not found');
      article = { id: snap.docs[0].id, ...snap.docs[0].data() };
      cache.set(cacheKey, article);
    }

    const registered = req.query.registered === '1';
    const pageDesc = (article['body_' + res.locals.lang] || '').replace(/<[^>]+>/g, '').substring(0, 160);
    res.render('pelamushi/news-item', {
      article,
      registered,
      pageTitle: article['title_' + res.locals.lang],
      pageDesc,
      ogImage: article.photo_url || '',
      adminEditUrl: `/admin/news/${article.id}`,
    });
  } catch (err) {
    next(err);
  }
});

// ── Event registration ────────────────────────────────────────────────────────
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

    const article = snap.docs[0].data();
    await col.registrations.add({
      news_id: snap.docs[0].id,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: (phone || '').trim(),
      created_at: Timestamp.now(),
    });

    const { notify } = require('../lib/pelamushi-notify');
    notify('registration', `📋 <b>Новая регистрация</b>\nСобытие: ${article.title_ru || article.title_en || req.params.slug}\nИмя: ${name.trim()}\nEmail: ${email.trim()}\nТелефон: ${(phone || '').trim() || '—'}`);
    res.redirect(`/${lang}/news/${req.params.slug}?registered=1`);
  } catch (err) {
    next(err);
  }
});

// ── Shop ──────────────────────────────────────────────────────────────────────
router.get('/:lang/shop', async (req, res, next) => {
  try {
    let data = cache.get('shop');
    if (data === undefined) {
      let shop = {}, gallery = [], shopMenus = [];
      if (col.shop) {
        const [shopDoc, gallerySnap] = await Promise.all([
          col.shop.doc('main').get(),
          col.shop_gallery.orderBy('order').get(),
        ]);
        shop = shopDoc.exists ? shopDoc.data() : {};
        gallery = gallerySnap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
      if (col.menus) {
        const menusSnap = await col.menus.where('active', '==', true).orderBy('order').get();
        shopMenus = menusSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(m => m.type === 'shop');
        if (col.items && col.categories && shopMenus.length) {
          await Promise.all(shopMenus.map(async m => {
            const [catsSnap, itemsSnap] = await Promise.all([
              col.categories.where('menu_id', '==', m.id).orderBy('order').get(),
              col.items.where('menu_id', '==', m.id).where('active', '==', true).orderBy('order').get(),
            ]);
            const cats  = catsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            const items = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            m.grouped       = cats.map(c => ({ ...c, items: items.filter(i => i.category_id === c.id) }));
            m.uncategorized = items.filter(i => !i.category_id);
          }));
        }
      }
      data = { shop, gallery, shopMenus };
      cache.set('shop', data);
    }
    res.render('pelamushi/shop', { ...data, pageTitle: res.locals.t.shop.title, adminEditUrl: '/admin/shop' });
  } catch (err) { next(err); }
});

// ── Rental ────────────────────────────────────────────────────────────────────
router.get('/:lang/rental', async (req, res, next) => {
  try {
    let data = cache.get('rental');
    if (data === undefined) {
      let rental = {}, gallery = [];
      if (col.rental) {
        const [rentalDoc, gallerySnap] = await Promise.all([
          col.rental.doc('main').get(),
          col.rental_gallery.orderBy('order').get(),
        ]);
        rental = rentalDoc.exists ? rentalDoc.data() : {};
        gallery = gallerySnap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
      data = { rental, gallery };
      cache.set('rental', data);
    }
    const booked = req.query.booked === '1';
    const utm = {
      source:   req.query.utm_source   || '',
      medium:   req.query.utm_medium   || '',
      campaign: req.query.utm_campaign || '',
      content:  req.query.utm_content  || '',
      term:     req.query.utm_term     || '',
    };
    res.render('pelamushi/rental', { ...data, booked, utm, pageTitle: res.locals.t.rental.title, adminEditUrl: '/admin/rental' });
  } catch (err) { next(err); }
});

router.post('/:lang/rental/book', async (req, res, next) => {
  try {
    const { lang } = res.locals;
    const { name, contact, date, time_slot, message,
            utm_source, utm_medium, utm_campaign, utm_content, utm_term } = req.body;
    if (!name || !contact || !date || !time_slot) {
      return res.redirect(`/${lang}/rental?error=missing`);
    }
    if (col.rental_requests) {
      await col.rental_requests.add({
        name: name.trim(), contact: contact.trim(),
        date, time_slot,
        message: (message || '').trim(),
        utm_source: utm_source || '', utm_medium: utm_medium || '',
        utm_campaign: utm_campaign || '', utm_content: utm_content || '',
        utm_term: utm_term || '',
        status: 'new',
        lang,
        created_at: Timestamp.now(),
      });
    }
    const { notify } = require('../lib/pelamushi-notify');
    notify('rental', `🏠 <b>Новая заявка на аренду</b>\nИмя: ${name.trim()}\nКонтакт: ${contact.trim()}\nДата: ${date}, ${time_slot}${message ? '\nСообщение: ' + message.trim() : ''}`);
    res.redirect(`/${lang}/rental?booked=1`);
  } catch (err) { next(err); }
});

// ── Bar ───────────────────────────────────────────────────────────────────────
router.get('/:lang/bar', async (req, res, next) => {
  try {
    let data = cache.get('bar');
    if (data === undefined) {
      let bar = {}, gallery = [], barMenus = [];
      if (col.bar) {
        const [barDoc, gallerySnap] = await Promise.all([
          col.bar.doc('main').get(),
          col.bar_gallery.orderBy('order').get(),
        ]);
        bar = barDoc.exists ? barDoc.data() : {};
        gallery = gallerySnap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
      if (col.menus) {
        const menusSnap = await col.menus.where('active', '==', true).orderBy('order').get();
        barMenus = menusSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(m => m.type === 'bar');
        if (col.items && col.categories && barMenus.length) {
          await Promise.all(barMenus.map(async m => {
            const [catsSnap, itemsSnap] = await Promise.all([
              col.categories.where('menu_id', '==', m.id).orderBy('order').get(),
              col.items.where('menu_id', '==', m.id).where('active', '==', true).orderBy('order').get(),
            ]);
            const cats  = catsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            const items = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            m.grouped       = cats.map(c => ({ ...c, items: items.filter(i => i.category_id === c.id) }));
            m.uncategorized = items.filter(i => !i.category_id);
          }));
        }
      }
      data = { bar, gallery, barMenus };
      cache.set('bar', data);
    }
    res.render('pelamushi/bar', { ...data, pageTitle: res.locals.t.bar.title, adminEditUrl: '/admin/bar' });
  } catch (err) { next(err); }
});

module.exports = router;
