'use strict';

// Frame titles for search. Upload sets photo.title to the camera file name ("_MG_6876", "IMG_4086"), and
// that name stays: clients pick frames by it (collection "file names to copy", zip entry names). When the
// title is such a placeholder, generatePhotoSeo (lib/photo-seo.js) also writes seo_title / seo_title_en,
// and the public SEO surfaces (page <title>, h1, JSON-LD, breadcrumbs, sitemap image:title, alt) use
// display() — a hand-written title always wins.

// camera / phone / drone file names: _MG_6876, IMG_4086 (1), img-4086, mg-3545, DSC01234, DSCF0012,
// DJI_0042, PXL_20260812_101010, P1010203, GOPR0001, 20260812_101010, plain "6876"
var PLACEHOLDER_RE = /^(?:_?(?:img|mg|dsc[fn]?|dji|pxl|gopr|gp|p|photo|image|snapshot|screenshot)[\s_-]*\d[\d\s_-]*(?:\(\d+\))?|\d{3,}[\d\s_-]*)(?:[\s_-]*(?:copy|edit(?:ed)?|final|v\d+))*$/i;

function isPlaceholder(title) {
  var t = String(title == null ? '' : title).trim().replace(/\.(jpe?g|png|heic|webp|tiff?|cr[23]|nef|arw|dng)$/i, '');
  return !t || PLACEHOLDER_RE.test(t);
}

// photo is already localized (lib/photo-i18n.js localizePhoto picks title/seo_title for EN)
function display(photo) {
  if (!photo) return '';
  if (!isPlaceholder(photo.title)) return photo.title;
  return photo.seo_title || photo.title || photo.id || '';
}

module.exports = { isPlaceholder: isPlaceholder, display: display };
