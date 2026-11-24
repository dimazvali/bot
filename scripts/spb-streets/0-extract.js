// Named highways inside a city polygon, from a PBF extract → Overpass-like {elements:[{id,tags,geometry}]}.
// Input: https://download.bbbike.org/osm/bbbike/SanktPetersburg/SanktPetersburg.osm.pbf + Nominatim boundary (city relation 421007).
// Usage: node 0-extract.js <pbf> <nominatim boundary.json> <osm_id> <out.json>
const fs = require('fs');
const path = require('path');
const [pbf, boundaryPath, osmId, out] = process.argv.slice(2);
const parseOSM = require(process.env.OSM_PBF_PARSER || 'osm-pbf-parser');
const { Writable } = require('stream');
const b = JSON.parse(fs.readFileSync(boundaryPath, 'utf8')).find(x => String(x.osm_id) === osmId);
const polys = b.geojson.type === 'Polygon' ? [b.geojson.coordinates] : b.geojson.coordinates;
let S = 90, N = -90, W = 180, E = -180;
polys.forEach(p => p[0].forEach(([lon, lat]) => { S = Math.min(S, lat); N = Math.max(N, lat); W = Math.min(W, lon); E = Math.max(E, lon); }));
function inRing(x, y, ring) {
  let ins = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}
const inside = (lon, lat) => polys.some(p => inRing(lon, lat, p[0]) && !p.slice(1).some(h => inRing(lon, lat, h)));
const SKIP = new Set(['footway', 'path', 'steps', 'track', 'cycleway', 'construction', 'proposed', 'platform', 'corridor', 'bridleway', 'elevator', 'raceway', 'bus_stop', 'services', 'rest_area']);
const nodes = new Map();
const res = [];
let n = 0;
fs.createReadStream(pbf).pipe(parseOSM()).pipe(new Writable({ objectMode: true, write(items, enc, next) {
  for (const it of items) {
    if (it.type === 'node') {
      n++;
      if (it.lat >= S && it.lat <= N && it.lon >= W && it.lon <= E) nodes.set(String(it.id), [it.lat, it.lon]);
    } else if (it.type === 'way' && it.tags && it.tags.highway && it.tags.name && !SKIP.has(it.tags.highway)) {
      const g = it.refs.map(r => nodes.get(String(r))).filter(Boolean);
      if (g.length < 2) continue;
      const [lat, lon] = g[Math.floor(g.length / 2)];
      if (!inside(lon, lat)) continue;
      res.push({ type: 'way', id: +it.id, tags: it.tags, geometry: g.map(([lat, lon]) => ({ lat, lon })) });
    }
  }
  next();
} })).on('finish', () => {
  fs.writeFileSync(out, JSON.stringify({ elements: res }));
  console.log('nodes', n, 'kept', nodes.size, 'ways', res.length);
});
