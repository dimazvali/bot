// Renders the "Kaladze Simulator" promo tile shown in the photo.dimazvali.com galleries (Georgia section)
// into public/images/blackout/tile-{ru,en}.webp. Re-run after changing renderTile() in lib/it-blackout-share.js.
// Usage: node scripts/build-blackout-tile.js
'use strict';
var fs = require('fs');
var path = require('path');
var sharp = require('sharp');
var share = require('../lib/it-blackout-share');

(async function () {
  var dir = path.join(__dirname, '..', 'public', 'images', 'blackout');
  fs.mkdirSync(dir, { recursive: true });
  for (var lang of ['ru', 'en']) {
    var png = await share.renderTile(lang);
    var out = path.join(dir, 'tile-' + lang + '.webp');
    var info = await sharp(png).webp({ quality: 90, smartSubsample: true }).toFile(out);
    console.log(out, info.width + 'x' + info.height, info.size + 'B');
  }
})().catch(function (e) { console.error(e); process.exit(1); });
