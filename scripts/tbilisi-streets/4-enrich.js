// For every matched person id: gender, whether born in / citizen of Georgia (any era). Resumable.
const fs = require('fs');
const dir = process.argv[2];
const out = dir + '/enrich.json';
const cls = JSON.parse(fs.readFileSync(dir + '/classified.json', 'utf8'));
const ids = [...new Set(cls.filter(r => r.p).map(r => r.p.id))];
const UA = { 'User-Agent': 'street-names-research/0.1 (research script)', Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
// Georgia, Georgian SSR, Democratic Republic of Georgia, Kingdom of Georgia, Kingdom of Kartli-Kakheti, Kingdom of Imereti, Iberia, Colchis, Abkhazia, South Ossetia
const GE = 'wd:Q230 wd:Q131337 wd:Q503585 wd:Q154705 wd:Q1384069 wd:Q849478 wd:Q1066314 wd:Q183150 wd:Q23334 wd:Q23427';
const q = b => `SELECT ?p ?g (MAX(?ge) AS ?georgian) WHERE {
  VALUES ?p { ${b.map(i => 'wd:' + i).join(' ')} }
  OPTIONAL { ?p wdt:P21 ?g }
  OPTIONAL { { ?p wdt:P27 ?c. VALUES ?c { ${GE} } } UNION { ?p wdt:P19/wdt:P17 ?c2. VALUES ?c2 { ${GE} } } UNION { ?p wdt:P172 wd:Q133035 } BIND(1 AS ?ge) }
} GROUP BY ?p ?g`;
(async () => {
  const all = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : {};
  const todo = ids.filter(i => !(i in all));
  for (let i = 0; i < todo.length; i += 50) {
    const b = todo.slice(i, i + 50);
    for (let a = 0; a < 6; a++) {
      const r = await fetch('https://query.wikidata.org/sparql', { method: 'POST', headers: UA, body: 'query=' + encodeURIComponent(q(b)) }).catch(e => ({ ok: false, status: e.message, headers: new Map() }));
      if (r.ok) {
        for (const x of b) all[x] = { g: null, ge: 0 };
        for (const row of (await r.json()).results.bindings) {
          const id = row.p.value.split('/').pop();
          all[id] = { g: row.g ? row.g.value.split('/').pop() : null, ge: row.georgian ? 1 : all[id].ge };
        }
        fs.writeFileSync(out, JSON.stringify(all));
        console.log('enrich', i + b.length, '/', todo.length);
        break;
      }
      console.log('enrich HTTP', r.status); await sleep((+r.headers.get?.('retry-after') || 30) * 1000);
    }
    await sleep(2000);
  }
  console.log('DONE');
})();
