'use strict';
// RU/EN strings for the /blackout mini-game. `js` goes to the client as window.BLACKOUT_UI.
// Georgian outage phrases stay Georgian in both languages; only pronunciation and translation change.

// [georgian, pronunciation ru, translation ru, pronunciation en, translation en, outage type]
var PHRASES = [
  ['შუქი მო... წავიდაა!', 'Шуки мо... цавидаа!', 'Свет при... ушёл!', 'Shuki mo... tsavidaa!', 'The power’s ba... gone!', 'light'],
  ['მეცხრე ბლოკი გაითიშა!', 'Мецхре блоки гаитиша!', 'Девятый блок отключился!', 'Metskhre bloki gaitisha!', 'Unit nine is down!', 'light'],
  ['მეცხრე ბლოკი ისევ გაითიშა!', 'Мецхре блоки исев гаитиша!', 'Девятый блок опять отключился!', 'Metskhre bloki isev gaitisha!', 'Unit nine is down again!', 'light'],
  ['ტრანსფორმატორი გადაიწვა!', 'Трансформатори гадаицва!', 'Трансформатор сгорел!', 'Transpormatori gadaitsva!', 'The transformer burned out!', 'light'],
  ['გადამცემი ხაზი დაზიანდა!', 'Гадамцеми хази дазианда!', 'Линия электропередачи повреждена!', 'Gadamtsemi khazi dazianda!', 'The power line is damaged!', 'light'],
  ['ქვაბი დაინთო!', 'Кваби даинто!', 'Котёл растопили!', 'Kvabi dainto!', 'The boiler is lit!', 'gas'],
];

function phrases(lang) {
  var ru = lang === 'ru';
  return PHRASES.map(function (p) { return { ka: p[0], pron: ru ? p[1] : p[3], tr: ru ? p[2] : p[4], type: p[5] }; });
}

// map place names: the district data is stored in Russian
var PLACES_EN = {
  'Глдани': 'Gldani', 'Надзаладеви': 'Nadzaladevi', 'Дидубе': 'Didube', 'Чугурети': 'Chughureti',
  'Сабуртало': 'Saburtalo', 'Ваке': 'Vake', 'Мтацминда': 'Mtatsminda', 'Крцаниси': 'Krtsanisi',
  'Исани': 'Isani', 'Самгори': 'Samgori', 'Мтквари': 'Mtkvari', 'Лиси': 'Lisi', 'Нарикала': 'Narikala',
};

