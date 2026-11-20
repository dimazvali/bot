// Builds public/tbilisi/underground/model.json for dimazvali.com/tbilisi/underground.
// Inputs come from fetch.js (raw.json, raw2.json, rel.json, dem.json in <raw dir>).
// Usage: node scripts/tbilisi-underground/build.js <raw dir> public/tbilisi/underground/model.json
// Coordinates: local metres around (LAT0, LON0), x east, z south. Each line point is [x, z, ground m a.s.l., depth m].
const fs = require("fs"), path = require("path");
const dir = process.argv[2], outFile = process.argv[3];
const raw = JSON.parse(fs.readFileSync(path.join(dir, "raw.json"))).elements;
let raw2 = [];
try { raw2 = JSON.parse(fs.readFileSync(path.join(dir, "raw2.json"))).elements; } catch (e) { console.error("raw2 missing, skipping surface refs/parkings"); }
const dem = JSON.parse(fs.readFileSync(path.join(dir, "dem.json")));

const LAT0 = 41.73, LON0 = 44.79, KX = 111320 * Math.cos(LAT0 * Math.PI / 180), KY = 110574;
const inBox = (lat, lon) => lat >= dem.S && lat <= dem.N && lon >= dem.W && lon <= dem.E;
const proj = (lat, lon) => [(lon - LON0) * KX, -(lat - LAT0) * KY]; // x east, z south
function ground(lat, lon) {
  const fx = (lon - dem.W) / (dem.E - dem.W) * (dem.nx - 1), fy = (lat - dem.S) / (dem.N - dem.S) * (dem.ny - 1);
  const i = Math.max(0, Math.min(dem.nx - 2, Math.floor(fx))), j = Math.max(0, Math.min(dem.ny - 2, Math.floor(fy)));
  const u = Math.min(1, Math.max(0, fx - i)), v = Math.min(1, Math.max(0, fy - j)), g = (a, b) => dem.ele[b * dem.nx + a];
  return (g(i, j) * (1 - u) + g(i + 1, j) * u) * (1 - v) + (g(i, j + 1) * (1 - u) + g(i + 1, j + 1) * u) * v;
}

// Station depths (m below surface; negative = elevated). src: m = ru.wikipedia infobox/text (checked 2026-11-20),
// e = estimate from construction type (deep/shallow) — no published figure found.
const ST = {
  "Akhmeteli Theatre": [25, "e", "колонная трёхсводчатая, глубокого заложения", 1, "Ахметелис театри"],
  "Sarajishvili": [25, "e", "колонная трёхсводчатая, глубокого заложения", 1, "Сараджишвили"],
  "Guramishvili": [25, "e", "односводчатая, глубокого заложения", 1, "Гурамишвили"],
  "Ghrmaghele": [25, "e", "односводчатая, глубокого заложения", 1, "Грмагеле"],
  "Didube": [0, "m", "наземная, островная платформа", 1, "Дидубе"],
  "Gotsiridze": [-7, "m", "эстакадная, береговые платформы", 1, "Гоциридзе"],
  "Nadzaledevi": [35, "e", "пилонная трёхсводчатая, глубокого заложения", 1, "Надзаладеви"],
  "Station Square-1": [40, "e", "пилонная трёхсводчатая, глубокого заложения", 1, "Садгурис моедани-1"],
  "Marjanishvili": [46, "m", "пилонная трёхсводчатая, глубокого заложения", 1, "Марджанишвили"],
  "Rustaveli": [65, "m", "колонная трёхсводчатая, глубокого заложения — самая глубокая", 1, "Руставели"],
  "Liberty Square": [60, "m", "колонная трёхсводчатая, глубокого заложения", 1, "Тависуплебис моедани"],
  "Avlabari": [54, "m", "пилонная трёхсводчатая, глубокого заложения", 1, "Авлабари"],
  "300 Aragveli": [40, "e", "пилонная трёхсводчатая, глубокого заложения", 1, "300 Арагвели"],
  "Isani": [29, "m", "колонная трёхсводчатая, глубокого заложения", 1, "Исани"],
  "Samgori": [13, "m", "колонная трёхпролётная, мелкого заложения (8–19 м)", 1, "Самгори"],
  "Varketili": [33, "m", "односводчатая, глубокого заложения", 1, "Варкетили"],
  "Station Square-2": [40, "e", "односводчатая, глубокого заложения, в скальном грунте", 2, "Садгурис моедани-2"],
  "Tsereteli": [35, "e", "колонная трёхсводчатая, глубокого заложения", 2, "Церетели"],
  "Technical University": [40, "e", "односводчатая, глубокого заложения, в скальном грунте", 2, "Техникури университети"],
  "Medical University": [12, "e", "колонная трёхпролётная, мелкого заложения", 2, "Медицинский университет"],
  "Delisi": [12, "e", "односводчатая, мелкого заложения", 2, "Делиси"],
  "Vazha-Pshavela": [8, "e", "колонная трёхпролётная, мелкого заложения — ближе всех к поверхности", 2, "Важа-Пшавела"],
  "State University": [47, "m", "односводчатая, глубокого заложения", 2, "Государственный университет"],
};

