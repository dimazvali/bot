// SPb: street base name → category / person, from OSM etymology tags + Wikidata (spb-wd.js output).
// Usage: node 2-classify.js <dir with geom.json, ents.json, p138.json>  → <dir>/dict.json + a report
const fs = require('fs');
const dir = process.argv[2];
const ways = JSON.parse(fs.readFileSync(dir + '/geom.json', 'utf8')).elements;
const ents = JSON.parse(fs.readFileSync(dir + '/ents.json', 'utf8'));
const p138 = JSON.parse(fs.readFileSync(dir + '/p138.json', 'utf8'));
const OV = fs.existsSync(__dirname + '/overrides.js') ? require('./overrides.js') : {};

// "улица Рубинштейна" → "Рубинштейна"; "Невский проспект" → "Невский"; "1-я линия В.О." → "1-я линия"
const TYPES = /(^|\s)(улица|проспект|переулок|набережная|площадь|бульвар|шоссе|проезд|аллея|мост|дорога|тупик|спуск|линия|канал|сад|сквер|парк|въезд|дамба|путепровод|тоннель|развязка|подъезд|ул\.|пр\.|пер\.)(?=\s|$)/gi;
const base = s => s.replace(TYPES, ' ').replace(/\s+/g, ' ').trim() || s;

const PEOPLE_RX = [
  ['royals', /royalty|monarch|emperor|empress|tsar|king|queen|patriarch|monk|bishop|metropolitan|grand duke/],
  ['politics', /revolutionary|trade unionist/],
  ['military', /cosmonaut|astronaut|marshal|admiral|general|military leader|military commander|aircraft pilot|partisan|soldier|national hero/],
  ['writers', /writer|poet|novelist|playwright|essayist|prose|literary|translator|fabulist/],
  ['artists', /painter|sculptor|artist|graphic|illustrator|printmaker|(^|[^l] )architect|scenographer/],
  ['music', /composer|musician|singer|conductor|pianist|violinist|music|opera/],
  ['stage', /actor|actress|film|theatre|director|ballet|dancer|choreograph|screenwriter/],
  ['science', /naval architect|shipbuilder|scientist|physicist|chemist|mathematic|biolog|geolog|engineer|physician|surgeon|astronom|physiolog|psycholog|botan|zoolog|histor|philolog|linguist|archaeolog|ethnolog|geograph|explorer|navigator|philosoph|economist|inventor|university teacher|pedagog|educator|teacher|scholar|academic/],
  ['sport', /athlete|player|wrestler|boxer|footballer|chess|coach|sport|skater/],
  ['military', /military|officer|naval|navy|sailor|commander/], // "naval officer" only when nothing more telling is listed (Rimsky-Korsakov)
  ['politics', /politician|statesman|diplomat|lawyer|jurist|journalist|public figure|revolutionary|dissident|official|activist|philanthrop|businessperson|entrepreneur|merchant|trade unionist|civil servant/],
];
const RU_STATES = new Set(['Q159', 'Q34266', 'Q15180', 'Q2184', 'Q186096', 'Q1751185', 'Q1108445', 'Q170770', 'Q4304600']);
const EX_USSR = new Set(['Q212', 'Q184', 'Q230', 'Q399', 'Q227', 'Q232', 'Q265', 'Q217', 'Q211', 'Q37', 'Q191', 'Q813', 'Q863', 'Q874']);
// citizenship decides; with none recorded, a birthplace outside Russia and the former USSR
const isForeign = e => e.cit.length ? !e.cit.some(c => RU_STATES.has(c))
  : e.bornIn.length > 0 && !e.bornIn.some(c => RU_STATES.has(c) || EX_USSR.has(c));
