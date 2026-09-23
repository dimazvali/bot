'use strict';

// EN version of photo.dimazvali.com. RU stays at the existing unprefixed URLs
// (nothing changes there — no reindexing risk); EN lives under /en/*. See
// routes/photo.js for the lang-detection middleware that strips the /en
// prefix from req.url before the existing routes see it.

var LANGS = ['ru', 'en'];

function normalizeLang(v) {
  return LANGS.indexOf(v) !== -1 ? v : 'ru';
}

// '' for ru (no prefix — the existing site), '/en' for en.
function langPrefix(lang) {
  return lang === 'en' ? '/en' : '';
}

// Path in the *other* language, for hreflang / the language switcher.
// p is an unprefixed path (e.g. '/georgia/tbilisi'), already what req.url
// looks like after the lang middleware strips '/en'.
function altPrefix(lang) {
  return lang === 'en' ? '' : '/en';
}

// Parses an Accept-Language header into [{lang, q}], sorted by q (quality)
// descending — the browser's own ordered list of preferred languages, e.g.
// "en-US,en;q=0.9,ru;q=0.8" -> [{lang:'en',q:1},{lang:'en',q:0.9},{lang:'ru',q:0.8}].
function parseAcceptLanguage(header) {
  if (!header) return [];
  return String(header).split(',').map(function(part) {
    var pieces = part.trim().split(';');
    var tag = pieces[0].trim().toLowerCase();
    var q = 1;
    for (var i = 1; i < pieces.length; i++) {
      var m = pieces[i].trim().match(/^q=([0-9.]+)$/);
      if (m) q = parseFloat(m[1]);
    }
    return { lang: tag.split('-')[0], q: isNaN(q) ? 1 : q };
  }).sort(function(a, b) { return b.q - a.q; });
}

// First of 'en'/'ru' to appear in the browser's preference order; defaults to
// 'ru' (the site's home audience) when neither is present or the header is missing.
function pickPreferredLang(acceptLanguageHeader) {
  var parsed = parseAcceptLanguage(acceptLanguageHeader);
  for (var i = 0; i < parsed.length; i++) {
    if (parsed[i].lang === 'en') return 'en';
    if (parsed[i].lang === 'ru') return 'ru';
  }
  return 'ru';
}

// Picks obj[field + '_en'] when lang is 'en' and it's non-empty, else falls
// back to obj[field] (covers untranslated content gracefully).
function pickField(obj, field, lang) {
  if (!obj) return undefined;
  if (lang === 'en') {
    var v = obj[field + '_en'];
    if (v != null && String(v).trim()) return v;
  }
  return obj[field];
}

// "Июнь 2026" / "август 2025" -> "June 2026" / "August 2025". Dates are free-text
// (not structured), so this is a best-effort swap of the RU month word rather than
// a real per-field translation — good enough for the common "<Month> <Year>" shape.
var RU_MONTHS_EN = {
  'январь': 'January', 'января': 'January',
  'февраль': 'February', 'февраля': 'February',
  'март': 'March', 'марта': 'March',
  'апрель': 'April', 'апреля': 'April',
  'май': 'May', 'мая': 'May',
  'июнь': 'June', 'июня': 'June',
  'июль': 'July', 'июля': 'July',
  'август': 'August', 'августа': 'August',
  'сентябрь': 'September', 'сентября': 'September',
  'октябрь': 'October', 'октября': 'October',
  'ноябрь': 'November', 'ноября': 'November',
  'декабрь': 'December', 'декабря': 'December',
};
function translateRuDate(str) {
  if (!str) return str;
  return String(str).replace(/[А-Яа-яЁё]+/g, function(word) {
    var en = RU_MONTHS_EN[word.toLowerCase()];
    return en || word;
  });
}

function localizeAnnotations(annotations, lang) {
  if (!annotations || lang !== 'en') return annotations;
  return annotations.map(function(a) {
    return Object.assign({}, a, { text: pickField(a, 'text', 'en') });
  });
}

