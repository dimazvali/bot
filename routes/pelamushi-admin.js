const express = require('express');
const fileUpload = require('express-fileupload');
const router = express.Router();
const { col } = require('../lib/pelamushi-firebase');
const { requireAdmin, cookieToken } = require('../lib/pelamushi-auth');
const cache = require('../lib/pelamushi-cache');

router.use(fileUpload());

// Login — no auth required
router.get('/login', (req, res) => {
  res.render('pelamushi/admin/login', { error: req.query.err || null });
});

router.post('/login', async (req, res, next) => {
  try {
    const envPassword = process.env.PELAMUSHI_ADMIN_PASSWORD;
    const input = req.body.password || '';
    const hash = cookieToken(input);
    const setCookie = (val) => res.cookie('pelamushi_admin', val, { httpOnly: true, maxAge: 7 * 24 * 3600 * 1000, sameSite: 'strict' });

    // Dev mode
    if (!envPassword) {
      setCookie('dev');
      return res.redirect('/admin');
    }
    // Env-var admin
    if (input === envPassword) {
      setCookie(hash);
      return res.redirect('/admin');
    }
    // Firestore admins
    if (col.admins) {
      const snap = await col.admins.where('password_hash', '==', hash).limit(1).get();
      if (!snap.empty) {
        setCookie(hash);
        return res.redirect('/admin');
      }
    }
    res.redirect('/admin/login?err=wrong');
  } catch (err) { next(err); }
});

router.get('/logout', (req, res) => {
  res.clearCookie('pelamushi_admin');
  res.redirect('/admin/login');
});

// All routes below require admin session
router.use(requireAdmin);

// Flush public cache after any mutating request
router.use((req, res, next) => {
  if (req.method !== 'GET') {
    const orig = res.redirect.bind(res);
    res.redirect = (...args) => { cache.flush(); return orig(...args); };
  }
  next();
});

// Dashboard
router.get('/', async (req, res, next) => {
  try {
    const stats = { menus: 0, news: 0, registrations: 0, team: 0 };
    if (col.menus) {
      const [m, n, r, t] = await Promise.all([
        col.menus.get(),
        col.news.get(),
        col.registrations.get(),
        col.team.get(),
      ]);
      stats.menus = m.size;
      stats.news  = n.size;
      stats.registrations = r.size;
      stats.team  = t.size;
    }
    res.render('pelamushi/admin/dashboard', { title: 'Dashboard', stats });
  } catch (err) {
    next(err);
  }
});

