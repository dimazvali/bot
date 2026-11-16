// Builds lib/it-tbilisi-districts.json (SVG paths for the /blackout game on it.dimazvali.com).
// Inputs are OSM dumps, fetched once by hand:
//   <geo>/<District>.json  — Nominatim search "<District> district, Tbilisi", polygon_geojson=1,
//                            for Gldani Nadzaladevi Didube Chughureti Saburtalo Vake Mtatsminda Krtsanisi Isani Samgori
//   <geo>/../topo/ov.json  — Overpass: (way["waterway"="river"](41.60,44.58,41.86,45.03);
//                                       node["natural"="peak"](41.60,44.58,41.86,45.03);); out geom;
//   <geo>/../topo/{sea,lisi}.json — Nominatim "Tbilisi Sea", "Lisi Lake" with polygon_geojson=1
// Usage: node scripts/build-tbilisi-map.js <geo dir> lib/it-tbilisi-districts.json
// Converts Nominatim district polygons into SVG paths for the blackout game.
const fs = require('fs');
const path = require('path');
const dir = process.argv[2];
const out = process.argv[3];
const NAMES = {
  Gldani: 'Глдани', Nadzaladevi: 'Надзаладеви', Didube: 'Дидубе', Chughureti: 'Чугурети',
  Saburtalo: 'Сабуртало', Vake: 'Ваке', Mtatsminda: 'Мтацминда', Krtsanisi: 'Крцаниси',
  Isani: 'Исани', Samgori: 'Самгори',
};
const items = Object.keys(NAMES).map(k => {
  const r = JSON.parse(fs.readFileSync(path.join(dir, k + '.json'), 'utf8'))
    .find(x => x.type === 'administrative');
  const g = r.geojson;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  return { id: k.toLowerCase(), name: NAMES[k], rings: polys.map(p => p[0]) };
});
let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
const K = Math.cos(41.72 * Math.PI / 180);
for (const it of items) for (const ring of it.rings) for (const [lon, lat] of ring) {
  const x = lon * K, y = -lat;
  minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
}
const W = 1000, s = W / (maxX - minX), H = Math.round((maxY - minY) * s);
// Douglas–Peucker
function simplify(pts, eps) {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  let idx = 0, dmax = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    const d = len < 1e-9 ? Math.hypot(p[0] - a[0], p[1] - a[1])
      : Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / len;
    if (d > dmax) { dmax = d; idx = i; }
  }
  if (dmax <= eps) return [a, b];
  return simplify(pts.slice(0, idx + 1), eps).slice(0, -1).concat(simplify(pts.slice(idx), eps));
}
const result = items.map(it => {
  let area = 0, cx = 0, cy = 0;
  const d = it.rings.map(ring => {
    const pts = simplify(ring.map(([lon, lat]) => [(lon * K - minX) * s, (-lat - minY) * s]), 1.2);
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      const c = x0 * y1 - x1 * y0; area += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c;
    }
    return 'M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L') + 'Z';
  }).join('');
  return { id: it.id, name: it.name, d, cx: +(cx / (3 * area)).toFixed(1), cy: +(cy / (3 * area)).toFixed(1) };
});
// ── topography: rivers, lakes, peaks (Overpass + Nominatim dumps in ./topo) ──
const proj = ([lon, lat]) => [(lon * K - minX) * s, (-lat - minY) * s];
const fmt = pts => 'M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L');
const M = 60; // keep a margin outside the city so features run off the edge
const inside = ([x, y]) => x > -M && x < W + M && y > -M && y < H + M;
const RIVERS = { Mtkvari: ['Мтквари', 9], Vere: ['Вере', 4], 'ვერე': ['Вере', 4], 'Dighmistskali River': ['Дигмисцкали', 2.5],
  Lochini: ['Лочини', 2.5], 'Gldani River': ['Глданула', 2.5] };
