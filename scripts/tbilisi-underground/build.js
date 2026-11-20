// Builds public/tbilisi/underground/model.json for dimazvali.com/tbilisi/underground.
// Inputs come from fetch.js (raw.json, raw2.json, dem.json in <raw dir>).
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
const lineOf = (lat, lon) => {
  let best = null, bd = 1e18;
  for (const s of stations) { const [x, z] = proj(lat, lon), dx = x - s.xz[0], dz = z - s.xz[1], dd = dx * dx + dz * dz; if (dd < bd) { bd = dd; best = s; } }
  return best.line;
};
function railAltAt(lat, lon, line) {
  const [x, z] = proj(lat, lon);
  const c = stations.filter(s => s.line === line || s.n.startsWith("Station Square"))
    .map(s => ({ s, d: Math.hypot(x - s.xz[0], z - s.xz[1]) })).sort((a, b) => a.d - b.d).slice(0, 2);
  if (c[0].d < 1) return c[0].s.rail;
  const w0 = 1 / c[0].d, w1 = 1 / c[1].d;
  return (c[0].s.rail * w0 + c[1].s.rail * w1) / (w0 + w1);
}

const layerOf = t => { const l = parseFloat(t.layer); return isNaN(l) ? -1 : l; };
function classify(t) {
  if (t.railway === "subway") return "metro";
  if (t.tunnel === "building_passage" || t.covered) return null;
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
    const mid = pts[Math.floor(pts.length / 2)], line = lineOf(mid.lat, mid.lon);
    f.line = line; f.tunnel = t.tunnel === "yes";
    for (const p of pts) {
      const g = ground(p.lat, p.lon);
      let d;
      if (t.tunnel === "yes") d = Math.max(4, g - railAltAt(p.lat, p.lon, line));
      else if (t.bridge === "yes") d = -Math.max(1, layerOf(t)) * 7;
      else d = 0;
      const [x, z] = proj(p.lat, p.lon); f.p.push(R(x), R(z), R(g), R(d));
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
};
fs.writeFileSync(outFile, JSON.stringify(out));
const cnt = {}; feats.forEach(f => cnt[f.k] = (cnt[f.k] || 0) + 1);
console.log("feats", cnt, "entrances", entrances.length, "surface", surface.length, "parkings", parkings.length, "bytes", fs.statSync(outFile).size);
const met = feats.filter(f => f.k === "metro"); let maxD = 0; met.forEach(f => { for (let i = 3; i < f.p.length; i += 4) maxD = Math.max(maxD, f.p[i]); }); console.log("max metro depth", maxD);
