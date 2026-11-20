// Look up street base names on Wikidata by exact en label/alias, in batches via VALUES.
// Resumable: every batch is saved into people.json as soon as it arrives; honours 429 Retry-After.
const fs = require('fs');
const dir = process.argv[2];
const BATCH = +(process.argv[3] || 150);
const out = dir + '/people.json';
const base = JSON.parse(fs.readFileSync(dir + '/base.json', 'utf8'));
const UA = { 'User-Agent': 'street-names-research/0.1 (research script)', Accept: 'application/sparql-results+json' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const variants = b => {
  const s = b.replace(/^(Marshal|General|Saint|Academician|King|Queen|Professor)\s+/i, '').trim();
  const v = new Set([s, s.replace(/Davit/g, 'David'), s.replace(/David/g, 'Davit'), s.replace(/q/g, 'k'), s.replace(/\s+Mepe$/, ''), s.replace(/\s+Mepe$/, ' of Georgia')]);
  return [...v].filter(Boolean);
};
const esc = s => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
const q = names => `SELECT ?l ?p ?en ?ru ?b (GROUP_CONCAT(DISTINCT ?o;separator="|") AS ?occ) (GROUP_CONCAT(DISTINCT ?ol;separator="|") AS ?occL) WHERE {
  VALUES ?l { ${names.map(n => `"${esc(n)}"@en`).join(' ')} }
  { ?p rdfs:label ?l } UNION { ?p skos:altLabel ?l }
  ?p wdt:P31 wd:Q5.
  OPTIONAL { ?p wdt:P569 ?bd. BIND(YEAR(?bd) AS ?b) }
  OPTIONAL { ?p rdfs:label ?en FILTER(LANG(?en)="en") }
  OPTIONAL { ?p rdfs:label ?ru FILTER(LANG(?ru)="ru") }
  OPTIONAL { ?p wdt:P106 ?o. OPTIONAL { ?o rdfs:label ?ol FILTER(LANG(?ol)="en") } }
} GROUP BY ?l ?p ?en ?ru ?b`;
(async () => {
  const all = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : {};
  if (Array.isArray(Object.values(all)[0]) && !all.__v2) for (const k of Object.keys(all)) delete all[k];
  all.__v2 = true;
  for (let i = 0; i < base.length; i += BATCH) {
    const key = 'b' + i;
    if (all[key]) continue;
    const names = [...new Set(base.slice(i, i + BATCH).flatMap(b => variants(b.b)))];
    let ok = false;
    for (let attempt = 0; attempt < 6 && !ok; attempt++) {
      const r = await fetch('https://query.wikidata.org/sparql', {
        method: 'POST', headers: { ...UA, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'query=' + encodeURIComponent(q(names)),
      }).catch(e => ({ ok: false, status: 'net ' + e.message, headers: new Map() }));
      if (r.ok) {
        all[key] = (await r.json()).results.bindings.map(b => ({
          l: b.l.value, id: b.p.value.split('/').pop(), en: b.en?.value, ru: b.ru?.value, b: b.b ? +b.b.value : null,
          occ: b.occ?.value ? b.occ.value.split('|').map(u => u.split('/').pop()) : [],
          occL: b.occL?.value ? b.occL.value.split('|') : [],
        }));
        fs.writeFileSync(out, JSON.stringify(all));
        console.log('batch', i, 'hits', all[key].length);
        ok = true;
      } else {
        const wait = (+r.headers.get('retry-after') || 30) * 1000;
        console.log('batch', i, 'HTTP', r.status, 'retry in', wait / 1000);
        await sleep(r.status === 429 ? wait : 15000);
      }
    }
    if (!ok) console.log('batch', i, 'GAVE UP');
    await sleep(2000);
  }
  console.log('DONE');
})().catch(e => { console.log('FAILED', e.message); process.exit(1); });
