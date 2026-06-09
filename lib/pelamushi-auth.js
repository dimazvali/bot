const { getApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { col } = require('./pelamushi-firebase');

let auth = null;
let adminEmails = null;

// Only initialize if Firebase is configured
if (col && col.admins) {
  try {
    auth = getAuth(getApp('pelamushi'));
    loadAdminEmails().catch(e => console.error('[pelamushi-auth]', e.message));
    setInterval(() => loadAdminEmails().catch(e => console.error('[pelamushi-auth]', e.message)), 5 * 60 * 1000);
  } catch (e) {
    console.error('[pelamushi-auth] init failed:', e.message);
  }
}

async function loadAdminEmails() {
  if (!col || !col.admins) return;
  const snap = await col.admins.get();
  adminEmails = new Set(snap.docs.map(d => d.id));
}

async function requireAdmin(req, res, next) {
  const token = req.cookies && req.cookies.pelamushi_token;
  if (!token) return res.redirect('/admin/login');

  if (!auth) {
    // Dev mode without Firebase — allow access
    res.locals.adminEmail = 'dev@local';
    return next();
  }

  try {
    const decoded = await auth.verifyIdToken(token);
    if (!adminEmails || !adminEmails.has(decoded.email)) {
      res.clearCookie('pelamushi_token');
      return res.redirect('/admin/login?err=forbidden');
    }
    res.locals.adminEmail = decoded.email;
    next();
  } catch {
    res.clearCookie('pelamushi_token');
    res.redirect('/admin/login?err=expired');
  }
}

module.exports = { requireAdmin };
