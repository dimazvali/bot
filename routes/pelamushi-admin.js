const express = require('express');
const fileUpload = require('express-fileupload');
const router = express.Router();
const { col } = require('../lib/pelamushi-firebase');
const { requireAdmin, cookieToken } = require('../lib/pelamushi-auth');

router.use(fileUpload());

// Login — no auth required
router.get('/login', (req, res) => {
  res.render('pelamushi/admin/login', { error: req.query.err || null });
});

router.post('/login', (req, res) => {
  const adminPassword = process.env.PELAMUSHI_ADMIN_PASSWORD;
  if (!adminPassword || req.body.password === adminPassword) {
    const value = adminPassword ? cookieToken(adminPassword) : 'dev';
    res.cookie('pelamushi_admin', value, { httpOnly: true, maxAge: 7 * 24 * 3600 * 1000, sameSite: 'strict' });
    return res.redirect('/admin');
  }
  res.redirect('/admin/login?err=wrong');
});

router.get('/logout', (req, res) => {
  res.clearCookie('pelamushi_admin');
  res.redirect('/admin/login');
});

// All routes below require admin session
router.use(requireAdmin);

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

router.post('/about/gallery/add', async (req, res, next) => {
  try {
    if (!req.files || !req.files.photo) return res.redirect('/admin/about');
    const { uploadPhoto } = require('../lib/pelamushi-upload');
    const url = await uploadPhoto(req.files.photo.data, req.files.photo.name, 'gallery', 'gallery');
    if (col.gallery) {
      const snap = await col.gallery.orderBy('order', 'desc').limit(1).get();
      const nextOrder = snap.empty ? 0 : snap.docs[0].data().order + 1;
      await col.gallery.add({ photo_url: url, caption_en: '', caption_ka: '', caption_ru: '', order: nextOrder });
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

router.post('/about/team/:id/delete', async (req, res, next) => {
  try {
    if (col.team) await col.team.doc(req.params.id).delete();
    res.redirect('/admin/about');
  } catch (err) { next(err); }
});

// ── Menus ────────────────────────────────────────────────────────────────────
router.get('/menus', async (req, res, next) => {
  try {
    let menus = [];
    if (col.menus) {
      const snap = await col.menus.orderBy('order').get();
      menus = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    res.render('pelamushi/admin/menus', { title: 'Menus', menus });
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
    if (col.categories) {
      const snap = await col.categories.where('menu_id', '==', req.params.id).orderBy('order', 'desc').limit(1).get();
      const nextOrder = snap.empty ? 0 : snap.docs[0].data().order + 1;
      await col.categories.add({ menu_id: req.params.id, name_en: name_en || '', name_ka: name_ka || '', name_ru: name_ru || '', order: nextOrder });
    }
    res.redirect(`/admin/menus/${req.params.id}`);
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

router.post('/menus/:id/items/:itemId/delete', async (req, res, next) => {
  try {
    if (col.items) await col.items.doc(req.params.itemId).delete();
    res.redirect(`/admin/menus/${req.params.id}`);
  } catch (err) { next(err); }
});

// ── News ─────────────────────────────────────────────────────────────────────
router.get('/news', async (req, res, next) => {
  try {
    let articles = [];
    if (col.news) {
      const snap = await col.news.orderBy('published_at', 'desc').limit(50).get();
      articles = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    res.render('pelamushi/admin/news', { title: 'News', articles });
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
    res.render('pelamushi/admin/registrations', { title: 'Registrations', regs, newsMap });
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

module.exports = router;