function localizePhoto(photo, lang) {
  if (!photo || lang !== 'en') return photo;
  return Object.assign({}, photo, {
    title: pickField(photo, 'title', 'en'),
    desc: pickField(photo, 'desc', 'en'),
    seo_desc: pickField(photo, 'seo_desc', 'en'),
    seo_keywords: pickField(photo, 'seo_keywords', 'en'),
    date: photo.date_en || translateRuDate(photo.date),
    annotations: localizeAnnotations(photo.annotations, lang),
  });
}

// Deep-localizes the whole country -> series -> photos tree (used for both
// the active page's content and the sidebar nav, which walks the full tree).
function localizeDataTree(data, lang) {
  if (lang !== 'en') return data;
  var out = {};
  Object.keys(data).forEach(function(ck) {
    var c = data[ck];
    var oc = Object.assign({}, c, { label: pickField(c, 'label', 'en') });
    if (c.series) {
      oc.series = {};
      Object.keys(c.series).forEach(function(sk) {
        var s = c.series[sk];
        var os = Object.assign({}, s, { label: pickField(s, 'label', 'en') });
        if (s.photos) os.photos = s.photos.map(function(p) { return localizePhoto(p, lang); });
        oc.series[sk] = os;
      });
    }
    out[ck] = oc;
  });
  return out;
}

function localizeTags(tags, lang) {
  if (lang !== 'en') return tags;
  var out = {};
  Object.keys(tags).forEach(function(k) {
    var t = tags[k];
    out[k] = Object.assign({}, t, { label: pickField(t, 'label', 'en'), desc: pickField(t, 'desc', 'en') });
  });
  return out;
}

function localizeShoot(shoot, lang) {
  if (!shoot || lang !== 'en') return shoot;
  var out = Object.assign({}, shoot, {
    label: pickField(shoot, 'label', 'en'),
    desc: pickField(shoot, 'desc', 'en'),
  });
  if (shoot.photos) out.photos = shoot.photos.map(function(p) { return localizePhoto(p, lang); });
  return out;
}

