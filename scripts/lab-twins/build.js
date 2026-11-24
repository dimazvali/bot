// Build public/lab/twins/data.json from the files fetch.js saved.
// Usage: node scripts/lab-twins/build.js <workdir>
// Twinning is symmetric in reality but often recorded on one side only in Wikidata, so an edge
// exists if either city lists the other. Places without coordinates are dropped (with their edges).
const fs = require('fs');
const path = require('path');
const dir = process.argv[2];
if (!dir) { console.error('usage: build.js <workdir>'); process.exit(1); }
const read = f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
const pairs = read('pairs.json');
const places = read('places.json');
const countries = read('countries.json');
const land = read('land.geojson');

// Tbilisi ties that Wikipedia lists but Wikidata lacks (checked 2026-11-24): Minsk, Paris, Budapest,
// Prague, and Shanghai (friendship memorandum, 29 May 2025)
const EXTRA = [['Q994', 'Q2280'], ['Q994', 'Q90'], ['Q994', 'Q1781'], ['Q994', 'Q1085'], ['Q994', 'Q8686']];

const ok = id => places[id] && places[id].co.length && (places[id].ru || places[id].en || places[id].ka);
const key = (a, b) => (a < b ? a + ' ' + b : b + ' ' + a);
const edgeSet = new Set();
for (const [a, b] of pairs.concat(EXTRA)) if (a !== b && ok(a) && ok(b)) edgeSet.add(key(a, b));

const deg = new Map();
for (const k of edgeSet) for (const id of k.split(' ')) deg.set(id, (deg.get(id) || 0) + 1);
// most famous first (sitelinks), so the client can label and pick puzzle cities by index
const ids = [...deg.keys()].sort((a, b) => (places[b].sl || 0) - (places[a].sl || 0) || deg.get(b) - deg.get(a));
const index = new Map(ids.map((id, i) => [id, i]));

const cList = [], cIndex = new Map();
// disputed places (Jerusalem…) carry several current countries: show them all, "A / B"
function country(p) {
  let picks = p.c.filter(c => countries[c] && countries[c].iso);
  if (!picks.length) picks = p.c.filter(c => countries[c]).slice(0, 1);
  if (!picks.length) return -1;
  picks.sort();
  const key = picks.join('+');
  if (!cIndex.has(key)) {
    const f = l => picks.map(c => countries[c][l] || countries[c].en || countries[c].ru || '').join(' / ');
    cIndex.set(key, cList.length); cList.push([f('ru'), f('en'), picks.map(c => countries[c].iso || '').join('/')]);
  }
  return cIndex.get(key);
}
const r2 = x => Math.round(x * 100) / 100;
const nodes = { id: [], ru: [], en: [], lon: [], lat: [], c: [], sl: [], pop: [] };
for (const id of ids) {
  const p = places[id];
  nodes.id.push(+id.slice(1));
  nodes.en.push(p.en || p.ru || p.ka);
  nodes.ru.push(p.ru && p.ru !== p.en ? p.ru : 0); // 0 = same as en
  nodes.lon.push(r2(p.co[0][0]));
  nodes.lat.push(r2(p.co[0][1]));
  nodes.c.push(country(p));
  nodes.sl.push(p.sl || 0);
  nodes.pop.push(p.pop ? Math.round(p.pop) : 0);
}
const edges = [];
for (const k of edgeSet) { const [a, b] = k.split(' ').map(id => index.get(id)); edges.push(a < b ? [a, b] : [b, a]); }
edges.sort((x, y) => x[0] - y[0] || x[1] - y[1]);

// land: rings of [lon, lat] rounded to 0.1°, flattened
const r1 = x => Math.round(x * 10) / 10;
const rings = [];
for (const f of land.features) {
  const g = f.geometry;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  for (const poly of polys) for (const ring of poly) {
    const flat = [];
    for (const [x, y] of ring) { const a = r1(x), b = r1(y); if (flat.length && flat[flat.length - 2] === a && flat[flat.length - 1] === b) continue; flat.push(a, b); }
    if (flat.length >= 8) rings.push(flat);
  }
}

const out = { built: new Date().toISOString().slice(0, 10), countries: cList, nodes, edges: edges.flat(), land: rings };
const outFile = path.join(__dirname, '../../public/lab/twins/data.json');
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(out));

// --- stats ---
const n = ids.length, adj = Array.from({ length: n }, () => []);
for (const [a, b] of edges) { adj[a].push(b); adj[b].push(a); }
const comp = new Int32Array(n).fill(-1), sizes = [];
for (let s = 0; s < n; s++) if (comp[s] < 0) {
  let q = [s], c = sizes.length, cnt = 0; comp[s] = c;
  while (q.length) { const nq = []; for (const u of q) { cnt++; for (const v of adj[u]) if (comp[v] < 0) { comp[v] = c; nq.push(v); } } q = nq; }
  sizes.push(cnt);
}
const bfs = s => { const d = new Int32Array(n).fill(-1); d[s] = 0; let q = [s]; while (q.length) { const nq = []; for (const u of q) for (const v of adj[u]) if (d[v] < 0) { d[v] = d[u] + 1; nq.push(v); } q = nq; } return d; };
const tb = index.get('Q994'), dt = bfs(tb), hist = {};
for (const x of dt) hist[x] = (hist[x] || 0) + 1;
const name = i => nodes.ru[i] || nodes.en[i];
console.log('nodes', n, 'edges', edges.length, 'countries', cList.length, 'land rings', rings.length);
console.log('components', sizes.length, 'largest', Math.max(...sizes), 'singletons-ish (<=2)', sizes.filter(s => s <= 2).length);
console.log('Tbilisi degree', adj[tb].length, 'distance histogram', hist);
console.log('top degree', [...adj.keys()].sort((a, b) => adj[b].length - adj[a].length).slice(0, 12).map(i => name(i) + ' ' + adj[i].length).join(', '));
console.log('size', (fs.statSync(outFile).size / 1024).toFixed(0), 'KB');
