// Copies of a single series frame (e.g. colour + black-and-white). The frame's own urls/width/height stay
// the main version; each copy lives in photo.variants = [{ id, label, label_en?, urls, width, height }].
// photo.variantLabel / variantLabel_en optionally name the main version in the public switcher.

var MAIN_LABEL = { ru: 'оригинал', en: 'original' };

// Same folder as the frame's -400/-800/-2400 files; '--' can't come out of slugify(), so no clash with another frame's id.
function storagePaths(country, series, photoId, variantId) {
  var stem = country + '/' + series + '/' + photoId + '--' + variantId;
  return { p400: stem + '-400.webp', p800: stem + '-800.webp', p2400: stem + '-2400.webp' };
}

function srcsetOf(urls) {
  return (urls && urls.preview && urls.full && urls.preview !== urls.full) ? (urls.preview + ' 800w, ' + urls.full + ' 2400w') : null;
}

function labelOf(ru, en, lang) {
  return (lang === 'en' && en) ? en : ru;
}

// Items for the public switcher: main version first. Empty when the frame has no copies (no switcher at all).
function switcherItems(photo, lang) {
  if (!photo || !photo.variants || !photo.variants.length) return [];
  var main = {
    id: '',
    label: labelOf(photo.variantLabel, photo.variantLabel_en, lang) || MAIN_LABEL[lang === 'en' ? 'en' : 'ru'],
    src: photo.urls && (photo.urls.full || photo.urls.preview),
    srcset: srcsetOf(photo.urls),
    width: photo.width, height: photo.height,
  };
  return [main].concat(photo.variants.map(function(v) {
    return {
      id: v.id,
      label: labelOf(v.label, v.label_en, lang),
      src: v.urls && (v.urls.full || v.urls.preview),
      srcset: srcsetOf(v.urls),
      width: v.width, height: v.height,
    };
  }));
}

module.exports = { storagePaths, switcherItems };