// ── About ────────────────────────────────────────────────────────────────────
router.get('/about', async (req, res, next) => {
  try {
    let about = {}, team = [], gallery = [];
    if (col.about) {
      const [aboutDoc, teamSnap, gallerySnap] = await Promise.all([
        col.about.doc('main').get(),
        col.team.orderBy('order').get(),
        col.gallery.orderBy('order').get(),
      ]);
      about = aboutDoc.exists ? aboutDoc.data() : {};
      team = teamSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      gallery = gallerySnap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    res.render('pelamushi/admin/about', {
      title: 'About',
      about,
      team,
      gallery,
      saved: req.query.saved === '1',
    });
  } catch (err) { next(err); }
});

router.post('/about/social', async (req, res, next) => {
  try {
    const { facebook_url, instagram_url, maps_url, phone, whatsapp } = req.body;
    if (col.about) {
      await col.about.doc('main').set(
        { facebook_url: facebook_url || '', instagram_url: instagram_url || '', maps_url: maps_url || '', phone: phone || '', whatsapp: whatsapp || '' },
        { merge: true }
      );
    }
    res.redirect('/admin/about?saved=1');
  } catch (err) { next(err); }
});

router.post('/about/quote', async (req, res, next) => {
  try {
    const { quote_en, quote_ka, quote_ru } = req.body;
    if (col.about) {
      await col.about.doc('main').set(
        { quote_en: quote_en || '', quote_ka: quote_ka || '', quote_ru: quote_ru || '' },
        { merge: true }
      );
    }
    res.redirect('/admin/about?saved=1');
  } catch (err) { next(err); }
});

router.post('/about/home-hero', async (req, res, next) => {
  try {
    if (!req.files || !req.files.photo) return res.redirect('/admin/about');
    const { uploadHeroPhoto } = require('../lib/pelamushi-upload');
    const { hero_url, hero_url_sm } = await uploadHeroPhoto(req.files.photo.data);
    if (col.about) await col.about.doc('main').set({ home_hero_url: hero_url, home_hero_url_sm: hero_url_sm }, { merge: true });
    res.redirect('/admin/about?saved=1');
  } catch (err) { next(err); }
});

router.post('/about/hero', async (req, res, next) => {
  try {
    if (!req.files || !req.files.photo) return res.redirect('/admin/about');
    const { uploadHeroPhoto } = require('../lib/pelamushi-upload');
    const urls = await uploadHeroPhoto(req.files.photo.data);
    if (col.about) await col.about.doc('main').set(urls, { merge: true });
    res.redirect('/admin/about?saved=1');
  } catch (err) { next(err); }
});

router.post('/about/icon', async (req, res, next) => {
  try {
    if (!req.files || !req.files.photo) return res.redirect('/admin/about');
    const { uploadIconPhoto } = require('../lib/pelamushi-upload');
    const file = Array.isArray(req.files.photo) ? req.files.photo[0] : req.files.photo;
    const url = await uploadIconPhoto(file.data, 'about');
    if (col.about) await col.about.doc('main').set({ icon_url: url }, { merge: true });
    res.redirect('/admin/about?saved=1');
  } catch (err) { next(err); }
});

router.post('/about/mission', async (req, res, next) => {
  try {
    const { mission_en, mission_ka, mission_ru } = req.body;
    if (col.about) {
      await col.about.doc('main').set(
        { mission_en: mission_en || '', mission_ka: mission_ka || '', mission_ru: mission_ru || '', updated_at: new Date() },
        { merge: true }
      );
    }
    res.redirect('/admin/about?saved=1');
  } catch (err) { next(err); }
});

router.post('/about/gallery/update', async (req, res, next) => {
  try {
    const raw = req.body.photos || {};
    const photos = Array.isArray(raw) ? raw : Object.values(raw);
    if (col.gallery) {
      await Promise.all(photos.map(p =>
        col.gallery.doc(p.id).update({
          order: parseInt(p.order) || 0,
          caption_en: p.caption_en || '',
          caption_ka: p.caption_ka || '',
          caption_ru: p.caption_ru || '',
        })
      ));
    }
    res.redirect('/admin/about?saved=1');
  } catch (err) { next(err); }
});

router.post('/about/gallery/add', async (req, res, next) => {
  try {
    if (!req.files || !req.files.photo) return res.redirect('/admin/about');
    const { uploadPhoto } = require('../lib/pelamushi-upload');
    const files = Array.isArray(req.files.photo) ? req.files.photo : [req.files.photo];
    if (col.gallery) {
      const snap = await col.gallery.orderBy('order', 'desc').limit(1).get();
      let nextOrder = snap.empty ? 0 : snap.docs[0].data().order + 1;
      for (const file of files) {
        const url = await uploadPhoto(file.data, file.name, 'gallery', 'gallery');
        await col.gallery.add({ photo_url: url, caption_en: '', caption_ka: '', caption_ru: '', order: nextOrder++ });
      }
    }
    res.redirect('/admin/about');
  } catch (err) { next(err); }
});

router.post('/about/gallery/:id/delete', async (req, res, next) => {
  try {
    if (col.gallery) await col.gallery.doc(req.params.id).delete();
    res.redirect('/admin/about');
  } catch (err) { next(err); }
});

router.post('/about/team/add', async (req, res, next) => {
  try {
    const { name, role_en, role_ka, role_ru } = req.body;
    let photo_url = '';
    if (req.files && req.files.photo) {
      const { uploadPhoto } = require('../lib/pelamushi-upload');
      photo_url = await uploadPhoto(req.files.photo.data, req.files.photo.name, 'team', 'avatar');
    }
    if (col.team) {
      const snap = await col.team.orderBy('order', 'desc').limit(1).get();
      const nextOrder = snap.empty ? 0 : snap.docs[0].data().order + 1;
      await col.team.add({ name: name || '', role_en: role_en || '', role_ka: role_ka || '', role_ru: role_ru || '', photo_url, order: nextOrder, active: true });
    }
    res.redirect('/admin/about');
  } catch (err) { next(err); }
});

router.get('/about/team/:id', async (req, res, next) => {
  try {
    let member = { id: req.params.id };
    if (col.team) {
      const doc = await col.team.doc(req.params.id).get();
      if (doc.exists) member = { id: doc.id, ...doc.data() };
    }
    res.render('pelamushi/admin/team-edit', { title: member.name || 'Участник', member, saved: !!req.query.saved });
  } catch (err) { next(err); }
});

router.post('/about/team/:id/save', async (req, res, next) => {
  try {
    const { name, role_en, role_ka, role_ru } = req.body;
    if (col.team) {
      await col.team.doc(req.params.id).update({
        name: name || '',
        role_en: role_en || '',
        role_ka: role_ka || '',
        role_ru: role_ru || '',
      });
    }
    res.redirect(`/admin/about/team/${req.params.id}?saved=1`);
  } catch (err) { next(err); }
});

router.post('/about/team/:id/photo', async (req, res, next) => {
  try {
    if (!req.files || !req.files.photo) return res.redirect(`/admin/about/team/${req.params.id}`);
    const { uploadPhoto } = require('../lib/pelamushi-upload');
    const url = await uploadPhoto(req.files.photo.data, req.files.photo.name, 'team', 'avatar');
    if (col.team) await col.team.doc(req.params.id).update({ photo_url: url });
    res.redirect(`/admin/about/team/${req.params.id}?saved=1`);
  } catch (err) { next(err); }
});

router.post('/about/team/:id/delete', async (req, res, next) => {
  try {
    if (col.team) await col.team.doc(req.params.id).delete();
    res.redirect('/admin/about');
  } catch (err) { next(err); }
});

// ── Menus ────────────────────────────────────────────────────────────────────
router.get('/menus', async (req, res, next) => {
  try {
    let menus = [], site = {};
    if (col.menus) {
      const [menusSnap, siteDoc] = await Promise.all([
        col.menus.orderBy('order').get(),
        col.about ? col.about.doc('main').get() : Promise.resolve({ exists: false }),
      ]);
      menus = menusSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (siteDoc.exists) site = siteDoc.data();
    }
    res.render('pelamushi/admin/menus', { title: 'Menus', menus, site, saved: !!req.query.saved });
  } catch (err) { next(err); }
});

router.post('/menus/new', async (req, res, next) => {
  try {
    const { name_en, name_ka, name_ru, desc_en, desc_ka, desc_ru, slug, type } = req.body;
    if (col.menus) {
      const snap = await col.menus.orderBy('order', 'desc').limit(1).get();
      const nextOrder = snap.empty ? 0 : snap.docs[0].data().order + 1;
      await col.menus.add({
        name_en: name_en || '', name_ka: name_ka || '', name_ru: name_ru || '',
        desc_en: desc_en || '', desc_ka: desc_ka || '', desc_ru: desc_ru || '',
        slug: slug || '', type: type || 'permanent',
        active: true, order: nextOrder, created_at: new Date(),
      });
    }
    res.redirect('/admin/menus');
  } catch (err) { next(err); }
});

router.post('/menus/hero', async (req, res, next) => {
  try {
    if (!req.files || !req.files.photo) return res.redirect('/admin/menus');
    const { uploadPhoto } = require('../lib/pelamushi-upload');
    const file = Array.isArray(req.files.photo) ? req.files.photo[0] : req.files.photo;
    const url = await uploadPhoto(file.data, file.name, 'menu-hero', 'cover');
    if (col.about) await col.about.doc('main').set({ menu_hero_url: url }, { merge: true });
    res.redirect('/admin/menus?saved=1');
  } catch (err) { next(err); }
});

router.post('/menus/icon', async (req, res, next) => {
  try {
    if (!req.files || !req.files.photo) return res.redirect('/admin/menus');
    const { uploadIconPhoto } = require('../lib/pelamushi-upload');
    const file = Array.isArray(req.files.photo) ? req.files.photo[0] : req.files.photo;
    const url = await uploadIconPhoto(file.data, 'menus');
    if (col.about) await col.about.doc('main').set({ menu_icon_url: url }, { merge: true });
    res.redirect('/admin/menus?saved=1');
  } catch (err) { next(err); }
});

router.get('/menus/:id', async (req, res, next) => {
  try {
    if (!col.menus) return res.render('pelamushi/admin/menu-edit', { title: 'Edit Menu', menu: {}, categories: [], items: [], saved: false });
    const [menuDoc, catsSnap, itemsSnap] = await Promise.all([
      col.menus.doc(req.params.id).get(),
      col.categories.where('menu_id', '==', req.params.id).orderBy('order').get(),
      col.items.where('menu_id', '==', req.params.id).orderBy('order').get(),
    ]);
    if (!menuDoc.exists) return res.status(404).send('Not found');
    res.render('pelamushi/admin/menu-edit', {
      title: 'Edit Menu',
      menu: { id: menuDoc.id, ...menuDoc.data() },
      categories: catsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      items: itemsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      saved: req.query.saved === '1',
    });
  } catch (err) { next(err); }
});

router.post('/menus/:id/cover', async (req, res, next) => {
  try {
    if (!req.files || !req.files.photo) return res.redirect(`/admin/menus/${req.params.id}`);
    const { uploadPhoto } = require('../lib/pelamushi-upload');
    const url = await uploadPhoto(req.files.photo.data, req.files.photo.name, 'menus', 'cover');
    if (col.menus) await col.menus.doc(req.params.id).update({ cover_url: url });
    res.redirect(`/admin/menus/${req.params.id}?saved=1`);
  } catch (err) { next(err); }
});

router.post('/menus/:id/icon', async (req, res, next) => {
  try {
    if (!req.files || !req.files.photo) return res.redirect(`/admin/menus/${req.params.id}`);
    const { uploadIconPhoto } = require('../lib/pelamushi-upload');
    const file = Array.isArray(req.files.photo) ? req.files.photo[0] : req.files.photo;
    const url = await uploadIconPhoto(file.data, 'menus');
    if (col.menus) await col.menus.doc(req.params.id).update({ icon_url: url });
    res.redirect(`/admin/menus/${req.params.id}?saved=1`);
  } catch (err) { next(err); }
});

router.post('/menus/:id/save', async (req, res, next) => {
  try {
    const { name_en, name_ka, name_ru, desc_en, desc_ka, desc_ru, slug, type, active } = req.body;
    if (col.menus) {
      await col.menus.doc(req.params.id).update({
        name_en: name_en || '', name_ka: name_ka || '', name_ru: name_ru || '',
        desc_en: desc_en || '', desc_ka: desc_ka || '', desc_ru: desc_ru || '',
        slug: slug || '', type: type || 'permanent',
        active: active === 'on',
        updated_at: new Date(),
      });
    }
    res.redirect(`/admin/menus/${req.params.id}?saved=1`);
  } catch (err) { next(err); }
});

router.post('/menus/:id/delete', async (req, res, next) => {
  try {
    if (col.menus) await col.menus.doc(req.params.id).delete();
    res.redirect('/admin/menus');
  } catch (err) { next(err); }
});

router.post('/menus/:id/categories/add', async (req, res, next) => {
  try {
    const { name_en, name_ka, name_ru } = req.body;
    const { desc_en, desc_ka, desc_ru } = req.body;
    if (col.categories) {
      const snap = await col.categories.where('menu_id', '==', req.params.id).orderBy('order', 'desc').limit(1).get();
      const nextOrder = snap.empty ? 0 : snap.docs[0].data().order + 1;
      await col.categories.add({
        menu_id: req.params.id,
        name_en: name_en || '', name_ka: name_ka || '', name_ru: name_ru || '',
        desc_en: desc_en || '', desc_ka: desc_ka || '', desc_ru: desc_ru || '',
        order: nextOrder,
      });
    }
    res.redirect(`/admin/menus/${req.params.id}`);
  } catch (err) { next(err); }
});

router.get('/menus/:id/categories/:catId/edit', async (req, res, next) => {
  try {
    if (!col.categories) return res.redirect(`/admin/menus/${req.params.id}`);
    const doc = await col.categories.doc(req.params.catId).get();
    if (!doc.exists) return res.status(404).send('Not found');
    res.render('pelamushi/admin/menu-category-edit', {
      title: 'Редактировать категорию',
      menuId: req.params.id,
      cat: { id: doc.id, ...doc.data() },
      saved: req.query.saved === '1',
    });
  } catch (err) { next(err); }
});

router.post('/menus/:id/categories/:catId/save', async (req, res, next) => {
  try {
    const { name_en, name_ka, name_ru, desc_en, desc_ka, desc_ru, order } = req.body;
    if (col.categories) {
      await col.categories.doc(req.params.catId).update({
        name_en: name_en || '',
        name_ka: name_ka || '',
        name_ru: name_ru || '',
        desc_en: desc_en || '',
        desc_ka: desc_ka || '',
        desc_ru: desc_ru || '',
        order: parseInt(order) || 0,
      });
    }
    res.redirect(`/admin/menus/${req.params.id}/categories/${req.params.catId}/edit?saved=1`);
  } catch (err) { next(err); }
});

router.post('/menus/:id/categories/:catId/delete', async (req, res, next) => {
  try {
    if (col.categories) await col.categories.doc(req.params.catId).delete();
    res.redirect(`/admin/menus/${req.params.id}`);
  } catch (err) { next(err); }
});

router.post('/menus/:id/items/add', async (req, res, next) => {
  try {
    const { name_en, name_ka, name_ru, desc_en, desc_ka, desc_ru, price, category_id, tags } = req.body;
    let photo_url = '';
    if (req.files && req.files.photo) {
      const { uploadPhoto } = require('../lib/pelamushi-upload');
      photo_url = await uploadPhoto(req.files.photo.data, req.files.photo.name, 'menu-items', 'item');
    }
    if (!photo_url) {
      const label = encodeURIComponent(req.body.name_en || req.body.name_ru || 'Item');
      photo_url = `https://placehold.co/400x300/1C2E4A/F3ECE0?text=${label}`;
    }
    if (col.items) {
      const snap = await col.items.where('menu_id', '==', req.params.id).orderBy('order', 'desc').limit(1).get();
      const nextOrder = snap.empty ? 0 : snap.docs[0].data().order + 1;
      const tagsArr = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];
      await col.items.add({
        menu_id: req.params.id,
        category_id: category_id || null,
        name_en: name_en || '', name_ka: name_ka || '', name_ru: name_ru || '',
        desc_en: desc_en || '', desc_ka: desc_ka || '', desc_ru: desc_ru || '',
        price: parseFloat(price) || 0,
        tags: tagsArr,
        photo_url,
        active: true,
        order: nextOrder,
      });
    }
    res.redirect(`/admin/menus/${req.params.id}`);
  } catch (err) { next(err); }
});

