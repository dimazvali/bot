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
  museum: 'музей',
  openair: 'открытая площадка',
  other: 'другое',
};
var VENUE_TYPE_SLUGS = Object.keys(VENUE_TYPE_LABELS);

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
  isValidEventType: isValidEventType,
  isValidVenueType: isValidVenueType,
  sanitizeLanguages: sanitizeLanguages,
};
