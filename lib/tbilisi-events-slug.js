'use strict';

// Russian Cyrillic -> Latin. ъ/ь drop out.
var CYR = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
  й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y',
  ь: '', э: 'e', ю: 'yu', я: 'ya',
};

// Georgian (Mkhedruli, 33 letters) -> Latin, national/BGN-ish transliteration.
var GEO = {
  'ა': 'a', 'ბ': 'b', 'გ': 'g', 'დ': 'd', 'ე': 'e', 'ვ': 'v', 'ზ': 'z', 'თ': 't',
  'ი': 'i', 'კ': 'k', 'ლ': 'l', 'მ': 'm', 'ნ': 'n', 'ო': 'o', 'პ': 'p', 'ჟ': 'zh',
  'რ': 'r', 'ს': 's', 'ტ': 't', 'უ': 'u', 'ფ': 'p', 'ქ': 'k', 'ღ': 'gh', 'ყ': 'q',
  'შ': 'sh', 'ჩ': 'ch', 'ც': 'ts', 'ძ': 'dz', 'წ': 'ts', 'ჭ': 'ch', 'ხ': 'kh',
  'ჯ': 'j', 'ჰ': 'h',
};

function transliterate(str) {
  var out = '';
  for (var i = 0; i < str.length; i++) {
    var ch = str[i];
    var low = ch.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(CYR, low)) out += CYR[low];
    else if (Object.prototype.hasOwnProperty.call(GEO, ch)) out += GEO[ch];
    else out += ch;
  }
  return out;
}

// Turn any title/name into a url-safe lowercase latin slug.
// Returns '' when nothing usable survives (e.g. an emoji-only title) — callers
// should then fall back to the document id.
function slugify(input) {
  var s = String(input == null ? '' : input);
  s = s.normalize('NFKD').replace(/[̀-ͯ]/g, ''); // strip combining diacritics
  s = transliterate(s).toLowerCase();
  s = s.replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  if (s.length > 60) {
    s = s.slice(0, 60);
    var cut = s.lastIndexOf('-');
    if (cut > 20) s = s.slice(0, cut);
    s = s.replace(/-+$/g, '');
  }
  return s;
}

module.exports = { slugify: slugify };
