// Build the curated street dictionary: ka base → { cat, name ru/en, foreign, female, wd, born }.
const fs = require('fs');
const dir = process.argv[2];
const out = process.argv[3];
const cls = JSON.parse(fs.readFileSync(dir + '/classified.json', 'utf8'));
const enr = JSON.parse(fs.readFileSync(dir + '/enrich.json', 'utf8'));
const OV = require('./overrides.js');
const NOT_FOREIGN = /Khudadov|Grigorashvili|Eristavi|Glonti|Kandelaki|Apkhazi|Mamasakhlis|Mukhran|Merchule|Mtskhet|Tbileli|Abo of|Ephrem|Ekvtime|Mtsire|Aleksandre Ghlonti/i;
const GEO = /(shvili|dze|ia|ua|ani|eli|uri|ava|ali|uli|ari|eti|iani|vili|dse|ze|avi|onti|aki|ovi)$/i;
const geoName = s => { const w = (s || '').replace(/\(.*?\)/g, ' ').trim().split(/\s+/); return w.length < 2 || GEO.test(w[w.length - 1].replace(/[^A-Za-z]/g, '')); };
const PERSON_RX = /(shvili|dze|ia|ua|iani|eli|uri|ava|adze)$/i;
const short = en => (en || '').replace(/\s+(\d+(st|nd|rd|th)?\s+)?(Street|Avenue|Lane|Dead End|Dead-end|Square|Highway|Embankment|Alley|Ascent|Descent|Bridge|Exit|Rise|Passage|Turn|Gorge|Road|Blind Alley)\b.*$/, '').replace(/\s+\d+(st|nd|rd|th)?$/, '').trim();
const PERSON_CATS = new Set(['writers', 'science', 'military', 'royals', 'politics', 'stage', 'music', 'artists', 'sport', 'person']);
const dict = {};
const stats = {};
for (const r of cls) {
  const key = short(r.en);
  let ov = OV[key] ?? OV[(r.en || '').trim()];
  if (typeof ov === 'string') ov = { cat: ov };
  let cat = ov?.cat || r.cat;
  let p = r.p;
  if (ov?.cat && !PERSON_CATS.has(ov.cat)) p = null; // e.g. Gali → town, not Gala Dalí
  if (!cat) cat = key.split(' ').length >= 2 && PERSON_RX.test(key) ? 'person' : 'georgia';
  if (cat === 'other' || cat === 'unknown') cat = 'person';
  const e = p && enr[p.id];
  const foreign = ov?.foreign ?? !!(p && e && !e.ge && cat !== 'royals' && !geoName(p.en || key) && !NOT_FOREIGN.test(p.en || key));
  const ru = ov?.ru || (p && p.ru && p.ru.replace(/^(.+?), (.+)$/, '$2 $1')) || null;
  dict[r.ka] = {
    cat, en: (p && p.en) || key || null, ru, wd: p ? p.id : null, born: p ? p.b : null,
    foreign: foreign || undefined, female: e && e.g === 'Q6581072' ? true : undefined,
    auto: !ov && !r.p ? true : undefined, // guessed by heuristic, needs review
  };
  const s = stats[cat] = stats[cat] || { n: 0, ways: 0, foreign: 0, female: 0 };
  s.n++; s.ways += r.ways; if (foreign) s.foreign++; if (dict[r.ka].female) s.female++;
}
fs.writeFileSync(out, JSON.stringify(dict, null, 1));
console.table(stats);
