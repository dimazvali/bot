'use strict';
// dimazvali.com/lab/streets/ — server side of a static page: every "Tbilisi of X" view has its own URL
// (/lab/streets/artists/, /lab/streets/women/ …) and the server fills in, per view and language:
// <html lang>, title, description, canonical/hreflang/og tags, a crawlable list of the view's streets
// (replaced by the interactive panel once the page's JS runs) and the view for the client.
// Language: ?lang=ru|en|ka, else Accept-Language, else Russian.
// Cities: Tbilisi at /lab/streets/, St Petersburg at /lab/streets/spb/ (same views, its own data and texts).

var LANGS = ['ru', 'en', 'ka'];
var SITE = 'https://dimazvali.com';
var CITIES = {
  tbilisi: { path: '/lab/streets/', langs: ['ru', 'en', 'ka'], data: '/lab/streets/data.json?v=2', api: '/lab/streets/' },
  spb: { path: '/lab/streets/spb/', langs: ['ru', 'en'], data: '/lab/streets/data-spb.json?v=1', api: '/lab/streets/spb/',
    // slugs that read wrong for Petersburg
    slugs: { georgia: 'russian-places', nature: 'nature', ideas: 'ideas-and-trades' } },
  // Petersburg as of 1 January 1914 on today's geometry (scripts/spb-streets/3-build-1914.js): its own set of views,
  // no people's names (the rows carry the 1914 street name and today's one)
  spb1914: { path: '/lab/streets/spb/1914/', langs: ['ru'], data: '/lab/streets/data-spb-1914.json?v=1', api: '/lab/streets/spb/1914/',
    noPeople: true,
    // the quiz asks "named after what?" among these (lib/lab-streets.js and the client)
    quiz: ['church', 'royals', 'owners', 'military', 'georgia', 'ideas', 'nature', 'politics', 'writers'],
    views: {
      'churches-and-saints': { cat: 'church' }, romanovs: { cat: 'royals' }, owners: { cat: 'owners' },
      regiments: { cat: 'military' }, statesmen: { cat: 'politics' }, writers: { cat: 'writers' },
      'russian-places': { cat: 'georgia' }, 'trades-and-institutions': { cat: 'ideas' }, nature: { cat: 'nature' },
      'plain-streets': { cat: 'service' },
    } },
};

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
  church:   { ru: ['храмов и святых', 'по храмам и святым'], en: ['Churches’ and saints’', 'after churches and saints'], ka: ['ტაძრებისა და წმინდანების', 'ტაძრებისა და წმინდანების'] },
  owners:   { ru: ['домовладельцев', 'по владельцам участков, купцам и заводчикам'], en: ['Landowners’', 'after landowners, merchants and factory owners'], ka: ['მიწის მესაკუთრეების', 'მიწის მესაკუთრეების'] },
  foreign:  { ru: ['иностранцев', 'в честь иностранцев'], en: ['Foreigners’', 'after foreigners'], ka: ['უცხოელების', 'უცხოელების'] },
  female:   { ru: ['женщин', 'в честь женщин'], en: ['Women’s', 'after women'], ka: ['ქალების', 'ქალების'] },
};

// city-specific category wording (falls back to TEXT)
var CITY_TEXT = {
  spb: {
    georgia: { ru: ['российских мест', 'в честь городов и краёв России'], en: ['Russian places’', 'after Russian towns and regions'] },
    ideas:   { ru: ['идей и профессий', 'в честь идей, профессий и заводов'], en: ['Ideas’ and trades’', 'after ideas, trades and factories'] },
    nature:  { ru: ['рек и островов', 'в честь рек, островов и природы'], en: ['Rivers’ and islands’', 'after rivers, islands and nature'] },
    politics: { ru: ['политиков и революционеров', 'в честь политиков и революционеров'], en: ['Politicians’ and revolutionaries’', 'after politicians and revolutionaries'] },
  },
  spb1914: {
    royals:   { ru: ['Романовых', 'в честь Романовых — царей, императриц и великих князей'] },
    military: { ru: ['полков', 'по гвардейским полкам, слободам и военным'] },
    politics: { ru: ['сановников', 'в честь государственных деятелей'] },
    writers:  { ru: ['писателей', 'в честь писателей'] },
    georgia:  { ru: ['российских мест', 'по городам и губерниям империи'] },
    ideas:    { ru: ['ремёсел и заведений', 'по ремёслам, слободам, рынкам и казённым заведениям'] },
    nature:   { ru: ['рек и островов', 'по рекам, островам и местности'] },
  },
};

