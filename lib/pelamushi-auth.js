const crypto = require('crypto');

function cookieToken(password) {
  return crypto.createHash('sha256').update('pelamushi:' + password).digest('hex');
}

async function requireAdmin(req, res, next) {
  const { col } = require('./pelamushi-firebase');
  const cache = require('./pelamushi-cache');
  const envPassword = process.env.PELAMUSHI_ADMIN_PASSWORD;
  const cookieVal = req.cookies && req.cookies.pelamushi_admin;

  // Dev mode: no env var configured
  if (!envPassword) {
    res.locals.adminName = 'dev';
    return next();
  }

  if (!cookieVal) return res.redirect('/admin/login');

  // Env-var admin (backward compat)
  if (cookieVal === cookieToken(envPassword)) {
    res.locals.adminName = 'admin';
    return next();
  }

  // Firestore admins (cached 5 min)
  if (col.admins) {
    let admins = cache.get('admins_list');
    if (admins === undefined) {
      const snap = await col.admins.get();
      admins = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      cache.set('admins_list', admins, 5 * 60 * 1000);
    }
    const admin = admins.find(a => a.password_hash === cookieVal);
    if (admin) {
      res.locals.adminName = admin.name;
      return next();
    }
  }

  res.redirect('/admin/login');
}

module.exports = { requireAdmin, cookieToken };
