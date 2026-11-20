// Pass 2: look up Georgian street names (genitive → nominative guesses) by ka label/alias,
// requiring a ka.wikipedia article. Resumable batches into people-ka.json.
const fs = require('fs');
const dir = process.argv[2];
const BATCH = +(process.argv[3] || 120);
const out = dir + '/' + (process.argv[4] || 'people-ka.json');
const onlyUnmatched = !!process.argv[4]; // pass 3: retry bases that pass 2 found nothing for
const names = JSON.parse(fs.readFileSync(dir + '/names.json', 'utf8'));
const UA = { 'User-Agent': 'street-names-research/0.1 (research script)', Accept: 'application/sparql-results+json' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// "გალაკტიონ ტაბიძის ქუჩა" → base "გალაკტიონ ტაბიძის"
const TYPE = /\s*(ქუჩა|გამზირი|შესახვევი|ჩიხი|მოედანი|ხეივანი|სანაპირო|აღმართი|დაღმართი|გზატკეცილი|გასასვლელი|ბაღი|პარკი|ხიდი|კვარტალი|დასახლება|გზა|ბულვარი|მიკრორაიონი|ქ\.)\s*/g;
const kaBase = s => s.replace(/[0-9IVX№#.,-]+(-?ე|-?ლი)?/g, ' ').replace(TYPE, ' ').replace(/\s+/g, ' ').trim();
// genitive → nominative for the last word (Georgian surnames: -ძის→-ძე, -შვილის→-შვილი, -ანის→-ანი, -ის→-ი/-ე/∅)
const TITLES = /(^|\s)(მეფის|მეფეს|მეფე|დედოფლის|დედოფალი|წმინდა|მარშალ|გენერალ|ბერი|აკადემიკოს|პოეტ|მწერალ|სახელობის|მარჯვენა|მარცხენა)(?=\s|$)/g;
function nominatives(b0) {
  const out = new Set();
  for (const b of [b0, b0.replace(TITLES, ' ').replace(/\s+/g, ' ').trim()]) {
    const w = b.split(' ');
    const last = w.pop();
    out.add(b);
    if (last.endsWith('ის')) {
      const st = last.slice(0, -2);
      for (const e of ['ე', 'ი', 'ა', '']) out.add([...w, st + e].join(' '));
      // syncope: აღმაშენებლის → აღმაშენებელი, გორგასლის → გორგასალი
      const m = st.match(/^(.*)([ბგდვზთკლმნპჟრსტფქღყშჩცძწჭხჯჰ])([ლრმნ])$/);
      if (m) for (const v of ['ე', 'ა']) out.add([...w, m[1] + m[2] + v + m[3] + 'ი'].join(' '));
    } else if (last.endsWith('ას') || last.endsWith('ოს') || last.endsWith('უს') || last.endsWith('ეს')) {
      out.add([...w, last.slice(0, -1)].join(' '));
    }
  }
  return [...out].filter(x => x.length > 2);
}
const bases = {};
for (const n of names) {
  const b = kaBase(n.ka);
  if (!b || !/[ა-ჰ]/.test(b)) continue;
  (bases[b] = bases[b] || { ways: 0, en: new Set() }).ways += n.n;
  if (n.en) bases[b].en.add(n.en);
}
let list = Object.entries(bases).sort((a, b) => b[1].ways - a[1].ways).map(([b, v]) => ({ b, ways: v.ways, en: [...v.en][0] }));
if (!onlyUnmatched) fs.writeFileSync(dir + '/kabase.json', JSON.stringify(list));
else {
  const prev = new Set(Object.values(JSON.parse(fs.readFileSync(dir + '/people-ka.json', 'utf8'))).flat().map(h => h.l));
  const oldNom = b => { const w = b.split(' '); const l = w.pop(); const o = [b]; if (l.endsWith('ის')) { const s = l.slice(0, -2); for (const e of ['ე', 'ი', 'ა', '']) o.push([...w, s + e].join(' ')); } return o; };
  list = list.filter(x => !oldNom(x.b).some(v => prev.has(v)));
}
console.log('ka bases', list.length);

const esc = s => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
const q = ls => `SELECT ?l ?p ?en ?ru ?ka ?b (GROUP_CONCAT(DISTINCT ?ol;separator="|") AS ?occL) WHERE {
  VALUES ?l { ${ls.map(n => `"${esc(n)}"@ka`).join(' ')} }
  { ?p rdfs:label ?l } UNION { ?p skos:altLabel ?l }
  ?p wdt:P31 wd:Q5.
  ?art schema:about ?p; schema:isPartOf <https://ka.wikipedia.org/>.
  OPTIONAL { ?p wdt:P569 ?bd. BIND(YEAR(?bd) AS ?b) }
  OPTIONAL { ?p rdfs:label ?en FILTER(LANG(?en)="en") }
  OPTIONAL { ?p rdfs:label ?ru FILTER(LANG(?ru)="ru") }
  OPTIONAL { ?p rdfs:label ?ka FILTER(LANG(?ka)="ka") }
  OPTIONAL { ?p wdt:P106 ?o. ?o rdfs:label ?ol FILTER(LANG(?ol)="en") }
} GROUP BY ?l ?p ?en ?ru ?ka ?b`;
(async () => {
  const all = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : {};
  for (let i = 0; i < list.length; i += BATCH) {
    const key = 'b' + i;
    if (all[key]) continue;
    const ls = [...new Set(list.slice(i, i + BATCH).flatMap(x => nominatives(x.b)))];
    let ok = false;
    for (let attempt = 0; attempt < 6 && !ok; attempt++) {
      const r = await fetch('https://query.wikidata.org/sparql', {
        method: 'POST', headers: { ...UA, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'query=' + encodeURIComponent(q(ls)),
      }).catch(e => ({ ok: false, status: 'net ' + e.message, headers: new Map() }));
      if (r.ok) {
        all[key] = (await r.json()).results.bindings.map(b => ({
          l: b.l.value, id: b.p.value.split('/').pop(), en: b.en?.value, ru: b.ru?.value, ka: b.ka?.value,
          b: b.b ? +b.b.value : null, occL: b.occL?.value ? b.occL.value.split('|') : [],
        }));
        fs.writeFileSync(out, JSON.stringify(all));
        console.log('ka batch', i, '/', list.length, 'hits', all[key].length);
        ok = true;
      } else {
        const wait = (+r.headers.get('retry-after') || 30) * 1000;
        console.log('ka batch', i, 'HTTP', r.status, 'retry in', wait / 1000);
        await sleep(r.status === 429 ? wait : 15000);
      }
    }
    if (!ok) console.log('ka batch', i, 'GAVE UP');
    await sleep(2000);
  }
  console.log('DONE');
})().catch(e => { console.log('FAILED', e.message); process.exit(1); });
