'use strict';

// Substring triggers matched against normalize()d text. Level 1 = someone asks
// for a photographer / photoshoot (plus bare stems — the LLM rejects self-promo).
// Level 2 = business events that usually need photography. Stems are used for
// Georgian and Russian because case endings vary. Add a level by adding a key;
// prefilter() walks the keys in ascending order.
var TRIGGERS = {
  1: [
    // ru
    'ищу фотографа', 'ищем фотографа', 'нужен фотограф', 'нужна фотосъемка', 'нужна съемка',
    'посоветуйте фотографа', 'порекомендуйте фотографа', 'кто может поснимать', 'нужно провести съемку',
    'фотограф', 'фотосъем', 'фотосесси',
    // en
    'looking for a photographer', 'need a photographer', 'photographer needed',
    'recommend a photographer', 'looking for someone to shoot',
    'photographer', 'photoshoot', 'photo shoot',
    // ka
    'ვეძებ ფოტოგრაფს', 'მჭირდება ფოტოგრაფი', 'ფოტოგრაფს ვეძებთ', 'ფოტოგრაფის რეკომენდაცია',
    'ფოტოგრაფ', 'ფოტოსესი', 'ფოტო გადაღ',
  ],
  2: [
    // ru
    'открываем ресторан', 'открытие ресторана', 'открывается гостиниц', 'открывается отель',
    'открытие отеля', 'новое меню', 'запускаем бренд', 'запуск бренда', 'ищем smm', 'smm-специалист',
    'smm специалист', 'новая коллекция', 'открытие магазина', 'контент-мейкер', 'контент мейкер',
    'готовим мероприятие', 'ищем модель', 'запускаем airbnb', 'сдается новый объект',
    // en
    'opening a restaurant', 'restaurant opening', 'new menu', 'hotel opening', 'opening a hotel',
    'launching a brand', 'brand launch', 'looking for smm', 'smm manager', 'new collection',
    'store opening', 'shop opening', 'content creator', 'ugc creator', 'looking for a model',
    'airbnb listing',
    // ka
    'ვხსნით რესტორან', 'რესტორნის გახსნა', 'ახალი მენიუ', 'სასტუმროს გახსნა', 'ბრენდის გაშვება',
    'smm მენეჯერ', 'smm სპეციალისტ', 'ახალი კოლექცია', 'მაღაზიის გახსნა', 'კონტენტ კრეატორ',
    'კონტენტ მეიკერ', 'ვეძებთ მოდელს', 'მოდელს ვეძებთ',
  ],
};

function normalize(text) {
  return String(text == null ? '' : text).toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

// → { level, matched[] } for the lowest matching level, or null.
function prefilter(text) {
  var t = normalize(text);
  if (!t) return null;
  var levels = Object.keys(TRIGGERS).map(Number).sort(function(a, b) { return a - b; });
  for (var i = 0; i < levels.length; i++) {
    var matched = TRIGGERS[levels[i]].filter(function(p) { return t.indexOf(p) !== -1; });
    if (matched.length) return { level: levels[i], matched: matched };
  }
  return null;
}

module.exports = { TRIGGERS: TRIGGERS, normalize: normalize, prefilter: prefilter };