const R = v => Math.round(v * 10) / 10;
const stations = raw.filter(e => e.tags && e.tags.railway === "station").map(s => {
  const n = s.tags["name:en"], d = ST[n];
  const g = ground(s.lat, s.lon);
  return { n, ru: d[4], ka: s.tags["name:ka"] || s.tags.name, line: d[3], depth: d[0], src: d[1], type: d[2], lat: s.lat, lon: s.lon, xz: proj(s.lat, s.lon).map(R), g: R(g), rail: g - d[0] };
});
// ---- metro lines from OSM route relations (route=subway, ref 1/2).
// Each line becomes one ordered polyline ("chain") with chainage in metres. Track depth is interpolated
// linearly by chainage between consecutive stations, then re-measured against the relief above each point.
const rel = JSON.parse(fs.readFileSync(path.join(dir, "rel.json"))).elements;
const wayById = {}; raw.forEach(e => { if (e.type === "way") wayById[e.id] = e; });
const routeWayLine = {}; // way id -> line number (both directions' tracks)
for (const r of rel) for (const m of r.members) if (m.type === "way") routeWayLine[m.ref] = +r.tags.ref;
function buildChain(r) {
  const key = p => p.lat.toFixed(7) + "," + p.lon.toFixed(7);
  const segs = r.members.filter(m => m.type === "way" && wayById[m.ref]).map(m => wayById[m.ref].geometry.map(g => ({ lat: g.lat, lon: g.lon })));
  let line = segs.shift();
  while (segs.length) {
    const a = key(line[0]), b = key(line[line.length - 1]);
    const i = segs.findIndex(s => [key(s[0]), key(s[s.length - 1])].some(k => k === a || k === b));
    if (i < 0) throw new Error(`route ${r.id}: ways do not form a continuous chain`);
    const s = segs.splice(i, 1)[0], s0 = key(s[0]), s1 = key(s[s.length - 1]);
    if (s0 === b) line = line.concat(s.slice(1)); else if (s1 === b) line = line.concat(s.reverse().slice(1));
    else if (s1 === a) line = s.concat(line.slice(1)); else line = s.reverse().concat(line.slice(1));
  }
  let c = 0;
  line.forEach((p, i) => { p.xz = proj(p.lat, p.lon); if (i) c += Math.hypot(p.xz[0] - line[i - 1].xz[0], p.xz[1] - line[i - 1].xz[1]); p.ch = c; });
  return line;
}
function projectOn(chain, xz) {
  let best = { d: 1e18 };
  for (let i = 1; i < chain.length; i++) {
    const a = chain[i - 1].xz, b = chain[i].xz, dx = b[0] - a[0], dz = b[1] - a[1], L = dx * dx + dz * dz;
    const t = L ? Math.max(0, Math.min(1, ((xz[0] - a[0]) * dx + (xz[1] - a[1]) * dz) / L)) : 0;
    const px = a[0] + t * dx, pz = a[1] + t * dz, d = Math.hypot(xz[0] - px, xz[1] - pz);
    if (d < best.d) best = { d, ch: chain[i - 1].ch + t * Math.sqrt(L), x: px, z: pz, ang: Math.atan2(dz, dx) };
  }
  return best;
}
const chains = {};
for (const lineNo of [1, 2]) {
  const r = rel.find(x => +x.tags.ref === lineNo);
  if (!r) throw new Error("no route relation for line " + lineNo);
  const chain = buildChain(r);
  // stations of this line in chainage order (Station Square-1 is line 1, -2 is line 2)
  const st = stations.filter(s => s.line === lineNo).map(s => ({ s, ...projectOn(chain, s.xz) }));
  for (const x of st) if (x.d > 60) throw new Error(`${x.s.n} is ${x.d.toFixed(0)} m from line ${lineNo} track`);
  st.sort((a, b) => a.ch - b.ch);
  for (const x of st) { x.s.ch = Math.round(x.ch); x.s.ang = R(x.ang); }
  chains[lineNo] = { chain, st, len: chain[chain.length - 1].ch };
  console.log(`line ${lineNo}: ${(chains[lineNo].len / 1000).toFixed(2)} km, ` + st.map(x => x.s.n).join(" → "));
}
function railAltAt(lineNo, ch) {
  const st = chains[lineNo].st;
  if (ch <= st[0].ch) return st[0].s.rail;
  for (let i = 1; i < st.length; i++) if (ch <= st[i].ch) {
    const a = st[i - 1], b = st[i], t = (ch - a.ch) / (b.ch - a.ch);
    return a.s.rail + t * (b.s.rail - a.s.rail);
  }
  return st[st.length - 1].s.rail;
}
// nearest line for a point (service tracks are not in route relations)
function nearestLine(xz) {
  let best = null;
  for (const n of [1, 2]) { const p = projectOn(chains[n].chain, xz); if (!best || p.d < best.d) best = { line: n, ...p }; }
  return best;
}

