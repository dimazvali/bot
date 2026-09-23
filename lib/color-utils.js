'use strict';
var sharp = require('sharp');

var COLOR_FAMILIES = {
  red:    { hex: '#c0392b', label: 'КРАСНЫЙ' },
  orange: { hex: '#e67e22', label: 'ОРАНЖЕВЫЙ' },
  yellow: { hex: '#f1c40f', label: 'ЖЁЛТЫЙ' },
  green:  { hex: '#27ae60', label: 'ЗЕЛЁНЫЙ' },
  teal:   { hex: '#1abc9c', label: 'БИРЮЗОВЫЙ' },
  blue:   { hex: '#2980b9', label: 'СИНИЙ' },
  purple: { hex: '#8e44ad', label: 'ФИОЛЕТОВЫЙ' },
  mono:   { hex: '#888888', label: 'МОНОХРОМ' },
};

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  var max = Math.max(r, g, b), min = Math.min(r, g, b);
  var l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  var d = max - min;
  var s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  var h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToFamily(h, s) {
  if (s < 15) return 'mono';
  if (h >= 345 || h < 15) return 'red';
  if (h < 45) return 'orange';
  if (h < 75) return 'yellow';
  if (h < 165) return 'green';
  if (h < 210) return 'teal';
  if (h < 270) return 'blue';
  return 'purple';
}

async function extractColorFamily(buffer) {
  var stats = await sharp(buffer).stats();
  var { r, g, b } = stats.dominant;
  var { h, s } = rgbToHsl(r, g, b);
  return hslToFamily(h, s);
}

// Multi-color detection: samples pixels from a downsized copy, buckets each into
// a family, and returns whichever families cover at least minShare of the image
// (capped at maxFamilies, ranked by prevalence). Always returns at least one
// family — falls back to the single most common one if nothing clears the
// threshold (e.g. a very evenly mixed image).
async function extractColorFamilies(buffer, opts) {
  opts = opts || {};
  var maxFamilies = opts.maxFamilies || 3;
  var minShare = opts.minShare != null ? opts.minShare : 0.12;

  var { data, info } = await sharp(buffer)
    .resize(48, 48, { fit: 'inside' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  var channels = info.channels;
  var counts = {};
  var total = 0;
  for (var i = 0; i + 2 < data.length; i += channels) {
    var hsl = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    var fam = hslToFamily(hsl.h, hsl.s);
    counts[fam] = (counts[fam] || 0) + 1;
    total++;
  }
  if (!total) return [];

  var ranked = Object.keys(counts)
    .map(function(key) { return { key: key, share: counts[key] / total }; })
    .sort(function(a, b) { return b.share - a.share; });

  var picked = ranked.filter(function(f) { return f.share >= minShare; }).slice(0, maxFamilies).map(function(f) { return f.key; });
  return picked.length ? picked : [ranked[0].key];
}

// Reads a photo's color families with a fallback to the legacy singular
// `colorFamily` field — lets old, not-yet-re-saved photos keep working without
// a data migration.
function getPhotoColorFamilies(photo) {
  if (!photo) return [];
  if (photo.colorFamilies && photo.colorFamilies.length) return photo.colorFamilies;
  if (photo.colorFamily) return [photo.colorFamily];
  return [];
}

module.exports = { COLOR_FAMILIES, rgbToHsl, hslToFamily, extractColorFamily, extractColorFamilies, getPhotoColorFamilies };
