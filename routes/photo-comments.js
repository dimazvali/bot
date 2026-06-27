var express = require('express');
var router = express.Router();
var { OAuth2Client } = require('google-auth-library');
var photoComments = require('../lib/photo-comments');
var { getApps } = require('firebase-admin/app');
var { getFirestore } = require('firebase-admin/firestore');

var client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Initialize photo-comments lib with the Firestore db from the already-initialized 'photo' Firebase app.
// photo-admin.js is always required before this module (mounted first in routes/photo.js),
// so the 'photo' app is guaranteed to exist at this point.
(function () {
  var app = getApps().find(function (a) { return a.name === 'photo'; });
  if (app) photoComments.init(getFirestore(app));
}());

function parsePhotoUser(req) {
  try {
    var raw = req.signedCookies && req.signedCookies.photoUser;
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

async function requireAdmin(req, res, next) {
  var tokenId = req.signedCookies && req.signedCookies.photoAdminToken;
  if (!tokenId) return res.status(401).json({ ok: false, error: 'unauthorized' });
  try {
    var app = getApps().find(function (a) { return a.name === 'photo'; });
    var db = getFirestore(app);
    var doc = await db.collection('PHOTOadminTokens').doc(tokenId).get();
    if (!doc.exists) return res.status(401).json({ ok: false, error: 'unauthorized' });
    next();
  } catch (e) {
    res.status(500).json({ ok: false, error: 'server error' });
  }
}

function validateSlug(s) {
  return typeof s === 'string' && /^[a-z0-9-]+$/.test(s);
}

// POST /photo-comments/auth/google
router.post('/auth/google', express.json(), async function (req, res) {
  var credential = req.body && req.body.credential;
  if (!credential) return res.status(400).json({ ok: false, error: 'missing credential' });
  try {
    var ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    var payload = ticket.getPayload();
    var user = { googleId: payload.sub, name: payload.name, picture: payload.picture };
    res.cookie('photoUser', JSON.stringify(user), {
      signed: true,
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    res.json({ ok: true, user: user });
  } catch (e) {
    res.status(401).json({ ok: false, error: 'invalid token' });
  }
});

// POST /photo-comments/auth/signout
router.post('/auth/signout', function (req, res) {
  res.clearCookie('photoUser');
  res.json({ ok: true });
});

// GET /photo-comments/:country/:series/:id
router.get('/:country/:series/:id', async function (req, res) {
  var country = req.params.country;
  var series = req.params.series;
  var id = req.params.id;
  if (!validateSlug(country) || !validateSlug(series) || !validateSlug(id)) {
    return res.status(400).json({ ok: false, error: 'invalid params' });
  }
  var photoId = country + '_' + series + '_' + id;
  try {
    var comments = await photoComments.getComments(photoId);
    res.json({ ok: true, comments: comments });
  } catch (e) {
    console.error('[photo-comments] getComments error:', e.message);
    res.status(500).json({ ok: false, error: 'server error' });
  }
});

// POST /photo-comments/:country/:series/:id
router.post('/:country/:series/:id', express.json(), async function (req, res) {
  var user = parsePhotoUser(req);
  if (!user) return res.status(401).json({ ok: false, error: 'not authenticated' });
  var country = req.params.country;
  var series = req.params.series;
  var id = req.params.id;
  if (!validateSlug(country) || !validateSlug(series) || !validateSlug(id)) {
    return res.status(400).json({ ok: false, error: 'invalid params' });
  }
  var text = req.body && typeof req.body.text === 'string' ? req.body.text.trim() : '';
  if (!text || text.length > 2000) return res.status(400).json({ ok: false, error: 'invalid text' });
  var photoId = country + '_' + series + '_' + id;
  try {
    var commentId = await photoComments.addComment(photoId, user, text);
    res.json({ ok: true, commentId: commentId });
  } catch (e) {
    console.error('[photo-comments] addComment error:', e.message);
    res.status(500).json({ ok: false, error: 'server error' });
  }
});

// POST /photo-comments/admin/:commentId/hide
router.post('/admin/:commentId/hide', requireAdmin, async function (req, res) {
  var commentId = req.params.commentId;
  if (!/^[A-Za-z0-9]+$/.test(commentId)) return res.status(400).json({ ok: false });
  try {
    await photoComments.hideComment(commentId);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'server error' });
  }
});

module.exports = router;