var SPB1914_L10N = {
  ru: {
    site: 'Чьи улицы Петербурга в 1914 году', all: 'Петербург 1914 года', city: 'Петербург {x} в 1914 году',
    rootTitle: 'Чьи улицы Петербурга в 1914 году — карта дореволюционных названий · dimazvali.com',
    rootDesc: 'Как назывались улицы Петербурга на 1 января 1914 года и в честь кого: храмы, Романовы, домовладельцы, полки и губернские города. Карта на нынешней сетке улиц и угадайка.',
    rootOg: 'Знаменская, Сергиевская, Забалканский проспект: Петербург 1914 года на карте сегодняшнего города.',
    viewTitle: '{h}: {n} {streets}, {km} км — Чьи улицы Петербурга в 1914 году',
    viewDesc: 'Улицы Петербурга, названные к 1914 году {about}: {names}{more}. Карта всех {n} {streets} — {km} км.',
    plainDesc: 'Улицы Петербурга 1914 года без всякого «в честь»: {names}{more}. Карта всех {n} {streets} — {km} км.',
    lead: 'Нынешние улицы города с теми названиями, что были у них 1 января 1914 года, разложенные по тому, в честь кого или чего они названы. Улиц, которых тогда ещё не было, на карте почти не видно.',
    back: '← Весь Петербург 1914 года', views: 'Петербург 1914 года по категориям', other: 'Петербург сегодня: чьи там улицы →',
  },
};