const ov = JSON.parse(fs.readFileSync(path.join(dir, '../topo/ov.json'), 'utf8'));
const rivers = [];
for (const e of ov.elements.filter(e => e.type === 'way')) {
  const r = RIVERS[e.tags['name:en'] || e.tags.name];
  if (!r) continue;
  let seg = [];
  const flush = () => { if (seg.length > 1) rivers.push({ name: r[0], w: r[1], pts: simplify(seg, 0.8) }); seg = []; };
  for (const g of e.geometry) { const p = proj([g.lon, g.lat]); if (inside(p)) seg.push(p); else flush(); }
  flush();
}
// label for the Mtkvari: the river point nearest to a chosen spot, rotated along the flow
function riverLabel(name, lon, lat) {
  const target = proj([lon, lat]);
  let best = null;
  for (const r of rivers.filter(r => r.name === name)) for (let i = 1; i < r.pts.length; i++) {
    const d = Math.hypot(r.pts[i][0] - target[0], r.pts[i][1] - target[1]);
    if (!best || d < best.d) best = { d, a: r.pts[i - 1], b: r.pts[i] };
  }
  let ang = Math.atan2(best.b[1] - best.a[1], best.b[0] - best.a[0]) * 180 / Math.PI;
  if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
  const mx = (best.a[0] + best.b[0]) / 2, my = (best.a[1] + best.b[1]) / 2;
  return { text: name, x: +mx.toFixed(1), y: +my.toFixed(1), rot: +ang.toFixed(1) };
}
const LAKES = { sea: 'Тбилисское море', lisi: 'Лиси' };
const lakes = Object.keys(LAKES).map(k => {
  const r = JSON.parse(fs.readFileSync(path.join(dir, '../topo/' + k + '.json'), 'utf8')).find(x => x.category === 'water');
  const ring = (r.geojson.type === 'Polygon' ? r.geojson.coordinates : r.geojson.coordinates[0])[0];
  const pts = simplify(ring.map(proj), 0.6);
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const b = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map(v => +v.toFixed(1));
  return { id: k, name: LAKES[k], d: fmt(pts) + 'Z', box: b };
});
// peaks: higher first, drop anything crowding an already placed glyph
// only Mtatsminda gets a name: the other peaks sit right on district labels
const PEAK_LABELS = { 'Mount Mtatsminda': 'Мтацминда' };
const peaks = [];
ov.elements.filter(e => e.type === 'node' && e.tags.ele)
  .map(e => ({ p: proj([e.lon, e.lat]), ele: parseFloat(e.tags.ele), en: e.tags['name:en'] }))
  .filter(e => inside(e.p))
  .sort((a, b) => (PEAK_LABELS[b.en] ? 1 : 0) - (PEAK_LABELS[a.en] ? 1 : 0) || b.ele - a.ele)
  .forEach(e => {
    if (peaks.some(q => Math.hypot(q.x - e.p[0], q.y - e.p[1]) < 34)) return;
    peaks.push({ x: +e.p[0].toFixed(1), y: +e.p[1].toFixed(1), ele: e.ele, label: PEAK_LABELS[e.en] || null });
  });
const narikala = proj([44.8086, 41.6879]);
const topo = {
  rivers: rivers.map(r => ({ name: r.name, w: r.w, d: fmt(r.pts) })),
  lakes,
  peaks,
  castle: { x: +narikala[0].toFixed(1), y: +narikala[1].toFixed(1), label: 'Нарикала' },
  riverLabels: [riverLabel('Мтквари', 44.775, 41.752), riverLabel('Мтквари', 44.905, 41.655)],
};
console.log('rivers', topo.rivers.length, 'lakes', lakes.length, 'peaks', peaks.length, topo.riverLabels);
fs.writeFileSync(out, JSON.stringify({ w: W, h: H, districts: result, topo }));
console.log('viewBox', W, H, 'bytes', fs.statSync(out).size);
for (const r of result) console.log(r.id, r.cx, r.cy, r.d.length);