const isHuman = e => e && e.types.includes('Q5');
const personCat = e => { const s = e.occL.join(' | ').toLowerCase(); for (const [c, rx] of PEOPLE_RX) if (rx.test(s)) return c; return 'person'; };
function thingCat(e) {
  const t = e.typeL.join(' | ').toLowerCase();
  const home = e.country.length ? e.country.some(c => RU_STATES.has(c)) : null;
  if (/battle|siege|war\b|revolution|uprising|rebellion|strike|congress|offensive|operation|event|holiday|anniversary|defen[cs]e|victory|treaty|expedition/.test(t)) return 'dates';
  if (/city|town|village|capital|settlement|municipal|oblast|region|province|krai|republic|district|federal subject|human settlement|selo|posyolok|governorate|country|sovereign state|historical country/.test(t)) return home === false ? 'world' : 'georgia';
  if (/river|lake|sea\b|bay|gulf|island|mountain|hill|forest|plant|tree|flower|taxon|species|animal|canal|strait|peninsula|ocean|waterfall|stream|marsh|steppe/.test(t)) return 'nature';
  return 'ideas';
}
const dict = {};
const byBase = {};
for (const w of ways) {
  const b = base(w.tags.name);
  const r = byBase[b] = byBase[b] || { names: {}, ety: {} };
  r.names[w.tags.name] = (r.names[w.tags.name] || 0) + 1;
  String(w.tags['name:etymology:wikidata'] || '').split(';').map(s => s.trim()).filter(x => /^Q\d+$/.test(x)).forEach(q => { r.ety[q] = (r.ety[q] || 0) + 1; });
  if (w.tags.wikidata && p138[w.tags.wikidata]) p138[w.tags.wikidata].forEach(q => { r.ety[q] = (r.ety[q] || 0) + 1; });
  if (w.tags['name:en']) r.en = r.en || w.tags['name:en'];
}
const stats = {};
for (const [b, r] of Object.entries(byBase)) {
  const qs = Object.entries(r.ety).sort((a, c) => c[1] - a[1]).map(x => x[0]);
  const e = qs.map(q => ents[q] && Object.assign({ id: q }, ents[q])).find(Boolean);
  let cat, foreign = false, female = false, auto = false;
  if (e && isHuman(e)) {
    cat = personCat(e);
    foreign = isForeign(e) && cat !== 'royals';
    female = e.g === 'Q6581072';
  } else if (e) cat = thingCat(e);
  else {
    // no etymology: a capitalised genitive after the street type is probably a person; adjectives go to "plain streets"
    auto = true;
    const name = Object.keys(r.names)[0];
    // genitive singular (Чапыгина, Рубинштейна, Шевченко) → a person; plural genitive (Металлистов, Бойцов, Доблести) → ideas
    const typed = /^(улица|проспект|переулок|площадь|набережная|бульвар|аллея|мост)\s+[А-ЯЁ]/.test(name);
    const last = b.split(' ').pop();
    cat = !typed ? 'service'
      : /(ов|ев|ей|ий|сти|ства|ц|ам|ек|ия)$/.test(last) || /^Красн/.test(b) ? 'ideas'
      : /(а|я|ко|их|ых|ого|его|ича)$/.test(last) ? 'person' : 'service';
  }
  const ov = OV[b];
  if (ov) { if (typeof ov === 'string') cat = ov; else Object.assign({ cat }, ov) && (cat = ov.cat || cat, foreign = ov.foreign ?? foreign); auto = false; }
  dict[b] = { cat, en: e ? e.en : null, ru: e ? e.ru : null, wd: e ? e.id : null, born: e ? e.b : null,
    foreign: foreign || undefined, female: female || undefined, auto: auto || undefined, streetEn: r.en || null };
  const s = stats[cat] = stats[cat] || { n: 0, ex: [] }; s.n++; if (s.ex.length < 12) s.ex.push(e ? (e.ru || e.en) : b);
}
fs.writeFileSync(dir + '/dict.json', JSON.stringify(dict, null, 1));
for (const [c, s] of Object.entries(stats).sort((a, b) => b[1].n - a[1].n)) console.log(c.padEnd(9), String(s.n).padStart(4), '|', s.ex.join(', '));
const f = Object.entries(dict).filter(([, d]) => d.foreign);
console.log('foreign', f.length, '|', f.slice(0, 40).map(([, d]) => d.ru || d.en).join(', '));
console.log('female', Object.values(dict).filter(d => d.female).length);