const layerOf = t => { const l = parseFloat(t.layer); return isNaN(l) ? -1 : l; };
function classify(t) {
  if (t.railway === "subway") return "metro";
  if (t.tunnel === "building_passage" || t.covered) return null;
  if (t.railway === "construction" || t.construction) return null; // e.g. the never-built Tbilisi Railway Bypass
  const under = t.tunnel === "yes" || t.tunnel === "culvert" || /underground/.test(t.location || "") || layerOf(t) < 0;
  if (!under) return null;
  if (t.waterway) return "water";
  if (t.man_made === "pipeline") return "pipe";
  if (t.power === "cable") return "cable";
  if (t.railway) return "rail";
  if (t.highway && /^(footway|steps|pedestrian|path|corridor|elevator)$/.test(t.highway)) return "walk";
  if (t.highway) return "road";
  return null;
}
const BASE = { water: 4, pipe: 2.5, cable: 1.5, rail: 10, walk: 5, road: 8 };

const feats = [];
for (const e of raw) {
  if (e.type !== "way" || !e.geometry || !e.tags) continue;
  const t = e.tags, k = classify(t);
  if (!k) continue;
  const pts = e.geometry.filter(p => p && inBox(p.lat, p.lon));
  if (pts.length < 2) continue;
  const f = { k, name: t["name:ru"] || t["name:en"] || t.name || "", p: [] };
  if (k === "metro") {
    // main = track of a route relation; everything else is service (depot yard, siding, crossover, connector)
    const mid = pts[Math.floor(pts.length / 2)];
    const line = routeWayLine[e.id] || nearestLine(proj(mid.lat, mid.lon)).line;
    f.line = line; f.tunnel = t.tunnel === "yes";
    if (!routeWayLine[e.id]) f.svc = t.service || "other";
    for (const p of pts) {
      const g = ground(p.lat, p.lon), xz = proj(p.lat, p.lon);
      let d;
      if (t.tunnel === "yes") d = Math.max(4, g - railAltAt(line, projectOn(chains[line].chain, xz).ch));
      else if (t.bridge === "yes") d = -Math.max(1, layerOf(t)) * 7;
      else d = 0;
      f.p.push(R(xz[0]), R(xz[1]), R(g), R(d));
    }
  } else {
    const L = layerOf(t), extra = L < -1 ? (-L - 1) * 4 : 0;
    const d = BASE[k] + extra;
    for (const p of pts) { const [x, z] = proj(p.lat, p.lon); f.p.push(R(x), R(z), R(ground(p.lat, p.lon)), d); }
    f.sub = t.waterway || t.highway || t.railway || t.substance || "";
  }
  feats.push(f);
}

