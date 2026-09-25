'use strict';

// UI strings that only the v2 redesign uses (routes/photo-v2.js hands them to
// the templates as `t`). Everything the old site already had stays in
// lib/photo-i18n.js and is reused as `ui` — this file only adds what's new.

function ruPlural(n, one, few, many) {
  var m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

var STRINGS = {
  ru: {
    filters: 'Фильтры', portfolio: 'ПОРТФОЛИО', about: 'ОБО МНЕ', color: 'ЦВЕТ', type: 'ТИП', tag: 'ТЕГ',
    openTagPage: 'страница тега', map: '⌖ КАРТА',
    orderShoot: 'Заказать съёмку', subscribeCaps: 'ПОДПИСАТЬСЯ',
    series: 'СЕРИИ',
    seriesN: function(n) { return n + ' ' + ruPlural(n, 'серия', 'серии', 'серий'); },
    shootsWord: 'съёмок',
    homeKicker: 'Тбилиси · документальная фотография · с воздуха и с земли',
    heroName: ['Дмитрий', 'Шестаков'],
    homeLead: 'Журналист из Петербурга, разработчик и фотограф из Тбилиси. Снимаю серии — город, людей, еду, горы — с коптера, камеры и телефона.',
    printsLicenses: 'Отпечатки и лицензии',
    countryWord: 'страна', seriesWord: 'серия', tagWord: 'ТЕГ',
    subscribeKicker: 'Новые серии — первым', subscribeTitle: 'ПОДПИШИТЕСЬ',
    subscribeText: 'Одно письмо или сообщение, когда выходит новая серия.',
    byTelegramShort: 'ТЕЛЕГРАМ',
    noMatches: 'По этим фильтрам ничего нет.', resetFilters: 'сбросить фильтры',
    buyPrint: 'КУПИТЬ ОТПЕЧАТОК',
    inquiryHint: 'Этот кадр можно купить отпечатком или лицензировать.',
    inquiryMessage: 'Размер, бумага, сроки…', inquiryNote: 'отвечу в течение 24 часов',
    promoKicker: 'Тбилиси и вся Грузия',
    promoSubtitle: 'Портреты, события, съёмка с коптера. Напишите — отвечу в течение дня.',
    promoMessage: 'Что снимаем? (необязательно)', promoSubmit: 'ОТПРАВИТЬ ЗАЯВКУ',
    promoDirect: 'или напрямую:', promoBarText: 'Хотите такую съёмку?',
    shootClosed: 'закрытая съёмка', shootOpen: 'съёмка',
    downloadAll: '↓ СКАЧАТЬ ВСЁ · ZIP',
    shootHint: 'отметьте понравившиеся кадры и сохраните подборку — я получу её сразу.',
    findYourself: 'НАЙТИ СЕБЯ', curatorPick: 'ВЫБОР АВТОРА',
    curatorAdd: '★ В ОТБОР', curatorRemove: '☆ УБРАТЬ ИЗ ОТБОРА',
    curatorRest: function(n) { return 'остальные ' + n + ' скрыты'; },
    notFoundTitle: 'Страница не найдена', notFoundKicker: 'dimazvali.com · photo · not found',
    notFoundLead: 'Этот кадр, кажется, не проявился. Возможно, серию переименовали или ссылка устарела.',
    toHome: 'на главную', randomFrame: 'случайный кадр', maybeThese: 'Может, вот это?',
    notFoundFoot: 'Нужна именно та страница? Напишите:',
    hasCaption: 'У кадра есть описание — откройте, чтобы прочитать', hasNotes: 'На кадре есть пометки',
  },
  en: {
    filters: 'Filters', portfolio: 'PORTFOLIO', about: 'ABOUT', color: 'COLOR', type: 'TYPE', tag: 'TAG',
    openTagPage: 'tag page', map: '⌖ MAP',
    orderShoot: 'Book a shoot', subscribeCaps: 'SUBSCRIBE',
    series: 'SERIES',
    seriesN: function(n) { return n + ' series'; },
    shootsWord: 'shoots',
    homeKicker: 'Tbilisi · documentary photography · from the air and the ground',
    heroName: ['Dmitry', 'Shestakov'],
    homeLead: 'A journalist from Saint Petersburg, a developer and photographer based in Tbilisi. I shoot series — the city, people, food, mountains — from a drone, a camera and a phone.',
    printsLicenses: 'Prints & licensing',
    countryWord: 'country', seriesWord: 'series', tagWord: 'TAG',
    subscribeKicker: 'New series first', subscribeTitle: 'SUBSCRIBE',
    subscribeText: 'One email or message whenever a new series comes out.',
    byTelegramShort: 'TELEGRAM',
    noMatches: 'Nothing matches these filters.', resetFilters: 'reset filters',
    buyPrint: 'BUY A PRINT',
    inquiryHint: 'This frame is available as a print or for licensing.',
    inquiryMessage: 'Size, paper, timing…', inquiryNote: "I'll reply within 24 hours",
    promoKicker: 'Tbilisi and all of Georgia',
    promoSubtitle: "Portraits, events, drone shoots. Write to me — I'll reply within the day.",
    promoMessage: 'What are we shooting? (optional)', promoSubmit: 'SEND REQUEST',
    promoDirect: 'or reach out directly:', promoBarText: 'Want a shoot like this?',
    shootClosed: 'private shoot', shootOpen: 'shoot',
    downloadAll: '↓ DOWNLOAD ALL · ZIP',
    shootHint: "mark the frames you like and save a selection — I'll get it right away.",
    findYourself: 'FIND YOURSELF', curatorPick: "AUTHOR'S PICK",
    curatorAdd: '★ ADD TO PICKS', curatorRemove: '☆ REMOVE FROM PICKS',
    curatorRest: function(n) { return n + ' more hidden'; },
    notFoundTitle: 'Page not found', notFoundKicker: 'dimazvali.com · photo · not found',
    notFoundLead: "This frame doesn't seem to have developed. Maybe the series was renamed, or the link is out of date.",
    toHome: 'home', randomFrame: 'random frame', maybeThese: 'Maybe these?',
    notFoundFoot: 'Looking for that exact page? Write to me:',
    hasCaption: 'This frame has a description — open it to read', hasNotes: 'This frame has notes pinned on it',
  },
};

module.exports = STRINGS;
