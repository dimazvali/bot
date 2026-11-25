// St Petersburg as of 1 January 1914 on today's street geometry:
// public/lab/streets/data-spb.json + data/spb-streets/1914.tsv → public/lab/streets/data-spb-1914.json
// Same format as data-spb.json; per name row: [cat, flags (4 = a guess), '', '', name in 1914, '',
// today's name, null, null, null]. Streets that did not exist yet (or that we know nothing about) get 'absent'.
// Usage: node scripts/spb-streets/3-build-1914.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '../..');
const src = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/lab/streets/data-spb.json'), 'utf8'));
const CATS = ['church', 'royals', 'owners', 'military', 'politics', 'writers', 'science', 'person',
  'georgia', 'world', 'dates', 'ideas', 'nature', 'service', 'absent'];

const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е')
  .replace(/(^|\s)в\.\s?о\.?(?=\s|$)/g, '$1васильевского острова').replace(/(^|\s)п\.\s?с\.?(?=\s|$)/g, '$1петроградской стороны')
  .replace(/[«»"]/g, '').replace(/\s+/g, ' ').trim();

const table = new Map();
for (const line of fs.readFileSync(path.join(ROOT, 'data/spb-streets/1914.tsv'), 'utf8').split(/\r?\n/)) {
  if (!line || line[0] === '#') continue;
  const [osm, existed, name, cat, conf] = line.split('\t');
  table.set(norm(osm), { existed, name, cat, conf });
}

let hit = 0, miss = 0;
const names = src.names.map(r => {
  const now = r[4] || r[5];
  const t = table.get(norm(now));
  if (t) hit++; else miss++;
  const existed = t && (t.existed === 'y' || t.existed === 'y+');
  if (!existed) return [CATS.indexOf('absent'), 0, '', '', now, '', now, null, null, null];
  if (CATS.indexOf(t.cat) < 0) throw new Error('unknown category ' + t.cat + ' for ' + now);
  const flags = t.conf === 'l' ? 4 : 0;
  return [CATS.indexOf(t.cat), flags, '', '', t.name === '=' ? now : t.name, '', now, null, null, t.existed === 'y+' ? 1 : null];
});

const km = {};
CATS.forEach(c => { km[c] = 0; });
src.ways.forEach(w => {
  const f = w[2]; let s = 0;
  for (let i = 2; i < f.length; i += 2) s += Math.hypot(f[i], f[i + 1]);
  km[CATS[names[w[0]][0]]] += s * src.q / 1000;
});
Object.keys(km).forEach(c => { km[c] = Math.round(km[c] * 10) / 10; });

const out = Object.assign({}, src, { cats: CATS, names, km, year: 1914 });
fs.writeFileSync(path.join(ROOT, 'public/lab/streets/data-spb-1914.json'), JSON.stringify(out));
console.log('names', names.length, 'matched', hit, 'unmatched', miss);
console.log(Object.entries(km).sort((a, b) => b[1] - a[1]).map(([c, v]) => c + ' ' + v).join(', '));
