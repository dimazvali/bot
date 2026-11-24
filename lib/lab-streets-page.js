'use strict';
// dimazvali.com/lab/streets/ — server side of a static page: every "Tbilisi of X" view has its own URL
// (/lab/streets/artists/, /lab/streets/women/ …) and the server fills in, per view and language:
// <html lang>, title, description, canonical/hreflang/og tags, a crawlable list of the view's streets
// (replaced by the interactive panel once the page's JS runs) and the view for the client.
// Language: ?lang=ru|en|ka, else Accept-Language, else Russian.

var LANGS = ['ru', 'en', 'ka'];
var BASE = 'https://dimazvali.com/lab/streets/';

// URL slug → view. A view is a category or one of the two flags (foreign / female).
var VIEWS = {
  writers: { cat: 'writers' }, 'kings-and-saints': { cat: 'royals' }, scientists: { cat: 'science' },
  soldiers: { cat: 'military' }, politicians: { cat: 'politics' }, actors: { cat: 'stage' },
  artists: { cat: 'artists' }, musicians: { cat: 'music' }, athletes: { cat: 'sport' },
  unknown: { cat: 'person' }, 'georgian-places': { cat: 'georgia' }, world: { cat: 'world' },
  'dates-and-battles': { cat: 'dates' }, ideas: { cat: 'ideas' }, 'nature-and-wine': { cat: 'nature' },
  'plain-streets': { cat: 'service' },
  foreigners: { flag: 'foreign' }, women: { flag: 'female' },
};
var PEOPLE = ['writers', 'royals', 'science', 'military', 'politics', 'stage', 'artists', 'music', 'sport', 'person'];

// per view key (category id or flag): h1 ("<x> Tbilisi") and the "named after …" phrase
var TEXT = {
  writers:  { ru: ['писателей', 'в честь писателей и поэтов'], en: ['Writers’', 'after writers and poets'], ka: ['მწერლების', 'მწერლებისა და პოეტების'] },
  royals:   { ru: ['царей и святых', 'в честь царей и святых'], en: ['Kings’ and saints’', 'after kings and saints'], ka: ['მეფეებისა და წმინდანების', 'მეფეებისა და წმინდანების'] },
  science:  { ru: ['учёных', 'в честь учёных и врачей'], en: ['Scientists’', 'after scientists and doctors'], ka: ['მეცნიერების', 'მეცნიერებისა და ექიმების'] },
  military: { ru: ['военных', 'в честь военных и героев'], en: ['Soldiers’', 'after soldiers and heroes'], ka: ['სამხედროების', 'სამხედროებისა და გმირების'] },
  politics: { ru: ['политиков', 'в честь политиков и общественных деятелей'], en: ['Politicians’', 'after politicians and public figures'], ka: ['პოლიტიკოსების', 'პოლიტიკოსებისა და საზოგადო მოღვაწეების'] },
  stage:    { ru: ['актёров и режиссёров', 'в честь актёров и режиссёров'], en: ['Actors’', 'after actors and directors'], ka: ['მსახიობებისა და რეჟისორების', 'მსახიობებისა და რეჟისორების'] },
  artists:  { ru: ['художников', 'в честь художников и архитекторов'], en: ['Artists’', 'after artists and architects'], ka: ['მხატვრების', 'მხატვრებისა და არქიტექტორების'] },
  music:    { ru: ['музыкантов', 'в честь композиторов и музыкантов'], en: ['Musicians’', 'after composers and musicians'], ka: ['მუსიკოსების', 'კომპოზიტორებისა და მუსიკოსების'] },
  sport:    { ru: ['спортсменов', 'в честь спортсменов'], en: ['Athletes’', 'after athletes'], ka: ['სპორტსმენების', 'სპორტსმენების'] },
  person:   { ru: ['неизвестных людей', 'в честь людей, о которых мы пока ничего не знаем'], en: ['Unknown people’s', 'after people we know nothing about yet'], ka: ['უცნობი ადამიანების', 'ადამიანების, რომლებზეც ჯერ არაფერი ვიცით,'] },
  georgia:  { ru: ['грузинских мест', 'в честь краёв и городов Грузии'], en: ['Georgian places’', 'after Georgian regions and towns'], ka: ['საქართველოს ადგილების', 'საქართველოს კუთხეებისა და ქალაქების'] },
  world:    { ru: ['других стран', 'в честь других стран и городов'], en: ['The world’s', 'after other countries and cities'], ka: ['მსოფლიოს', 'სხვა ქვეყნებისა და ქალაქების'] },
  dates:    { ru: ['дат и битв', 'в честь дат и битв'], en: ['Dates’ and battles’', 'after dates and battles'], ka: ['თარიღებისა და ბრძოლების', 'თარიღებისა და ბრძოლების'] },
  ideas:    { ru: ['идей', 'в честь идей'], en: ['Ideas’', 'after ideas'], ka: ['იდეების', 'იდეების'] },
  nature:   { ru: ['природы и вина', 'в честь природы и вина'], en: ['Nature’s', 'after nature and wine'], ka: ['ბუნებისა და ღვინის', 'ბუნებისა და ღვინის'] },
  service:  { ru: ['просто улиц', 'без всякого «в честь»'], en: ['Plain streets’', 'after nothing in particular'], ka: ['უბრალო ქუჩების', null] },
  foreign:  { ru: ['иностранцев', 'в честь иностранцев'], en: ['Foreigners’', 'after foreigners'], ka: ['უცხოელების', 'უცხოელების'] },
  female:   { ru: ['женщин', 'в честь женщин'], en: ['Women’s', 'after women'], ka: ['ქალების', 'ქალების'] },
};

