var express = require('express');
var router = express.Router();
var axios = require('axios');
var sharp = require('sharp');
var { getData } = require('../lib/photo-data');
var { COLOR_FAMILIES } = require('../lib/color-utils');
var shoots = require('../lib/photo-shoots');

var OG_W = 1200;
var OG_H = 630;

var _cache = new Map();

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

function buildSvg(title, pageUrl, colorHex) {
  var lines = splitTitle(title);
  var fontSize = lines[0].length > 20 ? 56 : lines[0].length > 14 ? 66 : 76;
  var lineH = Math.round(fontSize * 1.2);
  var blockH = lines.length * lineH;
  var baseY = OG_H - 100 - blockH;

  var textNodes = lines.map(function(line, i) {
    return `<text x="80" y="${baseY + i * lineH}" font-family="sans-serif" font-weight="bold" font-size="${fontSize}" fill="white" letter-spacing="-1">${escXml(line)}</text>`;
  }).join('\n    ');

  var tint = colorHex || '#1a2a3a';

  return `<svg width="${OG_W}" height="${OG_H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#000" stop-opacity="0.05"/>
      <stop offset="45%"  stop-color="#000" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.78"/>
    </linearGradient>
  </defs>
  <rect width="${OG_W}" height="${OG_H}" fill="${escXml(tint)}" fill-opacity="0.22"/>
  <rect width="${OG_W}" height="${OG_H}" fill="url(#g)"/>
  ${textNodes}
  <text x="80" y="${OG_H - 44}" font-family="sans-serif" font-size="26" fill="rgba(255,255,255,0.52)">${escXml(pageUrl)}</text>
</svg>`;
}

async function generate(imageUrl, title, pageUrl, colorHex) {
  var key = imageUrl + '\x00' + title + '\x00' + pageUrl;
  if (_cache.has(key)) return _cache.get(key);

  var resp = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 10000 });
  var svg = buildSvg(title, pageUrl, colorHex);

  var buf = await sharp(Buffer.from(resp.data))
    .resize(OG_W, OG_H, { fit: 'cover', position: 'centre' })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 88 })
    .toBuffer();

  _cache.set(key, buf);
  return buf;
}

function colorFor(photo) {
  if (!photo || !photo.colorFamily) return null;
  var cf = COLOR_FAMILIES[photo.colorFamily];
  return cf ? cf.hex : null;
}

function send(res, buf) {
  res.set('Content-Type', 'image/jpeg');
  res.set('Cache-Control', 'public, max-age=3600');
  res.send(buf);
}

// GET /og/country/:country.jpg
router.get('/country/:country.jpg', async (req, res) => {
  var data = getData();
  var country = data[req.params.country];
  if (!country) return res.status(404).end();
  var firstPhoto = null;
  for (var sk of (country.seriesOrder || Object.keys(country.series))) {
    var s = country.series[sk];
    if (s && s.photos && s.photos.length) { firstPhoto = s.photos[0]; break; }
  }
  if (!firstPhoto || !firstPhoto.urls) return res.status(404).end();
  try {
    var buf = await generate(firstPhoto.urls.preview, country.label, 'photo.dimazvali.com/' + req.params.country, colorFor(firstPhoto));
    send(res, buf);
  } catch (e) {
    console.error('[og] country:', e.message);
    res.status(500).end();
  }
});

// GET /og/series/:country/:series.jpg
router.get('/series/:country/:series.jpg', async (req, res) => {
  var data = getData();
  var country = data[req.params.country];
  var series = country && country.series[req.params.series];
  if (!series || !series.photos || !series.photos.length) return res.status(404).end();
  var firstPhoto = series.photos[0];
  if (!firstPhoto.urls) return res.status(404).end();
  try {
    var buf = await generate(firstPhoto.urls.preview, series.label, 'photo.dimazvali.com/' + req.params.country + '/' + req.params.series, colorFor(firstPhoto));
    send(res, buf);
  } catch (e) {
    console.error('[og] series:', e.message);
    res.status(500).end();
  }
});

// GET /og/shoot/:slug.jpg
router.get('/shoot/:slug.jpg', async (req, res) => {
  var shoot = shoots.getShoot(req.params.slug);
  if (!shoot || !shoot.photos.length) return res.status(404).end();
  var firstPhoto = shoot.photos[0];
  if (!firstPhoto.urls) return res.status(404).end();
  try {
    var buf = await generate(firstPhoto.urls.preview, shoot.label, 'photo.dimazvali.com/shoot/' + req.params.slug, colorFor(firstPhoto));
    send(res, buf);
  } catch (e) {
    console.error('[og] shoot:', e.message);
    res.status(500).end();
  }
});

module.exports = router;
