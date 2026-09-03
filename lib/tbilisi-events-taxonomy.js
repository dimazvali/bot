'use strict';

// Slugs are what we store in Firestore. Labels are Russian, UI-only.
var EVENT_TYPE_LABELS = {
  concert: 'концерт',
  exhibition: 'выставка',
  theatre: 'театр / перформанс',
  festival: 'фестиваль',
  party: 'вечеринка',
  kids: 'для детей',
  cinema: 'кино / показ',
  lecture: 'лекция / воркшоп',
  sport: 'спорт',
  other: 'другое',
};
var EVENT_TYPE_SLUGS = Object.keys(EVENT_TYPE_LABELS);

var LANGUAGE_LABELS = { ka: 'грузинский', ru: 'русский', en: 'английский', other: 'другой' };
var LANGUAGE_SLUGS = Object.keys(LANGUAGE_LABELS);

var VENUE_TYPE_LABELS = {
  concert_hall: 'концертный зал',
  gallery: 'галерея',
  theatre: 'театр',
  club: 'клуб / бар',
  restaurant: 'ресторан',
  museum: 'музей',
  openair: 'открытая площадка',
  other: 'другое',
};
var VENUE_TYPE_SLUGS = Object.keys(VENUE_TYPE_LABELS);

// ---------------- cities & districts (static reference) ----------------
// Trilingual place names. `slug` is what we store on venues (venue.city /
// venue.district). District lists are neighbourhood-level, not the formal
// administrative raions, since that's how venues are actually placed.
var CITIES = [
  { slug: 'tbilisi', name: { ru: 'Тбилиси', en: 'Tbilisi', ka: 'თბილისი' } },
  { slug: 'batumi', name: { ru: 'Батуми', en: 'Batumi', ka: 'ბათუმი' } },
];
var CITY_SLUGS = CITIES.map(function(c) { return c.slug; });

var DISTRICTS = {
  tbilisi: [
    { slug: 'old-tbilisi', name: { ru: 'Старый город', en: 'Old Tbilisi', ka: 'ძველი თბილისი' } },
    { slug: 'sololaki', name: { ru: 'Сололаки', en: 'Sololaki', ka: 'სოლოლაკი' } },
    { slug: 'mtatsminda', name: { ru: 'Мтацминда', en: 'Mtatsminda', ka: 'მთაწმინდა' } },
    { slug: 'vera', name: { ru: 'Вера', en: 'Vera', ka: 'ვერა' } },
    { slug: 'vake', name: { ru: 'Ваке', en: 'Vake', ka: 'ვაკე' } },
    { slug: 'saburtalo', name: { ru: 'Сабуртало', en: 'Saburtalo', ka: 'საბურთალო' } },
    { slug: 'chugureti', name: { ru: 'Чугурети', en: 'Chugureti', ka: 'ჩუღურეთი' } },
    { slug: 'marjanishvili', name: { ru: 'Марджанишвили', en: 'Marjanishvili', ka: 'მარჯანიშვილი' } },
    { slug: 'avlabari', name: { ru: 'Авлабари', en: 'Avlabari', ka: 'ავლაბარი' } },
    { slug: 'isani', name: { ru: 'Исани', en: 'Isani', ka: 'ისანი' } },
    { slug: 'samgori', name: { ru: 'Самгори', en: 'Samgori', ka: 'სამგორი' } },
    { slug: 'didube', name: { ru: 'Дидубе', en: 'Didube', ka: 'დიდუბე' } },
    { slug: 'nadzaladevi', name: { ru: 'Надзаладеви', en: 'Nadzaladevi', ka: 'ნაძალადევი' } },
    { slug: 'gldani', name: { ru: 'Глдани', en: 'Gldani', ka: 'გლდანი' } },
    { slug: 'krtsanisi', name: { ru: 'Крцаниси', en: 'Krtsanisi', ka: 'კრწანისი' } },
    { slug: 'ortachala', name: { ru: 'Ортачала', en: 'Ortachala', ka: 'ორთაჭალა' } },
    { slug: 'didi-dighomi', name: { ru: 'Диди-Дигоми', en: 'Didi Dighomi', ka: 'დიდი დიღომი' } },
    { slug: 'vashlijvari', name: { ru: 'Вашлиджвари', en: 'Vashlijvari', ka: 'ვაშლიჯვარი' } },
    { slug: 'other', name: { ru: 'Другой район', en: 'Other', ka: 'სხვა' } },
  ],
  batumi: [
    { slug: 'old-batumi', name: { ru: 'Старый Батуми', en: 'Old Batumi', ka: 'ძველი ბათუმი' } },
    { slug: 'city-center', name: { ru: 'Центр', en: 'City centre', ka: 'ცენტრი' } },
    { slug: 'boulevard', name: { ru: 'Приморский бульвар', en: 'Seaside Boulevard', ka: 'ბულვარი' } },
    { slug: 'new-boulevard', name: { ru: 'Новый бульвар', en: 'New Boulevard', ka: 'ახალი ბულვარი' } },
    { slug: 'rustaveli', name: { ru: 'Руставели', en: 'Rustaveli area', ka: 'რუსთაველის უბანი' } },
    { slug: 'bagrationi', name: { ru: 'Багратиони', en: 'Bagrationi', ka: 'ბაგრატიონი' } },
    { slug: 'khimshiashvili', name: { ru: 'Химшиашвили', en: 'Khimshiashvili', ka: 'ხიმშიაშვილი' } },
    { slug: 'tamar-mepe', name: { ru: 'Тамар Мепе', en: 'Tamar Mepe', ka: 'თამარ მეფის დასახლება' } },
    { slug: 'aghmashenebeli', name: { ru: 'Агмашенебели', en: 'Aghmashenebeli', ka: 'აღმაშენებლის ქუჩა' } },
    { slug: 'bartskhana', name: { ru: 'Барцхана', en: 'Bartskhana', ka: 'ბარცხანა' } },
    { slug: 'angisa', name: { ru: 'Ангиса', en: 'Angisa', ka: 'ანგისა' } },
    { slug: 'makhinjauri', name: { ru: 'Махинджаури', en: 'Makhinjauri', ka: 'მახინჯაური' } },
    { slug: 'gonio', name: { ru: 'Гонио', en: 'Gonio', ka: 'გონიო' } },
    { slug: 'kvariati', name: { ru: 'Квариати', en: 'Kvariati', ka: 'კვარიათი' } },
    { slug: 'other', name: { ru: 'Другой район', en: 'Other', ka: 'სხვა' } },
  ],
};

