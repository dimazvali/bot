// SPb: resolve street etymologies on Wikidata. Step 1: street items (OSM `wikidata`) → their P138 "named after".
// Step 2: every namesake → type, occupations, gender, citizenship/birthplace country, labels, birth year.
// Resumable (saves per batch), honours 429 Retry-After.  Usage: node 1-wikidata.js <dir with geom.json>
const fs = require('fs');
const dir = process.argv[2];
const ways = JSON.parse(fs.readFileSync(dir + '/geom.json', 'utf8')).elements;
const UA = { 'User-Agent': 'street-names-research/0.1 (research script)', Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const load = f => fs.existsSync(dir + '/' + f) ? JSON.parse(fs.readFileSync(dir + '/' + f, 'utf8')) : {};
const save = (f, d) => fs.writeFileSync(dir + '/' + f, JSON.stringify(d));
async function sparql(q) {
  for (let a = 0; a < 6; a++) {
    const r = await fetch('https://query.wikidata.org/sparql', { method: 'POST', headers: UA, body: 'query=' + encodeURIComponent(q), signal: AbortSignal.timeout(90000) })
      .catch(e => ({ ok: false, status: e.message, headers: new Map() }));
    if (r.ok) return (await r.json()).results.bindings;
    console.log('HTTP', r.status);
    await sleep((+(r.headers.get && r.headers.get('retry-after')) || 30) * 1000);
  }
  throw new Error('gave up');
}
const id = u => u.split('/').pop();
(async () => {
  // 1. street items → named after
  const streetIds = [...new Set(ways.map(w => w.tags.wikidata).filter(x => /^Q\d+$/.test(x || '')))];
  const p138 = load('p138.json');
  const todo1 = streetIds.filter(s => !(s in p138));
  for (let i = 0; i < todo1.length; i += 200) {
    const b = todo1.slice(i, i + 200);
    const rows = await sparql(`SELECT ?s ?n WHERE { VALUES ?s { ${b.map(x => 'wd:' + x).join(' ')} } OPTIONAL { ?s wdt:P138 ?n } }`);
    for (const x of b) p138[x] = p138[x] || [];
    for (const r of rows) if (r.n) { const s = id(r.s.value); if (!p138[s].includes(id(r.n.value))) p138[s].push(id(r.n.value)); }
    save('p138.json', p138);
    console.log('streets', i + b.length, '/', todo1.length);
    await sleep(1500);
  }
  // 2. namesakes
  const ety = ways.flatMap(w => String(w.tags['name:etymology:wikidata'] || '').split(';').map(s => s.trim())).filter(x => /^Q\d+$/.test(x));
  const all = [...new Set(ety.concat(Object.values(p138).flat()))];
  const ents = load('ents.json');
  const todo2 = all.filter(x => !(x in ents));
  for (let i = 0; i < todo2.length; i += 120) {
    const b = todo2.slice(i, i + 120);
    const rows = await sparql(`SELECT ?e ?ru ?en ?b ?g
      (GROUP_CONCAT(DISTINCT ?t;separator="|") AS ?types) (GROUP_CONCAT(DISTINCT ?tl;separator="|") AS ?typeL)
      (GROUP_CONCAT(DISTINCT ?ol;separator="|") AS ?occL) (GROUP_CONCAT(DISTINCT ?c;separator="|") AS ?cit)
      (GROUP_CONCAT(DISTINCT ?bc;separator="|") AS ?bornIn) (GROUP_CONCAT(DISTINCT ?pc;separator="|") AS ?country) WHERE {
      VALUES ?e { ${b.map(x => 'wd:' + x).join(' ')} }
      OPTIONAL { ?e rdfs:label ?ru FILTER(LANG(?ru)="ru") }
      OPTIONAL { ?e rdfs:label ?en FILTER(LANG(?en)="en") }
      OPTIONAL { ?e wdt:P31 ?t. OPTIONAL { ?t rdfs:label ?tl FILTER(LANG(?tl)="en") } }
      OPTIONAL { ?e wdt:P106 ?o. ?o rdfs:label ?ol FILTER(LANG(?ol)="en") }
      OPTIONAL { ?e wdt:P27 ?c }
      OPTIONAL { ?e wdt:P19/wdt:P17 ?bc }
      OPTIONAL { ?e wdt:P17 ?pc }
      OPTIONAL { ?e wdt:P21 ?g }
      OPTIONAL { ?e wdt:P569 ?bd. BIND(YEAR(?bd) AS ?b) }
    } GROUP BY ?e ?ru ?en ?b ?g`);
    for (const x of b) ents[x] = ents[x] || null;
    for (const r of rows) {
      const e = id(r.e.value);
      const sp = v => (v && v.value ? v.value.split('|').filter(Boolean) : []);
      if (ents[e]) continue; // several rows (labels/years): keep the first
      ents[e] = { ru: r.ru?.value, en: r.en?.value, b: r.b ? +r.b.value : null, g: r.g ? id(r.g.value) : null,
        types: sp(r.types).map(id), typeL: sp(r.typeL), occL: sp(r.occL), cit: sp(r.cit).map(id), bornIn: sp(r.bornIn).map(id), country: sp(r.country).map(id) };
    }
    save('ents.json', ents);
    console.log('ents', i + b.length, '/', todo2.length);
    await sleep(1500);
  }
  console.log('DONE', Object.keys(ents).length);
})().catch(e => { console.log('FAILED', e.message); process.exit(1); });
