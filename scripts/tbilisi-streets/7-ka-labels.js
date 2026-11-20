// Georgian labels for every Wikidata person in the dictionary (for the ka version of /lab/streets/).
// Resumable: saves after every batch; honours 429 Retry-After.
// Usage: node scripts/tbilisi-streets/7-ka-labels.js data/tbilisi-streets/dict.json data/tbilisi-streets/ka-labels.json
'use strict';
const fs = require('fs');
const [dictPath, out] = process.argv.slice(2);
const dict = JSON.parse(fs.readFileSync(dictPath, 'utf8'));
const ids = [...new Set(Object.values(dict).map(d => d.wd).filter(Boolean))];
const UA = { 'User-Agent': 'street-names-research/0.1 (research script)', Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const all = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : {};
  const todo = ids.filter(i => !(i in all));
  for (let i = 0; i < todo.length; i += 200) {
    const b = todo.slice(i, i + 200);
    const q = `SELECT ?p ?l WHERE { VALUES ?p { ${b.map(x => 'wd:' + x).join(' ')} } ?p rdfs:label ?l FILTER(LANG(?l)="ka") }`;
    for (let a = 0; a < 6; a++) {
      const r = await fetch('https://query.wikidata.org/sparql', { method: 'POST', headers: UA, body: 'query=' + encodeURIComponent(q), signal: AbortSignal.timeout(90000) })
        .catch(e => ({ ok: false, status: e.message, headers: new Map() }));
      if (r.ok) {
        for (const x of b) all[x] = null;
        for (const row of (await r.json()).results.bindings) all[row.p.value.split('/').pop()] = row.l.value;
        fs.writeFileSync(out, JSON.stringify(all, null, 1));
        console.log('ka labels', i + b.length, '/', todo.length);
        break;
      }
      console.log('HTTP', r.status);
      await sleep((+(r.headers.get && r.headers.get('retry-after')) || 30) * 1000);
    }
    await sleep(2000);
  }
  console.log('DONE', Object.values(all).filter(Boolean).length, 'labels');
})();