var UI = {
  ru: {
    htmlLang: 'ru',
    title: 'Тбилиси без света — it.dimazvali.com',
    description: 'Мини-игра: по районам Тбилиси отключают свет, воду и газ. Успей прислать нужного мастера, пока терпение горожан не кончилось.',
    ogTitle: 'Тбилиси без света',
    ogDescription: 'Свет, вода, газ — успей починить, пока город не взорвался.',
    back: '← проекты', switchHref: '/blackout?lang=en', switchLabel: 'EN',
    score: 'Счёт', level: 'Уровень', patience: 'Терпение',
    startTitle: ['Тбилиси', 'без света'],
    startP1: 'По районам отключают свет. Тапай по району, чтобы прислать мастера, — пока кольцо не догорело. Пропустишь — горожане теряют терпение.',
    startP2: 'Дальше — чаще. А потом добавятся вода и газ, и мастера придётся выбирать.',
    legend: { light: 'свет', water: 'вода', gas: 'газ' },
    startBtn: 'Начать смену', againBtn: 'Ещё смена',
    scoresTitle: 'Лучшие смены', loading: 'загружаем…',
    nickLabel: 'Ты в топ-10! Как тебя записать?', nickPlaceholder: 'ник', nickBtn: 'В таблицу',
    tools: { light: 'электрик', water: 'сантехник', gas: 'газовщик' },
    rotateTitle: 'Поверните телефон', rotateText: 'Город целиком помещается только горизонтально. Игра на паузе.',
    rotateBtn: 'Развернуть на весь экран',
    cvEyebrow: 'Кто это сделал?', cvTitle: 'Резюме автора за три вопроса', cvHref: '/cv?lang=ru',
    sea: ['Тбилисское', 'море'], north: 'С',
    place: function (n) { return n; },
    js: {
      without: { light: 'без света', water: 'без воды', gas: 'без газа' },
      levelNews: {
        2: 'Уровень 2 — отключают чаще',
        3: 'Новое: отключили воду! Нужен сантехник — кнопка 2',
        4: 'Уровень 4 — аварии идут пачками',
        5: 'Новое: газ! Газовщик — кнопка 3',
      },
      levelDefault: 'Уровень {n} — держись',
      startBanner: 'Отключают свет. Успевай!',
      wrongCrew: 'не тот мастер',
      combo: '×{n} комбо',
      verdicts: ['Город встал', 'Ну, бывало и хуже', 'Почти как в Европе', 'Тбилиси светится'],
      stats: '{verdict}. Уровень {level}, починено аварий: {fixes}. ',
      newRecord: 'Новый рекорд!', best: 'Рекорд: {n}.',
      scoresFailed: 'таблица не загрузилась', scoresEmpty: 'пока пусто — будь первым',
      errRate: 'Слишком часто, попробуй позже', errSave: 'Не получилось сохранить', errNet: 'Нет связи',
    },
  },
  en: {
    htmlLang: 'en',
    title: 'Tbilisi in the Dark — it.dimazvali.com',
    description: 'A mini-game: power, water and gas keep going out across Tbilisi districts. Send the right repair crew before the city runs out of patience.',
    ogTitle: 'Tbilisi in the Dark',
    ogDescription: 'Power, water, gas — fix them before the city blows up.',
    back: '← projects', switchHref: '/blackout?lang=ru', switchLabel: 'RU',
    score: 'Score', level: 'Level', patience: 'Patience',
    startTitle: ['Tbilisi', 'in the dark'],
    startP1: 'The power keeps going out across the districts. Tap a district to send a crew before the ring burns down. Miss one and the city loses patience.',
    startP2: 'It gets faster. Then water and gas join in, and you’ll have to pick the right crew.',
    legend: { light: 'power', water: 'water', gas: 'gas' },
    startBtn: 'Start shift', againBtn: 'Another shift',
    scoresTitle: 'Top shifts', loading: 'loading…',
    nickLabel: 'You made the top 10! What’s your name?', nickPlaceholder: 'nickname', nickBtn: 'Save',
    tools: { light: 'electrician', water: 'plumber', gas: 'gas fitter' },
    rotateTitle: 'Turn your phone', rotateText: 'The whole city only fits in landscape. The game is paused.',
    rotateBtn: 'Go fullscreen',
    cvEyebrow: 'Who made this?', cvTitle: 'The author’s CV in three questions', cvHref: '/cv?lang=en',
    sea: ['Tbilisi', 'Sea'], north: 'N',
    place: function (n) { return PLACES_EN[n] || n; },
    js: {
      without: { light: 'no power', water: 'no water', gas: 'no gas' },
      levelNews: {
        2: 'Level 2 — outages come faster',
        3: 'New: water is out! Send a plumber — key 2',
        4: 'Level 4 — outages come in bunches',
        5: 'New: gas! Gas fitter — key 3',
      },
      levelDefault: 'Level {n} — hang in there',
      startBanner: 'The power is going out. Hurry!',
      wrongCrew: 'wrong crew',
      combo: '×{n} combo',
      verdicts: ['The city has stopped', 'Could have been worse', 'Almost like Europe', 'Tbilisi is glowing'],
      stats: '{verdict}. Level {level}, outages fixed: {fixes}. ',
      newRecord: 'New record!', best: 'Best: {n}.',
      scoresFailed: 'couldn’t load the table', scoresEmpty: 'empty so far — be the first',
      errRate: 'Too many tries, wait a bit', errSave: 'Couldn’t save', errNet: 'No connection',
    },
  },
};

module.exports = function (lang) {
  var ui = UI[lang] || UI.ru;
  ui.js.phrases = phrases(ui.htmlLang);
  return ui;
};
