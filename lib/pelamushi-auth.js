const crypto = require('crypto');

function cookieToken(password) {
  return crypto.createHash('sha256').update('pelamushi:' + password).digest('hex');
}

function requireAdmin(req, res, next) {
  const password = process.env.PELAMUSHI_ADMIN_PASSWORD;
  if (!password) {
    res.locals.adminEmail = 'dev@local';
    return next();
  }
  if (req.cookies && req.cookies.pelamushi_admin === cookieToken(password)) {
    res.locals.adminEmail = 'admin';
    return next();
  }
  res.redirect('/admin/login');
}

module.exports = { requireAdmin, cookieToken };