// UI chrome — everything that isn't photo/series/shoot content.
var UI = {
  ru: {
    allWorks: 'ВСЕ РАБОТЫ', photosSuffix: 'фото', shuffle: '↺ ШАФЛ', present: '▶ ПРЕЗЕНТАЦИЯ', mapToggle: '🗺 КАРТА', tagPrefix: 'ТЕГ:',
    allShoots: 'все съемки', download: '↓ СКАЧАТЬ', downloadInstagram: '↓ ДЛЯ INSTAGRAM', addPhoto: '+ фото', editSeries: '✎ серия',
    allFaces: '✕ ВСЕ ЛИЦА', yourSelections: 'ВАШИ ПОДБОРКИ', relatedShoots: 'СВЯЗАННЫЕ СЪЁМКИ', otherShoots: 'ДРУГИЕ СЪЁМКИ',
    selectionClear: 'ОЧИСТИТЬ', selectionSave: 'СОХРАНИТЬ ПОДБОРКУ', selectionCount: 'ВЫБРАНО:',
    introText: 'Привет! Кажется, мы еще не знакомы. Если вы здесь по делу, присмотритесь к картинкам: вы можете отметить нужные вам галочками — и сохранить созданную подборку. Я получу об этом уведомление.',
    introClose: 'ПОНЯТНО', selectionPopupTitle: 'НАЗВАНИЕ ПОДБОРКИ', namePlaceholderCollection: 'например: на ретушь',
    cancel: 'ОТМЕНА', save: 'СОХРАНИТЬ', successText: 'Спасибо! Подборка сохранена и отправлена автору.', ok: 'ОК',
    enterNameError: 'Введите название', saveError: 'Ошибка сохранения', networkError: 'Ошибка сети',
    contactLabel: 'КОНТАКТ', subscribed: '✓ вы подписаны (почта)', unsubscribeBtn: 'отписаться',
    subscribeBtn: 'подписаться →', byEmail: 'по почте', byTelegram: 'в телеграм', theme: 'Переключить тему',
    aboutTitle: 'ОБО МНЕ', writeToMe: 'НАПИСАТЬ МНЕ', leaveReview: 'ОСТАВИТЬ ОТЗЫВ',
    emailPlaceholder: 'ваш e-mail (необязательно)', messagePlaceholder: 'сообщение', namePlaceholder: 'ваше имя (необязательно)',
    reviewPlaceholder: 'отзыв', submit: 'ОТПРАВИТЬ', sentContact: '✓ Сообщение отправлено', sentReview: '✓ Отзыв отправлен, спасибо!',
    editBtn: '✎ редактировать', prev: '← ПРЕД.', next: 'СЛЕД. →', fromShoot: 'ИЗ СЪЁМКИ:',
    share: 'ПОДЕЛИТЬСЯ', instagram: 'INSTAGRAM', commentsTab: 'КОММЕНТАРИИ', inquiryTab: 'ЗАЯВКА', loadingComments: 'ЗАГРУЗКА...',
    inquirySuccess: '✓ ОТПРАВЛЕНО — ОТВЕЧУ В ТЕЧЕНИЕ 24 ЧАСОВ', inquiryError: '✗ ПРОВЕРЬТЕ ИМЯ И EMAIL',
    print: 'ОТПЕЧАТОК', license: 'ЛИЦЕНЗИЯ', other: 'ВОПРОС', nameCaps: 'ИМЯ', emailCaps: 'EMAIL',
    messageOptional: 'СООБЩЕНИЕ (НЕОБЯЗАТЕЛЬНО)', submitArrow: 'ОТПРАВИТЬ →', relatedFrom: 'ЕЩЁ ИЗ',
    shootsTitle: 'СЪЁМКИ', noOpenShoots: 'Пока нет открытых съёмок.',
    wrongPassword: '✗ НЕВЕРНЫЙ ПАРОЛЬ', passwordPlaceholder: 'ПАРОЛЬ',
    unsubDoneTitle: 'ГОТОВО', unsubDoneText: 'Вы отписались от уведомлений.',
    unsubErrTitle: 'ОШИБКА', unsubErrText: 'Ссылка недействительна или уже использована.', backHome: '← на главную',
    igAlt: 'До встречи в Instagram', igOverlay: 'до встречи в инстаграм',
    langSwitch: 'EN',
    addPoint: 'ДОБАВИТЬ МЕТКУ', pointPopupTitle: 'ЧТО ЗДЕСЬ?', pointPlaceholder: 'например: это моя любимая деталь',
    pointAuthorPrefix: 'гость:', pointSignInTitle: 'ВОЙДИТЕ, ЧТОБЫ ДОБАВИТЬ МЕТКУ',
    panorama: 'панорама — прокрутите и приблизьте',
    promoTitle: 'ХОТИТЕ СЪЁМКУ?', promoSubtitle: 'Давайте обсудим — расскажите немного о задаче, и я свяжусь с вами.',
    promoContactPlaceholder: 'телефон, email или телеграм', promoSubmit: 'ОТПРАВИТЬ ЗАЯВКУ',
    promoSuccessText: '✓ Заявка отправлена — я свяжусь с вами в ближайшее время.', promoError: 'Введите имя и контакт',
    promoOrContact: 'ИЛИ НАПИШИТЕ НАПРЯМУЮ', promoFooterCta: 'Заказать съёмку',
    showAllPhotos: 'ПОКАЗАТЬ ВСЕ',
  },
  en: {
    allWorks: 'ALL WORKS', photosSuffix: 'photos', shuffle: '↺ SHUFFLE', present: '▶ PRESENT', mapToggle: '🗺 MAP', tagPrefix: 'TAG:',
    allShoots: 'all shoots', download: '↓ DOWNLOAD', downloadInstagram: '↓ FOR INSTAGRAM', addPhoto: '+ photo', editSeries: '✎ series',
    allFaces: '✕ ALL FACES', yourSelections: 'YOUR SELECTIONS', relatedShoots: 'RELATED SHOOTS', otherShoots: 'OTHER SHOOTS',
    selectionClear: 'CLEAR', selectionSave: 'SAVE SELECTION', selectionCount: 'SELECTED:',
    introText: "Hi! Looks like we haven't met yet. If you're here on business, take a look at the pictures — you can check the ones you want and save a selection. I'll get notified about it.",
    introClose: 'GOT IT', selectionPopupTitle: 'SELECTION NAME', namePlaceholderCollection: 'e.g. for retouching',
    cancel: 'CANCEL', save: 'SAVE', successText: 'Thanks! The selection was saved and sent to the author.', ok: 'OK',
    enterNameError: 'Enter a name', saveError: 'Save error', networkError: 'Network error',
    contactLabel: 'CONTACT', subscribed: '✓ subscribed (email)', unsubscribeBtn: 'unsubscribe',
    subscribeBtn: 'subscribe →', byEmail: 'by email', byTelegram: 'on telegram', theme: 'Toggle theme',
    aboutTitle: 'ABOUT ME', writeToMe: 'WRITE TO ME', leaveReview: 'LEAVE A REVIEW',
    emailPlaceholder: 'your e-mail (optional)', messagePlaceholder: 'message', namePlaceholder: 'your name (optional)',
    reviewPlaceholder: 'review', submit: 'SEND', sentContact: '✓ Message sent', sentReview: '✓ Review sent, thank you!',
    editBtn: '✎ edit', prev: '← PREV', next: 'NEXT →', fromShoot: 'FROM SHOOT:',
    share: 'SHARE', instagram: 'INSTAGRAM', commentsTab: 'COMMENTS', inquiryTab: 'INQUIRY', loadingComments: 'LOADING...',
    inquirySuccess: "✓ SENT — I'LL REPLY WITHIN 24 HOURS", inquiryError: '✗ CHECK YOUR NAME AND EMAIL',
    print: 'PRINT', license: 'LICENSE', other: 'QUESTION', nameCaps: 'NAME', emailCaps: 'EMAIL',
    messageOptional: 'MESSAGE (OPTIONAL)', submitArrow: 'SEND →', relatedFrom: 'MORE FROM',
    shootsTitle: 'SHOOTS', noOpenShoots: 'No open shoots yet.',
    wrongPassword: '✗ WRONG PASSWORD', passwordPlaceholder: 'PASSWORD',
    unsubDoneTitle: 'DONE', unsubDoneText: "You've been unsubscribed from notifications.",
    unsubErrTitle: 'ERROR', unsubErrText: 'This link is invalid or already used.', backHome: '← back home',
    igAlt: 'See you on Instagram', igOverlay: 'see you on instagram',
    langSwitch: 'RU',
    addPoint: 'ADD A MARK', pointPopupTitle: "WHAT'S HERE?", pointPlaceholder: "e.g. this is my favorite detail",
    pointAuthorPrefix: 'guest:', pointSignInTitle: 'SIGN IN TO ADD A MARK',
    panorama: 'panorama — scroll and zoom in',
    promoTitle: "WANT A SHOOT?", promoSubtitle: "Let's talk about it — tell me a bit about what you need and I'll get in touch.",
    promoContactPlaceholder: 'phone, email or telegram', promoSubmit: 'SEND REQUEST',
    promoSuccessText: "✓ Request sent — I'll get back to you shortly.", promoError: 'Enter your name and contact',
    promoOrContact: 'OR REACH OUT DIRECTLY', promoFooterCta: 'Order a shoot',
    showAllPhotos: 'SHOW ALL',
  },
};

var COLOR_LABELS_EN = {
  red: 'RED', orange: 'ORANGE', yellow: 'YELLOW', green: 'GREEN',
  teal: 'TEAL', blue: 'BLUE', purple: 'PURPLE', mono: 'MONOCHROME',
};

// Returns a color-family index (as from lib/color-utils COLOR_FAMILIES) with
// labels swapped to English when lang is 'en'; RU labels (the source data)
// pass through unchanged otherwise.
function localizeColorFamilies(families, lang) {
  if (lang !== 'en') return families;
  var out = {};
  Object.keys(families).forEach(function(k) {
    out[k] = Object.assign({}, families[k], { label: COLOR_LABELS_EN[k] || families[k].label });
  });
  return out;
}

module.exports = {
  LANGS: LANGS,
  UI: UI,
  localizeColorFamilies: localizeColorFamilies,
  parseAcceptLanguage: parseAcceptLanguage,
  pickPreferredLang: pickPreferredLang,
  normalizeLang: normalizeLang,
  langPrefix: langPrefix,
  altPrefix: altPrefix,
  pickField: pickField,
  localizePhoto: localizePhoto,
  localizeDataTree: localizeDataTree,
  localizeTags: localizeTags,
  localizeShoot: localizeShoot,
};