function isValidCity(slug) { return CITY_SLUGS.indexOf(slug) !== -1; }

function districtsForCity(citySlug) { return DISTRICTS[citySlug] || []; }

function isValidDistrict(citySlug, districtSlug) {
  return districtsForCity(citySlug).some(function(d) { return d.slug === districtSlug; });
}

function cityName(slug, lang) {
  var c = CITIES.find(function(x) { return x.slug === slug; });
  if (!c) return '';
  return c.name[lang] || c.name.ru || c.name.en || '';
}

function districtName(citySlug, districtSlug, lang) {
  var d = districtsForCity(citySlug).find(function(x) { return x.slug === districtSlug; });
  if (!d) return '';
  return d.name[lang] || d.name.ru || d.name.en || '';
}

function isValidEventType(s) { return EVENT_TYPE_SLUGS.indexOf(s) !== -1; }
function isValidVenueType(s) { return VENUE_TYPE_SLUGS.indexOf(s) !== -1; }

function sanitizeLanguages(arr) {
  if (!Array.isArray(arr)) return [];
  var out = [];
  arr.forEach(function(x) {
    var v = String(x).toLowerCase().trim();
    if (LANGUAGE_SLUGS.indexOf(v) !== -1 && out.indexOf(v) === -1) out.push(v);
  });
  return out;
}

module.exports = {
  EVENT_TYPE_LABELS: EVENT_TYPE_LABELS,
  EVENT_TYPE_SLUGS: EVENT_TYPE_SLUGS,
  LANGUAGE_LABELS: LANGUAGE_LABELS,
  LANGUAGE_SLUGS: LANGUAGE_SLUGS,
  VENUE_TYPE_LABELS: VENUE_TYPE_LABELS,
  VENUE_TYPE_SLUGS: VENUE_TYPE_SLUGS,
  CITIES: CITIES,
  CITY_SLUGS: CITY_SLUGS,
  DISTRICTS: DISTRICTS,
  districtsForCity: districtsForCity,
  isValidCity: isValidCity,
  isValidDistrict: isValidDistrict,
  cityName: cityName,
  districtName: districtName,
  isValidEventType: isValidEventType,
  isValidVenueType: isValidVenueType,
  sanitizeLanguages: sanitizeLanguages,
};