var L10N = {
  ru: {
    site: 'Чьи улицы Тбилиси', all: 'Весь Тбилиси', city: 'Тбилиси {x}',
    rootTitle: 'Чьи улицы Тбилиси — карта улиц по профессиям людей · dimazvali.com',
    rootDesc: 'Дорожная сеть Тбилиси, разделённая по тем, в честь кого названы улицы: Тбилиси писателей, царей, учёных, военных, актёров и иностранцев. Карта и угадайка.',
    rootOg: '2200 км улиц, разложенных по профессиям людей, в честь которых они названы. Угадаете, кем был Чичико Бенделиани?',
    viewTitle: '{h}: {n} {streets}, {km} км — Чьи улицы Тбилиси',
    viewDesc: 'Улицы Тбилиси, названные {about}: {names}{more}. Карта всех {n} {streets} — {km} км.',
    plainDesc: 'Улицы Тбилиси без всякого «в честь»: {names}{more}. Карта всех {n} {streets} — {km} км.',
    more: ' и ещё {k}', km: 'км', lead: 'Все именованные улицы города, разложенные по тем, в честь кого они названы.',
    listHead: 'Улицы', back: '← Весь Тбилиси', views: 'Тбилиси по категориям',
  },
  en: {
    site: 'Whose Streets, Tbilisi?', all: 'All of Tbilisi', city: '{x} Tbilisi',
    rootTitle: 'Whose Streets, Tbilisi? — a map of streets by what their namesakes did · dimazvali.com',
    rootDesc: 'Tbilisi’s road network split by who the streets are named after: the Tbilisi of writers, kings, scientists, soldiers, actors and foreigners. A map and a quiz.',
    rootOg: '2,200 km of streets sorted by what the people they are named after did. Can you guess who Chichiko Bendeliani was?',
    viewTitle: '{h}: {n} {streets}, {km} km — Whose Streets, Tbilisi?',
    viewDesc: 'Tbilisi streets named {about}: {names}{more}. A map of all {n} {streets} — {km} km.',
    plainDesc: 'Tbilisi streets named after nothing in particular: {names}{more}. A map of all {n} {streets} — {km} km.',
    more: ' and {k} more', km: 'km', lead: 'Every named street in the city, split by who it is named after.',
    listHead: 'Streets', back: '← All of Tbilisi', views: 'Tbilisi by category',
  },
  ka: {
    site: 'ვისია თბილისის ქუჩები?', all: 'მთელი თბილისი', city: '{x} თბილისი',
    rootTitle: 'ვისია თბილისის ქუჩები? — ქუჩების რუკა სახელის მატარებლების პროფესიების მიხედვით · dimazvali.com',
    rootDesc: 'თბილისის ქუჩები, დაყოფილი იმის მიხედვით, ვის სახელს ატარებენ: მწერლების, მეფეების, მეცნიერების, სამხედროების, მსახიობებისა და უცხოელების თბილისი. რუკა და ვიქტორინა.',
    rootOg: '2200 კმ ქუჩა, დალაგებული იმ ადამიანების პროფესიების მიხედვით, ვის სახელსაც ატარებენ. გამოიცნობთ, ვინ იყო ჩიჩიკო ბენდელიანი?',
    viewTitle: '{h}: {n} {streets}, {km} კმ — ვისია თბილისის ქუჩები?',
    viewDesc: 'თბილისის ქუჩები, რომლებიც {about} სახელს ატარებენ: {names}{more}. ყველა {n} ქუჩის რუკა — {km} კმ.',
    plainDesc: 'თბილისის ქუჩები, რომლებიც განსაკუთრებულ არაფერს ეძღვნება: {names}{more}. ყველა {n} ქუჩის რუკა — {km} კმ.',
    more: ' და კიდევ {k}', km: 'კმ', lead: 'ქალაქის ყველა სახელიანი ქუჩა, დალაგებული იმის მიხედვით, ვის სახელს ატარებს.',
    listHead: 'ქუჩები', back: '← მთელი თბილისი', views: 'თბილისი კატეგორიების მიხედვით',
  },
};