router.get('/menus/:id/items/:itemId/edit', async (req, res, next) => {
  try {
    if (!col.items) return res.redirect(`/admin/menus/${req.params.id}`);
    const [itemDoc, catsSnap] = await Promise.all([
      col.items.doc(req.params.itemId).get(),
      col.categories.where('menu_id', '==', req.params.id).orderBy('order').get(),
    ]);
    if (!itemDoc.exists) return res.status(404).send('Not found');
    res.render('pelamushi/admin/menu-item-edit', {
      title: 'Редактировать позицию',
      menuId: req.params.id,
      item: { id: itemDoc.id, ...itemDoc.data() },
      categories: catsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      saved: req.query.saved === '1',
    });
  } catch (err) { next(err); }
});

router.post('/menus/:id/items/:itemId/save', async (req, res, next) => {
  try {
    const { name_en, name_ka, name_ru, desc_en, desc_ka, desc_ru, price, category_id, tags, active, order } = req.body;
    const update = {
      name_en: name_en || '', name_ka: name_ka || '', name_ru: name_ru || '',
      desc_en: desc_en || '', desc_ka: desc_ka || '', desc_ru: desc_ru || '',
      price: parseFloat(price) || 0,
      category_id: category_id || null,
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      active: active === 'on',
      order: parseInt(order) || 0,
      updated_at: new Date(),
    };
    if (req.files && req.files.photo) {
      const { uploadPhoto } = require('../lib/pelamushi-upload');
      update.photo_url = await uploadPhoto(req.files.photo.data, req.files.photo.name, 'menu-items', 'item');
    }
    if (col.items) await col.items.doc(req.params.itemId).update(update);
    res.redirect(`/admin/menus/${req.params.id}/items/${req.params.itemId}/edit?saved=1`);
  } catch (err) { next(err); }
});

