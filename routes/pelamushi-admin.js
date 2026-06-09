const express = require('express');
const router = express.Router();
const { col } = require('../lib/pelamushi-firebase');
const { requireAdmin } = require('../lib/pelamushi-auth');

const FIREBASE_API_KEY    = process.env.PELAMUSHI_WEB_API_KEY || '';
const FIREBASE_PROJECT_ID = process.env.PELAMUSHI_PROJECT_ID  || '';

// Login — no auth required
router.get('/login', (req, res) => {
  res.render('pelamushi/admin/login', {
    error: req.query.err || null,
    firebaseApiKey: FIREBASE_API_KEY,
    firebaseProjectId: FIREBASE_PROJECT_ID,
  });
});

router.get('/logout', (req, res) => {
  res.clearCookie('pelamushi_token');
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

module.exports = router;
