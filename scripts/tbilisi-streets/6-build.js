// Builds public/lab/streets/data.json for dimazvali.com/lab/streets/ — the Tbilisi road network
// split by who (or what) the streets are named after.
// Inputs:
//   <geom.json>  — named Tbilisi highways with geometry (0-pbf2geom.js output, Overpass `out tags geom` shape)
//   data/tbilisi-streets/dict.json — curated "name base → category/person" dictionary (5-dict.js output)
// Usage: node scripts/tbilisi-streets/6-build.js <geom.json> data/tbilisi-streets/dict.json public/lab/streets/data.json
'use strict';
const fs = require('fs');
const [geomPath, dictPath, out] = process.argv.slice(2);
const ways = JSON.parse(fs.readFileSync(geomPath, 'utf8')).elements;
const dict = JSON.parse(fs.readFileSync(dictPath, 'utf8'));

// order = legend order; `person` (unknown occupation) and non-people go last
const CATS = ['writers', 'royals', 'science', 'military', 'politics', 'stage', 'artists', 'music', 'sport', 'person',
  'georgia', 'world', 'dates', 'ideas', 'nature', 'service'];
const SKIP = new Set(['footway', 'path', 'steps', 'track', 'cycleway', 'construction', 'proposed', 'platform', 'corridor', 'bridleway', 'elevator', 'raceway']);
const RANK = { motorway: 3, trunk: 3, primary: 3, secondary: 2, tertiary: 2, motorway_link: 2, trunk_link: 2, primary_link: 2 };

// same normalisation as 2-wikidata-ka.js: "გალაკტიონ ტაბიძის ქუჩა" → "გალაკტიონ ტაბიძის"
const TYPE = /\s*(ქუჩა|გამზირი|შესახვევი|ჩიხი|მოედანი|ხეივანი|სანაპირო|აღმართი|დაღმართი|გზატკეცილი|გასასვლელი|ბაღი|პარკი|ხიდი|კვარტალი|დასახლება|გზა|ბულვარი|მიკრორაიონი|ქ\.)\s*/g;
const kaBase = s => s.replace(/[0-9IVX№#.,-]+(-?ე|-?ლი)?/g, ' ').replace(TYPE, ' ').replace(/\s+/g, ' ').trim();

// local metric projection around the city centre, 1 unit = 2 m
const LAT0 = 41.72, LON0 = 44.80, Q = 2;
const KX = Math.cos(LAT0 * Math.PI / 180) * 111320 / Q, KY = 110540 / Q;
const proj = p => [Math.round((p.lon - LON0) * KX), Math.round(-(p.lat - LAT0) * KY)];

function simplify(pts, eps) { // Douglas–Peucker
  if (pts.length < 3) return pts;
  const a = pts[0], b = pts[pts.length - 1];
  let idx = 0, dmax = 0;
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + b[0] * a[1] - b[1] * a[0]) / len;
    if (d > dmax) { dmax = d; idx = i; }
  }
  if (dmax <= eps) return [a, b];
  return simplify(pts.slice(0, idx + 1), eps).slice(0, -1).concat(simplify(pts.slice(idx), eps));
}

const names = []; // one row per name base
const nameIdx = new Map();
const streetNames = new Map(); // base → {ru: count map, en: ..., ka: ...} for the most common full street name
const outWays = [];
const km = {};
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, pts = 0;
for (const w of ways) {
  if (SKIP.has(w.tags.highway)) continue;
  const base = kaBase(w.tags.name);
  const d = dict[base];
  if (!d) continue;
  if (!nameIdx.has(base)) {
    nameIdx.set(base, names.length);
    names.push({ base, d });
    streetNames.set(base, { ru: {}, en: {}, ka: {} });
  }
  const sn = streetNames.get(base);
  for (const l of ['ru', 'en']) { const v = w.tags['name:' + l]; if (v) sn[l][v] = (sn[l][v] || 0) + 1; }
  sn.ka[w.tags.name] = (sn.ka[w.tags.name] || 0) + 1;

  let line = simplify(w.geometry.map(proj), 2); // 4 m tolerance
  const flat = [];
  let px = 0, py = 0, len = 0;
  for (const [x, y] of line) {
    flat.push(x - px, y - py);
    if (flat.length > 2) len += Math.hypot(x - px, y - py) * Q;
    px = x; py = y;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  pts += line.length;
  km[d.cat] = (km[d.cat] || 0) + len / 1000;
  outWays.push([nameIdx.get(base), RANK[w.tags.highway] || 1, flat]);
}
const top = m => Object.entries(m).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
const data = {
  v: 1, q: Q, lat0: LAT0, lon0: LON0, bbox: [minX, minY, maxX, maxY],
  cats: CATS,
  km: Object.fromEntries(CATS.map(c => [c, Math.round((km[c] || 0) * 10) / 10])),
  // [catIdx, flags(1 foreign, 2 female, 4 heuristic guess), person ru, person en, street ru, street en, street ka, born, wikidata]
  names: names.map(({ base, d }) => {
    const sn = streetNames.get(base);
    return [CATS.indexOf(d.cat), (d.foreign ? 1 : 0) | (d.female ? 2 : 0) | (d.auto ? 4 : 0),
      d.ru || null, d.en || null, top(sn.ru), top(sn.en), top(sn.ka), d.born || null, d.wd || null];
  }),
  ways: outWays,
};
if (data.names.some(n => n[0] < 0)) throw new Error('unknown category in dict');
fs.mkdirSync(require('path').dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(data));
console.log('names', names.length, 'ways', outWays.length, 'points', pts, 'bytes', fs.statSync(out).size);
console.log(Object.entries(data.km).map(([k, v]) => k + ' ' + v).join(' | '));
