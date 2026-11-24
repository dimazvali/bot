// Fetch the world's twin-town graph from Wikidata (P190 "twinned administrative body").
// Usage: node scripts/lab-twins/fetch.js <workdir>
// Writes <workdir>/pairs.json (directed Q-id pairs), <workdir>/places.json (coords, country, labels,
// population, sitelinks per entity), <workdir>/countries.json and <workdir>/land.geojson.
// Resumable: every batch is saved as soon as it arrives; honours 429 Retry-After.
const fs = require('fs');
const dir = process.argv[2];
if (!dir) { console.error('usage: fetch.js <workdir>'); process.exit(1); }
fs.mkdirSync(dir, { recursive: true });
const BATCH = 1500;
const UA = { 'User-Agent': 'twin-towns-map/0.1 (research script)', Accept: 'application/sparql-results+json' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const qid = u => u.split('/').pop();

async function sparql(query) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const r = await fetch('https://query.wikidata.org/sparql', {
      method: 'POST', headers: { ...UA, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'query=' + encodeURIComponent(query),
    }).catch(e => ({ ok: false, status: 'net ' + e.message, headers: new Map() }));
    if (r.ok) {
      // a query that times out mid-stream comes back 200 with truncated JSON: retry it
      const text = await r.text();
      try { return JSON.parse(text).results.bindings; } catch (e) { console.log('  truncated response, retry'); await sleep(10000); continue; }
    }
    const wait = (+(r.headers.get && r.headers.get('retry-after')) || 20 + attempt * 15) * 1000;
    console.log('  HTTP', r.status, 'retry in', wait / 1000, 's');
    await sleep(wait);
  }
  throw new Error('sparql failed');
}

(async () => {
  const pairsFile = dir + '/pairs.json';
  if (!fs.existsSync(pairsFile)) {
    const rows = await sparql('SELECT ?a ?b WHERE { ?a wdt:P190 ?b . }');
    const pairs = rows.filter(r => r.a.type === 'uri' && r.b.type === 'uri').map(r => [qid(r.a.value), qid(r.b.value)])
      .filter(([a, b]) => /^Q\d+$/.test(a) && /^Q\d+$/.test(b) && a !== b);
    fs.writeFileSync(pairsFile, JSON.stringify(pairs));
    console.log('pairs', pairs.length);
  }
  const pairs = JSON.parse(fs.readFileSync(pairsFile, 'utf8'));
  const ids = [...new Set(pairs.flat())].sort();
  console.log('entities', ids.length);

  const placesFile = dir + '/places.json';
  const places = fs.existsSync(placesFile) ? JSON.parse(fs.readFileSync(placesFile, 'utf8')) : {};
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH).filter(id => !(id in places));
    if (!chunk.length) continue;
    const rows = await sparql(`SELECT ?p ?coord ?c ?ru ?en ?ka ?pop ?sl WHERE {
      VALUES ?p { ${chunk.map(id => 'wd:' + id).join(' ')} }
      OPTIONAL { ?p p:P625 ?cs . ?cs ps:P625 ?coord . ?cs wikibase:rank ?cr FILTER(?cr != wikibase:DeprecatedRank) }
      OPTIONAL { ?p wdt:P17 ?c }
      OPTIONAL { ?p rdfs:label ?ru FILTER(LANG(?ru)="ru") }
      OPTIONAL { ?p rdfs:label ?en FILTER(LANG(?en)="en") }
      OPTIONAL { ?p rdfs:label ?ka FILTER(LANG(?ka)="ka") }
      OPTIONAL { ?p wdt:P1082 ?pop }
      OPTIONAL { ?p wikibase:sitelinks ?sl }
    }`);
    for (const id of chunk) places[id] = places[id] || { c: [], co: [] };
    for (const r of rows) {
      const e = places[qid(r.p.value)];
      if (r.coord) { const m = /Point\(([-\d.eE]+) ([-\d.eE]+)\)/.exec(r.coord.value); if (m && !e.co.some(x => x[0] === +m[1] && x[1] === +m[2])) e.co.push([+m[1], +m[2]]); }
      if (r.c && !e.c.includes(qid(r.c.value))) e.c.push(qid(r.c.value));
      if (r.ru) e.ru = r.ru.value;
      if (r.en) e.en = r.en.value;
      if (r.ka) e.ka = r.ka.value;
      if (r.pop && !isNaN(+r.pop.value)) e.pop = Math.max(e.pop || 0, +r.pop.value);
      if (r.sl) e.sl = +r.sl.value;
    }
    fs.writeFileSync(placesFile, JSON.stringify(places));
    console.log('places batch', i, '/', ids.length, 'rows', rows.length);
    await sleep(1000);
  }

  const countriesFile = dir + '/countries.json';
  if (!fs.existsSync(countriesFile)) {
    const cids = [...new Set(Object.values(places).flatMap(p => p.c))];
    const out = {};
    for (let i = 0; i < cids.length; i += BATCH) {
      const rows = await sparql(`SELECT ?c ?ru ?en ?ka ?iso WHERE { VALUES ?c { ${cids.slice(i, i + BATCH).map(id => 'wd:' + id).join(' ')} }
        OPTIONAL { ?c rdfs:label ?ru FILTER(LANG(?ru)="ru") } OPTIONAL { ?c rdfs:label ?en FILTER(LANG(?en)="en") }
        OPTIONAL { ?c rdfs:label ?ka FILTER(LANG(?ka)="ka") } OPTIONAL { ?c wdt:P297 ?iso } }`);
      for (const r of rows) out[qid(r.c.value)] = { ru: r.ru?.value, en: r.en?.value, ka: r.ka?.value, iso: r.iso?.value };
    }
    fs.writeFileSync(countriesFile, JSON.stringify(out));
    console.log('countries', Object.keys(out).length);
  }

  const landFile = dir + '/land.geojson';
  if (!fs.existsSync(landFile)) {
    const r = await fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson', { headers: { 'User-Agent': UA['User-Agent'] } });
    if (!r.ok) throw new Error('land HTTP ' + r.status);
    fs.writeFileSync(landFile, await r.text());
    console.log('land saved');
  }
})().catch(e => { console.error(e); process.exit(1); });