router.post('/menus/:id/items/:itemId/delete', async (req, res, next) => {
  try {
    if (col.items) await col.items.doc(req.params.itemId).delete();
    res.redirect(`/admin/menus/${req.params.id}`);
  } catch (err) { next(err); }
});

// ── News ─────────────────────────────────────────────────────────────────────
router.get('/news', async (req, res, next) => {
  try {
    let articles = [], site = {};
    if (col.news) {
      const [snap, siteDoc] = await Promise.all([
        col.news.orderBy('published_at', 'desc').limit(50).get(),
        col.about ? col.about.doc('main').get() : Promise.resolve({ exists: false }),
      ]);
      articles = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (siteDoc.exists) site = siteDoc.data();
    }
    res.render('pelamushi/admin/news', { title: 'News', articles, site, saved: !!req.query.saved });
  } catch (err) { next(err); }
});

router.post('/news/new', async (req, res, next) => {
  try {
    const { title_en, title_ka, title_ru, slug } = req.body;
    if (col.news) {
      const { Timestamp } = require('../lib/pelamushi-firebase');
      const ref = await col.news.add({
        title_en: title_en || '', title_ka: title_ka || '', title_ru: title_ru || '',
        body_en: '', body_ka: '', body_ru: '',
        slug: slug || '',
        author: '',
        photo_url: '',
        registration_enabled: false,
        event_date: null,
        published_at: Timestamp.now(),
      });
      return res.redirect(`/admin/news/${ref.id}`);
    }
    res.redirect('/admin/news');
  } catch (err) { next(err); }
});

