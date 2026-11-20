// Stream the Georgia PBF: keep nodes in the Tbilisi bbox, then emit named highways whose ids
// are in the Overpass city-area list (ways.json). Output mimics Overpass `out tags geom`.
// Inputs, fetched by hand (Overpass chokes on geometry for the whole city, the extract does not):
//   georgia.osm.pbf — https://download.geofabrik.de/europe/georgia-latest.osm.pbf
//   ways.json       — Overpass: area["name:en"="Tbilisi"]["admin_level"="4"]->.a;way["highway"]["name"](area.a);out tags;
// Needs `osm-pbf-parser` (not a project dependency): set OSM_PBF_PARSER to its install path, or npm i it nearby.
// Usage: node 0-pbf2geom.js georgia.osm.pbf ways.json geom.json   (≈2 GB heap: node --max-old-space-size=6000)
const fs = require('fs');
const [pbf, waysJson, out] = process.argv.slice(2);
const parseOSM = require(process.env.OSM_PBF_PARSER || 'osm-pbf-parser');
const { Writable } = require('stream');
const through = { obj: fn => new Writable({ objectMode: true, write: fn }) };
const want = new Set(JSON.parse(fs.readFileSync(waysJson, 'utf8')).elements.map(w => String(w.id)));
const S = 41.55, N = 41.90, W = 44.55, E = 45.10;
const nodes = new Map();
const res = [];
let nNodes = 0;
fs.createReadStream(pbf).pipe(parseOSM()).pipe(through.obj((items, enc, next) => {
  for (const it of items) {
    if (it.type === 'node') {
      nNodes++;
      if (it.lat >= S && it.lat <= N && it.lon >= W && it.lon <= E) nodes.set(String(it.id), [it.lat, it.lon]);
    } else if (it.type === 'way' && want.has(String(it.id))) {
      const g = it.refs.map(r => nodes.get(String(r))).filter(Boolean);
      if (g.length >= 2) res.push({ type: 'way', id: +it.id, tags: it.tags, geometry: g.map(([lat, lon]) => ({ lat, lon })) });
    }
  }
  next();
})).on('finish', () => {
  fs.writeFileSync(out, JSON.stringify({ elements: res }));
  console.log('nodes seen', nNodes, 'kept', nodes.size, 'ways', res.length, '/', want.size);
});
