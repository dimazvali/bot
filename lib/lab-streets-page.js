'use strict';
// dimazvali.com/lab/streets/ is a static page; this puts the visitor's language into its <html lang>,
// title and description/og tags (crawlers and link previews never run the page's JS).
// Language: ?lang=ru|en|ka, else Accept-Language, else Russian.

var LANGS = ['ru', 'en', 'ka'];
var URL = 'https://dimazvali.com/lab/streets/';

// the page ships with the Russian strings; each language replaces them
var META = {
  ru: {
    title: 'Чьи улицы Тбилиси — dimazvali.com',
    description: 'Дорожная сеть Тбилиси, разделённая по тем, в честь кого названы улицы: Тбилиси писателей, царей, учёных, военных, актёров и иностранцев. Карта и угадайка.',
    ogTitle: 'Чьи улицы Тбилиси',
    ogDescription: '2200 км улиц, разложенных по профессиям людей, в честь которых они названы. Угадаете, кем был Чичико Бенделиани?',
  },
  en: {
    title: 'Whose Streets, Tbilisi? — dimazvali.com',
    description: 'Tbilisi’s road network split by who the streets are named after: the Tbilisi of writers, kings, scientists, soldiers, actors and foreigners. A map and a quiz.',
    ogTitle: 'Whose Streets, Tbilisi?',
    ogDescription: '2,200 km of streets sorted by what the people they are named after did. Can you guess who Chichiko Bendeliani was?',
  },
  ka: {
    title: 'ვისია თბილისის ქუჩები? — dimazvali.com',
    description: 'თბილისის ქუჩები, დაყოფილი იმის მიხედვით, ვის სახელს ატარებენ: მწერლების, მეფეების, მეცნიერების, სამხედროების, მსახიობებისა და უცხოელების თბილისი. რუკა და ვიქტორინა.',
    ogTitle: 'ვისია თბილისის ქუჩები?',
    ogDescription: '2200 კმ ქუჩა, დალაგებული იმ ადამიანების პროფესიების მიხედვით, ვის სახელსაც ატარებენ. გამოიცნობთ, ვინ იყო ჩიჩიკო ბენდელიანი?',
  },
};

function pickLang(query, acceptsLanguages, hasAcceptLanguage) {
  var q = query && query.lang;
  if (LANGS.indexOf(q) >= 0) return q;
  if (!hasAcceptLanguage) return 'ru';
  return acceptsLanguages(LANGS) || 'en';
}

function attr(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

// html: the page as shipped (Russian). Throws if a string to replace is missing, so a page edit
// that breaks localisation fails loudly instead of silently serving Russian meta to everyone.
function localize(html, lang) {
  var ru = META.ru, m = META[lang] || ru;
  var out = html;
  function swap(from, to) {
    if (out.indexOf(from) < 0) throw new Error('lab-streets page: "' + from.slice(0, 50) + '" not found');
    out = out.replace(from, to);
  }
  swap('<html lang="ru">', '<html lang="' + lang + '">');
  swap('<title>' + ru.title + '</title>', '<title>' + attr(m.title) + '</title>');
  swap('<meta name="description" content="' + ru.description + '">', '<meta name="description" content="' + attr(m.description) + '">');
  swap('<meta property="og:title" content="' + ru.ogTitle + '">', '<meta property="og:title" content="' + attr(m.ogTitle) + '">');
  swap('<meta property="og:description" content="' + ru.ogDescription + '">', '<meta property="og:description" content="' + attr(m.ogDescription) + '">');
  swap('<meta property="og:url" content="' + URL + '">', '<meta property="og:url" content="' + URL + '?lang=' + lang + '">');
  return out;
}

module.exports = { LANGS: LANGS, META: META, pickLang: pickLang, localize: localize };