router.post('/news/hero', async (req, res, next) => {
  try {
    if (!req.files || !req.files.photo) return res.redirect('/admin/news');
    const { uploadPhoto } = require('../lib/pelamushi-upload');
    const file = Array.isArray(req.files.photo) ? req.files.photo[0] : req.files.photo;
    const url = await uploadPhoto(file.data, file.name, 'news-hero', 'cover');
    if (col.about) await col.about.doc('main').set({ news_hero_url: url }, { merge: true });
    res.redirect('/admin/news?saved=1');
  } catch (err) { next(err); }
});

router.post('/news/icon', async (req, res, next) => {
  try {
    if (!req.files || !req.files.photo) return res.redirect('/admin/news');
    const { uploadIconPhoto } = require('../lib/pelamushi-upload');
    const file = Array.isArray(req.files.photo) ? req.files.photo[0] : req.files.photo;
    const url = await uploadIconPhoto(file.data, 'news');
    if (col.about) await col.about.doc('main').set({ news_icon_url: url }, { merge: true });
    res.redirect('/admin/news?saved=1');
  } catch (err) { next(err); }
});

router.get('/news/registrations', async (req, res, next) => {
  try {
    let registrations = [], newsMap = {};
    if (col.registrations) {
      const [regSnap, newsSnap] = await Promise.all([
        col.registrations.orderBy('created_at', 'desc').get(),
        col.news ? col.news.get() : Promise.resolve({ docs: [] }),
      ]);
      newsSnap.docs.forEach(d => { newsMap[d.id] = d.data(); });
      registrations = regSnap.docs.map(d => {
        const r = { id: d.id, ...d.data() };
        r.event = newsMap[r.news_id] || null;
        return r;
      });
    }
    res.render('pelamushi/admin/news-registrations', { title: 'Заявки', registrations });
  } catch (err) { next(err); }
});

router.get('/news/:id', async (req, res, next) => {
  try {
    let article = {};
    if (col.news) {
      const doc = await col.news.doc(req.params.id).get();
      if (!doc.exists) return res.status(404).send('Not found');
      article = { id: doc.id, ...doc.data() };
    }
    res.render('pelamushi/admin/news-edit', {
      title: 'Edit Article',
      article,
      saved: req.query.saved === '1',
    });
  } catch (err) { next(err); }
});

router.post('/news/:id/save', async (req, res, next) => {
  try {
    const { title_en, title_ka, title_ru, body_en, body_ka, body_ru, slug, author, registration_enabled, event_date } = req.body;
    const update = {
      title_en: title_en || '', title_ka: title_ka || '', title_ru: title_ru || '',
      body_en: body_en || '', body_ka: body_ka || '', body_ru: body_ru || '',
      slug: slug || '',
      author: author || '',
      registration_enabled: registration_enabled === 'on',
      updated_at: new Date(),
    };
    if (event_date) {
      update.event_date = new Date(event_date);
    } else {
      update.event_date = null;
    }
    if (req.files && req.files.photo) {
      const { uploadPhoto } = require('../lib/pelamushi-upload');
      update.photo_url = await uploadPhoto(req.files.photo.data, req.files.photo.name, 'news', 'cover');
    }
    if (col.news) await col.news.doc(req.params.id).update(update);
    res.redirect(`/admin/news/${req.params.id}?saved=1`);
  } catch (err) { next(err); }
});

router.post('/news/:id/delete', async (req, res, next) => {
  try {
    if (col.news) await col.news.doc(req.params.id).delete();
    res.redirect('/admin/news');
  } catch (err) { next(err); }
});

// ── Registrations ────────────────────────────────────────────────────────────
router.get('/registrations', async (req, res, next) => {
  try {
    let regs = [], newsMap = {};
    if (col.registrations) {
      const [regsSnap, newsSnap] = await Promise.all([
        col.registrations.orderBy('created_at', 'desc').limit(200).get(),
        col.news.get(),
      ]);
      newsMap = Object.fromEntries(newsSnap.docs.map(d => [d.id, d.data().title_en || d.id]));
      regs = regsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    res.render('pelamushi/admin/registrations', { title: 'Заявки', regs, newsMap });
  } catch (err) { next(err); }
});

router.get('/registrations/export.csv', async (req, res, next) => {
  try {
    if (!col.registrations) return res.status(503).send('Unavailable');
    const snap = await col.registrations.orderBy('created_at', 'desc').get();
    const rows = snap.docs.map(d => {
      const r = d.data();
      const date = r.created_at ? r.created_at.toDate().toISOString() : '';
      return [r.news_id, r.name, r.email, r.phone, date].map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',');
    });
    const csv = 'news_id,name,email,phone,created_at\n' + rows.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="registrations.csv"');
    res.send(csv);
  } catch (err) { next(err); }
});

