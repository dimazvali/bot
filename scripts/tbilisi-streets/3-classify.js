// Combine ka passes (preferred) + en pass, assign each street base one category, report totals.
const fs = require('fs');
const dir = process.argv[2];
const rd = f => fs.existsSync(dir + '/' + f) ? JSON.parse(fs.readFileSync(dir + '/' + f, 'utf8')) : {};
const kab = JSON.parse(fs.readFileSync(dir + '/kabase.json', 'utf8'));
const names = JSON.parse(fs.readFileSync(dir + '/names.json', 'utf8'));
const kaHits = [...Object.values(rd('people-ka.json')), ...Object.values(rd('people-ka2.json'))].flat();
const enHits = Object.entries(rd('people.json')).filter(([k]) => k !== '__v2').flatMap(([, v]) => v);
const byKa = new Map(); for (const h of kaHits) (byKa.get(h.l) || byKa.set(h.l, []).get(h.l)).push(h);
const byEn = new Map(); for (const h of enHits) { const k = h.l.toLowerCase(); (byEn.get(k) || byEn.set(k, []).get(k)).push(h); }

// order = priority when a person has several occupations
const CATS = [
  ['royals', 'Цари и святые', /royalty|monarch|king|queen|saint|catholicos|patriarch|religious leader|priest|monk|bishop|theologian|nobility|prince/],
  ['writers', 'Писатели и поэты', /writer|poet|novelist|playwright|essayist|prose|literary|translator/],
  ['artists', 'Художники и скульпторы', /painter|sculptor|artist|graphic|illustrator|printmaker|architect|scenographer|designer|calligrapher/],
  ['music', 'Музыканты и композиторы', /composer|musician|singer|conductor|pianist|violinist|music|opera|folk/],
  ['stage', 'Театр и кино', /actor|actress|film|theatre|director|ballet|dancer|choreograph|screenwriter/],
  ['military', 'Военные и герои', /military|soldier|officer|general|national hero|aircraft pilot|partisan/],
  ['science', 'Учёные и врачи', /scientist|physicist|chemist|mathematic|biolog|geolog|engineer|physician|surgeon|astronom|physiolog|psycholog|botan|zoolog|histor|philolog|linguist|archaeolog|ethnolog|geograph|philosoph|economist|university teacher|pedagog|educator|teacher|scholar/],
  ['sport', 'Спортсмены', /athlete|player|wrestler|boxer|footballer|chess|coach|sport/],
  ['politics', 'Политики и общественники', /politician|statesman|diplomat|lawyer|jurist|journalist|public figure|revolutionary|dissident|official|activist|philanthrop|businessperson|entrepreneur/],
];
const catOf = occL => { const s = occL.join(' | ').toLowerCase(); for (const [id, , rx] of CATS) if (rx.test(s)) return id; return occL.length ? 'other' : 'unknown'; };
const TITLES = /(^|\s)(მეფის|მეფეს|მეფე|დედოფლის|დედოფალი|წმინდა|მარშალ|გენერალ|ბერი|აკადემიკოს|პოეტ|მწერალ|სახელობის|მარჯვენა|მარცხენა)(?=\s|$)/g;
function noms(b0) {
  const out = [];
  for (const b of [b0, b0.replace(TITLES, ' ').replace(/\s+/g, ' ').trim()]) {
    const w = b.split(' '), last = w.pop(); out.push(b);
    if (last.endsWith('ის')) { const st = last.slice(0, -2); for (const e of ['ე', 'ი', 'ა', '']) out.push([...w, st + e].join(' '));
      const m = st.match(/^(.*)([ბგდვზთკლმნპჟრსტფქღყშჩცძწჭხჯჰ])([ლრმნ])$/); if (m) for (const v of ['ე', 'ა']) out.push([...w, m[1] + m[2] + v + m[3] + 'ი'].join(' ')); }
    else if (/(ას|ოს|უს|ეს)$/.test(last)) out.push([...w, last.slice(0, -1)].join(' '));
  }
  return out;
}
const best = arr => arr.slice().sort((a, b) => b.occL.length - a.occL.length)[0];
const res = [];
for (const k of kab) {
  let c = noms(k.b).flatMap(v => byKa.get(v) || []), src = 'ka';
  if (!c.length && k.en) {
    const en = k.en.replace(/\b(\d+(st|nd|rd|th)?|[IVX]+|Street|Avenue|Lane|Square|Alley|Highway|Embankment|Dead End|Descent|Ascent|Turn|Passage|Road|Bridge|Exit)\b/g, ' ').replace(/^(\s*(Marshal|General|Saint|Academician|King|Queen))+\s+/i, '').replace(/\s+/g, ' ').trim().toLowerCase();
    c = en.split(' ').length >= 2 ? byEn.get(en) || [] : []; src = 'en';
  }
  const p = c.length ? best(c) : null;
  res.push({ ka: k.b, en: k.en, ways: k.ways, src: p ? src : null, ambig: new Set(c.map(x => x.id)).size,
    p: p && { id: p.id, en: p.en, ru: p.ru, b: p.b, occL: p.occL }, cat: p ? catOf(p.occL) : null });
}
fs.writeFileSync(dir + '/classified.json', JSON.stringify(res, null, 1));
const tot = {}; for (const r of res) { const c = r.cat || 'no-person'; tot[c] = tot[c] || { bases: 0, ways: 0, ex: [] }; tot[c].bases++; tot[c].ways += r.ways; if (tot[c].ex.length < 14) tot[c].ex.push(r.p ? (r.p.ru || r.p.en) : r.en); }
const lbl = Object.fromEntries(CATS.map(([a, b]) => [a, b]));
for (const [c, v] of Object.entries(tot).sort((a, b) => b[1].ways - a[1].ways)) console.log(`${(lbl[c] || c).padEnd(28)} ${String(v.bases).padStart(4)} names ${String(v.ways).padStart(5)} ways | ${v.ex.join(', ')}`);
console.log('ambiguous', res.filter(r => r.ambig > 1).length, 'en-only', res.filter(r => r.src === 'en').length);
