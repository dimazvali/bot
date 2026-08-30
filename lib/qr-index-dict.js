'use strict';

// UI copy for the qr.dimazvali.com homepage (views/qr/index.pug), in the 3
// languages the language switcher offers. The "places" list itself is real
// Firestore data (not translated — entries only exist in whatever language
// they were entered in), only this static chrome text is multi-language.
//
// NOTE: the `ka` (Georgian) block was reconstructed by translating the
// English text — the original Georgian source arrived corrupted in transit
// (bytes in the 0x80-0x9F range silently stripped somewhere upstream) and
// could not be recovered byte-for-byte. It has NOT been proofread by a
// native speaker — please review before treating it as final.
var DICT = {
  ru: {
    kicker: 'окно в прошлое',
    title: 'Старые фотографии на своих местах',
    lead: 'ARchive — наводите камеру телефона на QR-код на табличке, и архивный снимок встаёт ровно туда, где он был сделан. Тот же угол, та же улица, только столетием раньше.',
    lead2: 'Каждая точка — отдельная страница: фотография, год, адрес и короткая история места. Ничего не нужно устанавливать, всё работает в браузере.',
    howTitle: 'Как это работает',
    mapTitle: 'Точки на карте',
    soon: 'новые точки — скоро',
    ctaTitle: 'Знаете место с историей?',
    ctaText: 'Пришлите адрес и архивный снимок — если получится совместить, точка появится на карте. Также можно предложить сотрудничество музеям, изданиям или городу.',
    ctaMail: 'Написать на почту',
    ctaTg: 'Телеграм',
    steps: [
      { h: 'Находите табличку', p: 'Небольшой QR-код на стене или ограде рядом со зданием.' },
      { h: 'Сканируете код', p: 'Камерой телефона, без приложений. Открывается страница места.' },
      { h: 'Наводите на здание', p: 'Архивный кадр ложится поверх современного вида — совмещайте по контуру.' },
    ],
  },
  en: {
    kicker: 'a window into the past',
    title: 'Old photographs put back in place',
    lead: 'ARchive — point your phone at the QR code on the plaque and the archival photograph appears exactly where it was taken. Same angle, same street, a century earlier.',
    lead2: 'Every point is its own page: the photograph, the year, the address and a short story of the place. Nothing to install, it all runs in the browser.',
    howTitle: 'How it works',
    mapTitle: 'Points on the map',
    soon: 'more points coming',
    ctaTitle: 'Know a place with a story?',
    ctaText: 'Send the address and an archival photograph — if the two can be matched, the point goes on the map. Museums, publications and cities are welcome too.',
    ctaMail: 'Send an email',
    ctaTg: 'Telegram',
    steps: [
      { h: 'Find the plaque', p: 'A small QR code on a wall or a fence next to the building.' },
      { h: 'Scan the code', p: 'With the phone camera, no app needed. The page of the place opens.' },
      { h: 'Aim at the building', p: 'The archival frame overlays the present view — line it up by the contours.' },
    ],
  },
  ka: {
    kicker: 'ფანჯარა წარსულში',
    title: 'ძველი ფოტოები თავის ადგილას',
    lead: 'ARchive — მიმართეთ ტელეფონის კამერა დაფაზე არსებულ QR-კოდს და საარქივო ფოტო ზუსტად იმ ადგილას გამოჩნდება, სადაც ის იყო გადაღებული. იგივე კუთხე, იგივე ქუჩა, უბრალოდ საუკუნით ადრე.',
    lead2: 'თითოეული წერტილი — ცალკე გვერდია: ფოტო, წელი, მისამართი და ადგილის მოკლე ისტორია. არაფრის დაყენება არ სჭირდება, ყველაფერი მუშაობს ბრაუზერში.',
    howTitle: 'როგორ მუშაობს',
    mapTitle: 'წერტილები რუკაზე',
    soon: 'ახალი წერტილები — მალე',
    ctaTitle: 'იცით ისტორიის მქონე ადგილი?',
    ctaText: 'გამოგვიგზავნეთ მისამართი და საარქივო ფოტო — თუ დამთხვევა გამოვა, წერტილი გამოჩნდება რუკაზე. ასევე შეგიძლიათ შემოგვთავაზოთ თანამშრომლობა მუზეუმებთან, გამოცემებთან ან ქალაქთან.',
    ctaMail: 'მოწერეთ ფოსტაზე',
    ctaTg: 'ტელეგრამი',
    steps: [
      { h: 'იპოვეთ დაფა', p: 'პატარა QR-კოდი კედელზე ან ღობეზე შენობასთან ახლოს.' },
      { h: 'დაასკანერეთ კოდი', p: 'ტელეფონის კამერით, აპლიკაციების გარეშე. იხსნება ადგილის გვერდი.' },
      { h: 'მიმართეთ შენობას', p: 'საარქივო კადრი გადაეფარება ახლანდელ ხედს — გაუსწორეთ კონტურით.' },
    ],
  },
};

function pluralRu(n, one, few, many) {
  var mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

// "N точка/точки/точек · Тбилиси" (also EN/KA) — used both for the initial
// server-rendered count and duplicated (small, deliberately) in index.js so
// the language switcher can recompute it client-side without a round trip.
function countText(lang, n) {
  if (lang === 'ru') return n + ' ' + pluralRu(n, 'точка', 'точки', 'точек') + ' · Тбилиси';
  if (lang === 'ka') return n + ' წერტილი · თბილისი';
  return n + ' ' + (n === 1 ? 'point' : 'points') + ' · Tbilisi';
}

module.exports = DICT;
module.exports.countText = countText;