// ── Rental ────────────────────────────────────────────────────────────────────
router.get('/rental', async (req, res, next) => {
  try {
    let rental = {}, gallery = [];
    if (col.rental) {
      const [rentalDoc, gallerySnap] = await Promise.all([
        col.rental.doc('main').get(),
        col.rental_gallery.orderBy('order').get(),
      ]);
      rental = rentalDoc.exists ? rentalDoc.data() : {};
      gallery = gallerySnap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    res.render('pelamushi/admin/rental', { title: 'Rental', rental, gallery, saved: req.query.saved === '1' });
  } catch (err) { next(err); }
});

router.post('/rental/save', async (req, res, next) => {
  try {
    const { title_en, title_ka, title_ru, text_en, text_ka, text_ru } = req.body;
    if (col.rental) {
      await col.rental.doc('main').set(
        { title_en: title_en || '', title_ka: title_ka || '', title_ru: title_ru || '',
          text_en: text_en || '', text_ka: text_ka || '', text_ru: text_ru || '',
          updated_at: new Date() },
        { merge: true }
      );
    }
    res.redirect('/admin/rental?saved=1');
  } catch (err) { next(err); }
});

router.post('/rental/hero/save', async (req, res, next) => {
  try {
    if (!req.files || !req.files.photo) return res.redirect('/admin/rental');
    const { uploadPhoto } = require('../lib/pelamushi-upload');
    const file = Array.isArray(req.files.photo) ? req.files.photo[0] : req.files.photo;
    const url = await uploadPhoto(file.data, file.name, 'rental-hero', 'rental');
    if (col.rental) await col.rental.doc('main').set({ hero_url: url }, { merge: true });
    res.redirect('/admin/rental?saved=1');
  } catch (err) { next(err); }
});

router.post('/rental/icon/save', async (req, res, next) => {
  try {
    if (!req.files || !req.files.photo) return res.redirect('/admin/rental');
    const { uploadIconPhoto } = require('../lib/pelamushi-upload');
    const file = Array.isArray(req.files.photo) ? req.files.photo[0] : req.files.photo;
    const url = await uploadIconPhoto(file.data, 'rental');
    if (col.rental) await col.rental.doc('main').set({ icon_url: url }, { merge: true });
    res.redirect('/admin/rental?saved=1');
  } catch (err) { next(err); }
});

router.post('/rental/gallery/update', async (req, res, next) => {
  try {
    const raw = req.body.photos || {};
    const photos = Array.isArray(raw) ? raw : Object.values(raw);
    if (col.rental_gallery) {
      await Promise.all(photos.map(p =>
        col.rental_gallery.doc(p.id).update({
          order: parseInt(p.order) || 0,
          caption_en: p.caption_en || '',
          caption_ka: p.caption_ka || '',
          caption_ru: p.caption_ru || '',
        })
      ));
    }
    res.redirect('/admin/rental?saved=1');
  } catch (err) { next(err); }
});

router.post('/rental/gallery/add', async (req, res, next) => {
  try {
    if (!req.files || !req.files.photo) return res.redirect('/admin/rental');
    const { uploadPhoto } = require('../lib/pelamushi-upload');
    const files = Array.isArray(req.files.photo) ? req.files.photo : [req.files.photo];
    if (col.rental_gallery) {
      const snap = await col.rental_gallery.orderBy('order', 'desc').limit(1).get();
      let nextOrder = snap.empty ? 0 : snap.docs[0].data().order + 1;
      for (const file of files) {
        const url = await uploadPhoto(file.data, file.name, 'rental-gallery', 'rental');
        await col.rental_gallery.add({ photo_url: url, order: nextOrder++ });
      }
    }
    res.redirect('/admin/rental');
  } catch (err) { next(err); }
});

router.post('/rental/gallery/:id/delete', async (req, res, next) => {
  try {
    if (col.rental_gallery) await col.rental_gallery.doc(req.params.id).delete();
    res.redirect('/admin/rental');
  } catch (err) { next(err); }
});

router.get('/rental/requests', async (req, res, next) => {
  try {
    const VALID = ['new', 'working', 'cancelled', 'done'];
    const statusFilter = VALID.includes(req.query.status) ? req.query.status : '';
    let requests = [];
    if (col.rental_requests) {
      let q = col.rental_requests.orderBy('created_at', 'desc').limit(200);
      if (statusFilter) q = col.rental_requests.where('status', '==', statusFilter).orderBy('created_at', 'desc').limit(200);
      const snap = await q.get();
      requests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    res.render('pelamushi/admin/rental-requests', { title: 'Rental Requests', requests, statusFilter, saved: req.query.saved === '1' });
  } catch (err) { next(err); }
});

router.post('/rental/requests/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['new', 'working', 'cancelled', 'done'].includes(status)) return res.redirect('/admin/rental/requests');
    if (col.rental_requests) await col.rental_requests.doc(req.params.id).update({ status });
    res.redirect('/admin/rental/requests?saved=1');
  } catch (err) { next(err); }
});

