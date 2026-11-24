// "Чьи улицы Тбилиси" — the Tbilisi road network split by who the streets are named after.
// Data: data.json, built by scripts/tbilisi-streets/6-build.js from OSM + Wikidata.
(function () {
  'use strict';

  // ── categories ──
  // people first (these are the game's answers), then everything that is not a person.
  // n: legend label, city: "<x> Tbilisi" heading (fills T.cityOf), opt: quiz answer
  var CAT = {
    writers:  { c: '#c0392b', n: { ru: 'Писатели и поэты', en: 'Writers & poets', ka: 'მწერლები და პოეტები' },
      city: { ru: 'писателей', en: 'Writers’', ka: 'მწერლების' }, opt: { ru: 'Писатель или поэт', en: 'A writer or poet', ka: 'მწერალი ან პოეტი' } },
    royals:   { c: '#b8860b', n: { ru: 'Цари и святые', en: 'Kings & saints', ka: 'მეფეები და წმინდანები' },
      city: { ru: 'царей и святых', en: 'Kings’ and saints’', ka: 'მეფეებისა და წმინდანების' }, opt: { ru: 'Царь или святой', en: 'A king or a saint', ka: 'მეფე ან წმინდანი' } },
    science:  { c: '#2e6fb5', n: { ru: 'Учёные и врачи', en: 'Scientists & doctors', ka: 'მეცნიერები და ექიმები' },
      city: { ru: 'учёных', en: 'Scientists’', ka: 'მეცნიერების' }, opt: { ru: 'Учёный или врач', en: 'A scientist or doctor', ka: 'მეცნიერი ან ექიმი' } },
    military: { c: '#5b6b2a', n: { ru: 'Военные и герои', en: 'Soldiers & heroes', ka: 'სამხედროები და გმირები' },
      city: { ru: 'военных', en: 'Soldiers’', ka: 'სამხედროების' }, opt: { ru: 'Военный или герой', en: 'A soldier or hero', ka: 'სამხედრო ან გმირი' } },
    politics: { c: '#7d3c98', n: { ru: 'Политики и общественники', en: 'Politicians & public figures', ka: 'პოლიტიკოსები და საზოგადო მოღვაწეები' },
      city: { ru: 'политиков', en: 'Politicians’', ka: 'პოლიტიკოსების' }, opt: { ru: 'Политик или общественник', en: 'A politician or public figure', ka: 'პოლიტიკოსი ან საზოგადო მოღვაწე' } },
    stage:    { c: '#e07b1f', n: { ru: 'Театр и кино', en: 'Stage & screen', ka: 'თეატრი და კინო' },
      city: { ru: 'актёров и режиссёров', en: 'Actors’', ka: 'მსახიობებისა და რეჟისორების' }, opt: { ru: 'Актёр или режиссёр', en: 'An actor or director', ka: 'მსახიობი ან რეჟისორი' } },
    artists:  { c: '#d0307a', n: { ru: 'Художники и архитекторы', en: 'Artists & architects', ka: 'მხატვრები და არქიტექტორები' },
      city: { ru: 'художников', en: 'Artists’', ka: 'მხატვრების' }, opt: { ru: 'Художник или архитектор', en: 'An artist or architect', ka: 'მხატვარი ან არქიტექტორი' } },
    music:    { c: '#13998a', n: { ru: 'Музыка', en: 'Music', ka: 'მუსიკა' },
      city: { ru: 'музыкантов', en: 'Musicians’', ka: 'მუსიკოსების' }, opt: { ru: 'Композитор или музыкант', en: 'A composer or musician', ka: 'კომპოზიტორი ან მუსიკოსი' } },
    sport:    { c: '#2f9e44', n: { ru: 'Спорт', en: 'Sport', ka: 'სპორტი' },
      city: { ru: 'спортсменов', en: 'Athletes’', ka: 'სპორტსმენების' }, opt: { ru: 'Спортсмен', en: 'An athlete', ka: 'სპორტსმენი' } },
    person:   { c: '#8d877d', n: { ru: 'Не знаем, кто это', en: 'People we don’t know yet', ka: 'არ ვიცით, ვინ არის' },
      city: { ru: 'неизвестных людей', en: 'Unknown people’s', ka: 'უცნობი ადამიანების' } },
    georgia:  { c: '#b39b7d', n: { ru: 'Края и города Грузии', en: 'Georgian places', ka: 'საქართველოს კუთხეები და ქალაქები' },
      city: { ru: 'грузинских мест', en: 'Georgian places’', ka: 'საქართველოს ადგილების' } },
    world:    { c: '#5f7281', n: { ru: 'Мир', en: 'The world', ka: 'მსოფლიო' },
      city: { ru: 'других стран', en: 'The world’s', ka: 'მსოფლიოს' } },
    dates:    { c: '#7a4e3a', n: { ru: 'Даты и битвы', en: 'Dates & battles', ka: 'თარიღები და ბრძოლები' },
      city: { ru: 'дат и битв', en: 'Dates’ and battles’', ka: 'თარიღებისა და ბრძოლების' } },
    ideas:    { c: '#9aa3a8', n: { ru: 'Идеи', en: 'Ideas', ka: 'იდეები' },
      city: { ru: 'идей', en: 'Ideas’', ka: 'იდეების' } },
    nature:   { c: '#8fae5a', n: { ru: 'Природа и вино', en: 'Nature & wine', ka: 'ბუნება და ღვინო' },
      city: { ru: 'природы и вина', en: 'Nature’s', ka: 'ბუნებისა და ღვინის' } },
    service:  { c: '#cbc5b8', n: { ru: 'Просто улицы', en: 'Just streets', ka: 'უბრალოდ ქუჩები' },
      city: { ru: 'просто улиц', en: 'Plain', ka: 'უბრალო ქუჩების' } },
  };
  var PEOPLE = ['writers', 'royals', 'science', 'military', 'politics', 'stage', 'artists', 'music', 'sport'];

  var T = {
    ru: {
      title: 'Чьи улицы Тбилиси', map: 'Карта', game: 'Угадайка', km: 'км', bc: ' до н. э.',
      loading: 'Загружаем 2000 км улиц…',
      lead: 'Все именованные улицы города, разложенные по тем, в честь кого они названы. Нажмите на категорию, чтобы увидеть её Тбилиси, или на улицу — чтобы узнать, кто это.',
      total: '{km} км улиц с именами', people: 'Люди', things: 'Не люди', all: 'Весь Тбилиси',
      cityOf: 'Тбилиси {x}', share: '{p}% улиц · {km} км', foreign: 'Иностранцы', female: 'Женщины',
      foreignTag: 'иностранец', femaleTag: 'женщина', guessTag: 'догадка', born: 'род. {y}', wiki: 'Wikidata →', allProjects: 'все проекты',
      note: 'Данные: OpenStreetMap (ODbL) и Wikidata. Профессии определены автоматически и вычитаны вручную у самых длинных улиц — ошибки возможны. «Не знаем, кто это» — люди без статьи в грузинской Википедии; часто это погибшие в войнах 1990-х и 2008 года.',
      hint: 'колесо — масштаб, перетаскивание — сдвиг',
      round: 'Вопрос {n} из {t}', ask: 'В честь кого названа эта улица?', next: 'Дальше', finish: 'Итог',
      right: 'Верно!', wrongIs: 'Нет — это {cat}.', again: 'Ещё раз', shareBtn: 'Поделиться', copied: 'Скопировано',
      result: 'из {t}', best: 'Лучший результат: {b}', start: 'Начать', gameLead: 'Покажем улицу на карте — угадайте, кем был человек, в честь которого её назвали. 10 вопросов.',
      ranks: ['Турист', 'Гость из Кутаиси', 'Таксист со стажем', 'Краевед', 'Ходячая энциклопедия Сололаки'],
      shareText: 'Я угадал {s} из {t} в «Чьих улицах Тбилиси»: ',
      unknownPerson: 'Человек, о котором мы пока ничего не знаем',
      classic: '10 вопросов', endless: 'На выживание', endlessGo: 'На выживание →',
      endlessLead: 'Вопросы без конца, до первой ошибки. Чем дальше, тем незаметнее улицы. Лучшие серии попадают в таблицу.',
      streak: 'Серия', over: 'Ошибка — серия окончена', yourStreak: 'Ваша серия', nick: 'Имя для таблицы',
      save: 'В таблицу рекордов', saved: 'Сохранено', top: 'Топ-10 на выживание', noTop: 'Пока никого — станьте первым.',
      tooFast: 'Слишком быстрые ответы — эта серия в таблицу не попадёт.', netErr: 'Нет связи с сервером. Попробуйте ещё раз.',
      perfect: 'Вы ответили на все вопросы, что у нас есть!', shareEndless: 'Моя серия в «Чьих улицах Тбилиси» — {s} подряд: ',
      suggestUnknown: 'Знаете, кто это? Расскажите', suggestFix: 'Нашли ошибку?', sgTitle: 'Кто или что это?',
      sgCat: 'Категория', sgCatKeep: '— не знаю —', sgText: 'Пара слов: кем был человек, чем известен, ссылка',
      sgContact: 'Как с вами связаться (необязательно)', sgSend: 'Отправить', sgThanks: 'Спасибо! Проверим и добавим.',
      sgEmpty: 'Выберите категорию или напишите пару слов.', personHint: 'Знаете кого-то из них? Нажмите на улицу и расскажите — добавим.',
    },
    en: {
      title: 'Whose Streets, Tbilisi?', map: 'Map', game: 'Quiz', km: 'km', bc: ' BC',
      loading: 'Loading 2,000 km of streets…',
      lead: 'Every named street in the city, split by who it is named after. Tap a category to see its Tbilisi, or a street to see who it is.',
      total: '{km} km of named streets', people: 'People', things: 'Not people', all: 'All of Tbilisi',
      cityOf: '{x} Tbilisi', share: '{p}% of streets · {km} km', foreign: 'Foreigners', female: 'Women',
      foreignTag: 'foreigner', femaleTag: 'woman', guessTag: 'guess', born: 'b. {y}', wiki: 'Wikidata →', allProjects: 'all projects',
      note: 'Data: OpenStreetMap (ODbL) and Wikidata. Occupations were matched automatically and hand-checked for the longest streets — mistakes are possible. “People we don’t know yet” have no Georgian Wikipedia article; many died in the wars of the 1990s and 2008.',
      hint: 'wheel to zoom, drag to pan',
      round: 'Question {n} of {t}', ask: 'Who is this street named after?', next: 'Next', finish: 'Result',
      right: 'Correct!', wrongIs: 'No — {cat}.', again: 'Play again', shareBtn: 'Share', copied: 'Copied',
      result: 'of {t}', best: 'Best: {b}', start: 'Start', gameLead: 'We show a street on the map — guess who the person it is named after was. 10 questions.',
      ranks: ['Tourist', 'Weekend visitor', 'Seasoned taxi driver', 'Local historian', 'Walking encyclopedia of Sololaki'],
      shareText: 'I got {s} of {t} in “Whose Streets, Tbilisi?”: ',
      unknownPerson: 'Someone we know nothing about yet',
      classic: '10 questions', endless: 'Endless', endlessGo: 'Go endless →',
      endlessLead: 'Questions keep coming until your first mistake, and the streets get more obscure. The best streaks make the table.',
      streak: 'Streak', over: 'Wrong — the streak is over', yourStreak: 'Your streak', nick: 'Name for the table',
      save: 'Save my record', saved: 'Saved', top: 'Endless top 10', noTop: 'Nobody yet — be the first.',
      tooFast: 'Answers came too fast — this streak can’t go into the table.', netErr: 'Can’t reach the server. Please try again.',
      perfect: 'You answered every question we have!', shareEndless: 'My streak in “Whose Streets, Tbilisi?”: {s} in a row: ',
      suggestUnknown: 'Know who this is? Tell us', suggestFix: 'Spotted a mistake?', sgTitle: 'Who or what is it?',
      sgCat: 'Category', sgCatKeep: '— not sure —', sgText: 'A few words: who the person was, what they’re known for, a link',
      sgContact: 'How to reach you (optional)', sgSend: 'Send', sgThanks: 'Thank you! We’ll check it and add it.',
      sgEmpty: 'Pick a category or write a few words.', personHint: 'Know any of them? Tap a street and tell us — we’ll add it.',
    },
    ka: {
      title: 'ვისია თბილისის ქუჩები?', map: 'რუკა', game: 'ვიქტორინა', km: 'კმ', bc: ' ძვ. წ.',
      loading: 'იტვირთება 2000 კმ ქუჩა…',
      lead: 'ქალაქის ყველა სახელიანი ქუჩა, დალაგებული იმის მიხედვით, ვის სახელს ატარებს. დააჭირეთ კატეგორიას, რომ ნახოთ მისი თბილისი, ან ქუჩას — რომ გაიგოთ, ვინ არის.',
      total: '{km} კმ სახელიანი ქუჩა', people: 'ადამიანები', things: 'არა ადამიანები', all: 'მთელი თბილისი',
      cityOf: '{x} თბილისი', share: 'ქუჩების {p}% · {km} კმ', foreign: 'უცხოელები', female: 'ქალები',
      foreignTag: 'უცხოელი', femaleTag: 'ქალი', guessTag: 'ვარაუდი', born: 'დაბ. {y}', wiki: 'Wikidata →', allProjects: 'ყველა პროექტი',
      note: 'მონაცემები: OpenStreetMap (ODbL) და Wikidata. პროფესიები ავტომატურად განისაზღვრა და ყველაზე გრძელ ქუჩებზე ხელით შემოწმდა — შეცდომები შესაძლებელია. „არ ვიცით, ვინ არის“ — ადამიანები, რომლებზეც ქართულ ვიკიპედიაში სტატია არ არის; ხშირად ესენი 1990-იანი წლებისა და 2008 წლის ომებში დაღუპულები არიან.',
      hint: 'ბორბალი — მასშტაბი, გადათრევა — გადაადგილება',
      round: 'კითხვა {n} / {t}', ask: 'ვის სახელს ატარებს ეს ქუჩა?', next: 'შემდეგი', finish: 'შედეგი',
      right: 'სწორია!', wrongIs: 'არა — ეს არის {cat}.', again: 'თავიდან', shareBtn: 'გაზიარება', copied: 'დაკოპირდა',
      result: '/ {t}', best: 'საუკეთესო შედეგი: {b}', start: 'დაწყება', gameLead: 'რუკაზე გაჩვენებთ ქუჩას — გამოიცანით, ვინ იყო ადამიანი, ვისი სახელიც ჰქვია. 10 კითხვა.',
      ranks: ['ტურისტი', 'სტუმარი ქუთაისიდან', 'გამოცდილი ტაქსისტი', 'მხარეთმცოდნე', 'სოლოლაკის მოსიარულე ენციკლოპედია'],
      shareText: '„ვისია თბილისის ქუჩები?“ — {t}-დან {s} გამოვიცანი: ',
      unknownPerson: 'ადამიანი, რომლის შესახებაც ჯერ არაფერი ვიცით',
      classic: '10 კითხვა', endless: 'გადარჩენა', endlessGo: 'გადარჩენის რეჟიმი →',
      endlessLead: 'კითხვები უსასრულოდ, პირველ შეცდომამდე. რაც უფრო შორს, მით უფრო უცნობი ქუჩები. საუკეთესო სერიები ცხრილში ხვდება.',
      streak: 'სერია', over: 'შეცდომა — სერია დასრულდა', yourStreak: 'თქვენი სერია', nick: 'სახელი ცხრილისთვის',
      save: 'რეკორდების ცხრილში', saved: 'შენახულია', top: 'გადარჩენის ტოპ-10', noTop: 'ჯერ არავინაა — იყავით პირველი.',
      tooFast: 'პასუხები ზედმეტად სწრაფი იყო — ეს სერია ცხრილში ვერ მოხვდება.', netErr: 'სერვერთან კავშირი არ არის. სცადეთ თავიდან.',
      perfect: 'თქვენ ყველა კითხვას უპასუხეთ, რაც გვაქვს!', shareEndless: 'ჩემი სერია „ვისია თბილისის ქუჩები?“-ში — {s} ზედიზედ: ',
      suggestUnknown: 'იცით, ვინ არის? მოგვიყევით', suggestFix: 'შეცდომა იპოვეთ?', sgTitle: 'ვინ ან რა არის?',
      sgCat: 'კატეგორია', sgCatKeep: '— არ ვიცი —', sgText: 'ორიოდე სიტყვა: ვინ იყო ადამიანი, რით არის ცნობილი, ბმული',
      sgContact: 'როგორ დაგიკავშირდეთ (არასავალდებულო)', sgSend: 'გაგზავნა', sgThanks: 'გმადლობთ! შევამოწმებთ და დავამატებთ.',
      sgEmpty: 'აირჩიეთ კატეგორია ან დაწერეთ ორიოდე სიტყვა.', personHint: 'რომელიმე მათგანს იცნობთ? დააჭირეთ ქუჩას და მოგვიყევით — დავამატებთ.',
    },
  };
  var ROUNDS = 10;
  var LANGS = ['ru', 'en', 'ka'];

  // ── city: Tbilisi (/lab/streets/) or St Petersburg (/lab/streets/spb/); the server says which ──
  var CITY_BOOT = window.STREETS_VIEW || {};
  var CITY = CITY_BOOT.city || 'tbilisi';
  if (CITY_BOOT.langs) LANGS = CITY_BOOT.langs;
  var CITY_TEXTS = {
    spb: {
      ru: {
        title: 'Чьи улицы Петербурга', loading: 'Загружаем 3000 км улиц…', all: 'Весь Петербург', cityOf: 'Петербург {x}',
        lead: 'Все именованные улицы города, разложенные по тем, в честь кого они названы. Нажмите на категорию, чтобы увидеть её Петербург, или на улицу — чтобы узнать, кто это.',
        note: 'Данные: OpenStreetMap (ODbL) и Wikidata — в чью честь названа улица, чаще всего уже отмечено в OSM. Остальное определено автоматически, ошибки возможны. «Не знаем, кто это» — люди без описания в Wikidata.',
        ranks: ['Турист', 'Гость из Москвы', 'Таксист со стажем', 'Краевед', 'Ходячая энциклопедия Коломны'],
        shareText: 'Я угадал {s} из {t} в «Чьих улицах Петербурга»: ', shareEndless: 'Моя серия в «Чьих улицах Петербурга» — {s} подряд: ',
      },
      en: {
        title: 'Whose Streets, St Petersburg?', loading: 'Loading 3,000 km of streets…', all: 'All of St Petersburg', cityOf: '{x} St Petersburg',
        lead: 'Every named street in the city, split by who it is named after. Tap a category to see its St Petersburg, or a street to see who it is.',
        note: 'Data: OpenStreetMap (ODbL) and Wikidata — who a street is named after is mostly tagged in OSM already. The rest was matched automatically, so mistakes are possible. “People we don’t know yet” have no description on Wikidata.',
        ranks: ['Tourist', 'Weekend visitor from Moscow', 'Seasoned taxi driver', 'Local historian', 'Walking encyclopedia of Kolomna'],
        shareText: 'I got {s} of {t} in “Whose Streets, St Petersburg?”: ', shareEndless: 'My streak in “Whose Streets, St Petersburg?”: {s} in a row: ',
      },
    },
  };
  var CITY_CATS = {
    spb: {
      georgia: { n: { ru: 'Города и края России', en: 'Russian places' }, city: { ru: 'российских мест', en: 'Russian places’' } },
      ideas: { n: { ru: 'Идеи, профессии и заводы', en: 'Ideas, trades and factories' }, city: { ru: 'идей и профессий', en: 'Ideas’ and trades’' } },
      nature: { n: { ru: 'Реки, острова и природа', en: 'Rivers, islands and nature' }, city: { ru: 'рек и островов', en: 'Rivers’ and islands’' } },
      politics: { n: { ru: 'Политики и революционеры', en: 'Politicians & revolutionaries' }, city: { ru: 'политиков и революционеров', en: 'Politicians’ and revolutionaries’' } },
    },
  };
  // key for this city's records in localStorage (Tbilisi keeps the original keys)
  function cityKey(k) { return CITY === 'tbilisi' ? k : k + '-' + CITY; }
  Object.keys(CITY_TEXTS[CITY] || {}).forEach(function (l) { Object.assign(T[l], CITY_TEXTS[CITY][l]); });
  Object.keys(CITY_CATS[CITY] || {}).forEach(function (c) {
    var o = CITY_CATS[CITY][c];
    Object.assign(CAT[c].n, o.n);
    Object.assign(CAT[c].city, o.city);
  });

  // ── helpers ──
  var $ = function (id) { return document.getElementById(id); };
  function fill(s, v) { return s.replace(/\{(\w+)\}/g, function (m, k) { return v[k]; }); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  function fmtKm(v) { return v >= 100 ? Math.round(v).toLocaleString(lang) : v.toLocaleString(lang, { maximumFractionDigits: 1 }); }
  function track(ev, p) { try { window.gtag && gtag('event', ev, p || {}); } catch (e) { /* no analytics */ } }

  // language: ?lang= → the visitor's earlier choice → what the server picked from Accept-Language (<html lang>)
  var qLang = new URLSearchParams(location.search).get('lang');
  var lang = LANGS.indexOf(qLang) >= 0 ? qLang : LANGS.indexOf(lsGet('streets-lang')) >= 0 ? lsGet('streets-lang')
    : LANGS.indexOf(document.documentElement.lang) >= 0 ? document.documentElement.lang : 'ru';
  function t(k) { return T[lang][k]; }
  function catName(c) { return CAT[c].n[lang]; }
  function catOpt(c) { return CAT[c].opt[lang]; }

  // ── data ──
  var D, CATS, ways = [], names = [], totalKm = 0;
  // way: {n: name index, r: rank, p: Float32Array of absolute coords, x0,y0,x1,y1}
  // name: {cat, flags, pru, pen, sru, sen, ska, born, wd, ways: [], len, bbox}

  function decode(data) {
    D = data; CATS = data.cats;
    names = data.names.map(function (r, i) {
      return { idx: i, cat: CATS[r[0]], foreign: !!(r[1] & 1), female: !!(r[1] & 2), guess: !!(r[1] & 4),
        pru: r[2], pen: r[3], sru: r[4], sen: r[5], ska: r[6], born: r[7], wd: r[8], pka: r[9] || null, ways: [], len: 0,
        bbox: [Infinity, Infinity, -Infinity, -Infinity] };
    });
    data.ways.forEach(function (w) {
      var f = w[2], p = new Float32Array(f.length), x = 0, y = 0, len = 0;
      var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (var i = 0; i < f.length; i += 2) {
        var nx = x + f[i], ny = y + f[i + 1];
        if (i) len += Math.hypot(nx - x, ny - y);
        x = nx; y = ny; p[i] = x; p[i + 1] = y;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      var way = { n: w[0], r: w[1], p: p, x0: x0, y0: y0, x1: x1, y1: y1, len: len * data.q / 1000 };
      ways.push(way);
      var nm = names[w[0]];
      nm.ways.push(way); nm.len += way.len;
      nm.bbox = [Math.min(nm.bbox[0], x0), Math.min(nm.bbox[1], y0), Math.max(nm.bbox[2], x1), Math.max(nm.bbox[3], y1)];
    });
    CATS.forEach(function (c) { totalKm += data.km[c]; });
    buildGrid();
  }

  // spatial grid of segments for hit-testing
  var GRID = 150, grid = {};
  function buildGrid() {
    ways.forEach(function (w, wi) {
      for (var i = 2; i < w.p.length; i += 2) {
        var ax = w.p[i - 2], ay = w.p[i - 1], bx = w.p[i], by = w.p[i + 1];
        var gx0 = Math.floor(Math.min(ax, bx) / GRID), gx1 = Math.floor(Math.max(ax, bx) / GRID);
        var gy0 = Math.floor(Math.min(ay, by) / GRID), gy1 = Math.floor(Math.max(ay, by) / GRID);
        for (var gx = gx0; gx <= gx1; gx++) for (var gy = gy0; gy <= gy1; gy++) {
          var k = gx + ':' + gy;
          (grid[k] || (grid[k] = [])).push(wi * 65536 + i);
        }
      }
    });
  }
  function segDist(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
    var u = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)) : 0;
    return Math.hypot(px - ax - u * dx, py - ay - u * dy);
  }
  function hit(wx, wy, r) {
    var best = null, bd = r;
    var gx0 = Math.floor((wx - r) / GRID), gx1 = Math.floor((wx + r) / GRID), gy0 = Math.floor((wy - r) / GRID), gy1 = Math.floor((wy + r) / GRID);
    for (var gx = gx0; gx <= gx1; gx++) for (var gy = gy0; gy <= gy1; gy++) {
      var cell = grid[gx + ':' + gy];
      if (!cell) continue;
      for (var j = 0; j < cell.length; j++) {
        var wi = Math.floor(cell[j] / 65536), i = cell[j] % 65536, p = ways[wi].p;
        if (!visibleWay(ways[wi])) continue;
        var d = segDist(wx, wy, p[i - 2], p[i - 1], p[i], p[i + 1]);
        if (d < bd) { bd = d; best = ways[wi]; }
      }
    }
    return best;
  }

  // ── view ──
  var cv = $('map'), ctx = cv.getContext('2d'), dpr = 1, W = 0, H = 0;
  var view = { s: 1, x: 0, y: 0 }; // screen = (world - x) * s
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var r = cv.getBoundingClientRect();
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    draw();
  }
  function fit(b, pad, animate) {
    var bw = Math.max(b[2] - b[0], 600), bh = Math.max(b[3] - b[1], 600);
    var s = Math.min((W - pad * 2) / bw, (H - pad * 2) / bh);
    var cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
    var target = { s: s, x: cx - W / 2 / s, y: cy - H / 2 / s };
    if (!animate) { view = target; draw(); return; }
    var from = { s: view.s, x: view.x, y: view.y }, t0 = performance.now();
    (function step(now) {
      var k = Math.min(1, (now - t0) / 450), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      // interpolate the centre and the log of the scale, so the zoom feels even
      var s1 = Math.exp(Math.log(from.s) + (Math.log(target.s) - Math.log(from.s)) * e);
      var fcx = from.x + W / 2 / from.s, tcx = target.x + W / 2 / target.s;
      var fcy = from.y + H / 2 / from.s, tcy = target.y + H / 2 / target.s;
      view = { s: s1, x: fcx + (tcx - fcx) * e - W / 2 / s1, y: fcy + (tcy - fcy) * e - H / 2 / s1 };
      draw();
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }
  function zoomAt(sx, sy, k) {
    var ns = Math.max(0.02, Math.min(4, view.s * k));
    var wx = view.x + sx / view.s, wy = view.y + sy / view.s;
    view = { s: ns, x: wx - sx / ns, y: wy - sy / ns };
    draw();
  }

  // ── what is shown ──
  var st = { mode: 'map', cat: null, foreign: false, female: false, sel: null, game: null };
  function filtered() { return st.cat || st.foreign || st.female; }
  function matches(nm) {
    if (st.cat && nm.cat !== st.cat) return false;
    if (st.foreign && !nm.foreign) return false;
    if (st.female && !nm.female) return false;
    return true;
  }
  function visibleWay(w) { return st.mode === 'game' ? false : (!filtered() || matches(names[w.n])); }

  var raf = 0;
  function draw() { if (!raf) raf = requestAnimationFrame(render); }
  function render() {
    raf = 0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#f4f1ea'; ctx.fillRect(0, 0, W, H);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    var s = view.s, vx0 = view.x, vy0 = view.y, vx1 = vx0 + W / s, vy1 = vy0 + H / s;
    var zoomW = Math.max(0.6, Math.min(3.2, Math.sqrt(s * 6)));
    var groups = {}; // "color|width" → Path2D
    function add(w, color, width) {
      if (w.x1 < vx0 || w.x0 > vx1 || w.y1 < vy0 || w.y0 > vy1) return;
      var key = color + '|' + width, path = groups[key] || (groups[key] = new Path2D());
      var p = w.p;
      path.moveTo((p[0] - vx0) * s, (p[1] - vy0) * s);
      for (var i = 2; i < p.length; i += 2) path.lineTo((p[i] - vx0) * s, (p[i + 1] - vy0) * s);
    }
    var widths = [0, 0.7, 1.2, 1.9];
    var game = st.mode === 'game' && st.game && st.game.cur;
    var revealed = game && st.game.answered;
    var order = []; // draw the highlighted layer last
    for (var i = 0; i < ways.length; i++) {
      var w = ways[i], nm = names[w.n], wd = widths[w.r] * zoomW;
      if (game) {
        if (nm === game.name) { order.push(w); continue; }
        add(w, '#d9d3c6', wd * 0.8);
      } else if (st.mode !== 'map' || !filtered()) {
        add(w, CAT[nm.cat].c, wd);
      } else if (matches(nm)) {
        order.push(w);
      } else {
        add(w, '#ddd7cb', wd * 0.8);
      }
    }
    order.forEach(function (w) {
      var nm = names[w.n];
      var color = game ? (revealed ? CAT[nm.cat].c : '#15120f') : CAT[nm.cat].c;
      add(w, color, Math.max(2.2, widths[w.r] * zoomW * 1.6));
    });
    if (st.sel && !game) st.sel.ways.forEach(function (w) { add(w, '#15120f', Math.max(3.5, widths[w.r] * zoomW * 2.4)); });
    // stable z-order: thin base first, then by insertion (highlight/selection were added last)
    Object.keys(groups).forEach(function (k) {
      var parts = k.split('|');
      ctx.strokeStyle = parts[0]; ctx.lineWidth = +parts[1];
      ctx.stroke(groups[k]);
    });
    if (game) { // a pulsing ring around a short street so it is findable
      var b = game.name.bbox, cx = ((b[0] + b[2]) / 2 - vx0) * s, cy = ((b[1] + b[3]) / 2 - vy0) * s;
      var rr = Math.max(28, Math.hypot(b[2] - b[0], b[3] - b[1]) * s / 2 + 18);
      ctx.strokeStyle = 'rgba(21,18,15,.35)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 5]);
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  // ── pointer: pan, pinch, wheel, tap ──
  var ptrs = {}, drag = null, moved = false;
  cv.addEventListener('pointerdown', function (e) {
    cv.setPointerCapture(e.pointerId);
    ptrs[e.pointerId] = { x: e.offsetX, y: e.offsetY };
    moved = false;
    drag = { x: e.offsetX, y: e.offsetY, vx: view.x, vy: view.y, s: view.s, d: pinchDist() };
    cv.classList.add('drag');
  });
  function pinchDist() {
    var k = Object.keys(ptrs);
    if (k.length < 2) return 0;
    return Math.hypot(ptrs[k[0]].x - ptrs[k[1]].x, ptrs[k[0]].y - ptrs[k[1]].y);
  }
  cv.addEventListener('pointermove', function (e) {
    if (!ptrs[e.pointerId]) return;
    ptrs[e.pointerId] = { x: e.offsetX, y: e.offsetY };
    var k = Object.keys(ptrs);
    if (k.length === 2) {
      var d = pinchDist();
      if (!drag.d) { drag = { x: e.offsetX, y: e.offsetY, vx: view.x, vy: view.y, s: view.s, d: d }; return; }
      var mx = (ptrs[k[0]].x + ptrs[k[1]].x) / 2, my = (ptrs[k[0]].y + ptrs[k[1]].y) / 2;
      zoomAt(mx, my, d / drag.d * drag.s / view.s);
      moved = true;
      return;
    }
    var dx = e.offsetX - drag.x, dy = e.offsetY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
    if (moved) { view.x = drag.vx - dx / view.s; view.y = drag.vy - dy / view.s; draw(); }
  });
  function up(e) {
    var wasTap = !moved && Object.keys(ptrs).length === 1;
    delete ptrs[e.pointerId];
    cv.classList.remove('drag');
    if (Object.keys(ptrs).length) { var k = Object.keys(ptrs)[0]; drag = { x: ptrs[k].x, y: ptrs[k].y, vx: view.x, vy: view.y, s: view.s, d: 0 }; return; }
    if (wasTap && e.type === 'pointerup') tap(e.offsetX, e.offsetY, e.pointerType === 'touch' ? 16 : 9);
  }
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', function (e) {
    e.preventDefault();
    zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
  }, { passive: false });
  $('zin').onclick = function () { zoomAt(W / 2, H / 2, 1.6); };
  $('zout').onclick = function () { zoomAt(W / 2, H / 2, 1 / 1.6); };

  function tap(sx, sy, rpx) {
    if (st.mode !== 'map') return;
    var w = hit(view.x + sx / view.s, view.y + sy / view.s, rpx / view.s);
    st.sel = w ? names[w.n] : null;
    showCard(st.sel);
    draw();
    if (w) track('streets_tap', { cat: st.sel.cat });
  }

  // ── street card ──
  function streetName(nm) { return lang === 'ka' ? nm.ska : (lang === 'ru' ? nm.sru || nm.sen : nm.sen || nm.sru) || nm.ska; }
  function personName(nm) {
    if (nm.cat === 'person' && !nm.pru && !nm.pen) return t('unknownPerson');
    return lang === 'ka' ? nm.pka || nm.pen || nm.pru : lang === 'ru' ? nm.pru || nm.pen : nm.pen || nm.pru;
  }
  function tags(nm) {
    var h = '<span class="tag" style="background:' + CAT[nm.cat].c + '">' + esc(catName(nm.cat)) + '</span>';
    if (nm.foreign) h += '<span class="tag" style="background:#15120f">' + t('foreignTag') + '</span>';
    if (nm.female) h += '<span class="tag" style="background:#9b2c5a">' + t('femaleTag') + '</span>';
    if (nm.guess) h += '<span class="tag" style="background:#9a948b">' + t('guessTag') + '</span>';
    return h;
  }
  function whoLine(nm) {
    var who = personName(nm), extra = [];
    if (nm.born) extra.push(fill(t('born'), { y: nm.born < 0 ? -nm.born + t('bc') : nm.born }));
    var h = who ? '<div class="who">' + esc(who) + (extra.length ? ' <span class="muted">· ' + extra.join(' · ') + '</span>' : '') + '</div>' : '';
    if (nm.wd) h += '<div class="who"><a href="https://www.wikidata.org/wiki/' + esc(nm.wd) + '" target="_blank" rel="noopener">' + t('wiki') + '</a></div>';
    return h;
  }
  // the small line above a street name: Georgian, or (in the Georgian version) the Latin name
  // (Petersburg has no Georgian names: the other language's name instead)
  function altName(nm) {
    if (lang === 'ka') return nm.sen || nm.sru || '';
    if (nm.ska) return nm.ska;
    var other = lang === 'ru' ? nm.sen : nm.sru;
    return other && other !== streetName(nm) ? other : '';
  }
  function showCard(nm) {
    var el = $('card');
    if (!nm) { el.hidden = true; return; }
    var unknown = nm.cat === 'person' || nm.guess;
    el.innerHTML = '<button class="x" aria-label="×">×</button>' +
      '<div class="ka">' + esc(altName(nm)) + '</div><div class="street">' + esc(streetName(nm)) + '</div>' +
      whoLine(nm) + '<div>' + tags(nm) + '</div>' +
      '<button class="sg-open' + (unknown ? ' strong' : '') + '">' + (unknown ? t('suggestUnknown') : t('suggestFix')) + '</button>' +
      '<div class="sg" hidden></div>';
    el.hidden = false;
    el.querySelector('.x').onclick = function () { st.sel = null; el.hidden = true; draw(); };
    el.querySelector('.sg-open').onclick = function () { openSuggest(nm, el.querySelector('.sg'), this); };
  }

  // ── "who is this?" suggestions (reviewed by hand, then folded into the data) ──
  function openSuggest(nm, box, opener) {
    opener.hidden = true;
    box.hidden = false;
    var opts = '<option value="">' + esc(t('sgCatKeep')) + '</option>' + CATS.filter(function (c) { return c !== 'person'; }).map(function (c) {
      return '<option value="' + c + '"' + (c === nm.cat && !nm.guess ? ' selected' : '') + '>' + esc(catName(c)) + '</option>';
    }).join('');
    box.innerHTML = '<div class="sg-title">' + esc(t('sgTitle')) + '</div>' +
      '<label>' + esc(t('sgCat')) + '<select class="sg-cat">' + opts + '</select></label>' +
      '<textarea class="sg-text" rows="3" maxlength="1000" placeholder="' + esc(t('sgText')) + '"></textarea>' +
      '<input class="sg-contact" maxlength="100" placeholder="' + esc(t('sgContact')) + '">' +
      '<button class="primary sg-send">' + esc(t('sgSend')) + '</button><div class="sg-msg muted"></div>';
    var send = box.querySelector('.sg-send'), msg = box.querySelector('.sg-msg');
    box.querySelector('.sg-text').focus();
    send.onclick = function () {
      var cat = box.querySelector('.sg-cat').value, text = box.querySelector('.sg-text').value.trim();
      if (cat === nm.cat && !nm.guess) cat = ''; // unchanged category is not a suggestion
      if (!cat && text.length < 3) { msg.textContent = t('sgEmpty'); return; }
      send.disabled = true;
      api('suggest', { n: nm.idx, cat: cat || null, text: text, contact: box.querySelector('.sg-contact').value.trim(), lang: lang, deviceId: deviceId() })
        .then(function (r) {
          if (r.error) throw new Error(r.error);
          box.innerHTML = '<div class="sg-title">' + esc(t('sgThanks')) + '</div>';
          track('streets_suggest', { cat: cat || 'none', was: nm.cat });
        })
        .catch(function () { send.disabled = false; msg.textContent = t('netErr'); });
    };
  }

  // ── view URLs: /lab/streets/<slug>/ per category or flag (slugs come from the server) ──
  var BOOT = window.STREETS_VIEW || { slug: '', slugs: {} };
  var FLAG_CITY = { foreign: { ru: 'иностранцев', en: 'Foreigners’', ka: 'უცხოელების' }, female: { ru: 'женщин', en: 'Women’s', ka: 'ქალების' } };
  // the URL for a view; a category wins over flags, and combinations fall back to the closest single view
  function viewUrl(cat, flag) {
    var key = cat || flag;
    var slug = key && BOOT.slugs[key];
    return (BOOT.base || '/lab/streets/') + (slug ? slug + '/' : '') + location.search;
  }
  function currentUrl() {
    var flag = !st.cat && st.foreign !== st.female ? (st.foreign ? 'foreign' : 'female') : null;
    return viewUrl(st.cat, flag);
  }
  var titleDirty = false; // set once the visitor moves between views
  function pushView() {
    titleDirty = true;
    var u = currentUrl();
    if (u !== location.pathname + location.search) history.pushState(null, '', u);
  }
  function applyView(slug) {
    var key = null;
    Object.keys(BOOT.slugs).forEach(function (k) { if (BOOT.slugs[k] === slug) key = k; });
    st.cat = key && key !== 'foreign' && key !== 'female' ? key : null;
    st.foreign = key === 'foreign';
    st.female = key === 'female';
  }
  window.addEventListener('popstate', function () {
    if (!D) return;
    var base = BOOT.base || '/lab/streets/';
    var rest = location.pathname.indexOf(base) === 0 ? location.pathname.slice(base.length) : '';
    var m = /^([a-z-]+)\//.exec(rest);
    applyView(m ? m[1] : '');
    titleDirty = true;
    st.sel = null; showCard(null);
    if (location.hash === '#game') { setMode('game'); return; }
    if (st.mode !== 'map') setMode('map'); else { renderMapSide(); draw(); }
  });

  // ── side panel: map mode ──
  // every counter follows the active filters: category rows count only foreigners/women when those
  // are on, and the filter buttons count only inside the chosen category
  function kmOf(pred) { var s = 0; names.forEach(function (n) { if (pred(n)) s += n.len; }); return s; }
  function passFlags(n, skip) { return (skip === 'foreign' || !st.foreign || n.foreign) && (skip === 'female' || !st.female || n.female); }
  function pct(v) { return (100 * v / allKm).toFixed(1).replace('.', lang === 'en' ? '.' : ','); }
  var allKm = 0;
  function renderMapSide() {
    var side = $('side');
    if (!allKm) allKm = kmOf(function () { return true; });
    var catKm = {};
    CATS.forEach(function (c) { catKm[c] = kmOf(function (n) { return n.cat === c && passFlags(n); }); });
    var selKm = kmOf(matches);
    var head = st.cat ? fill(t('cityOf'), { x: CAT[st.cat].city[lang] }) : t('all');
    if (!st.cat && st.foreign !== st.female) head = fill(t('cityOf'), { x: FLAG_CITY[st.foreign ? 'foreign' : 'female'][lang] });
    else if (!st.cat && st.foreign && st.female) head = t('foreign') + ' + ' + t('female');
    // the first render keeps the server's SEO title (it has the street count and km); later views set their own
    if (titleDirty) document.title = (filtered() ? head + ' — ' : '') + t('title') + ' — dimazvali.com';
    var h = '<h1>' + esc(head) + '</h1>';
    if (filtered()) {
      h += '<div class="total">' + fill(t('share'), { p: pct(selKm), km: fmtKm(selKm) }) + '</div>';
    } else {
      h += '<p class="lead">' + t('lead') + '</p><div class="total">' + fill(t('total'), { km: fmtKm(allKm) }) + '</div>';
    }
    function flagKm(f) { return kmOf(function (n) { return n[f] && (!st.cat || n.cat === st.cat) && passFlags(n, f); }); }
    h += '<div class="filters">' +
      '<button data-f="foreign" aria-pressed="' + st.foreign + '">' + t('foreign') + ' · ' + fmtKm(flagKm('foreign')) + ' ' + t('km') + '</button>' +
      '<button data-f="female" aria-pressed="' + st.female + '">' + t('female') + ' · ' + fmtKm(flagKm('female')) + ' ' + t('km') + '</button></div>';
    var maxKm = Math.max.apply(null, CATS.map(function (c) { return catKm[c]; })) || 1;
    function row(c) {
      return '<a class="cat" href="' + esc(viewUrl(st.cat === c ? null : c, null)) + '" data-c="' + c + '" aria-pressed="' + (st.cat === c) + '"' + (catKm[c] ? '' : ' style="opacity:.4"') + '><i style="background:' + CAT[c].c + '"></i>' +
        '<b>' + esc(catName(c)) + '</b><em>' + fmtKm(catKm[c]) + '</em>' +
        '<span class="bar"><span style="width:' + (100 * catKm[c] / maxKm).toFixed(1) + '%;background:' + CAT[c].c + '"></span></span></a>';
    }
    var ppl = CATS.filter(function (c) { return PEOPLE.indexOf(c) >= 0 || c === 'person'; }).sort(function (a, b) { return catKm[b] - catKm[a]; });
    var oth = CATS.filter(function (c) { return ppl.indexOf(c) < 0; }).sort(function (a, b) { return catKm[b] - catKm[a]; });
    // keep "unknown people" at the bottom of the people list
    ppl.splice(ppl.indexOf('person'), 1); ppl.push('person');
    h += '<div class="group">' + t('people') + '</div>' + ppl.map(row).join('');
    h += '<div class="group">' + t('things') + '</div>' + oth.map(row).join('');
    if (st.cat === 'person') h += '<p class="lead" style="margin-top:14px">' + t('personHint') + '</p>';
    h += '<p class="note">' + t('note') + '</p>';
    side.innerHTML = h;
    side.querySelectorAll('.cat').forEach(function (b) {
      b.onclick = function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; // let "open in new tab" work
        e.preventDefault();
        var c = b.getAttribute('data-c');
        st.cat = st.cat === c ? null : c;
        if (st.sel && !matches(st.sel)) { st.sel = null; showCard(null); }
        pushView();
        renderMapSide(); draw();
        if (st.cat) track('streets_cat', { cat: st.cat });
      };
    });
    side.querySelectorAll('[data-f]').forEach(function (b) {
      b.onclick = function () {
        var f = b.getAttribute('data-f');
        st[f] = !st[f];
        if (st.sel && !matches(st.sel)) { st.sel = null; showCard(null); }
        pushView();
        renderMapSide(); draw();
      };
    });
  }

  // ── game ──
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
  function pickQuestions() {
    // people with a known occupation, weighted towards longer (better-known) streets
    var pool = names.filter(function (n) { return PEOPLE.indexOf(n.cat) >= 0 && !n.guess && n.len > 0.25 && (n.pru || n.pen); });
    var picked = [], used = {}, cats = {};
    var tries = 0;
    while (picked.length < ROUNDS && tries++ < 5000) {
      var tot = 0;
      pool.forEach(function (n) { tot += Math.sqrt(n.len); });
      var r = Math.random() * tot, n = null;
      for (var i = 0; i < pool.length; i++) { r -= Math.sqrt(pool[i].len); if (r <= 0) { n = pool[i]; break; } }
      if (!n || used[personName(n)]) continue;
      if ((cats[n.cat] || 0) >= 3) continue; // not ten writers in a row
      used[personName(n)] = 1; cats[n.cat] = (cats[n.cat] || 0) + 1;
      picked.push(n);
    }
    return picked;
  }
  function newGame() {
    st.game = { qs: pickQuestions(), i: 0, score: [], answered: false, cur: null };
    st.sel = null; showCard(null);
    nextQuestion();
    track('streets_game_start');
  }
  function nextQuestion() {
    var g = st.game;
    if (g.i >= g.qs.length) return renderGameEnd();
    var name = g.qs[g.i];
    var opts = shuffle(PEOPLE.filter(function (c) { return c !== name.cat; })).slice(0, 3).concat([name.cat]);
    g.cur = { name: name, opts: shuffle(opts) };
    g.answered = false;
    renderGameSide();
    fit(name.bbox, 60, true);
  }
  function scoreBar(g) {
    var h = '<div class="score">';
    for (var i = 0; i < ROUNDS; i++) h += '<i class="' + (g.score[i] === true ? 'ok' : g.score[i] === false ? 'no' : '') + '"></i>';
    return h + '</div>';
  }
  function renderGameSide() {
    var g = st.game, q = g.cur, side = $('side');
    var h = '<div class="game">' + scoreBar(g) + '<h2>' + fill(t('round'), { n: g.i + 1, t: g.qs.length }) + '</h2>' +
      '<div class="q">' + esc(streetName(q.name)) + '</div><div class="q-ka">' + esc(altName(q.name)) + '</div>' +
      '<p class="muted">' + t('ask') + '</p><div class="opts">';
    q.opts.forEach(function (c) {
      h += '<button data-c="' + c + '"><i style="background:' + CAT[c].c + '"></i>' + esc(catOpt(c)) + '</button>';
    });
    h += '</div><div id="reveal"></div></div>';
    side.innerHTML = h;
    side.querySelectorAll('.opts button').forEach(function (b) { b.onclick = function () { answer(b.getAttribute('data-c')); }; });
    side.scrollTop = 0;
  }
  function answer(c) {
    var g = st.game, q = g.cur;
    if (g.answered) return;
    g.answered = true;
    var ok = c === q.name.cat;
    g.score.push(ok);
    $('side').querySelectorAll('.opts button').forEach(function (b) {
      var bc = b.getAttribute('data-c');
      b.disabled = true;
      if (bc === q.name.cat) b.classList.add('right');
      else if (bc === c) b.classList.add('wrong');
    });
    var last = g.i + 1 >= g.qs.length;
    $('reveal').innerHTML = '<div class="reveal"><b>' + (ok ? t('right') : esc(fill(t('wrongIs'), { cat: catOpt(q.name.cat).toLowerCase() }))) + '</b>' +
      whoLine(q.name) + '<div>' + tags(q.name) + '</div></div>' +
      '<button class="primary" id="next">' + (last ? t('finish') : t('next')) + '</button>';
    $('next').onclick = function () { g.i++; nextQuestion(); };
    $('next').focus({ preventScroll: true });
    scoreRefresh();
    draw();
  }
  function scoreRefresh() { var el = $('side').querySelector('.score'); if (el) el.outerHTML = scoreBar(st.game); }
  function renderGameEnd() {
    var g = st.game, s = g.score.filter(Boolean).length, best = Math.max(+lsGet(cityKey('streets-best')) || 0, s);
    lsSet(cityKey('streets-best'), String(best));
    g.cur = null;
    var rank = t('ranks')[Math.min(4, Math.floor(s / 2.5))];
    $('side').innerHTML = '<div class="game">' + scoreBar(g) + '<h2>' + t('finish') + '</h2>' +
      '<div class="big">' + s + ' <span class="muted" style="font-size:22px">' + fill(t('result'), { t: g.qs.length }) + '</span></div>' +
      '<div class="q">' + esc(rank) + '</div><p class="muted">' + fill(t('best'), { b: best }) + '</p>' +
      '<button class="primary" id="go-endless">' + t('endlessGo') + '</button>' +
      '<p class="muted" style="margin:8px 0 0">' + t('endlessLead') + '</p>' +
      '<button class="primary ghost" id="share">' + t('shareBtn') + '</button>' +
      '<button class="primary ghost" id="again">' + t('again') + '</button></div>';
    $('go-endless').onclick = startEndless;
    $('again').onclick = newGame;
    $('share').onclick = function () {
      var url = location.origin + location.pathname + '#game';
      var text = fill(t('shareText'), { s: s, t: g.qs.length }) + g.score.map(function (x) { return x ? '🟩' : '🟥'; }).join('');
      if (navigator.share) navigator.share({ text: text, url: url }).catch(function () {});
      else if (navigator.clipboard) navigator.clipboard.writeText(text + ' ' + url).then(function () { $('share').textContent = t('copied'); });
      track('streets_share', { score: s });
    };
    fit(D.bbox, 20, true);
    track('streets_game_end', { score: s });
  }
  function renderGameIntro() {
    $('side').innerHTML = '<div class="game"><h1>' + t('game') + '</h1><p class="lead">' + t('gameLead') + '</p>' +
      (lsGet(cityKey('streets-best')) ? '<p class="muted">' + fill(t('best'), { b: lsGet(cityKey('streets-best')) }) + '</p>' : '') +
      '<button class="primary" id="start">' + t('classic') + '</button>' +
      '<p class="lead" style="margin-top:22px">' + t('endlessLead') + '</p>' +
      '<button class="primary ghost" id="endless">' + t('endless') + '</button>' +
      '<div id="top"></div></div>';
    $('start').onclick = newGame;
    $('endless').onclick = startEndless;
    loadTop();
  }

  // ── endless run: questions come from the server, which also checks the answers ──
  function deviceId() {
    var d = lsGet('streets-device');
    if (!d || !/^[A-Za-z0-9-]{16,64}$/.test(d)) {
      d = window.crypto && crypto.randomUUID ? crypto.randomUUID()
        : (Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2)).slice(0, 32);
      lsSet('streets-device', d);
    }
    return d;
  }
  var API = CITY_BOOT.api || '/lab/streets/';
  function api(path, body) {
    var opts = body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {};
    return fetch(API + path, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok && !j.error) j.error = 'http'; return j; });
    });
  }
  function topHtml(list) {
    if (!list || !list.length) return '<p class="muted">' + t('noTop') + '</p>';
    return '<ol class="top">' + list.map(function (r) {
      return '<li' + (r.me ? ' class="me"' : '') + '><span>' + r.rank + '</span><b>' + esc(r.nick) + '</b><em>' + r.streak + '</em></li>';
    }).join('') + '</ol>';
  }
  function loadTop() {
    api('scores?d=' + encodeURIComponent(deviceId())).then(function (j) {
      var el = $('top');
      if (el && j.top) el.innerHTML = '<div class="group">' + t('top') + '</div>' + topHtml(j.top);
    }).catch(function () { /* the table is optional */ });
  }
  function startEndless() {
    st.game = { endless: true, streak: 0, answered: false, cur: null, run: null };
    st.sel = null; showCard(null);
    $('side').innerHTML = '<p class="muted">…</p>';
    api('run', { deviceId: deviceId() }).then(function (r) {
      if (!r.run || !r.q) throw new Error(r.error || 'run');
      st.game.run = r.run;
      endlessQuestion(r.q);
      track('streets_endless_start');
    }).catch(function () { $('side').innerHTML = '<p class="muted">' + t('netErr') + '</p><button class="primary" id="retry">' + t('again') + '</button>'; $('retry').onclick = startEndless; });
  }
  function endlessQuestion(q) {
    var g = st.game;
    g.cur = { name: names[q.n], opts: q.opts };
    g.answered = false;
    renderEndlessSide();
    fit(g.cur.name.bbox, 60, true);
  }
  function renderEndlessSide() {
    var g = st.game, q = g.cur;
    var h = '<div class="game"><h2>' + t('streak') + '</h2><div class="big" style="font-size:44px">' + g.streak + '</div>' +
      '<div class="q">' + esc(streetName(q.name)) + '</div><div class="q-ka">' + esc(altName(q.name)) + '</div>' +
      '<p class="muted">' + t('ask') + '</p><div class="opts">';
    q.opts.forEach(function (c) {
      h += '<button data-c="' + c + '"><i style="background:' + CAT[c].c + '"></i>' + esc(catOpt(c)) + '</button>';
    });
    h += '</div><div id="reveal"></div></div>';
    $('side').innerHTML = h;
    $('side').querySelectorAll('.opts button').forEach(function (b) { b.onclick = function () { answerEndless(b.getAttribute('data-c')); }; });
  }
  function answerEndless(c) {
    var g = st.game;
    if (g.answered || g.busy) return;
    g.busy = true;
    var btns = $('side').querySelectorAll('.opts button');
    btns.forEach(function (b) { b.disabled = true; });
    api('answer', { run: g.run, cat: c }).then(function (r) {
      g.busy = false;
      if (r.error) throw new Error(r.error);
      g.answered = true;
      g.streak = r.streak;
      btns.forEach(function (b) {
        var bc = b.getAttribute('data-c');
        if (bc === r.cat) b.classList.add('right'); else if (bc === c) b.classList.add('wrong');
      });
      var name = g.cur.name;
      var over = !r.correct || !r.q;
      var head = r.correct ? (r.q ? t('right') : t('perfect')) : t('over');
      $('reveal').innerHTML = '<div class="reveal"><b>' + esc(head) + '</b>' + whoLine(name) + '<div>' + tags(name) + '</div></div>' +
        '<button class="primary" id="next">' + (over ? t('finish') : t('next')) + '</button>';
      $('next').onclick = function () { if (over) renderEndlessEnd(); else endlessQuestion(r.q); };
      $('next').focus({ preventScroll: true });
      var big = $('side').querySelector('.big'); if (big) big.textContent = g.streak;
      draw();
    }).catch(function () {
      g.busy = false;
      btns.forEach(function (b) { b.disabled = false; });
      $('reveal').innerHTML = '<p class="muted">' + t('netErr') + '</p>';
    });
  }
  function renderEndlessEnd() {
    var g = st.game, s = g.streak, best = Math.max(+lsGet(cityKey('streets-best-endless')) || 0, s);
    lsSet(cityKey('streets-best-endless'), String(best));
    g.cur = null; g.over = true;
    var h = '<div class="game"><h2>' + t('yourStreak') + '</h2><div class="big">' + s + '</div>' +
      '<p class="muted">' + fill(t('best'), { b: best }) + '</p>';
    if (s >= 1 && !g.saved) {
      h += '<label class="muted" for="nick">' + t('nick') + '</label>' +
        '<input id="nick" maxlength="20" autocomplete="nickname" value="' + esc(lsGet('streets-nick') || '') + '">' +
        '<button class="primary" id="save">' + t('save') + '</button><p class="muted" id="saveMsg"></p>';
    }
    h += '<button class="primary ghost" id="share">' + t('shareBtn') + '</button>' +
      '<button class="primary ghost" id="again">' + t('again') + '</button><div id="top"></div></div>';
    $('side').innerHTML = h;
    $('again').onclick = startEndless;
    $('share').onclick = function () {
      var url = location.origin + location.pathname + '#game';
      var text = fill(t('shareEndless'), { s: s });
      if (navigator.share) navigator.share({ text: text, url: url }).catch(function () {});
      else if (navigator.clipboard) navigator.clipboard.writeText(text + url).then(function () { $('share').textContent = t('copied'); });
      track('streets_share', { streak: s, mode: 'endless' });
    };
    if ($('save')) $('save').onclick = function () {
      var nick = $('nick').value.trim();
      if (!nick) { $('nick').focus(); return; }
      lsSet('streets-nick', nick);
      $('save').disabled = true;
      api('scores', { run: g.run, deviceId: deviceId(), nick: nick }).then(function (r) {
        if (r.error === 'time') { $('saveMsg').textContent = t('tooFast'); return; }
        if (r.error) { $('saveMsg').textContent = t('netErr'); $('save').disabled = false; return; }
        g.saved = true;
        $('save').textContent = t('saved');
        $('top').innerHTML = '<div class="group">' + t('top') + '</div>' + topHtml(r.top);
      }).catch(function () { $('saveMsg').textContent = t('netErr'); $('save').disabled = false; });
    };
    loadTop();
    fit(D.bbox, 20, true);
    track('streets_endless_end', { streak: s });
  }
  function renderGame() {
    var g = st.game;
    if (!g) return renderGameIntro();
    if (g.endless) {
      if (g.cur && !g.answered) return renderEndlessSide();
      if (g.over || !g.cur) return renderEndlessEnd();
      return; // answered, waiting for "next": keep the reveal as it is
    }
    if (g.cur && !g.answered) return renderGameSide();
    if (!g.cur) return renderGameEnd();
  }

  // ── chrome ──
  function setMode(m) {
    st.mode = m;
    $('tab-map').setAttribute('aria-pressed', m === 'map');
    $('tab-game').setAttribute('aria-pressed', m === 'game');
    if (m === 'map') { st.game = null; renderMapSide(); history.replaceState(null, '', location.pathname + location.search); }
    else { st.sel = null; showCard(null); renderGame(); history.replaceState(null, '', '#game'); }
    draw();
  }
  function applyLang() {
    document.documentElement.lang = lang;
    if (titleDirty) document.title = t('title') + ' — dimazvali.com';
    document.querySelector('.logo').firstChild.nodeValue = t('title');
    $('tab-map').textContent = t('map');
    $('tab-game').textContent = t('game');
    $('hint').textContent = t('hint');
    if ($('allp')) $('allp').textContent = t('allProjects');
    $('sub').textContent = CITY === 'spb' ? (lang === 'ru' ? 'Whose streets?' : 'Чьи улицы?') : lang === 'ka' ? 'Whose streets?' : 'ვისი ქუჩებია';
    document.querySelectorAll('.lang button').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-lang') === lang);
      b.hidden = LANGS.indexOf(b.getAttribute('data-lang')) < 0; // no Georgian for Petersburg
    });
    // the city switcher in the header
    var CITY_NAMES = { tbilisi: { ru: 'Тбилиси', en: 'Tbilisi', ka: 'თბილისი' }, spb: { ru: 'Петербург', en: 'St Petersburg', ka: 'პეტერბურგი' } };
    ['tbilisi', 'spb'].forEach(function (c) {
      var a = $('c-' + c);
      if (!a) return;
      a.textContent = CITY_NAMES[c][lang];
      if (c === CITY) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }
  document.querySelectorAll('.lang button').forEach(function (b) {
    b.onclick = function () {
      lang = b.getAttribute('data-lang'); lsSet('streets-lang', lang); titleDirty = true; applyLang();
      if (!D) return;
      if (st.mode === 'map') { renderMapSide(); showCard(st.sel); }
      else renderGame();
    };
  });
  $('tab-map').onclick = function () { setMode('map'); };
  $('tab-game').onclick = function () { setMode('game'); };
  window.addEventListener('resize', resize);
  document.addEventListener('keydown', function (e) {
    if (st.mode !== 'game' || !st.game || !st.game.cur || e.target.tagName === 'INPUT') return;
    if (!st.game.answered && /^[1-4]$/.test(e.key)) (st.game.endless ? answerEndless : answer)(st.game.cur.opts[+e.key - 1]);
    else if (st.game.answered && (e.key === 'Enter' || e.key === ' ') && $('next')) { e.preventDefault(); $('next').click(); }
  });

  applyLang();
  resize();
  fetch(CITY_BOOT.data || '/lab/streets/data.json?v=2').then(function (r) { return r.json(); }).then(function (data) {
    decode(data);
    applyView(BOOT.slug);
    fit(D.bbox, 12, false);
    setMode(location.hash === '#game' ? 'game' : 'map');
    // ?focus=<street's local name> (the admin's "show on the map"): select that street and zoom to it
    var focus = new URLSearchParams(location.search).get('focus');
    var hit = focus && names.filter(function (n) { return (CITY === 'spb' ? n.sru : n.ska) === focus; })[0];
    if (hit && st.mode === 'map') { st.sel = hit; showCard(hit); fit(hit.bbox, 80, false); }
  }).catch(function (e) {
    $('side').innerHTML = '<p class="muted">Не получилось загрузить данные: ' + esc(e.message) + '</p>';
  });
})();
