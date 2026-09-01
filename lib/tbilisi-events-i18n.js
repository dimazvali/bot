'use strict';
var taxonomy = require('./tbilisi-events-taxonomy');

// UI chrome for the public afisha, in the three languages the events are
// described in. Mirrors the strings from the Claude Design "Events Tbiliseli"
// canvas (design_extract/events-tbiliseli/).
var LANGS = ['ru', 'en', 'ka'];

var UI = {
  ru: {
    brandTail: 'Events',
    heroKicker: 'Главное', heroSub: 'выбор редакции',
    when: 'Когда', where: 'Где', language: 'Язык', category: 'Категория',
    onSite: 'На сайт события', readMore: 'Подробнее', sourcesLabel: 'Источники', price: 'Стоимость', cancelled: 'Отменено', fromEditor: 'От редакции',
    pickDate: 'Другая дата', calendar: 'Календарь',
    today: 'Сегодня', upcoming: 'Ближайшие события', onDate: 'На эту дату',
    nothing: 'Событий не найдено', nothingUpcoming: 'Нет предстоящих событий',
    allUpcoming: '← Все предстоящие', showPast: 'Показать все, включая прошедшие', showAllUpcoming: 'Все предстоящие события',
    weekendHeading: 'Куда пойти в выходные', allWeekend: 'Все события выходных',
    rubrics: 'Рубрики', venues: 'Площадки', backToAfisha: '← Афиша',
    footer: 'Афиша Тбилиси от редакции: выбираем руками, а не по алгоритму. Обновляем по мере сбора.',
    venuesTitle:'Интересные места Тбилиси', address:'Адрес', district:'Район', venueType:'Тип', website:'Сайт', allVenueEvents:'Все события площадки', venuePoster:'Афиша', routeMap:'Маршрут в Google Maps', otherVenues:'Другие площадки', nothingHere:'Здесь пока нет предстоящих событий', eventsWord:'событий', ofWord:'из', search:'Поиск по событиям и местам',
    allChip: 'Все',
  },
  en: {
    brandTail: 'Events',
    heroKicker: 'Top pick', heroSub: 'editors’ choice',
    when: 'When', where: 'Where', language: 'Language', category: 'Category',
    onSite: 'Event website', readMore: 'Read more', sourcesLabel: 'Sources', price: 'Price', cancelled: 'Cancelled', fromEditor: 'From the editors',
    pickDate: 'Other date', calendar: 'Calendar',
    today: 'Today', upcoming: 'Upcoming events', onDate: 'On this date',
    nothing: 'No events found', nothingUpcoming: 'No upcoming events',
    allUpcoming: '← All upcoming', showPast: 'Show all, including past', showAllUpcoming: 'All upcoming events',
    weekendHeading: 'Where to go this weekend', allWeekend: 'All weekend events',
    rubrics: 'Categories', venues: 'Venues', backToAfisha: '← Afisha',
    footer: 'What’s on in Tbilisi, picked by our editors — no algorithms. Updated as we collect.',
    venuesTitle:'Tbilisi venues', address:'Address', district:'District', venueType:'Type', website:'Website', allVenueEvents:'All venue events', venuePoster:'Programme', routeMap:'Route in Google Maps', otherVenues:'Other venues', nothingHere:'No upcoming events here yet', eventsWord:'events', ofWord:'of', search:'Search events and places',
    allChip: 'All',
  },
  ka: {
    brandTail: 'Events',
    heroKicker: 'მთავარი', heroSub: 'რედაქციის არჩევანი',
    when: 'როდის', where: 'სად', language: 'ენა', category: 'კატეგორია',
    onSite: 'ღონისძიების საიტი', readMore: 'ვრცლად', sourcesLabel: 'წყაროები', price: 'ფასი', cancelled: 'გაუქმებულია', fromEditor: 'რედაქციისგან',
    pickDate: 'სხვა თარიღი', calendar: 'კალენდარი',
    today: 'დღეს', upcoming: 'უახლოესი ღონისძიებები', onDate: 'ამ თარიღზე',
    nothing: 'ღონისძიება ვერ მოიძებნა', nothingUpcoming: 'დაგეგმილი ღონისძიებები არ არის',
    allUpcoming: '← ყველა მომავალი', showPast: 'ყველას ჩვენება, წარსულის ჩათვლით', showAllUpcoming: 'ყველა მომავალი ღონისძიება',
    weekendHeading: 'სად წავიდეთ შაბათ-კვირას', allWeekend: 'შაბათ-კვირის ყველა ღონისძიება',
    rubrics: 'რუბრიკები', venues: 'ადგილები', backToAfisha: '← აფიშა',
    footer: 'თბილისის აფიშა რედაქციისგან: ხელით შერჩეული, ალგორითმის გარეშე.',
    venuesTitle:'თბილისის ადგილები', address:'მისამართი', district:'უბანი', venueType:'ტიპი', website:'საიტი', allVenueEvents:'ადგილის ყველა ღონისძიება', venuePoster:'აფიშა', routeMap:'მარშრუტი Google Maps-ში', otherVenues:'სხვა ადგილები', nothingHere:'აქ ჯერ არ არის დაგეგმილი ღონისძიებები', eventsWord:'ღონისძიება', ofWord:'-დან', search:'ძებნა ღონისძიებებსა და ადგილებში',
    allChip: 'ყველა',
  },
};