// ── Bar ───────────────────────────────────────────────────────────────────────
router.get('/bar', async (req, res, next) => {
  try {
    let bar = {}, gallery = [];
    if (col.bar) {
      const [barDoc, gallerySnap] = await Promise.all([
        col.bar.doc('main').get(),
        col.bar_gallery.orderBy('order').get(),
      ]);
      bar = barDoc.exists ? barDoc.data() : {};
      gallery = gallerySnap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    res.render('pelamushi/admin/bar', { title: 'Bar', bar, gallery, saved: req.query.saved === '1' });
  } catch (err) { next(err); }
});

router.post('/bar/save', async (req, res, next) => {
  try {
    const { title_en, title_ka, title_ru, desc_en, desc_ka, desc_ru } = req.body;
    if (col.bar) {
      await col.bar.doc('main').set(
        { title_en: title_en || '', title_ka: title_ka || '', title_ru: title_ru || '',
          desc_en: desc_en || '', desc_ka: desc_ka || '', desc_ru: desc_ru || '',
          updated_at: new Date() },
        { merge: true }
      );
    }
    res.redirect('/admin/bar?saved=1');
  } catch (err) { next(err); }
});

router.post('/bar/hero/save', async (req, res, next) => {
  try {
    if (!req.files || !req.files.photo) return res.redirect('/admin/bar');
    const { uploadPhoto } = require('../lib/pelamushi-upload');
    const file = Array.isArray(req.files.photo) ? req.files.photo[0] : req.files.photo;
    const url = await uploadPhoto(file.data, file.name, 'bar-hero', 'bar');
    if (col.bar) await col.bar.doc('main').set({ hero_url: url }, { merge: true });
    res.redirect('/admin/bar?saved=1');
  } catch (err) { next(err); }
});

router.post('/bar/icon/save', async (req, res, next) => {
  try {
    if (!req.files || !req.files.photo) return res.redirect('/admin/bar');
    const { uploadIconPhoto } = require('../lib/pelamushi-upload');
    const file = Array.isArray(req.files.photo) ? req.files.photo[0] : req.files.photo;
    const url = await uploadIconPhoto(file.data, 'bar');
    if (col.bar) await col.bar.doc('main').set({ icon_url: url }, { merge: true });
    res.redirect('/admin/bar?saved=1');
  } catch (err) { next(err); }
});

router.post('/bar/gallery/update', async (req, res, next) => {
  try {
    const raw = req.body.photos || {};
    const photos = Array.isArray(raw) ? raw : Object.values(raw);
    if (col.bar_gallery) {
      await Promise.all(photos.map(p =>
        col.bar_gallery.doc(p.id).update({
          order: parseInt(p.order) || 0,
          caption_en: p.caption_en || '',
          caption_ka: p.caption_ka || '',
          caption_ru: p.caption_ru || '',
        })
      ));
    }
    res.redirect('/admin/bar?saved=1');
  } catch (err) { next(err); }
});

router.post('/bar/gallery/add', async (req, res, next) => {
  try {
    if (!req.files || !req.files.photo) return res.redirect('/admin/bar');
    const { uploadPhoto } = require('../lib/pelamushi-upload');
    const files = Array.isArray(req.files.photo) ? req.files.photo : [req.files.photo];
    if (col.bar_gallery) {
      const snap = await col.bar_gallery.orderBy('order', 'desc').limit(1).get();
      let nextOrder = snap.empty ? 0 : snap.docs[0].data().order + 1;
      for (const file of files) {
        const url = await uploadPhoto(file.data, file.name, 'bar-gallery', 'bar');
        await col.bar_gallery.add({ photo_url: url, order: nextOrder++ });
      }
    }
    res.redirect('/admin/bar');
  } catch (err) { next(err); }
});

router.post('/bar/gallery/:id/delete', async (req, res, next) => {
  try {
    if (col.bar_gallery) await col.bar_gallery.doc(req.params.id).delete();
    res.redirect('/admin/bar');
  } catch (err) { next(err); }
});

// ── Shop ──────────────────────────────────────────────────────────────────────
router.get('/shop', async (req, res, next) => {
  try {
    let shop = {}, gallery = [];
    if (col.shop) {
      const [shopDoc, gallerySnap] = await Promise.all([
        col.shop.doc('main').get(),
        col.shop_gallery.orderBy('order').get(),
      ]);
      shop = shopDoc.exists ? shopDoc.data() : {};
      gallery = gallerySnap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    res.render('pelamushi/admin/shop', { title: 'Shop', shop, gallery, saved: req.query.saved === '1' });
  } catch (err) { next(err); }
});

router.post('/shop/save', async (req, res, next) => {
  try {
    const { title_en, title_ka, title_ru, desc_en, desc_ka, desc_ru } = req.body;
    if (col.shop) {
      await col.shop.doc('main').set(
        { title_en: title_en || '', title_ka: title_ka || '', title_ru: title_ru || '',
          desc_en: desc_en || '', desc_ka: desc_ka || '', desc_ru: desc_ru || '',
          updated_at: new Date() },
        { merge: true }
      );
    }
    res.redirect('/admin/shop?saved=1');
  } catch (err) { next(err); }
});

router.post('/shop/hero/save', async (req, res, next) => {
  try {
    if (!req.files || !req.files.photo) return res.redirect('/admin/shop');
    const { uploadPhoto } = require('../lib/pelamushi-upload');
    const file = Array.isArray(req.files.photo) ? req.files.photo[0] : req.files.photo;
    const url = await uploadPhoto(file.data, file.name, 'shop-hero', 'cover');
    if (col.shop) await col.shop.doc('main').set({ hero_url: url }, { merge: true });
    res.redirect('/admin/shop?saved=1');
  } catch (err) { next(err); }
});

router.post('/shop/icon/save', async (req, res, next) => {
  try {
    if (!req.files || !req.files.photo) return res.redirect('/admin/shop');
    const { uploadIconPhoto } = require('../lib/pelamushi-upload');
    const file = Array.isArray(req.files.photo) ? req.files.photo[0] : req.files.photo;
    const url = await uploadIconPhoto(file.data, 'shop');
    if (col.shop) await col.shop.doc('main').set({ icon_url: url }, { merge: true });
    res.redirect('/admin/shop?saved=1');
  } catch (err) { next(err); }
});

router.post('/shop/gallery/update', async (req, res, next) => {
  try {
    const raw = req.body.photos || {};
    const photos = Array.isArray(raw) ? raw : Object.values(raw);
    if (col.shop_gallery) {
      await Promise.all(photos.map(p =>
        col.shop_gallery.doc(p.id).update({
          order: parseInt(p.order) || 0,
          caption_en: p.caption_en || '',
          caption_ka: p.caption_ka || '',
          caption_ru: p.caption_ru || '',
        })
      ));
    }
    res.redirect('/admin/shop?saved=1');
  } catch (err) { next(err); }
});

router.post('/shop/gallery/add', async (req, res, next) => {
  try {
    if (!req.files || !req.files.photo) return res.redirect('/admin/shop');
    const { uploadPhoto } = require('../lib/pelamushi-upload');
    const files = Array.isArray(req.files.photo) ? req.files.photo : [req.files.photo];
    if (col.shop_gallery) {
      const snap = await col.shop_gallery.orderBy('order', 'desc').limit(1).get();
      let nextOrder = snap.empty ? 0 : snap.docs[0].data().order + 1;
      for (const file of files) {
        const url = await uploadPhoto(file.data, file.name, 'shop-gallery', 'gallery');
        await col.shop_gallery.add({ photo_url: url, order: nextOrder++ });
      }
    }
    res.redirect('/admin/shop');
  } catch (err) { next(err); }
});

router.post('/shop/gallery/:id/delete', async (req, res, next) => {
  try {
    if (col.shop_gallery) await col.shop_gallery.doc(req.params.id).delete();
    res.redirect('/admin/shop');
  } catch (err) { next(err); }
});

// ── Translate ─────────────────────────────────────────────────────────────────
router.get('/translate', async (req, res, next) => {
  try {
    let history = [];
    if (col.translations) {
      const snap = await col.translations.orderBy('created_at', 'desc').limit(50).get();
      history = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    res.render('pelamushi/admin/translate', { title: 'Переводчик', history });
  } catch (err) { next(err); }
});

router.post('/translate/run', async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.json({ error: 'Пустой текст' });
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.json({ error: 'ANTHROPIC_API_KEY не задан' });

    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `Переведи текст на английский и грузинский языки. Верни ТОЛЬКО JSON без разметки, строго в формате:
{"en":"...","ka":"..."}

Текст для перевода:
${text.trim()}`,
      }],
    });

    const raw = message.content[0].text.trim();
    const json = JSON.parse(raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim());
    const en = json.en || '';
    const ka = json.ka || '';

    if (col.translations) {
      await col.translations.add({
        ru: text.trim(),
        en,
        ka,
        admin_name: res.locals.adminName || 'unknown',
        created_at: new Date(),
      });
    }

    res.json({ en, ka });
  } catch (err) {
    res.json({ error: err.message });
  }
});