// entrances → nearest station (for escalator shafts)
const entrances = [];
for (const e of raw.filter(e => e.tags && e.tags.railway === "subway_entrance" && inBox(e.lat, e.lon))) {
  const [x, z] = proj(e.lat, e.lon);
  let best = null, bd = 1e9;
  for (const s of stations) { const d = Math.hypot(x - s.xz[0], z - s.xz[1]); if (d < bd) { bd = d; best = s; } }
  if (bd < 400) entrances.push({ xz: [R(x), R(z)], g: R(ground(e.lat, e.lon)), st: best.n });
}

// surface references + underground parkings
const surface = [], parkings = [];
for (const e of raw2) {
  const t = e.tags || {};
  if (t.amenity === "parking") {
    const pts = e.geometry || (e.lat ? [{ lat: e.lat, lon: e.lon }] : null) || (e.center ? [e.center] : null);
    if (!pts) continue;
    const pp = pts.filter(p => p && inBox(p.lat, p.lon));
    if (!pp.length) continue;
    const arr = []; for (const p of pp) { const [x, z] = proj(p.lat, p.lon); arr.push(R(x), R(z), R(ground(p.lat, p.lon))); }
    parkings.push({ name: t.name || "", p: arr, levels: parseInt(t["parking:levels"] || t["building:levels:underground"] || "1") || 1 });
    continue;
  }
  if (!e.geometry) continue;
  const k = t.waterway === "river" ? ((t["name:en"] || "").match(/Mtkvari|Kura/) ? "river" : "stream") : "road";
  if (t.tunnel) continue;
  const pp = e.geometry.filter(p => p && inBox(p.lat, p.lon));
  if (pp.length < 2) continue;
  const arr = []; for (const p of pp) { const [x, z] = proj(p.lat, p.lon); arr.push(R(x), R(z), R(ground(p.lat, p.lon))); }
  surface.push({ k, p: arr });
}

const out = {
  origin: [LAT0, LON0], dem: { nx: dem.nx, ny: dem.ny, x0: R(proj(dem.S, dem.W)[0]), x1: R(proj(dem.S, dem.E)[0]), z0: R(proj(dem.S, dem.W)[1]), z1: R(proj(dem.N, dem.W)[1]), ele: dem.ele.map(Math.round) },
  stations: stations.map(({ rail, lat, lon, ...s }) => s), entrances, feats, surface, parkings,
  lines: { 1: Math.round(chains[1].len), 2: Math.round(chains[2].len) },
};
fs.writeFileSync(outFile, JSON.stringify(out));
const cnt = {}; feats.forEach(f => cnt[f.k] = (cnt[f.k] || 0) + 1);
console.log("feats", cnt, "entrances", entrances.length, "surface", surface.length, "parkings", parkings.length, "bytes", fs.statSync(outFile).size);
const met = feats.filter(f => f.k === "metro");
console.log("metro ways: main", met.filter(f => !f.svc).length, "service", met.filter(f => f.svc).length,
  JSON.stringify(met.filter(f => f.svc).reduce((a, f) => (a[f.svc] = (a[f.svc] || 0) + 1, a), {})));
let maxD = { d: 0 };
met.filter(f => !f.svc).forEach(f => { for (let i = 3; i < f.p.length; i += 4) if (f.p[i] > maxD.d) maxD = { d: f.p[i], x: f.p[i - 3], z: f.p[i - 2], g: f.p[i - 1] }; });
console.log("max main-track depth", JSON.stringify(maxD));