var WD_SHORT = {
  ru: ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'],
  en: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
  ka: ['კვ', 'ორ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ'],
};
var MON_SHORT = {
  ru: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
  en: ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'],
  ka: ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'],
};
var WD_FULL = {
  ru: ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  ka: ['კვირა', 'ორშაბათი', 'სამშაბათი', 'ოთხშაბათი', 'ხუთშაბათი', 'პარასკევი', 'შაბათი'],
};
var MON_FULL = {
  ru: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  ka: ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'],
};

var EVENT_TYPE_LABELS = {
  ru: taxonomy.EVENT_TYPE_LABELS,
  en: {
    concert: 'concert', exhibition: 'exhibition', theatre: 'theatre / performance',
    festival: 'festival', party: 'party', kids: 'for kids', cinema: 'cinema / screening',
    lecture: 'lecture / workshop', sport: 'sport', other: 'other',
  },
  ka: {
    concert: 'კონცერტი', exhibition: 'გამოფენა', theatre: 'თეატრი / პერფორმანსი',
    festival: 'ფესტივალი', party: 'წვეულება', kids: 'ბავშვებს', cinema: 'კინო / ჩვენება',
    lecture: 'ლექცია / ვორქშოპი', sport: 'სპორტი', other: 'სხვა',
  },
};

var LANGUAGE_LABELS = {
  ru: taxonomy.LANGUAGE_LABELS,
  en: { ka: 'Georgian', ru: 'Russian', en: 'English', other: 'other' },
  ka: { ka: 'ქართული', ru: 'რუსული', en: 'ინგლისური', other: 'სხვა' },
};

var VENUE_TYPE_LABELS = {
  ru: taxonomy.VENUE_TYPE_LABELS,
  en: {
    concert_hall: 'concert hall', gallery: 'gallery', theatre: 'theatre',
    club: 'club / bar', museum: 'museum', openair: 'open-air', other: 'other',
  },
  ka: {
    concert_hall: 'საკონცერტო დარბაზი', gallery: 'გალერეა', theatre: 'თეატრი',
    club: 'კლუბი / ბარი', museum: 'მუზეუმი', openair: 'ღია ცის ქვეშ', other: 'სხვა',
  },
};

function normalizeLang(v) {
  return LANGS.indexOf(v) !== -1 ? v : 'ru';
}

function pluralRu(n, forms) {
  var mod100 = Math.abs(n) % 100;
  var mod10 = mod100 % 10;
  if (mod100 > 10 && mod100 < 20) return forms[2];
  if (mod10 > 1 && mod10 < 5) return forms[1];
  if (mod10 === 1) return forms[0];
  return forms[2];
}

// "N events" in the given language.
function countLabel(n, lang) {
  if (lang === 'ru') return n + ' ' + pluralRu(n, ['событие', 'события', 'событий']);
  if (lang === 'ka') return n + ' ღონისძიება';
  return n + (n === 1 ? ' event' : ' events');
}

// e.g. ru "30 августа, воскресенье"; en "Sunday, 30 August"; ka "30 აგვისტო, კვირა"
function formatLongDate(dateStr, lang) {
  var parts = String(dateStr || '').split('-');
  if (parts.length !== 3) return dateStr || '';
  var y = +parts[0], m = +parts[1] - 1, d = +parts[2];
  var js = new Date(Date.UTC(y, m, d));
  var wd = WD_FULL[lang][js.getUTCDay()];
  var mon = MON_FULL[lang][m];
  if (lang === 'en') return wd + ', ' + d + ' ' + mon;
  return d + ' ' + mon + ', ' + wd;
}

// e.g. "30 авг" / "30 aug" / "30 აგვ"
function formatShortDay(dateStr, lang) {
  var parts = String(dateStr || '').split('-');
  if (parts.length !== 3) return dateStr || '';
  return (+parts[2]) + ' ' + MON_SHORT[lang][+parts[1] - 1];
}

function weekdayShort(dateStr, lang) {
  var parts = String(dateStr || '').split('-');
  if (parts.length !== 3) return '';
  var js = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]));
  return WD_SHORT[lang][js.getUTCDay()];
}

// Pick the description in the requested language, with a sensible fallback chain.
function pickDescription(description, lang) {
  if (!description) return '';
  var order = [lang, 'ru', 'en', 'ka'];
  for (var i = 0; i < order.length; i++) {
    var v = description[order[i]];
    if (v && String(v).trim()) return String(v).trim();
  }
  return '';
}

module.exports = {
  LANGS: LANGS,
  UI: UI,
  WD_SHORT: WD_SHORT,
  EVENT_TYPE_LABELS: EVENT_TYPE_LABELS,
  LANGUAGE_LABELS: LANGUAGE_LABELS,
  VENUE_TYPE_LABELS: VENUE_TYPE_LABELS,
  normalizeLang: normalizeLang,
  countLabel: countLabel,
  formatLongDate: formatLongDate,
  formatShortDay: formatShortDay,
  weekdayShort: weekdayShort,
  pickDescription: pickDescription,
};