var SPB_L10N = {
  ru: {
    site: 'Чьи улицы Петербурга', all: 'Весь Петербург', city: 'Петербург {x}',
    rootTitle: 'Чьи улицы Петербурга — карта улиц по профессиям людей · dimazvali.com',
    rootDesc: 'Улицы Санкт-Петербурга, разделённые по тем, в честь кого они названы: Петербург военных, революционеров, учёных, писателей, заводов и иностранцев. Карта и угадайка.',
    rootOg: '3000 км улиц, разложенных по тем, в честь кого они названы. Угадаете, кем был Бармалеев?',
    viewTitle: '{h}: {n} {streets}, {km} км — Чьи улицы Петербурга',
    viewDesc: 'Улицы Петербурга, названные {about}: {names}{more}. Карта всех {n} {streets} — {km} км.',
    plainDesc: 'Улицы Петербурга без всякого «в честь»: {names}{more}. Карта всех {n} {streets} — {km} км.',
    back: '← Весь Петербург', views: 'Петербург по категориям', other: 'Тбилиси: чьи там улицы →',
    also: 'Петербург 1914 года: как назывались улицы до революции →',
  },
  en: {
    site: 'Whose Streets, St Petersburg?', all: 'All of St Petersburg', city: '{x} St Petersburg',
    rootTitle: 'Whose Streets, St Petersburg? — a map of streets by what their namesakes did · dimazvali.com',
    rootDesc: 'St Petersburg’s streets split by who they are named after: the Petersburg of soldiers, revolutionaries, scientists, writers, factories and foreigners. A map and a quiz.',
    rootOg: '3,000 km of streets sorted by who they are named after. Can you guess who Barmaleev was?',
    viewTitle: '{h}: {n} {streets}, {km} km — Whose Streets, St Petersburg?',
    viewDesc: 'St Petersburg streets named {about}: {names}{more}. A map of all {n} {streets} — {km} km.',
    plainDesc: 'St Petersburg streets named after nothing in particular: {names}{more}. A map of all {n} {streets} — {km} km.',
    back: '← All of St Petersburg', views: 'St Petersburg by category', other: 'Tbilisi: whose streets are those? →',
  },
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
    listHead: 'Улицы', back: '← Весь Тбилиси', views: 'Тбилиси по категориям', other: 'Петербург: чьи там улицы →',
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
    listHead: 'Streets', back: '← All of Tbilisi', views: 'Tbilisi by category', other: 'St Petersburg: whose streets are those? →',
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
    listHead: 'ქუჩები', back: '← მთელი თბილისი', views: 'თბილისი კატეგორიების მიხედვით', other: 'პეტერბურგი: ვისია იქ ქუჩები? →',
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

function pickLang(query, acceptsLanguages, hasAcceptLanguage, langs) {
  langs = langs || LANGS;
  var q = query && query.lang;
  if (langs.indexOf(q) >= 0) return q;
  if (langs.length === 1) return langs[0];
  if (!hasAcceptLanguage) return 'ru';
  return acceptsLanguages(langs) || 'en';
}

// a city's views: the shared slugs, with the city's renames (spb: georgian-places → russian-places …)
function viewsFor(city) {
  if (CITIES[city].views) return Object.assign(Object.create(null), CITIES[city].views);
  var renames = CITIES[city].slugs || {};
  var out = Object.create(null);
  Object.keys(VIEWS).forEach(function (slug) {
    var v = VIEWS[slug];
    out[(v.cat && renames[v.cat]) || slug] = v;
  });
  return out;
}

// data: public/lab/streets/data.json (Tbilisi) or data-spb.json; city: 'tbilisi' (default) | 'spb'
function create(data, city) {
  city = city || 'tbilisi';
  var C = CITIES[city], VIEWS_C = viewsFor(city), LANGS_C = C.langs;
  var other = city === 'spb' ? 'tbilisi' : 'spb';
  // Petersburg today also links to its 1914 version
  var also = city === 'spb' ? 'spb1914' : null;
  function t10n(lang) {
    return Object.assign({}, L10N[lang], city !== 'tbilisi' ? SPB_L10N[lang] : null, city === 'spb1914' ? SPB1914_L10N[lang] : null);
  }
  function text(key, lang) { var o = CITY_TEXT[city] && CITY_TEXT[city][key]; return (o && o[lang]) || TEXT[key][lang]; }
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
  Object.keys(VIEWS_C).forEach(function (slug) {
    var v = VIEWS_C[slug];
    var list = rows.filter(function (r) { return v.cat ? r.cat === v.cat : r[v.flag]; });
    var km = list.reduce(function (s, r) { return s + r.len; }, 0);
    index[slug] = { slug: slug, key: v.cat || v.flag, cat: v.cat || null, flag: v.flag || null, rows: list, km: km };
  });
  var totalKm = rows.reduce(function (s, r) { return s + r.len; }, 0);

  function url(slug, lang, c) {
    return SITE + CITIES[c || city].path + (slug ? slug + '/' : '') + (lang ? '?lang=' + lang : '');
  }
  function isPeople(view) { return !C.noPeople && (view.flag || PEOPLE.indexOf(view.cat) >= 0); }

  function meta(slug, lang) {
    var t = t10n(lang);
    if (!slug) return { h1: t.all, title: t.rootTitle, desc: t.rootDesc, ogTitle: t.site, ogDesc: t.rootOg };
    var view = index[slug], tx = text(view.key, lang);
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
    var t = t10n(lang), m = meta(slug, lang);
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
    // the other city (its own languages: Petersburg has no Georgian)
    var otherLang = CITIES[other].langs.indexOf(lang) >= 0 ? lang : 'ru';
    h += '<p><a href="' + esc(url('', otherLang, other)) + '">' + esc(t.other) + '</a></p>';
    if (also && t.also && CITIES[also].langs.indexOf(lang) >= 0) h += '<p><a href="' + esc(url('', lang, also)) + '">' + esc(t.also) + '</a></p>';
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
    ].concat(LANGS_C.map(function (l) { return '<link rel="alternate" hreflang="' + l + '" href="' + esc(url(slug, l)) + '">'; }))
      .concat(['<link rel="alternate" hreflang="x-default" href="' + esc(url(slug)) + '">']);
    var view = slug ? index[slug] : null;
    var slugs = {};
    Object.keys(VIEWS_C).forEach(function (s) { slugs[VIEWS_C[s].cat || VIEWS_C[s].flag] = s; });
    var boot = { city: city, base: C.path, data: C.data, api: C.api, langs: LANGS_C, other: CITIES[other].path,
      slug: slug, cat: view && view.cat, flag: view && view.flag, slugs: slugs,
      also: also ? CITIES[also].path : null, quiz: C.quiz || null };
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
        return LANGS_C.map(function (lang) {
          return '  <url><loc>' + esc(url(s, lang)) + '</loc>' +
            LANGS_C.map(function (l) { return '<xhtml:link rel="alternate" hreflang="' + l + '" href="' + esc(url(s, l)) + '"/>'; }).join('') +
            '</url>';
        }).join('\n');
      }).join('\n') + '\n</urlset>\n';
  }

  return { render: render, sitemap: sitemap, meta: meta, index: index, totalKm: totalKm, city: city, langs: LANGS_C,
    hasView: function (slug) { return Object.prototype.hasOwnProperty.call(VIEWS_C, slug); } };
}

module.exports = { LANGS: LANGS, VIEWS: VIEWS, CITIES: CITIES, pickLang: pickLang, create: create, streetsWord: streetsWord, viewsFor: viewsFor };