// ── Admins ────────────────────────────────────────────────────────────────────
router.get('/admins', async (req, res, next) => {
  try {
    let admins = [];
    if (col.admins) {
      const snap = await col.admins.orderBy('name').get();
      admins = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    res.render('pelamushi/admin/admins', {
      title: 'Администраторы',
      admins,
      currentHash: req.cookies.pelamushi_admin || '',
      saved: req.query.saved === '1',
      err: req.query.err || null,
    });
  } catch (err) { next(err); }
});

router.post('/admins/add', async (req, res, next) => {
  try {
    const { name, password } = req.body;
    if (!name || !password) return res.redirect('/admin/admins');
    if (col.admins) await col.admins.add({ name: name.trim(), password_hash: cookieToken(password), created_at: new Date() });
    res.redirect('/admin/admins?saved=1');
  } catch (err) { next(err); }
});

router.post('/admins/:id/password', async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password) return res.redirect('/admin/admins');
    if (col.admins) await col.admins.doc(req.params.id).update({ password_hash: cookieToken(password) });
    res.redirect('/admin/admins?saved=1');
  } catch (err) { next(err); }
});

router.post('/admins/:id/delete', async (req, res, next) => {
  try {
    if (col.admins) {
      const doc = await col.admins.doc(req.params.id).get();
      if (doc.exists && doc.data().password_hash === req.cookies.pelamushi_admin) {
        return res.redirect('/admin/admins?err=self');
      }
      await col.admins.doc(req.params.id).delete();
    }
    res.redirect('/admin/admins');
  } catch (err) { next(err); }
});

module.exports = router;
