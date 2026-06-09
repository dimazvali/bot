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

module.exports = router;
