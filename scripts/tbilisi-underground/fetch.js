// Downloads raw inputs for the Tbilisi underground 3D model (dimazvali.com/lab/underground).
// Usage: node scripts/tbilisi-underground/fetch.js <raw dir>
// Writes <raw dir>/raw.json, raw2.json, rel.json (Overpass) and dem.json (SRTM 30 m via OpenTopoData).
// Raw dumps are ~3 MB and are not committed; run build.js afterwards.
const fs = require('fs');
const path = require('path');

const dir = process.argv[2];
if (!dir) { console.error('usage: fetch.js <raw dir>'); process.exit(1); }
fs.mkdirSync(dir, { recursive: true });

const BB = '41.62,44.65,41.85,45.05';
const BB2 = '41.665,44.70,41.80,44.885';
const Q1 = `[out:json][timeout:180];
(
  way["railway"="subway"](${BB});
  node["railway"="station"]["station"="subway"](${BB});
  node["railway"="subway_entrance"](${BB});
  way["tunnel"](${BB});
  way["location"~"underground"](${BB});
  way["layer"~"^-"](${BB});
  way["man_made"="pipeline"](${BB});
  way["power"="cable"](${BB});
);
out geom tags;`;
const Q2 = `[out:json][timeout:180];
(
  way["waterway"="river"](${BB2});
  nwr["amenity"="parking"]["parking"="underground"](${BB2});
  way["highway"~"^(motorway|trunk|primary)$"](${BB2});
);
out geom tags;`;
// metro route relations: ordered members per line (ways themselves are in raw.json)
const Q3 = `[out:json][timeout:120];
relation["route"="subway"](${BB});
out body;`;
const MIRRORS =['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function overpass(q, file) {
  for (const url of MIRRORS) {
    try {
      const r = await fetch(url, { method: 'POST', body: new URLSearchParams({ data: q }), headers: { 'User-Agent': 'tbilisi-underground-model' } });
      const txt = await r.text();
      const j = JSON.parse(txt);
      fs.writeFileSync(path.join(dir, file), txt);
      console.log(file, j.elements.length, 'elements from', url);
      return;
    } catch (e) { console.error(url, 'failed:', e.message); }
  }
  throw new Error('all Overpass mirrors failed for ' + file);
}

async function dem() {
  const S = 41.665, N = 41.80, W = 44.70, E = 44.885, nx = 56, ny = 48;
  const pts = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) pts.push([S + (N - S) * j / (ny - 1), W + (E - W) * i / (nx - 1)]);
  const ele = [];
  for (let k = 0; k < pts.length; k += 100) {
    const url = 'https://api.opentopodata.org/v1/srtm30m?locations=' + pts.slice(k, k + 100).map(p => p[0].toFixed(5) + ',' + p[1].toFixed(5)).join('|');
    let j;
    for (let t = 0; t < 6 && !(j && j.results); t++) {
      try { j = await (await fetch(url)).json(); } catch (e) { j = null; }
      if (!(j && j.results)) await sleep(3000);
    }
    if (!(j && j.results)) throw new Error('OpenTopoData failed at chunk ' + k);
    ele.push(...j.results.map(x => x.elevation));
    await sleep(1100); // public API: 1 request/second
  }
  fs.writeFileSync(path.join(dir, 'dem.json'), JSON.stringify({ S, N, W, E, nx, ny, ele }));
  console.log('dem.json', ele.length, 'points', Math.min(...ele), '..', Math.max(...ele), 'm');
}

(async () => {
  await overpass(Q1, 'raw.json');
  await overpass(Q2, 'raw2.json');
  await overpass(Q3, 'rel.json');
  await dem();
})().catch(e => { console.error(e); process.exit(1); });