function fill(s, v) { return s.replace(/\{(\w+)\}/g, function (m, k) { return v[k] == null ? '' : v[k]; }); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function streetsWord(lang, n) {
  if (lang === 'en') return n === 1 ? 'street' : 'streets';
  if (lang === 'ka') return 'ქუჩა';
  var m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'улица';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'улицы';
  return 'улиц';
}
function fmtKm(lang, v) {
  var s = v >= 100 ? String(Math.round(v)) : (Math.round(v * 10) / 10).toFixed(1).replace(/\.0$/, '');
  return lang === 'en' ? s : s.replace('.', ',');
}

function pickLang(query, acceptsLanguages, hasAcceptLanguage) {
  var q = query && query.lang;
  if (LANGS.indexOf(q) >= 0) return q;
  if (!hasAcceptLanguage) return 'ru';
  return acceptsLanguages(LANGS) || 'en';
}

// data: public/lab/streets/data.json
function create(data) {
  var len = data.names.map(function () { return 0; });
  data.ways.forEach(function (w) {
    var f = w[2], s = 0;
    for (var i = 2; i < f.length; i += 2) s += Math.hypot(f[i], f[i + 1]);
    len[w[0]] += s * data.q / 1000;
  });
  // name rows: [catIdx, flags, person ru, person en, street ru, street en, street ka, born, wikidata, person ka]
  var rows = data.names.map(function (r, i) {
    return { cat: data.cats[r[0]], foreign: !!(r[1] & 1), female: !!(r[1] & 2), len: len[i],
      person: { ru: r[2] || r[3], en: r[3] || r[2], ka: r[9] || r[3] || r[2] },
      street: { ru: r[4] || r[5] || r[6], en: r[5] || r[4] || r[6], ka: r[6] } };
  }).filter(function (r) { return r.len > 0; }).sort(function (a, b) { return b.len - a.len; });

  var index = Object.create(null); // slug → { key, cat, flag, rows, km }; no prototype, so "constructor" is not a view
  Object.keys(VIEWS).forEach(function (slug) {
    var v = VIEWS[slug];
    var list = rows.filter(function (r) { return v.cat ? r.cat === v.cat : r[v.flag]; });
    var km = list.reduce(function (s, r) { return s + r.len; }, 0);
    index[slug] = { slug: slug, key: v.cat || v.flag, cat: v.cat || null, flag: v.flag || null, rows: list, km: km };
  });
  var totalKm = rows.reduce(function (s, r) { return s + r.len; }, 0);

  function url(slug, lang) { return BASE + (slug ? slug + '/' : '') + (lang ? '?lang=' + lang : ''); }
  function isPeople(view) { return view.flag || PEOPLE.indexOf(view.cat) >= 0; }

  function meta(slug, lang) {
    var t = L10N[lang];
    if (!slug) return { h1: t.all, title: t.rootTitle, desc: t.rootDesc, ogTitle: t.site, ogDesc: t.rootOg };
    var view = index[slug], tx = TEXT[view.key][lang];
    var h1 = fill(t.city, { x: tx[0] });
    var who = [];
    view.rows.forEach(function (r) {
      var name = isPeople(view) ? r.person[lang] : r.street[lang];
      if (name && who.indexOf(name) < 0 && who.length < 3) who.push(name);
    });
    var n = view.rows.length, km = fmtKm(lang, view.km);
    var v = { h: h1, n: n, streets: streetsWord(lang, n), km: km, about: tx[1], names: who.join(', '),
      more: n > who.length ? fill(t.more, { k: n - who.length }) : '' };
    var desc = fill(tx[1] ? t.viewDesc : t.plainDesc, v);
    return { h1: h1, title: fill(t.viewTitle, v), desc: desc, ogTitle: h1 + ' — ' + t.site, ogDesc: desc };
  }

  // the crawlable panel: replaced by the interactive one when the page's JS starts
  function side(slug, lang) {
    var t = L10N[lang], m = meta(slug, lang);
    var h = '<h1>' + esc(m.h1) + '</h1><p class="lead">' + esc(slug ? m.desc : t.lead) + '</p>';
    if (slug) {
      var view = index[slug];
      h += '<p><a href="' + esc(url('', lang)) + '">' + esc(t.back) + '</a></p><h2 class="group">' + esc(t.listHead) + '</h2><ol class="seo-list">' +
        view.rows.slice(0, 60).map(function (r) {
          var who = isPeople(view) && r.person[lang] ? ' — ' + esc(r.person[lang]) : '';
          return '<li>' + esc(r.street[lang]) + who + '</li>';
        }).join('') + '</ol>';
    }
    h += '<h2 class="group">' + esc(t.views) + '</h2><ul class="seo-list">' + Object.keys(index).map(function (s) {
      return '<li><a href="' + esc(url(s, lang)) + '">' + esc(meta(s, lang).h1) + '</a> · ' + fmtKm(lang, index[s].km) + ' ' + t.km + '</li>';
    }).join('') + '</ul>';
    return h;
  }

  // html: index.html with <!--META-->, <!--SIDE-->, <!--VIEW--> markers. Returns null for an unknown slug.
  function render(html, lang, slug) {
    slug = slug || '';
    if (slug && !index[slug]) return null;
    var m = meta(slug, lang);
    var head = [
      '<title>' + esc(m.title) + '</title>',
      '<meta name="description" content="' + esc(m.desc) + '">',
      '<meta property="og:title" content="' + esc(m.ogTitle) + '">',
      '<meta property="og:description" content="' + esc(m.ogDesc) + '">',
      '<meta property="og:type" content="website">',
      '<meta property="og:url" content="' + esc(url(slug, lang)) + '">',
      '<meta property="og:locale" content="' + { ru: 'ru_RU', en: 'en_US', ka: 'ka_GE' }[lang] + '">',
      '<link rel="canonical" href="' + esc(url(slug, lang)) + '">',
    ].concat(LANGS.map(function (l) { return '<link rel="alternate" hreflang="' + l + '" href="' + esc(url(slug, l)) + '">'; }))
      .concat(['<link rel="alternate" hreflang="x-default" href="' + esc(url(slug)) + '">']);
    var view = slug ? index[slug] : null;
    var slugs = {};
    Object.keys(VIEWS).forEach(function (s) { slugs[VIEWS[s].cat || VIEWS[s].flag] = s; });
    var boot = { slug: slug, cat: view && view.cat, flag: view && view.flag, slugs: slugs };
    var out = html;
    function swap(marker, value) {
      if (out.indexOf(marker) < 0) throw new Error('lab-streets page: ' + marker + ' marker not found');
      out = out.replace(marker, function () { return value; });
    }
    if (out.indexOf('<html lang="ru">') < 0) throw new Error('lab-streets page: <html lang> not found');
    out = out.replace('<html lang="ru">', '<html lang="' + lang + '">');
    swap('<!--META-->', head.join('\n  '));
    swap('<!--SIDE-->', side(slug, lang));
    swap('<!--VIEW-->', '<script>window.STREETS_VIEW = ' + JSON.stringify(boot).replace(/</g, '\\u003c') + ';</script>');
    return out;
  }

  function sitemap() {
    var urls = [''].concat(Object.keys(index));
    return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
      urls.map(function (s) {
        return LANGS.map(function (lang) {
          return '  <url><loc>' + esc(url(s, lang)) + '</loc>' +
            LANGS.map(function (l) { return '<xhtml:link rel="alternate" hreflang="' + l + '" href="' + esc(url(s, l)) + '"/>'; }).join('') +
            '</url>';
        }).join('\n');
      }).join('\n') + '\n</urlset>\n';
  }

  return { render: render, sitemap: sitemap, meta: meta, index: index, totalKm: totalKm };
}

module.exports = { LANGS: LANGS, VIEWS: VIEWS, pickLang: pickLang, create: create, streetsWord: streetsWord };
