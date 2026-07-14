'use strict';
var express = require('express');
var router = express.Router();
var axios = require('axios');
var sharp = require('sharp');
var path = require('path');
var ekaData = require('../lib/eka-data');

var OG_W = 1200;
var OG_H = 630;
var BRAND_TINT = '#E8000D';
var LOGO_PATH = path.join(__dirname, '../public/images/eka/v2/logo.png');
var LOGO_H = 110;
var LOGO_MARGIN = 36;

var _cache = new Map();
var _logoBuf = null;

function escXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function splitTitle(title) {
  if (title.length <= 22) return [title];
  var mid = Math.floor(title.length / 2);
  var cut = title.lastIndexOf(' ', mid + 6);
  if (cut < 4) cut = title.indexOf(' ', mid - 6);
  if (cut < 0) return [title];
  return [title.slice(0, cut), title.slice(cut + 1)];
}

function buildSvg(title, subtitle) {
  var lines = splitTitle(title);
  var fontSize = lines[0].length > 20 ? 56 : lines[0].length > 14 ? 66 : 76;
  var lineH = Math.round(fontSize * 1.2);
  var blockH = lines.length * lineH;
  var baseY = OG_H - 100 - blockH;

  var textNodes = lines.map(function(line, i) {
    return `<text x="80" y="${baseY + i * lineH}" font-family="sans-serif" font-weight="bold" font-size="${fontSize}" fill="white" letter-spacing="-1">${escXml(line)}</text>`;
  }).join('\n    ');

  return `<svg width="${OG_W}" height="${OG_H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#000" stop-opacity="0.05"/>
      <stop offset="45%"  stop-color="#000" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.78"/>
    </linearGradient>
  </defs>
  <rect width="${OG_W}" height="${OG_H}" fill="${BRAND_TINT}" fill-opacity="0.18"/>
  <rect width="${OG_W}" height="${OG_H}" fill="url(#g)"/>
  ${textNodes}
  <text x="80" y="${OG_H - 44}" font-family="sans-serif" font-size="26" fill="rgba(255,255,255,0.52)">${escXml(subtitle)}</text>
</svg>`;
}

async function getLogoBuffer() {
  if (!_logoBuf) _logoBuf = await sharp(LOGO_PATH).resize({ height: LOGO_H }).toBuffer();
  return _logoBuf;
}

async function generate(imageUrl, title, subtitle) {
  var key = imageUrl + '\x00' + title + '\x00' + subtitle;
  if (_cache.has(key)) return _cache.get(key);

  var source;
  if (/^https?:\/\//.test(imageUrl)) {
    var resp = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 10000 });
    source = Buffer.from(resp.data);
  } else {
    source = imageUrl;
  }

  var svg = buildSvg(title, subtitle);
  var logoBuf = await getLogoBuffer();

  var buf = await sharp(source)
    .resize(OG_W, OG_H, { fit: 'cover', position: 'centre' })
    .composite([
      { input: Buffer.from(svg), top: 0, left: 0 },
      { input: logoBuf, top: LOGO_MARGIN, left: LOGO_MARGIN },
    ])
    .jpeg({ quality: 88 })
    .toBuffer();

  _cache.set(key, buf);
  return buf;
}

function send(res, buf) {
  res.set('Content-Type', 'image/jpeg');
  res.set('Cache-Control', 'public, max-age=3600');
  res.send(buf);
}

function heroUrlFrom(images, fallbackHero) {
  var hero = images && images.find(function(i) { return i.role === 'hero'; });
  if (hero && hero.w1400) return hero.w1400;
  if (fallbackHero && fallbackHero.w1400) return fallbackHero.w1400;
  return null;
}

// GET /og/direction/:lang/:slug.jpg
router.get('/direction/:lang(ru|en)/:slug.jpg', async function(req, res) {
  try {
    var lang = req.params.lang;
    var direction = await ekaData.getDirectionBySlug(req.params.slug);
    if (!direction || !direction.published) return res.status(404).end();
    var images = await ekaData.getImages({ ownerId: direction.id });
    var imageUrl = heroUrlFrom(images, direction.heroImageSizes) || path.join(__dirname, '../public/images/eka/v2/2.jpg');
    var title = (lang === 'ru' ? direction.titleRu : direction.titleEn) || '';
    var subtitle = 'tbiliseli.com/' + lang + '/directions/' + req.params.slug;
    send(res, await generate(imageUrl, title, subtitle));
  } catch (e) {
    console.error('[tbiliseli-og] direction:', e.message);
    res.status(500).end();
  }
});

// GET /og/attraction/:lang/:slug.jpg
router.get('/attraction/:lang(ru|en)/:slug.jpg', async function(req, res) {
  try {
    var lang = req.params.lang;
    var attraction = await ekaData.getAttractionBySlug(req.params.slug) || await ekaData.getAttraction(req.params.slug);
    if (!attraction || !attraction.published) return res.status(404).end();
    var images = await ekaData.getImages({ ownerId: attraction.id });
    var imageUrl = heroUrlFrom(images, null) || path.join(__dirname, '../public/images/eka/v2/2.jpg');
    var title = (lang === 'ru' ? attraction.titleRu : attraction.titleEn) || '';
    var subtitle = 'tbiliseli.com/' + lang + '/attractions/' + req.params.slug;
    send(res, await generate(imageUrl, title, subtitle));
  } catch (e) {
    console.error('[tbiliseli-og] attraction:', e.message);
    res.status(500).end();
  }
});

// GET /og/tour/:lang/:id.jpg
router.get('/tour/:lang(ru|en)/:id.jpg', async function(req, res) {
  try {
    var lang = req.params.lang;
    var tour = await ekaData.getTour(req.params.id);
    if (!tour || !tour.published) return res.status(404).end();
    var direction = tour.directionId ? await ekaData.getDirection(tour.directionId) : null;
    var images = direction ? await ekaData.getImages({ ownerId: direction.id }) : [];
    var imageUrl = heroUrlFrom(images, direction && direction.heroImageSizes) || path.join(__dirname, '../public/images/eka/v2/3.jpg');
    var title = (lang === 'ru' ? tour.titleRu : tour.titleEn) || '';
    var tourDate = tour.date ? (tour.date.toDate ? tour.date.toDate() : new Date(tour.date)) : null;
    var dateStr = tourDate ? tourDate.toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : null;
    var subtitle = (dateStr ? dateStr + ' · ' : '') + 'tbiliseli.com';
    send(res, await generate(imageUrl, title, subtitle));
  } catch (e) {
    console.error('[tbiliseli-og] tour:', e.message);
    res.status(500).end();
  }
});

module.exports = router;
